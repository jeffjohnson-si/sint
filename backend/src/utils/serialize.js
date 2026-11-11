import { PUBLISHER_TYPES } from '../config/constants.js';
import { isVerifiedBusiness } from './verified.js';

const idOf = (value) => (value?._id ? value._id.toString() : value?.toString() ?? null);

/** Compact author shape embedded in posts, comments and conversations. */
export function serializeUserRef(user, isFollowing) {
  if (!user) return null;
  if (!user.fullName) return { id: idOf(user) };
  return {
    id: idOf(user),
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? '',
    accountType: user.accountType,
    isPublisher: PUBLISHER_TYPES.includes(user.accountType),
    isVerified: isVerifiedBusiness(user),
    category: user.category ?? '',
    ...(isFollowing === undefined ? {} : { isFollowing }),
  };
}

/**
 * [followedAuthors] is the set of author ids the viewer follows; pass it so the
 * feed can render Follow buttons without a second round trip.
 */
export function serializePost(post, viewer, followedAuthors) {
  const viewerId = viewer ? idOf(viewer) : null;
  const savedIds = (viewer?.savedPosts ?? []).map((id) => id.toString());
  const likeIds = (post.likes ?? []).map((id) => idOf(id));
  const postId = idOf(post);
  const authorId = idOf(post.author);

  return {
    id: postId,
    author: serializeUserRef(
      post.author,
      followedAuthors ? followedAuthors.has(authorId) : undefined,
    ),
    content: post.content,
    category: post.category ?? '',
    location: post.location ?? '',
    media: (post.media ?? []).map((item) => ({
      type: item.type,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl ?? '',
    })),
    likeCount: post.likeCount ?? likeIds.length,
    commentCount: post.commentCount ?? 0,
    isLiked: viewerId ? likeIds.includes(viewerId) : false,
    isSaved: viewerId ? savedIds.includes(postId) : false,
    isOwner: viewerId ? idOf(post.author) === viewerId : false,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

export function serializeComment(comment, viewer, replies = []) {
  const viewerId = viewer ? idOf(viewer) : null;
  const likeIds = (comment.likes ?? []).map((id) => idOf(id));

  return {
    id: idOf(comment),
    postId: idOf(comment.post),
    parentId: comment.parent ? idOf(comment.parent) : null,
    author: serializeUserRef(comment.author),
    text: comment.text,
    media: (comment.media ?? []).map((item) => ({ type: 'image', url: item.url })),
    likeCount: comment.likeCount ?? likeIds.length,
    replyCount: comment.replyCount ?? replies.length,
    isLiked: viewerId ? likeIds.includes(viewerId) : false,
    isOwner: viewerId ? idOf(comment.author) === viewerId : false,
    createdAt: comment.createdAt,
    replies: replies.map((reply) => serializeComment(reply, viewer)),
  };
}

export function serializeNotification(notification) {
  return {
    id: idOf(notification),
    type: notification.type,
    text: notification.text,
    actor: serializeUserRef(notification.actor),
    postId: notification.post ? idOf(notification.post) : null,
    commentId: notification.comment ? idOf(notification.comment) : null,
    conversationId: notification.conversation ? idOf(notification.conversation) : null,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

export function serializeConversation(conversation, viewerId) {
  const other = (conversation.participants ?? []).find((p) => idOf(p) !== idOf(viewerId));
  const unread = conversation.unread?.get?.(idOf(viewerId)) ?? 0;

  return {
    id: idOf(conversation),
    otherUser: serializeUserRef(other),
    lastMessage: conversation.lastMessage?.at
      ? {
          text: conversation.lastMessage.text,
          senderId: idOf(conversation.lastMessage.sender),
          at: conversation.lastMessage.at,
        }
      : null,
    unreadCount: unread,
    updatedAt: conversation.updatedAt,
  };
}

export function serializeMessage(message, viewerId) {
  return {
    id: idOf(message),
    conversationId: idOf(message.conversation),
    senderId: idOf(message.sender),
    isMine: idOf(message.sender) === idOf(viewerId),
    text: message.text,
    media: (message.media ?? []).map((item) => ({ type: item.type, url: item.url })),
    readAt: message.readAt,
    createdAt: message.createdAt,
  };
}

export { idOf };
