import {
  ApiError, PAGE_SIZE, STATUSES, STATUS_PRESETS, IDEA_COLUMNS, IDEA_FROM, REPLY_COLUMNS, REPLY_FROM,
  VOTE_COUNT_SQL, VOTED_SQL, authorizeAdmin, checkMutation, contentFor, contentHash, contentJson,
  database, fail, getIdea, ideaJson, json, keysOnly, pageOffset, paginate, positiveId,
  postFields, problem, publicReadLimit, readJson, replyJson, sessionFor, textField, writeLimit
} from '../_lib/community.js';
import { attachIdentity, routeIdentity } from '../_lib/identity.js';

const notFound = () => fail(404, 'not_found', 'That discussion was not found.');
// Column names are local constants. Claimed browser aliases preserve idempotent retries.
const actorMatch = column => `(${column}=? OR ${column} IN (SELECT actor_hash FROM profile_actors
  WHERE profile_id=(SELECT profile_id FROM profile_actors WHERE actor_hash=?)))`;

async function priorPost(db, session, fields, ideaId = null) {
  // These two table names are application constants, never request input.
  const table = ideaId === null ? 'ideas' : 'replies';
  const prior = await db.prepare(`SELECT id,body,handle,hidden${ideaId === null ? ',content_id,contribution_type' : ',idea_id'}
    FROM ${table} WHERE ${actorMatch('actor_hash')} AND request_id=? ORDER BY id ASC LIMIT 1`)
    .bind(session.actor, session.actor, fields.requestId).first();
  if (!prior) return null;
  if (prior.hidden) notFound();
  if (prior.body !== fields.body || prior.handle !== fields.handle || (ideaId !== null && prior.idea_id !== ideaId) ||
      (ideaId === null && (prior.content_id !== fields.contentId || prior.contribution_type !== 'idea'))) {
    fail(409, 'request_conflict', 'This submission was already used. Refresh before posting different text.');
  }
  if (ideaId === null) return { idea: await getIdea(db, prior.id, session.actor) };
  const row = await db.prepare(`SELECT ${REPLY_COLUMNS} ${REPLY_FROM}
    WHERE r.id=? AND r.hidden=0 AND i.hidden=0 AND c.is_public=1`).bind(prior.id).first();
  if (!row) notFound();
  return { reply: replyJson(row) };
}

async function createPost(db, session, data, ideaId = null) {
  const reply = ideaId !== null;
  const fields = postFields(data, reply);
  if (!reply) fields.contentId = (await contentFor(db, data)).id;
  const prior = await priorPost(db, session, fields, ideaId);
  if (prior) return { value: prior, status: 200 };
  if (reply) await getIdea(db, ideaId, session.actor);
  const hash = await contentHash(session, fields.body);
  try { await writeLimit(db, session, reply ? 'reply' : 'idea', hash, reply ? String(ideaId) : fields.contentId); }
  catch (error) {
    // A concurrent request may have completed while this retry reached its cap.
    if (error instanceof ApiError && error.status === 429) {
      const replay = await priorPost(db, session, fields, ideaId);
      if (replay) return { value: replay, status: 200 };
    }
    throw error;
  }
  const now = new Date().toISOString();
  const since = new Date(Date.now() - 120000).toISOString();
  let result;
  if (reply) {
    result = await db.prepare(`INSERT INTO replies(idea_id,body,handle,created_at,updated_at,actor_hash,request_id,content_hash,profile_id)
      SELECT i.id,?,?,?,?,?,?,?,? FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1
        AND NOT EXISTS(SELECT 1 FROM replies WHERE ${actorMatch('actor_hash')} AND idea_id=? AND content_hash=? AND created_at>?)
      ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`)
      .bind(fields.body, fields.handle, now, now, session.actor, fields.requestId, hash, session.profileId || null,
        ideaId, session.actor, session.actor, ideaId, hash, since).first();
  } else {
    // system remains a compatibility column; stable content_id now owns the discussion.
    result = await db.prepare(`INSERT INTO ideas(system,content_id,contribution_type,body,handle,created_at,updated_at,actor_hash,request_id,content_hash,profile_id)
      SELECT 'missiles',c.id,'idea',?,?,?,?,?,?,?,? FROM content_objects c WHERE c.id=? AND c.is_public=1
        AND NOT EXISTS(SELECT 1 FROM ideas WHERE ${actorMatch('actor_hash')} AND content_id=? AND content_hash=? AND created_at>?)
      ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`)
      .bind(fields.body, fields.handle, now, now, session.actor, fields.requestId, hash, session.profileId || null,
        fields.contentId, session.actor, session.actor, fields.contentId, hash, since).first();
  }
  const value = await priorPost(db, session, fields, ideaId);
  if (value) return { value, status: result ? 201 : 200 };
  if (reply) await getIdea(db, ideaId, session.actor);
  fail(409, 'repeat_post', 'That text was just posted. Continue the existing discussion or wait a moment.');
}

