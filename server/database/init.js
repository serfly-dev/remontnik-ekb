import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { mkdirSync, existsSync, unlinkSync } from 'fs';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

const dbPath = process.env.DB_PATH || join(rootDir, 'server', 'database', 'database.sqlite');

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.error('❌ ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required to initialize the database.');
  process.exit(1);
}

const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

// Detect if the provided value is already a bcrypt hash
const isBcryptHash = (str) => typeof str === 'string' && /^\$2[aby]?\$\d+\$/.test(str);

// Use the value directly if it's already a bcrypt hash, otherwise hash it
// (backward-compatible with plaintext ADMIN_PASSWORD for migration purposes)
const passwordHash =
  isBcryptHash(adminPassword)
    ? adminPassword
    : bcrypt.hashSync(adminPassword, 12);

// Ensure directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Remove existing database if requested
let isNew = true;
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log('🗑️  Old database deleted');
}

// Connect to database
const db = new sqlite3.Database(dbPath);

// Helper for promisified exec
function runSql(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function runStatement(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastInsertRowid: this.lastInsertRowid });
    });
  });
}

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function init() {
  db.run('PRAGMA journal_mode = WAL');

  // Applications table
  await runSql(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      preferred_time TEXT,
      comment TEXT,
      calculator_data TEXT,
      calculated_price INTEGER,
      status TEXT NOT NULL DEFAULT 'new',
      admin_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await runSql(`
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
  `);
  console.log('✅ applications table created');

  // Users table
  await runSql(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ users table created');

  // Create or update the admin user. The account is synced from .env so the
  // hashes stored in the DB always match the configured credentials.
  const existing = isBcryptHash(adminUsername)
    ? await getRow('SELECT id FROM users ORDER BY id LIMIT 1')
    : await getRow('SELECT id FROM users WHERE username = ?', [adminUsername]);

  if (existing) {
    await runStatement('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, existing.id]);
    console.log('\n📝 Admin user updated to match .env credentials');
  } else {
    const storedUsername = isBcryptHash(adminUsername) ? 'admin' : adminUsername;
    await runStatement('INSERT INTO users (username, password_hash) VALUES (?, ?)', [storedUsername, passwordHash]);
    console.log(`\n👤 Admin user created:`);
    console.log(`   Username: ${storedUsername}`);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!');
  }

  // Settings table for future use
  await runSql(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ settings table created');

  // Sections table for editable landing page content
  await runSql(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      title TEXT,
      content JSON NOT NULL,
      order_index INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ sections table created');

  db.close();
  console.log('\n✨ Database initialization complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npm start');
  console.log('   2. Open: http://localhost:3000');
}

init().catch(err => {
  console.error('❌ Init failed:', err);
  db.close();
  process.exit(1);
});
