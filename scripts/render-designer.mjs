import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateCrew} from './crew-contract.mjs';
import {refitContract} from './refit-contract.mjs';

const fields=['index','name','kind','kind_name','part','core_position_m','power_sources','dependencies','fuel_store','ammo_store','DemandWatts','GenerationWatts','InitialQuantity','MaxForce'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function buildDesigner(root,register){
 const geometry=JSON.parse(await readFile(path.join(root,'content/fleet-geometry.json'),'utf8'));
 let nativeSources={schema:'designer-native-1',ships:{}};
 try{nativeSources=JSON.parse(await readFile(path.join(root,'content/designer-native-sources.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(nativeSources.schema!=='designer-native-1'||!nativeSources.ships)throw Error('Invalid native designer source index');
 const folder=path.join(root,'site/assets/designer');await mkdir(folder,{recursive:true});
 const entries=[],models=[];
 for(const [key,ship] of Object.entries(register.ships)){
  if(!/^[a-z0-9-]+$/.test(key))throw Error('Invalid designer hull key');
  const edition=ship.configurations.find(c=>c.revision_id===ship.current_revision);
  if(!edition||!/^revisions\/fr1-[a-f0-9]+\.json$/.test(edition.path))throw Error('Missing pinned designer revision: '+key);
  const d=JSON.parse(await readFile(path.join(root,'site/assets/fleet-register',edition.path),'utf8'));
  if(d.configuration.recipe_id!==edition.recipe_id||d.configuration.definition_hash!==edition.definition_hash||d.revision_id!==edition.revision_id)throw Error('Designer identity mismatch: '+key);
  const machines=d.machinery.map(m=>Object.fromEntries(fields.map(k=>[k,m[k]])));
  if(!machines.length||machines.some((m,i)=>m.index!==i||!Array.isArray(m.core_position_m)||m.core_position_m.length!==3||!m.core_position_m.every(Number.isFinite)||[...m.power_sources,...m.dependencies,m.fuel_store,m.ammo_store].some(x=>!Number.isInteger(x)||x < -1||x>=machines.length)||[m.DemandWatts,m.GenerationWatts,m.InitialQuantity,m.MaxForce].some(n=>!Number.isFinite(n)||n<0)))throw Error('Invalid machinery: '+key);
  for(const view of ['hero','top','side']){
   const art=d.art[view];if(!art||!/^assets\/[a-f0-9]+\.png$/.test(art.path)||!art.projection||art.width<=0||art.height<=0)throw Error('Missing projected art: '+key);
   await access(path.join(root,'site/assets/fleet-register',art.path));
  }
  const model={key,name:d.display_name,role:ship.role,revision:d.revision_id,recipe:d.configuration.recipe_id,definitionHash:d.configuration.definition_hash,exported:d.configuration.exported_utc,machines,parts:d.parts.map(p=>({index:p.index,name:p.name,parent:p.parent,material_kg:p.material_kg})),art:d.art,dimensions:edition.assembled_dimensions_m,dossier:'/ships/designs/'+key};
  if(model.parts.some(p=>!Number.isFinite(p.material_kg)||p.material_kg<0))throw Error('Missing native material mass: '+key);
  let native=null;
  const source=nativeSources.ships[key];
  if(source){
   if(!/^native-hulls\/[a-f0-9]{40}\.json$/.test(source.path))throw Error('Invalid native hull source path');
   const raw=await readFile(path.join(root,'content',source.path));
   if(createHash('sha256').update(raw).digest('hex')!==source.sha256||d.evidence.native_packet_sha256?.['ship.json']!==source.sha256)throw Error('Native hull source provenance mismatch: '+key);
   native=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
   if(native.id!==model.recipe||native.definition_hash!==model.definitionHash||native.parts.length!==model.parts.length||native.machines.length!==machines.length)throw Error('Native hull edition mismatch: '+key);
   const f=native.fitting_contract;
   if(f?.schema!=='native-fitting-1'||f.recipe_id!==model.recipe||f.definition_hash!==model.definitionHash)throw Error('Missing exact native fitting contract: '+key);
   model.fitting_contract=f;model.nativeSourceSha256=source.sha256;
  }
  model.refit=refitContract(model,geometry[key]);
  model.crew_accommodation=validateCrew(native?.crew_accommodation||d.crew_accommodation,model);
  // New hull packets retain exact finite store quantities, including fractional kg/J.
  if(!['kestrel','kestrel-pd','kestrel-signal'].includes(key))model.fractionalStores=true;
  const bytes=JSON.stringify(model),sha=createHash('sha256').update(bytes).digest('hex');
  const file=key+'.'+sha.slice(0,12)+'.json';await writeFile(path.join(folder,file),bytes+'\n');
  entries.push({key,name:d.display_name,role:ship.role,category:ship.category,recipe:model.recipe,definitionHash:model.definitionHash,revision:model.revision,exported:model.exported,model:'/assets/designer/'+file,hero:'/assets/fleet-register/'+d.art.hero.path,inspectRoute:'/ship-lab?ship='+key+'#ship-workshop',fitRoute:key==='kestrel'?'/ship-lab':key==='kite'?'/ship-lab/kite':'/ship-lab/refit?ship='+key,registeredFitRoute:'/ship-lab/refit?ship='+key,modules:model.refit.modules.length});
  models.push(model);
 }
 const crewFits=JSON.parse(await readFile(path.join(root,'content/crew-fits.json'),'utf8'));
 if(crewFits.schema!=='crew-fits-1'||crewFits.entries.length!==6)throw Error('Six reviewed crew fits required');
 for(const e of crewFits.entries){
  if(!/^(kestrel|kite)-crew-(minimum|watch|reserve)$/.test(e.key)||!/^crew-fits\/[a-f0-9]{40}\.json$/.test(e.native))throw Error('Invalid crew packet path');
  const raw=await readFile(path.join(root,'content',e.native));
  if(createHash('sha256').update(raw).digest('hex')!==e.sourceSha256)throw Error('Crew source changed');
  const n=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
  const kinds=['control','reactor','fuel_tank','magazine','drive','jet','shield','gun','feed'];
  const machines=n.machines.map(m=>Object.fromEntries(fields.map(k=>[k,k==='kind_name'?kinds[m.kind]:m[k]])));
  if(machines.some((m,i)=>m.index!==i||!m.kind_name||m.core_position_m.length!==3||!m.core_position_m.every(Number.isFinite)||[...m.power_sources,...m.dependencies,m.fuel_store,m.ammo_store].some(x=>!Number.isInteger(x)||x< -1||x>=machines.length)||[m.DemandWatts,m.GenerationWatts,m.InitialQuantity,m.MaxForce].some(x=>!Number.isFinite(x)||x<0)))throw Error('Invalid crew machinery');
  const model={key:e.key,name:e.name,role:'Crew fit · 75% propulsion',revision:'crew7-'+n.definition_hash.toLowerCase(),recipe:n.id,definitionHash:n.definition_hash,exported:n.exported_utc,machines,parts:n.parts.map(p=>({index:p.index,name:p.name,parent:p.parent,material_kg:p.material_kg})),art:e.art,dimensions:n.assembled_dimensions_m,dossier:'/ships/designs/'+e.family,crewFamily:e.family,fractionalStores:true,fitting_contract:n.fitting_contract};
  const f=model.fitting_contract;
  if(f.schema!=='native-fitting-1'||f.definition_hash!==model.definitionHash||f.recipe_id!==model.recipe||f.selected_recipe_revision!==7||f.selected_quarters!==e.mode||f.equipment_removal_available||['drive_limit','jet_limit'].some(key=>f.slots.find(s=>s.key===key)?.selected!==1))throw Error('Crew fitting provenance mismatch');
  model.crew_accommodation=validateCrew(n.crew_accommodation,model);
  if(!model.crew_accommodation)throw Error('Crew contract missing');
  model.refit={...refitContract(model,e.geometry),scope:'exact-crew-package',modules:[]};
  for(const art of Object.values(e.art)){if(!/^assets\/[a-f0-9]{64}\.png$/.test(art.path))throw Error('Invalid crew artwork');await access(path.join(root,'site/assets/fleet-register',art.path));}
  await access(path.join(root,'site',e.geometry.asset));
  const bytes=JSON.stringify(model),sha=createHash('sha256').update(bytes).digest('hex'),file=e.key+'.'+sha.slice(0,12)+'.json';
  await writeFile(path.join(folder,file),bytes+'\n');models.push(model);
  entries.push({key:e.key,name:e.name,role:model.role,category:e.category,recipe:model.recipe,definitionHash:model.definitionHash,revision:model.revision,exported:model.exported,model:'/assets/designer/'+file,hero:'/assets/fleet-register/'+e.art.hero.path,inspectRoute:'/ship-lab?ship='+e.key+'#ship-workshop',fitRoute:'/ship-lab/refit?ship='+e.key,registeredFitRoute:'/ship-lab/refit?ship='+e.key,modules:0,crew:{family:e.family,mode:e.mode,bunks:n.crew_accommodation.bunks,complement:n.crew_accommodation.complement.reduce((a,b)=>a+b,0),watts:n.crew_accommodation.life_support_watts}});
 }
 const carrier=JSON.parse(await readFile(path.join(root,'content/carrier-workshop.json'),'utf8'));
 const kite=entries.find(e=>e.key==='kite');if(kite)kite.fitting={recipe:carrier.recipe,definitionHash:carrier.hash,exported:carrier.exported};
 const data={version:'designer-1',entries};
 await writeFile(path.join(root,'site/designer-data.js'),'// Exact, already-published native editions. Lazy-loaded; no production writes.\nwindow.FleetDesignerData = '+JSON.stringify(data)+';\n');
 await writeFile(path.join(root,'content/designer-hulls.json'),JSON.stringify({schema:'designer-hulls-1',source:register.bundle_id,policy:'Exact published editions support registered-module planning; native admission and alternate articles require separate contracts.',hulls:entries.map(({model,hero,...e})=>e)},null,2)+'\n');
 return {entries,models};
}
export function hullSelector(entries,current='kestrel'){
 const categories=[...new Set(entries.map(e=>e.category))];
 return `<section class="designer-selector" aria-labelledby="designer-title"><div class="designer-heading"><div><p class="eyebrow">Choose a hull</p><h2 id="designer-title">Build around its purpose.</h2></div><p>Choose a hull. Fit its hardware. Follow the power through its systems.</p></div><div class="designer-controls"><label for="designer-category">Ship group<select id="designer-category"><option value="">All hulls</option>${categories.map(c=>`<option${c==='Warships'?' selected':''}>${esc(c)}</option>`).join('')}</select></label><label for="designer-search">Find a ship<input id="designer-search" type="search" placeholder="Name or role" autocomplete="off"></label><label for="designer-hull">Hull<select id="designer-hull">${entries.map(e=>`<option value="${e.key}"${e.key===current?' selected':''}>${esc(e.name)} · ${esc(e.role)}</option>`).join('')}</select></label></div><div class="designer-selection"><img id="designer-art" alt="" width="2048" height="1536" loading="lazy"><div><h3 id="designer-name"></h3><p id="designer-edition"></p><p id="designer-capability"></p></div><div class="designer-destinations"><a id="designer-open" class="button" href="/ship-lab">Open workshop →</a><a id="designer-inspect" class="back-link" href="/ship-lab?ship=kestrel#ship-workshop">Inspect published systems →</a></div></div><nav class="crew-fit-options" id="designer-crew-options" aria-label="Crew fit choices" hidden></nav><p id="designer-result" class="field-hint" role="status"></p><noscript><p><a href="/ship-lab">Fit KESTREL</a> · <a href="/ship-lab/kite">Fit KITE</a> · <a href="/ships">Browse every ship dossier</a></p></noscript></section>`;
}
export const inspectionOptions=entries=>entries.map(e=>`<option value="${e.key}">${esc(e.name)} · ${esc(e.recipe)}</option>`).join('');
