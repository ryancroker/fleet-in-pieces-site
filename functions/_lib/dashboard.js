import {fail} from './community.js';

const ZONE='America/Los_Angeles';
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const offsetFormat=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,timeZoneName:'longOffset'});
function dateKey(date){const p=Object.fromEntries(dateFormat.formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function midnight(key){
 const base=Date.parse(key+'T00:00:00Z');let guess=base+8*3600000;
 // Re-evaluate the offset at midnight, including the dates of DST transitions.
 for(let n=0;n<2;n++){const value=offsetFormat.formatToParts(new Date(guess)).find(x=>x.type==='timeZoneName').value;const m=value.match(/GMT([+-])(\d{2}):(\d{2})/);const offset=m?(m[1]==='-'?-1:1)*(Number(m[2])*60+Number(m[3]))*60000:0;guess=base-offset;}
 return new Date(guess).toISOString();
}

// Read models only. Promotion doesn't manufacture a second community submission,
// and merged/claimed votes count once per current discussion and voter identity.
const DATA=`WITH visible AS (
 SELECT i.*,c.title AS content_title,c.path AS content_path FROM ideas i
 JOIN content_objects c ON c.id=i.content_id WHERE i.hidden=0 AND c.is_public=1
), support AS (
 SELECT COALESCE(i.merged_into,i.id) AS idea_id,
 COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash) AS voter,MIN(v.created_at) AS created_at
 FROM votes v JOIN visible i ON i.id=v.idea_id
 JOIN visible root ON root.id=COALESCE(i.merged_into,i.id)
 LEFT JOIN profile_actors pa ON pa.actor_hash=v.actor_hash GROUP BY COALESCE(i.merged_into,i.id),COALESCE('p:'||pa.profile_id,'a:'||v.actor_hash)
), notes AS (
 SELECT i.id,MIN(h.created_at) AS first_at,MAX(h.created_at) AS last_at
 FROM visible i JOIN idea_history h ON h.idea_id=i.id
 WHERE trim(i.developer_response)<>'' AND trim(h.developer_response)<>''
 AND h.developer_response IS NOT (SELECT prior.developer_response FROM idea_history prior WHERE prior.idea_id=h.idea_id AND prior.id<h.id ORDER BY prior.id DESC LIMIT 1)
 GROUP BY i.id
), events AS (
 SELECT CASE WHEN i.is_developer=1 THEN 'developer_post' ELSE 'idea' END AS kind,i.id AS event_id,i.id AS idea_id,i.content_id,i.content_title,i.content_path,
 i.created_at,substr(COALESCE(NULLIF(i.display_body,''),i.body),1,240) AS body,
 COALESCE(p.callsign,NULLIF(i.handle,''),'Anonymous crew') AS author,1 AS amount
 FROM visible i LEFT JOIN profiles p ON p.id=i.profile_id WHERE i.source_reply_id IS NULL
 UNION ALL
 SELECT CASE WHEN r.is_developer=1 THEN 'developer_reply' ELSE 'reply' END,r.id,i.id,i.content_id,i.content_title,i.content_path,r.created_at,
 substr(COALESCE(NULLIF(r.display_body,''),r.body),1,240),COALESCE(p.callsign,NULLIF(r.handle,''),'Anonymous crew'),1
 FROM replies r JOIN visible i ON i.id=r.idea_id LEFT JOIN profiles p ON p.id=r.profile_id WHERE r.hidden=0
 UNION ALL
 SELECT 'vote',i.id,i.id,i.content_id,i.content_title,i.content_path,s.created_at,'','',1 FROM support s JOIN visible i ON i.id=s.idea_id
 UNION ALL
 SELECT 'developer',i.id,i.id,i.content_id,i.content_title,i.content_path,n.first_at,substr(i.developer_response,1,240),'Fleet Command',1
 FROM notes n JOIN visible i ON i.id=n.id
 UNION ALL
 SELECT 'register',NULL,NULL,NULL,'Fleet Register','/fleet',created_at,'',callsign,1 FROM profiles
)
`;

const TOPIC_RESPONSES=`WITH responses AS (
 SELECT t.id,c.id AS content_id,c.title AS content_title,c.path AS content_path,t.acknowledgement,
 t.first_responded_at AS created_at,t.responded_at AS updated_at,substr(t.developer_response,1,240) AS body
 FROM topic_proposals t JOIN content_objects c ON c.id='community-topic-'||t.id AND c.is_public=1
 WHERE t.status='approved' AND trim(t.developer_response)<>''
) `;

export async function dashboard(db,url){
 const days=Number(url.searchParams.get('days')||7);if(![7,30].includes(days))fail(400,'invalid_range','Choose 7 or 30 days.');
 const now=new Date(),end=now.toISOString(),today=dateKey(now),base=Date.parse(today+'T12:00:00Z');
 const periods=Array.from({length:days},(_,n)=>{
  const key=new Date(base-(days-1-n)*86400000).toISOString().slice(0,10),next=new Date(base-(days-2-n)*86400000).toISOString().slice(0,10);
  return {date:key,start:midnight(key),end:midnight(next)};
 });
 const start=periods[0].start;
 const range="created_at>=? AND created_at<=?";
 const rows=await db.batch([
  db.prepare(DATA+`SELECT kind,COUNT(*) AS total,SUM(CASE WHEN ${range} THEN 1 ELSE 0 END) AS recent FROM events GROUP BY kind`).bind(start,end),
  db.prepare(DATA+`SELECT
   (SELECT COUNT(*) FROM visible WHERE merged_into IS NULL AND is_developer=0 AND trim(developer_response)='' AND NOT EXISTS(SELECT 1 FROM replies r JOIN ideas source ON source.id=r.idea_id WHERE (source.id=visible.id OR source.merged_into=visible.id) AND source.hidden=0 AND r.hidden=0 AND r.is_developer=1)) AS needs_response,
   (SELECT COUNT(*) FROM reports WHERE resolved_at IS NULL) AS reports,
   (SELECT COUNT(*) FROM topic_proposals WHERE status='pending') AS topics,
   (SELECT COUNT(*) FROM visible WHERE merged_into IS NULL AND status IN('planned','building')) AS planned,
   (SELECT COUNT(*) FROM visible WHERE merged_into IS NULL AND decision_key='implemented') AS implemented,
   (SELECT COUNT(*) FROM visible WHERE merged_into IS NULL AND decision_key='already_in_game') AS already_in_game`),
  db.prepare(DATA+`, periods(day,start,finish) AS (VALUES ${periods.map(()=>'(?,?,?)').join(',')})
   SELECT p.day,e.kind,COUNT(e.kind) AS count FROM periods p LEFT JOIN events e ON e.created_at>=p.start AND e.created_at<p.finish AND e.created_at<=? GROUP BY p.day,e.kind ORDER BY p.day`)
   .bind(...periods.flatMap(p=>[p.date,p.start,p.end]),end),
  db.prepare(DATA+`SELECT content_id,content_title,content_path,
   SUM(kind='idea') AS ideas,SUM(kind='reply') AS replies,SUM(kind='vote') AS votes,SUM(kind IN('developer','developer_post','developer_reply')) AS developer_replies,
   COUNT(*) AS activity FROM events WHERE content_id IS NOT NULL AND ${range}
   GROUP BY content_id ORDER BY activity DESC,content_title`).bind(start,end),
  db.prepare(DATA+`, recent AS (
   SELECT kind,event_id,idea_id,content_title,content_path,created_at,body,author,amount FROM events WHERE kind IN('idea','reply','register','developer_post','developer_reply') AND ${range}
   UNION ALL SELECT 'vote',idea_id,idea_id,content_title,content_path,MAX(created_at),'','',COUNT(*) FROM events WHERE kind='vote' AND ${range} GROUP BY idea_id
   UNION ALL SELECT CASE WHEN n.last_at=n.first_at THEN 'developer' ELSE 'developer_edit' END,i.id,i.id,i.content_title,i.content_path,n.last_at,substr(i.developer_response,1,240),'Fleet Command',1
   FROM notes n JOIN visible i ON i.id=n.id WHERE n.last_at>=? AND n.last_at<=?
  ) SELECT * FROM recent ORDER BY created_at DESC,kind,event_id DESC LIMIT 20`).bind(start,end,start,end,start,end),
  // Keep private proposals outside the repeatedly expanded events CTE. Another
  // UNION branch there exceeds D1's compound-select limit in the existing views.
  db.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN ${range} THEN 1 ELSE 0 END) AS recent FROM topic_proposals`).bind(start,end),
  db.prepare(`WITH periods(day,start,finish) AS (VALUES ${periods.map(()=>'(?,?,?)').join(',')})
   SELECT p.day,COUNT(t.id) AS count FROM periods p LEFT JOIN topic_proposals t ON t.created_at>=p.start AND t.created_at<p.finish AND t.created_at<=? GROUP BY p.day`)
   .bind(...periods.flatMap(p=>[p.date,p.start,p.end]),end),
  db.prepare(`SELECT 'proposal' AS kind,t.id AS event_id,NULL AS idea_id,t.title AS content_title,'/crew' AS content_path,
   t.created_at,substr(t.body,1,240) AS body,COALESCE(p.callsign,NULLIF(t.handle,''),'Anonymous crew') AS author,1 AS amount
   FROM topic_proposals t LEFT JOIN profiles p ON p.id=t.profile_id WHERE t.created_at>=? AND t.created_at<=? ORDER BY t.created_at DESC,t.id DESC LIMIT 20`).bind(start,end),
  // Separate read models avoid expanding another branch in the events CTE.
  db.prepare(TOPIC_RESPONSES+`SELECT COUNT(*) AS total,SUM(CASE WHEN ${range} THEN 1 ELSE 0 END) AS recent,SUM(acknowledgement='already_in_game') AS already_in_game FROM responses`).bind(start,end),
  db.prepare(TOPIC_RESPONSES+`, periods(day,start,finish) AS (VALUES ${periods.map(()=>'(?,?,?)').join(',')})
   SELECT p.day,COUNT(r.id) AS count FROM periods p LEFT JOIN responses r ON r.created_at>=p.start AND r.created_at<p.finish AND r.created_at<=? GROUP BY p.day`)
   .bind(...periods.flatMap(p=>[p.date,p.start,p.end]),end),
  db.prepare(TOPIC_RESPONSES+`SELECT 'developer_topic' AS kind,id AS event_id,NULL AS idea_id,content_title,content_path,updated_at AS created_at,body,'Fleet Command' AS author,1 AS amount FROM responses WHERE updated_at>=? AND updated_at<=? ORDER BY updated_at DESC,id DESC LIMIT 20`).bind(start,end),
  db.prepare(TOPIC_RESPONSES+`SELECT content_id,content_title,content_path,COUNT(*) AS developer_replies FROM responses WHERE ${range} GROUP BY content_id`).bind(start,end)
 ]);
 const metric=kind=>kind.startsWith('developer')?'developer':kind;
 for(const row of rows[0].results){if(metric(row.kind)===row.kind)continue;let base=rows[0].results.find(r=>r.kind==='developer');if(!base){base={kind:'developer',total:0,recent:0};rows[0].results.push(base);}base.total+=row.total;base.recent+=row.recent||0;}
 const totals={},counts={};for(const kind of ['idea','reply','vote','developer','register']){const row=rows[0].results.find(r=>r.kind===kind);totals[kind]=Number(row?.total||0);counts[kind]=Number(row?.recent||0);}
 totals.proposal=Number(rows[5].results[0]?.total||0);counts.proposal=Number(rows[5].results[0]?.recent||0);
 totals.developer+=Number(rows[8].results[0]?.total||0);counts.developer+=Number(rows[8].results[0]?.recent||0);
 rows[1].results[0].already_in_game+=Number(rows[8].results[0]?.already_in_game||0);
 const daily=periods.map(p=>{const result={date:p.date,idea:0,reply:0,vote:0,developer:0,register:0,proposal:Number(rows[6].results.find(r=>r.day===p.date)?.count||0)};for(const r of rows[2].results)if(r.day===p.date&&r.kind)result[metric(r.kind)]+=r.count;return result;});
 for(const day of daily)day.developer+=Number(rows[9].results.find(r=>r.day===day.date)?.count||0);
 const topicMap=new Map(rows[3].results.map(row=>[row.content_id,row]));
 for(const row of rows[11].results){const topic=topicMap.get(row.content_id)||{...row,ideas:0,replies:0,votes:0,developer_replies:0,activity:0};topic.developer_replies+=row.developer_replies;topic.activity+=row.developer_replies;topicMap.set(row.content_id,topic);}
 const topics=[...topicMap.values()].sort((a,b)=>b.activity-a.activity||a.content_title.localeCompare(b.content_title)).slice(0,8);
 const recent=[...rows[4].results,...rows[7].results,...rows[10].results].sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.kind.localeCompare(b.kind)||(b.event_id||0)-(a.event_id||0)).slice(0,20);
 return {as_of:end,days,time_zone:ZONE,period_start:start,counts,totals,attention:rows[1].results[0],daily,topics,recent,
  traffic:{available:false,url:'https://dash.cloudflare.com/?to=%2F%3Aaccount%2Fweb-analytics'}};
}
