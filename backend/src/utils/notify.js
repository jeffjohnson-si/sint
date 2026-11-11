import { Notification } from '../models/Notification.js';

/**
 * Creates a notification unless the actor is the recipient (no self-notices).
 * Like notifications are de-duplicated so repeated like/unlike does not spam.
 */
export async function notify({ user, actor, type, text, post, comment, conversation }) {
  const recipientId = user?.toString();
  const actorId = actor?.toString();
  if (!recipientId || !actorId || recipientId === actorId) return null;

  if (type === 'like' || type === 'follow') {
    const existing = await Notification.findOne({
      user: recipientId,
      actor: actorId,
      type,
      post: post ?? null,
      comment: comment ?? null,
    });
    if (existing) {
      existing.read = false;
      existing.text = text ?? existing.text;
      existing.createdAt = new Date();
      await existing.save();
      return existing;
    }
  }

  return Notification.create({
    user: recipientId,
    actor: actorId,
    type,
    text: text ?? '',
    post: post ?? null,
    comment: comment ?? null,
    conversation: conversation ?? null,
  });
}