async function setVote(db, session, id, data) {
  keysOnly(data, ['voted']);
  if (typeof data.voted !== 'boolean') fail(400, 'invalid_vote', 'Choose whether to add or remove your vote.');
  await getIdea(db, id, session.actor);
  await writeLimit(db, session, 'vote');
  const change = data.voted
    ? db.prepare(`INSERT INTO votes(idea_id,actor_hash,created_at)
        SELECT i.id,?,? FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1
        AND NOT ${VOTED_SQL}
        ON CONFLICT(idea_id,actor_hash) DO NOTHING`).bind(session.actor, new Date().toISOString(), id, session.actor, session.actor)
    : db.prepare(`DELETE FROM votes WHERE idea_id=? AND ${actorMatch('actor_hash')}
        AND EXISTS(SELECT 1 FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1)`)
      .bind(id, session.actor, session.actor, id);
  const results = await db.batch([
    change,
    db.prepare(`UPDATE ideas SET votes=(${VOTE_COUNT_SQL}) WHERE id=? AND hidden=0`).bind(id, id),
    db.prepare(`SELECT i.votes,${VOTED_SQL} AS voted
      FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1`).bind(session.actor, session.actor, id)
  ]);
  const row = results[2].results?.[0];
  if (!row) notFound();
  return { votes: row.votes, voted: Boolean(row.voted) };
}

async function report(db, session, data) {
  keysOnly(data, ['target_type', 'target_id', 'reason', 'detail']);
  if (!['idea', 'reply'].includes(data.target_type) || !['spam', 'privacy', 'threat', 'illegal', 'other'].includes(data.reason)) {
    fail(400, 'invalid_report', 'Choose a post and a report reason.');
  }
  if (typeof data.target_id !== 'number' || !Number.isSafeInteger(data.target_id) || data.target_id < 1) {
    fail(400, 'invalid_report', 'Choose a valid post to report.');
  }
  const id = positiveId(data.target_id);
  // Private moderator-only context can quote the issue. It is not publicly rendered.
  const detail = textField(data.detail ?? '', 'Report detail', 0, 1000);
  const reply = data.target_type === 'reply';
  const visibleSql = reply
    ? 'SELECT r.idea_id FROM replies r JOIN ideas i ON i.id=r.idea_id JOIN content_objects c ON c.id=i.content_id WHERE r.id=? AND r.hidden=0 AND i.hidden=0 AND c.is_public=1'
    : 'SELECT i.id AS idea_id FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1';
  const target = await db.prepare(visibleSql).bind(id).first();
  if (!target) notFound();
  const existing = await db.prepare('SELECT id FROM reports WHERE actor_hash=? AND target_type=? AND target_id=?')
    .bind(session.actor, data.target_type, id).first();
  if (existing) return { ok: true };
  await writeLimit(db, session, 'report');
  // Check public visibility in the same statement that records the report.
  await db.prepare(`INSERT INTO reports(target_type,target_id,idea_id,reason,detail,actor_hash,created_at)
    SELECT ?,?,visible.idea_id,?,?,?,? FROM (${visibleSql}) visible WHERE 1
    ON CONFLICT(actor_hash,target_type,target_id) DO NOTHING`)
    .bind(data.target_type, id, data.reason, detail, session.actor, new Date().toISOString(), id).run();
  return { ok: true };
}

