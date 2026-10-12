(() => {
 'use strict';
 const $=id=>document.getElementById(id),engine=window.FleetLabModel,models=window.FleetLabData;
 if(!$('ship-workshop')||!engine||!models)return;
 const NS='http://www.w3.org/2000/svg',groups={power:['reactor','feed','control'],propulsion:['drive','jet'],defence:['shield','gun'],stores:['fuel_tank','magazine']};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const svg=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
 const kw=n=>n>0&&n<1000?n.toLocaleString('en-US',{maximumFractionDigits:0})+' W':(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' kW';
 let model=models[0],state,selected=0,view='hero',mode='inspect',filter='power',result,pins=new Map(),buttons=new Map(),storage=true;
 const entries=window.FleetDesignerData.entries;
 let requestNumber=0;
 async function ensureModel(key,revision){
  const entry=entries.find(e=>e.key===key);if(!entry||(revision&&entry.revision!==revision))throw Error('Unknown exported configuration');
  let found=models.find(m=>m.key===key&&m.revision===entry.revision);if(found)return found;
  const response=await fetch(entry.model,{credentials:'omit'});if(!response.ok)throw Error('Export unavailable');
  const value=await response.json();
  if(value.key!==key||value.recipe!==entry.recipe||value.revision!==entry.revision||value.definitionHash!==entry.definitionHash||!Array.isArray(value.machines)||!value.machines.length)throw Error('Export identity mismatch');
  models.push(value);return value;
 }
 function rememberSelection(){if($('ship-workshop').hidden)return;const url=new URL(location.href);url.searchParams.set('ship',model.key);url.hash='ship-workshop';history.replaceState(null,'',url.pathname+url.search+url.hash);}
 async function openHull(key){
  const ticket=++requestNumber;$('lab-event').textContent='Loading this hull’s published systems…';
  try{const next=await ensureModel(key);if(ticket!==requestNumber)return;model=next;const saved=readSaved();load(model,saved?.state,saved?.selected||0);rememberSelection();$('lab-event').textContent=model.name+' loaded. '+consequences();$('lab-share-result').hidden=true;}
  catch{if(ticket===requestNumber){$('lab-ship').value=model.key;$('lab-event').textContent='This hull could not be loaded. Your current setup is unchanged. Try again.';}}
 }
 const key=()=> 'fleet-workshop-v1:'+model.revision;
 const matches=m=>filter==='all'||groups[filter].includes(m.kind_name);
 const empty=i=>['fuel_tank','magazine'].includes(model.machines[i].kind_name)&&!state[i].quantity;
 const statusClass=i=>!result.rows[i].ready?'bad':state[i].condition<100||empty(i)?'warn':'good';
 function pack(){return {version:1,ship:model.key,revision:model.revision,selected,state};}
 function unpack(value){
  if(!value||value.version!==1)return null;const m=models.find(m=>m.key===value.ship&&m.revision===value.revision);if(!m)return null;
  let values=value.state;
  if(values===undefined){if(!Array.isArray(value.changes)||value.changes.length>m.machines.length)return null;values=engine.fresh(m);const used=new Set();for(const row of value.changes){if(!Array.isArray(row)||row.length!==5||!Number.isInteger(row[0])||!m.machines[row[0]]||used.has(row[0]))return null;used.add(row[0]);values[row[0]]={condition:row[1],enabled:row[2],priority:row[3],quantity:row[4]};}}
  const s=engine.validate(m,values);return s?{model:m,state:s,selected:Number.isInteger(value.selected)&&m.machines[value.selected]?value.selected:0}:null;
 }
 function sharePack(){const {state:values,...p}=pack();p.changes=values.flatMap((s,i)=>s.condition!==100||!s.enabled||s.priority!==0||s.quantity!==model.machines[i].InitialQuantity?[[i,s.condition,s.enabled,s.priority,s.quantity]]:[]);return p;}
 function readSaved(){try{const v=JSON.parse(localStorage.getItem(key()));const saved=v&&unpack(v);return saved?.model.key===model.key?saved:null;}catch{storage=false;return null;}}
 function persist(){try{localStorage.setItem(key(),JSON.stringify(pack()));$('lab-save-status').textContent='Setup saved in this browser · no account required';}catch{storage=false;$('lab-save-status').textContent='Browser storage unavailable · use Share this setup to keep it';}}
 function change(message){result=engine.evaluate(model,state);persist();render();$('lab-event').textContent=message+' '+consequences();$('lab-share-result').hidden=true;}
 function consequences(){return `${result.unavailable} of ${model.machines.length} components unavailable. ${result.shields}/${result.shieldTotal} shields and ${result.guns}/${result.gunTotal} weapons ready.`;}
 function load(m,s=null,selection=0){model=m;state=s||engine.fresh(m);selected=selection;if(!matches(model.machines[selected])){filter=Object.keys(groups).find(k=>groups[k].includes(model.machines[selected].kind_name))||'all';$('lab-filter').value=filter;}result=engine.evaluate(model,state);$('lab-ship').value=model.key;$('lab-edition').textContent=model.recipe+' · exported '+model.exported.slice(0,10)+' · native system inspection, fixed reference geometry';for(const option of $('lab-filter').options)option.disabled=option.value!=='all'&&!model.machines.some(m=>groups[option.value].includes(m.kind_name));for(const button of document.querySelectorAll('[data-lab-failure]'))button.disabled=!model.machines.some(m=>m.kind_name===button.dataset.labFailure);$('lab-scale').textContent=model.name+' / '+model.dimensions.join(' × ')+' m';$('lab-dossier').href=model.dossier;$('lab-discuss').href=model.dossier+'#suggest';buildManifest();buildMap();render();if(!$('ship-workshop').hidden)dispatchEvent(new CustomEvent('fleet:inspection-loaded',{detail:{key:model.key}}));}
 function buildManifest(){
  const list=$('lab-equipment-list');list.replaceChildren();buttons=new Map();
  for(const m of model.machines){const b=el('button',undefined,'lab-equipment-row');b.type='button';b.append(el('span',String(m.index+1).padStart(2,'0'),'lab-number'),el('span',m.name,'lab-machine-name'),el('span','','lab-machine-status'));b.addEventListener('click',()=>{choose(m.index);if(matchMedia('(max-width:760px)').matches){$('lab-component').focus({preventScroll:true});$('lab-component').scrollIntoView({block:'start'});}});list.append(b);buttons.set(m.index,b);}
 }
 function choose(i){selected=i;if(mode==='damage'){state[i].condition=Math.max(0,state[i].condition-25);change(model.machines[i].name+' damaged to '+state[i].condition+'%.');}else{render();$('lab-event').textContent=model.machines[i].name+' selected. '+result.rows[i].reason+'.';}}
 function sizePins(){const a=model.art[view],rect=$('lab-map').getBoundingClientRect(),scale=Math.min(rect.width/a.width,rect.height/a.height);if(!scale)return;for(const g of pins.values()){g.querySelector('.lab-marker').setAttribute('r',14/scale);g.querySelector('text').setAttribute('font-size',12/scale);g.querySelector('text').setAttribute('dy',4/scale);g.querySelector('text').setAttribute('y',g.querySelector('.lab-marker').getAttribute('cy'));}}
 function buildMap(){
  const map=$('lab-map'),art=model.art[view],p=art.projection;map.replaceChildren();pins=new Map();map.setAttribute('viewBox',`0 0 ${art.width} ${art.height}`);
  map.append(svg('image',{href:'/assets/fleet-register/'+art.path,width:art.width,height:art.height}));
  const targets=model.machines.filter(matches).map(m=>{const dot=v=>m.core_position_m.reduce((s,x,i)=>s+x*v[i],0);return {m,x:art.width/2+(dot(p.right)-p.centre_x_m)*p.pixels_per_metre,y:art.height/2-(dot(p.up)-p.centre_y_m)*p.pixels_per_metre};});
  // Labels are arranged outside the hull for legibility. Their tethers end at exact native coordinates.
  targets.sort((a,b)=>a.x-b.x).forEach((t,n)=>{const side=n%2,peers=Math.ceil((targets.length-side)/2),slot=Math.floor(n/2),x=180+(art.width-360)*(slot+.5)/Math.max(1,peers),y=side?art.height-200:180;
   const g=svg('g',{class:'lab-pin',role:'button',tabindex:0,'aria-label':t.m.name,'data-index':t.m.index});
   g.append(svg('path',{d:`M${t.x} ${t.y} L${x} ${y}`,class:'lab-tether'}),svg('circle',{cx:t.x,cy:t.y,r:10,class:'lab-core'}),svg('circle',{cx:x,cy:y,r:38,class:'lab-marker'}));const label=svg('text',{x,y:y+13,'text-anchor':'middle'});label.textContent=String(t.m.index+1).padStart(2,'0');g.append(label);g.addEventListener('click',()=>choose(t.m.index));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(t.m.index);}});map.append(g);pins.set(t.m.index,g);
  });sizePins();
 }
 function metric(label,value,note,problem=false){const box=el('div',undefined,problem?'lab-metric warn':'lab-metric');box.append(el('span',label),el('strong',value),el('small',note));return box;}
 function render(){
  window.FleetCrewPlan?.update('native-crew',model,result,undefined,state);
  const m=model.machines[selected],s=state[selected],r=result.rows[selected],related=new Set([...m.power_sources,...m.dependencies]);
  $('lab-telemetry').replaceChildren(metric('Power allocated',kw(result.used)+' / '+kw(result.supply),'Request: '+kw(result.requested),result.used+1<result.requested),metric('Main thrust',result.maxThrust?Math.round(result.thrust/result.maxThrust*100)+'%':'—',result.maxThrust?'Simplified available capability':'No main drive in this export',result.thrust<result.maxThrust),metric('Shields',result.shields+' / '+result.shieldTotal,'Powered emitters',result.shields<result.shieldTotal),metric('Weapons',result.guns+' / '+result.gunTotal,'Powered with ammunition',result.guns<result.gunTotal));
  for(const[i,b]of buttons){b.hidden=!matches(model.machines[i]);b.className='lab-equipment-row '+statusClass(i)+(i===selected?' selected':'');b.setAttribute('aria-pressed',String(i===selected));b.lastElementChild.textContent=result.rows[i].ready?(empty(i)?'Empty':state[i].condition<100?'Damaged':'Ready'):'Offline';}
  for(const[i,g]of pins){g.setAttribute('class','lab-pin '+statusClass(i)+(i===selected?' selected':'')+(related.has(i)?' related':''));g.setAttribute('aria-pressed',String(i===selected));g.setAttribute('aria-label',`${model.machines[i].name}, ${result.rows[i].reason}, ${state[i].condition}% condition`);}
  $('lab-kind').textContent='Component '+String(selected+1).padStart(2,'0')+' / '+m.kind_name.replaceAll('_',' ');$('lab-component').textContent=m.name;$('lab-component-state').textContent=r.reason;$('lab-component-state').className=statusClass(selected);$('lab-condition').value=s.condition;$('lab-condition-label').textContent=s.condition+'%';$('lab-enabled').checked=s.enabled;$('lab-priority').value=s.priority;$('lab-priority').disabled=m.GenerationWatts>0||m.DemandWatts===0;
  $('lab-hit').disabled=s.condition===0;$('lab-repair').disabled=s.condition===100;
  const facts=[['Allocated / demand',kw(r.allocated)+' / '+kw(m.DemandWatts)],['Attached to',model.parts.find(p=>p.index===m.part)?.name||'Unknown part']];
  if(m.GenerationWatts)facts.unshift(['Output / rated',kw(r.output)+' / '+kw(m.GenerationWatts)]);
  if(m.MaxForce)facts.push(['Authored thrust',(m.MaxForce/1e6).toLocaleString('en-US')+' MN']);
  if(m.kind_name==='fuel_tank')facts.push(['Propellant',s.quantity.toLocaleString('en-US')+' kg']);
  if(m.kind_name==='magazine')facts.push(['Ammunition',s.quantity.toLocaleString('en-US')+' rounds']);
  if(m.kind_name==='reactor')facts.push(['Stored energy',(s.quantity/1e6).toLocaleString('en-US')+' MJ']);
  $('lab-component-data').replaceChildren(...facts.map(([k,v])=>{const d=el('div');d.append(el('dt',k),el('dd',v));return d;}));
  $('lab-links').replaceChildren();
  for(const[label,ids]of [['Powered by',m.power_sources],['Requires',m.dependencies],['Supplies / supports',model.machines.filter(x=>x.power_sources.includes(selected)||x.dependencies.includes(selected)).map(x=>x.index)]]){if(!ids.length)continue;const collapse=ids.length>6,block=el(collapse?'details':'div',undefined,'lab-dependencies');block.append(el(collapse?'summary':'h3',label+(collapse?' ('+ids.length+')':'')));for(const i of ids){const b=el('button',model.machines[i].name);b.type='button';b.addEventListener('click',()=>{selected=i;if(!matches(model.machines[i])){filter=Object.keys(groups).find(k=>groups[k].includes(model.machines[i].kind_name))||'all';$('lab-filter').value=filter;buildMap();}render();});block.append(b);}$('lab-links').append(block);}
  const store=$('lab-store-action');store.hidden=!['gun','fuel_tank','magazine'].includes(m.kind_name);store.disabled=m.kind_name==='gun'?!r.ready:!s.quantity;store.textContent=m.kind_name==='gun'?'Test fire · spend 1 round':m.kind_name==='fuel_tank'?'Simulate empty tank':'Simulate empty magazine';
  $('lab-explain').href=m.kind_name==='control'?'/systems/sensors':['drive','jet','fuel_tank'].includes(m.kind_name)?'/systems/movement':m.kind_name==='gun'||m.kind_name==='magazine'?'/systems/damage':'/systems/power-shields';
 }
 $('lab-ship').addEventListener('change',e=>openHull(e.target.value));
 $('lab-filter').value=filter;$('lab-filter').addEventListener('change',e=>{filter=e.target.value;if(!matches(model.machines[selected]))selected=model.machines.find(matches)?.index??selected;buildMap();render();});
 for(const b of document.querySelectorAll('[data-lab-view]'))b.addEventListener('click',()=>{view=b.dataset.labView;document.querySelectorAll('[data-lab-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));buildMap();render();});
 for(const b of document.querySelectorAll('[data-lab-mode]'))b.addEventListener('click',()=>{mode=b.dataset.labMode;document.querySelectorAll('[data-lab-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('lab-map-hint').textContent=mode==='damage'?'Damage mode: each component click removes 25% condition. Inspect to stop.':'Select a numbered component on the ship, or use the equipment list.';$('ship-workshop').classList.toggle('lab-damage-mode',mode==='damage');});
 $('lab-condition').addEventListener('input',e=>{state[selected].condition=Number(e.target.value);change(model.machines[selected].name+' condition set to '+state[selected].condition+'%.');});
 $('lab-hit').addEventListener('click',()=>{state[selected].condition=Math.max(0,state[selected].condition-25);change(model.machines[selected].name+' damaged to '+state[selected].condition+'%.');});
 $('lab-repair').addEventListener('click',()=>{state[selected].condition=100;change(model.machines[selected].name+' repaired.');});
 $('lab-enabled').addEventListener('change',e=>{state[selected].enabled=e.target.checked;change(model.machines[selected].name+(e.target.checked?' enabled.':' switched off.'));});
 $('lab-priority').addEventListener('change',e=>{state[selected].priority=Number(e.target.value);change(model.machines[selected].name+' priority changed.');});
 $('lab-store-action').addEventListener('click',()=>{const m=model.machines[selected];if(m.kind_name==='gun'&&result.rows[selected].ready&&m.ammo_store>=0){state[m.ammo_store].quantity=Math.max(0,state[m.ammo_store].quantity-1);change(m.name+' test fired; one round spent from '+model.machines[m.ammo_store].name+'.');}else if(['fuel_tank','magazine'].includes(m.kind_name)){state[selected].quantity=0;change(m.name+' emptied.');}});
 for(const b of document.querySelectorAll('[data-lab-failure]'))b.addEventListener('click',()=>{const m=model.machines.find(m=>m.kind_name===b.dataset.labFailure);if(!m)return;selected=m.index;state[selected].condition=0;if(!matches(m)){filter=Object.keys(groups).find(k=>groups[k].includes(m.kind_name))||'all';$('lab-filter').value=filter;buildMap();}change(m.name+' destroyed.');});
 $('lab-reset').addEventListener('click',()=>{state=engine.fresh(model);change('Ship restored. All equipment, stores and priorities reset.');});
 $('lab-share').addEventListener('click',async()=>{const data=btoa(JSON.stringify(sharePack())),url=location.origin+'/ship-lab#setup='+data;$('lab-share-url').value=url;$('lab-share-result').hidden=false;try{await navigator.clipboard.writeText(url);$('lab-save-status').textContent='Setup link copied · paste it into Discord';}catch{$('lab-save-status').textContent='Copy the setup link below';$('lab-share-url').focus();$('lab-share-url').select();}});
 $('lab-export').addEventListener('click',()=>{const data={...pack(),purpose:'Fleet in Pieces UI prototype; not an engine save',model:'static-power-v1',equipment:model.machines.map(m=>({index:m.index,name:m.name}))};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=model.key+'-workshop.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('lab-save-status').textContent='Setup exported as JSON · not an engine save';});
 function readFragment(){if(!location.hash.startsWith('#setup=')||location.hash.length>16000)return null;try{return JSON.parse(atob(location.hash.slice(7)));}catch{return null;}}
 async function restoreFragment(initial=false){
  const ticket=++requestNumber,value=readFragment();
  try{if(!value||value.version!==1)throw Error('Invalid setup');await ensureModel(value.ship,value.revision);if(ticket!==requestNumber)return;const incoming=unpack(value);if(!incoming)throw Error('Invalid state');load(incoming.model,incoming.state,incoming.selected);persist();rememberSelection();$('lab-event').textContent='Shared setup opened as a separate copy. '+consequences();}
  catch{if(ticket===requestNumber)$('lab-event').textContent=initial?'This setup link could not be read. An intact ship has been opened.':'This setup link could not be read. Your current setup is unchanged.';}
 }
 const first=readSaved();load(model,first?.state,first?.selected||0);
 $('lab-save-status').textContent=first?'Restored from this browser · no account required':storage?'No account needed. Changes stay in this browser.':'Browser storage unavailable · use Share this setup to keep it';
 if(location.hash.startsWith('#setup='))restoreFragment(true);
 else {const requested=new URLSearchParams(location.search).get('ship');if(requested)openHull(requested);else $('lab-event').textContent='Start with a reactor. Damage it and watch the available power change.';}
 addEventListener('hashchange',()=>{if(location.hash.startsWith('#setup='))restoreFragment();});
 addEventListener('fleet:inspect-open',()=>{rememberSelection();dispatchEvent(new CustomEvent('fleet:inspection-loaded',{detail:{key:model.key}}));});
 new ResizeObserver(sizePins).observe($('lab-map'));
})();
