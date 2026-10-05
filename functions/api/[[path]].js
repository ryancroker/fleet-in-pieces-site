import {
  ApiError, PAGE_SIZE, GROUP_VOTES_SQL, IDEA_COLUMNS, IDEA_FROM, REPLY_COLUMNS, REPLY_FROM,
  VOTED_SQL, checkMutation, contentFor, contentHash, contentJson,
  database, digest, fail, getIdea, ideaJson, json, keysOnly, pageOffset, paginate, positiveId,
  postFields, problem, publicReadLimit, readJson, replyJson, sessionFor, textField, writeLimit
} from '../_lib/community.js';
import {routeSocial} from '../_lib/social.js';
import { attachIdentity, routeIdentity } from '../_lib/identity.js';
import { routeCreator, publicHistory, creatorSession } from '../_lib/creator.js';
import {proposeTopic,topicCredit,TOPIC_CREDIT_COLUMNS,TOPIC_CREDIT_JOIN} from '../_lib/topics.js';
import {developerReplies} from '../_lib/developer-replies.js';
import {publicActivity,topicActivity} from '../_lib/activity.js';

const notFound = () => fail(404, 'not_found', 'That discussion was not found.');
// Column names are local constants. Claimed browser aliases preserve idempotent retries.
const actorMatch = column => `(${column}=? OR ${column} IN (SELECT actor_hash FROM profile_actors
  WHERE profile_id=(SELECT profile_id FROM profile_actors WHERE actor_hash=?)))`;

async function priorPost(db, session, fields, ideaId = null) {
  // These two table names are application constants, never request input.
  const table = ideaId === null ? 'ideas' : 'replies';
  const prior = await db.prepare(`SELECT id,body,handle,hidden,is_developer${ideaId === null ? ',content_id,contribution_type' : ',idea_id'}
    FROM ${table} WHERE ${actorMatch('actor_hash')} AND request_id=? ORDER BY id ASC LIMIT 1`)
    .bind(session.actor, session.actor, fields.requestId).first();
  if (!prior) return null;
  if (prior.hidden) notFound();
  if (Boolean(prior.is_developer) !== Boolean(session.developer) || prior.body !== fields.body || prior.handle !== fields.handle || (ideaId !== null && prior.idea_id !== ideaId) ||
      (ideaId === null && (prior.content_id !== fields.contentId || prior.contribution_type !== fields.type))) {
    fail(409, 'request_conflict', 'This submission was already used. Refresh before posting different text.');
  }
  if (ideaId === null) return { idea: await getIdea(db, prior.id, session.actor) };
  const row = await db.prepare(`SELECT ${REPLY_COLUMNS} ${REPLY_FROM}
    WHERE r.id=? AND r.hidden=0 AND i.hidden=0 AND c.is_public=1`).bind(prior.id).first();
  if (!row) notFound();
  return { reply: replyJson(row) };
}

