(() => {
  const list=document.querySelector('#support-list'),feedback=document.querySelector('#inbox-feedback'),filter=document.querySelector('#support-status'),safety=document.querySelector('#support-safety');
  let offset=0,rows=[],budget=null;
  const labels={bug:'Bug or technical issue',accessibility:'Accessibility',website:'Website',other:'Other'};
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  async function api(method,data){const response=await fetch('/api/support'+(method==='GET'?'?status='+filter.value+'&offset='+offset:''),{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.message||'Support could not be loaded.');return result;}
  function render(){list.replaceChildren();for(const report of rows){
    const article=node('article',undefined,'support-report'),heading=node('h2',report.subject),meta=node('p',labels[report.category]+' · '+new Date(report.created_at).toLocaleString(),'support-meta');
    article.append(heading,meta,node('p','Reference: '+report.id,'support-meta'),node('p',report.body,'report-body'));
    if(report.game_version)article.append(node('p','Version / system: '+report.game_version));
    article.append(node('p',report.contact_email?'Reply email: '+report.contact_email:'No reply email supplied.','support-meta'));
    const form=node('form'),status=node('select'),note=node('textarea');
    status.id='status-'+report.id;note.id='note-'+report.id;note.maxLength=2000;note.rows=3;note.value=report.private_note;
    for(const value of ['new','reviewing','closed']){const option=node('option',value[0].toUpperCase()+value.slice(1));option.value=value;status.append(option);}status.value=report.status;
    const statusLabel=node('label','Status');statusLabel.htmlFor=status.id;const noteLabel=node('label','Private note');noteLabel.htmlFor=note.id;
    const save=node('button','Save status & note','button button-outline');save.type='submit';const message=node('p');message.setAttribute('role','status');
    form.append(statusLabel,status,noteLabel,note,save,message);article.append(form);list.append(article);
    form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;message.textContent='Saving…';try{const result=await api('PATCH',{id:report.id,revision:report.revision,status:status.value,private_note:note.value});report.revision=result.revision;report.status=status.value;report.private_note=note.value;message.textContent='Saved privately. No message was sent.';}catch(error){message.textContent=error.message;}finally{save.disabled=false;}});
  }}
  function renderSafety(){safety.replaceChildren();if(!budget)return;safety.append(node('h2','Support intake safety'),node('p',budget.enabled?'Accepting reports.':'Reports paused: '+budget.reason.replaceAll('_',' ')),node('p','Shared request budget: '+budget.counters.day.attempts+' / '+budget.counters.day.limits.attempts+' today.','support-meta'));
    if(!budget.configured){safety.append(node('p','The support deployment switch is off. Changing this requires an approved deployment.'));return;}
    const action=budget.enabled?'pause':'resume',button=node('button',action==='pause'?'Pause support intake':'Resume support intake','button button-outline');button.type='button';button.disabled=action==='resume'&&!budget.reset_allowed;safety.append(button);
    button.addEventListener('click',async()=>{if(!confirm(action==='pause'?'Pause new support reports? Existing reports remain available.':'Resume support intake within the existing safety budgets? Retired community forms stay disabled.'))return;button.disabled=true;try{await api('PATCH',{control:{action,revision:budget.revision,confirm:true}});await load();}catch(error){feedback.textContent=error.message;button.disabled=false;}});
  }
  async function load(){feedback.textContent='Loading support…';try{const result=await api('GET');rows=result.requests;budget=result.safety;render();renderSafety();feedback.textContent=rows.length?'':'No reports in this view.';document.querySelector('#support-next').disabled=!result.has_more;document.querySelector('#support-prev').disabled=offset===0;document.querySelector('#inbox-controls').hidden=false;}catch(error){list.replaceChildren();safety.replaceChildren();feedback.textContent=error.message;}}
  filter.addEventListener('change',()=>{offset=0;load();});document.querySelector('#support-refresh').addEventListener('click',load);document.querySelector('#support-next').addEventListener('click',()=>{offset+=25;load();});document.querySelector('#support-prev').addEventListener('click',()=>{offset=Math.max(0,offset-25);load();});load();
})();
