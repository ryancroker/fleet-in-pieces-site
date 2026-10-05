import {fail,json,keysOnly,textField,screenPublic,limits,pageOffset,IDEA_COLUMNS,IDEA_FROM,ideaJson} from './community.js';

const memberColumns=`p.id,p.callsign,r.label AS rank,p.created_at AS joined_at,p.introduction,
 s.id AS patron_id,s.callsign AS patron_callsign,
 (SELECT COUNT(*) FROM profiles child WHERE child.superior_id=p.id) AS direct_count,
 (SELECT COUNT(*)-1 FROM allegiance_paths a WHERE a.ancestor_id=p.id) AS subtree_count,
 COALESCE(l.mode,'closed') AS looking`;
const members=`FROM profiles p JOIN rank_definitions r ON r.id=p.rank_id LEFT JOIN profiles s ON s.id=p.superior_id
 LEFT JOIN recruitment_listings l ON l.profile_id=p.id AND EXISTS(SELECT 1 FROM ideas i WHERE i.id=l.idea_id AND i.hidden=0 AND i.merged_into IS NULL)`;
export const publicMember=row=>({id:row.id,callsign:row.callsign,rank:row.rank,path:'/u/'+row.id,introduction:row.introduction,
 joined_at:row.joined_at,direct_count:row.direct_count,subtree_count:row.subtree_count,looking:row.looking,
 patron:row.patron_id?{id:row.patron_id,callsign:row.patron_callsign,path:'/u/'+row.patron_id}:null});
function requireMember(session){if(!session.profileId)fail(401,'signin_required','Sign in to use your member record.');}
async function limit(db,session){await limits(db,session,[['social-edit',session.actor,12,3600],['social-edit-ip',session.ip,60,3600]]);}
const visibleNotice=`FROM notifications n LEFT JOIN profiles p ON p.id=n.actor_id
 LEFT JOIN ideas i ON i.id=n.idea_id LEFT JOIN content_objects c ON c.id=i.content_id
 LEFT JOIN replies reply ON reply.id=n.reply_id LEFT JOIN topic_proposals t ON t.id=n.topic_id
 WHERE n.recipient_id=? AND (n.kind='allegiance' OR
 (n.topic_id IS NOT NULL AND t.status='approved' AND EXISTS(SELECT 1 FROM content_objects tc WHERE tc.id='community-topic-'||t.id AND tc.is_public=1)) OR
 (i.hidden=0 AND c.is_public=1 AND (n.reply_id IS NULL OR reply.hidden=0) AND
 (i.merged_into IS NULL OR EXISTS(SELECT 1 FROM ideas root JOIN content_objects rc ON rc.id=root.content_id WHERE root.id=i.merged_into AND root.hidden=0 AND rc.is_public=1))))`;

