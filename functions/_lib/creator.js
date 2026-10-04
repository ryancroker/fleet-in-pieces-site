import {authorizeAdmin,contentFor,digest,fail,getIdea,IDEA_COLUMNS,IDEA_FROM,ideaJson,keysOnly,limits,PAGE_SIZE,pageOffset,paginate,positiveId,publicReadLimit,REPLY_COLUMNS,REPLY_FROM,replyJson,textField} from './community.js';
import {dashboard} from './dashboard.js';
import {creatorTopics} from './topics.js';

export const DECISIONS = Object.freeze({
 open:{status:'new',label:'OPEN'},under_review:{status:'reviewing',label:'UNDER REVIEW'},
 planned:{status:'planned',label:'PLANNED'},prototyping:{status:'building',label:'PROTOTYPING'},
 implemented:{status:'implemented',label:'IMPLEMENTED FROM FEEDBACK'},
 already_in_game:{status:'reviewing',label:'ALREADY IN GAME'},
 not_planned:{status:'declined',label:'NOT PLANNED'},duplicate:{status:'declined',label:'DUPLICATE'},
 superseded:{status:'declined',label:'SUPERSEDED'}
});
function cookieInfo(request) {
 const url=new URL(request.url),secure=url.protocol==='https:';
 const allowed=url.hostname==='fleetinpieces.space'||['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 const name=secure?'__Host-fip_creator':'fip_creator_local';
 const token=(request.headers.get('Cookie')||'').slice(0,8192).split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
 return {allowed,name,token,secure};
}
function setCookie(request,session,token,age) {
 const {name,secure}=cookieInfo(request);
 (session.cookies||=[]).push(`${name}=${token}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Strict${secure?'; Secure':''}`);
}
export async function creatorSession(request,env,db,session) {
 const info=cookieInfo(request);
 if(!info.allowed||!/^[a-f0-9]{64}$/.test(info.token)||typeof env.COMMUNITY_ADMIN_KEY!=='string')return null;
 const hash=await digest(session.key,'creator:'+info.token),version=await digest(session.key,'creator-key:'+env.COMMUNITY_ADMIN_KEY);
 return db.prepare('SELECT token_hash,key_version,expires_at FROM creator_sessions WHERE token_hash=? AND key_version=? AND expires_at>?').bind(hash,version,session.now).first();
}
function presenceState(active,timestamp) {
 // Keep the legacy response field for cached clients. The stored timestamp now
 // means last authenticated activity, not only the last code-entry event.
 return {authorized:Boolean(active),expires_at:active?new Date(active.expires_at*1000).toISOString():null,last_developer_activity:timestamp||null,last_developer_login:timestamp||null};
}
async function authorize(request,env,db,session) {
 if(!cookieInfo(request).allowed)fail(403,'creator_host','Use https://fleetinpieces.space/crew for developer access.');
 if(await creatorSession(request,env,db,session)) {
  await limits(db,session,[['admin',session.actor,120,60],['admin-ip',session.ip,300,60]]);return;
 }
 await authorizeAdmin(request,env,db,session);
}
function currentDecision(row) {
 return row.decision_key||({new:'open',reviewing:'under_review',planned:'planned',building:'prototyping',implemented:'implemented',declined:'not_planned'}[row.status]);
}
function bool(value,name){if(typeof value!=='boolean')fail(400,'invalid_field',`${name} must be on or off.`);return value?1:0;}
function evidence(value) {
 if(!Array.isArray(value)||value.length>3)fail(400,'invalid_links','Use up to three supporting links.');
 return value.map(item=>{
  if(!item||typeof item!=='object')fail(400,'invalid_links','Enter a link and label.');
  keysOnly(item,['url','label']);const label=textField(item.label,'Link label',1,80,false),raw=textField(item.url,'Link',1,1000,false);
  let url;try{url=new URL(raw,'https://fleetinpieces.space');}catch{fail(400,'invalid_links','Use a valid HTTPS link.');}
  if(url.protocol!=='https:'||url.username||url.password||(!raw.startsWith('https://')&&!/^\/(?!\/)/.test(raw)))fail(400,'invalid_links','Use a game-site path or an HTTPS link.');
  return {label,url:url.origin==='https://fleetinpieces.space'?url.pathname+url.search+url.hash:url.href};
 });
}
async function history(db,id,admin=false) {
 const {results}=await db.prepare('SELECT id,reply_id,action,before_json,after_json,created_at FROM moderation_events WHERE idea_id=? ORDER BY id DESC LIMIT 50').bind(id).all();
 return results.map(row=>{
  const before=JSON.parse(row.before_json),after=JSON.parse(row.after_json),changes=[];
  if(before.label!==after.label)changes.push(after.label||'OPEN');
  if(before.response!==after.response)changes.push('Developer note updated');
  if(before.content_id!==after.content_id)changes.push('Moved to another briefing');
  if(before.body!==after.body||before.title!==after.title)changes.push('Formatting clarified; original retained');
  if(before.locked!==after.locked)changes.push(after.locked?'Replies locked':'Replies reopened');
  if(before.pinned!==after.pinned)changes.push(after.pinned?'Pinned by Fleet Command':'Unpinned');
  if(before.merged_into!==after.merged_into)changes.push('Duplicate discussion consolidated');
  if(row.action==='promoted')changes.push('Reply promoted to a suggestion');
  if(before.hidden!==after.hidden)changes.push('Visibility changed');
  return {id:row.id,reply_id:row.reply_id,created_at:row.created_at,summary:changes.join(' · ')||'Developer update',...(admin?{before,after}:{})};
 });
}
export async function publicHistory(db,id,actor) {await getIdea(db,id,actor);return {history:await history(db,id)};}

async function updateIdea(db,session,id,data) {
 keysOnly(data,['revision','decision_key','status_key','status','status_label','developer_response','hidden','pinned','locked','content_id','related_idea_id','merge','display_title','display_body','edit_note','build_label','release_date','evidence']);
 const old=await db.prepare('SELECT * FROM ideas WHERE id=?').bind(id).first();if(!old)fail(404,'not_found','That idea is unavailable.');
 if('revision' in data&&data.revision!==old.revision)fail(409,'stale_edit','This idea changed while you were editing. Reopen its controls to review the latest version.');
 const next={...old};
 // Keep old cached crew clients usable, without allowing labels to bypass decisions.
 let decision=data.decision_key;
 if(decision===undefined&&data.status_key!==undefined)decision=({submitted:'open',popular:'open',looking:'under_review',no:'not_planned',breaks_everything:'not_planned',technically_possible:'under_review'}[data.status_key]||data.status_key);
 if(decision===undefined&&data.status!==undefined)decision=({new:'open',reviewing:'under_review',planned:'planned',building:'prototyping',implemented:'implemented',declined:'not_planned'}[data.status]);
 if(('status_key' in data||'status' in data)&&!decision)fail(400,'invalid_status','Choose a supported decision.');
 if(decision!==undefined){if(!Object.hasOwn(DECISIONS,decision))fail(400,'invalid_status','Choose a supported decision.');next.decision_key=decision;next.status=DECISIONS[decision].status;next.status_label=DECISIONS[decision].label;}
 else if('status_label' in data)fail(400,'invalid_status','Choose a decision instead of a custom status label.');
 for(const key of ['hidden','pinned','locked'])if(key in data)next[key]=bool(data[key],key);
 for(const [key,max] of [['developer_response',2000],['display_title',120],['display_body',2000],['edit_note',300],['build_label',80],['release_date',10]])if(key in data)next[key]=textField(data[key],key.replaceAll('_',' '),0,max,!['display_title','build_label','release_date'].includes(key));
 if(next.display_body&&[...next.display_body].length<8)fail(400,'invalid_text','A clarified idea must still contain at least 8 characters.');
 if((next.display_body!==old.display_body||next.display_title!==old.display_title)&&!next.edit_note)fail(400,'edit_note_required','Explain the formatting clarification. The original stays visible.');
 if((next.display_body||next.display_title)&&!next.edit_note)fail(400,'edit_note_required','Keep a note with the formatting clarification.');
 const date=new Date(next.release_date+'T00:00:00Z');
 if(next.release_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(next.release_date)||Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==next.release_date))fail(400,'invalid_date','Use a valid date in YYYY-MM-DD format.');
 if('evidence' in data)next.evidence_json=JSON.stringify(evidence(data.evidence));
 if('content_id' in data)next.content_id=(await contentFor(db,{content_id:data.content_id})).id;
 if('related_idea_id' in data)next.related_idea_id=data.related_idea_id===null?null:positiveId(data.related_idea_id);
 if(next.related_idea_id){if(next.related_idea_id===id)fail(400,'invalid_link','Choose another idea.');await getIdea(db,next.related_idea_id,session.actor);}
 if(['duplicate','superseded'].includes(next.decision_key)&&!next.related_idea_id)fail(400,'related_required','Link the duplicate or newer idea.');
 const outcome=currentDecision(next);
 if((decision!==undefined||'developer_response' in data)&&['implemented','already_in_game'].includes(outcome)&&!next.developer_response.trim())fail(400,'note_required','Add a developer note explaining what changed from feedback or what was already in the game.');
 if(data.merge!==undefined&&typeof data.merge!=='boolean')fail(400,'invalid_merge','Choose whether to consolidate this duplicate.');
 if(data.merge){
  if(old.merged_into)fail(409,'already_merged','This idea is already consolidated. Its original record remains here.');
  if(next.decision_key!=='duplicate'||!next.related_idea_id||next.hidden)fail(400,'invalid_merge','Choose Duplicate, a visible target idea and keep the source visible before merging.');
  const target=await getIdea(db,next.related_idea_id,session.actor);if(target.merged_into)fail(409,'invalid_merge','Choose the final destination idea, not another duplicate.');
  next.merged_into=next.related_idea_id;next.locked=1;next.pinned=0;
 }
 if(old.merged_into&&(next.decision_key!=='duplicate'||next.related_idea_id!==old.merged_into||!next.locked))fail(409,'merged_record','A consolidated source stays linked and closed. Manage the destination for further discussion.');
 const columns=['status','status_label','decision_key','developer_response','hidden','pinned','locked','content_id','related_idea_id','merged_into','display_title','display_body','edit_note','build_label','release_date','evidence_json'];
 const changed=columns.filter(k=>next[k]!==old[k]);
 if(!changed.length)return {ok:true,idea:await getIdea(db,id,session.actor,true)};
 const now=new Date().toISOString();
 const decisionChange=['status','status_label','decision_key','developer_response','build_label','release_date','evidence_json'].some(k=>changed.includes(k));
 let result;
 try{
  result=await db.prepare(`UPDATE ideas SET ${changed.map(k=>k+'=?').join(',')},revision=revision+1,updated_at=?,command_at=?,implemented_at=? WHERE id=? AND revision=? RETURNING id`)
   .bind(...changed.map(k=>next[k]),now,decisionChange?now:old.command_at,next.decision_key==='implemented'?(old.implemented_at||now):old.implemented_at,id,old.revision).first();
 }catch(error){if(String(error.message).includes('invalid_merge_target'))fail(409,'invalid_merge','The target changed or this merge would create a loop. Refresh the ideas.');if(String(error.message).includes('merge_capacity'))fail(409,'merge_capacity','A combined discussion supports up to 50 original suggestions.');throw error;}
 if(!result)fail(409,'stale_edit','Another update arrived first. Reopen the controls and review it.');
 return {ok:true,idea:await getIdea(db,id,session.actor,true)};
}
async function updateReply(db,id,data) {
 keysOnly(data,['revision','hidden','display_body','edit_note']);
 const old=await db.prepare('SELECT * FROM replies WHERE id=?').bind(id).first();if(!old)fail(404,'not_found','That reply is unavailable.');
 if('revision' in data&&data.revision!==old.revision)fail(409,'stale_edit','That reply changed. Reopen its controls.');
 const next={...old};if('hidden'in data)next.hidden=bool(data.hidden,'hidden');
 for(const [k,max] of [['display_body',1500],['edit_note',300]])if(k in data)next[k]=textField(data[k],k,0,max);
 if((next.display_body!==old.display_body||next.display_body)&&!next.edit_note)fail(400,'edit_note_required','Explain the formatting clarification. The original stays visible.');
 if(next.display_body===old.display_body&&next.edit_note===old.edit_note&&next.hidden===old.hidden)return {ok:true};
 const result=await db.prepare('UPDATE replies SET hidden=?,display_body=?,edit_note=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id').bind(next.hidden,next.display_body,next.edit_note,new Date().toISOString(),id,old.revision).first();
 if(!result)fail(409,'stale_edit','That reply changed. Reopen its controls.');return {ok:true};
}
async function promote(db,session,id,data) {
 keysOnly(data,['content_id']);
 const old=await db.prepare('SELECT id FROM ideas WHERE source_reply_id=?').bind(id).first();if(old)return {ok:true,idea:await getIdea(db,old.id,session.actor,true)};
 const reply=await db.prepare('SELECT r.*,i.content_id FROM replies r JOIN ideas i ON i.id=r.idea_id WHERE r.id=? AND r.hidden=0 AND i.hidden=0').bind(id).first();
 if(!reply)fail(404,'not_found','That public reply is unavailable.');
 if([...reply.body].length<8)fail(400,'too_short','A suggestion needs at least 8 characters. This reply remains in its discussion.');
 const content=(await contentFor(db,{content_id:data.content_id||reply.content_id})).id,now=new Date().toISOString();
 await db.batch([
  db.prepare(`INSERT INTO ideas(system,content_id,body,handle,actor_hash,profile_id,request_id,content_hash,created_at,updated_at,source_reply_id,decision_key,status_label)
   SELECT 'missiles',?,r.body,r.handle,r.actor_hash,r.profile_id,?,r.content_hash,?,?,r.id,'open','OPEN' FROM replies r JOIN ideas i ON i.id=r.idea_id WHERE r.id=? AND r.hidden=0 AND i.hidden=0 ON CONFLICT(source_reply_id) WHERE source_reply_id IS NOT NULL DO NOTHING`)
   .bind(content,'promoted-reply:'+id,now,now,id),
  db.prepare(`INSERT INTO moderation_events(idea_id,reply_id,action,before_json,after_json,created_at)
   SELECT id,?,'promoted','{}',json_object('source_reply_id',?),? FROM ideas WHERE source_reply_id=? AND NOT EXISTS(SELECT 1 FROM moderation_events WHERE idea_id=ideas.id AND action='promoted')`).bind(id,id,now,id)
 ]);
 const row=await db.prepare('SELECT id FROM ideas WHERE source_reply_id=?').bind(id).first();if(!row)fail(409,'reply_changed','The reply changed before promotion. Refresh it.');
 return {ok:true,idea:await getIdea(db,row.id,session.actor,true)};
}

