(() => {
 'use strict';
 const creator=window.FleetCreator,overview=document.getElementById('crew-overview'),proposals=document.getElementById('crew-topics');
 if(!creator||!overview)return;
 const n=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=value;return x;};
 const button=(label,action,cls='text-button')=>{const x=n('button',cls,label);x.type='button';x.addEventListener('click',action);return x;};
 const link=(label,path,cls='back-link')=>{const x=n('a',cls,label);x.href=path;return x;};
 const date=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
 let section='overview',days=7,epoch=0,loading=false,topicStatus='pending',topicOffset=0,topicVersion=0,topicBusy=false;
 const topicSeen=new Set();
 function navigate(value,view){window.dispatchEvent(new CustomEvent('fleet:desk-section',{detail:{section:value,view}}));}
 function errorAt(host,error,retry){host.replaceChildren(n('p','form-feedback error',error.message),button('Try again',retry));}
 function safetyPanel(state){
  const panel=n('section','dashboard-panel');panel.dataset.writeSafety='';panel.append(n('p','eyebrow','Community cost safety'),n('h3','',state.enabled?'Community writes enabled':'Community is read-only'));
  const reasons={environment_switch:'COMMUNITY_WRITES_ENABLED=false',manual_pause:'Paused by Fleet Command',budget_reached:'Automatic write budget reached',accounting_incomplete:'Write accounting needs attention'};
  panel.append(n('p','',state.enabled?'Global fuse armed.':reasons[state.reason]||'Safety gate closed.'));
  const metrics=n('div','dashboard-metrics');
  for(const [label,value] of [['Write attempts this UTC minute',state.counters.minute.attempts],['Write attempts this UTC hour',state.counters.hour.attempts],['Recorded D1 rows today',state.counters.day.rows],['Projected D1 rows / day',state.estimated_daily_rows]]){
   const box=n('div','dashboard-metric');box.append(n('span','',label),n('strong','',Number(value).toLocaleString()));metrics.append(box);
  }
  panel.append(metrics);
  for(const [window,c] of Object.entries(state.counters))panel.append(n('p','field-hint',`${window}: ${c.attempts.toLocaleString()} / ${c.limits.attempts.toLocaleString()} write attempts · ${c.rows.toLocaleString()} / ${c.limits.rows.toLocaleString()} recorded rows`));
  panel.append(n('p','field-hint','Write rate limits: active · shared D1 limits for each identity and network. Public read burst shielding stays in memory and makes no D1 writes.'),n('p','field-hint','100ms CPU cap · 50 database statements per request. Native subrequest setting requested; Cloudflare Pages does not confirm it. These are application safeguards, not a dollar cap.'),n('p','field-hint','Rows cover observed non-admin write requests, including their rate limits and estimated fuse bookkeeping. Projection uses today’s observed rate with a one-hour minimum; it is not billing data. UTC calendar windows. Failed admitted attempts also count.'));
  if(state.pending)panel.append(n('p','form-feedback',`${state.pending} write${state.pending===1?'':'s'} awaiting accounting. Row totals may be incomplete.${state.stale_pending?' Inspect the cause before resuming.':''}`));
  if(state.tripped_at)panel.append(n('p','field-hint','Fuse tripped '+date(state.tripped_at)+'. It will not reopen automatically.'));
  const controls=n('div','sort-controls'),note=n('p','form-feedback');
  for(const [action,label]of [['pause','Pause community writes'],['resume','Reset fuse / resume writes']]){
   const control=button(label,async()=>{
    const message=action==='pause'?'Pause community changes? Browsing and Fleet Command will stay available.':'Resume community writes after reviewing the spike? This preserves all budget counters. All write accounting must be complete.';
    if(!window.confirm(message))return;control.disabled=true;
    try{await creator.api('/api/admin/safety',{method:'POST',body:JSON.stringify({action,revision:state.revision,confirm:true})});await refresh();}
    catch(error){note.textContent=error.message;control.disabled=false;}
   },'button secondary');
   control.disabled=action==='pause'?state.manually_paused:state.enabled||!state.configured||!state.reset_allowed;controls.append(control);
  }
  panel.append(controls,note,n('p','field-hint','Emergency override: COMMUNITY_WRITES_ENABLED=false in wrangler.toml, then deploy. Set true again before using Resume. Reset never clears minute/hour/day/month budgets.'));
  return panel;
 }
 function render(data){
  const header=n('div','dashboard-heading'),heading=n('div');heading.append(n('p','eyebrow','Fleet Command / activity'),n('h2','','The state of the fleet.'));
  const controls=n('div','sort-controls');for(const count of [7,30]){const b=button(`${count} days`,()=>{if(!loading){days=count;refresh();}});b.setAttribute('aria-pressed',String(days===count));controls.append(b);}controls.append(button('Refresh',refresh));header.append(heading,controls);
  const metrics=n('div','dashboard-metrics');
  for(const [kind,label] of [['idea','Game ideas'],['conversation','Social posts'],['reply','Crew replies'],['vote','Active votes'],['developer','Your replies'],['register','New registrations'],['proposal','Topic proposals']]){
   const item=n('div','dashboard-metric');item.append(n('span','',label),n('strong','',data.counts[kind]??0),n('small','',`${data.totals[kind]??0} total`));metrics.append(item);
  }
  const attention=n('div','dashboard-attention');
  attention.append(button(`${data.attention.topics} topic proposal${data.attention.topics===1?'':'s'} to review`,()=>navigate('topics'),'button secondary'),button(`${data.attention.needs_response} suggestions without your reply`,()=>navigate('inbox','needs_response'),'text-button'),button(`${data.attention.reports} unresolved reports`,()=>navigate('inbox','reports'),'text-button'));
  attention.append(button('Published topics · add a comment',()=>{topicStatus='approved';navigate('topics');},'button secondary'),link('What’s new across the site →','/activity#latest'));
  const trend=n('section','dashboard-panel');trend.append(n('h3','','Daily activity'),n('p','field-hint','Game ideas, social posts, crew replies, active votes, your first replies, registrations, and topic proposals. Pacific calendar days; today is partial.'));
  const chart=n('div','activity-chart');chart.setAttribute('role','img');const total=row=>row.idea+(row.conversation||0)+row.reply+row.vote+row.developer+row.register+(row.proposal||0);const maximum=Math.max(1,...data.daily.map(total));
  chart.setAttribute('aria-label',data.daily.map(row=>`${row.date}: ${total(row)} activities`).join('; '));
  for(const row of data.daily){const column=n('div','activity-column'),bar=n('span','activity-bar');bar.style.height=`${total(row)/maximum*100}%`;column.title=`${row.date}: ${total(row)} — ${row.idea} ideas, ${row.conversation||0} social posts, ${row.reply} replies, ${row.vote} active votes, ${row.developer} developer replies, ${row.register} registrations, ${row.proposal||0} topic proposals`;column.append(bar);chart.append(column);}
  const range=n('div','chart-range');range.append(n('span','',data.daily[0].date),n('span','','Today'));trend.append(chart,range);
  const panels=n('div','dashboard-columns'),recent=n('section','dashboard-panel'),activity=n('section','dashboard-panel');recent.append(n('h3','','Recent dispatches'));
  const labels={conversation:'Social post',idea:'New idea',reply:'Crew reply',vote:'Active support',developer:'Your reply',developer_post:'Your comment',developer_reply:'Your reply',developer_edit:'Your reply updated',developer_topic:'Your topic response',register:'Joined the register',proposal:'Topic proposed'};
  for(const event of data.recent){const row=n('article','activity-row'+(event.kind.startsWith('developer')?' activity-official':''));row.append(n('p','eyebrow',labels[event.kind]),n('p','',event.kind==='vote'?`${event.amount} active vote${event.amount===1?'':'s'} · ${event.content_title}`:`${event.author}${event.content_title&&event.kind!=='register'?' · '+event.content_title:''}`));if(event.body)row.append(n('p','activity-excerpt',event.body));const when=n('time','field-hint',date(event.created_at));when.dateTime=event.created_at;row.append(when);if(event.idea_id)row.append(link('Open discussion →','/i/'+event.idea_id));if(event.kind==='developer_topic')row.append(link('Open your response →',event.content_path+'#fleet-response'));if(event.kind==='proposal')row.append(button('Review topic proposals →',()=>navigate('topics')));recent.append(row);}
  if(!data.recent.length)recent.append(n('p','field-hint','No recorded activity in this period yet.'));
  activity.append(n('h3','','Active discussions'));
  for(const topic of data.topics){const row=n('div','activity-row');row.append(link(topic.content_title,topic.content_path),n('p','field-hint',`${topic.ideas} ideas · ${topic.conversations||0} social posts · ${topic.replies} crew replies · ${topic.votes} active votes · ${topic.developer_replies} developer replies`));activity.append(row);}
  if(!data.topics.length)activity.append(n('p','field-hint','No topic activity in this period yet.'));
  const traffic=n('div','traffic-summary');traffic.append(n('p','eyebrow','Visitor traffic'),n('h3','','Available in Cloudflare'),n('p','field-hint','Traffic statistics are not connected to this desk. Community activity above is not a visitor count. Cloudflare has the site’s visitor report. Earlier developer and automated review visits cannot all be reliably separated.'));
  const trafficLink=link('Open Cloudflare Web Analytics ↗',data.traffic.url);trafficLink.target='_blank';trafficLink.rel='noopener noreferrer';traffic.append(trafficLink);activity.append(traffic);panels.append(recent,activity);
  overview.replaceChildren(header,...(data.write_fuse?[safetyPanel(data.write_fuse)]:[]),metrics,attention,trend,panels,n('p','dashboard-footnote',`Updated ${date(data.as_of)}. Visible community records plus private topic proposals. Topic totals include pending, approved and declined submissions, counted once when received. Votes still active today are grouped by their original date; removed votes are not a historical traffic log. Official comments, replies and topic acknowledgements count as your replies; editing a note does not add another reply.`));
 }
 async function refresh(){
  if(!creator.authorized()||section!=='overview'||loading)return;loading=true;const current=epoch;
  if(!overview.children.length)overview.textContent='Loading activity…';
  try{const data=await creator.api('/api/admin/dashboard?days='+days);if(current===epoch&&creator.authorized())render(data);}
  catch(error){if(current===epoch&&creator.authorized())errorAt(overview,error,refresh);}
  finally{if(current===epoch)loading=false;}
 }
 function field(form,label,name,value,max,multiline=false){const id='proposal-'+form.dataset.id+'-'+name,l=n('label','',label),input=n(multiline?'textarea':'input');l.htmlFor=id;input.id=id;input.name=name;input.value=value;input.maxLength=max;input.required=true;input.minLength=multiline?8:3;if(multiline)input.rows=4;form.append(l,input);return input;}
 function proposalCard(item){
  const card=n('article','topic-review crew-card');card.append(n('p','eyebrow',`${item.status} / proposal ${item.id}`),n('h3','',item.title));
  const credit=n('div','topic-review-credit');credit.append(n('span','','Suggested by '),item.credit.path?link(item.credit.name,item.credit.path):n('strong','',item.credit.name));card.append(credit,n('p','crew-body',item.body),n('p','field-hint','Received '+date(item.created_at)));
  const published=item.status==='approved';
  if(published)card.append(link('Open topic & comment →',item.path+'#suggest','button secondary'));
  const form=n('form','topic-review-form');form.dataset.id=item.id;
  const shortcut=button('Already in the game · thank the player',()=>{
   decision.value='already_in_game';if(!response.value.trim())response.value='Good instincts — this is already in the game! Thanks for bringing it up. Keep the ideas coming.';
   refresh();response.focus();
  },'button secondary topic-thanks-shortcut');form.append(shortcut);
  const choiceId='proposal-'+item.id+'-acknowledgement',choiceLabel=n('label','','How should Fleet Command respond?'),decision=n('select');choiceLabel.htmlFor=choiceId;decision.id=choiceId;decision.name='acknowledgement';
  for(const [value,label] of [['','Open discussion'],['already_in_game','Already in the game']]){const option=n('option','',label);option.value=value;decision.append(option);}decision.value=item.acknowledgement||'';form.append(choiceLabel,decision);
  const response=field(form,'Your public developer reply','developer_response',item.developer_response||'',2000,true);response.placeholder='Thank them, explain what already works, and clarify any parts that are not there yet.';
  const hint=n('p','field-hint');form.append(hint);
  field(form,'Public topic title','title',published?item.published_title:item.title,100);field(form,'Public introduction','summary',published?item.published_summary:item.body,2000,true);
  form.append(n('p','field-hint','The player keeps their credit and the discussion stays open. Already in the game does not count as implemented from feedback.'));
  const actions=n('div','actions'),publish=n('button','button primary','');publish.type='submit';const note=n('p','form-feedback');note.setAttribute('role','status');
  function refresh(){const already=decision.value==='already_in_game';response.required=already;response.minLength=already?8:0;hint.textContent=already?'Required: a friendly acknowledgement. Add what exists today; qualify anything that is only partly there.':'Optional: add a public reply alongside the topic.';publish.textContent=published?'Save response':already?'Publish acknowledgement & topic':'Publish topic';}
  decision.addEventListener('change',refresh);refresh();
  let saving=false;
  async function decide(status){if(saving)return;if(status==='approved'&&!form.reportValidity())return;saving=true;[...form.elements].forEach(x=>x.disabled=true);note.textContent=status==='approved'?'Saving…':'Filing privately…';
   try{const result=await creator.api('/api/admin/topics/'+item.id,{method:'PATCH',body:JSON.stringify({revision:item.revision,status,title:form.elements.title.value,summary:form.elements.summary.value,acknowledgement:decision.value,developer_response:response.value})});form.replaceChildren(n('p','form-feedback',status==='approved'?'Saved. Your reply is public, the player is credited, and the discussion is open.':'Declined. This proposal remains private.'));if(result.path){if(response.value.trim())form.append(link('Read your response →',result.path+'#fleet-response','button primary'));form.append(link('Open topic & comment →',result.path+'#suggest'));}}
   catch(error){note.textContent=error.message;note.classList.add('error');[...form.elements].forEach(x=>x.disabled=false);}
   finally{saving=false;}
  }
  actions.append(publish);if(!published&&item.status!=='declined')actions.append(button('Decline privately',()=>decide('declined')));form.append(actions,note);form.addEventListener('submit',event=>{event.preventDefault();decide('approved');});card.append(form);return card;
 }
 async function loadTopics(reset=false){
  if(!creator.authorized())return;if(!reset&&topicBusy)return;
  if(reset){topicVersion++;topicOffset=0;topicSeen.clear();const heading=n('div','dashboard-heading'),controls=n('div','sort-controls');heading.append(n('h2','','Topic proposals.'));for(const status of ['pending','approved','declined']){const b=button(status[0].toUpperCase()+status.slice(1),()=>{topicStatus=status;loadTopics(true);});b.setAttribute('aria-pressed',String(topicStatus===status));controls.append(b);}controls.append(button('Refresh',()=>loadTopics(true)));heading.append(controls);const note=n('p','form-feedback');note.dataset.proposalFeedback='';note.setAttribute('role','status');const list=n('div');list.dataset.proposalList='';const more=button('Load more',()=>loadTopics());more.dataset.proposalMore='';more.hidden=true;proposals.replaceChildren(heading,n('p','section-note','Pending and declined proposals are visible only here. Publish one to open it to everyone, with the submitter’s credit.'),note,list,more);}
  const current=topicVersion;topicBusy=true;const note=proposals.querySelector('[data-proposal-feedback]'),list=proposals.querySelector('[data-proposal-list]'),more=proposals.querySelector('[data-proposal-more]');note.textContent='Loading proposals…';more.disabled=true;
  try{const data=await creator.api(`/api/admin/topics?status=${topicStatus}&offset=${topicOffset}`);if(current!==topicVersion||!creator.authorized())return;for(const item of data.proposals)if(!topicSeen.has(item.id)){topicSeen.add(item.id);list.append(proposalCard(item));}topicOffset+=data.proposals.length;more.hidden=!data.has_more;note.textContent=topicSeen.size?'':`No ${topicStatus} proposals.`;}
  catch(error){if(current===topicVersion&&creator.authorized())errorAt(note,error,()=>loadTopics());}
  finally{if(current===topicVersion){topicBusy=false;more.disabled=false;}}
 }
 window.FleetDashboard={show(value){section=value;if(value==='overview')refresh();if(value==='topics')loadTopics(true);},clear(){epoch++;topicVersion++;loading=topicBusy=false;overview.replaceChildren();proposals.replaceChildren();topicSeen.clear();}};
 window.addEventListener('fleet:resume',refresh);
 setInterval(()=>{if(window.FleetActive())refresh();},120000);
})();
