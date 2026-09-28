import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

// Maximum length of the longest image edge after upload optimization.
// Displayed media (hero, gallery panels, before/after) never needs more
// than this at normal zoom, and capping it keeps stored and served
// images small.
const MAX_DIM = 1600;
const WEBP_QUALITY = 82;
// Files already this small are left untouched — re-encoding them gains
// nothing and risks quality loss.
const KEEP_BELOW_BYTES = 150 * 1024;

/**
 * Re-encode an uploaded image in place as a WebP capped at MAX_DIM.
 * The multer `file` object is updated (path / filename / mimetype) so the
 * rest of the upload pipeline saves and serves the optimized WebP.
 *
 * Security rule: if sharp cannot decode the file (bad magic bytes that
 * passed only a partial check, a RIFF-prefixed payload, corrupted data),
 * the temp upload is deleted and the upload is rejected — an unverified
 * original must never be stored in the publicly served directory.
 */
export async function optimizeUploadedImage(file) {
  if (!file || !file.path || !file.mimetype || !file.mimetype.startsWith('image/')) {
    return file;
  }

  try {
    const input = sharp(file.path);
    const meta = await input.metadata();

    if (!meta.width || !meta.height) return file;

    // Already a small WebP within the cap — nothing to gain.
    if (
      meta.format === 'webp' &&
      meta.width <= MAX_DIM &&
      meta.height <= MAX_DIM &&
      file.size <= KEEP_BELOW_BYTES
    ) {
      return file;
    }

    const output = await input
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    if (output.length >= file.size) {
      // Re-encoding did not make the file smaller — keep the original.
      return file;
    }

    const ext = path.extname(file.path);
    const webpPath = ext && ext.toLowerCase() === '.webp'
      ? file.path
      : `${file.path.slice(0, file.path.length - ext.length)}.webp`;

    const originalPath = file.path;
    await fs.writeFile(webpPath, output);
    if (webpPath !== originalPath) {
      await fs.unlink(originalPath).catch(() => {});
    }

    file.path = webpPath;
    file.filename = path.basename(webpPath);
    file.mimetype = 'image/webp';
    file.size = output.length;
  } catch (err) {
    console.error(`[IMAGE-OPTIMIZER] Rejected ${file.path}: ${err.message}`);
    await fs.unlink(file.path).catch(() => {});
    const rejectErr = new Error(`Не удалось обработать изображение (${err.message || 'invalid image'})`);
    rejectErr.statusCode = 415;
    throw rejectErr;
  }
}
