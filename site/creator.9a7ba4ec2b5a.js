(() => {
 'use strict';
 const toolsSrc=document.currentScript.dataset.toolsSrc;
 let authorized=false,toolsPromise;
 const controls=new Set();
 function state(active){authorized=Boolean(active);if(!authorized){controls.forEach(n=>n.remove());controls.clear();}window.dispatchEvent(new CustomEvent('fleet:creator',{detail:{authorized}}));}
 async function api(path,options={}){
  try{return await window.FleetRequest(path,options);}
  catch(error){if(error.status===401)state(false);throw error;}
 }
 const ready=api('/api/admin/session').then(data=>{state(data.authorized);return data;}).catch(()=>({authorized:false}));
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
  unlock:async key=>{const result=await api('/api/admin/session',{method:'POST',headers:{Authorization:'Bearer '+key},body:'{}'});state(result.authorized);return result;},
  lock:async()=>{await api('/api/admin/session',{method:'POST',body:JSON.stringify({logout:true})});state(false);},
  authorized:()=>authorized};
})();
