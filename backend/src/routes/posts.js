import express from 'express';
import { BOOST_WINDOW_MS, INTEREST_WINDOW_MS, TOP_INTERESTS } from '../config/constants.js';
import {
  optionalAuth,
  requireActiveSubscription,
  requireAuth,
  requirePublisher,
} from '../middleware/auth.js';
import { Comment } from '../models/Comment.js';
import { Follow } from '../models/Follow.js';
import { Notification } from '../models/Notification.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { recordInterest, rankedInterests } from '../utils/interests.js';
import { notify } from '../utils/notify.js';
import {
  AUTHOR_FIELDS,
  assertObjectId,
  boostedAuthorIds,
  escapeRegex,
  followedAuthorIds,
  normaliseCategory,
  normaliseCommentMedia,
  normaliseMedia,
  parsePaging,
} from '../utils/query.js';
import { serializeComment, serializePost } from '../utils/serialize.js';

export const postsRouter = express.Router();

async function loadPost(id) {
  assertObjectId(id, 'post id');
  const post = await Post.findById(id).populate('author', AUTHOR_FIELDS);
  if (!post) throw notFound('That post no longer exists');
  return post;
}

function assertOwner(post, user) {
  const authorId = post.author?._id?.toString() ?? post.author?.toString();
  if (authorId !== user._id.toString()) throw forbidden('You can only manage your own posts');
}

/**
 * Newest first, except posts count as newer when they are worth surfacing:
 * [BOOST_WINDOW_MS] for a paid business, [INTEREST_WINDOW_MS] when the post is
 * in one of the viewer's categories. Both are bonuses, not filters, so every
 * business still appears further down the feed.
 */
async function rankedPosts(filter, { skip, limit, interests = [] }) {
  const boosted = await boostedAuthorIds();
  if (boosted.length === 0 && interests.length === 0) {
    return Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS);
  }

  const ordered = await Post.aggregate([
    { $match: filter },
    {
      $addFields: {
        rankAt: {
          $add: [
            '$createdAt',
            { $cond: [{ $in: ['$author', boosted] }, BOOST_WINDOW_MS, 0] },
            { $cond: [{ $in: ['$category', interests] }, INTEREST_WINDOW_MS, 0] },
          ],
        },
      },
    },
    { $sort: { rankAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _id: 1 } },
    // `rankAt` is computed, so no index can serve the sort. Spilling to disk
    // keeps the feed working once the collection outgrows the 100MB sort limit.
  ]).allowDiskUse(true);

  const ids = ordered.map((row) => row._id);
  const posts = await Post.find({ _id: { $in: ids } }).populate('author', AUTHOR_FIELDS);
  const byId = new Map(posts.map((post) => [post._id.toString(), post]));
  return ids.map((id) => byId.get(id.toString())).filter(Boolean);
}

/** GET /api/posts - feed with For You / Following tabs, category and search filters. */
postsRouter.get('/', optionalAuth, async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = {};

  const category = req.query.category;
  if (category && category !== 'All') filter.category = normaliseCategory(category);

  if (req.query.tab === 'following') {
    if (!req.user) throw badRequest('Sign in to see your Following feed');
    const following = await Follow.find({ follower: req.user._id }).select('following');
    filter.author = { $in: following.map((row) => row.following) };
  }

  if (req.query.author) {
    filter.author = assertObjectId(req.query.author, 'author id');
  }

  const search = String(req.query.q ?? '').trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const matchingAuthors = await User.find({ fullName: pattern }).select('_id');
    filter.$or = [{ content: pattern }, { author: { $in: matchingAuthors.map((u) => u._id) } }];
  }

  const [posts, total] = await Promise.all([
    rankedPosts(filter, {
      skip,
      limit,
      interests: rankedInterests(req.user).slice(0, TOP_INTERESTS),
    }),
    Post.countDocuments(filter),
  ]);

  const followed = await followedAuthorIds(req.user, posts);

  res.json({
    items: posts.map((post) => serializePost(post, req.user, followed)),
    page,
    limit,
    total,
    hasMore: skip + posts.length < total,
  });
});

/** POST /api/posts - publishers with a live trial or paid plan only. */
postsRouter.post('/', requireAuth, requirePublisher, requireActiveSubscription, async (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  const media = normaliseMedia(req.body?.media) ?? [];

  if (!content && media.length === 0) throw badRequest('Add some text or media to your post');

  const post = await Post.create({
    author: req.user._id,
    content,
    media,
    category: normaliseCategory(req.body?.category ?? req.user.category ?? ''),
    location: String(req.body?.location ?? '').trim(),
  });

  await User.updateOne({ _id: req.user._id }, { $inc: { postCount: 1 } });
  await post.populate('author', AUTHOR_FIELDS);

  res.status(201).json({ post: serializePost(post, req.user) });
});

postsRouter.get('/:id', optionalAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  const followed = await followedAuthorIds(req.user, [post]);
  res.json({ post: serializePost(post, req.user, followed) });
});

