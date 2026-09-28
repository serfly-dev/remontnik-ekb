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

function logAdminEvent(event, req, extra = {}) {
  console.info(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    ...extra
  }));
}

export async function login(req, res) {
  const { username, password } = req.body;

  logAdminEvent('ADMIN_AUTH_LOGIN_STARTED', req, { username });

  // Input validation
  if (!username || !password) {
    logAdminEvent('ADMIN_AUTH_LOGIN_FAILED', req, { error: 'missing_credentials', status: 400 });
    return res.status(400).json({
      success: false,
      message: 'Необходимо указать логин и пароль'
    });
  }

  // Validate credentials
  const user = await validateUser(username, password);
  if (!user) {
    logAdminEvent('ADMIN_AUTH_LOGIN_FAILED', req, { error: 'invalid_credentials', username, status: 401 });
    return res.status(401).json({
      success: false,
      message: 'Неверный логин или пароль'
    });
  }

  // Regenerate session to prevent session fixation:
  // creates a fresh session id so a planted cookie cannot be hijacked.
  req.session.regenerate((err) => {
    if (err) {
      logAdminEvent('ADMIN_AUTH_LOGIN_FAILED', req, { error: err.message, status: 500 });
      return res.status(500).json({
        success: false,
        message: 'Ошибка сервера'
      });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    req.session.save((err) => {
      if (err) {
        logAdminEvent('ADMIN_AUTH_LOGIN_FAILED', req, { error: err.message, status: 500 });
        return res.status(500).json({
          success: false,
          message: 'Ошибка сервера'
        });
      }
      logAdminEvent('ADMIN_AUTH_LOGIN_SUCCESS', req, { username: user.username });
      res.json({
        success: true,
        message: 'Авторизация успешна',
        user: { username: user.username }
      });
    });
  });
}

export async function logout(req, res) {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logAdminEvent('ADMIN_AUTH_LOGOUT_FAILED', req, { error: err.message, status: 500 });
        return res.status(500).json({
          success: false,
          message: 'Ошибка при выходе'
        });
      }
      logAdminEvent('ADMIN_AUTH_LOGOUT_SUCCESS', req);
      res.clearCookie('admin.sid');
      res.json({ success: true, message: 'Выход выполнен' });
    });
  } else {
    logAdminEvent('ADMIN_AUTH_LOGOUT_SUCCESS', req);
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