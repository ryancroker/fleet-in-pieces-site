import {database,positiveId,htmlEscape,securityHeaders} from '../_lib/community.js';
import {topicCredit,TOPIC_CREDIT_COLUMNS,TOPIC_CREDIT_JOIN} from '../_lib/topics.js';

export async function onRequest({request,env,params}){
 const headers=securityHeaders(true);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 try{
  const id=positiveId(params.id),row=await database(env,{readOnly:true,maxStatements:1}).prepare(`SELECT c.id,c.slug,c.title,c.summary,${TOPIC_CREDIT_COLUMNS} FROM content_objects c ${TOPIC_CREDIT_JOIN} WHERE c.id=? AND c.is_public=1 AND t.status='approved'`).bind('community-topic-'+id).first();
  if(!row){headers.set('X-Robots-Tag','noindex');return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Topic unavailable — Fleet in Pieces</title><h1>This topic is not available.</h1><a href="/community#topics">Browse the community topics</a></html>',{status:404,headers});}
  let shell=await env.ASSETS.fetch(new Request(new URL('/topic.html',request.url)));
  if([301,302,307,308].includes(shell.status))shell=await env.ASSETS.fetch(new Request(new URL('/topic',request.url)));
  if(!shell.ok)throw Error('Missing topic shell');let html=await shell.text();
  const credit=topicCredit(row),canonical='https://fleetinpieces.space/topics/'+id;
  const values={__TOPIC_TITLE__:row.title,__TOPIC_DESCRIPTION__:row.summary,__TOPIC_ID__:row.id,__TOPIC_SLUG__:row.slug,__TOPIC_URL__:canonical,__TOPIC_NOTE__:row.acknowledgement==='already_in_game'?'Already part of the game. Questions and ideas for making it better are welcome.':'A place to discuss an idea, not a promise that it will be added to the game.'};
  const markup=credit.path?`<a href="${htmlEscape(credit.path)}">${htmlEscape(credit.name)}</a>`:htmlEscape(credit.name);
  const stamp=row.responded_at?new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(row.responded_at)):'';
  const response=row.topic_response?`<aside class="topic-command-response" id="fleet-response" aria-label="Developer reply"><p class="eyebrow">Fleet Command · Developer reply</p>${row.acknowledgement==='already_in_game'?'<span class="topic-acknowledgement">Already in the game</span><h2>Good instincts. Already aboard.</h2>':'<h2>From Fleet Command.</h2>'}<p class="topic-response-body">${htmlEscape(row.topic_response)}</p><time datetime="${htmlEscape(row.responded_at||'')}">${htmlEscape(stamp)}</time></aside>`:'';
  // Substitution in one pass keeps user-authored token-like text inert.
  html=html.replace(/__TOPIC_(?:TITLE|DESCRIPTION|ID|SLUG|URL|CREDIT|RESPONSE|NOTE)__/g,token=>token==='__TOPIC_CREDIT__'?markup:token==='__TOPIC_RESPONSE__'?response:htmlEscape(values[token]));
  if(new URL(request.url).hostname!=='fleetinpieces.space')headers.set('X-Robots-Tag','noindex');
  return new Response(request.method==='HEAD'?null:html,{headers});
 }catch(error){headers.set('X-Robots-Tag','noindex');return new Response('This topic is unavailable. Please return to /community.',{status:[400,404].includes(error.status)?404:503,headers});}
}
