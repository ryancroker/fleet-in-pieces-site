// Browser planning contract only. A separate native article contract must admit
// future substitutions. Empty space alone is never a compatibility certificate.
export function refitContract(model, geometry) {
 if(!geometry||geometry.recipe!==model.recipe||geometry.definitionHash!==model.definitionHash)throw Error('Missing exact fitting geometry: '+model.key);
 const parts=model.parts, machines=model.machines;
 const kinds=['gun','shield','reactor','drive','jet','fuel_tank','magazine'];
 const descendants=id=>parts.filter(p=>{
  let next=p.index,seen=new Set();
  while(next>=0&&!seen.has(next)){if(next===id)return true;seen.add(next);next=parts.find(p=>p.index===next)?.parent??-1;}return false;
 }).map(p=>p.index);
 const candidates=[];
 for(const part of parts){
  if(part.parent!==0)continue; // The structural root and integrated systems stay fixed.
  const direct=machines.filter(m=>m.part===part.index);
  const primary=direct.filter(m=>kinds.includes(m.kind_name)).sort((a,b)=>kinds.indexOf(a.kind_name)-kinds.indexOf(b.kind_name))[0];
  if(!primary)continue;
  const children=descendants(part.index), owned=machines.filter(m=>children.includes(m.part));
  // Turret yaw/elevation/recoil is one package. Never delete a service-bearing
  // structural assembly just because a machine happens to occupy it.
  // Old packets do not distinguish a self-contained coolant feed from flight,
  // repair or life-support services. Keep every Feed-bearing package fixed.
  if(owned.some(m=>!kinds.includes(m.kind_name)))continue;
  if(children.length>1&&(primary.kind_name!=='gun'||children.length>3))continue;
  const mass=parts.filter(p=>children.includes(p.index)).reduce((sum,p)=>sum+p.material_kg,0);
  candidates.push({id:part.index,name:part.name,kind:primary.kind_name,primary:primary.index,parts:children,machines:owned.map(m=>m.index),massKg:mass,position:primary.core_position_m});
 }
 return {version:'hull-fit-1',scope:'registered-module-planning',geometry,modules:candidates,
         materialKg:parts.reduce((sum,p)=>sum+p.material_kg,0)};
}