async function createPost(db, session, data, ideaId = null, options = {}) {
  const reply = ideaId !== null;
  const fields = postFields(session.developer ? {...data,handle:''} : data, reply);
  if(session.developer)fields.handle='Fleet Command';
  if (!reply) {
    fields.contentId = (await contentFor(db, data)).id;
    fields.type = fields.contentId==='social-mess'?'conversation':fields.contentId==='social-recruitment'?'recruitment':'idea';
    if(fields.type!=='idea'&&!session.profileId&&!session.developer)fail(401,'signin_required','Sign in to start a community conversation. Everyone can still reply and suggest game ideas.');
    if(fields.type==='recruitment'&&!options.recruitment)fail(400,'listing_required','Use your single editable recruitment listing.');
  }
  const prior = await priorPost(db, session, fields, ideaId);
  if (prior) return { value: prior, status: 200 };
  if (reply) { const idea = await getIdea(db, ideaId, session.actor); if (idea.merged_into) fail(409,'merged_discussion','Continue this discussion on idea '+idea.merged_into+'.'); if (idea.locked) fail(409,'discussion_locked','Fleet Command has closed replies on this idea.'); }
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
    result = await db.prepare(`INSERT INTO replies(idea_id,body,handle,created_at,updated_at,actor_hash,request_id,content_hash,profile_id,is_developer)
      SELECT i.id,?,?,?,?,?,?,?,?,? FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND i.locked=0 AND i.merged_into IS NULL AND c.is_public=1
        AND NOT EXISTS(SELECT 1 FROM replies WHERE ${actorMatch('actor_hash')} AND idea_id=? AND content_hash=? AND created_at>?)
      ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`)
      .bind(fields.body, fields.handle, now, now, session.actor, fields.requestId, hash, session.profileId || null, session.developer ? 1 : 0,
        ideaId, session.actor, session.actor, ideaId, hash, since).first();
  } else {
    // system remains a compatibility column; stable content_id now owns the discussion.
    result = await db.prepare(`INSERT INTO ideas(system,content_id,contribution_type,body,handle,created_at,updated_at,actor_hash,request_id,content_hash,profile_id,is_developer)
      SELECT 'missiles',c.id,?,?,?,?,?,?,?,?,?,? FROM content_objects c WHERE c.id=? AND c.is_public=1
        AND NOT EXISTS(SELECT 1 FROM ideas WHERE ${actorMatch('actor_hash')} AND content_id=? AND content_hash=? AND created_at>?)
      ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`)
      .bind(fields.type, fields.body, fields.handle, now, now, session.actor, fields.requestId, hash, session.profileId || null, session.developer ? 1 : 0,
        fields.contentId, session.actor, session.actor, fields.contentId, hash, since).first();
  }
  const value = await priorPost(db, session, fields, ideaId);
  if (value) return { value, status: result ? 201 : 200 };
  if (reply) { const idea = await getIdea(db, ideaId, session.actor); if (idea.merged_into) fail(409,'merged_discussion','Continue this discussion on idea '+idea.merged_into+'.'); if (idea.locked) fail(409,'discussion_locked','Fleet Command has closed replies on this idea.'); }
  fail(409, 'repeat_post', 'That text was just posted. Continue the existing discussion or wait a moment.');
}

async function postingSession(request,env,db,session,data){
  const {as_developer,...post}=data;
  if(as_developer!==undefined&&typeof as_developer!=='boolean')fail(400,'invalid_identity','Choose a valid posting identity.');
  if(!as_developer)return {session,data:post};
  if(!await creatorSession(request,env,db,session))fail(401,'developer_required','Developer access expired. Sign in to Fleet Command again; your draft is saved.');
  // Official posts cannot be claimed later by this browser's optional player profile.
  // This actor is server-derived and never issued as a public ownership cookie.
  const actor=await digest(session.key,'official-post-author:v1');
  return {session:{...session,actor,profileId:null,developer:true},data:post};
}

