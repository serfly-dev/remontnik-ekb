// One-time maintenance: shrink already-uploaded images in place (same URL,
// same format family) so the DB references stay valid. New uploads are
// optimized automatically by the upload pipeline; this only cleans legacy
// files. Run: node server/scripts/optimize-existing.js
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIRS = [
  path.join(__dirname, '..', '..', 'public', 'img'),
  path.join(__dirname, '..', '..', 'public', 'img', 'gallery')
];
const MAX_DIM = 1600;
const SIZE_THRESHOLD = 120 * 1024;
const EXT_ENCODERS = {
  '.jpg': (img) => img.jpeg({ quality: 80 }),
  '.jpeg': (img) => img.jpeg({ quality: 80 }),
  '.webp': (img) => img.webp({ quality: 82 }),
  '.png': (img) => img.png({ compressionLevel: 9 })
};

let processed = 0;
let skipped = 0;

for (const dir of DIRS) {
  let entries;
  try { entries = await fs.readdir(dir); } catch { continue; }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const filePath = path.join(dir, name);
    const ext = path.extname(name).toLowerCase();
    const encoder = EXT_ENCODERS[ext];
    if (!encoder) continue;
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      const meta = await sharp(filePath).metadata();
      if (!meta.width || !meta.height) { skipped++; continue; }
      if (stat.size <= SIZE_THRESHOLD && meta.width <= MAX_DIM && meta.height <= MAX_DIM) { skipped++; continue; }
      const out = await encoder(
        sharp(filePath).resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      ).toBuffer();
      if (out.length >= stat.size) { skipped++; continue; }
      await fs.writeFile(filePath, out);
      console.log(`optimized ${path.relative(dir, filePath)} ${Math.round(stat.size / 1024)}KB -> ${Math.round(out.length / 1024)}KB`);
      processed++;
    } catch (err) {
      console.error(`skip ${filePath}: ${err.message}`);
    }
  }
}
console.log(`done: ${processed} optimized, ${skipped}+ unchanged`);
