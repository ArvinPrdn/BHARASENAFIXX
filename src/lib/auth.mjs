import { hmac, randomToken, verifyPassword } from './security.mjs';

const SESSION_MS = 12 * 60 * 60 * 1000;

export function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim().split('=').map((item) => item?.trim())).filter(([key,value]) => key && value));
}

export function authenticate(db, username, password, secret, now = new Date()) {
  const admin = db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if (!admin) return null;
  if (admin.locked_until && Date.parse(admin.locked_until) > now.getTime()) return null;
  const valid = verifyPassword(password, admin.password_hash);
  if (!valid) {
    const attempts = admin.failed_attempts + 1;
    const lockUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : null;
    db.prepare('UPDATE admins SET failed_attempts=?,locked_until=? WHERE id=?').run(attempts, lockUntil, admin.id);
    return null;
  }
  db.prepare('UPDATE admins SET failed_attempts=0,locked_until=NULL WHERE id=?').run(admin.id);
  const token = randomToken();
  const csrf = randomToken();
  const expires = new Date(now.getTime() + SESSION_MS).toISOString();
  db.prepare('INSERT INTO admin_sessions (token_hash,admin_id,csrf_token,expires_at) VALUES (?,?,?,?)').run(hmac(token, secret), admin.id, csrf, expires);
  return { token, csrf, expires, adminId: admin.id };
}

export function getSession(db, cookieHeader, secret, now = new Date()) {
  const token = parseCookies(cookieHeader).bharasena_session;
  if (!token) return null;
  const session = db.prepare('SELECT s.*,a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?').get(hmac(token, secret), now.toISOString());
  return session || null;
}

export function revokeSession(db, cookieHeader, secret) {
  const token = parseCookies(cookieHeader).bharasena_session;
  if (token) db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(hmac(token, secret));
}

export function sessionCookie(token, production = false) {
  return `bharasena_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${production ? '; Secure' : ''}`;
}

export function csrfValid(request, session, form, siteOrigin) {
  if (!session || form.csrf !== session.csrf_token) return false;
  const origin = request.headers.origin;
  return origin === siteOrigin;
}