export async function routeCreator(request,env,db,session,url,path,data) {
 if(path[1]==='presence'&&path.length===2&&request.method==='POST'){
  keysOnly(data,[]);
  const active=await creatorSession(request,env,db,session);
  if(!active)fail(401,'creator_session_required','Sign in as the developer to check in.');
  await limits(db,session,[['creator-presence',session.actor,10,60],['creator-presence-ip',session.ip,30,60]]);
  const now=new Date(session.now*1000).toISOString(),cutoff=new Date((session.now-60)*1000).toISOString();
  // Guard the write as well as the request: a revoked session cannot check in.
  // At most one update per minute across tabs; clients never supply the time.
  await db.prepare(`UPDATE developer_presence SET last_login_at=? WHERE id=1
   AND (last_login_at IS NULL OR last_login_at<=?)
   AND EXISTS(SELECT 1 FROM creator_sessions WHERE token_hash=? AND key_version=? AND expires_at>?)`)
   .bind(now,cutoff,active.token_hash,active.key_version,session.now).run();
  const presence=await db.prepare('SELECT last_login_at FROM developer_presence WHERE id=1').first();
  return presenceState(active,presence?.last_login_at);
 }
 if(path[1]==='session'&&path.length===2){
  if(request.method==='GET'){
   await publicReadLimit(db,session);
   const active=await creatorSession(request,env,db,session),presence=await db.prepare('SELECT last_login_at FROM developer_presence WHERE id=1').first();
   return presenceState(active,presence?.last_login_at);
  }
  if(request.method==='POST'){
   keysOnly(data,['logout','remember']);
   if(data.remember!==undefined)bool(data.remember,'Keep me signed in');
   if(data.logout===true){
    const {token}=cookieInfo(request);if(token)await db.prepare('DELETE FROM creator_sessions WHERE token_hash=?').bind(await digest(session.key,'creator:'+token)).run();
    setCookie(request,session,'',0);return {authorized:false};
   }
   if(!cookieInfo(request).allowed)fail(403,'creator_host','Open https://fleetinpieces.space/crew to unlock.');
   await authorizeAdmin(request,env,db,session);
   const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const loginAt=new Date(session.now*1000).toISOString(),lifetime=data.remember===true?30*86400:28800;
   await db.batch([db.prepare('DELETE FROM creator_sessions WHERE expires_at<=?').bind(session.now),db.prepare('INSERT INTO creator_sessions(token_hash,key_version,expires_at) VALUES(?,?,?)').bind(await digest(session.key,'creator:'+token),await digest(session.key,'creator-key:'+env.COMMUNITY_ADMIN_KEY),session.now+lifetime),
    db.prepare('UPDATE developer_presence SET last_login_at=? WHERE id=1 AND (last_login_at IS NULL OR last_login_at<?)').bind(loginAt,loginAt)]);
   setCookie(request,session,token,lifetime);return presenceState({expires_at:session.now+lifetime},loginAt);
  }
 }
 await authorize(request,env,db,session);
 if(request.method==='GET'&&path[1]==='dashboard'&&path.length===2)return dashboard(db,url);
 if(path[1]==='topics')return creatorTopics(db,url,path,request.method,data);
 if(request.method==='GET'&&path.length===1){
  const view=url.searchParams.get('view')||'new',offset=pageOffset(url);
  if(view==='reports'){
   const {results}=await db.prepare(`SELECT p.id,p.target_type,p.target_id,p.idea_id,p.reason,p.detail,p.created_at,CASE WHEN p.target_type='idea' THEN i.body ELSE r.body END AS target_body,CASE WHEN p.target_type='idea' THEN i.handle ELSE r.handle END AS target_handle FROM reports p LEFT JOIN ideas i ON i.id=p.idea_id LEFT JOIN replies r ON p.target_type='reply' AND r.id=p.target_id WHERE p.resolved_at IS NULL ORDER BY p.id DESC LIMIT ? OFFSET ?`).bind(PAGE_SIZE+1,offset).all();const page=paginate(results);return {reports:page.rows,has_more:page.has_more};
  }
  const where={ideas:'1=1',new:"i.decision_key IS NULL AND i.status='new' OR i.decision_key='open'",popular:'i.hidden=0 AND i.merged_into IS NULL',needs_response:"i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1 AND trim(i.developer_response)=''",under_review:"i.decision_key='under_review' OR (i.decision_key IS NULL AND i.status='reviewing')",planned:"i.status='planned' OR i.status='building'",implemented:"i.decision_key='implemented'",already_in_game:"i.decision_key='already_in_game'",legacy:"i.status='implemented' AND i.decision_key IS NULL"}[view];
  if(!where)fail(400,'invalid_view','Choose an inbox view.');
  const {results}=await db.prepare(`SELECT ${IDEA_COLUMNS},i.hidden ${IDEA_FROM} WHERE (${where}) ORDER BY ${view==='popular'?'votes DESC,':''}i.id DESC LIMIT ? OFFSET ?`).bind(session.actor,session.actor,PAGE_SIZE+1,offset).all();const page=paginate(results);return {ideas:page.rows.map(r=>ideaJson(r,true)),has_more:page.has_more};
 }
 if(path[1]==='ideas'&&path.length===3){
  const id=positiveId(path[2]);
  if(request.method==='PATCH')return updateIdea(db,session,id,data);
  if(request.method==='GET'){
   const idea=await getIdea(db,id,session.actor,true);
   const {results}=await db.prepare(`SELECT ${REPLY_COLUMNS},r.hidden,r.updated_at ${REPLY_FROM} WHERE (r.idea_id=? OR i.merged_into=?) ORDER BY r.id ASC LIMIT ? OFFSET ?`).bind(id,id,PAGE_SIZE+1,pageOffset(url)).all();const page=paginate(results);
   return {idea,replies:page.rows.map(r=>replyJson(r,true)),has_more:page.has_more,history:await history(db,id,true),decisions:DECISIONS};
  }
 }
 if(path[1]==='replies'&&path.length===3){
  if(request.method==='PATCH')return updateReply(db,positiveId(path[2]),data);
  if(request.method==='GET'){
   const row=await db.prepare(`SELECT ${REPLY_COLUMNS},r.hidden,r.updated_at,i.content_id ${REPLY_FROM} WHERE r.id=?`).bind(positiveId(path[2])).first();
   if(!row)fail(404,'not_found','That reply is unavailable.');return {reply:{...replyJson(row,true),content_id:row.content_id}};
  }
 }
 if(path[1]==='replies'&&path.length===4&&path[3]==='promote'&&request.method==='POST')return promote(db,session,positiveId(path[2]),data);
 if(path[1]==='reports'&&path.length===3&&request.method==='PATCH'){
  keysOnly(data,['resolved']);if(data.resolved!==true)fail(400,'invalid_resolution','Choose resolve.');
  const row=await db.prepare('UPDATE reports SET resolved_at=COALESCE(resolved_at,?) WHERE id=? RETURNING id').bind(new Date().toISOString(),positiveId(path[2])).first();if(!row)fail(404,'not_found','That report is unavailable.');return {ok:true};
 }
 fail(404,'not_found','That creator action is unavailable.');
}
