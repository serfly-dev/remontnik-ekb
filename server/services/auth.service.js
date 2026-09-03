import bcrypt from 'bcryptjs';
import { queryOne, execute } from '../database/connection.js';

const SALT_ROUNDS = 10;

export async function findUserByUsername(username) {
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