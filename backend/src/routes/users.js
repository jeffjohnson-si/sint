import express from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { Follow } from '../models/Follow.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { recordInterest, rankedInterests } from '../utils/interests.js';
import { notify } from '../utils/notify.js';
import {
  AUTHOR_FIELDS,
  assertObjectId,
  assertSafeUrl,
  followedAuthorIds,
  normaliseCategory,
  normaliseProfileLinks,
  parsePaging,
} from '../utils/query.js';
import { serializePost, serializeUserRef } from '../utils/serialize.js';

export const usersRouter = express.Router();

async function loadUser(id) {
  assertObjectId(id, 'user id');
  const user = await User.findById(id);
  if (!user) throw notFound('That profile no longer exists');
  return user;
}

async function isFollowing(followerId, followingId) {
  if (!followerId) return false;
  return Boolean(await Follow.exists({ follower: followerId, following: followingId }));
}

/** PATCH /api/users/me - edit profile. Must be declared before /:id. */
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const user = req.user;
  const body = req.body ?? {};

  const textFields = ['fullName', 'bio', 'location', 'phone', 'address', 'contactEmail'];
  for (const field of textFields) {
    if (body[field] !== undefined) user[field] = String(body[field]).trim();
  }
  if (!user.fullName) throw badRequest('Name cannot be empty');

  if (body.category !== undefined) user.category = normaliseCategory(body.category);
  if (body.avatarUrl !== undefined) user.avatarUrl = assertSafeUrl(body.avatarUrl, 'avatar url');
  if (body.coverUrl !== undefined) user.coverUrl = assertSafeUrl(body.coverUrl, 'cover url');

  if (body.links !== undefined) user.links = normaliseProfileLinks(body.links);

  await user.save();
  res.json({ user: user.toPublicJson({ includeEmail: true }) });
});

/**
 * POST /api/users/me/interests - the categories picked during onboarding.
 * Seeded with the same weight as a follow, so they outrank casual signals but
 * still fade behind what the viewer actually does later on.
 */
usersRouter.post('/me/interests', requireAuth, async (req, res) => {
  const list = Array.isArray(req.body?.categories) ? req.body.categories : [];
  const categories = [...new Set(list.map((value) => normaliseCategory(value)).filter(Boolean))];

  await recordInterest(req.user._id, categories, 'follow');

  const user = await User.findById(req.user._id);
  res.json({ interests: rankedInterests(user) });
});

/** GET /api/users/me/saved - the viewer's saved posts collection. */
usersRouter.get('/me/saved', requireAuth, async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const savedIds = req.user.savedPosts ?? [];

  const posts = await Post.find({ _id: { $in: savedIds } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  const followed = await followedAuthorIds(req.user, posts);

  res.json({
    items: posts.map((post) => serializePost(post, req.user, followed)),
    page,
    limit,
    total: savedIds.length,
    hasMore: skip + posts.length < savedIds.length,
  });
});

/** GET /api/users/me/liked - posts the viewer has liked. */
usersRouter.get('/me/liked', requireAuth, async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = { likes: req.user._id };

  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('author', AUTHOR_FIELDS),
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

usersRouter.get('/:id', optionalAuth, async (req, res) => {
  const user = await loadUser(req.params.id);
  res.json({
    user: user.toPublicJson({
      includeEmail: req.user?._id.toString() === user._id.toString(),
      isFollowing: await isFollowing(req.user?._id, user._id),
    }),
  });
});

usersRouter.get('/:id/posts', optionalAuth, async (req, res) => {
  const user = await loadUser(req.params.id);
  const { page, limit, skip } = parsePaging(req.query);
  const filter = { author: user._id };

  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('author', AUTHOR_FIELDS),
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

usersRouter.post('/:id/follow', requireAuth, async (req, res) => {
  const target = await loadUser(req.params.id);
  if (target._id.toString() === req.user._id.toString()) {
    throw forbidden('You cannot follow yourself');
  }

  const created = await Follow.findOneAndUpdate(
    { follower: req.user._id, following: target._id },
    { $setOnInsert: { follower: req.user._id, following: target._id } },
    { upsert: true, new: false },
  );

  if (!created) {
    await Promise.all([
      User.updateOne({ _id: target._id }, { $inc: { followerCount: 1 } }),
      User.updateOne({ _id: req.user._id }, { $inc: { followingCount: 1 } }),
      notify({
        user: target._id,
        actor: req.user._id,
        type: 'follow',
        text: `${req.user.fullName} started following you`,
      }),
      recordInterest(req.user._id, target.category, 'follow'),
    ]);
  }

  const fresh = await loadUser(req.params.id);
  res.json({ user: fresh.toPublicJson({ isFollowing: true }) });
});

usersRouter.delete('/:id/follow', requireAuth, async (req, res) => {
  const target = await loadUser(req.params.id);
  const removed = await Follow.findOneAndDelete({ follower: req.user._id, following: target._id });

  if (removed) {
    await Promise.all([
      User.updateOne({ _id: target._id }, { $inc: { followerCount: -1 } }),
      User.updateOne({ _id: req.user._id }, { $inc: { followingCount: -1 } }),
    ]);
  }

  const fresh = await loadUser(req.params.id);
  res.json({ user: fresh.toPublicJson({ isFollowing: false }) });
});

usersRouter.get('/:id/followers', optionalAuth, async (req, res) => {
  const user = await loadUser(req.params.id);
  const rows = await Follow.find({ following: user._id }).populate('follower', AUTHOR_FIELDS);
  res.json({ items: rows.map((row) => serializeUserRef(row.follower)) });
});

usersRouter.get('/:id/following', optionalAuth, async (req, res) => {
  const user = await loadUser(req.params.id);
  const rows = await Follow.find({ follower: user._id }).populate('following', AUTHOR_FIELDS);
  res.json({ items: rows.map((row) => serializeUserRef(row.following)) });
});
