import express from 'express';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUrlFor, removeUploads, uploadMedia } from '../middleware/upload.js';
import { badRequest } from '../utils/httpError.js';

export const uploadRouter = express.Router();

/**
 * Accepts `images` (max 10), `video` (max 1), `avatar` and `cover` fields and
 * returns public URLs. Clients upload first, then reference the URLs when
 * creating a post or saving a profile.
 */
uploadRouter.post('/', requireAuth, uploadMedia, async (req, res) => {
  const grouped = req.files ?? {};
  const images = grouped.images ?? [];
  const videos = grouped.video ?? [];
  const singles = [...(grouped.avatar ?? []), ...(grouped.cover ?? [])];

  const oversizedImage = [...images, ...singles].find((file) => file.size > config.maxImageBytes);
  if (oversizedImage) {
    await removeUploads([...images, ...videos, ...singles]);
    throw badRequest(`Images must be smaller than ${config.maxImageBytes / (1024 * 1024)}MB`);
  }

  res.status(201).json({
    images: images.map((file) => ({ type: 'image', url: publicUrlFor(file.filename) })),
    video: videos[0] ? { type: 'video', url: publicUrlFor(videos[0].filename) } : null,
    avatar: grouped.avatar?.[0] ? publicUrlFor(grouped.avatar[0].filename) : null,
    cover: grouped.cover?.[0] ? publicUrlFor(grouped.cover[0].filename) : null,
  });
});