postsRouter.patch('/:id', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  assertOwner(post, req.user);

  if (req.body?.content !== undefined) post.content = String(req.body.content).trim();
  if (req.body?.category !== undefined) post.category = normaliseCategory(req.body.category);
  if (req.body?.location !== undefined) post.location = String(req.body.location).trim();
  const media = normaliseMedia(req.body?.media);
  if (media !== undefined) post.media = media;

  if (!post.content && post.media.length === 0) {
    throw badRequest('A post needs either text or media');
  }

  await post.save();
  res.json({ post: serializePost(post, req.user) });
});

postsRouter.delete('/:id', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  assertOwner(post, req.user);

  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    // Otherwise the bell keeps an entry that opens a post that no longer exists.
    Notification.deleteMany({ post: post._id }),
    User.updateOne({ _id: req.user._id }, { $inc: { postCount: -1 } }),
    User.updateMany({ savedPosts: post._id }, { $pull: { savedPosts: post._id } }),
  ]);
  await post.deleteOne();

  res.json({ message: 'Post deleted' });
});

postsRouter.post('/:id/like', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  const result = await Post.updateOne(
    { _id: post._id, likes: { $ne: req.user._id } },
    { $addToSet: { likes: req.user._id }, $inc: { likeCount: 1 } },
  );

  if (result.modifiedCount > 0) {
    await notify({
      user: post.author?._id ?? post.author,
      actor: req.user._id,
      type: 'like',
      text: `${req.user.fullName} liked your post`,
      post: post._id,
    });
    await recordInterest(req.user._id, [post.category, post.author?.category], 'like');
  }

  const fresh = await loadPost(req.params.id);
  const followed = await followedAuthorIds(req.user, [fresh]);
  res.json({ post: serializePost(fresh, req.user, followed) });
});

postsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  const result = await Post.updateOne(
    { _id: post._id, likes: req.user._id },
    { $pull: { likes: req.user._id }, $inc: { likeCount: -1 } },
  );

  // Taking the like back should take the notification with it, or the author is
  // left with an alert for a like that no longer exists.
  if (result.modifiedCount > 0) {
    await Notification.deleteOne({
      user: post.author?._id ?? post.author,
      actor: req.user._id,
      type: 'like',
      post: post._id,
      comment: null,
    });
  }

  const fresh = await loadPost(req.params.id);
  const followed = await followedAuthorIds(req.user, [fresh]);
  res.json({ post: serializePost(fresh, req.user, followed) });
});

postsRouter.post('/:id/save', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  await User.updateOne({ _id: req.user._id }, { $addToSet: { savedPosts: post._id } });
  await recordInterest(req.user._id, [post.category, post.author?.category], 'save');
  const viewer = await User.findById(req.user._id);
  const followed = await followedAuthorIds(viewer, [post]);
  res.json({ post: serializePost(post, viewer, followed) });
});

postsRouter.delete('/:id/save', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  await User.updateOne({ _id: req.user._id }, { $pull: { savedPosts: post._id } });
  const viewer = await User.findById(req.user._id);
  const followed = await followedAuthorIds(viewer, [post]);
  res.json({ post: serializePost(post, viewer, followed) });
});

/** GET /api/posts/:id/comments - top level comments with their nested replies. */
postsRouter.get('/:id/comments', optionalAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  const { page, limit, skip } = parsePaging(req.query);

  const [roots, total] = await Promise.all([
    Comment.find({ post: post._id, parent: null })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS),
    Comment.countDocuments({ post: post._id, parent: null }),
  ]);

  const replies = await Comment.find({ parent: { $in: roots.map((c) => c._id) } })
    .sort({ createdAt: 1 })
    .populate('author', AUTHOR_FIELDS);

  const repliesByParent = new Map();
  for (const reply of replies) {
    const key = reply.parent.toString();
    if (!repliesByParent.has(key)) repliesByParent.set(key, []);
    repliesByParent.get(key).push(reply);
  }

  res.json({
    items: roots.map((root) =>
      serializeComment(root, req.user, repliesByParent.get(root._id.toString()) ?? []),
    ),
    page,
    limit,
    total,
    hasMore: skip + roots.length < total,
  });
});

/** POST /api/posts/:id/comments - any signed in account may comment or reply. */
postsRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const post = await loadPost(req.params.id);
  const text = String(req.body?.text ?? '').trim();
  const media = normaliseCommentMedia(req.body?.media);
  if (!text && media.length === 0) {
    throw badRequest('Write something or attach an image before posting your comment');
  }

  let parent = null;
  if (req.body?.parentId) {
    parent = await Comment.findById(assertObjectId(req.body.parentId, 'parent id'));
    if (!parent || parent.post.toString() !== post._id.toString()) {
      throw notFound('That comment no longer exists');
    }
    if (parent.parent) throw badRequest('Replies can only be one level deep');
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    parent: parent?._id ?? null,
    text,
    media,
  });

  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  if (parent) await Comment.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });

  await notify({
    user: parent ? parent.author : post.author?._id ?? post.author,
    actor: req.user._id,
    type: 'comment',
    text: parent
      ? `${req.user.fullName} replied to your comment`
      : `${req.user.fullName} commented on your post`,
    post: post._id,
    comment: comment._id,
  });

  await comment.populate('author', AUTHOR_FIELDS);
  await recordInterest(req.user._id, [post.category, post.author?.category], 'comment');
  res.status(201).json({ comment: serializeComment(comment, req.user) });
});
