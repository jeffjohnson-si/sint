import fs from 'node:fs/promises';
import express from 'express';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUrlFor, removeUploads, uploadMedia } from '../middleware/upload.js';
import { badRequest } from '../utils/httpError.js';

export const uploadRouter = express.Router();

const ALLOWED = 'Only JPG and PNG images, or MP4, MOV and WebM videos, are allowed';

/**
 * The multipart content type is whatever the client claims it is. Reading the
 * first bytes stops a script or a document renamed to `.jpg` from being stored
 * and then served back to other browsers.
 */
async function hasValidSignature(file) {
  let handle;
  try {
    handle = await fs.open(file.path, 'r');
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, 16, 0);
    if (bytesRead < 8) return false;

    switch (file.mimetype) {
      case 'image/jpeg':
        return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      case 'image/png':
        return header
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case 'video/mp4':
      case 'video/quicktime':
        // ISO base media files carry "ftyp" at byte 4.
        return header.subarray(4, 8).toString('ascii') === 'ftyp';
      case 'video/webm':
        return (
          header[0] === 0x1a &&
          header[1] === 0x45 &&
          header[2] === 0xdf &&
          header[3] === 0xa3
        );
      default:
        return false;
    }
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

/**
 * Accepts `images` (max 10), `video` (max 1), `avatar` and `cover` fields and
 * returns public URLs. Clients upload first, then reference the URLs when
 * creating a post or saving a profile. Images must be JPG or PNG under
 * `MAX_IMAGE_MB`; videos may be MP4, MOV or WebM.
 */
uploadRouter.post('/', requireAuth, uploadMedia, async (req, res) => {
  const grouped = req.files ?? {};
  const images = grouped.images ?? [];
  const videos = grouped.video ?? [];
  const singles = [...(grouped.avatar ?? []), ...(grouped.cover ?? [])];
  const everything = [...images, ...videos, ...singles];

  const oversizedImage = [...images, ...singles].find((file) => file.size > config.maxImageBytes);
  if (oversizedImage) {
    await removeUploads(everything);
    throw badRequest(`Images must be smaller than ${config.maxImageBytes / (1024 * 1024)}MB`);
  }

  for (const file of everything) {
    if (!(await hasValidSignature(file))) {
      await removeUploads(everything);
      throw badRequest(ALLOWED);
    }
  }

  res.status(201).json({
    images: images.map((file) => ({ type: 'image', url: publicUrlFor(file.filename) })),
    video: videos[0] ? { type: 'video', url: publicUrlFor(videos[0].filename) } : null,
    avatar: grouped.avatar?.[0] ? publicUrlFor(grouped.avatar[0].filename) : null,
    cover: grouped.cover?.[0] ? publicUrlFor(grouped.cover[0].filename) : null,
  });
});
