import {
  ApiError, PAGE_SIZE, STATUSES, IDEA_COLUMNS, authorizeAdmin, checkMutation, contentHash,
  database, fail, getIdea, ideaJson, json, keysOnly, pageOffset, paginate, positiveId,
  postFields, problem, publicReadLimit, readJson, replyJson, sessionFor, textField, writeLimit
} from '../_lib/community.js';

const notFound = () => fail(404, 'not_found', 'That discussion was not found.');

async function priorPost(db, session, fields, ideaId = null) {
  // These two table names are application constants, never request input.
  const table = ideaId === null ? 'ideas' : 'replies';
  const prior = await db.prepare(`SELECT id,body,handle,hidden${ideaId === null ? '' : ',idea_id'} FROM ${table} WHERE actor_hash=? AND request_id=?`)
    .bind(session.actor, fields.requestId).first();
  if (!prior) return null;
  if (prior.hidden) notFound();
  if (prior.body !== fields.body || prior.handle !== fields.handle || (ideaId !== null && prior.idea_id !== ideaId)) {
    fail(409, 'request_conflict', 'This submission was already used. Refresh before posting different text.');
  }
  if (ideaId === null) return { idea: await getIdea(db, prior.id, session.actor) };
  const row = await db.prepare(`SELECT r.id,r.idea_id,r.body,r.handle,r.created_at FROM replies r
    JOIN ideas i ON i.id=r.idea_id WHERE r.id=? AND r.hidden=0 AND i.hidden=0`).bind(prior.id).first();
  if (!row) notFound();
  return { reply: replyJson(row) };
}

async function createPost(db, session, data, ideaId = null) {
  const reply = ideaId !== null;
  const fields = postFields(data, reply);
  const prior = await priorPost(db, session, fields, ideaId);
  if (prior) return { value: prior, status: 200 };
  if (reply) await getIdea(db, ideaId, session.actor);
  const hash = await contentHash(session, fields.body);
  try { await writeLimit(db, session, reply ? 'reply' : 'idea', hash, reply ? String(ideaId) : ''); }
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
    result = await db.prepare(`INSERT INTO replies(idea_id,body,handle,created_at,updated_at,actor_hash,request_id,content_hash)
      SELECT i.id,?,?,?,?,?,?,? FROM ideas i WHERE i.id=? AND i.hidden=0
        AND NOT EXISTS(SELECT 1 FROM replies WHERE actor_hash=? AND idea_id=? AND content_hash=? AND created_at>?)
      ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`)
      .bind(fields.body, fields.handle, now, now, session.actor, fields.requestId, hash, ideaId, session.actor, ideaId, hash, since).first();
  } else {
    result = await db.prepare(`INSERT INTO ideas(system,body,handle,created_at,updated_at,actor_hash,request_id,content_hash)
      SELECT 'missiles',?,?,?,?,?,?,?
      WHERE NOT EXISTS(SELECT 1 FROM ideas WHERE actor_hash=? AND content_hash=? AND created_at>?)
      ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`)
      .bind(fields.body, fields.handle, now, now, session.actor, fields.requestId, hash, session.actor, hash, since).first();
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
        SELECT id,?,? FROM ideas WHERE id=? AND hidden=0
        ON CONFLICT(idea_id,actor_hash) DO NOTHING`).bind(session.actor, new Date().toISOString(), id)
    : db.prepare(`DELETE FROM votes WHERE idea_id=? AND actor_hash=?
        AND EXISTS(SELECT 1 FROM ideas WHERE id=? AND hidden=0)`).bind(id, session.actor, id);
  const results = await db.batch([
    change,
    db.prepare('UPDATE ideas SET votes=(SELECT COUNT(*) FROM votes WHERE idea_id=?) WHERE id=? AND hidden=0').bind(id, id),
    db.prepare(`SELECT i.votes,EXISTS(SELECT 1 FROM votes v WHERE v.idea_id=i.id AND v.actor_hash=?) AS voted
      FROM ideas i WHERE i.id=? AND i.hidden=0`).bind(session.actor, id)
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
    ? 'SELECT r.idea_id FROM replies r JOIN ideas i ON i.id=r.idea_id WHERE r.id=? AND r.hidden=0 AND i.hidden=0'
    : 'SELECT id AS idea_id FROM ideas WHERE id=? AND hidden=0';
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
    const { results } = await db.prepare(`SELECT ${IDEA_COLUMNS},i.hidden FROM ideas i ORDER BY i.id DESC LIMIT ? OFFSET ?`)
      .bind(session.actor, PAGE_SIZE + 1, offset).all();
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
  const { results } = await db.prepare('SELECT id,idea_id,body,handle,hidden,created_at,updated_at FROM replies WHERE idea_id=? ORDER BY id ASC LIMIT ? OFFSET ?')
    .bind(id, PAGE_SIZE + 1, pageOffset(url)).all();
  const page = paginate(results);
  return { idea, replies: page.rows.map(row => replyJson(row, true)), has_more: page.has_more };
}

async function moderateIdea(db, id, data) {
  keysOnly(data, ['status', 'status_label', 'developer_response', 'hidden']);
  if (!Object.keys(data).length) fail(400, 'invalid_fields', 'Choose a field to update.');
  const sets = [], values = [], differences = [], comparisons = [];
  const add = (name, value) => { sets.push(`${name}=?`); values.push(value); differences.push(`${name} IS NOT ?`); comparisons.push(value); };
  if ('status' in data) {
    if (!STATUSES.has(data.status)) fail(400, 'invalid_status', 'Choose a supported development status.');
    add('status', data.status);
  }
  if ('status_label' in data) add('status_label', textField(data.status_label, 'Status label', 0, 60, false));
  if ('developer_response' in data) add('developer_response', textField(data.developer_response, 'Developer response', 0, 2000));
  if ('hidden' in data) {
    if (typeof data.hidden !== 'boolean') fail(400, 'invalid_hidden', 'Hidden must be true or false.');
    add('hidden', data.hidden ? 1 : 0);
  }
  const now = new Date().toISOString();
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
    if (request.method === 'GET') await publicReadLimit(db, session);
    if (path[0] === 'ideas' && path.length === 1) {
      if (request.method === 'GET') {
        if ((url.searchParams.get('system') || 'missiles') !== 'missiles') fail(400, 'invalid_system', 'Choose the missiles discussion.');
        const sort = url.searchParams.get('sort') || 'top';
        if (!['top', 'new'].includes(sort)) fail(400, 'invalid_sort', 'Choose top or new.');
        const order = sort === 'top' ? 'i.votes DESC,i.id DESC' : 'i.id DESC';
        const { results } = await db.prepare(`SELECT ${IDEA_COLUMNS} FROM ideas i WHERE i.system='missiles' AND i.hidden=0 ORDER BY ${order} LIMIT ? OFFSET ?`)
          .bind(session.actor, PAGE_SIZE + 1, pageOffset(url)).all();
        const page = paginate(results);
        return json({ ideas: page.rows.map(row => ideaJson(row)), has_more: page.has_more }, session);
      }
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
          const { results } = await db.prepare(`SELECT r.id,r.idea_id,r.body,r.handle,r.created_at FROM replies r
            JOIN ideas i ON i.id=r.idea_id WHERE r.idea_id=? AND r.hidden=0 AND i.hidden=0 ORDER BY r.id ASC LIMIT ? OFFSET ?`)
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