export async function routeSocial({request,db,session,url,path,data,createPost}){
 if(path[0]!=='social')return null;
 const area=path[1];let value;
 if(request.method==='GET'&&path.length===2&&area==='conversations'){
  const rows=await db.prepare(`SELECT ${IDEA_COLUMNS} ${IDEA_FROM} WHERE i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1
   AND (i.contribution_type<>'recruitment' OR EXISTS(SELECT 1 FROM recruitment_listings l WHERE l.idea_id=i.id AND l.mode<>'closed'))
   ORDER BY MAX(i.updated_at,COALESCE(lr.created_at,'')) DESC,i.id DESC LIMIT 3`).bind(session.actor,session.actor).all();
  value={ideas:rows.results.map(row=>ideaJson(row)),has_more:false};
 }else if(request.method==='GET'&&path.length===2&&area==='people'){
  const search=(url.searchParams.get('search')||'').replace(/^@/,'').trim();
  if(search&&!/^[a-zA-Z0-9_-]{1,24}$/.test(search))fail(400,'invalid_search','Search by callsign.');
  const rows=await db.prepare(`SELECT ${memberColumns} ${members} WHERE instr(p.callsign_key,?)>0 ORDER BY p.created_at DESC,p.id LIMIT 25 OFFSET ?`).bind(search.toLowerCase(),pageOffset(url)).all();
  value={people:rows.results.slice(0,24).map(publicMember),has_more:rows.results.length>24};
 }else if(request.method==='POST'&&path.length===2&&area==='profile'){
  requireMember(session);keysOnly(data,['introduction']);const introduction=textField(data.introduction,'Introduction',0,280);screenPublic(introduction);await limit(db,session);
  await db.prepare('UPDATE profiles SET introduction=? WHERE id=?').bind(introduction,session.profileId).run();value={ok:true};
 }else if(request.method==='GET'&&area==='relationships'&&path.length===3){
  const id=path[2],offset=pageOffset(url),view=url.searchParams.get('view')||'branch';
  if(!['branch','fellows','chain'].includes(view))fail(400,'invalid_view','Choose a relationship view.');
  const filters={branch:'p.id IN (SELECT descendant_id FROM allegiance_paths WHERE ancestor_id=? AND depth>0)',chain:'p.id IN (SELECT ancestor_id FROM allegiance_paths WHERE descendant_id=? AND depth>0)',fellows:'p.superior_id=(SELECT superior_id FROM profiles WHERE id=?)'};
  const rows=await db.prepare(`SELECT ${memberColumns} ${members} WHERE ${filters[view]} AND p.id<>? ORDER BY ${view==='chain'?'(SELECT depth FROM allegiance_paths WHERE ancestor_id=p.id AND descendant_id=?) ASC,':''}p.created_at,p.id LIMIT 25 OFFSET ?`).bind(id,id,...(view==='chain'?[id]:[]),offset).all();
  value={people:rows.results.slice(0,24).map(publicMember),has_more:rows.results.length>24};
 }else if(request.method==='GET'&&path.length===2&&area==='recruitment'){
  const mode=url.searchParams.get('mode')||'recruiting';if(!['recruiting','seeking'].includes(mode))fail(400,'invalid_mode','Choose recruiting or seeking.');
  const profile=url.searchParams.get('profile');
  const rows=await db.prepare(`SELECT ${IDEA_COLUMNS},l.mode,l.newcomer_friendly,l.updated_at AS listing_updated_at,l.revision AS listing_revision ${IDEA_FROM} JOIN recruitment_listings l ON l.idea_id=i.id
    WHERE i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1 AND ${profile?'l.profile_id=?':"l.mode IN (?,'both')"}
    ORDER BY MAX(l.updated_at,COALESCE(lr.created_at,'')) DESC,l.newcomer_friendly DESC,i.id DESC LIMIT 13 OFFSET ?`).bind(session.actor,session.actor,profile||mode,pageOffset(url)).all();
  value={listings:rows.results.slice(0,12).map(row=>({idea:ideaJson(row),mode:row.mode,newcomer_friendly:!!row.newcomer_friendly,updated_at:row.listing_updated_at,revision:row.listing_revision})),has_more:rows.results.length>12};
 }else if(request.method==='POST'&&path.length===2&&area==='recruitment'){
  requireMember(session);keysOnly(data,['body','mode','newcomer_friendly','revision','request_id']);
  if(!['recruiting','seeking','both','closed'].includes(data.mode)||typeof data.newcomer_friendly!=='boolean'||!(data.revision===null||Number.isSafeInteger(data.revision)&&data.revision>=0))fail(400,'invalid_listing','Choose your listing preferences.');
  const body=textField(data.body,'Listing',8,2000);screenPublic(body);await limit(db,session);
  let current=await db.prepare('SELECT l.*,i.body,i.request_id,i.hidden,i.locked,i.merged_into,i.display_body,i.revision AS idea_revision FROM recruitment_listings l JOIN ideas i ON i.id=l.idea_id WHERE l.profile_id=?').bind(session.profileId).first();
  if(!current){
   if(data.revision!==null)fail(409,'listing_changed','Reload your listing before saving.');
   await createPost(db,session,{content_id:'social-recruitment',body,handle:'',website:'',request_id:data.request_id},null,{recruitment:true});
   current=await db.prepare('SELECT l.*,i.body,i.request_id,i.hidden,i.locked,i.merged_into,i.display_body,i.revision AS idea_revision FROM recruitment_listings l JOIN ideas i ON i.id=l.idea_id WHERE l.profile_id=?').bind(session.profileId).first();
  }
  if(current.hidden||current.locked||current.merged_into||current.display_body)fail(409,'listing_moderated','This listing is under moderation. Contact Fleet Command in a public discussion.');
  // A lost create response can be retried without creating a second discussion.
  if(data.revision===null&&current.request_id!==data.request_id||data.revision!==null&&current.revision!==data.revision)fail(409,'listing_changed','Your listing changed. Reload it before saving.');
  if(data.revision===null&&current.revision>0){
   if(current.body===body&&current.mode===data.mode&&!!current.newcomer_friendly===data.newcomer_friendly)return json({ok:true,idea_id:current.idea_id,revision:current.revision},session);
   fail(409,'listing_changed','This listing has already been edited. Reload it before saving.');
  }
  const now=new Date().toISOString();
  const result=await db.batch([
   db.prepare(`UPDATE recruitment_listings SET mode=?,newcomer_friendly=?,updated_at=?,revision=revision+1 WHERE profile_id=? AND revision=? AND EXISTS(SELECT 1 FROM ideas i WHERE i.id=recruitment_listings.idea_id AND i.revision=? AND i.hidden=0 AND i.locked=0 AND i.merged_into IS NULL AND trim(i.display_body)='') RETURNING idea_id,revision`).bind(data.mode,data.newcomer_friendly?1:0,now,session.profileId,current.revision,current.idea_revision),
   db.prepare('UPDATE ideas SET body=?,updated_at=?,revision=revision+1 WHERE id=? AND changes()=1 AND hidden=0 AND locked=0 AND merged_into IS NULL').bind(body,now,current.idea_id)
  ]);
  if(!result[0].results.length)fail(409,'listing_changed','Your listing changed. Reload it before saving.');value={ok:true,idea_id:current.idea_id,revision:result[0].results[0].revision};
 }else if(request.method==='GET'&&path.length===2&&area==='notifications'){
  requireMember(session);
  const [rows,count]=await db.batch([
   db.prepare(`SELECT n.id,n.kind,n.created_at,n.read_at,
    CASE WHEN n.kind IN ('update','topic') OR reply.is_developer=1 OR (n.reply_id IS NULL AND i.is_developer=1)
     THEN 'Fleet Command' ELSE COALESCE(p.callsign,'A crew member') END AS actor_label,
    n.actor_id,n.idea_id,n.reply_id,n.topic_id,c.title,COALESCE(i.merged_into,i.id) AS destination ${visibleNotice} ORDER BY n.id DESC LIMIT 25 OFFSET ?`).bind(session.profileId,pageOffset(url)),
   db.prepare(`SELECT COUNT(*) AS unread ${visibleNotice} AND n.read_at IS NULL`).bind(session.profileId)
  ]);
  value={notifications:rows.results.slice(0,24).map(row=>({id:row.id,kind:row.kind,created_at:row.created_at,read:!!row.read_at,actor:row.actor_label,title:row.title||'',path:row.kind==='allegiance'?'/u/'+row.actor_id:row.topic_id?'/topics/'+row.topic_id:'/i/'+row.destination+(row.reply_id?'#replies-'+row.destination:'')})),has_more:rows.results.length>24,unread:count.results[0].unread};
 }else if(request.method==='POST'&&path.length===3&&area==='notifications'&&path[2]==='read'){
  requireMember(session);keysOnly(data,['through_id']);if(!Number.isSafeInteger(data.through_id)||data.through_id<1)fail(400,'invalid_notice','Choose a notification.');
  await limits(db,session,[['notice-read',session.actor,30,60]]);
  await db.prepare('UPDATE notifications SET read_at=? WHERE recipient_id=? AND id<=? AND read_at IS NULL').bind(new Date().toISOString(),session.profileId,data.through_id).run();value={ok:true};
 }else fail(404,'not_found','That community destination was not found.');
 return json(value,session);
}
