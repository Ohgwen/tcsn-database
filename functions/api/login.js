import { createSessionCookie, clearSessionCookie, passwordMatches } from '../../lib/auth.js';
import { json, readJson } from '../../lib/http.js';

export async function onRequestPost({ request, env }) {
  const { password } = await readJson(request);
  if (!(await passwordMatches(password, env.APP_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing a little
    return json({ error: 'Wrong password' }, 401);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': await createSessionCookie(env.APP_PASSWORD) });
}

// Logout lives here too so it works even with an expired session.
export async function onRequestDelete() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
