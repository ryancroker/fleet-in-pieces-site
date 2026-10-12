/* Section fitting prototype: catalog + equipment assignments -> shared evaluator.
 * Section capacities and prices are design tuning, not native build admission. */
(() => {
 'use strict';
 const D=window.FleetOutfitData,C=new Map(D.catalog.map(c=>[c.id,c])),S=new Map(D.sections.map(s=>[s.id,s]));
 function capacity(section,v){return D.allocations[v?.allocation||D.allocation][section];}
 function canAssign(items,p,ignore=null,v=null){
  const c=C.get(p.type),s=S.get(p.section);if(!c||!s)return 'Unknown equipment or section';
  if(c.section&&c.section!==s.id)return c.name+' belongs in the '+S.get(c.section).name.toLowerCase();
  if(ignore===null&&items.length>=48)return 'This study supports up to 48 installations';
  const limit=D.mounts[c.kind]?.[s.id];
  if(limit!==undefined&&items.filter(i=>i.uid!==ignore&&i.section===s.id&&C.get(i.type).kind===c.kind).length>=limit)return limit?s.name+' has no free '+(c.kind==='gun'?'weapon':'emitter')+' mount':s.name+' has no '+(c.kind==='gun'?'weapon':'emitter')+' mount';
  const limitSpace=capacity(s.id,v),used=items.filter(i=>i.uid!==ignore&&i.section===s.id).reduce((n,i)=>n+C.get(i.type).space,0);
  return used+c.space>limitSpace?s.name+' has '+Math.max(0,limitSpace-used)+' spaces free; this needs '+c.space+'. Move equipment to another section or choose a smaller package':'';
 }
 function freshState(p){const c=C.get(p.type);return {condition:100,enabled:true,priority:0,quantity:c.quantity||0};}
 function preset(key){const def=D.presets[key];if(!def)return null;const items=D.fixed.map(p=>({...p}));def.items.forEach(([type,section],i)=>items.push({uid:i+3,type,section}));return {version:D.version,allocation:D.allocation,items,states:items.map(freshState),phase:'normal',budget:D.budget,selected:3,section:'middle'};}
 // Validate released grid recipes before converting them. Keep all hardware and
 // state; section overages remain visible rather than silently dropping items.
 function migrate(v){
  const L=D.legacy,used=new Set();if(!v||v.version!==L.version||!Array.isArray(v.items)||v.items.length>48)return null;
  for(const p of v.items){
   const size=p&&L.sizes[p.type];if(!size||!C.has(p.type)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||typeof p.rotated!=='boolean')return null;
   const [w,h]=p.rotated?[size[1],size[0]]:size;
   if(p.x+w>L.columns||p.y+h>L.rows)return null;
   const fixed=L.fixed.find(f=>f.uid===p.uid);
   if(fixed&&(fixed.type!==p.type||fixed.x!==p.x||fixed.y!==p.y||p.rotated))return null;
   if(C.get(p.type).locked&&!fixed)return null;
   for(let y=p.y;y<p.y+h;y++)for(let x=p.x;x<p.x+w;x++){
    const lane=x>=L.serviceLane.x&&x<L.serviceLane.x+L.serviceLane.w&&y>=L.serviceLane.y&&y<L.serviceLane.y+L.serviceLane.h;
    if(x<L.rowBounds[y][0]||x>=L.rowBounds[y][1]||lane||used.has(x+','+y)||(p.type==='drive'&&x>3))return null;
    used.add(x+','+y);
   }
  }
  const items=v.items.map(p=>{const fixed=D.fixed.find(f=>f.uid===p.uid),size=L.sizes[p.type],centre=p.x+(p.rotated?size[1]:size[0])/2;return {uid:p.uid,type:p.type,section:fixed?fixed.section:centre<16/3?'rear':centre<32/3?'middle':'front'};});
  return validate({...v,version:D.version,allocation:'legacy',items,section:items.find(p=>p.uid===v.selected)?.section||'middle',converted:true});
 }
 function validate(v){
  if(v?.version===D.legacy.version)return migrate(v);
  const previous=D.previous.find(p=>p.version===v?.version);
  if(previous){
   if(!Array.isArray(v.items)||v.items.some(p=>!p||!previous.types.includes(p.type)))return null;
   return validate({...v,version:D.version,allocation:'legacy'});
  }
  if(!v||v.version!==D.version||!Object.hasOwn(D.allocations,v.allocation)||!Array.isArray(v.items)||v.items.length<2||v.items.length>48||!Array.isArray(v.states)||v.states.length!==v.items.length||!['normal','jump'].includes(v.phase)||!Number.isInteger(v.budget)||v.budget<0||v.budget>100000)return null;
  const items=[],states=[],ids=new Set();
  for(let i=0;i<v.items.length;i++){
   const p=v.items[i],s=v.states[i],c=p&&C.get(p.type);
   if(!c||!S.has(p.section)||!Number.isInteger(p.uid)||p.uid<1||p.uid>10000||ids.has(p.uid)||(c.section&&c.section!==p.section))return null;
   const fixed=D.fixed.find(f=>f.uid===p.uid);
   if(c.locked&&(!fixed||fixed.type!==p.type||fixed.section!==p.section)||fixed&&!c.locked)return null;
   if(!s||![0,25,50,75,100].includes(s.condition)||typeof s.enabled!=='boolean'||![-1,0,1].includes(s.priority)||!Number.isInteger(s.quantity)||s.quantity<0||s.quantity>(c.quantity||0))return null;
   ids.add(p.uid);items.push({uid:p.uid,type:p.type,section:p.section});states.push({condition:s.condition,enabled:s.enabled,priority:s.priority,quantity:s.quantity});
  }
  if(D.fixed.some(f=>!ids.has(f.uid)))return null;
  // Over-capacity imports are editable drafts, never reported as valid fits.
  return {version:D.version,allocation:v.allocation,items,states,phase:v.phase,budget:v.budget,selected:ids.has(v.selected)?v.selected:items[0].uid,section:S.has(v.section)?v.section:'middle',...(v.converted===true?{converted:true}:{})};
 }
 function evaluate(v){
  const items=v.items,states=v.states,source=items.flatMap((p,i)=>C.get(p.type).generation?[i]:[]),find=type=>items.flatMap((p,i)=>p.type===type?[i]:[]);
  const control=find('bridge')[0],bus=find('bus')[0];
  // One abstract shared bus, with automatic connection to the first usable store.
  // No claim of physical pipe routing, reach or redundancy from its placement.
  const store=type=>find(type).find(i=>states[i].enabled&&states[i].condition>0&&states[i].quantity>0)??find(type)[0]??-1;
  const machines=items.map((p,i)=>{
   const c=C.get(p.type),fuel=c.kind==='drive'?store('fuel'):-1,ammo=c.kind==='gun'?store('ammo'):-1;
   return {index:i,name:c.name+' #'+p.uid,kind_name:c.kind,part:i,core_position_m:S.get(p.section).point,power_sources:c.generation?[]:source,dependencies:c.generation||i===bus?[]:i===control?[bus]:[control,bus,...(fuel>=0?[fuel]:[]),...(ammo>=0?[ammo]:[])],fuel_store:fuel,ammo_store:ammo,DemandWatts:c.kind==='jump'?(v.phase==='jump'?c.chargeDemand:0):c.demand,GenerationWatts:c.generation||0,InitialQuantity:c.quantity||0,MaxForce:c.force||0,missing_supply:c.kind==='drive'&&fuel<0?'No propellant tank fitted':c.kind==='gun'&&ammo<0?'No magazine fitted':null};
  });
  const unmounted=new Set(),mountCounts={};
  for(const p of [...items].sort((a,b)=>a.uid-b.uid)){
   const kind=C.get(p.type).kind,limit=D.mounts[kind]?.[p.section];if(limit===undefined)continue;
   const key=kind+':'+p.section;mountCounts[key]=(mountCounts[key]||0)+1;if(mountCounts[key]>limit)unmounted.add(p.uid);
  }
  for(let i=0;i<items.length;i++)if(unmounted.has(items[i].uid))machines[i].missing_supply='No compatible exterior mount. Move or remove this draft installation.';
  const model={machines},r=window.FleetLabModel.evaluate(model,states),count=type=>items.flatMap((p,i)=>(type==='gun'||type==='shield'?C.get(p.type).kind===type:p.type===type)?[i]:[]).filter(i=>r.rows[i].ready).length;
  const sections=D.sections.map(s=>({...s,capacity:capacity(s.id,v),used:items.filter(p=>p.section===s.id).reduce((n,p)=>n+C.get(p.type).space,0)}));
  const occupied=sections.reduce((n,s)=>n+s.used,0),total=sections.reduce((n,s)=>n+s.capacity,0);
  const cost=D.hullCost+items.reduce((n,p)=>n+C.get(p.type).cost,0),normalDemand=items.reduce((n,p,i)=>n+(states[i].enabled&&states[i].condition?C.get(p.type).demand:0),0),jumpPeak=find('jump').reduce((n,i)=>n+(states[i].enabled&&states[i].condition?C.get('jump').chargeDemand:0),0);
  const warnings=sections.filter(s=>s.used>s.capacity).map(s=>s.name+' is over capacity by '+(s.used-s.capacity)+' spaces. Move or remove equipment.');
  if(unmounted.size)warnings.push(unmounted.size+' draft installation'+(unmounted.size===1?' has':'s have')+' no compatible exterior mount. Preserved in your list, but not drawn or operational. Move or remove it.');
  if(!count('reactor'))warnings.push('No working reactor. The ship has no power.');
  if(!count('drive'))warnings.push('No working main drive. This fit cannot propel itself.');
  if(!count('crew'))warnings.push('Crew and life support are missing or offline. Incomplete crewed design.');
  if(!count('gun'))warnings.push('No ready weapon. This fit cannot perform armed defense.');
  if(cost>v.budget)warnings.push('Over the chosen build budget by '+(cost-v.budget).toLocaleString('en-US')+' design credits.');
  if(r.used+1<r.requested)warnings.push('Demand exceeds available allocation. Inspect offline systems or change priorities.');
  const jumpCount=find('jump').length,jumpReady=count('jump');
  const jumpStatus=!jumpCount?'No independent jump':v.phase==='normal'?'Fitted · charging idle':jumpReady?jumpReady+' charging package'+(jumpReady===1?'':'s'):'Charging blocked';
  return {...r,model,sections,occupied,total,cost,normalDemand,jumpPeak,jumpCount,jumpStatus,warnings,unmounted};
 }
 window.FleetOutfit={data:D,catalog:C,sections:S,capacity,canAssign,freshState,preset,validate,evaluate};
})();
