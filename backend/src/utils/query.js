import mongoose from 'mongoose';
import {
  CATEGORIES,
  MAX_COMMENT_IMAGES,
  MAX_MESSAGE_IMAGES,
  MAX_MESSAGE_VIDEOS,
  MAX_PROFILE_LINKS,
} from '../config/constants.js';
import { config } from '../config/env.js';
import { Follow } from '../models/Follow.js';
import { User } from '../models/User.js';
import { badRequest } from '../utils/httpError.js';

// `subscription` rides along so author refs can carry the verified badge.
export const AUTHOR_FIELDS = 'fullName avatarUrl accountType category subscription';

export function parsePaging(query) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? '20', 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function assertObjectId(value, label = 'id') {
  if (!mongoose.isValidObjectId(value)) throw badRequest(`Invalid ${label}`);
  return value;
}

/** Escapes a user supplied string before it is used inside a RegExp. */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normaliseCategory(value) {
  if (value === undefined || value === null || value === '') return '';
  const match = CATEGORIES.find((category) => category.toLowerCase() === String(value).toLowerCase());
  if (!match) throw badRequest(`Unknown category: ${value}`);
  return match;
}

/** Rejects anything that is not an http(s) URL so no javascript: URIs are stored. */
export function assertSafeUrl(value, label = 'url') {
  if (!value) return '';
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw badRequest(`Invalid ${label}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw badRequest(`Invalid ${label}`);
  return parsed.toString();
}

export function normaliseMedia(media) {
  if (media === undefined) return undefined;
  if (!Array.isArray(media)) throw badRequest('media must be a list');

  const images = media.filter((item) => item?.type === 'image');
  const videos = media.filter((item) => item?.type === 'video');
  if (images.length > config.maxImagesPerPost) {
    throw badRequest(`A post can hold at most ${config.maxImagesPerPost} images`);
  }
  if (videos.length > 1) throw badRequest('A post can hold at most 1 video');

  return media.map((item) => {
    if (!['image', 'video'].includes(item?.type)) throw badRequest('media type must be image or video');
    return {
      type: item.type,
      url: assertSafeUrl(item.url, 'media url'),
      thumbnailUrl: item.thumbnailUrl ? assertSafeUrl(item.thumbnailUrl, 'thumbnail url') : '',
    };
  });
}

/** Comments carry images only, and fewer of them than a post. */
export function normaliseCommentMedia(media) {
  if (media === undefined || media === null) return [];
  if (!Array.isArray(media)) throw badRequest('media must be a list');
  if (media.length > MAX_COMMENT_IMAGES) {
    throw badRequest(`A comment can hold at most ${MAX_COMMENT_IMAGES} images`);
  }

  return media.map((item) => {
    if (item?.type !== undefined && item.type !== 'image') {
      throw badRequest('Comments can only contain images');
    }
    return { type: 'image', url: assertSafeUrl(item?.url, 'media url') };
  });
}

/**
 * Chat media is a list of `{ type, url }` items: up to 4 images and 1 video, so
 * a message can never smuggle a `javascript:` link or an arbitrary string into
 * the thread.
 */
export function normaliseMessageMedia(media) {
  if (media === undefined || media === null) return [];
  if (!Array.isArray(media)) throw badRequest('media must be a list');

  const images = media.filter((item) => item?.type !== 'video');
  const videos = media.filter((item) => item?.type === 'video');
  if (images.length > MAX_MESSAGE_IMAGES) {
    throw badRequest(`A message can hold at most ${MAX_MESSAGE_IMAGES} images`);
  }
  if (videos.length > MAX_MESSAGE_VIDEOS) {
    throw badRequest(`A message can hold at most ${MAX_MESSAGE_VIDEOS} video`);
  }

  return media.map((item) => {
    if (!['image', 'video'].includes(item?.type)) {
      throw badRequest('media type must be image or video');
    }
    return { type: item.type, url: assertSafeUrl(item.url, 'media url') };
  });
}

/**
 * Profile links are `{ label, url }` pairs. Entries without a url are dropped so
 * an empty row in the editor never becomes a dead link, and the label falls back
 * to the host name.
 */
export function normaliseProfileLinks(links) {
  if (links === undefined || links === null) return [];
  if (!Array.isArray(links)) throw badRequest('links must be a list');

  const cleaned = links.filter((item) => String(item?.url ?? '').trim() !== '');
  if (cleaned.length > MAX_PROFILE_LINKS) {
    throw badRequest(`A profile can list at most ${MAX_PROFILE_LINKS} links`);
  }

  return cleaned.map((item) => {
    const url = assertSafeUrl(String(item.url).trim(), 'link url');
    const label = String(item.label ?? '').trim().slice(0, 40);
    return { label: label || new URL(url).host.replace(/^www\./, ''), url };
  });
}

/** Ids of publishers on a paid plan, whose posts and profiles get a push. */
export async function boostedAuthorIds() {
  const rows = await User.find({
    'subscription.status': 'active',
    'subscription.currentPeriodEnd': { $gt: new Date() },
  })
    .select('_id')
    .lean();

  return rows.map((row) => row._id);
}

/**
 * Ids of the authors of [posts] that [viewer] already follows. Feeding this into
 * `serializePost` lets the client render Follow buttons on every card.
 */
export async function followedAuthorIds(viewer, posts) {
  if (!viewer) return new Set();

  const authorIds = posts.map((post) => post.author?._id ?? post.author).filter(Boolean);
  if (authorIds.length === 0) return new Set();

  const rows = await Follow.find({
    follower: viewer._id,
    following: { $in: authorIds },
  })
    .select('following')
    .lean();

  return new Set(rows.map((row) => row.following.toString()));
}
