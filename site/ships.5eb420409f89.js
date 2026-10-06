(() => {
 'use strict';
 const api=window.FleetRequest,$=s=>document.querySelector(s),el=(tag,cls='',text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const link=(text,href,cls='text-button')=>{const n=el('a',cls,text);n.href=href;return n;};
 const date=s=>new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'America/Los_Angeles'}).format(new Date(s));
 const labels={discussing:'Discussing',planned:'Planned',in_testing:'In testing',implemented:'Implemented',not_proceeding:'Not proceeding',no_change:'No change needed'};
 const key=document.body.dataset.shipKey,revision=document.body.dataset.shipRevision;
 const cards=[...document.querySelectorAll('[data-ship-card]')];
 if(cards.length){let count=12;const input=$('[data-ship-search]'),category=$('[data-ship-category]'),more=$('[data-ships-more]');
  function filter(){const q=input.value.trim().toLowerCase();const matches=cards.filter(n=>n.dataset.search.includes(q)&&(!category.value||n.dataset.category===category.value));cards.forEach(n=>n.hidden=true);matches.slice(0,count).forEach(n=>n.hidden=false);$('[data-library-count]').textContent=`${matches.length} design${matches.length===1?'':'s'}${category.value?' · '+category.value:''}${matches.length>count?' / showing '+count:''}`;more.hidden=matches.length<=count;}
  input.addEventListener('input',()=>{count=12;filter();});category.onchange=()=>{count=12;filter();};input.form.addEventListener('submit',e=>e.preventDefault());input.form.addEventListener('reset',e=>{e.preventDefault();input.value='';category.value='';count=12;filter();});more.onclick=()=>{count+=12;filter();};filter();
 }
 function openAnchor(){const id=decodeURIComponent(location.hash.slice(1));const target=document.getElementById(id);if(target?.tagName==='DETAILS'){target.open=true;for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}}
 window.addEventListener('hashchange',openAnchor);openAnchor();
 document.querySelectorAll('[data-discuss-section]').forEach(a=>a.addEventListener('click',()=>{const section=$('#ship-section');section.value=a.dataset.discussSection;section.dispatchEvent(new Event('change',{bubbles:true}));requestAnimationFrame(()=>$('#idea-body')?.focus({preventScroll:true}));}));
 const person=r=>r.profile?link('@'+r.profile.callsign,r.profile.path,'record-credit'):el('span','record-credit',r.guest_handle||'Fleet contributor');
 function record(r){const n=el('article','ship-record-entry');n.id='record-'+r.id;
  n.append(el('p','eyebrow',date(r.created_at)+' / Fleet Command'));
  if(r.kind==='change'){
   n.append(el('h3','',r.title),el('p','record-credit',(r.change_type==='documentation'?'Documentation correction':'Gameplay / design change')+' · '+labels[r.status]),el('p','',r.reason));
   const details=el('details');details.append(el('summary','','What changed'),el('p','','Before: '+r.before),el('p','','After: '+r.after));if(r.evidence)details.append(el('p','','Evidence / review: '+r.evidence));
   if(r.change_type==='documentation')details.append(el('p','','This entry changes the documentation, not the game.'));
   for(const [title,id]of [['Earlier edition',r.from_revision],['Resulting edition',r.to_revision]])if(id)details.append(link(title+' →','/ships/designs/'+r.ship_key+'/revisions/'+id));
   if(r.supersedes)details.append(link('Previous decision →','/ships/designs/'+r.ship_key+'#record-'+r.supersedes));n.append(details);
  }else{n.append(el('h3','',r.kind==='lead'?(r.profile?'Community Design Lead assigned':'Community Design Lead vacated'):'Design contribution'),person(r),el('p','',r.contribution));if(r.change_id)n.append(link('Related design change →','/ships/designs/'+r.ship_key+'#record-'+r.change_id));}
  if(r.idea_id)n.append(link('Original discussion →','/i/'+r.idea_id));return n;
 }
 if($('[data-design-feed]')){
  let offset=0,busy=false,generation=0;const list=$('[data-design-feed]'),message=$('[data-design-feedback]'),more=$('[data-design-more]'),filter=$('[data-design-filter]'),following=$('[data-following-filter]');
  const initial=new URLSearchParams(location.search).get('ship');if(initial&&[...filter.options].some(o=>o.value===initial))filter.value=initial;
  async function load(reset=false){if(busy&&!reset)return;if(reset){generation++;offset=0;list.replaceChildren();}const version=generation;busy=true;more.disabled=true;message.textContent='Loading conversations…';try{const query=new URLSearchParams({ship:filter.value,offset,following:following.checked?'1':'0'}),data=await api('/api/ship-designs?'+query);if(version!==generation)return;for(const idea of data.ideas)list.append(window.FleetCommunity.renderIdea(idea,{compact:true}));offset+=data.ideas.length;more.hidden=!data.has_more;message.textContent=offset?'':'No conversations here yet. Pick a ship and start one.';}catch(e){if(version===generation)message.textContent=e.message;}finally{if(version===generation){busy=false;more.disabled=false;}}}
  filter.onchange=()=>load(true);following.onchange=()=>load(true);filter.form.onsubmit=e=>e.preventDefault();more.onclick=()=>load();load();
 }
 if(key&&$('[data-ship-record]')){
  let offset=0,busy=false,following=false,viewer=null;const list=$('[data-ship-record]'),message=$('[data-ship-record-status]'),more=$('[data-record-more]'),follow=$('[data-follow-ship]');
  function followLabel(){follow.hidden=false;follow.textContent=following?'Following ship ✓':'Follow ship';if(window.FleetCreator?.authorized()){follow.hidden=true;$('[data-follow-status]').textContent='Fleet Command · You can discuss and record decisions as the developer.';}else $('[data-follow-status]').textContent=viewer?'Followed ships appear in your Ship Design filter.':'';}
  (window.FleetSession||api('/api/session')).then(s=>{viewer=s.profile;followLabel();}).catch(()=>{});window.addEventListener('fleet:creator',followLabel);window.addEventListener('fleet:session',e=>{viewer=e.detail?.profile;followLabel();});
  follow.onclick=async()=>{if(!viewer){location.assign('/register?return_to='+encodeURIComponent(location.pathname));return;}follow.disabled=true;try{const data=await api('/api/ship-designs/'+key+'/follow',{method:'POST',body:JSON.stringify({following:!following})});following=data.following;followLabel();}catch(e){$('[data-follow-status]').textContent=e.message;}finally{follow.disabled=false;}};
  async function load(){if(busy)return;busy=true;more.disabled=true;try{const data=await api('/api/ship-designs/'+key+'?offset='+offset);if(offset===0){following=data.following;followLabel();const state=$('[data-publication-state]');state.replaceChildren(document.createTextNode((data.current_revision===revision?'Published edition':'Earlier published edition')+' · '+revision.slice(4,12)+' '),link('Latest published edition →','/ships/designs/'+key+'/revisions/'+data.current_revision));if(data.lead?.profile){const lead=el('aside','lead-recognition');lead.append(el('p','eyebrow','Community Design Lead'),person(data.lead),el('p','field-hint','Recognized by Fleet Command. A contributor, not a moderator.'));list.before(lead);}}
    for(const r of data.events)list.append(record(r));offset+=data.events.length;more.hidden=!data.has_more;message.textContent=offset?'':'No decisions or contributor credits recorded yet.';if(/^#record-[a-f0-9-]{36}$/i.test(location.hash)){let target=document.getElementById(location.hash.slice(1));if(!target){const linked=await api('/api/ship-designs/'+key+'?event='+location.hash.slice(8));target=record(linked.event);list.prepend(target);}target.scrollIntoView();}
   }catch(e){message.textContent=e.message;if(e.code==='unpublished_ship')$('[data-publication-state]').textContent='Dossier preview · Discussion and design records open after publication.';}finally{busy=false;more.disabled=false;}}
  more.onclick=load;load();
 }
 const profile=location.pathname.match(/^\/u\/([a-f0-9-]+)\/?$/i);
 if(profile&&$('#fleet-record')){
  const box=el('section','ship-record'),title=el('h2','','Design contributions'),list=el('div'),message=el('p','field-hint'),more=el('button','text-button','More contributions');more.hidden=true;box.append(title,list,message,more);$('#fleet-record').after(box);let offset=0,busy=false;
  async function load(){if(busy)return;busy=true;try{const data=await api('/api/ship-designs/contributions/'+profile[1]+'?offset='+offset);data.events.forEach(r=>{const item=record(r);item.prepend(link(r.ship_title+' →',r.ship_path));list.append(item);});offset+=data.events.length;message.textContent=offset?'':'No credited ship contributions yet.';more.hidden=!data.has_more;}catch(e){message.textContent=e.message;}finally{busy=false;}}more.onclick=load;load();
 }
})();
