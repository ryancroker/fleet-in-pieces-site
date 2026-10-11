/* Interior prototype: immutable catalog + placements -> shared FleetLabModel.
 * Grid reservations and prices are design tuning, not native build admission. */
(() => {
 'use strict';
 const D=window.FleetOutfitData, C=new Map(D.catalog.map(c=>[c.id,c]));
 const dims=p=>{const c=C.get(p.type);return p.rotated?{w:c.h,h:c.w}:{w:c.w,h:c.h};};
 const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&y>=0&&y<D.rows&&x>=D.rowBounds[y][0]&&x<D.rowBounds[y][1];
 const lane=(x,y)=>x>=D.serviceLane.x&&x<D.serviceLane.x+D.serviceLane.w&&y>=D.serviceLane.y&&y<D.serviceLane.y+D.serviceLane.h;
 function cells(p){const {w,h}=dims(p),a=[];for(let y=p.y;y<p.y+h;y++)for(let x=p.x;x<p.x+w;x++)a.push([x,y]);return a;}
 function canPlace(items,p,ignore=null){
  const c=C.get(p.type);if(!c)return 'Unknown equipment';
  if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||typeof p.rotated!=='boolean')return 'Invalid placement';
  const points=cells(p);
  if(points.some(([x,y])=>!inside(x,y)))return 'Outside the usable hull envelope';
  if(points.some(([x,y])=>lane(x,y)))return 'Keep the service corridor clear';
  if(c.mount==='aft'&&points.some(([x])=>x>3))return 'Main drives need the aft four columns';
  const occupied=new Set(items.filter(i=>i.uid!==ignore).flatMap(i=>cells(i).map(([x,y])=>x+','+y)));
  if(points.some(([x,y])=>occupied.has(x+','+y)))return 'Another installation occupies that space';
  return '';
 }
 function freshState(p){const c=C.get(p.type);return {condition:100,enabled:true,priority:0,quantity:c.quantity||0};}
 function preset(key){const def=D.presets[key];if(!def)return null;const items=D.fixed.map(p=>({...p}));def.items.forEach(([type,x,y],i)=>items.push({uid:i+3,type,x,y,rotated:false}));return {version:D.version,items,states:items.map(freshState),phase:'normal',budget:D.budget,selected:3};}
 function validate(v){
  if(!v||v.version!==D.version||!Array.isArray(v.items)||v.items.length<2||v.items.length>48||!Array.isArray(v.states)||v.states.length!==v.items.length||!['normal','jump'].includes(v.phase)||!Number.isInteger(v.budget)||v.budget<0||v.budget>100000)return null;
  const items=[],states=[],ids=new Set();
  for(let i=0;i<v.items.length;i++){
   const p=v.items[i],s=v.states[i],c=p&&C.get(p.type);
   if(!c||!Number.isInteger(p.uid)||p.uid<1||p.uid>10000||ids.has(p.uid)||canPlace(items,p))return null;
   const fixed=D.fixed.find(f=>f.uid===p.uid);
   if(c.locked&&(!fixed||fixed.type!==p.type||fixed.x!==p.x||fixed.y!==p.y||p.rotated))return null;
   if(fixed&&!c.locked)return null;
   if(!s||![0,25,50,75,100].includes(s.condition)||typeof s.enabled!=='boolean'||![-1,0,1].includes(s.priority)||!Number.isInteger(s.quantity)||s.quantity<0||s.quantity>(c.quantity||0))return null;
   ids.add(p.uid);items.push({uid:p.uid,type:p.type,x:p.x,y:p.y,rotated:p.rotated});states.push({condition:s.condition,enabled:s.enabled,priority:s.priority,quantity:s.quantity});
  }
  if(D.fixed.some(f=>!ids.has(f.uid)))return null;
  return {version:D.version,items,states,phase:v.phase,budget:v.budget,selected:ids.has(v.selected)?v.selected:items[0].uid};
 }
 function evaluate(v){
  const items=v.items,states=v.states,source=items.flatMap((p,i)=>C.get(p.type).generation?[i]:[]),find=type=>items.flatMap((p,i)=>p.type===type?[i]:[]);
  const control=find('bridge')[0],bus=find('bus')[0];
  // One abstract shared bus, with automatic connection to the first usable store.
  // No claim of physical pipe routing, reach or redundancy from its placement.
  const store=type=>find(type).find(i=>states[i].enabled&&states[i].condition>0&&states[i].quantity>0)??find(type)[0]??-1;
  const machines=items.map((p,i)=>{
   const c=C.get(p.type),fuel=c.kind==='drive'?store('fuel'):-1,ammo=c.kind==='gun'?store('ammo'):-1;
   return {index:i,name:c.name+' #'+p.uid,kind_name:c.kind,part:i,core_position_m:[p.x,p.y,0],power_sources:c.generation?[]:source,dependencies:c.generation||i===bus?[]:i===control?[bus]:[control,bus,...(fuel>=0?[fuel]:[]),...(ammo>=0?[ammo]:[])],fuel_store:fuel,ammo_store:ammo,DemandWatts:c.kind==='jump'?(v.phase==='jump'?c.chargeDemand:0):c.demand,GenerationWatts:c.generation||0,InitialQuantity:c.quantity||0,MaxForce:c.force||0,missing_supply:c.kind==='drive'&&fuel<0?'No propellant tank fitted':c.kind==='gun'&&ammo<0?'No magazine fitted':null};
  });
  const model={machines},r=window.FleetLabModel.evaluate(model,states),count=type=>find(type).filter(i=>r.rows[i].ready).length;
  const occupied=items.reduce((n,p)=>{const s=dims(p);return n+s.w*s.h;},0),total=D.rowBounds.reduce((n,[a,b])=>n+b-a,0)-D.serviceLane.w*D.serviceLane.h;
  const cost=D.hullCost+items.reduce((n,p)=>n+C.get(p.type).cost,0),normalDemand=items.reduce((n,p,i)=>n+(states[i].enabled&&states[i].condition?C.get(p.type).demand:0),0),jumpPeak=find('jump').reduce((n,i)=>n+(states[i].enabled&&states[i].condition?C.get('jump').chargeDemand:0),0);
  const warnings=[];
  if(!count('reactor'))warnings.push('No working reactor. The ship has no power.');
  if(!count('drive'))warnings.push('No working main drive. This fit cannot propel itself.');
  if(!count('crew'))warnings.push('Crew and life support are missing or offline. Incomplete crewed design.');
  if(!count('gun'))warnings.push('No ready weapon. This fit cannot perform armed defense.');
  if(cost>v.budget)warnings.push('Over the chosen build budget by '+(cost-v.budget).toLocaleString('en-US')+' design credits.');
  if(r.used+1<r.requested)warnings.push('Demand exceeds available allocation. Inspect offline systems or change priorities.');
  const jumpCount=find('jump').length,jumpReady=count('jump');
  const jumpStatus=!jumpCount?'No independent jump':v.phase==='normal'?'Fitted · charging idle':jumpReady?jumpReady+' charging package'+(jumpReady===1?'':'s'):'Charging blocked';
  return {...r,model,occupied,total,cost,normalDemand,jumpPeak,jumpCount,jumpStatus,warnings};
 }
 window.FleetOutfit={data:D,catalog:C,dims,inside,lane,cells,canPlace,freshState,preset,validate,evaluate};
})();
