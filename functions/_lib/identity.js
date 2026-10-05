import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from './vendor/webauthn.js';
import { fail, json, keysOnly, limits, textField, digest, pageOffset } from './community.js';

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_AGE = 30 * 86400;
const SESSION_MAX_AGE = 90 * 86400;
const ALGORITHMS = [-7, -257];
const PUBLIC_PROFILE = 'p.id,p.callsign,p.created_at,p.introduction,r.label AS rank';
const clock = () => Math.floor(Date.now() / 1000);
const iso = () => new Date().toISOString();
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function bytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) fail(400, 'invalid_credential', 'The passkey response was invalid. Try again.');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
}
function random() { return b64(crypto.getRandomValues(new Uint8Array(32))); }
async function hash(value) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
function summary(row) { return { id: row.id, callsign: row.callsign, path: '/u/' + row.id, rank: row.rank, introduction: row.introduction || '', joined_at: row.created_at }; }
function profileId(value) { if (typeof value !== 'string' || !UUID.test(value)) fail(404, 'not_found', 'That fleet record was not found.'); return value.toLowerCase(); }
function callsign(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/.test(value.trim())) fail(400, 'invalid_callsign', 'Use 3–24 letters, numbers, underscores or hyphens for your callsign.');
  const name = value.trim(), compact = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/(?:developer|administrator|moderator|fleetinpieces|fleetcommand|official)/.test(compact) || /^(?:ryan(?:croker|dev|admin)?|dev|admin|mod|staff|team|fip(?:dev|admin|team))$/.test(compact) || /(?:^|[_-])(?:ryan|admin|dev|staff)(?:$|[_-])/.test(name.toLowerCase())) {
    fail(422, 'reserved_callsign', 'That callsign is reserved. Please choose another.');
  }
  return { name, key: name.toLowerCase() };
}
function rp(request) {
  const url = new URL(request.url);
  if (url.protocol === 'https:' && ['fleetinpieces.space', 'www.fleetinpieces.space'].includes(url.hostname)) return { id: 'fleetinpieces.space', origin: url.origin };
  if (url.hostname === 'localhost' && ['http:', 'https:'].includes(url.protocol)) return { id: 'localhost', origin: url.origin };
  fail(400, 'canonical_register', 'Use https://fleetinpieces.space/register for passkeys (or localhost during local development).');
}
function cookieName(request) { return new URL(request.url).protocol === 'https:' ? '__Host-fip_login' : 'fip_login_local'; }
function cookieToken(request) {
  const name = cookieName(request) + '=';
  const value = (request.headers.get('Cookie') || '').slice(0, 8192).split(';').map(p => p.trim()).find(p => p.startsWith(name))?.slice(name.length) || '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
function setCookie(request, session, token = '', age = SESSION_AGE) {
  session.cookies ||= [];
  session.cookies.push(`${cookieName(request)}=${token}; Path=/; Max-Age=${token ? age : 0}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
}
function authenticated(session, fresh = false) {
  if (!session.profileId) fail(401, 'signin_required', 'Sign in with your passkey to manage your fleet record.');
  if (fresh && session.identityAuthenticatedAt < clock() - 600) fail(401, 'reauth_required', 'Sign in with your passkey again before changing security settings.');
}
async function identityLimit(db, session, scope, count = 12, seconds = 600, ipCount = 60) {
  return limits(db, session, [[scope, session.actor, count, seconds], [scope + '-ip', session.ip, ipCount, seconds]]);
}
async function clean(db) {
  const now = clock();
  await db.batch([
    db.prepare('DELETE FROM identity_challenges WHERE id IN(SELECT id FROM identity_challenges WHERE expires_at<=? ORDER BY expires_at LIMIT 100)').bind(now),
    db.prepare('DELETE FROM identity_sessions WHERE token_hash IN(SELECT token_hash FROM identity_sessions WHERE expires_at<=? ORDER BY expires_at LIMIT 100)').bind(now)
  ]);
}
export async function attachIdentity(request, env, db, session) {
  session.anonymousActor = session.actor;
  session.profile = null; session.profileId = null;
  const token = cookieToken(request);
  if (!token) return session;
  const tokenHash = await hash('session:' + token);
  const row = await db.prepare(`SELECT ${PUBLIC_PROFILE},p.actor_hash,s.created_at AS authenticated_at,s.auth_version,s.expires_at
    FROM identity_sessions s JOIN profiles p ON p.id=s.profile_id JOIN rank_definitions r ON r.id=p.rank_id
    WHERE s.token_hash=? AND s.expires_at>? AND s.auth_version=p.auth_version`).bind(tokenHash, clock()).first();
  if (!row) { setCookie(request, session); return session; }
  session.profile = summary(row); session.profileId = row.id; session.actor = row.actor_hash;
  session.identityTokenHash = tokenHash; session.identityAuthenticatedAt = row.authenticated_at; session.identityAuthVersion = row.auth_version;
  session.identityExpiresAt = row.expires_at;
  return session;
}
async function rememberIdentity(request, db, session) {
  if (!session.profileId) return;
  const now = clock(), expires = Math.min(now + SESSION_AGE, session.identityAuthenticatedAt + SESSION_MAX_AGE);
  // Refresh on a daily visit, with a firm reauthentication boundary. Never change
  // created_at: keeping a device remembered must not satisfy fresh-auth checks.
  if (expires <= session.identityExpiresAt + 86400) return;
  const renewed = await db.prepare(`UPDATE identity_sessions SET expires_at=?
    WHERE token_hash=? AND expires_at>? AND expires_at<? AND auth_version=?
      AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=identity_sessions.profile_id AND p.auth_version=identity_sessions.auth_version)
    RETURNING expires_at`).bind(expires, session.identityTokenHash, now, expires, session.identityAuthVersion).first();
  if (renewed) { session.identityExpiresAt = renewed.expires_at; setCookie(request, session, cookieToken(request), expires - now); }
}
async function loadProfile(db, id) {
  return db.prepare(`SELECT p.*,r.label AS rank,eligible.label AS eligible_rank_label,
    eligible.requires_superior_approval AS eligible_requires_approval FROM profiles p JOIN rank_definitions r ON r.id=p.rank_id
    LEFT JOIN rank_definitions eligible ON eligible.id=p.eligible_rank_id WHERE p.id=?`).bind(id).first();
}
async function canClaim(db, session) {
  const owner = await db.prepare('SELECT profile_id FROM profile_actors WHERE actor_hash=?').bind(session.anonymousActor).first();
  if (owner) return false;
  const row = await db.prepare(`SELECT EXISTS(SELECT 1 FROM ideas WHERE actor_hash=? AND profile_id IS NULL)
    OR EXISTS(SELECT 1 FROM replies WHERE actor_hash=? AND profile_id IS NULL)
    OR EXISTS(SELECT 1 FROM votes WHERE actor_hash=?) AS available`).bind(session.anonymousActor, session.anonymousActor, session.anonymousActor).first();
  return Boolean(row?.available);
}
function claimStatements(db, actor, id, now) {
  const owns = 'EXISTS(SELECT 1 FROM profile_actors WHERE actor_hash=? AND profile_id=?)';
  return [
    db.prepare('INSERT INTO profile_actors(actor_hash,profile_id,claimed_at) VALUES(?,?,?) ON CONFLICT(actor_hash) DO NOTHING').bind(actor, id, now),
    db.prepare(`UPDATE ideas SET profile_id=? WHERE actor_hash=? AND profile_id IS NULL AND ${owns}`).bind(id, actor, actor, id),
    db.prepare(`UPDATE replies SET profile_id=? WHERE actor_hash=? AND profile_id IS NULL AND ${owns}`).bind(id, actor, actor, id),
    db.prepare(`UPDATE ideas SET votes=(SELECT COUNT(DISTINCT COALESCE('p:'||a.profile_id,'a:'||v.actor_hash)) FROM votes v
      LEFT JOIN profile_actors a ON a.actor_hash=v.actor_hash WHERE v.idea_id=ideas.id)
      WHERE id IN(SELECT idea_id FROM votes WHERE actor_hash=?) AND ${owns}`).bind(actor, actor, id)
  ];
}
async function claim(db, session) {
  authenticated(session);
  await identityLimit(db, session, 'claim', 5, 3600, 30);
  const owner = await db.prepare('SELECT profile_id FROM profile_actors WHERE actor_hash=?').bind(session.anonymousActor).first();
  if (owner && owner.profile_id !== session.profileId) fail(409, 'already_claimed', 'This browser activity already belongs to a different fleet record.');
  await db.batch(claimStatements(db, session.anonymousActor, session.profileId, iso()));
  return { ok: true };
}
async function sessionMaterial() { const token = random(); return { token, tokenHash: await hash('session:' + token) }; }
function sessionInsert(db, material, id, version, guard = '', guardValues = []) {
  return db.prepare(`INSERT INTO identity_sessions(token_hash,profile_id,auth_version,created_at,expires_at)
    SELECT ?,?,?,?,?${guard ? ' WHERE ' + guard : ''} RETURNING token_hash`)
    .bind(material.tokenHash, id, version, clock(), clock() + SESSION_AGE, ...guardValues);
}
async function finishSession(request, db, session, material, id) {
  await db.prepare(`DELETE FROM identity_sessions WHERE profile_id=? AND token_hash<>? AND token_hash NOT IN
    (SELECT token_hash FROM identity_sessions WHERE profile_id=? AND token_hash<>? ORDER BY created_at DESC,token_hash DESC LIMIT 9)`)
    .bind(id, material.tokenHash, id, material.tokenHash).run();
  setCookie(request, session, material.token);
  const row = await loadProfile(db, id);
  session.profileId = id; session.profile = summary(row); session.actor = row.actor_hash;
  return session.profile;
}
async function storeChallenge(db, session, purpose, options, request, profile, payload) {
  const config = rp(request), id = crypto.randomUUID();
  await db.batch([
    db.prepare('DELETE FROM identity_challenges WHERE anonymous_actor=? AND purpose=?').bind(session.anonymousActor, purpose),
    db.prepare('INSERT INTO identity_challenges(id,purpose,anonymous_actor,profile_id,challenge,rp_id,origin,payload,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(id, purpose, session.anonymousActor, profile?.id || null, options.challenge, config.id, config.origin, JSON.stringify(payload), clock() + 300)
  ]);
  return { options, challenge_id: id };
}
async function consumeChallenge(db, session, purpose, request, data) {
  keysOnly(data, ['challenge_id', 'credential', 'label']);
  const id = profileId(data.challenge_id), config = rp(request);
  // Delete before verification: even invalid attempts consume a challenge. There is
  // no window in which two simultaneous responses can reuse the same challenge.
  const row = await db.prepare(`DELETE FROM identity_challenges WHERE id=? AND purpose=? AND anonymous_actor=?
    AND rp_id=? AND origin=? AND expires_at>? RETURNING *`)
    .bind(id, purpose, session.anonymousActor, config.id, config.origin, clock()).first();
  if (!row) fail(400, 'challenge_expired', 'That passkey request expired or was already used. Please try again.');
  row.payload = JSON.parse(row.payload);
  if (!data.credential || typeof data.credential !== 'object' || Array.isArray(data.credential)) fail(400, 'invalid_credential', 'The passkey response was missing.');
  return row;
}
async function registrationOptions(request, db, session, purpose, data) {
  await identityLimit(db, session, 'passkey-options', 12, 600, 60);
  const config = rp(request);
  let profile, payload;
  if (purpose === 'register') {
    keysOnly(data, ['callsign', 'claim_activity', 'website']);
    if (session.profileId) fail(409, 'already_signed_in', 'Your fleet record is already signed in.');
    if (data.website !== undefined && data.website !== '') fail(422, 'submission_rejected', 'That registration could not be accepted.');
    if (data.claim_activity !== undefined && typeof data.claim_activity !== 'boolean') fail(400, 'invalid_claim', 'Choose whether to claim browser activity.');
    const name = callsign(data.callsign);
    if (await db.prepare('SELECT id FROM profiles WHERE callsign_key=?').bind(name.key).first()) fail(409, 'callsign_taken', 'That callsign is already registered.');
    if (data.claim_activity) {
      const owner = await db.prepare('SELECT profile_id FROM profile_actors WHERE actor_hash=?').bind(session.anonymousActor).first();
      if (owner) fail(409, 'already_claimed', 'This browser activity already belongs to a fleet record. Leave the claim box unchecked.');
    }
    payload = { id: crypto.randomUUID(), callsign: name.name, callsign_key: name.key, user_id: random(), claim: data.claim_activity === true };
  } else if (purpose === 'recover') {
    keysOnly(data, ['callsign', 'recovery_code']);
    await identityLimit(db, session, 'recovery-attempt', 5, 600, 20);
    const name = callsign(data.callsign);
    const code = typeof data.recovery_code === 'string' ? data.recovery_code.replace(/\s/g, '') : '';
    const recoveryHash = await hash('recovery:' + code);
    profile = await db.prepare('SELECT * FROM profiles WHERE callsign_key=? AND recovery_hash=?').bind(name.key, recoveryHash).first();
    if (!/^FIP-R-[A-Za-z0-9_-]{43}$/.test(code) || !profile) fail(401, 'recovery_failed', 'The callsign and recovery code did not match.');
    payload = { auth_version: profile.auth_version, user_id: profile.webauthn_user_id };
  } else {
    keysOnly(data, []); authenticated(session, true);
    profile = await loadProfile(db, session.profileId);
    if (profile.auth_version !== session.identityAuthVersion) fail(401, 'signin_required', 'Your security settings changed. Sign in again.');
    const count = await db.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE profile_id=?').bind(profile.id).first();
    if (count.n >= 8) fail(409, 'passkey_capacity', 'This record already has eight passkeys. Remove an unused key first.');
    payload = { auth_version: profile.auth_version, user_id: profile.webauthn_user_id };
  }
  const existing = profile ? (await db.prepare('SELECT credential_id,transports FROM passkeys WHERE profile_id=?').bind(profile.id).all()).results : [];
  const options = await generateRegistrationOptions({
    rpName: 'Fleet in Pieces', rpID: config.id, userName: profile?.callsign || payload.callsign,
    userID: bytes(payload.user_id), userDisplayName: profile?.callsign || payload.callsign,
    attestationType: 'none', supportedAlgorithmIDs: ALGORITHMS, timeout: 120000,
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing.map(key => ({ id: key.credential_id, transports: JSON.parse(key.transports) }))
  });
  return storeChallenge(db, session, purpose, options, request, profile, payload);
}
function credentialInsert(db, info, id, label, guard = '', guardValues = []) {
  return db.prepare(`INSERT INTO passkeys(credential_id,profile_id,public_key,counter,device_type,backed_up,transports,label,created_at)
    SELECT ?,?,?,?,?,?,?,?,?${guard ? ' WHERE ' + guard : ''} RETURNING credential_id`)
    .bind(info.credential.id, id, b64(info.credential.publicKey), info.credential.counter, info.credentialDeviceType,
      info.credentialBackedUp ? 1 : 0, JSON.stringify(info.credential.transports || []), label, iso(), ...guardValues);
}
async function verifyRegistration(request, db, session, purpose, data) {
  await identityLimit(db, session, 'passkey-verify', 20, 600, 80);
  if (purpose === 'passkeys') authenticated(session, true);
  const challenge = await consumeChallenge(db, session, purpose, request, data);
  if (purpose === 'passkeys' && challenge.profile_id !== session.profileId) fail(401, 'signin_required', 'Sign in again before adding a passkey.');
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response: data.credential, expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin, expectedRPID: challenge.rp_id, requireUserVerification: true,
      requireUserPresence: true, supportedAlgorithmIDs: ALGORITHMS });
  } catch { fail(400, 'passkey_failed', 'The passkey could not be verified. Please try again.'); }
  if (!verification.verified || !verification.registrationInfo?.userVerified) fail(400, 'passkey_failed', 'Verify your identity on your device and try again.');
  const info = verification.registrationInfo;
  const label = textField(data.label || 'Passkey', 'Passkey name', 1, 40, false);
  if (await db.prepare('SELECT credential_id FROM passkeys WHERE credential_id=?').bind(info.credential.id).first()) fail(409, 'passkey_exists', 'That passkey is already registered. Use sign in instead.');
  if (purpose === 'passkeys') {
    if (challenge.payload.auth_version !== session.identityAuthVersion) fail(401, 'signin_required', 'Your security settings changed. Sign in again.');
    const result = await credentialInsert(db, info, session.profileId, label, 'EXISTS(SELECT 1 FROM profiles WHERE id=? AND auth_version=?)', [session.profileId, session.identityAuthVersion]).first();
    if (!result) fail(401, 'signin_required', 'Your security settings changed. Sign in again.');
    return { ok: true };
  }
  const code = 'FIP-R-' + random(), recoveryHash = await hash('recovery:' + code), material = await sessionMaterial();
  if (purpose === 'register') {
    await identityLimit(db, session, 'registration', 3, 86400, 20);
    const p = challenge.payload;
    const actor = await digest(session.key, 'profile:' + p.id), now = iso();
    const statements = [
      db.prepare('INSERT INTO profiles(id,callsign,callsign_key,actor_hash,webauthn_user_id,recovery_hash,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(p.id, p.callsign, p.callsign_key, actor, p.user_id, recoveryHash, now),
      credentialInsert(db, info, p.id, label), sessionInsert(db, material, p.id, 0)
    ];
    if (p.claim) statements.push(...claimStatements(db, session.anonymousActor, p.id, now));
    try { await db.batch(statements); }
    catch (error) {
      if (String(error?.message).includes('profiles.callsign_key')) fail(409, 'callsign_taken', 'That callsign was just registered. Please choose another.');
      throw error;
    }
    return { profile: await finishSession(request, db, session, material, p.id), recovery_code: code };
  }
  // Recovery proof only authorizes replacing the passkeys after a fresh passkey
  // has itself been verified. CAS + gated statements defeat simultaneous reuse.
  const id = challenge.profile_id, version = challenge.payload.auth_version;
  const guard = 'EXISTS(SELECT 1 FROM profiles WHERE id=? AND recovery_hash=?)';
  const results = await db.batch([
    db.prepare('UPDATE profiles SET recovery_hash=?,auth_version=auth_version+1 WHERE id=? AND auth_version=? RETURNING id').bind(recoveryHash, id, version),
    db.prepare(`DELETE FROM identity_sessions WHERE profile_id=? AND ${guard}`).bind(id, id, recoveryHash),
    db.prepare(`DELETE FROM passkeys WHERE profile_id=? AND ${guard}`).bind(id, id, recoveryHash),
    credentialInsert(db, info, id, label, guard, [id, recoveryHash]),
    sessionInsert(db, material, id, version + 1, guard, [id, recoveryHash])
  ]);
  if (!results[0].results?.length) fail(409, 'recovery_used', 'That recovery request is no longer valid. Start again with your current code.');
  return { profile: await finishSession(request, db, session, material, id), recovery_code: code };
}
async function signinOptions(request, db, session, data) {
  keysOnly(data, []); await identityLimit(db, session, 'signin-options', 20, 600, 100);
  const config = rp(request);
  const options = await generateAuthenticationOptions({ rpID: config.id, userVerification: 'required', timeout: 120000 });
  return storeChallenge(db, session, 'signin', options, request, null, {});
}
async function verifySignin(request, db, session, data) {
  await identityLimit(db, session, 'signin-verify', 20, 600, 100);
  const challenge = await consumeChallenge(db, session, 'signin', request, data);
  const credentialId = typeof data.credential.id === 'string' ? data.credential.id : '';
  const stored = await db.prepare(`SELECT k.*,p.webauthn_user_id,p.auth_version FROM passkeys k JOIN profiles p ON p.id=k.profile_id WHERE k.credential_id=?`).bind(credentialId).first();
  if (!stored || data.credential.response?.userHandle !== stored.webauthn_user_id) fail(401, 'signin_failed', 'That passkey could not sign in. Please try another passkey.');
  let verification;
  try {
    verification = await verifyAuthenticationResponse({ response: data.credential, expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin, expectedRPID: challenge.rp_id, requireUserVerification: true,
      credential: { id: stored.credential_id, publicKey: bytes(stored.public_key), counter: stored.counter, transports: JSON.parse(stored.transports) } });
  } catch { fail(401, 'signin_failed', 'That passkey could not sign in. Please try again.'); }
  if (!verification.verified || !verification.authenticationInfo.userVerified || verification.authenticationInfo.credentialDeviceType !== stored.device_type) fail(401, 'signin_failed', 'That passkey could not sign in.');
  const info = verification.authenticationInfo, material = await sessionMaterial();
  const results = await db.batch([
    db.prepare(`UPDATE passkeys SET counter=?,backed_up=?,last_used_at=? WHERE credential_id=? AND counter=?
      AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND auth_version=?)`)
      .bind(info.newCounter, info.credentialBackedUp ? 1 : 0, iso(), credentialId, stored.counter, stored.profile_id, stored.auth_version),
    sessionInsert(db, material, stored.profile_id, stored.auth_version, 'changes()=1')
  ]);
  if (!results[1].results?.length) fail(401, 'signin_retry', 'Another security change completed first. Please sign in again.');
  return { profile: await finishSession(request, db, session, material, stored.profile_id) };
}
async function profileDetails(db, id, offset = 0) {
  const profile = await loadProfile(db, id);
  if (!profile) fail(404, 'not_found', 'That fleet record was not found.');
  const [superior, children, counts] = await db.batch([
    db.prepare(`SELECT ${PUBLIC_PROFILE} FROM profiles p JOIN rank_definitions r ON r.id=p.rank_id WHERE p.id=?`).bind(profile.superior_id || ''),
    db.prepare(`SELECT ${PUBLIC_PROFILE} FROM profiles p JOIN rank_definitions r ON r.id=p.rank_id WHERE p.superior_id=? ORDER BY p.created_at,p.id LIMIT 26 OFFSET ?`).bind(id, offset),
    db.prepare(`SELECT (SELECT COUNT(*) FROM profiles WHERE superior_id=?) AS direct_count,
      (SELECT COUNT(*)-1 FROM allegiance_paths WHERE ancestor_id=?) AS subtree_count,
      COUNT(*) AS ideas_count,COALESCE(SUM(votes),0) AS votes_received,
      COALESCE(SUM(CASE WHEN decision_key='implemented' THEN 1 ELSE 0 END),0) AS implemented_count
      FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.profile_id=? AND i.hidden=0 AND c.is_public=1 AND i.contribution_type='idea'`).bind(id, id, id)
  ]);
  return { profile: { ...summary(profile), ...counts.results[0], superior: superior.results[0] ? summary(superior.results[0]) : null,
    direct_vassals: children.results.slice(0, 25).map(summary),
    promotion_eligibility: profile.eligible_rank_id ? { rank_id: profile.eligible_rank_id, label: profile.eligible_rank_label, requires_superior_approval: Boolean(profile.eligible_requires_approval) } : null,
    vessel: null }, has_more: children.results.length > 25 };
}
async function profileActivity(db, id, offset) {
  if (!await db.prepare('SELECT id FROM profiles WHERE id=?').bind(id).first()) fail(404,'not_found','That fleet record was not found.');
  const {results} = await db.prepare(`SELECT * FROM (
    SELECT CASE WHEN i.contribution_type='idea' THEN 'idea' ELSE 'post' END AS type,i.id,i.id AS idea_id,substr(i.body,1,500) AS body,i.created_at,
      c.title AS content_title,c.path AS content_path,i.status,i.status_label,i.votes
      FROM ideas i JOIN content_objects c ON c.id=i.content_id
      WHERE i.profile_id=? AND i.hidden=0 AND c.is_public=1 AND (i.merged_into IS NULL OR EXISTS(SELECT 1 FROM ideas root JOIN content_objects rc ON rc.id=root.content_id WHERE root.id=i.merged_into AND root.hidden=0 AND rc.is_public=1))
    UNION ALL
    SELECT 'reply' AS type,r.id,r.idea_id,substr(r.body,1,500) AS body,r.created_at,
      c.title AS content_title,c.path AS content_path,NULL AS status,NULL AS status_label,NULL AS votes
      FROM replies r JOIN ideas i ON i.id=r.idea_id JOIN content_objects c ON c.id=i.content_id
      WHERE r.profile_id=? AND r.hidden=0 AND i.hidden=0 AND c.is_public=1 AND (i.merged_into IS NULL OR EXISTS(SELECT 1 FROM ideas root JOIN content_objects rc ON rc.id=root.content_id WHERE root.id=i.merged_into AND root.hidden=0 AND rc.is_public=1))
    ) ORDER BY created_at DESC,id DESC,type ASC LIMIT 26 OFFSET ?`).bind(id,id,offset).all();
  return {activity:results.slice(0,25),has_more:results.length>25};
}
async function allegiance(db, session, data) {
  authenticated(session); keysOnly(data, ['superior_id']);
  const superior = data.superior_id === null ? null : profileId(data.superior_id);
  if (superior === session.profileId) fail(409, 'allegiance_cycle', 'You cannot swear allegiance to yourself.');
  await identityLimit(db, session, 'allegiance', 6, 3600, 30);
  if (superior && !await db.prepare('SELECT id FROM profiles WHERE id=?').bind(superior).first()) fail(404, 'not_found', 'That commanding superior was not found.');
  try { await db.prepare('UPDATE profiles SET superior_id=? WHERE id=?').bind(superior, session.profileId).run(); }
  catch (error) {
    const message = String(error?.message);
    if (message.includes('allegiance_cycle')) fail(409, 'allegiance_cycle', 'You cannot swear allegiance to someone in your own command branch.');
    if (message.includes('allegiance_depth')) fail(409, 'allegiance_depth', 'That move would exceed 12 command levels. Your whole branch remains where it is.');
    if (message.includes('allegiance_capacity')) fail(409, 'allegiance_capacity', 'That command would exceed 2,000 members. Your whole branch remains where it is.');
    throw error;
  }
  return { ok: true, ...(await profileDetails(db, session.profileId)) };
}
export async function routeIdentity({ request, env, db, session, url, path, data }) {
  const first = path[0];
  if (!['session', 'auth', 'profiles', 'allegiance'].includes(first)) return null;
  await clean(db);
  let value;
  if (request.method === 'GET' && first === 'session' && path.length === 1) {
    await rememberIdentity(request, db, session);
    value = { profile: session.profile, can_claim: await canClaim(db, session) };
  }
  else if (request.method === 'GET' && first === 'profiles' && path.length === 1) {
    const name = callsign(url.searchParams.get('callsign'));
    const row = await db.prepare(`SELECT ${PUBLIC_PROFILE} FROM profiles p JOIN rank_definitions r ON r.id=p.rank_id WHERE p.callsign_key=?`).bind(name.key).first();
    value = { profiles: row ? [summary(row)] : [] };
  } else if (request.method === 'GET' && first === 'profiles' && path.length === 2) {
    const raw = url.searchParams.get('offset') || '0';
    if (!/^(?:0|[1-9]\d{0,3})$/.test(raw) || Number(raw) > 2000) fail(400, 'invalid_offset', 'That command page is unavailable.');
    value = await profileDetails(db, profileId(path[1]), Number(raw));
  } else if (request.method === 'GET' && first === 'profiles' && path.length === 3 && path[2] === 'activity') {
    value = await profileActivity(db,profileId(path[1]),pageOffset(url));
  } else if (request.method === 'POST' && first === 'allegiance' && path.length === 1) value = await allegiance(db, session, data);
  else if (first === 'auth' && path.length === 3 && ['register', 'recover', 'passkeys'].includes(path[1]) && request.method === 'POST') {
    if (path[2] === 'options') value = await registrationOptions(request, db, session, path[1], data);
    else if (path[2] === 'verify') value = await verifyRegistration(request, db, session, path[1], data);
  } else if (first === 'auth' && path[1] === 'signin' && path.length === 3 && request.method === 'POST') {
    if (path[2] === 'options') value = await signinOptions(request, db, session, data);
    else if (path[2] === 'verify') value = await verifySignin(request, db, session, data);
  } else if (first === 'auth' && path[1] === 'logout' && path.length === 2 && request.method === 'POST') {
    keysOnly(data, []);
    if (session.identityTokenHash) await db.prepare('DELETE FROM identity_sessions WHERE token_hash=?').bind(session.identityTokenHash).run();
    setCookie(request, session); value = { ok: true };
  } else if (first === 'auth' && path[1] === 'claim' && path.length === 2 && request.method === 'POST') {
    keysOnly(data, []); value = await claim(db, session);
  } else if (first === 'auth' && path[1] === 'passkeys' && path.length === 2 && request.method === 'GET') {
    authenticated(session);
    const rows = await db.prepare('SELECT credential_id AS id,label,created_at,last_used_at,backed_up FROM passkeys WHERE profile_id=? ORDER BY created_at').bind(session.profileId).all();
    value = { passkeys: rows.results.map(row => ({ ...row, backed_up: Boolean(row.backed_up) })) };
  } else if (first === 'auth' && path[1] === 'passkeys' && path.length === 4 && path[3] === 'remove' && request.method === 'POST') {
    authenticated(session, true); keysOnly(data, []); await identityLimit(db, session, 'passkey-remove', 10, 3600, 30);
    const credentialId = decodeURIComponent(path[2]);
    const row = await db.prepare(`DELETE FROM passkeys WHERE credential_id=? AND profile_id=?
      AND (SELECT COUNT(*) FROM passkeys WHERE profile_id=?)>1
      AND EXISTS(SELECT 1 FROM profiles WHERE id=? AND auth_version=?) RETURNING credential_id`)
      .bind(credentialId, session.profileId, session.profileId, session.profileId, session.identityAuthVersion).first();
    if (!row) fail(409, 'keep_one_passkey', 'Keep at least one passkey on your record.');
    value = { ok: true };
  } else if (first === 'auth' && path[1] === 'recovery' && path[2] === 'rotate' && path.length === 3 && request.method === 'POST') {
    authenticated(session, true); keysOnly(data, []); await identityLimit(db, session, 'recovery-rotate', 3, 3600, 12);
    const code = 'FIP-R-' + random(), recoveryHash = await hash('recovery:' + code), material = await sessionMaterial();
    const profile = await loadProfile(db, session.profileId);
    const guard = 'EXISTS(SELECT 1 FROM profiles WHERE id=? AND recovery_hash=?)';
    const result = await db.batch([
      db.prepare('UPDATE profiles SET recovery_hash=?,auth_version=auth_version+1 WHERE id=? AND auth_version=? RETURNING id').bind(recoveryHash, profile.id, session.identityAuthVersion),
      db.prepare(`DELETE FROM identity_sessions WHERE profile_id=? AND ${guard}`).bind(profile.id, profile.id, recoveryHash),
      sessionInsert(db, material, profile.id, session.identityAuthVersion + 1, guard, [profile.id, recoveryHash])
    ]);
    if (!result[0].results?.length) fail(409, 'security_changed', 'Another security change completed first. Sign in again before replacing the recovery code.');
    value = { profile: await finishSession(request, db, session, material, profile.id), recovery_code: code };
  }
  if (value === undefined) fail(404, 'not_found', 'That fleet register action was not found.');
  return json(value, session);
}
