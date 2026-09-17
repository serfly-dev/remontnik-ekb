/**
 * Authentication middleware for protecting admin routes
 */

export function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  logAdminEvent('ADMIN_AUTH_ACCESS_DENIED', req, { reason: 'missing_session' });

  // For API requests
  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // For web requests
  res.redirect('/admin/login.html');
}

export function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      username: req.session.username
    };
  }
  next();
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