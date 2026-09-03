import { validateUser } from '../services/auth.service.js';
import { findUserByUsername } from '../services/auth.service.js';
import rateLimit from 'express-rate-limit';

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { success: false, message: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false
});

export function getLoginLimiter() {
  return loginLimiter;
}

export async function login(req, res) {
  const { username, password } = req.body;

  // Input validation
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Необходимо указать логин и пароль'
    });
  }

  // Validate credentials
  const user = await validateUser(username, password);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Неверный логин или пароль'
    });
  }

  // Set session
  req.session.userId = user.id;
  req.session.username = user.username;

  // Regenerate session to prevent session fixation
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }
    res.json({
      success: true,
      message: 'Авторизация успешна',
      user: { username: user.username }
    });
  });
}

export async function logout(req, res) {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Ошибка при выходе'
        });
      }
      res.clearCookie('admin.sid');
      res.json({ success: true, message: 'Выход выполнен' });
    });
  } else {
    res.json({ success: true, message: 'Выход выполнен' });
  }
}

export async function getMe(req, res) {
  if (req.session && req.session.userId) {
    const user = await findUserByUsername(req.session.username);
    if (user) {
      return res.json({
        success: true,
        user: { id: user.id, username: user.username }
      });
    }
  }
  res.status(401).json({ success: false, message: 'Не авторизован' });
}