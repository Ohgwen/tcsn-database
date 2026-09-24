import { hasValidSession } from '../lib/auth.js';
import { json } from '../lib/http.js';

// Reachable without logging in.
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/app.css', '/favicon.svg', '/api/login']);

function withHeaders(response) {
  const res = new Response(response.body, response);
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (!env.APP_PASSWORD) {
    return new Response('APP_PASSWORD is not configured for this deployment.', { status: 500 });
  }

  // CSRF guard: state-changing API calls must be JSON (cross-site forms can't send that).
  if (isApi && request.method !== 'GET' && request.method !== 'HEAD'
      && !(request.headers.get('Content-Type') || '').includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415);
  }

  if (!PUBLIC_PATHS.has(url.pathname) && !(await hasValidSession(request, env.APP_PASSWORD))) {
    if (isApi) return json({ error: 'Not logged in' }, 401);
    const nextPath = url.pathname + url.search;
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(nextPath)}`, 302);
  }

  try {
    return withHeaders(await next());
  } catch (err) {
    console.error(err);
    if (isApi) return json({ error: err.message || 'Server error' }, 500);
    throw err;
  }
}
