/* Pure browser model. No DOM, storage, clocks, requests or engine mutation.
 * Native reference: FleetVoxelReactorPower.cpp and FleetVoxelMachinery.cpp.
 * See docs/ship-workshop.md for the deliberately narrower simulation contract. */
(() => {
 'use strict';
 const order=['control','feed','fuel_tank','magazine','life_support','drive','jet','shield','gun','jump'];
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const fresh=model=>model.machines.map(m=>({condition:100,enabled:true,priority:0,quantity:m.InitialQuantity}));
 function validate(model,values){
  if(!Array.isArray(values)||values.length!==model.machines.length)return null;
  if(values.some((s,i)=>!s||![0,25,50,75,100].includes(s.condition)||typeof s.enabled!=='boolean'||![-1,0,1].includes(s.priority)||!Number.isFinite(s.quantity)||s.quantity<0||s.quantity>model.machines[i].InitialQuantity||(!model.fractionalStores&&!Number.isInteger(s.quantity))))return null;
  return values.map(s=>({condition:s.condition,enabled:s.enabled,priority:s.priority,quantity:s.quantity}));
 }
 function evaluate(model,state){
  const machines=model.machines,rows=machines.map(()=>({ready:false,reason:'',allocated:0,output:0,supplied:0,remaining:0})),seen=new Set(),active=new Set();
  const physical=i=>{const s=state[i];return !s.enabled?'Switched off':s.condition===0?'Working component destroyed':null;};
  for(const m of machines.filter(m=>m.GenerationWatts>0)){
   const s=state[m.index],r=rows[m.index];r.reason=physical(m.index)||(!s.quantity?'Reactor store empty':'');
   if(!r.reason){r.output=m.GenerationWatts*clamp((s.condition/100-.6)/.4,0,1);if(r.output<m.DemandWatts){r.output=0;r.reason='Containment below export threshold';}else{r.ready=true;r.allocated=m.DemandWatts;r.supplied=m.DemandWatts;r.remaining=r.output-m.DemandWatts;}}
   seen.add(m.index);
  }
  const allocate=i=>{
   const m=machines[i],s=state[i],r=rows[i];if(seen.has(i))return r.ready;
   if(active.has(i)){r.reason='Dependency cycle';return false;}active.add(i);
   const finish=()=>{active.delete(i);seen.add(i);return r.ready;};
   r.reason=physical(i)||m.missing_supply||'';if(r.reason)return finish();
   for(const d of m.dependencies)if(!allocate(d)){r.reason='Requires '+machines[d].name;return finish();}
   for(const key of ['fuel_store','ammo_store'])if(m[key]>=0&&state[m[key]].quantity<=0){r.reason=key==='fuel_store'?'Propellant store empty':'Magazine empty';return finish();}
   if(!m.power_sources.length){r.ready=m.DemandWatts===0;r.reason=r.ready?'':'No power source';return finish();}
   const sources=m.power_sources.filter(x=>rows[x].ready),capacity=sources.reduce((sum,x)=>sum+rows[x].remaining,0);
   if(!sources.length||capacity+1e-7<m.DemandWatts){r.reason=sources.length?'Insufficient allocated power':'No live power source';return finish();}
   let need=m.DemandWatts;r.ready=true;r.allocated=need;
   for(const source of sources){const paid=Math.min(need,rows[source].remaining);rows[source].remaining-=paid;rows[source].supplied+=paid;need-=paid;}
   return finish();
  };
  const queue=machines.filter(m=>!m.GenerationWatts).sort((a,b)=>state[a.index].priority-state[b.index].priority||order.indexOf(a.kind_name)-order.indexOf(b.kind_name)||a.index-b.index);
  queue.forEach(m=>allocate(m.index));
  rows.forEach((r,i)=>{if(r.ready)r.reason=state[i].condition<100?'Damaged, operating in this model':'Ready';});
  const group=kind=>machines.filter(m=>m.kind_name===kind);
  const count=kind=>group(kind).filter(m=>rows[m.index].ready).length;
  const thrust=group('drive').reduce((sum,m)=>sum+(rows[m.index].ready?m.MaxForce*state[m.index].condition/100:0),0),maxThrust=group('drive').reduce((s,m)=>s+m.MaxForce,0);
  return {rows,supply:rows.reduce((s,r)=>s+r.output,0),used:rows.reduce((s,r)=>s+r.allocated,0),requested:machines.reduce((s,m)=>s+(state[m.index].enabled&&state[m.index].condition?m.DemandWatts:0),0),thrust,maxThrust,shields:count('shield'),shieldTotal:group('shield').length,guns:count('gun'),gunTotal:group('gun').length,unavailable:rows.filter(r=>!r.ready).length};
 }
 window.FleetLabModel={fresh,validate,evaluate};
})();
