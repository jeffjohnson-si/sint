/**
 * Resizes and re-encodes images in the browser before upload.
 *
 * A modern phone camera produces 3–6 MB photos. Most Solomon Islands users are
 * on metered mobile data, and the API stores whatever it receives, so shrinking
 * here is the cheapest bandwidth win available: the upload is smaller, the feed
 * loads faster for everyone else, and server storage lasts longer.
 *
 * Videos are passed through untouched — re-encoding those in the browser would
 * need a much heavier pipeline. GIFs are re-encoded like any other image: the
 * API only stores JPG and PNG, so an animated GIF becomes its first frame.
 */

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;
/** Below this, compression saves little and risks visible softening. */
const SKIP_BELOW_BYTES = 300 * 1024;

function renamed(file) {
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = QUALITY } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxDimension / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    // JPEG has no alpha: without this, transparent PNG logos come out black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );

    // Never make a file bigger than the original.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], renamed(file), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}

/** Same thing for a list, in parallel. Order is preserved. */
export function compressImages(files = [], options) {
  return Promise.all(files.map((file) => compressImage(file, options)));
}
