(() => {
 'use strict';
 const creator=window.FleetCreator,login=document.getElementById('crew-login'),desk=document.getElementById('crew-desk'),access=document.getElementById('access-form'),list=document.getElementById('crew-list'),feedback=document.getElementById('crew-feedback'),more=document.getElementById('crew-more');
 if(!access||!creator)return;
 let view='needs_response',section='overview',offset=0,generation=0,busy=false;
 const seen=new Set();
 const n=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
 const button=(text)=>{const x=n('button','text-button',text);x.type='button';return x;};
 function msg(element,text,error=false){element.textContent=text;element.classList.toggle('error',error);}
 function link(id){const a=n('a','back-link','Open public discussion →');a.href='/i/'+id;return a;}
 async function editorToggle(host,ideaId){
  const open=button('Manage suggestion'),panel=n('div');panel.hidden=true;open.setAttribute('aria-expanded','false');host.append(open,panel);
  open.addEventListener('click',async()=>{
   if(!panel.hidden){panel.hidden=true;open.setAttribute('aria-expanded','false');return;}
   panel.hidden=false;open.disabled=true;open.setAttribute('aria-expanded','true');panel.textContent='Loading…';
   try{const ui=await creator.tools(),data=await creator.api('/api/admin/ideas/'+ideaId);panel.replaceChildren(await ui.ideaEditor(data.idea,()=>load(true),data.history));}
   catch(e){panel.textContent=e.message;}finally{open.disabled=false;}
  });
 }
 function ideaCard(idea){
  const card=n('article','crew-card');card.dataset.ideaId=idea.id;
  card.append(n('p','eyebrow',`${idea.content.title} / suggestion ${idea.id}`),n('h2','',idea.display_title||idea.status_label||'OPEN'),n('p','crew-body',idea.display_body||idea.body),n('p','crew-meta',`${idea.author?.callsign||idea.handle||'Anonymous Crew Member'} · ${idea.votes} votes · ${idea.reply_count} replies${idea.hidden?' · Hidden':''}${idea.pinned?' · Pinned':''}${idea.locked?' · Replies locked':''}`));
  if(idea.developer_response){const official=n('div','fleet-command has-developer-reply');official.append(n('p','fleet-command-label','Fleet Command · Developer reply'),n('p','developer-response',idea.developer_response));card.append(official);}
  const actions=n('div','crew-inbox-action');card.append(actions);editorToggle(actions,idea.id);actions.append(link(idea.id));
  const inspect=button('Inspect replies'),panel=n('div','reply-section');panel.hidden=true;actions.append(inspect);card.append(panel);let replyOffset=0,replyBusy=false,started=false;const replySeen=new Set();const rows=n('div'),note=n('p','feed-feedback'),loadMore=button('More replies');panel.append(note,rows,loadMore);loadMore.hidden=true;
  async function replies(){if(replyBusy)return;replyBusy=true;loadMore.disabled=true;note.textContent='Loading replies…';try{const data=await creator.api(`/api/admin/ideas/${idea.id}?offset=${replyOffset}`);for(const reply of data.replies){if(replySeen.has(reply.id))continue;replySeen.add(reply.id);const row=n('article','reply-card');row.append(n('p','reply-body',reply.display_body||reply.body),n('p','reply-byline',`${reply.author?.callsign||reply.handle||'Anonymous Crew Member'}${reply.hidden?' · Hidden':''}`));const manage=button('Manage reply'),ed=n('div');row.append(manage,ed);manage.addEventListener('click',async()=>{manage.disabled=true;try{const ui=await creator.tools(),latest=await creator.api('/api/admin/replies/'+reply.id);ed.replaceChildren(await ui.replyEditor(latest.reply,()=>load(true)));}catch(e){ed.textContent=e.message;}finally{manage.disabled=false;}});rows.append(row);}replyOffset+=data.replies.length;loadMore.hidden=!data.has_more;note.textContent=replySeen.size?'':'No replies yet.';}catch(e){note.textContent=e.message;loadMore.hidden=false;}finally{replyBusy=false;loadMore.disabled=false;}}
  loadMore.addEventListener('click',replies);inspect.addEventListener('click',()=>{panel.hidden=!panel.hidden;inspect.setAttribute('aria-expanded',String(!panel.hidden));if(!started){started=true;replies();}});return card;
 }
 function reportCard(report){
  const card=n('article','crew-card');card.append(n('p','eyebrow',`Report ${report.id} / ${report.target_type}`),n('h2','',report.reason),n('p','crew-body',report.target_body||'Content unavailable'),n('p','crew-meta',report.detail||''));
  const actions=n('div','crew-inbox-action'),note=n('p','form-feedback');card.append(actions,note);editorToggle(actions,report.idea_id);actions.append(link(report.idea_id));
  if(report.target_type==='reply'){const manage=button('Manage reported reply'),panel=n('div');actions.append(manage);card.append(panel);manage.addEventListener('click',async()=>{manage.disabled=true;try{const ui=await creator.tools(),data=await creator.api('/api/admin/replies/'+report.target_id);panel.replaceChildren(await ui.replyEditor(data.reply,()=>load(true)));}catch(e){msg(note,e.message,true);}finally{manage.disabled=false;}});}
  const resolve=button('Resolve report');actions.append(resolve);resolve.addEventListener('click',async()=>{resolve.disabled=true;try{await creator.api('/api/admin/reports/'+report.id,{method:'PATCH',body:JSON.stringify({resolved:true})});load(true);}catch(e){msg(note,e.message,true);resolve.disabled=false;}});return card;
 }
 async function load(reset=false){
  if(!creator.authorized())return;
  if(reset){generation++;offset=0;seen.clear();list.replaceChildren();}
  else if(busy)return;
  const version=generation;busy=true;more.disabled=true;msg(feedback,'Loading the inbox…');
  try{const data=await creator.api(`/api/admin?view=${view}&offset=${offset}`);if(version!==generation)return;const rows=view==='reports'?data.reports:data.ideas;rows.forEach(row=>{if(!seen.has(row.id)){seen.add(row.id);list.append(view==='reports'?reportCard(row):ideaCard(row));}});offset+=rows.length;more.hidden=!data.has_more;msg(feedback,seen.size?'':'Nothing in this view.');}
  catch(e){if(version===generation){msg(feedback,e.message,true);const retry=button('Try again');retry.addEventListener('click',()=>load());feedback.append(retry);}}
  finally{if(version===generation){busy=false;more.disabled=false;}}
 }
 function choose(value,inboxView){section=value;document.querySelectorAll('[data-desk-section]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.deskSection===value)));for(const id of ['overview','inbox','topics'])document.getElementById('crew-'+id).hidden=id!==value;if(inboxView){view=inboxView;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.view===view)));}window.FleetDashboard.show(value);if(value==='inbox')load(true);}
 function show(active){if(active&&!desk.hidden)return;login.hidden=active;desk.hidden=!active;if(active)choose(section);else{generation++;busy=false;list.replaceChildren();window.FleetDashboard.clear();}}
 creator.ready.then(data=>show(data.authorized));
 access.addEventListener('submit',async event=>{event.preventDefault();if(!access.reportValidity())return;const submit=access.querySelector('button'),note=access.querySelector('.form-feedback'),key=access.elements.key.value.trim();access.elements.key.value='';submit.disabled=true;msg(note,'Unlocking…');try{await creator.unlock(key,access.elements.remember.checked);msg(note,'');show(true);}catch(e){msg(note,e.message,true);}finally{submit.disabled=false;}});
 document.getElementById('crew-lock').addEventListener('click',async()=>{try{await creator.lock();show(false);msg(access.querySelector('.form-feedback'),'Fleet Command locked on this browser.');}catch(e){msg(feedback,e.message,true);}});
 document.getElementById('crew-refresh').addEventListener('click',()=>load(true));more.addEventListener('click',()=>load());
 document.querySelectorAll('[data-view]').forEach(control=>control.addEventListener('click',()=>{if(view===control.dataset.view)return;view=control.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===control)));load(true);}));
 window.addEventListener('fleet:creator',event=>show(event.detail.authorized));
 document.querySelectorAll('[data-desk-section]').forEach(x=>x.addEventListener('click',()=>choose(x.dataset.deskSection)));
 window.addEventListener('fleet:desk-section',event=>choose(event.detail.section,event.detail.view));
})();
