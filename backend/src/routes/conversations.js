import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { notify } from '../utils/notify.js';
import { AUTHOR_FIELDS, assertObjectId, escapeRegex, normaliseMessageMedia, parsePaging } from '../utils/query.js';
import { serializeConversation, serializeMessage } from '../utils/serialize.js';

export const conversationsRouter = express.Router();

async function loadConversation(id, viewer) {
  assertObjectId(id, 'conversation id');
  const conversation = await Conversation.findById(id).populate('participants', AUTHOR_FIELDS);
  if (!conversation) throw notFound('That conversation no longer exists');

  const isParticipant = conversation.participants.some(
    (participant) => participant._id.toString() === viewer._id.toString(),
  );
  if (!isParticipant) throw forbidden('You are not part of this conversation');

  return conversation;
}

/** GET /api/conversations - inbox list, newest activity first. */
conversationsRouter.get('/', requireAuth, async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id })
    .sort({ updatedAt: -1 })
    .populate('participants', AUTHOR_FIELDS);

  const search = String(req.query.q ?? '').trim();
  const pattern = search ? new RegExp(escapeRegex(search), 'i') : null;

  const items = conversations
    .map((conversation) => serializeConversation(conversation, req.user._id))
    .filter((item) => !pattern || pattern.test(item.otherUser?.fullName ?? ''));

  const unreadTotal = items.reduce((sum, item) => sum + item.unreadCount, 0);
  res.json({ items, unreadTotal });
});

/** POST /api/conversations - opens (or reuses) a direct conversation. */
conversationsRouter.post('/', requireAuth, async (req, res) => {
  const otherId = assertObjectId(req.body?.userId, 'user id');
  if (otherId === req.user._id.toString()) throw badRequest('You cannot message yourself');

  const other = await User.findById(otherId);
  if (!other) throw notFound('That profile no longer exists');

  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, other._id], $size: 2 },
  }).populate('participants', AUTHOR_FIELDS);

  if (!conversation) {
    conversation = await Conversation.create({ participants: [req.user._id, other._id] });
    await conversation.populate('participants', AUTHOR_FIELDS);
  }

  res.status(201).json({ conversation: serializeConversation(conversation, req.user._id) });
});

conversationsRouter.get('/:id/messages', requireAuth, async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.user);
  const { page, limit, skip } = parsePaging({ ...req.query, limit: req.query.limit ?? '50' });

  const [messages, total] = await Promise.all([
    Message.find({ conversation: conversation._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Message.countDocuments({ conversation: conversation._id }),
  ]);

  res.json({
    conversation: serializeConversation(conversation, req.user._id),
    items: messages.reverse().map((message) => serializeMessage(message, req.user._id)),
    page,
    limit,
    total,
    hasMore: skip + messages.length < total,
  });
});

/** Inbox preview text for a message that carries media but no words. */
function mediaPreview(media) {
  const videos = media.filter((item) => item.type === 'video').length;
  const images = media.length - videos;

  if (videos > 0 && images > 0) return 'Photo and video';
  if (videos > 0) return 'Video';
  return images > 1 ? `${images} photos` : 'Photo';
}

conversationsRouter.post('/:id/messages', requireAuth, async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.user);
  const text = String(req.body?.text ?? '').trim();
  const media = normaliseMessageMedia(req.body?.media);

  if (!text && media.length === 0) throw badRequest('Message cannot be empty');

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text,
    media,
  });

  const other = conversation.participants.find(
    (participant) => participant._id.toString() !== req.user._id.toString(),
  );

  conversation.lastMessage = {
    text: text || mediaPreview(media),
    sender: req.user._id,
    at: new Date(),
  };
  if (other) {
    const key = other._id.toString();
    conversation.unread.set(key, (conversation.unread.get(key) ?? 0) + 1);
  }
  await conversation.save();

  await notify({
    user: other?._id,
    actor: req.user._id,
    type: 'message',
    text: `${req.user.fullName} sent you a message`,
    conversation: conversation._id,
  });

  res.status(201).json({ message: serializeMessage(message, req.user._id) });
});

/** POST /api/conversations/:id/read - clears the viewer's unread counter. */
conversationsRouter.post('/:id/read', requireAuth, async (req, res) => {
  const conversation = await loadConversation(req.params.id, req.user);

  conversation.unread.set(req.user._id.toString(), 0);
  await conversation.save();

  await Message.updateMany(
    { conversation: conversation._id, sender: { $ne: req.user._id }, readAt: null },
    { $set: { readAt: new Date() } },
  );

  res.json({ conversation: serializeConversation(conversation, req.user._id) });
});
