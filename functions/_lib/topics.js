import {fail,keysOnly,textField,screenPublic,postFields,contentHash,writeLimit,positiveId,pageOffset,paginate,PAGE_SIZE} from './community.js';

export function topicCredit(row){return {name:row.credit_callsign||row.credit_handle||'Anonymous crew',path:row.credit_profile?'/u/'+row.credit_profile:null};}
export const TOPIC_CREDIT_COLUMNS='t.id AS proposal_id,t.handle AS credit_handle,p.id AS credit_profile,p.callsign AS credit_callsign,t.acknowledgement,t.developer_response AS topic_response,t.responded_at';
export const TOPIC_CREDIT_JOIN="LEFT JOIN topic_proposals t ON c.id='community-topic-'||t.id AND t.status='approved' LEFT JOIN profiles p ON p.id=t.profile_id";

export async function proposeTopic(db,session,data){
 keysOnly(data,['title','body','handle','request_id','website']);
 const title=textField(data.title,'Topic title',3,100,false);screenPublic(title);
 const fields=postFields({body:data.body,handle:data.handle??'',request_id:data.request_id,website:data.website});
 const prior=await db.prepare('SELECT id,title,body,handle FROM topic_proposals WHERE actor_hash=? AND request_id=?').bind(session.actor,fields.requestId).first();
 if(prior){if(prior.title!==title||prior.body!==fields.body||prior.handle!==fields.handle)fail(409,'request_reused','That submission was already sent. Start another proposal.');return {ok:true,proposal_id:prior.id};}
 const hash=await contentHash(session,title+'\n'+fields.body);await writeLimit(db,session,'topic',hash);
 const now=new Date().toISOString(),since=new Date(Date.now()-120000).toISOString();
 const row=await db.prepare(`INSERT INTO topic_proposals(title,body,handle,profile_id,actor_hash,request_id,content_hash,created_at)
 SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM topic_proposals WHERE actor_hash=? AND content_hash=? AND created_at>?)
 ON CONFLICT(actor_hash,request_id) DO NOTHING RETURNING id`).bind(title,fields.body,fields.handle,session.profileId||null,session.actor,fields.requestId,hash,now,session.actor,hash,since).first();
 const confirmed=row||await db.prepare('SELECT id FROM topic_proposals WHERE actor_hash=? AND request_id=?').bind(session.actor,fields.requestId).first();
 if(!confirmed)fail(409,'repeat_proposal','That topic was just proposed. It is waiting for Fleet Command.');
 return {ok:true,proposal_id:confirmed.id};
}

export async function creatorTopics(db,url,path,method,data){
 if(method==='GET'&&path.length===2){
  const status=url.searchParams.get('status')||'pending';if(!['pending','approved','declined'].includes(status))fail(400,'invalid_view','Choose a proposal view.');
  const {results}=await db.prepare(`SELECT t.id,t.title,t.body,t.handle,t.status,t.published_title,t.published_summary,t.created_at,t.reviewed_at,t.revision,t.acknowledgement,t.developer_response,t.responded_at,p.id AS credit_profile,p.callsign AS credit_callsign,t.handle AS credit_handle FROM topic_proposals t LEFT JOIN profiles p ON p.id=t.profile_id WHERE t.status=? ORDER BY t.id DESC LIMIT ? OFFSET ?`).bind(status,PAGE_SIZE+1,pageOffset(url)).all();
  const page=paginate(results);return {proposals:page.rows.map(row=>({...row,credit:topicCredit(row),path:row.status==='approved'?'/topics/'+row.id:null})),has_more:page.has_more};
 }
 if(method==='PATCH'&&path.length===3){
  keysOnly(data,['revision','status','title','summary','acknowledgement','developer_response']);const id=positiveId(path[2]);
  if(!['approved','declined'].includes(data.status))fail(400,'invalid_decision','Choose publish or decline.');
  const old=await db.prepare('SELECT * FROM topic_proposals WHERE id=?').bind(id).first();if(!old)fail(404,'not_found','That proposal is unavailable.');
  if(old.status==='approved'&&data.status!=='approved')fail(409,'already_published','This topic has already been published. Its discussion stays available.');
  if(data.revision!==old.revision)fail(409,'stale_edit','This proposal changed. Refresh before reviewing it.');
  const title=data.status==='approved'?textField(data.title,'Published title',3,100,false):'',summary=data.status==='approved'?textField(data.summary,'Topic introduction',8,2000):'';
  const acknowledgement=data.status==='approved'?(data.acknowledgement??old.acknowledgement):'';
  if(!['','already_in_game'].includes(acknowledgement))fail(400,'invalid_acknowledgement','Choose open discussion or already in the game.');
  const response=data.status==='approved'?textField(data.developer_response??old.developer_response,'Developer reply',acknowledgement?8:0,2000):'';
  const now=new Date().toISOString(),changed=response!==old.developer_response||acknowledgement!==old.acknowledgement;
  const responded=response?(changed?now:old.responded_at):null,first=response?(old.first_responded_at||now):old.first_responded_at;
  const result=await db.prepare('UPDATE topic_proposals SET status=?,published_title=?,published_summary=?,reviewed_at=?,acknowledgement=?,developer_response=?,responded_at=?,first_responded_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id')
   .bind(data.status,title,summary,old.status==='approved'?old.reviewed_at:now,acknowledgement,response,responded,first,id,old.revision).first();
  if(!result)fail(409,'stale_edit','Another review arrived first. Refresh the inbox.');
  return {ok:true,path:data.status==='approved'?'/topics/'+id:null};
 }
 fail(404,'not_found','That topic action is unavailable.');
}
