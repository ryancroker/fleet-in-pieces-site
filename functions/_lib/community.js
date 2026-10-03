// Web-platform APIs only: this file runs in Cloudflare Pages Functions.
export const PAGE_SIZE = 25;
export const STATUSES = new Set(['new', 'reviewing', 'planned', 'building', 'implemented', 'declined']);
const COOKIE_AGE = 180 * 24 * 60 * 60;
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'self'"
};

export class ApiError extends Error {
  constructor(status, error, message) { super(message); this.status = status; this.error = error; }
}
export function fail(status, code, message) { throw new ApiError(status, code, message); }
export function securityHeaders(html = false) {
  const headers = new Headers(SECURITY);
  headers.set('Content-Type', html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8');
  if (!html) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('Vary', 'Cookie');
  }
  return headers;
}
export function json(value, session, status = 200) {
  const headers = securityHeaders();
  if (session?.cookie) headers.append('Set-Cookie', session.cookie);
  if (status === 429) headers.set('Retry-After', '60');
  return new Response(JSON.stringify(value), { status, headers });
}
export function problem(error, session) {
  if (error instanceof ApiError) return json({ error: error.error, message: error.message }, session, error.status);
  // SQL, secrets, IPs, hashes and submitted text must never reach error responses or logs.
  return json({ error: 'unavailable', message: 'The community board is temporarily unavailable. Please try again.' }, session, 503);
}
export function database(env) {
  if (!env.COMMUNITY_DB?.prepare) fail(503, 'unavailable', 'The community board is temporarily unavailable.');
  return env.COMMUNITY_DB;
}
function localHost(url) { return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); }
function base64(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unbase64(text) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(text)) return new Uint8Array();
  try { return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='), c => c.charCodeAt(0)); }
  catch { return new Uint8Array(); }
}
export async function signingKey(env) {
  if (typeof env.COMMUNITY_SIGNING_KEY !== 'string' || env.COMMUNITY_SIGNING_KEY.length < 32) {
    fail(503, 'unavailable', 'The community board is temporarily unavailable.');
  }
  return crypto.subtle.importKey('raw', encoder.encode(env.COMMUNITY_SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function digest(key, value) {
  return base64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
export async function sessionFor(request, env) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !localHost(url)) fail(400, 'https_required', 'Please use the secure site address.');
  const secure = url.protocol === 'https:';
  const name = secure ? '__Host-fip_actor' : 'fip_actor_local';
  const key = await signingKey(env);
  const now = Math.floor(Date.now() / 1000);
  const cookies = (request.headers.get('Cookie') || '').slice(0, 8192).split(';').map(part => part.trim());
  const raw = cookies.find(part => part.startsWith(name + '='))?.slice(name.length + 1) || '';
  let id, cookie;
  const parts = raw.split('.');
  if (parts.length === 4 && parts[0] === 'v1' && UUID.test(parts[1]) && /^\d{10}$/.test(parts[2])) {
    const issued = Number(parts[2]);
    const signature = unbase64(parts[3]);
    if (issued <= now + 60 && issued > now - COOKIE_AGE && signature.length === 32 &&
        await crypto.subtle.verify('HMAC', key, signature, encoder.encode(parts.slice(0, 3).join('.')))) id = parts[1];
  }
  if (!id) {
    id = crypto.randomUUID();
    const payload = `v1.${id}.${now}`;
    cookie = `${name}=${payload}.${await digest(key, payload)}; Path=/; Max-Age=${COOKIE_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  }
  // Cloudflare sets CF-Connecting-IP at its edge. Never trust X-Forwarded-For.
  // Local HTTP uses one conservative shared development bucket; no raw IP is persisted.
  const ip = localHost(url) ? 'local-development' : (request.headers.get('CF-Connecting-IP') || 'unknown-edge').slice(0, 64);
  return {
    key, cookie, now,
    actor: await digest(key, 'actor:' + id),
    ip: await digest(key, `ip:${new Date(now * 1000).toISOString().slice(0, 10)}:${ip}`)
  };
}
export function checkMutation(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    fail(403, 'origin_required', 'Please submit from this site.');
  }
  const type = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') fail(415, 'json_required', 'Please submit JSON.');
}
export async function readJson(request) {
  const declared = request.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 8192)) fail(413, 'too_large', 'That submission is too large.');
  if (!request.body) fail(400, 'invalid_json', 'Please enter a submission.');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); fail(413, 'too_large', 'That submission is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(400, 'invalid_json', 'Please submit a valid JSON object.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'invalid_json', 'Please submit a valid JSON object.');
  return data;
}
export function keysOnly(data, allowed) {
  if (Object.keys(data).some(key => !allowed.includes(key))) fail(400, 'invalid_fields', 'The submission contains an unsupported field.');
}
export function positiveId(value) {
  const text = String(value ?? '');
  if (!/^[1-9]\d{0,14}$/.test(text) || !Number.isSafeInteger(Number(text))) fail(404, 'not_found', 'That discussion was not found.');
  return Number(text);
}
export function pageOffset(url) {
  const value = url.searchParams.get('offset') || '0';
  if (!/^(?:0|[1-9]\d{0,4})$/.test(value) || Number(value) > 10000) fail(400, 'invalid_offset', 'That page is unavailable.');
  return Number(value);
}
export function textField(value, name, min, max, multiline = true) {
  if (typeof value !== 'string') fail(400, 'invalid_text', `${name} must be text.`);
  const text = value.replace(/\r\n?/g, '\n').trim();
  const forbidden = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cf}\uD800-\uDFFF]/u : /[\p{Cc}\p{Cf}\uD800-\uDFFF]/u;
  if (forbidden.test(text) || [...text].length < min || [...text].length > max) {
    fail(400, 'invalid_text', `${name} must be ${min}–${max} characters without hidden control characters.`);
  }
  return text;
}
function luhn(text) {
  const digits = text.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^(.)\1+$/.test(digits)) return false;
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double && (n *= 2) > 9) n -= 9;
    sum += n; double = !double;
  }
  return sum % 10 === 0;
}
export function screenPublic(text) {
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
      /\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/.test(text) ||
      [...text.matchAll(/\b(?:\d[ -]?){12,18}\d\b/g)].some(match => luhn(match[0]))) {
    fail(422, 'private_information', 'Please remove email addresses and private identification or payment numbers.');
  }
  if (/\b(?:https?:\/\/|ftp:\/\/|www\.|mailto:|javascript:|data:)/i.test(text) ||
      /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/i.test(text) ||
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text)) {
    fail(422, 'links_not_allowed', 'Keep links out of public posts for now. Describe the idea here instead.');
  }
  // Deliberately narrow: in-game combat language and profanity are allowed.
  // Reports and human moderation cover semantic abuse this pattern cannot recognize.
  if (/\b(?:i will|i['’]?m going to|i am going to)\s+(?:kill|murder|shoot|stab)\s+(?:you|ryan|your family)\b[^.!?\n]{0,100}\b(?:in real life|at your (?:house|home|school)|where you live|outside your (?:house|home))\b/i.test(text)) {
    fail(422, 'real_world_threat', 'Keep real-world threats off this board.');
  }
}
export function postFields(data, reply = false) {
  keysOnly(data, reply ? ['body', 'handle', 'request_id', 'website'] : ['system', 'body', 'handle', 'request_id', 'website']);
  if (data.website !== undefined && (typeof data.website !== 'string' || data.website.trim())) fail(422, 'submission_rejected', 'That submission could not be accepted.');
  if (!reply && data.system !== 'missiles') fail(400, 'invalid_system', 'Choose the missiles discussion.');
  if (typeof data.request_id !== 'string' || !UUID.test(data.request_id)) fail(400, 'invalid_request_id', 'Please refresh the page and try again.');
  const body = textField(data.body, reply ? 'Reply' : 'Idea', reply ? 2 : 8, reply ? 1500 : 2000);
  const handle = textField(data.handle ?? '', 'Handle', 0, 32, false);
  const folded = handle.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const compact = folded.replace(/[^a-z0-9]/g, '');
  if (/(?:developer|administrator|moderator|fleetinpieces|official)/.test(compact) ||
      /^(?:ryan(?:croker|dev|admin)?|dev|admin|mod|staff|team|fip(?:dev|admin|team))$/.test(compact) ||
      /(?:^|[^a-z0-9])(?:ryan|admin|dev|staff)(?:$|[^a-z0-9])/.test(folded)) {
    fail(422, 'reserved_handle', 'That handle is reserved for the developer. Please choose another or leave it blank.');
  }
  screenPublic(body); screenPublic(handle);
  return { body, handle, requestId: data.request_id.toLowerCase() };
}
export async function contentHash(session, body) { return digest(session.key, 'content:' + body.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')); }

const LIMIT_SQL = `INSERT INTO rate_limits(key,count,expires_at,purge_at) VALUES(?,1,?,?)
  ON CONFLICT(key) DO UPDATE SET
    count=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE rate_limits.count+1 END,
    expires_at=CASE WHEN rate_limits.expires_at<=? THEN excluded.expires_at ELSE rate_limits.expires_at END,
    purge_at=excluded.purge_at
  WHERE rate_limits.expires_at<=? OR rate_limits.count<? RETURNING count`;
export async function limits(db, session, rules) {
  const now = session.now;
  const statements = [db.prepare('DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE purge_at<=? ORDER BY purge_at LIMIT 200)').bind(now)];
  for (const [scope, subject, count, seconds] of rules) {
    statements.push(db.prepare(LIMIT_SQL).bind(`${scope}:${subject}`, now + seconds, now + 172800, now, now, now, count));
  }
  const results = await db.batch(statements);
  if (results.slice(1).some(result => !result.results?.length)) fail(429, 'rate_limited', 'A little too fast. Please wait before trying again.');
}
export async function publicReadLimit(db, session) {
  return limits(db, session, [['read', session.actor, 120, 60], ['read-ip', session.ip, 600, 60]]);
}
export async function writeLimit(db, session, kind, hash = '', parent = '') {
  const config = {
    idea: [5, 20, 600, 60, 200], reply: [20, 100, 600, 200, 1000],
    vote: [60, null, 60, 600, null], report: [10, null, 3600, 100, null]
  }[kind];
  const [short, daily, seconds, ipShort, ipDaily] = config;
  const rules = [[kind, session.actor, short, seconds], [kind + '-ip', session.ip, ipShort, seconds]];
  if (daily) rules.push([kind + '-day', session.actor, daily, 86400], [kind + '-ip-day', session.ip, ipDaily, 86400]);
  if (hash) rules.push([`${kind}-repeat-ip:${parent}:${hash}`, session.ip, 5, 120]);
  return limits(db, session, rules);
}
export async function authorizeAdmin(request, env, db, session) {
  const expected = env.COMMUNITY_ADMIN_KEY;
  if (typeof expected !== 'string' || expected.length < 32) fail(503, 'unavailable', 'Developer tools are temporarily unavailable.');
  const supplied = request.headers.get('Authorization') || '';
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(supplied.slice(0, 1024))));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode('Bearer ' + expected)));
  let mismatch = supplied.length > 1024 ? 1 : 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  if (mismatch) {
    await limits(db, session, [['admin-auth', session.actor, 10, 600], ['admin-auth-ip', session.ip, 30, 600]]);
    fail(401, 'unauthorized', 'A valid developer key is required.');
  }
  await limits(db, session, [['admin', session.actor, 120, 60], ['admin-ip', session.ip, 300, 60]]);
}
export function paginate(rows) { return { rows: rows.slice(0, PAGE_SIZE), has_more: rows.length > PAGE_SIZE }; }
export const IDEA_COLUMNS = `i.id,i.system,i.body,i.handle,i.status,i.status_label,i.developer_response,
  i.votes,i.created_at,i.updated_at,i.implemented_at,
  (SELECT COUNT(*) FROM replies r WHERE r.idea_id=i.id AND r.hidden=0) AS reply_count,
  EXISTS(SELECT 1 FROM votes v WHERE v.idea_id=i.id AND v.actor_hash=?) AS voted`;
export function ideaJson(row, admin = false) {
  const idea = {
    id: row.id, system: row.system, body: row.body, handle: row.handle,
    status: row.status, status_label: row.status_label, developer_response: row.developer_response,
    votes: row.votes, reply_count: row.reply_count, voted: Boolean(row.voted),
    created_at: row.created_at, updated_at: row.updated_at, implemented_at: row.implemented_at
  };
  if (admin) idea.hidden = Boolean(row.hidden);
  return idea;
}
export function replyJson(row, admin = false) {
  const reply = { id: row.id, idea_id: row.idea_id, body: row.body, handle: row.handle, created_at: row.created_at };
  if (admin) { reply.hidden = Boolean(row.hidden); reply.updated_at = row.updated_at; }
  return reply;
}
export async function getIdea(db, id, actor, admin = false) {
  const row = await db.prepare(`SELECT ${IDEA_COLUMNS}${admin ? ',i.hidden' : ''} FROM ideas i WHERE i.id=?${admin ? '' : ' AND i.hidden=0'}`).bind(actor, id).first();
  if (!row) fail(404, 'not_found', 'That discussion was not found.');
  return ideaJson(row, admin);
}
export function htmlEscape(text) { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