async function adminList(db, session, url) {
  const offset = pageOffset(url);
  const view = url.searchParams.get('view') || 'reports';
  if (view === 'ideas') {
    const { results } = await db.prepare(`SELECT ${IDEA_COLUMNS},i.hidden ${IDEA_FROM} ORDER BY i.id DESC LIMIT ? OFFSET ?`)
      .bind(session.actor, session.actor, PAGE_SIZE + 1, offset).all();
    const page = paginate(results);
    return { ideas: page.rows.map(row => ideaJson(row, true)), has_more: page.has_more };
  }
  if (view !== 'reports') fail(400, 'invalid_view', 'Choose reports or ideas.');
  const { results } = await db.prepare(`SELECT p.id,p.target_type,p.target_id,p.idea_id,p.reason,p.detail,p.created_at,p.resolved_at,
      CASE WHEN p.target_type='idea' THEN i.body ELSE r.body END AS target_body,
      CASE WHEN p.target_type='idea' THEN i.handle ELSE r.handle END AS target_handle,
      CASE WHEN i.hidden=1 OR i.id IS NULL OR (p.target_type='reply' AND (r.hidden=1 OR r.id IS NULL)) THEN 1 ELSE 0 END AS target_hidden,
      CASE WHEN p.target_type='idea' THEN COALESCE(i.hidden,1) ELSE COALESCE(r.hidden,1) END AS target_own_hidden,
      CASE WHEN p.target_type='reply' THEN COALESCE(i.hidden,1) ELSE 0 END AS parent_hidden
    FROM reports p LEFT JOIN ideas i ON i.id=p.idea_id
      LEFT JOIN replies r ON p.target_type='reply' AND r.id=p.target_id
    WHERE p.resolved_at IS NULL ORDER BY p.id DESC LIMIT ? OFFSET ?`).bind(PAGE_SIZE + 1, offset).all();
  const page = paginate(results);
  return {
    reports: page.rows.map(row => ({ ...row, target_hidden: Boolean(row.target_hidden), target_own_hidden: Boolean(row.target_own_hidden), parent_hidden: Boolean(row.parent_hidden), resolved: Boolean(row.resolved_at) })),
    has_more: page.has_more
  };
}

async function adminDetail(db, session, id, url) {
  const idea = await getIdea(db, id, session.actor, true);
  const { results } = await db.prepare(`SELECT ${REPLY_COLUMNS},r.hidden,r.updated_at ${REPLY_FROM} WHERE r.idea_id=? ORDER BY r.id ASC LIMIT ? OFFSET ?`)
    .bind(id, PAGE_SIZE + 1, pageOffset(url)).all();
  const page = paginate(results);
  return { idea, replies: page.rows.map(row => replyJson(row, true)), has_more: page.has_more };
}

async function moderateIdea(db, id, data) {
  keysOnly(data, ['status', 'status_label', 'status_key', 'developer_response', 'hidden']);
  if (!Object.keys(data).length) fail(400, 'invalid_fields', 'Choose a field to update.');
  if ('status_key' in data) {
    if (typeof data.status_key !== 'string' || !Object.hasOwn(STATUS_PRESETS, data.status_key)) fail(400, 'invalid_status', 'Choose a supported development status.');
    if ('status' in data || 'status_label' in data) fail(400, 'invalid_status', 'Choose a preset or a custom status, not both.');
    const preset = STATUS_PRESETS[data.status_key];
    data = { ...data, status: preset.status, status_label: preset.label };
  }
  const sets = [], values = [], differences = [], comparisons = [], decisionDifferences = [], decisionValues = [];
  const add = (name, value, decision = false) => {
    sets.push(`${name}=?`); values.push(value); differences.push(`${name} IS NOT ?`); comparisons.push(value);
    if (decision) { decisionDifferences.push(`${name} IS NOT ?`); decisionValues.push(value); }
  };
  if ('status' in data) {
    if (!STATUSES.has(data.status)) fail(400, 'invalid_status', 'Choose a supported development status.');
    add('status', data.status, true);
  }
  if ('status_label' in data) add('status_label', textField(data.status_label, 'Status label', 0, 60, false), true);
  if ('developer_response' in data) add('developer_response', textField(data.developer_response, 'Developer response', 0, 2000), true);
  if ('hidden' in data) {
    if (typeof data.hidden !== 'boolean') fail(400, 'invalid_hidden', 'Hidden must be true or false.');
    add('hidden', data.hidden ? 1 : 0);
  }
  const now = new Date().toISOString();
  if (decisionDifferences.length) {
    sets.push(`command_at=CASE WHEN ${decisionDifferences.join(' OR ')} THEN ? ELSE command_at END`);
    values.push(...decisionValues, now);
  }
  if ('status' in data) {
    // Preserve the first implementation date if a later decision changes the status.
    sets.push("implemented_at=CASE WHEN ?='implemented' AND implemented_at IS NULL THEN ? ELSE implemented_at END");
    values.push(data.status, now);
  }
  sets.push('updated_at=?'); values.push(now);
  // Only whitelisted column names enter SQL. Identical saves leave timestamps/history intact.
  const result = await db.prepare(`UPDATE ideas SET ${sets.join(',')} WHERE id=? AND (${differences.join(' OR ')}) RETURNING id`)
    .bind(...values, id, ...comparisons).first();
  if (!result && !await db.prepare('SELECT id FROM ideas WHERE id=?').bind(id).first()) notFound();
  return { ok: true };
}

