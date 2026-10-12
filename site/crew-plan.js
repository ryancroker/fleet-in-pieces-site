(() => {
 'use strict';
 const roles=['operators','engineers','pilots','troops','command'],panels=new Map();
 const sum=a=>a.reduce((n,v)=>n+v,0),valid=a=>Array.isArray(a)&&a.length===5&&a.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000);
 function panel(id){
  if(panels.has(id))return panels.get(id);
  const root=document.getElementById(id);if(!root)return null;
  const p={root,identity:null,contract:null,planned:null,result:null,storage:true};panels.set(id,p);
  root.querySelectorAll('[data-crew-role]').forEach(input=>input.addEventListener('change',()=>{
   const i=Number(input.dataset.crewRole),value=Number(input.value);
   if(!p.contract||!Number.isSafeInteger(value)||value<0||value>1000000){render(p);return;}
   p.planned[i]=value;save(p);render(p);
  }));
  root.querySelector('[data-crew-reset]').addEventListener('click',()=>{if(p.contract){p.planned=[...p.contract.complement];save(p);render(p);}});
  return p;
 }
 function save(p){try{localStorage.setItem(p.identity,JSON.stringify({version:'crew-plan-1',planned:p.planned}));}catch{p.storage=false;}}
 function render(p){
  const q=s=>p.root.querySelector(s),c=p.contract,metrics=q('[data-crew-metrics]');metrics.replaceChildren();
  q('[data-crew-reset]').hidden=!c;q('[data-crew-limit]').hidden=!c;
  q('[data-crew-mode]').textContent=c?['Registered quarters','Minimum quarters','Watch quarters','Reserve quarters'][c.quarters_mode]:'Crew capacity pending';
  q('[data-crew-summary]').textContent=c?'Installed quarters set the available places. Choose the complement within their bunk and life-support limits.':p.reason;
  p.root.querySelectorAll('[data-crew-role]').forEach(input=>{const i=Number(input.dataset.crewRole);input.disabled=!c;input.value=c?p.planned[i]:'';q('[data-crew-min="'+i+'"]').textContent=c?c.minimum[i].toLocaleString():'Unknown';});
  if(!c){q('[data-crew-status]').textContent='Crew planning opens when this hull’s quarters are ready.';return;}
  const live=c.compartments.reduce((n,x)=>n+(p.result?.rows[x.machine]?.ready?Math.floor(x.life_support_capacity*Math.max(0,Math.min(1,(p.states?.[x.machine]?.condition??100)/100))+1e-6):0),0),capacity=p.result?Math.min(c.life_support_capacity,live):c.life_support_capacity,total=sum(p.planned),minimum=sum(c.minimum);
  for(const [label,value]of [['Fitted bunks',c.bunks],['Life-support places',capacity],['Minimum crew',minimum],['Planned aboard',total],['Spare berths',c.bunks-total]]){const block=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=value.toLocaleString();block.append(name,number);metrics.append(block);}
  const warnings=[];if(total>c.bunks)warnings.push('Not enough bunks for this complement.');if(total>capacity)warnings.push('Life support cannot sustain this complement.');
  p.planned.forEach((n,i)=>{if(n<c.minimum[i])warnings.push(roles[i][0].toUpperCase()+roles[i].slice(1)+' below the hardware minimum.');});
  q('[data-crew-status]').textContent=warnings.length?warnings.join(' '):'Within the fitted capacity. '+(p.storage?'Your crew plan stays in this browser.':'Browser storage unavailable; this plan lasts for this visit.');
  q('[data-crew-status]').classList.toggle('crew-plan-warning',!!warnings.length);
 }
 function update(id,model,result,reason,states){
  const p=panel(id);if(!p)return;
  const c=model?.crew_accommodation;
  p.contract=c?.available===true&&c.schema==='native-crew-1'&&c.recipe_id===model.recipe&&c.definition_hash===model.definitionHash&&JSON.stringify(c.role_order)===JSON.stringify(roles)&&valid(c.minimum)&&valid(c.complement)?c:null;
  p.result=result;p.states=states;p.reason=reason||'This edition does not include crew capacity yet. You can still explore its hardware.';
  const identity=p.contract?'fleet-crew-plan-1:'+model.definitionHash+':'+c.quarters_mode:null;
  if(identity!==p.identity){p.identity=identity;p.planned=p.contract?[...c.complement]:null;if(identity)try{const saved=JSON.parse(localStorage.getItem(identity));if(saved?.version==='crew-plan-1'&&valid(saved.planned))p.planned=saved.planned;}catch{p.storage=false;}}
  render(p);
 }
 window.FleetCrewPlan={update};
})();
