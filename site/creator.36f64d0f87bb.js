(() => {
 'use strict';
 const toolsSrc=document.currentScript.dataset.toolsSrc;
 let authorized=false,toolsPromise,expiryTimer,authKnown=false,authFailed=false,identityKnown=false,profile=null,lastLogin=null,checking=null;
 const controls=new Set();
 const pacific=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const node=(tag,cls,text)=>{const x=document.createElement(tag);x.className=cls;x.textContent=text;return x;};
 function paint(){
  const access=document.querySelector('[data-access-status]');
  if(access){
   access.classList.toggle('is-developer',authorized);access.replaceChildren();
   const title=authorized?'Developer access active · Fleet Command':authFailed?'Developer access unconfirmed':!authKnown?'Checking developer access…':profile?'Signed in as @'+profile.callsign:identityKnown?'Browsing as guest':'Community identity unconfirmed';
   access.append(node('strong','access-label',title));
   const detail=node('span','access-detail',authorized?(profile?'Community identity: @'+profile.callsign:identityKnown?'Community identity: guest':'Checking community identity…'):'');
   const destination=node('a','',authorized?'Open Fleet Command →':profile?'My service record →':'Register / sign in →');destination.href=authorized?'/crew':profile?'/u/'+encodeURIComponent(profile.id):'/register';detail.append(destination);access.append(detail);
   if(authFailed){const retry=node('button','text-button','Check access again');retry.type='button';retry.addEventListener('click',check);access.append(retry);}
  }
  const stamp=document.querySelector('[data-developer-update]');
  if(stamp){stamp.hidden=!lastLogin;if(lastLogin){const time=node('time','',pacific.format(new Date(lastLogin))+' · Pacific time');time.dateTime=lastLogin;stamp.replaceChildren(node('span','','Updated '),time,node('small','','Last developer login'));}}
 }
 function state(data){
  authorized=Boolean(data.authorized);authKnown=true;authFailed=false;if(data.last_developer_login!==undefined)lastLogin=data.last_developer_login;
  clearTimeout(expiryTimer);
  if(authorized&&data.expires_at)expiryTimer=setTimeout(()=>state({authorized:false}),Math.max(0,Date.parse(data.expires_at)-Date.now())+200);
  if(!authorized){controls.forEach(n=>n.remove());controls.clear();}
  paint();window.dispatchEvent(new CustomEvent('fleet:creator',{detail:{authorized}}));
 }
 async function api(path,options={}){
  try{return await window.FleetRequest(path,options);}
  catch(error){if(error.status===401)state({authorized:false});throw error;}
 }
 async function check(){
  if(checking)return checking;
  checking=api('/api/admin/session').then(data=>{state(data);return data;}).catch(()=>{state({authorized:false});authKnown=false;authFailed=true;paint();return {authorized:false};}).finally(()=>{checking=null;});return checking;
 }
 const ready=check();
 window.FleetSession ||= window.FleetRequest('/api/session');
 function identity(data){profile=data.profile||null;identityKnown=true;paint();}
 window.FleetSession.then(identity).catch(()=>{identityKnown=false;paint();});
 window.addEventListener('fleet:session',event=>identity(event.detail));
 window.addEventListener('pageshow',event=>{if(event.persisted)check();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
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
  unlock:async key=>{const result=await api('/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+key},body:'{}'});state(result);return result;},
  lock:async()=>{await api('/api/admin/session',{method:'POST',body:JSON.stringify({logout:true})});state({authorized:false});},
  authorized:()=>authorized};
})();