async function listIdeas(db, session, url) {
  const content = await contentFor(db, {
    ...(url.searchParams.has('content_id') ? { content_id: url.searchParams.get('content_id') } : {}),
    ...(url.searchParams.has('system') ? { system: url.searchParams.get('system') } : {})
  });
  const sort = url.searchParams.get('sort') || 'top';
  const choices = {
    top: { where: '', order: 'i.votes DESC,i.id DESC' },
    new: { where: '', order: 'i.id DESC' },
    responded: {
      where: " AND (i.command_at IS NOT NULL OR i.status<>'new' OR trim(i.status_label)<>'' OR trim(i.developer_response)<>'')",
      order: 'COALESCE(i.command_at,i.updated_at) DESC,i.id DESC'
    },
    implemented: { where: " AND i.status='implemented'", order: 'i.implemented_at DESC,i.id DESC' }
  };
  if (!Object.hasOwn(choices, sort)) fail(400, 'invalid_sort', 'Choose top, new, dev responded or implemented.');
  const choice = choices[sort];
  const { results } = await db.prepare(`SELECT ${IDEA_COLUMNS} ${IDEA_FROM}
    WHERE i.content_id=? AND i.hidden=0 AND c.is_public=1${choice.where} ORDER BY ${choice.order} LIMIT ? OFFSET ?`)
    .bind(session.actor, session.actor, content.id, PAGE_SIZE + 1, pageOffset(url)).all();
  const page = paginate(results);
  return { ideas: page.rows.map(row => ideaJson(row)), has_more: page.has_more, content };
}

async function discovery(db, session) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  // At most 256 candidates (128 newest + 128 highest-voted). Rank real activity
  // from the last seven days; never create activity, statuses or filler cards.
  const trending = db.prepare(`WITH recent_candidates AS (
      SELECT id FROM ideas WHERE hidden=0 ORDER BY id DESC LIMIT 128
    ), popular_candidates AS (
      SELECT id FROM ideas WHERE hidden=0 ORDER BY votes DESC,id DESC LIMIT 128
    ), candidates AS (SELECT id FROM recent_candidates UNION SELECT id FROM popular_candidates),
    ranked AS (
      SELECT i.id,
        3*(SELECT COUNT(DISTINCT COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash)) FROM votes v
          LEFT JOIN profile_actors pa ON pa.actor_hash=v.actor_hash WHERE v.idea_id=i.id AND v.created_at>=?)
        +2*(SELECT COUNT(*) FROM replies r WHERE r.idea_id=i.id AND r.hidden=0 AND r.created_at>=?)
        +CASE WHEN i.created_at>=? THEN 1 ELSE 0 END AS activity
      FROM candidates candidate JOIN ideas i ON i.id=candidate.id JOIN content_objects c ON c.id=i.content_id
      WHERE c.is_public=1 ORDER BY activity DESC,i.votes DESC,i.id DESC LIMIT 6
    ) SELECT ${IDEA_COLUMNS} ${IDEA_FROM} JOIN ranked ON ranked.id=i.id
      WHERE i.hidden=0 AND c.is_public=1 ORDER BY ranked.activity DESC,i.votes DESC,i.id DESC`)
    .bind(since, since, since, session.actor, session.actor);
  const implemented = db.prepare(`SELECT ${IDEA_COLUMNS} ${IDEA_FROM}
    WHERE i.hidden=0 AND c.is_public=1 AND i.status='implemented' ORDER BY i.implemented_at DESC,i.id DESC LIMIT 4`)
    .bind(session.actor, session.actor);
  const rows = await db.batch([trending, implemented]);
  return { trending: rows[0].results.map(row => ideaJson(row)), implemented: rows[1].results.map(row => ideaJson(row)) };
}

