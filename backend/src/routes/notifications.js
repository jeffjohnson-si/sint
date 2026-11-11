import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';
import { notFound } from '../utils/httpError.js';
import { AUTHOR_FIELDS, assertObjectId, parsePaging } from '../utils/query.js';
import { serializeNotification } from '../utils/serialize.js';

export const notificationsRouter = express.Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = { user: req.user._id };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', AUTHOR_FIELDS),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, read: false }),
  ]);

  res.json({
    items: items.map(serializeNotification),
    unreadCount,
    page,
    limit,
    total,
    hasMore: skip + items.length < total,
  });
});

notificationsRouter.get('/unread-count', requireAuth, async (req, res) => {
  const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ unreadCount });
});

notificationsRouter.post('/read-all', requireAuth, async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ unreadCount: 0 });
});

notificationsRouter.post('/:id/read', requireAuth, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: assertObjectId(req.params.id, 'notification id'), user: req.user._id },
    { $set: { read: true } },
    { new: true },
  ).populate('actor', AUTHOR_FIELDS);

  if (!notification) throw notFound('That notification no longer exists');
  res.json({ notification: serializeNotification(notification) });
});
