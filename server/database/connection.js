import sqlite3 from 'sqlite3';
import config from '../config/index.js';

let db = null;

export function getDb() {
  if (!db) {
    db = new sqlite3.Database(config.db.path);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    migrate(db);
  }
  return db;
}

// Idempotent lightweight migrations for existing databases.
// init.js handles fresh databases; this covers already-deployed instances.
function migrate(db) {
  db.all("PRAGMA table_info(applications)", (err, rows) => {
    if (err) return;
    const hasAdminId = Array.isArray(rows) && rows.some((col) => col.name === 'admin_id');
    if (!hasAdminId) {
      db.run('ALTER TABLE applications ADD COLUMN admin_id INTEGER', (alterErr) => {
        if (alterErr) console.error('Migration admin_id failed:', alterErr.message);
      });
    }
  });
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// Promisified helpers
export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastInsertRowid: this.lastInsertRowid });
    });
  });
}

export default { getDb, closeDb, query, queryOne, execute };
