import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
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
  app.post('/api/auth/logout', logout);
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

  // Serve admin static files (CSS, JS, etc.)
  app.use('/admin', express.static(ROOT_ADMIN_DIR));
}