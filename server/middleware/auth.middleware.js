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
/**
 * CSRF defense for state-changing requests (POST/PATCH/PUT/DELETE).
 * Browsers always send the Origin header on cross-site requests; reject
 * any request whose Origin (or, as fallback, Referer) does not match the
 * Host. SameSite=Lax on the session cookie is kept as a second layer.
 */
export function requireSameOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const host = req.headers.host;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  let source = null;
  if (origin) {
    try {
      source = new URL(origin);
    } catch {
      source = null;
    }
  } else if (referer) {
    try {
      source = new URL(referer);
    } catch {
      source = null;
    }
  }

  // No Origin/Referer (curl, same-host server-to-server) — allow, cookie-based
  // browsers always attach one of them on cross-site requests.
  if (source == null) {
    return next();
  }

  if (source.host === host) {
    return next();
  }

  logAdminEvent('ADMIN_CSRF_BLOCKED', req, {
    reason: 'origin_mismatch',
    sourceHost: source.host,
    host
  });
  return res.status(403).json({ success: false, message: 'Запрос отклонён: несовпадение Origin' });
}
