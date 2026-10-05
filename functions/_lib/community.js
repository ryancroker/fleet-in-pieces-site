// Web-platform APIs only: this file runs in Cloudflare Pages Functions.
export const PAGE_SIZE = 25;
export const STATUSES = new Set(['new', 'reviewing', 'planned', 'building', 'implemented', 'declined']);
// Labels are deliberate Fleet Command decisions, never inferred popularity promises.
export const STATUS_PRESETS = Object.freeze({
  submitted: { status: 'new', label: 'SUBMITTED' },
  popular: { status: 'new', label: 'POPULAR' },
  looking: { status: 'reviewing', label: 'LOOKING AT THIS' },
  prototyping: { status: 'building', label: 'PROTOTYPING' },
  planned: { status: 'planned', label: 'PLANNED' },
  implemented: { status: 'implemented', label: 'IMPLEMENTED' },
  no: { status: 'declined', label: 'NO' },
  breaks_everything: { status: 'declined', label: 'THIS WOULD BREAK EVERYTHING' },
  technically_possible: { status: 'reviewing', label: 'TECHNICALLY POSSIBLE, UNFORTUNATELY' }
});
const COOKIE_AGE = 180 * 24 * 60 * 60;
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; media-src 'self'; font-src 'self'; manifest-src 'self'; connect-src 'self' https://cloudflareinsights.com"
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
  for (const cookie of session?.cookies || []) headers.append('Set-Cookie', cookie);
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
  keysOnly(data, reply ? ['body', 'handle', 'request_id', 'website'] : ['system', 'content_id', 'contribution_type', 'body', 'handle', 'request_id', 'website']);
  if (data.website !== undefined && (typeof data.website !== 'string' || data.website.trim())) fail(422, 'submission_rejected', 'That submission could not be accepted.');
  if (!reply && data.contribution_type !== undefined && data.contribution_type !== 'idea') fail(400, 'invalid_contribution', 'This form accepts ideas.');
  if (typeof data.request_id !== 'string' || !UUID.test(data.request_id)) fail(400, 'invalid_request_id', 'Please refresh the page and try again.');
  const body = textField(data.body, reply ? 'Reply' : 'Idea', reply ? 2 : 8, reply ? 1500 : 2000);
  const handle = textField(data.handle ?? '', 'Handle', 0, 32, false);
  const folded = handle.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const compact = folded.replace(/[^a-z0-9]/g, '');
  if (/(?:developer|administrator|moderator|fleetinpieces|fleetcommand|official)/.test(compact) ||
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
    idea: [5, 20, 600, 60, 200], reply: [20, 100, 600, 200, 1000], topic: [3, 8, 600, 30, 120],
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
export function paginate(rows, size = PAGE_SIZE) { return { rows: rows.slice(0, size), has_more: rows.length > size }; }
export function statusKey(status, label) {
  if (label) return Object.keys(STATUS_PRESETS).find(key => STATUS_PRESETS[key].status === status && STATUS_PRESETS[key].label === label.toUpperCase()) || null;
  return { new: 'submitted', reviewing: 'looking', planned: 'planned', building: 'prototyping', implemented: 'implemented', declined: 'no' }[status] || null;
}
export async function contentFor(db, selector = {}) {
  const id = selector.content_id;
  const slug = selector.system;
  if (id !== undefined && (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(id))) fail(400, 'invalid_content', 'Choose a valid content page.');
  if (slug !== undefined && (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))) fail(400, 'invalid_system', 'Choose a valid content page.');
  const row = await db.prepare(`SELECT id,slug,title,kind,path FROM content_objects WHERE ${id ? 'id' : 'slug'}=? AND is_public=1`)
    .bind(id || slug || 'missiles').first();
  if (!row || (slug !== undefined && row.slug !== slug)) fail(404, 'content_not_found', 'That content page is not available.');
  return row;
}
export function contentJson(row) {
  const list = value => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
  return { id: row.id, slug: row.slug, title: row.title, kind: row.kind, path: row.path, summary: row.summary, current: list(row.current_json), media: list(row.media_json) };
}
export function authorJson(row, prefix = 'author_') {
  if (row[prefix + 'id'] === null || row[prefix + 'id'] === undefined) return null;
  const id = row[prefix + 'id'];
  return { id, callsign: row[prefix + 'callsign'], rank: row[prefix + 'rank'] || null, direct_count: row[prefix+'direct_count'] ?? null, patron: row[prefix+'patron_id'] ? {id:row[prefix+'patron_id'],callsign:row[prefix+'patron_callsign'],path:'/u/'+row[prefix+'patron_id']} : null, path: '/u/' + id };
}
// Resolve explicit claimed aliases in SQL; anonymous identities stay valid on their own.
// The two placeholders are the current actor twice. No actor hashes leave the API.
export const GROUP_IDS_SQL = `SELECT g.id FROM ideas g WHERE (g.id=i.id OR g.merged_into=i.id) AND g.hidden=0`;
export const GROUP_VOTES_SQL = `SELECT COUNT(DISTINCT COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash))
  FROM votes v LEFT JOIN profile_actors pa ON pa.actor_hash=v.actor_hash WHERE v.idea_id IN (${GROUP_IDS_SQL})`;
