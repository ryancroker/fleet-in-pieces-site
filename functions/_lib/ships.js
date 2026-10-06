import editions from '../_data/ship-editions.js';
import {fail,keysOnly,textField,positiveId,pageOffset,limits,IDEA_COLUMNS,IDEA_FROM,ideaJson} from './community.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const stamp=()=>new Date().toISOString();
const shipFor=key=>{if(!Object.hasOwn(editions.ships,key||''))fail(404,'not_found','That ship is not in the published register.');return editions.ships[key];};
const revFor=(key,id)=>{const r=editions.revisions[id];if(!r||r.ship_key!==key)fail(422,'wrong_edition','Choose a matching ship edition.');return r;};
const eventVisible=`(e.idea_id IS NULL OR (i.hidden=0 AND (i.merged_into IS NULL OR EXISTS(SELECT 1 FROM ideas root JOIN content_objects rc ON rc.id=root.content_id WHERE root.id=i.merged_into AND root.hidden=0 AND rc.is_public=1))))`;
const eventFrom=`FROM ship_design_events e JOIN ship_designs s ON s.ship_key=e.ship_key JOIN content_objects c ON c.id=s.content_id LEFT JOIN profiles p ON p.id=e.profile_id LEFT JOIN ideas i ON i.id=e.idea_id`;
const eventColumns='e.id,e.ship_key,e.kind,e.payload_json,e.profile_id,e.idea_id,e.created_at,p.callsign,c.title,c.path';
const eventJson=r=>({id:r.id,ship_key:r.ship_key,kind:r.kind,...JSON.parse(r.payload_json),profile:r.profile_id?{id:r.profile_id,callsign:r.callsign,path:'/u/'+r.profile_id}:null,idea_id:r.idea_id,created_at:r.created_at,ship_title:r.title,ship_path:r.path});
export async function shipAnchor(db,contentId,data){
 if(!contentId.startsWith('ship-design-')){if(data.ship_revision_id!=null||data.ship_section_key!=null)fail(422,'wrong_context','Ship context belongs on a ship discussion.');return {revision:null,section:null};}
 const section=data.ship_section_key||null;
 if(section!==null&&!Object.hasOwn(editions.sections,section))fail(422,'invalid_section','Choose a ship section.');
 if(typeof data.ship_revision_id!=='string'||!/^fr1-[a-f0-9]{64}$/.test(data.ship_revision_id))fail(422,'edition_required','Open the ship page to choose an edition before posting.');
 const row=await db.prepare('SELECT r.revision_id FROM ship_revisions r JOIN ship_designs s ON s.ship_key=r.ship_key WHERE s.content_id=? AND r.revision_id=?').bind(contentId,data.ship_revision_id).first();
 if(!row)fail(409,'unpublished_edition','This edition is not open for discussion yet. Your draft is saved.');
 return {revision:row.revision_id,section};
}
export async function publicShips({request,db,session,url,path,data}){
 if(path[0]!=='ship-designs')return null;
 if(request.method==='GET'&&path.length===1){
  const key=url.searchParams.get('ship')||'',following=url.searchParams.get('following')==='1';if(key)shipFor(key);
  if(following&&!session.profileId)fail(401,'signin_required','Sign in to see the ships you follow.');
  const args=[session.actor,session.actor];let where='';
  if(key){where+=' AND s.ship_key=?';args.push(key);}
  if(following){where+=' AND EXISTS(SELECT 1 FROM ship_follows f WHERE f.ship_key=s.ship_key AND f.profile_id=?)';args.push(session.profileId);}
  args.push(13,pageOffset(url));
  const {results}=await db.prepare(`SELECT ${IDEA_COLUMNS} ${IDEA_FROM} JOIN ship_designs s ON s.content_id=i.content_id WHERE i.hidden=0 AND i.merged_into IS NULL AND c.is_public=1${where} ORDER BY MAX(i.created_at,COALESCE(i.command_at,i.created_at),COALESCE(lr.created_at,i.created_at)) DESC,i.id DESC LIMIT ? OFFSET ?`).bind(...args).all();
  return {ideas:results.slice(0,12).map(r=>ideaJson(r)),has_more:results.length>12};
 }
 if(request.method==='GET'&&path[1]==='contributions'&&path.length===3){
  if(!uuid.test(path[2]))fail(400,'invalid_profile','Choose a Fleet profile.');
  const {results}=await db.prepare(`SELECT ${eventColumns} ${eventFrom} WHERE e.profile_id=? AND e.kind IN ('credit','lead') AND c.is_public=1 AND ${eventVisible} ORDER BY e.created_at DESC,e.id DESC LIMIT 21 OFFSET ?`).bind(path[2],pageOffset(url)).all();
  return {events:results.slice(0,20).map(eventJson),has_more:results.length>20};
 }
 if(path.length<2||path.length>3)return null;
 const ship=shipFor(path[1]);
 const current=await db.prepare('SELECT s.* FROM ship_designs s JOIN content_objects c ON c.id=s.content_id WHERE s.ship_key=? AND c.is_public=1').bind(ship.key).first();
 if(!current)fail(404,'unpublished_ship','This dossier is available to inspect. Discussion opens when Fleet Command publishes it.');
 if(request.method==='POST'&&path[2]==='follow'){
  keysOnly(data,['following']);if(typeof data.following!=='boolean')fail(422,'invalid_follow','Choose follow or unfollow.');
  if(!session.profileId)fail(401,'signin_required','Sign in to follow ships. You can discuss them without an account.');
  await limits(db,session,[['ship-follow',session.actor,12,60],['ship-follow-ip',session.ip,60,60],['ship-follow-day',session.actor,200,86400]]);
  if(data.following)await db.prepare('INSERT INTO ship_follows(profile_id,ship_key,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(session.profileId,ship.key,stamp()).run();
  else await db.prepare('DELETE FROM ship_follows WHERE profile_id=? AND ship_key=?').bind(session.profileId,ship.key).run();
  return {following:data.following};
 }
 if(request.method!=='GET'||path.length!==2)return null;
 if(url.searchParams.has('event')){
  const id=url.searchParams.get('event');if(!uuid.test(id))fail(400,'invalid_record','Choose a design record.');
  const row=await db.prepare(`SELECT ${eventColumns} ${eventFrom} WHERE e.id=? AND e.ship_key=? AND c.is_public=1 AND ${eventVisible}`).bind(id,ship.key).first();
  if(!row)fail(404,'not_found','That design record is unavailable.');return {event:eventJson(row)};
 }
 const {results}=await db.prepare(`SELECT ${eventColumns} ${eventFrom} WHERE e.ship_key=? AND c.is_public=1 AND ${eventVisible} ORDER BY e.created_at DESC,e.id DESC LIMIT 21 OFFSET ?`).bind(ship.key,pageOffset(url)).all();
 const lead=await db.prepare(`SELECT ${eventColumns} ${eventFrom} WHERE e.ship_key=? AND e.kind='lead' AND c.is_public=1 AND ${eventVisible} ORDER BY e.created_at DESC,e.id DESC LIMIT 1`).bind(ship.key).first();
 const following=session.profileId?Boolean(await db.prepare('SELECT 1 AS found FROM ship_follows WHERE profile_id=? AND ship_key=?').bind(session.profileId,ship.key).first()):false;
 return {ship_key:ship.key,current_revision:current.current_revision,revision:current.revision,following,lead:lead?eventJson(lead):null,events:results.slice(0,20).map(eventJson),has_more:results.length>20};
}
async function publicRevision(db,key,id){revFor(key,id);if(!await db.prepare('SELECT revision_id FROM ship_revisions WHERE ship_key=? AND revision_id=?').bind(key,id).first())fail(422,'unpublished_edition','Use a published edition.');return id;}
// Called only after the existing creator authorization. No authority from packet/content.
export async function creatorShips({request,env,db,url,path,data}){
 if(request.method==='GET'&&path.length===2){
  const {results}=await db.prepare('SELECT ship_key,current_revision,revision FROM ship_designs ORDER BY ship_key').all();const current=new Map(results.map(r=>[r.ship_key,r]));
  return {ships:Object.values(editions.ships).map(s=>({...s,expected_current:current.get(s.key)?.current_revision||null,expected_revision:current.get(s.key)?.revision||0}))};
 }
 if(path.length!==4||request.method!=='POST')fail(404,'not_found','That ship operation is unavailable.');
 const ship=shipFor(path[2]),id=data.id;
 if(typeof id!=='string'||!uuid.test(id))fail(422,'invalid_id','Use a new UUID for this operation.');
 if(path[3]==='publish'){
  keysOnly(data,['id','revision_id','expected_current','note']);
  const selected=revFor(ship.key,data.revision_id),note=textField(data.note,'Publication note',8,1000);
  if(data.expected_current!==null&&typeof data.expected_current!=='string')fail(422,'expected_current','An explicit expected current edition is required.');
  const prior=await db.prepare('SELECT * FROM ship_publications WHERE id=?').bind(id).first();
  if(prior){if(prior.ship_key!==ship.key||prior.revision_id!==data.revision_id||prior.previous_revision!==data.expected_current||prior.note!==note)fail(409,'id_conflict','Operation ID already belongs to another publication.');return {ok:true,replayed:true};}
  if(data.revision_id!==ship.current_revision)fail(409,'static_mismatch','Prepare and deploy the matching main ship page before switching its publication pointer.');
  const current=await db.prepare('SELECT current_revision FROM ship_designs WHERE ship_key=?').bind(ship.key).first();
  if((current?.current_revision||null)!==data.expected_current)fail(409,'stale_publication','The published edition changed. Review a fresh plan.');
  const page=await env.ASSETS.fetch(new URL(ship.path+'.html',url.origin));
  if(!page.ok||!(await page.text()).includes(`<meta name="fleet-ship-revision" content="${data.revision_id}">`))fail(409,'missing_page','The matching static ship page is not deployed.');
  const revisions=Object.entries(editions.revisions).filter(([,r])=>r.ship_key===ship.key);
  if(revisions.length>16)fail(422,'publication_size','Publish this large revision archive in a reviewed batch.');
  // Verify the deployed immutable dossier bytes before activating any interaction.
  for(const [revision,r]of revisions){const response=await env.ASSETS.fetch(new URL('/assets/fleet-register/'+r.path,url.origin));const bytes=await response.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(!response.ok||hash!==r.sha256)fail(409,'asset_mismatch','A deployed dossier does not match its verified packet.');}
  const now=stamp(),statements=[
   db.prepare("INSERT INTO content_objects(id,slug,title,kind,path,summary,is_public) VALUES(?,?,?,'ship',?,?,0) ON CONFLICT(id) DO NOTHING").bind('ship-design-'+ship.key,'ship-design-'+ship.key,ship.title,ship.path,ship.role),
   db.prepare('INSERT INTO ship_designs(ship_key,content_id) VALUES(?,?) ON CONFLICT DO NOTHING').bind(ship.key,'ship-design-'+ship.key),
   ...revisions.map(([revision,r])=>db.prepare(`INSERT INTO ship_revisions(revision_id,ship_key,recipe_id,definition_hash,file_sha256,exported_at,published_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ship_designs WHERE ship_key=? AND current_revision IS ?) ON CONFLICT DO NOTHING`).bind(revision,ship.key,r.recipe_id,r.definition_hash,r.sha256,r.exported_utc,now,ship.key,data.expected_current)),
   db.prepare('INSERT INTO ship_publications(id,ship_key,previous_revision,revision_id,created_at,note) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ship_designs WHERE ship_key=? AND current_revision IS ?)').bind(id,ship.key,data.expected_current,data.revision_id,now,note,ship.key,data.expected_current)
  ];
  const result=await db.batch(statements);if(!result.at(-1).meta.changes)fail(409,'stale_publication','A newer publication won. Review a fresh plan.');
  return {ok:true,revision_id:data.revision_id};
 }
 if(path[3]!=='record')fail(404,'not_found','That ship action is unavailable.');
 keysOnly(data,['id','expected_revision','kind','profile_id','idea_id','record']);
 if(!Number.isSafeInteger(data.expected_revision)||data.expected_revision<0)fail(422,'expected_revision','Review the latest ship record before changing it.');
 if(!['change','credit','lead'].includes(data.kind)||!data.record||typeof data.record!=='object')fail(422,'invalid_record','Choose a design change, contribution credit or lead assignment.');
 const current=await db.prepare('SELECT * FROM ship_designs WHERE ship_key=? AND current_revision IS NOT NULL').bind(ship.key).first();if(!current)fail(409,'unpublished_ship','Publish the ship before recording community decisions.');
 let profile=null,idea=null;
 if(data.profile_id!=null){if(!uuid.test(data.profile_id))fail(422,'invalid_profile','Choose an existing profile.');profile=await db.prepare('SELECT id,callsign FROM profiles WHERE id=?').bind(data.profile_id).first();if(!profile)fail(404,'profile_missing','That profile does not exist.');}
 if(data.idea_id!=null){idea=await db.prepare('SELECT id,profile_id,handle,is_developer FROM ideas WHERE id=? AND content_id=? AND hidden=0').bind(positiveId(data.idea_id),current.content_id).first();if(!idea)fail(422,'wrong_discussion','Choose a visible discussion on this ship.');}
 const r=data.record;let payload;
 if(data.kind==='change'){
  keysOnly(r,['title','change_type','status','before','after','reason','from_revision','to_revision','evidence','supersedes']);
  if(!['documentation','gameplay'].includes(r.change_type)||!['discussing','planned','in_testing','implemented','not_proceeding','no_change'].includes(r.status))fail(422,'invalid_change','Choose a change type and lifecycle status.');
  if(r.from_revision)await publicRevision(db,ship.key,r.from_revision);if(r.to_revision)await publicRevision(db,ship.key,r.to_revision);
  if(r.supersedes&&!await db.prepare("SELECT id FROM ship_design_events WHERE id=? AND ship_key=? AND kind='change'").bind(r.supersedes,ship.key).first())fail(422,'invalid_predecessor','Choose an existing design change to follow up.');
  payload={title:textField(r.title,'Title',3,120),change_type:r.change_type,status:r.status,before:textField(r.before,'Before',1,1000),after:textField(r.after,'After',1,1000),reason:textField(r.reason,'Reason',8,1500),from_revision:r.from_revision||null,to_revision:r.to_revision||null,evidence:textField(r.evidence||'','Build / review evidence',r.status==='implemented'?8:0,1000,false),supersedes:r.supersedes||null};
 }else{
  keysOnly(r,['contribution','change_id']);
  if(data.kind==='lead'&&!profile&&r.change_id)fail(422,'invalid_lead','A lead change does not reference a design change.');
  if(data.kind==='credit'&&!profile&&!idea)fail(422,'missing_contributor','Credit needs an existing profile or original guest discussion.');
  if(idea&&profile&&idea.profile_id!==profile.id)fail(422,'wrong_author','This profile did not author that original discussion.');
  if(r.change_id&&!await db.prepare("SELECT id FROM ship_design_events WHERE id=? AND ship_key=? AND kind='change'").bind(r.change_id,ship.key).first())fail(422,'wrong_change','Link credit to an existing change on this ship.');
  payload={contribution:textField(r.contribution,'Contribution / assignment reason',8,1000),change_id:r.change_id||null,guest_handle:!profile&&idea&&!idea.profile_id?(idea.is_developer?'Fleet Command':idea.handle||'Anonymous Crew Member'):null};
  if(!profile&&idea?.profile_id)profile=await db.prepare('SELECT id,callsign FROM profiles WHERE id=?').bind(idea.profile_id).first();
 }
 const serialized=JSON.stringify(payload),existing=await db.prepare('SELECT * FROM ship_design_events WHERE id=?').bind(id).first();
 if(existing){if(existing.ship_key!==ship.key||existing.kind!==data.kind||existing.payload_json!==serialized||existing.profile_id!==(profile?.id||null)||existing.idea_id!==(idea?.id||null))fail(409,'id_conflict','Record ID belongs to different content.');return {ok:true,replayed:true};}
 const result=await db.prepare('INSERT INTO ship_design_events(id,ship_key,kind,payload_json,profile_id,idea_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ship_designs WHERE ship_key=? AND revision=?)').bind(id,ship.key,data.kind,serialized,profile?.id||null,idea?.id||null,stamp(),ship.key,data.expected_revision).run();
 if(!result.meta.changes)fail(409,'stale_record','The ship record changed. Review it before adding this decision.');
 return {ok:true,id,revision:data.expected_revision+1};
}
