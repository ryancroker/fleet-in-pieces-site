/* Exact published hardware -> local fitting draft. No manufactured admission,
 * new sockets, replacement articles, people, persistence or network in this layer. */
(()=>{'use strict';
 const api=window.FleetLabModel;
 function fresh(model){return {version:'hull-fit-1',ship:model.key,revision:model.revision,hash:model.definitionHash,removed:[],states:api.fresh(model),selected:model.refit.modules[0]?.id??null,section:'all'};}
 function validate(model,value){
  if(!value||value.version!=='hull-fit-1'||value.ship!==model.key||value.revision!==model.revision||value.hash!==model.definitionHash||!Array.isArray(value.removed)||value.removed.length>model.refit.modules.length||new Set(value.removed).size!==value.removed.length||value.removed.some(id=>!Number.isInteger(id)||!model.refit.modules.some(m=>m.id===id))||!['all','rear','middle','front'].includes(value.section))return null;
  const states=api.validate(model,value.states);
  if(!states||(value.selected!==null&&!model.refit.modules.some(m=>m.id===value.selected)))return null;
  return {...fresh(model),removed:[...value.removed],states,selected:value.selected,section:value.section};
 }
 function section(model,module){const [lo,hi]=model.refit.geometry.bounds,x=module.position[0],fraction=(x-lo[0])/Math.max(.001,hi[0]-lo[0]);return fraction<1/3?'rear':fraction>2/3?'front':'middle';}
 function evaluate(model,fit){
  const removedModules=model.refit.modules.filter(m=>fit.removed.includes(m.id));
  const parts=new Set(removedModules.flatMap(m=>m.parts)),machines=new Set(removedModules.flatMap(m=>m.machines));
  // Keep the original condition/stores separately. Uninstall/reinstall cannot
  // repair a damaged module or create fuel/ammunition in a depleted store.
  const states=fit.states.map((s,i)=>machines.has(i)?{...s,enabled:false,quantity:0}:s);
  const result=api.evaluate(model,states);
  for(const i of machines)result.rows[i].reason='Not fitted';
  const fitted=model.machines.filter(m=>!machines.has(m.index));
  const requested=fitted.reduce((n,m)=>n+m.DemandWatts,0),rated=fitted.reduce((n,m)=>n+m.GenerationWatts,0);
  const storedPower=fitted.some(m=>m.kind_name==='reactor'&&!m.GenerationWatts&&m.InitialQuantity>0);
  const warnings=[];
  if(storedPower)warnings.push('This edition has stored-energy power. Discharge and endurance are not simulated here; power readiness is unverified.');
  if(!storedPower&&requested>rated+.01)warnings.push('All fitted hardware asks for more power than the installed reactors can supply.');
  const offline=fitted.filter(m=>!result.rows[m.index].ready);
  if(!storedPower&&offline.length)warnings.push(offline.length+' fitted component'+(offline.length===1?' is':'s are')+' unavailable. Select its module to see the dependency.');
  if(storedPower)for(const m of fitted)if(!result.rows[m.index].ready&&states[m.index].condition>0&&states[m.index].enabled)result.rows[m.index].reason='Power readiness unverified · stored-energy model pending';
  if(model.machines.some(m=>m.kind_name==='drive')&&!fitted.some(m=>m.kind_name==='drive'))warnings.push('No main drive fitted.');
  if(!fitted.some(m=>m.kind_name==='reactor')&&requested)warnings.push('No reactor fitted.');
  return {result,states,parts,machines,requested,rated,storedPower,offline,warnings,
   materialKg:Math.max(0,model.refit.materialKg-removedModules.reduce((n,m)=>n+m.massKg,0)),
   removedMassKg:removedModules.reduce((n,m)=>n+m.massKg,0),
   guns:fitted.filter(m=>m.kind_name==='gun').length,shields:fitted.filter(m=>m.kind_name==='shield').length};
 }
 window.FleetHullFit={fresh,validate,evaluate,section};
})();