export const VOTED_SQL = `EXISTS(SELECT 1 FROM votes v WHERE v.idea_id IN (${GROUP_IDS_SQL}) AND
  (v.actor_hash=? OR v.actor_hash IN (SELECT actor_hash FROM profile_actors
    WHERE profile_id=(SELECT profile_id FROM profile_actors WHERE actor_hash=?))))`;
export const VOTE_COUNT_SQL = `SELECT COUNT(DISTINCT COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash))
  FROM votes v LEFT JOIN profile_actors pa ON pa.actor_hash=v.actor_hash WHERE v.idea_id=?`;
const AUTHOR_COLUMNS = `p.id AS author_id,p.callsign AS author_callsign,pr.label AS author_rank,
 (SELECT COUNT(*) FROM profiles child WHERE child.superior_id=p.id) AS author_direct_count,
 p.superior_id AS author_patron_id,(SELECT callsign FROM profiles patron WHERE patron.id=p.superior_id) AS author_patron_callsign`;
export const IDEA_COLUMNS = `i.id,i.system,i.body,i.handle,i.is_developer,i.status,i.status_label,i.developer_response,
  (${GROUP_VOTES_SQL}) AS votes,i.created_at,i.updated_at,i.implemented_at,i.command_at,i.contribution_type,
  i.decision_key,i.pinned,i.locked,i.related_idea_id,i.merged_into,i.source_reply_id,i.display_title,i.display_body,i.edit_note,i.build_label,i.release_date,i.evidence_json,i.revision,
  (SELECT idea_id FROM replies WHERE id=i.source_reply_id) AS source_idea_id,
  c.id AS content_id,c.slug AS content_slug,c.title AS content_title,c.kind AS content_kind,c.path AS content_path,
  ${AUTHOR_COLUMNS},lr.id AS latest_reply_id,substr(lr.body,1,240) AS latest_reply_body,
  length(lr.body)>240 AS latest_reply_truncated,lr.handle AS latest_reply_handle,lr.created_at AS latest_reply_created_at,lr.is_developer AS latest_reply_is_developer,
  lp.id AS latest_author_id,lp.callsign AS latest_author_callsign,lpr.label AS latest_author_rank,
  (SELECT COUNT(*) FROM replies r WHERE r.idea_id IN (${GROUP_IDS_SQL}) AND r.hidden=0) AS reply_count,
  EXISTS(SELECT 1 FROM replies r JOIN ideas source ON source.id=r.idea_id WHERE r.idea_id IN (${GROUP_IDS_SQL}) AND source.hidden=0 AND r.hidden=0 AND r.is_developer=1) AS has_developer_reply,
  ${VOTED_SQL} AS voted`;
