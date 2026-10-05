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
 * Browsers always send the Origin header on cross-site requests, and the
 * header cannot be set cross-site (unlike Referer, which is forgeable and
 * leakable). Origin is therefore required for every authenticated request;
 * Referer is deliberately never used as a fallback (Strix vuln-0004).
 * SameSite=Lax on the session cookie is kept as a second layer.
 */
export function requireSameOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const host = req.headers.host;
  const origin = req.headers.origin;

  function block(reason) {
    logAdminEvent('ADMIN_CSRF_BLOCKED', req, {
      reason,
      host
    });
    return res.status(403).json({ success: false, message: 'Запрос отклонён: несовпадение Origin' });
  }

  // `Origin: null` is sent by sandboxed iframes and privacy tools and can be
  // forged from any origin — never treat it as a valid same-origin signal.
  if (origin === 'null') {
    return block('null_origin');
  }

  if (origin) {
    let source;
    try {
      source = new URL(origin);
    } catch {
      return block('invalid_origin');
    }
    return source.host === host ? next() : block('origin_mismatch');
  }

  // No Origin header. Non-browser clients (curl, scripts) are fine without
  // it, but a request that carries a session cookie must prove same-origin:
  // browsers always attach Origin on cross-site state-changing requests, so
  // a missing header on an authenticated request is a CSRF red flag.
  if (req.headers.cookie && req.session && req.session.userId) {
    return block('missing_origin_with_session');
  }
  return next();
}
