import {pageOffset,paginate} from './community.js';

// Public events only. Private proposals, identities and moderation records never
// enter this feed. A hidden merge destination hides its source activity too.
const EVENTS=`WITH visible AS (
 SELECT i.*,c.title AS topic_title,c.path AS topic_path FROM ideas i
 JOIN content_objects c ON c.id=i.content_id
 WHERE i.hidden=0 AND c.is_public=1 AND (i.merged_into IS NULL OR EXISTS(
 SELECT 1 FROM ideas root JOIN content_objects rc ON rc.id=root.content_id
 WHERE root.id=i.merged_into AND root.hidden=0 AND rc.is_public=1))
), events AS (
 SELECT 'post:'||i.id AS event_key,'post' AS kind,i.content_id,i.topic_title,i.topic_path,
 '/i/'||COALESCE(i.merged_into,i.id)||'#replies-'||COALESCE(i.merged_into,i.id) AS path,
 i.created_at,substr(COALESCE(NULLIF(i.display_body,''),i.body),1,240) AS body,
 CASE WHEN i.is_developer=1 THEN 'Fleet Command' ELSE COALESCE(p.callsign,NULLIF(i.handle,''),'Anonymous crew') END AS author,
 i.is_developer FROM visible i LEFT JOIN profiles p ON p.id=i.profile_id WHERE i.source_reply_id IS NULL
 UNION ALL
 SELECT 'reply:'||r.id,'reply',i.content_id,i.topic_title,i.topic_path,
 '/i/'||COALESCE(i.merged_into,i.id)||'#replies-'||COALESCE(i.merged_into,i.id),r.created_at,
 substr(COALESCE(NULLIF(r.display_body,''),r.body),1,240),
 CASE WHEN r.is_developer=1 THEN 'Fleet Command' ELSE COALESCE(p.callsign,NULLIF(r.handle,''),'Anonymous crew') END,r.is_developer
 FROM replies r JOIN visible i ON i.id=r.idea_id LEFT JOIN profiles p ON p.id=r.profile_id WHERE r.hidden=0
 UNION ALL
 SELECT 'note:'||i.id,'note',i.content_id,i.topic_title,i.topic_path,'/i/'||i.id,
 (SELECT MAX(h.created_at) FROM idea_history h WHERE h.idea_id=i.id AND trim(h.developer_response)<>''
 AND h.developer_response IS NOT (SELECT previous.developer_response FROM idea_history previous WHERE previous.idea_id=h.idea_id AND previous.id<h.id ORDER BY previous.id DESC LIMIT 1)),
 substr(i.developer_response,1,240),'Fleet Command',1 FROM visible i WHERE trim(i.developer_response)<>''
 UNION ALL
 SELECT 'topic:'||t.id,'topic',c.id,c.title,c.path,c.path||'#suggest',t.reviewed_at,
 substr(c.summary,1,240),COALESCE(p.callsign,NULLIF(t.handle,''),'Anonymous crew'),0
 FROM topic_proposals t JOIN content_objects c ON c.id='community-topic-'||t.id AND c.is_public=1
 LEFT JOIN profiles p ON p.id=t.profile_id WHERE t.status='approved'
)
`;

export async function publicActivity(db,url){
 const official=url.searchParams.get('developer')==='1';
 const size=official?12:6;
 const {results}=await db.prepare(EVENTS+`SELECT * FROM events WHERE created_at IS NOT NULL ${official?'AND is_developer=1':''}
 ORDER BY created_at DESC,event_key DESC LIMIT ? OFFSET ?`).bind(size+1,pageOffset(url)).all();
 const page=paginate(results,size);
 return {activity:page.rows.map(row=>({...row,is_developer:Boolean(row.is_developer)})),has_more:page.has_more};
}

export async function topicActivity(db){
 const {results}=await db.prepare(EVENTS+`SELECT content_id,MAX(created_at) AS latest_activity_at,
 MAX(CASE WHEN kind='topic' THEN created_at END) AS published_at,
 SUM(kind='reply') AS reply_count FROM events GROUP BY content_id`).all();
 return new Map(results.map(row=>[row.content_id,{latest_activity_at:row.latest_activity_at,published_at:row.published_at,reply_count:row.reply_count}]));
}
