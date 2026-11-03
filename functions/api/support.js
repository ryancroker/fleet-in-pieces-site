import {ApiError,checkMutation,digest,database,fail,json,keysOnly,limits,pageOffset,publicReadLimit,readJson,sessionFor,textField} from '../_lib/community.js';
import {creatorSession} from '../_lib/creator.js';
import {admitWrite,controlFuse,fuseStatus,settleWrite} from '../_lib/cost-fuse.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES=['bug','accessibility','website','other'];
const STATUSES=['new','reviewing','closed'];
// This scoped environment is used only by this independent support endpoint.
// It never changes the legacy community gate or relaxes the stored cost fuse.
function supportEnvironment(env){return {...env,COMMUNITY_WRITES_ENABLED:env.SUPPORT_WRITES_ENABLED==='true'};}
function fields(data){
  keysOnly(data,['request_id','category','subject','body','contact_email','game_version','website']);
  if(typeof data.request_id!=='string'||!UUID.test(data.request_id))fail(400,'invalid_request','Refresh the form and try again.');
  if(data.website!==undefined&&(typeof data.website!=='string'||data.website.trim()))fail(422,'submission_rejected','That report could not be accepted.');
  if(!CATEGORIES.includes(data.category))fail(400,'invalid_category','Choose a support category.');
  const value={category:data.category,subject:textField(data.subject,'Summary',3,100,false),body:textField(data.body,'Details',10,4000),contact_email:textField(data.contact_email??'','Reply email',0,254,false),game_version:textField(data.game_version??'','Game version',0,80,false)};
  if(value.contact_email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.contact_email))fail(400,'invalid_email','Enter a reply email or leave it blank.');
  return {id:data.request_id.toLowerCase(),...value};
}
async function receive(db,session,data){
  const {id,...value}=fields(data),hash=await digest(session.key,'support:'+JSON.stringify(value));
  const prior=await db.prepare('SELECT actor_hash,content_hash FROM support_requests WHERE id=?').bind(id).first();
  if(prior){if(prior.actor_hash!==session.actor||prior.content_hash!==hash)fail(409,'request_conflict','This report reference was already used. Start a new report.');return {ok:true,reference:id,repeated:true};}
  await limits(db,session,[['support-hour',session.actor,3,3600],['support-day',session.actor,8,86400],['support-ip-hour',session.ip,20,3600],['support-ip-day',session.ip,60,86400]]);
  const now=new Date().toISOString();
  await db.prepare(`INSERT INTO support_requests(id,actor_hash,content_hash,category,subject,body,contact_email,game_version,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(id,session.actor,hash,value.category,value.subject,value.body,value.contact_email,value.game_version,now,now).run();
  const stored=await db.prepare('SELECT actor_hash,content_hash FROM support_requests WHERE id=?').bind(id).first();
  if(!stored||stored.actor_hash!==session.actor||stored.content_hash!==hash)fail(409,'request_conflict','This report reference was already used. Start a new report.');
  return {ok:true,reference:id};
}
async function review(request,env,db,session,url,data){
  // No caller-supplied badge, name or ordinary member account grants access.
  if(!await creatorSession(request,env,db,session))fail(401,'developer_required','Sign in at Fleet Command to review support.');
  if(request.method==='GET'){
    const status=url.searchParams.get('status')||'new';
    if(![...STATUSES,'all'].includes(status))fail(400,'invalid_status','Choose a support view.');
    const rows=await db.prepare(`SELECT id,category,subject,body,contact_email,game_version,created_at,updated_at,status,private_note,revision FROM support_requests
      WHERE (?='all' OR status=?) ORDER BY created_at DESC,id DESC LIMIT 26 OFFSET ?`).bind(status,status,pageOffset(url)).all();
    return {requests:rows.results.slice(0,25),has_more:rows.results.length>25,safety:await fuseStatus(db,supportEnvironment(env))};
  }
  await limits(db,session,[['admin',session.actor,120,60],['admin-ip',session.ip,300,60]]);
  if(data.control){
    keysOnly(data,['control']);
    return controlFuse(db,supportEnvironment(env),data.control);
  }
  keysOnly(data,['id','revision','status','private_note']);
  if(typeof data.id!=='string'||!UUID.test(data.id)||!Number.isSafeInteger(data.revision)||data.revision<1||!STATUSES.includes(data.status))fail(400,'invalid_update','Choose a valid support report and status.');
  const note=textField(data.private_note??'','Private note',0,2000);
  const active=await creatorSession(request,env,db,session);
  if(!active)fail(401,'developer_required','Sign in at Fleet Command again.');
  const result=await db.prepare(`UPDATE support_requests SET status=?,private_note=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?
    AND EXISTS(SELECT 1 FROM creator_sessions WHERE token_hash=? AND key_version=? AND expires_at>?) RETURNING revision`).bind(data.status,note,new Date().toISOString(),data.id.toLowerCase(),data.revision,active.token_hash,active.key_version,session.now).first();
  if(!result)fail(409,'stale_edit','The report changed or your session expired. Refresh before saving.');
  return {ok:true,revision:result.revision};
}
export async function onRequest(context){
  let session,permit;
  const stats={rowsWritten:0,rowsRead:0};
  try{
    const {request,env}=context,url=new URL(request.url);
    if(!['GET','POST','PATCH'].includes(request.method))fail(405,'method_not_allowed','That method is not supported.');
    if(!['fleetinpieces.space','localhost','127.0.0.1','[::1]'].includes(url.hostname))fail(403,'canonical_host','Use https://fleetinpieces.space/support.');
    const reading=request.method==='GET';
    let data;
    if(!reading){checkMutation(request);data=await readJson(request);}
    const db=database(env,{readOnly:reading,maxStatements:reading?50:44,stats});
    session=await sessionFor(request,env);
    await publicReadLimit(db,session);
    if(request.method==='POST'){
      if(env.SUPPORT_WRITES_ENABLED!=='true')fail(503,'support_unavailable','Support reports are temporarily paused. You can still reach us on Discord.');
      fields(data); // Reject malformed submissions before spending a write permit.
      permit=await admitWrite(db,supportEnvironment(env));
      return json(await receive(db,session,data),session,201);
    }
    return json(await review(request,env,db,session,url,data),session);
  }catch(error){
    if(error instanceof ApiError){
      const message=error.error==='community_read_only'?'Support reports are temporarily paused. You can still reach us on Discord.':error.message;
      return json({error:error.error,message},session,error.status);
    }
    // Never send or log report text, email addresses, database errors or secrets.
    return json({error:'support_unavailable',message:'Support is temporarily unavailable. Keep your report and try again, or contact us on Discord.'},session,503);
  }finally{
    if(permit){const settlement=settleWrite(database(context.env,{maxStatements:6}),permit,stats);context.waitUntil(settlement);await settlement;}
  }
}
