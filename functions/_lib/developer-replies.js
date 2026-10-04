import {IDEA_COLUMNS,IDEA_FROM,ideaJson,pageOffset,paginate} from './community.js';

// A status/pin/edit alone must not move an old developer reply to the top.
export async function developerReplies(db,session,url){
 const {results}=await db.prepare(`SELECT ${IDEA_COLUMNS},
  (SELECT MAX(h.created_at) FROM idea_history h WHERE h.idea_id=i.id AND trim(h.developer_response)<>''
   AND h.developer_response IS NOT (SELECT previous.developer_response FROM idea_history previous WHERE previous.idea_id=h.idea_id AND previous.id<h.id ORDER BY previous.id DESC LIMIT 1)) AS developer_replied_at
  ${IDEA_FROM}
  WHERE i.hidden=0 AND c.is_public=1 AND trim(i.developer_response)<>''
   AND (i.merged_into IS NULL OR EXISTS(SELECT 1 FROM ideas root JOIN content_objects rc ON rc.id=root.content_id WHERE root.id=i.merged_into AND root.hidden=0 AND rc.is_public=1))
  ORDER BY developer_replied_at DESC,i.id DESC LIMIT 13 OFFSET ?`).bind(session.actor,session.actor,pageOffset(url)).all();
 const page=paginate(results,12);
 return {ideas:page.rows.map(row=>({...ideaJson(row),developer_replied_at:row.developer_replied_at})),has_more:page.has_more};
}