async function adminRoute(request, db, session, env, url, path, data) {
  await authorizeAdmin(request, env, db, session);
  if (request.method === 'GET' && path.length === 1) return adminList(db, session, url);
  if (request.method === 'GET' && path.length === 3 && path[1] === 'ideas') return adminDetail(db, session, positiveId(path[2]), url);
  if (request.method !== 'PATCH' || path.length !== 3) notFound();
  const id = positiveId(path[2]);
  if (path[1] === 'ideas') return moderateIdea(db, id, data);
  if (path[1] === 'replies') {
    keysOnly(data, ['hidden']);
    if (typeof data.hidden !== 'boolean') fail(400, 'invalid_hidden', 'Hidden must be true or false.');
    const result = await db.prepare('UPDATE replies SET hidden=?,updated_at=? WHERE id=? AND hidden<>? RETURNING id')
      .bind(data.hidden ? 1 : 0, new Date().toISOString(), id, data.hidden ? 1 : 0).first();
    if (!result && !await db.prepare('SELECT id FROM replies WHERE id=?').bind(id).first()) notFound();
    return { ok: true };
  }
  if (path[1] === 'reports') {
    keysOnly(data, ['resolved']);
    if (data.resolved !== true) fail(400, 'invalid_resolution', 'Resolve must be true.');
    const result = await db.prepare('UPDATE reports SET resolved_at=COALESCE(resolved_at,?) WHERE id=? RETURNING id')
      .bind(new Date().toISOString(), id).first();
    if (!result) notFound();
    return { ok: true };
  }
  notFound();
}

export async function onRequest(context) {
  let session;
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    if (!['GET', 'POST', 'PATCH'].includes(request.method)) fail(405, 'method_not_allowed', 'That method is not supported.');
    const db = database(env);
    session = await sessionFor(request, env);
    let data;
    if (request.method !== 'GET') { checkMutation(request); data = await readJson(request); }
    if (path[0] === 'admin') return json(await adminRoute(request, db, session, env, url, path, data), session);
    await attachIdentity(request, env, db, session);
    if (request.method === 'GET') await publicReadLimit(db, session);
    const identityResponse = await routeIdentity({ request, env, db, session, url, path, data });
    if (identityResponse) return identityResponse;
    if (request.method === 'GET' && path.length === 1 && path[0] === 'content') {
      const { results } = await db.prepare('SELECT id,slug,title,kind,path,summary,current_json,media_json FROM content_objects WHERE is_public=1 ORDER BY kind,title,id LIMIT 100').all();
      return json({ content: results.map(contentJson) }, session);
    }
    if (request.method === 'GET' && path.length === 1 && path[0] === 'discovery') return json(await discovery(db, session), session);
    if (path[0] === 'ideas' && path.length === 1) {
      if (request.method === 'GET') return json(await listIdeas(db, session, url), session);
      if (request.method === 'POST') {
        const result = await createPost(db, session, data);
        return json(result.value, session, result.status);
      }
    }
    if (path[0] === 'ideas' && path.length >= 2 && path.length <= 3) {
      const id = positiveId(path[1]);
      if (path.length === 2 && request.method === 'GET') return json({ idea: await getIdea(db, id, session.actor) }, session);
      if (path.length === 3 && path[2] === 'vote' && request.method === 'POST') return json(await setVote(db, session, id, data), session);
      if (path.length === 3 && path[2] === 'replies') {
        if (request.method === 'GET') {
          await getIdea(db, id, session.actor);
          const { results } = await db.prepare(`SELECT ${REPLY_COLUMNS} ${REPLY_FROM}
            WHERE r.idea_id=? AND r.hidden=0 AND i.hidden=0 AND c.is_public=1 ORDER BY r.id ASC LIMIT ? OFFSET ?`)
            .bind(id, PAGE_SIZE + 1, pageOffset(url)).all();
          const page = paginate(results);
          return json({ replies: page.rows.map(row => replyJson(row)), has_more: page.has_more }, session);
        }
        if (request.method === 'POST') {
          const result = await createPost(db, session, data, id);
          return json(result.value, session, result.status);
        }
      }
    }
    if (path[0] === 'reports' && path.length === 1 && request.method === 'POST') return json(await report(db, session, data), session);
    notFound();
  } catch (error) { return problem(error, session); }
}
