(() => {
 'use strict';
 const $=id=>document.getElementById(id),F=window.FleetOutfit;if(!F||!$('outfit-workshop'))return;
 const D=F.data,C=F.catalog,NS='http://www.w3.org/2000/svg',saveKey='fleet-interior:'+D.version;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const svg=(tag,attrs,text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;};
 const watts=n=>n>0&&n<1000?num(n)+' W':(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' kW',num=n=>n.toLocaleString('en-US'),copy=v=>JSON.parse(JSON.stringify(v));
 const ox=56,oy=56,cell=48,history=[],catalogButtons=new Map();
 let fit=F.preset('expedition'),result,armed=null,interaction='inspect',cursor={x:2,y:0},message='Start with an escort. Try charging its jump drive, or remove the drive to see what a local-defense ship saves.',storage=true;
 function setWorkshop(which){for(const b of document.querySelectorAll('[data-workshop]'))b.setAttribute('aria-pressed',String(b.dataset.workshop===which));$('outfit-workshop').hidden=which!=='design';$('outfit-method').hidden=which!=='design';$('ship-workshop').hidden=which!=='native';$('native-method').hidden=which!=='native';}
 for(const b of document.querySelectorAll('[data-workshop]'))b.addEventListener('click',()=>setWorkshop(b.dataset.workshop));
 function decode(hash){if(!hash.startsWith('#fit=')||hash.length>24000)return null;try{return F.validate(JSON.parse(atob(hash.slice(5))));}catch{return null;}}
 const shared=decode(location.hash),badLink=location.hash.startsWith('#fit=')&&!shared;
 if(shared){fit=shared;message='Shared fit opened as your own editable copy.';}else if(!badLink){try{const s=F.validate(JSON.parse(localStorage.getItem(saveKey)));if(s){fit=s;message='Restored your interior design from this browser.';}}catch{storage=false;}}
 if(badLink)message='That fit link is invalid or from an unsupported catalog. An intact starter design is open.';
 setWorkshop(location.hash.startsWith('#setup=')?'native':'design');
 function persist(){try{localStorage.setItem(saveKey,JSON.stringify(fit));$('fit-save').textContent='Fit saved in this browser · no account needed';}catch{storage=false;$('fit-save').textContent='Browser storage unavailable · keep a Share fit link';}}
 const index=()=>fit.items.findIndex(p=>p.uid===fit.selected);
 function snapshot(){history.push(copy(fit));if(history.length>20)history.shift();}
 function commit(text){message=text;armed=null;$('fit-share-result').hidden=true;persist();render();}
 function mutate(fn,text){snapshot();fn();commit(text);}
 function status(i){return !result.rows[i].ready?'bad':fit.states[i].condition<100?'warn':'good';}
 function metric(label,value,caption,warn=false){const d=node('div',undefined,'lab-metric'+(warn?' warn':''));d.append(node('span',label),node('strong',value),node('small',caption));return d;}
 function at(x,y){return fit.items.find(p=>F.cells(p).some(([a,b])=>a===x&&b===y));}
 function arm(type,uid=null,rotated=false){armed={type,uid,rotated};interaction='inspect';if(uid){const p=fit.items.find(p=>p.uid===uid);cursor={x:p.x,y:p.y};}else{let found=false;for(let y=0;y<D.rows&&!found;y++)for(let x=0;x<D.columns&&!found;x++)if(!F.canPlace(fit.items,{type,x,y,rotated})){cursor={x,y};found=true;}}message=uid?'Choose a new top-left position. Its old space stays reserved until the move succeeds.':'Place '+C.get(type).name+'. Click its top-left square, or choose a column and row.';render();}
 function place(x,y){
  cursor={x,y};if(!armed){const p=at(x,y);if(p)select(p.uid);return;}
  const moving=armed.uid!==null,uid=moving?armed.uid:Math.max(...fit.items.map(p=>p.uid))+1;
  if(uid>10000){message='This recipe reached its installation-ID limit. Start from a preset.';render();return;}
  const p={uid,type:armed.type,rotated:armed.rotated,x,y},problem=F.canPlace(fit.items,p,moving?uid:null);
  if(problem){message='Cannot place here: '+problem+'.';render();return;}
  const name=C.get(p.type).name;snapshot();
  if(moving)fit.items[fit.items.findIndex(i=>i.uid===uid)]=p;else{fit.items.push(p);fit.states.push(F.freshState(p));}
  fit.selected=uid;commit(name+(moving?' moved.':' fitted. Space and build cost reserved.'));
 }
 function select(uid){
  fit.selected=uid;
  if(interaction==='damage'){const i=index();mutate(()=>{fit.states[i].condition=Math.max(0,fit.states[i].condition-25);},C.get(fit.items[i].type).name+' damaged. Its footprint and cost are unchanged.');}
  else{message=C.get(fit.items[index()].type).name+' selected. Move, remove or test it in the inspector.';render();}
 }
 function ghost(){
  const map=$('fit-map');map.querySelector('.fit-ghost')?.remove();
  if(!armed)return;$('fit-column').value=cursor.x+1;$('fit-row').value=cursor.y+1;const p={...armed,x:cursor.x,y:cursor.y},s=F.dims(p),problem=F.canPlace(fit.items,p,armed.uid);
  map.append(svg('rect',{x:ox+p.x*cell+2,y:oy+p.y*cell+2,width:s.w*cell-4,height:s.h*cell-4,rx:4,class:'fit-ghost '+(problem?'bad':'good'),'pointer-events':'none'}));
 }
 function draw(){
  const map=$('fit-map'),focus=map.contains(document.activeElement);map.replaceChildren();
  const defs=svg('defs',{}),pattern=svg('pattern',{id:'fit-lane-pattern',width:10,height:10,patternUnits:'userSpaceOnUse'});pattern.append(svg('path',{d:'M-2 2L2 -2M0 10L10 0M8 12L12 8',stroke:'#3a4b54','stroke-width':2}));defs.append(pattern);map.append(defs);
  map.append(svg('text',{x:ox,y:25,class:'fit-direction'},'AFT / DRIVE MOUNTS'),svg('text',{x:ox+16*cell,y:25,'text-anchor':'end',class:'fit-direction'},'BOW →'));
  for(let y=0;y<D.rows;y++)for(let x=0;x<D.columns;x++){
   if(!F.inside(x,y))continue;const reserved=F.lane(x,y),g=svg('g',{});
   g.append(svg('rect',{x:ox+x*cell+1,y:oy+y*cell+1,width:cell-2,height:cell-2,rx:2,class:reserved?'fit-cell reserved':x<4?'fit-cell aft':'fit-cell',...(reserved?{fill:'url(#fit-lane-pattern)'}:{})}));
   g.addEventListener('pointerenter',()=>{cursor={x,y};ghost();});g.addEventListener('click',()=>place(x,y));map.append(g);
  }
  map.append(svg('text',{x:ox+8*cell,y:oy+3.5*cell+4,'text-anchor':'middle',class:'fit-lane-label','pointer-events':'none'},'SERVICE CORRIDOR — KEEP CLEAR'));
  for(let y=0;y<D.rows;y++)map.append(svg('text',{x:ox-15,y:oy+y*cell+30,'text-anchor':'end',class:'fit-coordinate'},String(y+1)));
  for(let x=0;x<D.columns;x++)map.append(svg('text',{x:ox+x*cell+24,y:oy+8*cell+27,'text-anchor':'middle',class:'fit-coordinate'},String(x+1)));
  fit.items.forEach((p,i)=>{
   const c=C.get(p.type),s=F.dims(p),x=ox+p.x*cell,y=oy+p.y*cell,g=svg('g',{class:'fit-module type-'+c.id+' '+status(i)+(p.uid===fit.selected?' selected':''),tabindex:0,role:'button','aria-label':c.name+' at column '+(p.x+1)+', row '+(p.y+1)+', '+result.rows[i].reason,'aria-pressed':String(p.uid===fit.selected)});
   g.append(svg('rect',{x:x+4,y:y+4,width:s.w*cell-8,height:s.h*cell-8,rx:4}),svg('text',{x:x+s.w*cell/2,y:y+s.h*cell/2-5,'text-anchor':'middle',class:'fit-module-title'},c.short),svg('text',{x:x+s.w*cell/2,y:y+s.h*cell/2+15,'text-anchor':'middle',class:'fit-module-detail'},c.locked?'FIXED':fit.states[i].condition<100?fit.states[i].condition+'%':s.w*s.h+' SP'));
   g.addEventListener('pointermove',e=>{const box=map.getBoundingClientRect(),scale=Math.min(box.width/880,box.height/500),left=box.left+(box.width-880*scale)/2,top=box.top+(box.height-500*scale)/2;cursor={x:Math.floor(((e.clientX-left)/scale-ox)/cell),y:Math.floor(((e.clientY-top)/scale-oy)/cell)};ghost();});
   g.addEventListener('click',()=>armed?place(cursor.x,cursor.y):select(p.uid));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();armed?place(cursor.x,cursor.y):select(p.uid);}});map.append(g);
  });
  ghost();if(focus)map.focus({preventScroll:true});
 }
 function render(){
  result=F.evaluate(fit);const i=index(),p=fit.items[i],c=C.get(p.type),s=fit.states[i],r=result.rows[i],size=F.dims(p);
  $('fit-budget').replaceChildren(metric('Interior space',result.occupied+' / '+result.total,'Contiguous design spaces',result.occupied===result.total),metric('Power demand',watts(result.requested)+' / '+watts(result.supply),'Allocated: '+watts(result.used),result.requested>result.used+1),metric('Build cost',num(result.cost)+' cr',num(Math.abs(fit.budget-result.cost))+(fit.budget>=result.cost?' remaining':' over target'),result.cost>fit.budget),metric('Jump charging','+'+watts(result.jumpPeak),result.jumpCount?'Switch power state to test it':'No jump-drive expense'));
  $('fit-phase').value=fit.phase;$('fit-budget-target').value=fit.budget;$('fit-jump-status').textContent=result.jumpStatus+' · normal demand '+watts(result.normalDemand);
  $('fit-footprint').textContent=(result.total-result.occupied)+' spaces free · 1 square = 1 design space';
  $('fit-event').textContent=message;$('fit-warnings').replaceChildren(...result.warnings.map(t=>node('li',t)));
  $('fit-kind').textContent=(c.locked?'Fixed installation':'Installation '+p.uid)+' / '+c.kind.replaceAll('_',' ');$('fit-name').textContent=c.name;$('fit-state').textContent=r.reason;$('fit-state').className=status(i);$('fit-note').textContent=c.note;
  const facts=[['Footprint',size.w+' × '+size.h+' = '+size.w*size.h+' spaces'],['Build cost',num(c.cost)+' design credits'],['Allocated / demand',watts(r.allocated)+' / '+watts(result.model.machines[i].DemandWatts)]];
  if(c.generation)facts.push(['Output / rating',watts(r.output)+' / '+watts(c.generation)]);
  if(c.chargeDemand)facts.push(['While charging',watts(c.chargeDemand)]);
  if(c.quantity&&!c.generation)facts.push([c.kind==='fuel_tank'?'Propellant':'Ammunition',num(s.quantity)+(c.kind==='fuel_tank'?' kg':' rounds')]);
  $('fit-facts').replaceChildren(...facts.map(([k,v])=>{const d=node('div');d.append(node('dt',k),node('dd',v));return d;}));
  $('fit-move').disabled=!!c.locked;$('fit-remove').disabled=!!c.locked;$('fit-condition').value=s.condition;$('fit-condition-label').textContent=s.condition+'%';$('fit-enabled').checked=s.enabled;$('fit-priority').value=s.priority;$('fit-priority').disabled=!!c.generation||result.model.machines[i].DemandWatts===0;
  $('fit-hit').disabled=s.condition===0;$('fit-repair').disabled=s.condition===100;$('fit-undo').disabled=!history.length;
  $('fit-cancel').hidden=!armed;$('fit-placement').hidden=!armed;$('fit-rotate').disabled=!armed&&!!c.locked;
  const store=$('fit-store');store.hidden=!['gun','fuel_tank','magazine'].includes(c.kind);store.disabled=c.kind==='gun'?!r.ready:!s.quantity;store.textContent=c.kind==='gun'?'Test fire · spend 1 round':'Simulate empty store';
  $('fit-hint').textContent=armed?(armed.uid?'Moving: ':'Placing: ')+C.get(armed.type).name+' · '+F.dims(armed).w+' × '+F.dims(armed).h+' · choose the top-left square':interaction==='damage'?'Click equipment to remove 25% working condition. Space remains occupied.':'Choose hardware below, then click its position inside the hull. Select installed hardware to move or remove it.';
  for(const b of document.querySelectorAll('[data-fit-mode]'))b.setAttribute('aria-pressed',String(b.dataset.fitMode===interaction));
  for(const[id,b]of catalogButtons)b.setAttribute('aria-pressed',String(armed?.type===id&&armed?.uid===null));
  $('fit-readiness').replaceChildren(metric('Main thrust',(result.thrust/1e6).toLocaleString('en-US',{maximumFractionDigits:1})+' MN','Simplified available thrust'),metric('Weapons',result.guns+' / '+result.gunTotal,'Ready with ammunition'),metric('Shields',result.shields+' / '+result.shieldTotal,'Powered emitters'),metric('Mission',result.jumpCount?'Jump-equipped':'Local / assisted travel',result.jumpCount?'Charging still needs sufficient power':'No independent jump capability'));
  draw();
 }
 for(const c of D.catalog.filter(c=>!c.locked)){
  const b=node('button',undefined,'fit-catalog-item type-'+c.id);b.type='button';b.append(node('strong',c.name),node('span',c.w*c.h+' spaces · '+num(c.cost)+' cr'),node('small',c.generation?'Produces '+watts(c.generation):c.chargeDemand?'Charging '+watts(c.chargeDemand):'Uses '+watts(c.demand)));b.addEventListener('click',()=>{arm(c.id);if(matchMedia('(max-width:760px)').matches)$('fit-map').scrollIntoView({block:'center'});});$('fit-catalog').append(b);catalogButtons.set(c.id,b);
 }
 $('fit-map').addEventListener('pointerdown',e=>{const box=$('fit-map').getBoundingClientRect(),scale=Math.min(box.width/880,box.height/500),left=box.left+(box.width-880*scale)/2,top=box.top+(box.height-500*scale)/2;cursor={x:Math.floor(((e.clientX-left)/scale-ox)/cell),y:Math.floor(((e.clientY-top)/scale-oy)/cell)};});
 $('fit-map').addEventListener('keydown',e=>{
  const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(dir){e.preventDefault();cursor.x=Math.max(0,Math.min(15,cursor.x+dir[0]));cursor.y=Math.max(0,Math.min(7,cursor.y+dir[1]));ghost();$('fit-hint').textContent='Cursor: column '+(cursor.x+1)+', row '+(cursor.y+1)+'. '+(armed?'Enter to place.':'Enter to select.');}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();place(cursor.x,cursor.y);}else if(e.key==='Escape'){armed=null;message='Placement cancelled. Your fit is unchanged.';render();}
 });
 for(const b of document.querySelectorAll('[data-fit-mode]'))b.addEventListener('click',()=>{armed=null;interaction=b.dataset.fitMode;render();});
 $('fit-cancel').addEventListener('click',()=>{armed=null;message='Placement cancelled.';render();});
 function placementFields(){const x=Number($('fit-column').value)-1,y=Number($('fit-row').value)-1;if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=D.columns||y<0||y>=D.rows){message='Choose column 1–16 and row 1–8.';$('fit-event').textContent=message;return false;}cursor={x,y};ghost();return true;}
 $('fit-column').addEventListener('change',placementFields);$('fit-row').addEventListener('change',placementFields);$('fit-place').addEventListener('click',()=>{if(armed&&placementFields())place(cursor.x,cursor.y);});
 $('fit-move').addEventListener('click',()=>{const p=fit.items[index()];if(!C.get(p.type).locked)arm(p.type,p.uid,p.rotated);});
 $('fit-rotate').addEventListener('click',()=>{
  if(armed){armed.rotated=!armed.rotated;render();return;}
  const p=fit.items[index()];if(C.get(p.type).locked)return;const candidate={...p,rotated:!p.rotated},problem=F.canPlace(fit.items,candidate,p.uid);
  if(problem){message='Cannot rotate here: '+problem+'. Move it first.';render();return;}
  mutate(()=>{fit.items[index()]=candidate;},'Footprint rotated.');
 });
 $('fit-remove').addEventListener('click',()=>{const i=index(),p=fit.items[i],c=C.get(p.type);if(c.locked)return;mutate(()=>{fit.items.splice(i,1);fit.states.splice(i,1);fit.selected=fit.items[Math.max(0,i-1)].uid;},c.name+' removed. '+c.w*c.h+' spaces and '+c.cost+' design credits released.');});
 $('fit-condition').addEventListener('change',e=>{const value=Number(e.target.value);mutate(()=>{fit.states[index()].condition=value;},'Working condition changed. Footprint and purchase cost remain.');});
 $('fit-hit').addEventListener('click',()=>mutate(()=>{fit.states[index()].condition=Math.max(0,fit.states[index()].condition-25);},'Component damaged. Check the ship’s remaining capability.'));
 $('fit-repair').addEventListener('click',()=>mutate(()=>{fit.states[index()].condition=100;},'Prototype component repaired.'));
 $('fit-enabled').addEventListener('change',e=>{const value=e.target.checked;mutate(()=>{fit.states[index()].enabled=value;},value?'Equipment enabled.':'Equipment switched off. It still occupies space and costs the same to build.');});
 $('fit-priority').addEventListener('change',e=>{const value=Number(e.target.value);mutate(()=>{fit.states[index()].priority=value;},'Power priority changed. Dependencies are still supplied first.');});
 $('fit-phase').addEventListener('change',e=>{const value=e.target.value;mutate(()=>{fit.phase=value;},value==='jump'?'Jump charging requested. Check what the reactors can supply alongside propulsion and weapons.':'Normal operation. Jump charging no longer reserves power.');});
 $('fit-budget-target').addEventListener('change',e=>{const value=Number(e.target.value);if(!Number.isInteger(value)||value<0||value>100000){e.target.value=fit.budget;message='Choose a whole-number budget from 0 to 100,000.';render();return;}mutate(()=>{fit.budget=value;},'Design-credit budget updated.');});
 $('fit-store').addEventListener('click',()=>{const i=index(),m=result.model.machines[i];if(m.kind_name==='gun'&&result.rows[i].ready&&m.ammo_store>=0)mutate(()=>{fit.states[m.ammo_store].quantity--;},'One round spent from the connected magazine.');else if(['fuel_tank','magazine'].includes(m.kind_name))mutate(()=>{fit.states[i].quantity=0;},'Store emptied. Its installed footprint remains.');});
 for(const b of document.querySelectorAll('[data-fit-preset]'))b.addEventListener('click',()=>{const next=F.preset(b.dataset.fitPreset);if(!F.validate(next))return;snapshot();fit=next;interaction='inspect';commit(D.presets[b.dataset.fitPreset].name+' loaded with intact equipment. Undo restores your previous fit.');});
 $('fit-undo').addEventListener('click',()=>{if(history.length){fit=history.pop();commit('Previous fit restored.');}});
 $('fit-share').addEventListener('click',async()=>{const url=location.origin+'/ship-lab#fit='+btoa(JSON.stringify(fit));$('fit-share-url').value=url;$('fit-share-result').hidden=false;try{await navigator.clipboard.writeText(url);$('fit-save').textContent='Fit link copied. Paste it into your discussion.';}catch{$('fit-save').textContent='Copy the fit link below.';$('fit-share-url').focus();$('fit-share-url').select();}});
 $('fit-export').addEventListener('click',()=>{const receipt={purpose:'Fleet in Pieces interior UI prototype; not an engine save',catalog:D.version,fit,totals:{space:result.occupied,capacity:result.total,designCredits:result.cost,normalWatts:result.normalDemand,jumpChargingWatts:result.jumpPeak}},url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='kestrel-interior-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 addEventListener('hashchange',()=>{if(location.hash.startsWith('#setup=')){setWorkshop('native');return;}if(!location.hash.startsWith('#fit='))return;const v=decode(location.hash);if(!v){message='That shared fit is invalid. Your current design is unchanged.';render();return;}snapshot();fit=v;setWorkshop('design');commit('Shared fit opened as a separate copy.');historyReplace();});
 function historyReplace(){window.history.replaceState(null,'',location.pathname+location.search);}
 render();if(shared){persist();historyReplace();}else $('fit-save').textContent=storage?'Fit stays in this browser · no account needed':'Browser storage unavailable · keep a Share fit link';
})();
