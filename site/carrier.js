/* One pinned carrier + revisioned fit. Entirely local; never writes visitor activity. */
(()=>{'use strict';
 const D=window.FleetCarrierData,M=window.FleetLabModel,$=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 if(!D||!M||!$('carrier-component'))return;
 const key='fleet:carrier:'+D.version+':'+D.hash,sections=['rear','middle','front'],guns=D.machines.filter(m=>m.kind_name==='gun').slice(0,2),shields=D.machines.filter(m=>m.kind_name==='shield');
 const section=p=>p[0]<-65?'rear':p[0]>65?'front':'middle',kw=n=>(n/1000).toLocaleString('en-US',{maximumFractionDigits:1})+' kW';
 let history=[],state,result,model,storage=true;
 const fresh=()=>({version:D.version,hash:D.hash,emitter:3,fore:0,aft:0,drive:2,jet:2,duty:'defend',section:'middle',selected:D.berths[0].controller,states:M.fresh(D).map(s=>({...s,quantity:Math.floor(s.quantity)}))});
 function validate(v){if(!v||v.version!==D.version||v.hash!==D.hash||![0,1,2,3].includes(v.emitter)||!['fore','aft','drive','jet'].every(k=>[0,1,2].includes(v[k]))||!['defend','flight'].includes(v.duty)||!sections.includes(v.section)||!Number.isInteger(v.selected)||!D.machines[v.selected])return null;const states=M.validate(D,v.states);return states?{version:D.version,hash:D.hash,emitter:v.emitter,fore:v.fore,aft:v.aft,drive:v.drive,jet:v.jet,duty:v.duty,section:v.section,selected:v.selected,states}:null;}
 function fitted(){
  const machines=D.machines.map(m=>({...m}));for(const m of machines){
   if(m.kind_name==='drive'||m.kind_name==='jet'){const limit=.5+.25*state[m.kind_name==='drive'?'drive':'jet'];m.DemandWatts*=limit;m.MaxForce*=limit;}
   if(m.kind_name==='shield'&&state.emitter!==3)m.DemandWatts*=[1.1,1.6,1][state.emitter];
  }
  guns.forEach((g,i)=>{const m=machines[g.index],choice=i?state.aft:state.fore;if(!choice)return;m.DemandWatts*=choice===1?1.1:1.2;m.RoundSpeed*=choice===1?.85:1.2;m.ReloadSeconds*=choice===1?.7:1.3;m.WorkPerShot*=choice===1?.8:1.25;});return {machines};
 }
 function effective(){return state.states.map((s,i)=>({...s,enabled:s.enabled&&!(state.duty==='flight'&&D.machines[i].kind_name==='shield')}));}
 function save(){try{localStorage.setItem(key,JSON.stringify(state));$('carrier-save').textContent='Saved in this browser · no account needed';}catch{storage=false;$('carrier-save').textContent='Local storage unavailable · use Share fit';}}
 function change(fn,message){history.push(JSON.stringify(state));if(history.length>25)history.shift();fn();$('carrier-event').textContent=message;$('carrier-share-result').hidden=true;render();save();}
 function choose(i){state.selected=i;state.section=section(D.machines[i].core_position_m);render();save();}
 function fact(list,name,value){list.append(el('dt',name),el('dd',value));}
 function metric(label,value,note){const n=el('div',undefined,'lab-metric');n.append(el('span',label),el('strong',value),el('small',note));return n;}
 function description(m){
  if(m.GenerationWatts)return 'Finite reactor reserves feed the connected circuits. Containment damage sharply reduces output; at 50% condition this reactor cannot export power.';
  if(D.berths.some(b=>b.controller===m.index))return 'This berth’s arrest and servicing machinery needs its real hangar feed and reactor supply. Aircraft also need finite aviation fuel and ammunition. All shields lower for flight operations.';
  if(m.kind_name==='shield')return 'One quarter of the four-projector shield system. Its hangar feed must survive. Reservoir stores more energy; Cascade recovers faster but costs more power; Facet keeps the standard draw.';
  if(m.kind_name==='gun')return 'A light defensive naval mount with its existing magazine, elevation mechanism and recoil assembly. A Rapid barrel cycles faster; a Lance fires faster rounds with a longer cycle and higher power draw.';
  if(m.kind_name==='drive'||m.kind_name==='jet')return 'The original physical propulsion hardware. A lower fitted power limit reduces both electrical demand and force. Losing its feed or propellant disables it.';
  if(m.name.toLowerCase().includes('aviation tools'))return 'The carrier’s powered repair workshop depends on command and reactor power. Its separate spares store is finite; this browser does not perform reconstruction.';
  if(m.kind_name==='fuel_tank')return 'A finite physical fuel store. Aviation fuel and ship propellant are separate tanks with different consumers.';
  if(m.kind_name==='magazine')return 'A finite physical stock. Using or emptying it does not refill other stores. Repairing damage does not replace used supplies.';
  if(m.kind_name==='feed')return 'A real distribution dependency. Damage here can disable several otherwise intact components; inspect the power and dependency links below.';
  if(m.kind_name==='control')return 'The carrier’s command machinery. Equipment that depends on this controller cannot operate when it is destroyed or switched off.';
  return 'Native carrier machinery. Its power and dependency links are preserved; this simplified model does not simulate heat or physical breakup.';
 }
 function projection(p){const c=D.projection,dot=v=>p.reduce((a,x,i)=>a+x*v[i],0);return [1024+(dot(c.right)-c.centre_x_m)*c.pixels_per_metre,768-(dot(c.up)-c.centre_y_m)*c.pixels_per_metre];}
 function map(){const svg=$('carrier-map');svg.replaceChildren();const ns='http://www.w3.org/2000/svg',node=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  // One marker per installed article/controller, not a stack for every stored item.
  const list=D.machines.filter(m=>m.GenerationWatts||['drive','shield','gun','control'].includes(m.kind_name)||D.berths.some(b=>b.controller===m.index));
  if(!list.some(m=>m.index===state.selected))list.push(D.machines[state.selected]);
  for(const m of list){const [x,y]=projection(m.core_position_m),g=node('g',{class:'carrier-node'+(m.index===state.selected?' selected':'')+(section(m.core_position_m)===state.section?' in-section':'')+(!result.rows[m.index].ready?' bad':''),tabindex:0,role:'button','aria-label':m.name+' · '+result.rows[m.index].reason});g.append(node('circle',{cx:x,cy:y,r:24}));const t=node('text',{x,y});t.textContent=m.index+1;g.append(t);g.addEventListener('click',()=>choose(m.index));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(m.index);}});svg.append(g);}
 }
 function render(){model=fitted();const states=effective();result=M.evaluate(model,states);const supply=D.machines.reduce((n,m)=>n+m.GenerationWatts,0),fittedDemand=model.machines.reduce((n,m)=>n+m.DemandWatts,0),headroom=supply-fittedDemand;
  $('carrier-budget').replaceChildren(metric('Power in use',kw(result.used),'of '+kw(result.supply)+' available'),metric('Fitted reserve',kw(headroom),'all fitted equipment at rated load'),metric('Defensive guns',result.guns+' / '+guns.length,'ready in this scenario'),metric('Shield projectors',result.shields+' / '+shields.length,state.duty==='flight'?'lowered for flight operations':'ready in this scenario'));
  for(const [id,k]of [['shield','emitter'],['fore','fore'],['aft','aft'],['drive','drive'],['jet','jet'],['duty','duty']])$('carrier-'+id).value=state[k];
  $('carrier-shield-note').textContent=Math.round(D.shieldCapacity*[1.6,.7,1.1,1][state.emitter]).toLocaleString('en-US')+' shield reserve · '+Math.round(D.shieldRecharge*[.65,1.6,.85,1][state.emitter]).toLocaleString('en-US')+'/s rated recovery. Four projectors draw '+kw(model.machines.filter(m=>m.kind_name==='shield').reduce((n,m)=>n+m.DemandWatts,0))+'.';
  guns.forEach((g,i)=>{const m=model.machines[g.index];$('carrier-'+(i?'aft':'fore')+'-note').textContent=Math.round(m.RoundSpeed)+' m/s · '+m.ReloadSeconds.toFixed(2)+' s cycle · '+kw(m.DemandWatts)+'. Same mount and finite magazine.';});
  document.querySelectorAll('[data-carrier-section]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.carrierSection===state.section)));$('carrier-focus').textContent='Editing: '+state.section;$('carrier-undo').disabled=!history.length;
  const warnings=[];if(headroom<-.001)warnings.push('Rated load exceeds installed generation by '+kw(-headroom)+'. Lower propulsion limits or use lower-draw equipment before native manufacture.');if(result.used+.01<result.requested)warnings.push('Some equipment lacks power or a working dependency. Select an offline component to trace it.');
  $('carrier-warnings').replaceChildren(...warnings.map(w=>el('li',w)));const m=model.machines[state.selected],s=state.states[state.selected],r=result.rows[state.selected];$('carrier-component').value=state.selected;$('carrier-name').textContent=m.name;$('carrier-description').textContent=description(m);$('carrier-state').textContent=s.condition+'% condition · '+r.reason;$('carrier-enabled').checked=s.enabled;
  const facts=$('carrier-facts');facts.replaceChildren();fact(facts,'Rated demand',kw(m.DemandWatts));fact(facts,'Allocated now',kw(r.allocated));if(m.GenerationWatts)fact(facts,'Output now',kw(r.output));if(m.InitialQuantity)fact(facts,'Finite store',s.quantity.toLocaleString('en-US')+' / '+Math.floor(m.InitialQuantity).toLocaleString('en-US'));fact(facts,'Depends on',m.dependencies.map(i=>D.machines[i].name).join('; ')||'No upstream controller');if(m.power_sources.length)fact(facts,'Powered by',m.power_sources.map(i=>D.machines[i].name).join('; '));
  $('carrier-store').hidden=!m.InitialQuantity;$('carrier-store').textContent=s.quantity?'Use 25% of this store':'Store empty';$('carrier-store').disabled=!s.quantity;
  let serviced=0;const berths=D.berths.map((b,i)=>{const physical=result.rows[b.controller].ready&&result.rows[b.fuel_store].ready&&result.rows[b.ammo_store].ready&&state.states[b.fuel_store].quantity>0&&state.states[b.ammo_store].quantity>0;serviced+=Number(physical);const available=physical&&state.duty==='flight',button=el('button',undefined,available?'':'blocked');button.type='button';button.append(el('span',b.name),el('small',!physical?'Service unavailable':state.duty==='flight'?'Service ready':'Shield interlock'));button.addEventListener('click',()=>choose(b.controller));return button;});
  $('carrier-berths').replaceChildren(...berths);$('carrier-deck-summary').textContent=serviced+' / '+D.berths.length+' berths have working services. '+(state.duty==='flight'?'Shields are down; ready to examine launch and recovery tradeoffs.':'Launch and recovery are held while the shields are up.');
  window.FleetCrewPlan?.update('carrier-crew',D,result,undefined,states);
  map();window.FleetCarrierRenderer?.update({...state,states});
 }
 for(const m of D.machines){const option=el('option',(m.index+1)+'. '+m.name);option.value=m.index;$('carrier-component').append(option);}
 $('carrier-component').addEventListener('change',e=>choose(Number(e.target.value)));
 for(const [id,k]of [['shield','emitter'],['fore','fore'],['aft','aft'],['drive','drive'],['jet','jet']])$('carrier-'+id).addEventListener('change',e=>change(()=>{state[k]=Number(e.target.value);if(k==='fore'||k==='aft'){state.selected=guns[k==='fore'?0:1].index;state.section=section(D.machines[state.selected].core_position_m);}else if(k==='emitter'){state.selected=shields[0].index;state.section='front';}},'Fitting changed. Existing damage and used stores are retained.'));
 $('carrier-duty').addEventListener('change',e=>change(()=>state.duty=e.target.value,e.target.value==='flight'?'Flight operations: all four shield projectors lower.':'Defensive duty: fitted shield projectors may draw power again.'));
 document.querySelectorAll('[data-carrier-section]').forEach(b=>b.addEventListener('click',()=>{state.section=b.dataset.carrierSection;render();save();}));
 $('carrier-section-hit').addEventListener('click',()=>change(()=>D.machines.forEach(m=>{if(section(m.core_position_m)===state.section)state.states[m.index].condition=Math.max(0,state.states[m.index].condition-25);}),state.section+' equipment damaged by 25 condition points.'));
 $('carrier-hit').addEventListener('click',()=>change(()=>state.states[state.selected].condition=Math.max(0,state.states[state.selected].condition-25),'Selected component damaged. Follow the resulting power and service failures.'));
 $('carrier-component-repair').addEventListener('click',()=>change(()=>state.states[state.selected].condition=100,'Component condition restored. Stores and enabled state are unchanged.'));
 $('carrier-repair').addEventListener('click',()=>change(()=>state.states.forEach(s=>s.condition=100),'Damage repaired. Used stores and disabled equipment remain as set.'));
 $('carrier-enabled').addEventListener('change',e=>change(()=>state.states[state.selected].enabled=e.target.checked,'Component enable state changed.'));
 $('carrier-store').addEventListener('click',()=>change(()=>{const m=D.machines[state.selected],s=state.states[state.selected];s.quantity=Math.max(0,s.quantity-Math.ceil(Math.floor(m.InitialQuantity)*.25));},'Finite stock used. Repairing the component will not refill it.'));
 $('carrier-undo').addEventListener('click',()=>{if(!history.length)return;state=JSON.parse(history.pop());render();save();$('carrier-event').textContent='Previous setup restored.';});
 $('carrier-reset').addEventListener('click',()=>change(()=>state=fresh(),'Stock fittings and intact, full stores restored as a new browser scenario.'));
 document.querySelectorAll('[data-carrier-preset]').forEach(b=>b.addEventListener('click',()=>change(()=>{const p=b.dataset.carrierPreset;state.emitter=p==='reserve'?0:p==='recovery'?1:3;state.fore=p==='stock'?0:1;state.aft=p==='stock'?0:1;state.drive=p==='stock'?2:p==='reserve'?1:0;state.jet=p==='stock'?2:0;},'Starting fit loaded. Damage, duty and used stores stay as set.')));
 $('carrier-share').addEventListener('click',async()=>{const url=location.origin+'/ship-lab/kite#carrier='+btoa(JSON.stringify(state));$('carrier-share-url').value=url;$('carrier-share-result').hidden=false;try{await navigator.clipboard.writeText(url);$('carrier-save').textContent='Carrier setup link copied';}catch{$('carrier-save').textContent='Copy the carrier setup link below';$('carrier-share-url').focus();$('carrier-share-url').select();}});
 function shared(){try{if(!location.hash.startsWith('#carrier=')||location.hash.length>24000)return null;return validate(JSON.parse(atob(location.hash.slice(9))));}catch{return null;}}
 const incoming=shared();let saved;try{saved=validate(JSON.parse(localStorage.getItem(key)));}catch{storage=false;}state=incoming||saved||fresh();render();
 if(incoming)$('carrier-event').textContent='Shared carrier setup opened as a separate copy.';else if(location.hash)$('carrier-event').textContent='This link does not match the current carrier packet. Your local setup is unchanged.';
 $('carrier-save').textContent=incoming?'Shared setup · changes save only in this browser':saved?'Your local carrier setup is restored':storage?'Saved only after you change something · no account needed':'Local storage unavailable · use Share fit';
 addEventListener('hashchange',()=>{const v=shared();if(v)change(()=>state=v,'Shared carrier setup opened as a separate copy.');else $('carrier-event').textContent='That carrier setup link could not be read. Current setup is unchanged.';});
})();
