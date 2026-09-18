import { query, queryOne, execute } from '../database/connection.js';
import fs from 'fs/promises';
import path from 'path';

import config from '../config/index.js';

const GALLERY_DIR = path.join(config.rootDir, 'public', 'img', 'gallery');
const VIDEO_DIR = path.join(config.rootDir, 'public', 'img', 'video');
const IMAGE_DIR = path.join(config.rootDir, 'public', 'img');

/**
 * Extract all /img/... file URLs from a nested content object.
 * Returns a Set of full URLs (e.g., "/img/gallery/foo.webp").
 */
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

/**
 * Delete a media file referenced by its public URL.
 * Silently ignores missing files (ENOENT) — idempotent.
 */
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

  const dir = folder === 'gallery' ? GALLERY_DIR : folder === 'video' ? VIDEO_DIR : IMAGE_DIR;
  const target = path.resolve(dir, filename);
  const relative = path.relative(dir, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;

  try {
    await fs.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Failed to delete media file: ${target}`, err);
  }
}

/**
 * Delete all media files referenced in oldContent that are no longer present in newContent.
 */
async function cleanupOrphanedFiles(oldContent, newContent) {
  const oldUrls = extractFileUrls(oldContent);
  const newUrls = extractFileUrls(newContent);
  for (const url of oldUrls) {
    if (!newUrls.has(url)) await deleteMediaFile(url);
  }
}

/**
 * Sections service — CRUD for editable landing page content.
 * Each section stores its content as a JSON object in the `content` column.
 * Section keys are stable identifiers (hero, services, variants, calculator, cta, gallery, ...).
 */

export async function listSections() {
  const rows = await query(
    'SELECT id, key, title, content, order_index, updated_at FROM sections ORDER BY order_index ASC, id ASC'
  );
  return rows.map(parseSection);
}

export async function getSectionByKey(key) {
  const row = await queryOne(
    'SELECT id, key, title, content, order_index, updated_at FROM sections WHERE key = ?',
    [key]
  );
  return row ? parseSection(row) : null;
}

export async function upsertSection(key, content, title = null) {
  const existing = await getSectionByKey(key);

  if (existing) {
    // Remove files that were present in the old content but are no longer referenced.
    // This handles deleting individual gallery items, removing a hero image, etc.
    await cleanupOrphanedFiles(existing.content, content);

    await execute(
      `UPDATE sections
       SET content = ?, title = COALESCE(?, title), updated_at = datetime('now')
       WHERE key = ?`,
      [JSON.stringify(content), title, key]
    );
  } else {
    // Determine next order_index
    const maxRow = await queryOne('SELECT MAX(order_index) as m FROM sections');
    const nextOrder = (maxRow?.m || 0) + 1;
    await execute(
      `INSERT INTO sections (key, title, content, order_index) VALUES (?, ?, ?, ?)`,
      [key, title, JSON.stringify(content), nextOrder]
    );
  }

  return getSectionByKey(key);
}

export async function deleteSection(key) {
  const existing = await getSectionByKey(key);
  if (!existing) return false;

  // Delete all media files referenced by this section before removing its DB row.
  for (const url of extractFileUrls(existing.content)) {
    await deleteMediaFile(url);
  }

  const result = await execute('DELETE FROM sections WHERE key = ?', [key]);
  return result.changes > 0;
}

function parseSection(row) {
  let content = {};
  try {
    content = row.content ? JSON.parse(row.content) : {};
  } catch (err) {
    console.error(`⚠️  Failed to parse section ${row.key} content:`, err.message);
    content = {};
  }
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    content,
    order_index: row.order_index,
    updated_at: row.updated_at
  };
}
