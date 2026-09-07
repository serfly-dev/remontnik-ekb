import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import { closeDb } from './database/connection.js';
import { initAdminRoutes } from './routes/auth.routes.js';
import { initApplicationsRoutes } from './routes/applications.routes.js';
import { initSectionsRoutes } from './routes/sections.routes.js';
import { initPricesRoutes } from './routes/prices.routes.js';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Security headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Session
app.use(session({
  name: 'admin.sid',
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: config.session.maxAge
  }
}));

// Health check (before any catch-all)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
initAdminRoutes(app);
initApplicationsRoutes(app);
initSectionsRoutes(app);
initPricesRoutes(app);

// Static — public/ first
app.use(express.static(path.join(rootDir, 'public')));

// Then root files (index.html, css/, js/, data/, etc.)
app.use(express.static(rootDir, { index: false }));

// Root → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('⚠️  Server error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const port = config.port;
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🗄️  Database: ${config.db.path}`);
  console.log(`🔐 Admin panel: http://localhost:${port}/admin/`);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 SIGTERM received. Shutting down gracefully...');
  await closeDb();
  process.exit(0);
});
