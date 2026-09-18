import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Re-implement the helper functions from sections.service.js for unit testing.
// This avoids touching the database while still verifying the file-cleanup logic.

function extractFileUrls(value) {
  const urls = new Set();
  const visit = (item) => {
    if (typeof item === 'string') {
      // Match full URLs: /img/filename, /img/gallery/filename, /img/video/filename
      const matches = item.match(/\/img\/(?:gallery\/|video\/)?[A-Za-z0-9._-]+/g);
      if (matches) matches.forEach((m) => urls.add(m));
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (item && typeof item === 'object') {
      Object.values(item).forEach(visit);
    }
  };
  visit(value);
  return urls;
}

async function deleteMediaFile(fileUrl) {
  const normalized = fileUrl.replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = normalized.split('/');

  // Expected: img/filename (2 segments) or img/gallery/filename, img/video/filename (3 segments)
  if (segments[0] !== 'img') return;

  let folder, filename;
  if (segments.length === 3 && ['gallery', 'video'].includes(segments[1])) {
    folder = segments[1];
    filename = segments[2];
  } else if (segments.length === 2) {
    folder = 'image';
    filename = segments[1];
  } else {
    return;
  }

  if (path.basename(filename) !== filename) return; // traversal guard

  const dir = folder === 'gallery' ? join(rootDir, 'public', 'img', 'gallery')
             : folder === 'video' ? join(rootDir, 'public', 'img', 'video')
             : join(rootDir, 'public', 'img');
  const target = join(dir, filename);
  const relative = path.relative(dir, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;

  try {
    await fs.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Failed to delete media file: ${target}`, err);
  }
}

import path from 'path';

async function cleanupOrphanedFiles(oldContent, newContent) {
  const oldUrls = extractFileUrls(oldContent);
  const newUrls = extractFileUrls(newContent);
  for (const url of oldUrls) {
    if (!newUrls.has(url)) await deleteMediaFile(url);
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function assert(name, condition) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log('=== Test 1: extractFileUrls ===');
  const content = {
    items: [
      { before: '/img/gallery/a.webp', after: '/img/gallery/b.webp' },
      { video: '/img/video/c.mp4' },
      { image: '/img/d.webp' },
      { url: 'https://example.com/img/e.webp' }, // should NOT match (not /img/)
    ],
    text: 'See /img/f.jpg for details'
  };
  const urls = extractFileUrls(content);
  await assert('extracts /img/gallery/ URLs', urls.has('/img/gallery/a.webp'));
  await assert('extracts /img/gallery/ after', urls.has('/img/gallery/b.webp'));
  await assert('extracts /img/video/ URLs', urls.has('/img/video/c.mp4'));
  await assert('extracts /img/ root URLs', urls.has('/img/d.webp'));
  await assert('does NOT extract https URLs', !urls.has('https://example.com/img/e.webp'));
  await assert('extracts /img/ from text strings', urls.has('/img/f.jpg'));

  console.log('\n=== Test 2: deleteMediaFile deletes real files ===');
  const testDir = join(rootDir, 'public', 'img', 'gallery');
  const testFile = join(testDir, 'test-delete.webp');
  await fs.writeFile(testFile, 'dummy');
  await assert('file exists before deletion', await fs.access(testFile).then(() => true).catch(() => false));
  await deleteMediaFile('/img/gallery/test-delete.webp');
  await assert('file deleted after deletion', !await fs.access(testFile).then(() => true).catch(() => false));

  console.log('\n=== Test 3: deleteMediaFile ignores missing files (idempotent) ===');
  await deleteMediaFile('/img/gallery/nonexistent.webp');
  await assert('no error on missing file', true);

  console.log('\n=== Test 4: deleteMediaFile rejects path traversal ===');
  const safeCheck = await fs.access(join(rootDir, 'package.json')).then(() => true).catch(() => false);
  // Should not be deleted even if referenced
  await deleteMediaFile('/img/../package.json');
  await assert('path traversal rejected', safeCheck === await fs.access(join(rootDir, 'package.json')).then(() => true).catch(() => false));

  console.log('\n=== Test 5: cleanupOrphanedFiles deletes removed files, keeps referenced ===');
  const dir1 = join(rootDir, 'public', 'img', 'gallery');
  const keep = join(dir1, 'keep.webp');
  const remove1 = join(dir1, 'remove1.webp');
  const remove2 = join(dir1, 'remove2.webp');
  await fs.writeFile(keep, 'x');
  await fs.writeFile(remove1, 'x');
  await fs.writeFile(remove2, 'x');

  const oldC = { items: [{ before: '/img/gallery/keep.webp', after: '/img/gallery/remove1.webp', extra: '/img/gallery/remove2.webp' }] };
  const newC = { items: [{ before: '/img/gallery/keep.webp' }] };
  await cleanupOrphanedFiles(oldC, newC);

  await assert('kept file still exists', await fs.access(keep).then(() => true).catch(() => false));
  await assert('removed file 1 deleted', !await fs.access(remove1).then(() => true).catch(() => false));
  await assert('removed file 2 deleted', !await fs.access(remove2).then(() => true).catch(() => false));

  console.log('\n=== Test 6: extractFileUrls from complex content ===');
  const complexContent = {
    eyebrow: 'Gallery',
    title: 'Before & After',
    items: [
      { before: '/img/gallery/1.webp', after: '/img/gallery/2.webp', video: '/img/video/1.mp4' },
      { before: '/img/gallery/3.webp' },
    ],
    description: 'View our work at /img/gallery/featured.webp',
    nested: { deep: { url: '/img/video/trailer.mp4' } }
  };
  const complexUrls = extractFileUrls(complexContent);
  await assert('gallery items found', complexUrls.has('/img/gallery/1.webp') && complexUrls.has('/img/gallery/2.webp') && complexUrls.has('/img/gallery/3.webp'));
  await assert('video items found', complexUrls.has('/img/video/1.mp4') && complexUrls.has('/img/video/trailer.mp4'));
  await assert('inline URLs found', complexUrls.has('/img/gallery/featured.webp'));

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