async function setVote(db, session, id, data) {
  keysOnly(data, ['voted']);
  if (typeof data.voted !== 'boolean') fail(400, 'invalid_vote', 'Choose whether to add or remove your vote.');
  const idea = await getIdea(db, id, session.actor);
  if (idea.merged_into) fail(409,'merged_discussion','Vote on the combined discussion at idea '+idea.merged_into+'.');
  await writeLimit(db, session, 'vote');
  const change = data.voted
    ? db.prepare(`INSERT INTO votes(idea_id,actor_hash,created_at)
        SELECT i.id,?,? FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1
        AND NOT ${VOTED_SQL}
        ON CONFLICT(idea_id,actor_hash) DO NOTHING`).bind(session.actor, new Date().toISOString(), id, session.actor, session.actor)
    : db.prepare(`DELETE FROM votes WHERE idea_id IN (SELECT id FROM ideas WHERE id=? OR merged_into=?) AND ${actorMatch('actor_hash')}
        AND EXISTS(SELECT 1 FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1)`)
      .bind(id, id, session.actor, session.actor, id);
  const results = await db.batch([
    change,
    db.prepare(`UPDATE ideas SET votes=(SELECT COUNT(DISTINCT COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash)) FROM votes v LEFT JOIN profile_actors pa ON pa.actor_hash=v.actor_hash WHERE v.idea_id=ideas.id) WHERE id=? OR merged_into=?`).bind(id, id),
    db.prepare(`SELECT (${GROUP_VOTES_SQL}) AS votes,${VOTED_SQL} AS voted,i.merged_into
      FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1`).bind(session.actor, session.actor, id)
  ]);
  const row = results[2].results?.[0];
  if (!row) notFound();
  if (row.merged_into) fail(409,'merged_discussion','Vote on the combined discussion at idea '+row.merged_into+'.');
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

async function listIdeas(db, session, url) {
  const content = await contentFor(db, {
    ...(url.searchParams.has('content_id') ? { content_id: url.searchParams.get('content_id') } : {}),
    ...(url.searchParams.has('system') ? { system: url.searchParams.get('system') } : {})
  });
  const sort = url.searchParams.get('sort') || 'top';
  const choices = {
    top: { where: '', order: 'i.pinned DESC,votes DESC,i.id DESC' },
    new: { where: '', order: 'i.id DESC' },
    responded: {
      where: " AND (i.command_at IS NOT NULL OR i.status<>'new' OR trim(i.status_label)<>'' OR trim(i.developer_response)<>'' OR i.is_developer=1 OR EXISTS(SELECT 1 FROM replies r JOIN ideas source ON source.id=r.idea_id WHERE (source.id=i.id OR source.merged_into=i.id) AND source.hidden=0 AND r.hidden=0 AND r.is_developer=1))",
      order: 'COALESCE(i.command_at,i.updated_at) DESC,i.id DESC'
    },
    implemented: { where: " AND i.decision_key='implemented'", order: 'i.implemented_at DESC,i.id DESC' }
  };
  if (!Object.hasOwn(choices, sort)) fail(400, 'invalid_sort', 'Choose top, new, dev responded or implemented.');
  const choice = choices[sort];
  const limit = url.searchParams.get('limit') || String(PAGE_SIZE);
  if (!['8',String(PAGE_SIZE)].includes(limit)) fail(400,'invalid_limit','Choose a supported page size.');
  const size = Number(limit);
  const { results } = await db.prepare(`SELECT ${IDEA_COLUMNS} ${IDEA_FROM}
    WHERE i.content_id=? AND i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1${choice.where} ORDER BY ${choice.order} LIMIT ? OFFSET ?`)
    .bind(session.actor, session.actor, content.id, size + 1, pageOffset(url)).all();
  const page = paginate(results,size);
  return { ideas: page.rows.map(row => ideaJson(row)), has_more: page.has_more, content };
}

async function discovery(db, session) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  // At most 256 candidates (128 newest + 128 highest-voted). Rank real activity
  // from the last seven days; never create activity, statuses or filler cards.
  const trending = db.prepare(`WITH recent_candidates AS (
      SELECT id FROM ideas WHERE hidden=0 AND merged_into IS NULL AND contribution_type='idea' ORDER BY id DESC LIMIT 128
    ), popular_candidates AS (
      SELECT i.id FROM ideas i WHERE i.hidden=0 AND i.merged_into IS NULL AND i.contribution_type='idea' ORDER BY (${GROUP_VOTES_SQL}) DESC,i.id DESC LIMIT 128
    ), candidates AS (SELECT id FROM recent_candidates UNION SELECT id FROM popular_candidates),
    ranked AS (
      SELECT i.id,i.content_id,(${GROUP_VOTES_SQL}) AS support,
        3*(SELECT COUNT(DISTINCT COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash)) FROM votes v
          LEFT JOIN profile_actors pa ON pa.actor_hash=v.actor_hash WHERE v.idea_id IN (SELECT g.id FROM ideas g WHERE (g.id=i.id OR g.merged_into=i.id) AND g.hidden=0) AND v.created_at>=?)
        +2*(SELECT COUNT(*) FROM replies r WHERE r.idea_id IN (SELECT g.id FROM ideas g WHERE (g.id=i.id OR g.merged_into=i.id) AND g.hidden=0) AND r.hidden=0 AND r.created_at>=?)
        +CASE WHEN i.created_at>=? THEN 1 ELSE 0 END AS activity
      FROM candidates candidate JOIN ideas i ON i.id=candidate.id JOIN content_objects c ON c.id=i.content_id
      WHERE c.is_public=1
    ), balanced AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY content_id ORDER BY activity DESC,support DESC,id DESC) AS topic_position FROM ranked)
    SELECT ${IDEA_COLUMNS} ${IDEA_FROM} JOIN balanced ON balanced.id=i.id
      WHERE i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1 ORDER BY balanced.topic_position,balanced.activity DESC,balanced.support DESC,i.id DESC LIMIT 6`)
    .bind(since, since, since, session.actor, session.actor);
  const implemented = db.prepare(`SELECT ${IDEA_COLUMNS} ${IDEA_FROM}
    WHERE i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1 AND i.decision_key='implemented' ORDER BY i.implemented_at DESC,i.id DESC LIMIT 4`)
    .bind(session.actor, session.actor);
  const rows = await db.batch([trending, implemented]);
  return { trending: rows[0].results.map(row => ideaJson(row)), implemented: rows[1].results.map(row => ideaJson(row)) };
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
    if (path[0] === 'admin') return json(await routeCreator(request, env, db, session, url, path, data), session);
    await attachIdentity(request, env, db, session);
    if (request.method === 'GET') await publicReadLimit(db, session);
    const identityResponse = await routeIdentity({ request, env, db, session, url, path, data });
    if (identityResponse) return identityResponse;
    const socialResponse=await routeSocial({request,db,session,url,path,data,createPost});if(socialResponse)return socialResponse;
    if(request.method==='POST'&&path.length===1&&path[0]==='topic-proposals')return json(await proposeTopic(db,session,data),session);
    if (request.method === 'GET' && path.length === 1 && path[0] === 'content') {
      const { results } = await db.prepare(`SELECT c.id,c.slug,c.title,c.kind,c.path,c.summary,c.current_json,c.media_json,${TOPIC_CREDIT_COLUMNS},
        (SELECT COUNT(*) FROM ideas i WHERE i.content_id=c.id AND i.hidden=0 AND i.merged_into IS NULL) AS idea_count
        FROM content_objects c ${TOPIC_CREDIT_JOIN} WHERE c.is_public=1 AND c.id NOT LIKE 'social-%' ORDER BY c.title,c.id LIMIT 100`).all();
      const activity=await topicActivity(db);
      return json({ content: results.map(row=>({...contentJson(row),idea_count:row.idea_count,credit:row.proposal_id?topicCredit(row):null,acknowledgement:row.acknowledgement||'',...activity.get(row.id)})) }, session);
    }
    if(request.method==='GET'&&path.length===1&&path[0]==='activity')return json(await publicActivity(db,url),session);
    if (request.method === 'GET' && path.length === 1 && path[0] === 'discovery') return json(await discovery(db, session), session);
    if(request.method==='GET'&&path.length===1&&path[0]==='developer-replies')return json(await developerReplies(db,session,url),session);
    if (path[0] === 'ideas' && path.length === 1) {
      if (request.method === 'GET') return json(await listIdeas(db, session, url), session);
      if (request.method === 'POST') {
        const posting=await postingSession(request,env,db,session,data);
        const result = await createPost(db, posting.session, posting.data);
        return json({...result.value,idea:await getIdea(db,result.value.idea.id,session.actor)}, session, result.status);
      }
    }
    if (path[0] === 'ideas' && path.length >= 2 && path.length <= 3) {
      const id = positiveId(path[1]);
      if (path.length === 2 && request.method === 'GET') return json({ idea: await getIdea(db, id, session.actor) }, session);
      if (path.length === 3 && path[2] === 'history' && request.method === 'GET') return json(await publicHistory(db,id,session.actor),session);
      if (path.length === 3 && path[2] === 'vote' && request.method === 'POST') return json(await setVote(db, session, id, data), session);
      if (path.length === 3 && path[2] === 'replies') {
        if (request.method === 'GET') {
          const idea = await getIdea(db, id, session.actor);
          const { results } = await db.prepare(`SELECT ${REPLY_COLUMNS} ${REPLY_FROM}
            WHERE (r.idea_id=? OR i.merged_into=?) AND r.hidden=0 AND i.hidden=0 AND c.is_public=1 ORDER BY r.id DESC LIMIT ? OFFSET ?`)
            .bind(id, id, PAGE_SIZE + 1, pageOffset(url)).all();
          const page = paginate(results);
          return json({ replies: page.rows.map(row => replyJson(row)), reply_count: idea.reply_count, has_more: page.has_more }, session);
        }
        if (request.method === 'POST') {
          const posting=await postingSession(request,env,db,session,data);
          const result = await createPost(db, posting.session, posting.data, id);
          const idea = await getIdea(db, id, session.actor);
          return json({...result.value, reply_count:idea.reply_count}, session, result.status);
        }
      }
    }
    if (path[0] === 'reports' && path.length === 1 && request.method === 'POST') return json(await report(db, session, data), session);
    notFound();
  } catch (error) { return problem(error, session); }
}