export const IDEA_FROM = `FROM ideas i JOIN content_objects c ON c.id=i.content_id
  LEFT JOIN profiles p ON p.id=i.profile_id LEFT JOIN rank_definitions pr ON pr.id=p.rank_id
  LEFT JOIN replies lr ON lr.id=(SELECT id FROM replies WHERE idea_id IN (${GROUP_IDS_SQL}) AND hidden=0 ORDER BY id DESC LIMIT 1)
  LEFT JOIN profiles lp ON lp.id=lr.profile_id LEFT JOIN rank_definitions lpr ON lpr.id=lp.rank_id`;
export const REPLY_COLUMNS = `r.id,r.idea_id,r.body,r.handle,r.is_developer,r.created_at,r.display_body,r.edit_note,r.revision,
  (SELECT id FROM ideas WHERE source_reply_id=r.id AND hidden=0) AS promoted_idea_id,${AUTHOR_COLUMNS}`;
export const REPLY_FROM = `FROM replies r JOIN ideas i ON i.id=r.idea_id JOIN content_objects c ON c.id=i.content_id
  LEFT JOIN profiles p ON p.id=r.profile_id LEFT JOIN rank_definitions pr ON pr.id=p.rank_id`;
export function ideaJson(row, admin = false) {
  const idea = {
    id: row.id, system: row.content_slug || row.system, body: row.body, handle: row.handle, is_developer: Boolean(row.is_developer),
    status: row.status, status_label: row.status_label, developer_response: row.developer_response,
    votes: row.votes, reply_count: row.reply_count, voted: Boolean(row.voted), has_developer_reply: Boolean(row.has_developer_reply),
    created_at: row.created_at, updated_at: row.updated_at, implemented_at: row.implemented_at,
    contribution_type: row.contribution_type,
    content: { id: row.content_id, slug: row.content_slug, title: row.content_title, kind: row.content_kind, path: row.content_path },
    status_key: statusKey(row.status, row.status_label),
    command_responded: Boolean(row.command_at || row.status !== 'new' || row.status_label || row.developer_response),
    command_at: row.command_at, author: authorJson(row),
    decision_key: row.decision_key, pinned: Boolean(row.pinned), locked: Boolean(row.locked),
    related_idea_id: row.related_idea_id, merged_into: row.merged_into,
    source_reply_id: row.source_reply_id, source_idea_id: row.source_idea_id,
    display_title: row.display_title, display_body: row.display_body, edit_note: row.edit_note,
    build_label: row.build_label, release_date: row.release_date, evidence: JSON.parse(row.evidence_json || '[]'),
    latest_reply: row.latest_reply_id ? {
      id: row.latest_reply_id, body: row.latest_reply_body, truncated: Boolean(row.latest_reply_truncated),
      handle: row.latest_reply_handle, created_at: row.latest_reply_created_at, author: authorJson(row, 'latest_author_'), is_developer: Boolean(row.latest_reply_is_developer)
    } : null
  };
  if (admin) { idea.hidden = Boolean(row.hidden); idea.revision = row.revision; }
  return idea;
}
export function replyJson(row, admin = false) {
  const reply = { id: row.id, idea_id: row.idea_id, body: row.body, handle: row.handle, is_developer: Boolean(row.is_developer), created_at: row.created_at, author: authorJson(row), display_body:row.display_body, edit_note:row.edit_note, promoted_idea_id:row.promoted_idea_id };
  if (admin) { reply.hidden = Boolean(row.hidden); reply.updated_at = row.updated_at; reply.revision = row.revision; }
  return reply;
}
export async function getIdea(db, id, actor, admin = false) {
  const row = await db.prepare(`SELECT ${IDEA_COLUMNS}${admin ? ',i.hidden' : ''} ${IDEA_FROM} WHERE i.id=?${admin ? '' : ' AND i.hidden=0 AND c.is_public=1'}`).bind(actor, actor, id).first();
  if (!row) fail(404, 'not_found', 'That discussion was not found.');
  return ideaJson(row, admin);
}
export function htmlEscape(text) { return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
