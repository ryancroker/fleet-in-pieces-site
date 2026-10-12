(()=>{'use strict';
 const $=id=>document.getElementById(id),M=window.FleetHullFit,R=window.FleetHullRenderer,D=window.FleetDesignerData;
 if(!$('refit-workshop')||!M||!R||!D)return;
 const standardPresentation=['.lab-intro h1','.lab-intro>div>p:not(.eyebrow)','.lab-build-tag','.refit-scope'].map(selector=>({selector,text:document.querySelector(selector).textContent}));
 const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const svg=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const kw=n=>n>0&&n<1000?n.toLocaleString('en-US',{maximumFractionDigits:1})+' W':(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' kW';
 const tonnes=n=>(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' t';
 const description={gun:'Weapon and its native mounting assembly. Removing it frees its power demand; its ammunition supply stays a separate system.',shield:'A physical shield projector. Removing it leaves this mount empty and removes its local power demand.',reactor:'Power generation and its attached machinery. Equipment still needs a surviving reactor connected through its exported feeds.',drive:'Main propulsion hardware. Removing it reduces thrust and demand. Other drives keep their own fuel and power requirements.',jet:'A physical attitude thruster. Removing it reduces available maneuvering hardware; this preview does not simulate flight.',fuel_tank:'A finite propellant store. Emptying or removing it can starve dependent propulsion.',magazine:'A finite ammunition store. Dependent weapons need a fitted, nonempty supply.'};
 let model,fit,derived,crewRoom=null,view='hero',filter='all',machine=-1,loading=false,loadTicket=0,undo=[],pins=[],storage=true;
 const selected=()=>model?.refit.modules.find(m=>m.id===fit?.selected);
 const key=()=> 'fleet-hull-fit:hull-fit-1:'+model.definitionHash;
 const visible=m=>(fit.section==='all'||M.section(model,m)===fit.section)&&(filter==='all'||filter==='empty'&&fit.removed.includes(m.id)||filter===m.kind);
 const save=()=>{try{localStorage.setItem(key(),JSON.stringify(fit));$('refit-save-status').textContent='Loadout saved in this browser · no account needed';}catch{storage=false;$('refit-save-status').textContent='Storage unavailable · share a link to keep your loadout';}};
 function change(message,mutate){if(loading||!fit)return;undo.push(JSON.stringify(fit));if(undo.length>20)undo.shift();mutate();save();render();$('refit-event').textContent=message;$('refit-share-result').hidden=true;}
 function updateControls(){const m=selected();$('refit-controls').hidden=!m;if(!m){$('refit-kind').textContent=model.crewFamily?'CREW FIT / EXACT NATIVE PACKAGE':'NATIVE EQUIPMENT';$('refit-component').textContent=model.crewFamily?'Room for the crew.':'Fixed native architecture';$('refit-description').textContent=model.crewFamily?'This complete fit includes its own quarters and life support. Main drives and thrusters retain the exported 75% limits. Compare Minimum, Watch and Reserve, then plan the people below.':'This edition has no independently removable modules in the current contract. Its integrated systems remain available for inspection.';return;}
  const empty=fit.removed.includes(m.id);$('refit-component').textContent=m.name;$('refit-kind').textContent=M.section(model,m)+' / '+m.kind.replaceAll('_',' ');$('refit-description').textContent=description[m.kind]||'Registered hardware on its original mount.';
  $('refit-article').value=empty?'empty':'stock';$('refit-toggle').textContent=empty?'Install registered module':'Remove module';
  const off=m.machines.filter(i=>!derived.result.rows[i].ready);
  $('refit-module-state').textContent=empty?'Empty mount · original module available to reinstall':off.length?model.machines[off[0]].name+': '+derived.result.rows[off[0]].reason:'Installed · machinery ready in this model';
  const draw=m.machines.reduce((n,i)=>n+model.machines[i].DemandWatts,0),output=m.machines.reduce((n,i)=>n+model.machines[i].GenerationWatts,0);
  const facts=[['Native material',tonnes(m.massKg)],['Power demand',kw(empty?0:draw)],['Machinery',m.machines.length+' components'],['Mount',empty?'Empty':'Occupied']];if(output)facts.splice(2,0,['Rated generation',kw(empty?0:output)]);
  $('refit-facts').replaceChildren(...facts.map(([k,v])=>{const n=element('div');n.append(element('dt',k),element('dd',v));return n;}));
  if(!m.machines.includes(machine))machine=m.primary;
  $('refit-machine').replaceChildren(...m.machines.map(i=>new Option(model.machines[i].name,String(i))));$('refit-machine').value=machine;
  const s=fit.states[machine],definition=model.machines[machine];$('refit-condition').value=s.condition;$('refit-enabled').checked=s.enabled;
  $('refit-condition').disabled=empty;$('refit-enabled').disabled=empty;
  $('refit-machine-state').textContent=derived.result.rows[machine].reason+(definition.InitialQuantity?' · '+s.quantity.toLocaleString('en-US')+' remaining':'');
  $('refit-empty-store').hidden=!definition.InitialQuantity;$('refit-empty-store').disabled=empty||!s.quantity;
 }
 function metric(label,value,note){const b=element('div',undefined,'lab-metric');b.append(element('span',label),element('strong',value),element('small',note));return b;}
 function choose(id){fit.selected=id;machine=selected()?.primary??-1;save();render();if(matchMedia('(max-width:760px)').matches){$('refit-component').focus({preventScroll:true});$('refit-component').scrollIntoView({block:'start'});}}
 function drawPins(){
  const map=$('refit-map'),art=model.art[view],p=art.projection;map.replaceChildren();pins=[];map.setAttribute('viewBox',`0 0 ${art.width} ${art.height}`);
  document.querySelector('.refit-live-view').style.aspectRatio=art.width+'/'+art.height;
  const scale=Math.max(.01,map.getBoundingClientRect().width/art.width),radius=12/scale;
  for(const m of model.refit.modules.filter(visible)){
   const dot=v=>m.position.reduce((s,x,i)=>s+x*v[i],0),x=art.width/2+(dot(p.right)-p.centre_x_m)*p.pixels_per_metre,y=art.height/2-(dot(p.up)-p.centre_y_m)*p.pixels_per_metre;
   const empty=fit.removed.includes(m.id),g=svg('g',{class:'refit-marker'+(empty?' empty':'')+(fit.selected===m.id?' selected':''),role:'button',tabindex:0,'aria-label':m.name+(empty?', empty mount':', installed'),'aria-pressed':String(fit.selected===m.id),'data-module':m.id});
   g.append(svg('circle',{cx:x,cy:y,r:radius}));const label=svg('text',{x,y:y+4/scale,'text-anchor':'middle','font-size':11/scale});label.textContent=empty?'+':String(m.id);g.append(label);
   g.addEventListener('click',()=>choose(m.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(m.id);}});map.append(g);pins.push(g);
  }
 }
 function render(){if(!model||!fit)return;derived=M.evaluate(model,fit);
  if(selected()&&!visible(selected())){const first=model.refit.modules.find(visible);if(first){fit.selected=first.id;machine=first.primary;}}
  $('refit-metrics').replaceChildren(metric('Fitted power',kw(derived.requested),derived.storedPower?'Stored-energy supply · endurance unverified':kw(derived.rated)+' generation'),metric('Available now',derived.storedPower?'Unverified':kw(derived.result.supply),derived.storedPower?'Stored-energy discharge is not simulated':kw(derived.result.used)+' allocated'),metric('Weapons / shields',derived.guns+' / '+derived.shields,'Installed equipment'),metric('Material fitted',tonnes(derived.materialKg),tonnes(derived.removedMassKg)+' removed · no stores, crew or aircraft'));
  $('refit-count').textContent=model.crewFamily?'Exact crew fit · equipment retained':(model.refit.modules.length-fit.removed.length)+' installed / '+model.refit.modules.length+' removable modules';
  $('refit-warnings').replaceChildren(...derived.warnings.map(s=>element('li',s)));
  const mods=model.refit.modules.filter(visible).sort((a,b)=>a.position[0]-b.position[0]||a.id-b.id);
  $('refit-list').replaceChildren(...mods.map(m=>{const empty=fit.removed.includes(m.id),offline=!derived.result.rows[m.primary].ready;const b=element('button',undefined,'refit-module'+(empty?' empty':offline?' offline':''));b.type='button';b.dataset.module=m.id;b.setAttribute('aria-pressed',String(fit.selected===m.id));b.append(element('strong',m.name),element('span',M.section(model,m)+' · '+(empty?'Empty mount · install module':offline?'Fitted · '+derived.result.rows[m.primary].reason:'Fitted · ready')),element('span',tonnes(m.massKg)+' · '+kw(m.machines.reduce((n,i)=>n+model.machines[i].DemandWatts,0))));b.addEventListener('click',()=>choose(m.id));return b;}));
  if(!mods.length)$('refit-list').append(element('p',model.crewFamily?'This exported package keeps its equipment fitted. Explore quarters and crew below.':'No removable modules match this filter. Try Whole ship or All modules.','field-hint'));
  for(const b of document.querySelectorAll('[data-refit-section]'))b.setAttribute('aria-pressed',String(b.dataset.refitSection===fit.section));
  $('refit-undo').disabled=!undo.length||loading;$('refit-share').disabled=loading;$('refit-stock').disabled=loading;
  updateControls();drawPins();R.update({fit,derived,view,crewRoom});window.FleetCrewPlan?.update('refit-crew',model,derived.result,undefined,derived.states,{
   plan:fit.crewPlan,
   onPlanChange:plan=>change('Crew complement updated.',()=>{fit.crewPlan=plan;}),
   onRoomChange:(i,patch)=>{if(!model.crew_accommodation?.compartments.some(r=>r.machine===i))return;change('Quarters life support updated.',()=>{Object.assign(fit.states[i],patch);});},
   onRoomSelect:room=>{crewRoom=room;fit.section='all';render();$('refit-kind').textContent='QUARTERS / LIFE SUPPORT';$('refit-component').textContent=model.machines[room.machine].name;$('refit-description').textContent=room.bunks+' bunks, '+room.demand_watts+' W life support. The highlighted assembly supplies '+room.life_support_capacity+' places when intact and powered.';$('refit-canvas').scrollIntoView({block:'center'});}
  });
 }
 function setInstalled(installed){const m=selected();if(!m)return;const removed=fit.removed.includes(m.id);if(removed===!installed)return;change(m.name+(installed?' reinstalled with its previous condition and supplies.':' removed. Its mount is now empty.'),()=>{fit.removed=installed?fit.removed.filter(id=>id!==m.id):[...fit.removed,m.id];});}
 function fragment(){if(!location.hash.startsWith('#loadout=')||location.hash.length>24000)return null;try{return JSON.parse(atob(location.hash.slice(9)));}catch{return null;}}
 function expandShared(value,next){if(!value||!Array.isArray(value.changes)||value.changes.length>next.machines.length)return null;const states=window.FleetLabModel.fresh(next),used=new Set();for(const row of value.changes){if(!Array.isArray(row)||row.length!==5||!Number.isInteger(row[0])||!states[row[0]]||used.has(row[0]))return null;used.add(row[0]);states[row[0]]={condition:row[1],enabled:row[2],priority:row[3],quantity:row[4]};}return M.validate(next,{...value,states});}
 async function open(key,shared=null){const n=++loadTicket;loading=true;$('refit-event').textContent='Loading this hull’s fitting contract…';$('refit-share').disabled=true;$('refit-stock').disabled=true;$('refit-undo').disabled=true;
  try{const entry=D.entries.find(e=>e.key===key);if(!entry)throw Error('Unknown hull');const response=await fetch(entry.model,{credentials:'omit'});if(!response.ok)throw Error('Model');const next=await response.json();
   if(n!==loadTicket)return;if(next.key!==entry.key||next.definitionHash!==entry.definitionHash||next.recipe!==entry.recipe||next.revision!==entry.revision||next.refit?.version!=='hull-fit-1')throw Error('Identity');
   let restored=null,rejected=false;
   if(shared){restored=expandShared(shared,next);rejected=!restored;}else try{const saved=localStorage.getItem('fleet-hull-fit:hull-fit-1:'+next.definitionHash);if(saved)restored=M.validate(next,JSON.parse(saved));}catch{storage=false;}
   model=next;fit=restored||M.fresh(model);undo=[];crewRoom=null;filter='all';$('refit-filter').value=filter;machine=selected()?.primary??-1;loading=false;
   $('refit-name').textContent=model.name;$('refit-edition').textContent='· '+model.recipe+' · '+model.exported.slice(0,10);$('refit-inspect').href=entry.inspectRoute;$('refit-discuss').href=model.dossier+'#suggest';
   for(const item of standardPresentation)document.querySelector(item.selector).textContent=item.text;
   document.querySelector('.lab-equipment').hidden=!!model.crewFamily;$('refit-filter').parentElement.hidden=!!model.crewFamily;
   if(model.crewFamily){
    document.querySelector('.lab-intro h1').textContent='Make room for the crew.';
    document.querySelector('.lab-intro>div>p:not(.eyebrow)').textContent='Choose the quarters. Plan the watch. See what happens when life support goes down.';
    document.querySelector('.lab-build-tag').textContent='Native crew fit';
    document.querySelector('.refit-scope').textContent='Exact exported quarters and machinery. Plan your complement below; this package keeps its registered hardware and 75% propulsion limits.';
   }
   for(const option of $('refit-filter').options)option.disabled=!['all','empty'].includes(option.value)&&!model.refit.modules.some(m=>m.kind===option.value);
   dispatchEvent(new CustomEvent('fleet:inspection-loaded',{detail:{key:model.key}}));render();R.load(model);
   $('refit-event').textContent=rejected?'This shared loadout was invalid. The untouched registered ship is shown.':model.crewFamily?'Exact crew fit loaded. Plan the complement and inspect its life support below.':!model.refit.modules.length?'This edition’s hardware stays fixed. Use Inspect all internal systems to explore it.':restored?'Your loadout is open. Choose a module or an empty mount.':'Registered hardware loaded. Select a module to change its fitting.';
   $('refit-crew-shortcut').hidden=!model.crewFamily;
   $('refit-save-status').textContent=restored?'Restored local draft · separate from your inspection setups':storage?'Local fitting draft · no account needed':'Storage unavailable · share a link to keep your loadout';
   if(shared&&!rejected)save();
   const url=new URL(location.href);url.searchParams.set('ship',model.key);if(!shared&&!['#refit-crew','#refit-workshop'].includes(url.hash))url.hash='';history.replaceState(null,'',url.pathname+url.search+url.hash);
  }catch{if(n!==loadTicket)return;loading=false;$('refit-event').textContent='This hull could not be loaded. Your saved loadouts have not changed. Reload to try again.';if(model)render();}
 }
 $('refit-toggle').addEventListener('click',()=>setInstalled(fit.removed.includes(selected()?.id)));
 $('refit-article').addEventListener('change',e=>setInstalled(e.target.value==='stock'));
 $('refit-machine').addEventListener('change',e=>{machine=Number(e.target.value);updateControls();});
 $('refit-condition').addEventListener('change',e=>{if(!selected()||fit.removed.includes(selected().id))return;change('Component condition changed.',()=>{fit.states[machine].condition=Number(e.target.value);});});
 $('refit-enabled').addEventListener('change',e=>{if(!selected()||fit.removed.includes(selected().id))return;change('Component power state changed.',()=>{fit.states[machine].enabled=e.target.checked;});});
 $('refit-empty-store').addEventListener('click',()=>{if(!selected()||fit.removed.includes(selected().id))return;change('Store emptied. Reinstalling this module will not refill it.',()=>{fit.states[machine].quantity=0;});});
 $('refit-filter').addEventListener('change',e=>{filter=e.target.value;render();});
 for(const b of document.querySelectorAll('[data-refit-section]'))b.addEventListener('click',()=>{if(!fit)return;fit.section=b.dataset.refitSection;save();render();});
 for(const b of document.querySelectorAll('[data-refit-view]'))b.addEventListener('click',()=>{view=b.dataset.refitView;for(const button of document.querySelectorAll('[data-refit-view]'))button.setAttribute('aria-pressed',String(button===b));render();});
 $('refit-undo').addEventListener('click',()=>{if(!undo.length||loading)return;fit=JSON.parse(undo.pop());save();render();$('refit-event').textContent='Previous fitting change restored.';});
 $('refit-stock').addEventListener('click',()=>change('Registered hardware, condition and supplies restored. Undo can recover your previous loadout.',()=>{fit=M.fresh(model);}));
 $('refit-share').addEventListener('click',async()=>{if(!fit||loading)return;const {states,...data}=fit;data.changes=states.flatMap((s,i)=>s.condition!==100||!s.enabled||s.priority!==0||s.quantity!==model.machines[i].InitialQuantity?[[i,s.condition,s.enabled,s.priority,s.quantity]]:[]);const url=location.origin+'/ship-lab/refit?ship='+model.key+'#loadout='+btoa(JSON.stringify(data));if(url.length>24000){$('refit-save-status').textContent='This draft is too large for a share link. It remains saved in this browser.';return;}$('refit-share-url').value=url;$('refit-share-result').hidden=false;try{await navigator.clipboard.writeText(url);$('refit-save-status').textContent='Loadout link copied';}catch{$('refit-save-status').textContent='Copy the loadout link below';$('refit-share-url').focus();$('refit-share-url').select();}});
 const initial=fragment();open(initial?.ship||new URLSearchParams(location.search).get('ship')||'ravelin',initial);
 addEventListener('hashchange',()=>{const incoming=fragment();if(incoming)open(incoming.ship,incoming);});
 new ResizeObserver(()=>{if(model&&fit)drawPins();}).observe($('refit-map'));
})();
