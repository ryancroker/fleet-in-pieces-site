(() => {
 'use strict';
 const toolsSrc=document.currentScript.dataset.toolsSrc;
 let authorized=false,toolsPromise,expiryTimer,authKnown=false,authFailed=false,identityKnown=false,profile=null,lastActive=null,checking=null,authGeneration=0,identityGeneration=0,identityChecking=null;
 let lastInteraction=Date.now(),lastPresenceAttempt=0,presencePending=false;
 const controls=new Set();
 const pacific=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const node=(tag,cls,text)=>{const x=document.createElement(tag);x.className=cls;x.textContent=text;return x;};
 function registrationURL(){
  const route=location.pathname;
  const target=/^\/(?:systems|ships)\/[a-z0-9-]+$/.test(route)||/^\/topics\/[1-9]\d*$/.test(route)?route+'#suggest':/^\/i\/[1-9]\d*$/.test(route)?route+'#replies-'+route.split('/').pop():'/community#topics';
  return '/register?return_to='+encodeURIComponent(target);
 }
 function paint(){
  const access=document.querySelector('[data-access-status]');
  if(access){
   access.classList.toggle('is-developer',authorized);access.replaceChildren();
   const title=authorized?'Developer access active · Fleet Command':profile?'Signed in as @'+profile.callsign:identityKnown?'Browsing as guest':authFailed?'Sign-in status unavailable':'Checking your sign-in…';
   access.append(node('strong','access-label',title));
   const detail=node('span','access-detail',authorized?(profile?'Community identity: @'+profile.callsign:identityKnown?'Community identity: guest':'Checking community identity…'):'');
   const destination=node('a',authorized?'button secondary':'text-button',authorized?'Open Fleet Command →':profile?'My account →':'Sign in / Join the Fleet');destination.href=authorized?'/crew':registrationURL();detail.append(destination);access.append(detail);
   if(authFailed){const retry=node('button','text-button','Check access again');retry.type='button';retry.addEventListener('click',check);access.append(retry);}
  }
  for(const link of document.querySelectorAll('a[href="/register"]'))link.href=registrationURL();
  for(const link of document.querySelectorAll('[data-developer-link]')){link.textContent=authorized?'Fleet Command · developer access active':'Developer sign in';link.href=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'/crew':'https://fleetinpieces.space/crew';}
  const stamp=document.querySelector('[data-developer-update]');
  const presenceTitle=document.querySelector('[data-presence-title]');if(presenceTitle)presenceTitle.textContent=lastActive?'Fleet Command checked in.':'Fleet Command.';
  if(stamp){stamp.hidden=!lastActive;if(lastActive){const time=node('time','',pacific.format(new Date(lastActive)));time.dateTime=lastActive;stamp.replaceChildren(node('span','','Updated '),time,node('small','','Last developer activity · Pacific time'));}}
 }
 function state(data){
  authorized=Boolean(data.authorized);authKnown=true;authFailed=false;
  const latest=data.last_developer_activity??data.last_developer_login;
  if(latest&&(!lastActive||Date.parse(latest)>Date.parse(lastActive)))lastActive=latest;
  clearTimeout(expiryTimer);
  if(authorized&&data.expires_at){const delay=Math.max(0,Date.parse(data.expires_at)-Date.now())+200;expiryTimer=setTimeout(()=>delay>2147483647?check():state({authorized:false}),Math.min(delay,2147483647));}
  if(!authorized){controls.forEach(n=>n.remove());controls.clear();}
  paint();window.dispatchEvent(new CustomEvent('fleet:creator',{detail:{authorized}}));
 }
 async function api(path,options={}){
  try{return await window.FleetRequest(path,options);}
  catch(error){if(error.status===401)state({authorized:false});throw error;}
 }
 async function check(){
  if(checking)return checking;
  const version=authGeneration;
  checking=window.FleetRequest('/api/admin/session').then(data=>{if(version!==authGeneration)return {authorized};state(data);recordPresence();return data;}).catch(()=>{if(version!==authGeneration)return {authorized};state({authorized:false});authKnown=false;authFailed=true;paint();return {authorized:false};}).finally(()=>{checking=null;});return checking;
 }
 async function recordPresence(){
  const now=Date.now();
  if(!authorized||document.hidden||presencePending||now-lastPresenceAttempt<10000||now-lastInteraction>300000)return;
  if(lastActive&&now-Date.parse(lastActive)<60000)return;
  lastPresenceAttempt=now;presencePending=true;const version=authGeneration;
  try{const result=await window.FleetRequest('/api/admin/presence',{method:'POST',body:'{}'});if(version===authGeneration)state(result);}
  catch(error){if(version===authGeneration&&error.status===401)state({authorized:false});}
  finally{presencePending=false;}
 }
 const ready=check();
 window.FleetSession ||= window.FleetRequest('/api/session');
 function identity(data){profile=data.profile||null;identityKnown=true;paint();}
 window.FleetSession.then(identity).catch(()=>{identityKnown=false;paint();});
 window.addEventListener('fleet:session',event=>{identityGeneration++;identity(event.detail);});
 function refreshIdentity(){
  if(identityChecking)return identityChecking;
  const version=identityGeneration;
  identityChecking=window.FleetRequest('/api/session').then(data=>{if(version!==identityGeneration)return;window.FleetSession=Promise.resolve(data);window.dispatchEvent(new CustomEvent('fleet:session',{detail:data}));}).catch(()=>{if(version===identityGeneration){profile=null;identityKnown=false;paint();}}).finally(()=>{identityChecking=null;});return identityChecking;
 }
 function returnToPage(){lastInteraction=Date.now();check();refreshIdentity();}
 window.addEventListener('pageshow',event=>{if(event.persisted)returnToPage();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)returnToPage();});
 for(const type of ['pointerdown','keydown','scroll'])document.addEventListener(type,event=>{if(event.isTrusted&&!document.hidden){lastInteraction=Date.now();recordPresence();}},{passive:true});
 // Visitors see check-ins without reloading. Only a recently used, visible
 // developer browser sends the authenticated POST; GET remains read-only.
 setInterval(()=>{if(!document.hidden)check();},60000);
 async function tools(){
  if(!authorized)throw Error('Unlock Fleet Command at /crew first.');
  if(!toolsPromise)toolsPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=toolsSrc;s.onload=()=>resolve(window.FleetCreatorTools);s.onerror=()=>{toolsPromise=null;reject(Error('Creator controls could not load. Try again.'));};document.head.append(s);});
  return toolsPromise;
 }
 function attach(parent,item,type){
  ready.then(async()=>{
   if(!authorized||!parent.isConnected)return;
   const host=document.createElement('div');host.className='creator-inline';host.dataset.creatorControl='';
   const button=document.createElement('button');button.type='button';button.className='text-button creator-manage';button.textContent=type==='ideas'?'Manage suggestion':'Manage reply';button.setAttribute('aria-expanded','false');
   const panel=document.createElement('div');panel.hidden=true;host.append(button,panel);parent.append(host);controls.add(host);
   button.addEventListener('click',async()=>{
    if(!panel.hidden){panel.hidden=true;button.setAttribute('aria-expanded','false');return;}
    panel.hidden=false;button.disabled=true;button.setAttribute('aria-expanded','true');panel.textContent='Loading creator controls…';
    try{const ui=await tools(),data=await api(`/api/admin/${type}/${item.id}`);panel.replaceChildren(type==='ideas'?await ui.ideaEditor(data.idea,()=>location.reload(),data.history):await ui.replyEditor(data.reply,()=>location.reload()));}
    catch(error){panel.textContent=error.message;}
    finally{button.disabled=false;}
   });
  });
 }
 window.FleetCreator={api,ready,tools,attachIdea:(p,i)=>attach(p,i,'ideas'),attachReply:(p,r)=>attach(p,r,'replies'),
  unlock:async(key,remember=false)=>{authGeneration++;const result=await api('/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+key},body:JSON.stringify({remember})});lastPresenceAttempt=Date.now();lastInteraction=lastPresenceAttempt;state(result);return result;},
  lock:async()=>{authGeneration++;await api('/api/admin/session',{method:'POST',body:JSON.stringify({logout:true})});state({authorized:false});},
  authorized:()=>authorized};
})();
