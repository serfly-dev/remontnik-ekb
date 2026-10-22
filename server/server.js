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
import { initUploadRoutes } from './routes/upload.routes.js';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// The app runs behind a single reverse proxy (nginx on Timeweb) that sits on
// a loopback or private network interface. Trusting a hop only when it comes
// from such an interface lets req.secure honour X-Forwarded-Proto (Secure
// session cookie) and the rate limiters see the real client IP — while never
// trusting X-Forwarded-For from direct public clients, closing the
// rate-limit spoofing vector (Strix vuln-0003).
function isTrustedProxy(ip) {
  if (typeof ip !== 'string') return false;
  const normalizedIp = ip.toLowerCase().replace(/^::ffff:/, '');
  if (normalizedIp === '127.0.0.1' || normalizedIp === '::1') return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(normalizedIp);
}
app.set('trust proxy', isTrustedProxy);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// Request ID middleware — correlation ID for all logs within a request
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Body parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

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
initUploadRoutes(app);
// Versioned public assets can be cached for one year; stable URLs remain short-lived,
// while HTML and API responses stay fresh.
const IMMUTABLE = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm'
];
const SHORT_CACHE = ['.css', '.js', '.json'];
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (req.path.startsWith('/api/')) return next();
  const versionedAsset = /(?:\/\d{10,}-[a-f0-9-]{12,}|[-.]v\d+)\.[a-z0-9]+$/i.test(req.path)
    || (typeof req.query.v === 'string' && /^\d+(?:\.\d+)*$/.test(req.query.v));
  if ((IMMUTABLE.includes(ext) || SHORT_CACHE.includes(ext)) && versionedAsset) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (SHORT_CACHE.includes(ext) || IMMUTABLE.includes(ext)) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Static — only explicitly whitelisted directories.
// public/ is served by the dedicated mount below; root files
// (index.html, css/, js/, data/, etc.) are served via explicit handlers.
// NEVER serve rootDir wholesale — it would expose the database,
// admin source, server controllers and config over plain HTTP.
app.use(express.static(path.join(rootDir, 'public')));
app.use('/css', express.static(path.join(rootDir, 'css')));
app.use('/js', express.static(path.join(rootDir, 'js')));
app.use('/data', express.static(path.join(rootDir, 'data')));

// Specific root files
app.get('/index.html', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(rootDir, 'privacy.html')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(rootDir, 'robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(rootDir, 'sitemap.xml')));

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
  if (err.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'Payload too large' });
    return;
  }
  console.info(JSON.stringify({
    event: 'ADMIN_SERVER_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.id,
    endpoint: req.originalUrl || req.url,
    method: req.method,
    statusCode: res.statusCode || 500,
    error: err.message
  }));
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
