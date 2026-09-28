import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import { queryOne, execute } from '../database/connection.js';

const SALT_ROUNDS = 12;

// Detects a bcrypt hash like $2a$10$...
const isBcryptHash = (str) => typeof str === 'string' && /^\$2[aby]?\$\d+\$/.test(str);

export async function findUserByUsername(username) {
  // When ADMIN_USERNAME in .env is a bcrypt hash, the hash is the source of
  // truth for the login: verify the submitted username against it and return
  // the single admin account from the DB.
  const expected = config.admin.username;
  if (isBcryptHash(expected)) {
    const valid = await bcrypt.compare(username, expected);
    if (!valid) {
      return null;
    }
    return await queryOne(
      'SELECT id, username, password_hash FROM users ORDER BY id LIMIT 1'
    );
  }
  return await queryOne(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username]
  );
}

export async function validateUser(username, password) {
  const user = await findUserByUsername(username);
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username
  };
}

export async function createUser(username, password) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const stmt = execute(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );
    return { id: stmt.lastInsertRowid, username };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return null; // User already exists
    }
    throw err;
  }
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}