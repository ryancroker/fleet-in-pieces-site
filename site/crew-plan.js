(() => {
 'use strict';
 const roles=['operators','engineers','pilots','troops','command'],panels=new Map();
 const sum=a=>a.reduce((n,v)=>n+v,0),valid=a=>Array.isArray(a)&&a.length===5&&a.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000);
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function panel(id){
  if(panels.has(id))return panels.get(id);
  const root=document.getElementById(id);if(!root)return null;
  const p={id,root,identity:null,contract:null,planned:null,result:null,storage:true,options:{}};panels.set(id,p);
  root.querySelectorAll('[data-crew-role]').forEach(input=>input.addEventListener('change',()=>{
   const i=Number(input.dataset.crewRole),value=Number(input.value);
   if(!p.contract||!Number.isSafeInteger(value)||value<0||value>1000000){render(p);return;}
   p.planned[i]=value;save(p);render(p);
  }));
  root.querySelector('[data-crew-reset]').addEventListener('click',()=>{if(p.contract){p.planned=[...p.contract.complement];save(p);render(p);}});
  return p;
 }
 function save(p){
  if(p.options.onPlanChange){p.options.onPlanChange([...p.planned]);return;}
  try{localStorage.setItem(p.identity,JSON.stringify({version:'crew-plan-1',planned:p.planned}));}catch{p.storage=false;}
 }
 function choices(p){
  const family=p.model?.crewFamily||p.model?.key||({'fit-crew':'kestrel','carrier-crew':'kite'}[p.id]);
  const entries=(window.FleetDesignerData?.entries||[]).filter(e=>e.crew?.family===family),nav=p.root.querySelector('[data-crew-options]');
  nav.replaceChildren();nav.hidden=!entries.length;
  for(const e of entries){const a=el('a',['','Minimum','Watch','Reserve'][e.crew.mode]+' · '+e.crew.bunks+' bunks');a.href=e.fitRoute+'#refit-crew';if(e.key===p.model?.key)a.setAttribute('aria-current','page');nav.append(a);}
 }
 function rooms(p){
  const details=p.root.querySelector('[data-crew-room-details]'),list=p.root.querySelector('[data-crew-rooms]');
  details.hidden=!p.contract;list.replaceChildren();if(!p.contract)return;
  p.contract.compartments.forEach((room,i)=>{
   const state=p.states?.[room.machine],ready=!!p.result?.rows[room.machine]?.ready;
   const live=ready?Math.floor(room.life_support_capacity*(state?.condition??100)/100+1e-6):0;
   const card=el('article');card.append(el('h3','Quarters '+(i+1)),el('p',room.bunks+' bunks · '+live+'/'+room.life_support_capacity+' supported · '+room.demand_watts.toLocaleString()+' W'));
   card.append(el('small',p.result?.rows[room.machine]?.reason||'Native rated capacity'));
   if(p.options.onRoomChange){
    const label=el('label','Life-support condition'),select=el('select');select.setAttribute('aria-label','Quarters '+(i+1)+' life-support condition');
    for(const n of [100,75,50,25,0])select.append(new Option(n+'%',String(n)));select.value=state?.condition??100;
    select.addEventListener('change',()=>p.options.onRoomChange(room.machine,{condition:Number(select.value)}));label.append(select);card.append(label);
    const enabledLabel=el('label'),enabled=el('input');enabled.type='checkbox';enabled.checked=state?.enabled??true;enabled.setAttribute('aria-label','Quarters '+(i+1)+' life support enabled');enabled.addEventListener('change',()=>p.options.onRoomChange(room.machine,{enabled:enabled.checked}));enabledLabel.append(enabled,document.createTextNode(' Life support enabled'));card.append(enabledLabel);
    const focus=el('button','Locate quarters on ship');focus.type='button';focus.addEventListener('click',()=>p.options.onRoomSelect?.(room));card.append(focus);
   }
   list.append(card);
  });
 }
 function render(p){
  const q=s=>p.root.querySelector(s),c=p.contract,metrics=q('[data-crew-metrics]');metrics.replaceChildren();choices(p);
  q('[data-crew-reset]').hidden=!c;q('[data-crew-limit]').hidden=!c;
  q('[data-crew-mode]').textContent=c?['Registered quarters','Minimum quarters','Watch quarters','Reserve quarters'][c.quarters_mode]:'Crew capacity pending';
  q('[data-crew-summary]').textContent=c?['','A compact complement with spare bunks for passengers or reserves.','A larger default watch. More crew, more room and more life-support power.','The larger quarters with the minimum crew aboard: keep the rest for reserves.'][c.quarters_mode]:p.reason;
  const provenance=q('[data-crew-provenance]');provenance.hidden=!c;
  if(c)provenance.textContent='Native revision 7 · 75% main-drive and thruster limits · local-flight configuration. Switching quarters opens a separate exact fit.';
  p.root.querySelectorAll('[data-crew-role]').forEach(input=>{const i=Number(input.dataset.crewRole);input.disabled=!c;input.value=c?p.planned[i]:'';q('[data-crew-min="'+i+'"]').textContent=c?c.minimum[i].toLocaleString():'Unknown';});
  rooms(p);
  if(!c){q('[data-crew-status]').textContent=p.root.querySelector('[data-crew-options]').hidden?'Crew planning opens when this hull’s quarters are ready.':'Open a crew fit above to plan accommodation. Historical capacities stay unknown.';q('[data-crew-status]').classList.remove('crew-plan-warning');return;}
  const live=c.compartments.reduce((n,x)=>n+(p.result?.rows[x.machine]?.ready?Math.floor(x.life_support_capacity*Math.max(0,Math.min(1,(p.states?.[x.machine]?.condition??100)/100))+1e-6):0),0);
  const capacity=p.result?Math.min(c.life_support_capacity,live):c.life_support_capacity,total=sum(p.planned),minimum=sum(c.minimum);
  for(const [label,value]of [['Fitted bunks',c.bunks],['Life-support places',capacity],['Hardware minimum',minimum],['Planned aboard',total],['Spare bunks',Math.max(0,c.bunks-total)]]){const block=el('div');block.append(el('span',label),el('strong',value.toLocaleString()));metrics.append(block);}
  const warnings=[];
  if(total>c.bunks)warnings.push((total-c.bunks).toLocaleString()+' people have no bunk.');
  if(total>capacity)warnings.push('Life support is short by '+(total-capacity).toLocaleString()+' places.');
  p.planned.forEach((n,i)=>{if(n<c.minimum[i])warnings.push(roles[i][0].toUpperCase()+roles[i].slice(1)+' below the hardware minimum.');});
  q('[data-crew-status]').textContent=warnings.length?warnings.join(' '):'Within the fitted capacity. '+(p.options.onPlanChange?'Included in this loadout and its share link.':p.storage?'Your crew plan stays in this browser.':'Browser storage unavailable; this plan lasts for this visit.');
  q('[data-crew-status]').classList.toggle('crew-plan-warning',!!warnings.length);
 }
 function update(id,model,result,reason,states,options={}){
  const p=panel(id);if(!p)return;
  const c=model?.crew_accommodation;
  p.contract=c?.available===true&&c.schema==='native-crew-1'&&c.recipe_id===model.recipe&&c.definition_hash===model.definitionHash&&JSON.stringify(c.role_order)===JSON.stringify(roles)&&valid(c.minimum)&&valid(c.complement)?c:null;
  p.model=model;p.result=result;p.states=states;p.options=options;p.reason=reason||'This edition does not include crew capacity yet. You can still explore its hardware.';
  const identity=p.contract?'fleet-crew-plan-1:'+model.definitionHash+':'+c.quarters_mode:null;
  if(identity!==p.identity){p.identity=identity;p.planned=p.contract?[...c.complement]:null;if(identity&&!options.plan)try{const saved=JSON.parse(localStorage.getItem(identity));if(saved?.version==='crew-plan-1'&&valid(saved.planned))p.planned=saved.planned;}catch{p.storage=false;}}
  if(p.contract&&valid(options.plan))p.planned=[...options.plan];
  render(p);
 }
 window.FleetCrewPlan={update};
})();