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
  const activityDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  function activityCard(event){
    const card=text('article','dispatch-card'+(event.is_developer?' official-post':''),'');
    const labels={topic:'New topic · approved',note:'Developer reply',topic_response:'Developer acknowledgement',post:event.is_developer?'Developer comment':'New comment',reply:event.is_developer?'Developer reply':'Crew reply'};
    card.append(text('p','eyebrow',labels[event.kind]||'Discussion update'));
    const heading=text('h3','',''),link=text('a','',event.topic_title);link.href=event.path;heading.append(link);card.append(heading);
    card.append(text('p','dispatch-excerpt',event.body));
    card.append(text('p',event.is_developer?'official-author':'dispatch-author',event.kind==='topic'?'Suggested by '+event.author:event.is_developer?'Fleet Command · Developer':event.author));
    const when=text('time','dispatch-date',activityDate.format(new Date(event.created_at)));when.dateTime=event.created_at;card.append(when);
    const action=text('a','back-link',event.kind==='topic'?'Add a comment →':'Read & reply →');action.href=event.path;card.append(action);
    return card;
  }
  function activityFeed(target,feedback,more,{official=false,limit=0}={}){
    let offset=0,busy=false;const seen=new Set();
    async function load(){
      if(busy)return;busy=true;if(more)more.disabled=true;feedback.textContent='Loading recent activity…';
      try{const data=await api('/api/activity?offset='+offset+(official?'&developer=1':''));
        const events=limit?data.activity.slice(0,limit):data.activity;
        for(const event of events)if(!seen.has(event.event_key)){seen.add(event.event_key);target.append(activityCard(event));}
        offset+=data.activity.length;if(more)more.hidden=!data.has_more;
        feedback.textContent=seen.size?'':official?'No developer replies yet. The discussions are open.':'No public activity yet. Pick a topic and start the conversation.';
      }catch(error){retry(feedback,error,load);}finally{busy=false;if(more)more.disabled=false;}
    }
    more?.addEventListener('click',load);load();
  }
  const activityList=document.querySelector('[data-activity-list]');
  if(activityList)activityFeed(activityList,document.querySelector('[data-activity-feedback]'),document.querySelector('[data-activity-more]'),{limit:Number(activityList.dataset.limit)||0});
  const developerList=document.getElementById('developer-replies-list');
  if(community&&developerList){
    activityFeed(developerList,document.getElementById('developer-replies-feedback'),document.getElementById('developer-replies-more'),{official:true});
  }
  const directory=document.querySelector('[data-topic-directory]');
  if(directory){
    const feedback=document.querySelector('[data-topic-feedback]');
    async function topics(){
      try{const data=await api('/api/content');const cards=[];
        for(const topic of data.content.sort((a,b)=>(b.latest_activity_at||'').localeCompare(a.latest_activity_at||'')||a.title.localeCompare(b.title))){
          const card=text('a','topic-tile','');card.href=topic.path+'#suggest';
          card.append(text('p','eyebrow',topic.credit?'Crew-proposed topic':'Game briefing'),text('h3','',topic.title),text('p','',topic.summary));
          if(topic.credit)card.append(text('strong','topic-proposer','Suggested by '+topic.credit.name));
          if(topic.acknowledgement==='already_in_game')card.append(text('span','topic-acknowledgement','Already in the game'));
          if(topic.latest_activity_at){const when=text('time','topic-date','Latest activity '+activityDate.format(new Date(topic.latest_activity_at)));when.dateTime=topic.latest_activity_at;card.append(when);}
          card.append(text('span','topic-enter',`${topic.idea_count} post${topic.idea_count===1?'':'s'} · ${topic.reply_count||0} replies · Add a comment →`));cards.push(card);
        }
        directory.replaceChildren(...cards);feedback.textContent='';
      }catch(error){retry(feedback,error,topics);}
    }topics();
  }
  const proposal=document.getElementById('topic-proposal-form');
  if(proposal){
    const message=proposal.querySelector('.form-feedback'),submit=proposal.querySelector('button'),key='fip-topic-draft-v1';
    let requestId=crypto.randomUUID(),sending=false;
    try{const draft=JSON.parse(sessionStorage.getItem(key)||'null');if(draft){for(const field of ['title','body','handle'])proposal.elements[field].value=draft[field]||'';requestId=draft.request_id||requestId;}}catch{}
    function remember(){try{sessionStorage.setItem(key,JSON.stringify({title:proposal.elements.title.value,body:proposal.elements.body.value,handle:proposal.elements.handle.value,request_id:requestId}));}catch{}}
    proposal.addEventListener('input',()=>{if(!sending){requestId=crypto.randomUUID();remember();}});
    window.FleetSession ||= api('/api/session').catch(()=>({profile:null}));
    function identity(data){const handle=proposal.elements.handle,label=proposal.querySelector('[for="topic-handle"]');handle.hidden=label.hidden=Boolean(data.profile);document.getElementById('topic-identity').textContent=data.profile?`You’ll be credited as @${data.profile.callsign}, with a link to your service record.`:'Registered members receive a profile link. Guest callsigns are unverified; blank means Anonymous crew.';}
    window.FleetSession.then(identity).catch(()=>{});window.addEventListener('fleet:session',event=>identity(event.detail));
    proposal.addEventListener('submit',async event=>{
      event.preventDefault();if(sending||!proposal.reportValidity())return;sending=true;remember();
      const payload={title:proposal.elements.title.value,body:proposal.elements.body.value,handle:proposal.elements.handle.value,website:proposal.elements.website.value,request_id:requestId};
      [...proposal.elements].forEach(x=>x.disabled=true);message.textContent='Sending privately…';message.classList.remove('error');
      try{await api('/api/topic-proposals',{method:'POST',body:JSON.stringify(payload)});proposal.reset();requestId=crypto.randomUUID();try{sessionStorage.removeItem(key);}catch{}message.textContent='Received privately. Only Fleet Command can see it until approved. Your credit stays attached if it is published.';}
      catch(error){message.textContent=error.message;message.classList.add('error');}
      finally{sending=false;[...proposal.elements].forEach(x=>x.disabled=false);}
    });
  }
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
