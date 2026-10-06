(() => {
 'use strict';
 const api=window.FleetRequest, $=id=>document.getElementById(id);
 const el=(tag,cls='',text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const link=(label,path,cls='text-button')=>{const a=el('a',cls,label);a.href=path;return a;};
 const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});
 const date=value=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Los_Angeles',timeZoneName:'short'}).format(new Date(value));
 const modes={recruiting:'Recruiting',seeking:'Seeking a patron',both:'Recruiting · seeking a patron',closed:'Not currently recruiting or seeking'};
 let viewer=null;
 function badge(member){const n=el('span','member-insignia',member.callsign.slice(0,2).toUpperCase());n.setAttribute('aria-hidden','true');return n;}
 function memberLine(member){
  const n=el('span','member-identity');const name=link('@'+member.callsign,'/u/'+encodeURIComponent(member.id),'author-link');n.append(badge(member),name);
  const context=el('small','member-context',member.rank||'Recruit');
  if(member.patron){context.append(document.createTextNode(' · Serves '),link('@'+member.patron.callsign,'/u/'+encodeURIComponent(member.patron.id)));}
  if(Number.isInteger(member.direct_count)&&member.direct_count)context.append(document.createTextNode(' · '+member.direct_count+' direct vassal'+(member.direct_count===1?'':'s')));
  n.append(context);return n;
 }
 function memberCard(member){const n=el('article','member-card');n.append(memberLine(member));if(member.introduction)n.append(el('p','member-bio',member.introduction));
  if(member.looking&&member.looking!=='closed')n.append(link(modes[member.looking]+' →','/recruitment?profile='+encodeURIComponent(member.id)));
  n.append(link('View profile →','/u/'+encodeURIComponent(member.id)));return n;}
 window.FleetSocial=Object.freeze({memberLine,badge});
 const feedback=(n,text)=>{if(n)n.textContent=text;};
 function error(n,e,retry){n.replaceChildren(document.createTextNode(e.message||'Could not load.'));if(retry){const b=el('button','text-button','Try again');b.onclick=retry;n.append(b);}}
 const nav=()=>{const n=el('nav','community-nav');n.setAttribute('aria-label','Community');for(const [title,path]of [['People','/people'],['Recruitment','/recruitment'],['Mess Deck','/mess-deck'],['Ship Design','/ship-design']]){const a=link(title,path);if(location.pathname===path||['/','/community'].includes(location.pathname)&&path==='/mess-deck')a.setAttribute('aria-current','page');n.append(a);}return n;};
 document.querySelectorAll('[data-community-nav]').forEach(n=>n.replaceWith(nav()));
 // Preserve old bookmarks while removing duplicate long sections from Community.
 if(location.pathname==='/community'&&['#topics','#propose-topic','#implemented','#arguments'].includes(location.hash))location.replace('/feedback'+location.hash);
 if(location.pathname==='/community'&&location.hash==='#latest')location.replace('/activity#latest');
 const session=window.FleetSession||api('/api/session');
 const memberGate=async n=>{const s=await session;await window.FleetCreator?.ready;if(window.FleetCreator?.authorized())return {callsign:'Fleet Command',developer:true};if(!s.profile){n.replaceChildren(link('Sign in to start a post','/register?return_to='+encodeURIComponent(location.pathname)),el('p','field-hint','Everyone can read and reply.'));return null;}return s.profile;};

 if($('people-list')){
  let offset=0,busy=false,query=new URLSearchParams(location.search).get('search')||'';const form=$('people-search');form.elements.search.value=query;
  async function load(reset=false){if(busy)return;busy=true;if(reset){offset=0;$('people-list').replaceChildren();}feedback($('people-feedback'),'Loading…');try{const data=await api('/api/social/people?search='+encodeURIComponent(query)+'&offset='+offset);for(const p of data.people)$('people-list').append(memberCard(p));offset+=data.people.length;$('people-more').hidden=!data.has_more;feedback($('people-feedback'),offset?'':'No matching callsigns.');}catch(e){error($('people-feedback'),e,()=>load());}finally{busy=false;}}
  form.onsubmit=e=>{e.preventDefault();query=form.elements.search.value.trim();load(true);};$('people-more').onclick=()=>load();load();
 }
 function draft(form,key){try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved)for(const [k,v]of Object.entries(saved))if(form.elements[k])form.elements[k].value=v;}catch{}
  form.addEventListener('input',()=>{try{sessionStorage.setItem(key,JSON.stringify(Object.fromEntries(new FormData(form))));}catch{}});return ()=>{try{sessionStorage.removeItem(key);}catch{}};}
 if($('mess-list')){
  let offset=0,busy=false;async function load(reset=false){if(busy)return;busy=true;if(reset){offset=0;$('mess-list').replaceChildren();}feedback($('mess-feedback'),'Loading…');try{const data=await api(Number($('mess-list').dataset.limit)?'/api/social/conversations':'/api/ideas?content_id=social-mess&sort=new&limit=8&offset='+offset);const cap=Number($('mess-list').dataset.limit)||0;(cap?data.ideas.slice(0,cap):data.ideas).forEach(i=>$('mess-list').append(window.FleetCommunity.renderIdea(i)));offset+=data.ideas.length;$('mess-more').hidden=!!Number($('mess-list').dataset.limit)||!data.has_more;feedback($('mess-feedback'),offset?'':'Quiet deck. Start a conversation.');}catch(e){error($('mess-feedback'),e,()=>load());}finally{busy=false;}}
  $('mess-more').onclick=()=>load();load();
  const form=$('mess-form'),clear=draft(form,'fip-mess-draft');let requestId=crypto.randomUUID(),sending=false;form.addEventListener('input',()=>{if(!sending)requestId=crypto.randomUUID();});
  memberGate($('mess-compose')).then(member=>{if(!member)return;form.hidden=false;$('mess-as').textContent=member.developer?'Posting as Fleet Command · Developer':'Posting as @'+member.callsign;}).catch(e=>error($('mess-compose'),e));
  form.onsubmit=async e=>{e.preventDefault();if(sending)return;sending=true;form.querySelector('button').disabled=true;try{await post('/api/ideas',{content_id:'social-mess',as_developer:!!window.FleetCreator?.authorized(),body:form.elements.body.value,handle:'',request_id:requestId,website:form.elements.website.value});form.reset();clear();requestId=crypto.randomUUID();feedback($('mess-post-feedback'),'Posted.');await load(true);}catch(err){feedback($('mess-post-feedback'),err.message);}finally{sending=false;form.querySelector('button').disabled=false;}};
 }
 if($('recruitment-list')){
  const params=new URLSearchParams(location.search),profile=params.get('profile');let mode=params.get('mode')==='seeking'?'seeking':'recruiting',offset=0,busy=false;
  async function load(reset=false){if(busy)return;busy=true;if(reset){offset=0;$('recruitment-list').replaceChildren();}feedback($('recruitment-feedback'),'Loading…');try{const data=await api('/api/social/recruitment?'+(profile?'profile='+encodeURIComponent(profile):'mode='+mode)+'&offset='+offset);for(const listing of data.listings){const wrap=el('article','recruitment-entry');wrap.append(el('p','eyebrow',modes[listing.mode]+(listing.newcomer_friendly?' · Newcomers welcome':'')),window.FleetCommunity.renderIdea(listing.idea));$('recruitment-list').append(wrap);}offset+=data.listings.length;$('recruitment-more').hidden=!data.has_more;feedback($('recruitment-feedback'),offset?'':'No listings here yet. Make yours below.');}catch(e){error($('recruitment-feedback'),e,()=>load());}finally{busy=false;}}
  document.querySelectorAll('[data-recruitment-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.recruitmentMode===mode&&!profile));b.onclick=()=>{if(profile){location.assign('/recruitment?mode='+b.dataset.recruitmentMode);return;}mode=b.dataset.recruitmentMode;document.querySelectorAll('[data-recruitment-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));load(true);};});$('recruitment-more').onclick=()=>load();load();
  const form=$('listing-form');let revision=null,requestId=crypto.randomUUID(),sending=false;
  session.then(async s=>{await window.FleetCreator?.ready;if(window.FleetCreator?.authorized()){$('listing-gate').replaceChildren(el('p','field-hint','Fleet Command · Developer'),link('Post a Fleet Command announcement →','/mess-deck#mess-compose'),link('Manage community posts →','/crew'));form.hidden=true;return;}if(!s.profile){$('listing-gate').append(link('Sign in to make a listing','/register?return_to=%2Frecruitment'));return;}viewer=s.profile;
   async function own(){try{const data=await api('/api/social/recruitment?profile='+encodeURIComponent(viewer.id));const current=data.listings[0];if(current){form.elements.body.value=current.idea.body;form.elements.mode.value=current.mode;form.elements.newcomer_friendly.checked=current.newcomer_friendly;revision=current.revision;}form.hidden=false;$('listing-gate').textContent='One listing, editable whenever plans change.';}catch(e){error($('listing-gate'),e,own);}}await own();
  }).catch(e=>error($('listing-gate'),e));
  form.onsubmit=async e=>{e.preventDefault();if(sending)return;sending=true;form.querySelector('button').disabled=true;try{const data=await post('/api/social/recruitment',{body:form.elements.body.value,mode:form.elements.mode.value,newcomer_friendly:form.elements.newcomer_friendly.checked,revision,request_id:requestId});revision=data.revision;requestId=crypto.randomUUID();feedback($('listing-feedback'),'Saved. Your existing replies stay with the listing.');await load(true);}catch(err){feedback($('listing-feedback'),err.message);}finally{sending=false;form.querySelector('button').disabled=false;}};
 }

 // A private inbox for actual replies/mentions/decisions, never manufactured activity.
 const inbox=$('notification-list');let noticeOffset=0,noticeBusy=false,newest=0,noticeGeneration=0;
 async function notices(more=false){if(noticeBusy||!viewer)return;noticeBusy=true;const generation=noticeGeneration;try{const data=await api('/api/social/notifications?'+(inbox?'offset='+(more?noticeOffset:0):'summary=1'));if(generation!==noticeGeneration)return;
  const indicator=document.querySelector('[data-notification-link]');if(indicator){indicator.hidden=false;indicator.textContent='Inbox'+(data.unread?' ('+data.unread+')':'');}
  if(inbox){if(!more){inbox.replaceChildren();noticeOffset=0;newest=data.notifications[0]?.id||0;}const labels={reply:'replied to your post',mention:'mentioned you',update:'updated your discussion',allegiance:'swore allegiance to you',topic:'published or updated your topic'};
   for(const n of data.notifications){const a=link(n.actor+' '+labels[n.kind],n.path,'notification'+(n.read?'':' unread'));a.append(el('small','',date(n.created_at)+(n.title?' · '+n.title:'')));inbox.append(a);}noticeOffset+=data.notifications.length;$('notification-more').hidden=!data.has_more;$('notification-read').hidden=!data.unread;feedback($('notification-feedback'),noticeOffset?'':'Nothing waiting for you.');}
 }catch(e){if(inbox)error($('notification-feedback'),e,()=>notices());}finally{noticeBusy=false;}}
 async function identity(s){await window.FleetCreator?.ready;noticeGeneration++;const developer=!!window.FleetCreator?.authorized();viewer=developer?null:s.profile||null;const indicator=document.querySelector('[data-notification-link]');if(indicator){indicator.hidden=!viewer&&!developer;indicator.href=developer?'/crew':'/notifications';if(developer)indicator.textContent='Command activity';}if(inbox&&!viewer){inbox.replaceChildren(developer?link('View Fleet Command activity →','/crew'):link('Sign in to see your inbox','/register?return_to=%2Fnotifications'));$('notification-read').hidden=true;$('notification-more').hidden=true;}if(viewer)await notices();}
 session.then(identity).catch(()=>{});window.addEventListener('fleet:session',e=>identity(e.detail));
 window.addEventListener('fleet:creator',()=>session.then(identity).catch(()=>{}));
 if(inbox){$('notification-more').onclick=()=>notices(true);$('notification-read').onclick=async()=>{if(!newest)return;try{await post('/api/social/notifications/read',{through_id:newest});await notices();}catch(e){feedback($('notification-feedback'),e.message);}};}
 setInterval(()=>{if(window.FleetActive()&&!inbox)notices();},120000);

 window.addEventListener('fleet:profile',async e=>{
  const p=e.detail,host=$('profile-social');if(!host)return;host.replaceChildren();const about=el('div','profile-about');about.append(badge(p),el('p','member-bio',p.introduction||'No introduction yet.'));host.append(about);
  const s=await session;
  if(s.profile?.id===p.id){const details=el('details','profile-editor'),summary=el('summary','','Edit introduction'),form=el('form');const label=el('label','','A little about you'),input=el('textarea');input.maxLength=280;input.rows=3;input.value=p.introduction||'';label.append(input);const save=el('button','button secondary','Save'),msg=el('p','field-hint');form.append(label,save,msg);details.append(summary,form);host.append(details,link('Manage your recruitment listing →','/recruitment#your-listing'));
   form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{await post('/api/social/profile',{introduction:input.value});about.querySelector('p').textContent=input.value;msg.textContent='Saved.';}catch(err){msg.textContent=err.message;}finally{save.disabled=false;}};
  }
  try{const result=await api('/api/social/recruitment?profile='+encodeURIComponent(p.id));const listing=result.listings[0];if(listing&&listing.mode!=='closed')host.append(link(modes[listing.mode]+' · Talk here →','/recruitment?profile='+encodeURIComponent(p.id),'recruitment-profile-link'));}catch{}
  const relations=$('profile-relations');if(!relations)return;relations.replaceChildren();const controls=el('div','sort-controls'),rows=el('div','people-grid'),msg=el('p','field-hint'),more=el('button','text-button','More members');let view='chain',offset=0,generation=0;more.hidden=true;
  async function load(reset=false){const version=++generation;if(reset){offset=0;rows.replaceChildren();}msg.textContent='Loading…';try{const data=await api('/api/social/relationships/'+encodeURIComponent(p.id)+'?view='+view+'&offset='+offset);if(version!==generation)return;data.people.forEach(m=>rows.append(memberCard(m)));offset+=data.people.length;more.hidden=!data.has_more;msg.textContent=offset?'':'No members here yet.';}catch(err){if(version===generation)error(msg,err,()=>load());}}
  for(const [name,value]of [['Patron chain','chain'],['Fellow vassals','fellows'],['Full branch','branch']]){const b=el('button','text-button',name);b.setAttribute('aria-pressed',String(view===value));b.onclick=()=>{view=value;controls.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));load(true);};controls.append(b);}more.onclick=()=>load();relations.append(controls,rows,msg,more);load(true);
 });
})();
