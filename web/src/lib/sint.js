/**
 * Every SINT endpoint the web client uses, in one place, so screens never build
 * URLs or remember response envelopes themselves.
 */

import { api } from './api.js';

const qs = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'All') continue;
    search.append(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

/* -------------------------------------------------------------------- auth */

export const signUp = (body) => api('/auth/signup', { method: 'POST', json: body, auth: false });
export const signIn = (email, password) =>
  api('/auth/login', { method: 'POST', json: { email, password }, auth: false });
export const me = () => api('/auth/me');

export const forgotPassword = (email) =>
  api('/auth/forgot-password', { method: 'POST', json: { email }, auth: false });

export const verifyResetCode = (email, code) =>
  api('/auth/verify-code', { method: 'POST', json: { email, code }, auth: false });

/** Confirms the address used at sign up. Returns a fresh session. */
export const verifyEmail = (email, code) =>
  api('/auth/verify-email', { method: 'POST', json: { email, code }, auth: false });

export const resendVerification = (email) =>
  api('/auth/resend-verification', { method: 'POST', json: { email }, auth: false });

/**
 * Development shortcut: signs in as a seeded demo account without credentials.
 * The endpoint answers 404 when the API runs with NODE_ENV=production.
 */
export const devLogin = (account) =>
  api('/auth/dev-login', { method: 'POST', json: { account }, auth: false });

/** Uses the short-lived token returned by verifyResetCode, not the session token. */
export const resetPassword = (password, resetToken) =>
  api('/auth/reset-password', { method: 'POST', json: { password }, token: resetToken, auth: false });

export const saveInterests = (categories) =>
  api('/users/me/interests', { method: 'POST', json: { categories } });

/* ------------------------------------------------------------------- posts */

export const feed = ({ tab = 'for-you', category, query, author, page = 1, limit = 12 } = {}) =>
  api(`/posts${qs({ tab, category, q: query, author, page, limit })}`);

export const userPosts = (userId, page = 1) => api(`/users/${userId}/posts${qs({ page, limit: 12 })}`);
export const savedPosts = (page = 1) => api(`/users/me/saved${qs({ page, limit: 12 })}`);
export const likedPosts = (page = 1) => api(`/users/me/liked${qs({ page, limit: 12 })}`);

export const getPost = (id) => api(`/posts/${id}`);
export const createPost = (body) => api('/posts', { method: 'POST', json: body });
export const updatePost = (id, body) => api(`/posts/${id}`, { method: 'PATCH', json: body });
export const deletePost = (id) => api(`/posts/${id}`, { method: 'DELETE' });

export const setLiked = (id, liked) =>
  api(`/posts/${id}/like`, { method: liked ? 'POST' : 'DELETE' });

export const setSaved = (id, saved) =>
  api(`/posts/${id}/save`, { method: saved ? 'POST' : 'DELETE' });

/* ---------------------------------------------------------------- comments */

export const comments = (postId, page = 1) =>
  api(`/posts/${postId}/comments${qs({ page, limit: 20 })}`);

export const addComment = (postId, { text, parentId, media }) =>
  api(`/posts/${postId}/comments`, {
    method: 'POST',
    json: { text, ...(parentId ? { parentId } : {}), ...(media?.length ? { media } : {}) },
  });

export const setCommentLiked = (commentId, liked) =>
  api(`/comments/${commentId}/like`, { method: liked ? 'POST' : 'DELETE' });

export const deleteComment = (commentId) =>
  api(`/comments/${commentId}`, { method: 'DELETE' });

/* ------------------------------------------------------------------ users */

export const profile = (userId) => api(`/users/${userId}`);
export const updateProfile = (changes) => api('/users/me', { method: 'PATCH', json: changes });

export const setFollowing = (userId, following) =>
  api(`/users/${userId}/follow`, { method: following ? 'POST' : 'DELETE' });

export const followers = (userId) => api(`/users/${userId}/followers`);
export const following = (userId) => api(`/users/${userId}/following`);

/* ----------------------------------------------------------------- search */

export const searchBusinesses = ({ query, category, page = 1 } = {}) =>
  api(`/search${qs({ q: query, category, page, limit: 20 })}`);

export const categories = () => api('/search/categories');

export const suggestions = (limit = 10) => api(`/suggestions${qs({ limit })}`);

/* ------------------------------------------------------------------ inbox */

export const conversations = (query) => api(`/conversations${qs({ q: query })}`);
export const openConversation = (userId) =>
  api('/conversations', { method: 'POST', json: { userId } });
export const messages = (conversationId) =>
  api(`/conversations/${conversationId}/messages${qs({ limit: 50 })}`);
export const sendMessage = (conversationId, body) =>
  api(`/conversations/${conversationId}/messages`, { method: 'POST', json: body });
export const markConversationRead = (conversationId) =>
  api(`/conversations/${conversationId}/read`, { method: 'POST' });

/* ---------------------------------------------------------- notifications */

export const notifications = (page = 1) => api(`/notifications${qs({ page, limit: 20 })}`);
export const unreadCount = () => api('/notifications/unread-count');
export const markAllNotificationsRead = () => api('/notifications/read-all', { method: 'POST' });
export const markNotificationRead = (id) => api(`/notifications/${id}/read`, { method: 'POST' });

/* ----------------------------------------------------------- subscription */

export const subscription = () => api('/subscription');
export const checkout = (plan) => api('/subscription/checkout', { method: 'POST', json: { plan } });
export const refreshSubscription = () => api('/subscription/refresh', { method: 'POST' });
export const cancelSubscription = () => api('/subscription/cancel', { method: 'POST' });

/* ---------------------------------------------------------------- uploads */

export async function upload({ images = [], video = null, avatar = null, cover = null }) {
  const form = new FormData();
  images.forEach((file) => form.append('images', file));
  if (video) form.append('video', video);
  if (avatar) form.append('avatar', avatar);
  if (cover) form.append('cover', cover);

  return api('/uploads', { method: 'POST', form });
}
