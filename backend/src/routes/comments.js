import express from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { Comment } from '../models/Comment.js';
import { Notification } from '../models/Notification.js';
import { Post } from '../models/Post.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { notify } from '../utils/notify.js';
import { AUTHOR_FIELDS, assertObjectId, normaliseCommentMedia } from '../utils/query.js';
import { serializeComment } from '../utils/serialize.js';

export const commentsRouter = express.Router();

async function loadComment(id) {
  assertObjectId(id, 'comment id');
  const comment = await Comment.findById(id).populate('author', AUTHOR_FIELDS);
  if (!comment) throw notFound('That comment no longer exists');
  return comment;
}

function assertOwner(comment, user) {
  const authorId = comment.author?._id?.toString() ?? comment.author?.toString();
  if (authorId !== user._id.toString()) throw forbidden('You can only manage your own comments');
}

commentsRouter.get('/:id/replies', optionalAuth, async (req, res) => {
  const comment = await loadComment(req.params.id);
  const replies = await Comment.find({ parent: comment._id })
    .sort({ createdAt: 1 })
    .populate('author', AUTHOR_FIELDS);
  res.json({ items: replies.map((reply) => serializeComment(reply, req.user)) });
});

commentsRouter.patch('/:id', requireAuth, async (req, res) => {
  const comment = await loadComment(req.params.id);
  assertOwner(comment, req.user);

  const text = String(req.body?.text ?? '').trim();
  if (req.body?.media !== undefined) comment.media = normaliseCommentMedia(req.body.media);
  if (!text && comment.media.length === 0) {
    throw badRequest('A comment needs text or an image');
  }

  comment.text = text;
  await comment.save();
  res.json({ comment: serializeComment(comment, req.user) });
});

commentsRouter.delete('/:id', requireAuth, async (req, res) => {
  const comment = await loadComment(req.params.id);
  assertOwner(comment, req.user);

  const replies = await Comment.find({ parent: comment._id }).select('_id');
  const replyIds = replies.map((reply) => reply._id);

  await Comment.deleteMany({ parent: comment._id });
  await comment.deleteOne();

  // Remove the alerts that pointed at this comment or its replies, or the
  // recipient keeps a notification that opens nothing.
  await Notification.deleteMany({ comment: { $in: [comment._id, ...replyIds] } });

  await Post.updateOne({ _id: comment.post }, { $inc: { commentCount: -(replyIds.length + 1) } });
  if (comment.parent) {
    await Comment.updateOne({ _id: comment.parent }, { $inc: { replyCount: -1 } });
  }

  res.json({ message: 'Comment deleted' });
});

commentsRouter.post('/:id/like', requireAuth, async (req, res) => {
  const comment = await loadComment(req.params.id);
  const result = await Comment.updateOne(
    { _id: comment._id, likes: { $ne: req.user._id } },
    { $addToSet: { likes: req.user._id }, $inc: { likeCount: 1 } },
  );

  if (result.modifiedCount > 0) {
    await notify({
      user: comment.author?._id ?? comment.author,
      actor: req.user._id,
      type: 'like',
      text: `${req.user.fullName} liked your comment`,
      post: comment.post,
      comment: comment._id,
    });
  }

  res.json({ comment: serializeComment(await loadComment(req.params.id), req.user) });
});

commentsRouter.delete('/:id/like', requireAuth, async (req, res) => {
  const comment = await loadComment(req.params.id);
  const result = await Comment.updateOne(
    { _id: comment._id, likes: req.user._id },
    { $pull: { likes: req.user._id }, $inc: { likeCount: -1 } },
  );

  // Same as posts: an unliked comment should not keep its alert.
  if (result.modifiedCount > 0) {
    await Notification.deleteOne({
      user: comment.author?._id ?? comment.author,
      actor: req.user._id,
      type: 'like',
      post: comment.post,
      comment: comment._id,
    });
  }

  res.json({ comment: serializeComment(await loadComment(req.params.id), req.user) });
});
