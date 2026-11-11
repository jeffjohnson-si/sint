import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config/env.js';
import { badRequest } from '../utils/httpError.js';

const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const VIDEO_TYPES = new Map([
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
]);

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    // Never trust the client filename: build our own from a random id + a
    // whitelisted extension so uploads cannot escape the upload directory.
    const extension = IMAGE_TYPES.get(file.mimetype) ?? VIDEO_TYPES.get(file.mimetype) ?? '';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed =
    file.fieldname === 'video' ? VIDEO_TYPES.has(file.mimetype) : IMAGE_TYPES.has(file.mimetype);
  if (!allowed) {
    cb(badRequest(`Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
}

export const uploadMedia = multer({
  storage,
  fileFilter,
  // 10 images + 1 video + avatar + cover. The old total of maxImagesPerPost + 1
  // rejected a legitimate request that carried photos and a new avatar.
  limits: { fileSize: config.maxVideoBytes, files: config.maxImagesPerPost + 3 },
}).fields([
  { name: 'images', maxCount: config.maxImagesPerPost },
  { name: 'video', maxCount: 1 },
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

export function publicUrlFor(filename) {
  return `${config.publicBaseUrl}/uploads/${filename}`;
}

export async function removeUploads(files) {
  await Promise.all(
    files.map((file) =>
      fs.promises.rm(path.join(config.uploadDir, path.basename(file.filename)), { force: true }),
    ),
  );
}
