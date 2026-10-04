(() => {
  'use strict';
  const community = window.FleetCommunity;
  const api = window.FleetRequest;
  function text(tag, className, value) { const element=document.createElement(tag); element.className=className; element.textContent=value; return element; }
  function retry(feedback, error, action) {
    feedback.classList.remove('empty-record');
    feedback.replaceChildren(document.createTextNode(error.message || 'The dispatches are temporarily unavailable.'));
    const button=text('button','text-button','Try again');button.type='button';button.addEventListener('click',action);feedback.append(button);
  }
  function fill(target, feedback, ideas, emptyTitle, emptyCopy) {
    target.replaceChildren(); feedback.replaceChildren(); feedback.classList.remove('empty-record');
    if(!Array.isArray(ideas)) throw Error('The dispatches could not be loaded. Please retry.');
    if(!ideas.length){feedback.classList.add('empty-record');feedback.append(text('strong','',emptyTitle),document.createTextNode(emptyCopy));return;}
    for(const idea of ideas.slice(0,Number(target.dataset.limit)||ideas.length))target.append(community.renderIdea(idea,{compact:true}));
  }
  const trending=document.getElementById('trending-ideas'), implemented=document.getElementById('implemented-ideas');
  if(community && (trending || implemented)){
    const trendMessage=document.getElementById('trending-feedback'),implementedMessage=document.getElementById('implemented-feedback');
    let busy=false;
    async function load(){
      if(busy)return;busy=true;
      try{const data=await api('/api/discovery');if(trending)fill(trending,trendMessage,data.trending,'The floor is open.','Read a briefing and give the fleet something to argue about.');if(implemented)fill(implemented,implementedMessage,data.implemented,'Nothing filed as implemented yet.','Completed ideas will appear here when Fleet Command marks them implemented.');}
      catch(error){if(trending)retry(trendMessage,error,load);if(implemented)retry(implementedMessage,error,load);}finally{busy=false;}
    }
    load();
  }
  const contentHistory=document.querySelector('[data-implemented-content]');
  if(community && contentHistory){
    const message=document.querySelector('[data-implemented-feedback]');let busy=false;
    async function load(){if(busy)return;busy=true;try{const data=await api(`/api/ideas?system=${encodeURIComponent(contentHistory.dataset.implementedContent)}&sort=implemented`);fill(contentHistory,message,data.ideas.slice(0,4),'The record starts here.','No implemented feedback has been filed for this system yet.');}catch(error){retry(message,error,load);}finally{busy=false;}}
    load();
  }
  const lookup=document.getElementById('profile-search');
  if(lookup)lookup.addEventListener('submit',async event=>{
    event.preventDefault();if(!lookup.reportValidity())return;
    const message=document.getElementById('lookup-feedback'),button=lookup.querySelector('button');button.disabled=true;message.textContent='Searching the register…';
    try{
      const data=await api(`/api/profiles?callsign=${encodeURIComponent(lookup.elements.callsign.value.trim().replace(/^@/,''))}`);
      message.replaceChildren();
      const profile=Array.isArray(data.profiles)?data.profiles[0]:null;
      if(!profile){message.textContent='No registered identity has that callsign.';return;}
      const link=text('a','back-link',`Open @${profile.callsign}’s service record →`);link.href=`/u/${encodeURIComponent(profile.id)}`;message.append(link);
    }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
  });
  document.querySelectorAll('.site-header nav a').forEach(link=>{const url=new URL(link.href);if(url.origin===location.origin && (url.pathname===location.pathname || (link.pathname==='/systems'&&location.pathname.startsWith('/systems/')) || (link.pathname==='/ships'&&location.pathname.startsWith('/ships/')) || (link.pathname==='/community'&&(/^(\/u\/|\/i\/)/.test(location.pathname)||['/fleet','/register'].includes(location.pathname)))))link.setAttribute('aria-current','page');});
  const registerLinks=document.querySelectorAll('[data-register-link]');
  function setIdentity(data){registerLinks.forEach(link=>{link.textContent=data?.profile?'My service record':'Register / sign in';link.href=data?.profile?`/u/${encodeURIComponent(data.profile.id)}`:'/register';});}
  if(registerLinks.length){window.FleetSession ||= api('/api/session').catch(()=>({profile:null}));window.FleetSession.then(setIdentity).catch(()=>{});window.addEventListener('fleet:session',event=>setIdentity(event.detail));}
})();
