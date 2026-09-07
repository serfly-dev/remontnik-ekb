import { query, queryOne, execute } from '../database/connection.js';

/**
 * Sections service — CRUD for editable landing page content.
 * Each section stores its content as a JSON object in the `content` column.
 * Section keys are stable identifiers (hero, services, portfolio, variants, calculator, cta).
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