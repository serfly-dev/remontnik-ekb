import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { requireSameOrigin } from '../middleware/auth.middleware.js';
import {
  getLoginLimiter,
  login,
  logout,
  getMe
} from '../controllers/auth.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// auth.routes.js is in server/routes/, so go up TWO levels to reach root
const ROOT_ADMIN_DIR = path.join(__dirname, '../../admin');

export function initAdminRoutes(app) {
  const loginLimiter = getLoginLimiter();

  // Auth APIs
  app.post('/api/auth/login', loginLimiter, login);
  app.post('/api/auth/logout', requireSameOrigin, logout);
  app.get('/api/auth/me', getMe);

  // Admin login page
  app.get('/admin/login.html', (req, res) => {
    if (req.session && req.session.userId) {
      return res.redirect('/admin/');
    }
    res.sendFile(path.join(ROOT_ADMIN_DIR, 'login.html'));
  });

  // Admin dashboard
  app.get('/admin/', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.redirect('/admin/login.html');
    }
    res.sendFile(path.join(ROOT_ADMIN_DIR, 'index.html'));
  });

  // Serve admin static files (CSS, JS, etc.).
  // Only the login page and the assets it needs (admin.css, auth.js,
  // fonts/images) are served without a session; dashboard HTML and the
  // admin API/section source stay private.
  app.use('/admin', (req, res, next) => {
    const urlPath = req.path;
    const publicCssImg = ['/css/', '/img/', '/images/', '/fonts/'].some((prefix) => urlPath.startsWith(prefix));
    const isPublicJs = urlPath === '/js/auth.js';
    if ((!publicCssImg && !isPublicJs) && urlPath !== '/login.html') {
      if (req.session && req.session.userId) {
        return express.static(ROOT_ADMIN_DIR)(req, res, next);
      }
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      return res.redirect('/admin/login.html');
    }
    return express.static(ROOT_ADMIN_DIR)(req, res, next);
  });
}