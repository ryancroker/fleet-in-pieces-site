// Local authoring only. Does not connect to D1 or publish anything.
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2), value=flag=>args[args.indexOf(flag)+1];
const candidate=path.resolve(args.includes('--candidate')?value('--candidate'):path.join(root,'../../Docs/FleetRegister/Publication/candidate.json'));
const statePath=path.join(root,'content/fleet-register.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const confined=(base,relative)=>{if(typeof relative!=='string'||relative.includes('\\')||relative.split('/').some(x=>x==='..'||!x)||path.isAbsolute(relative))throw Error('Invalid packet path');const p=path.resolve(base,relative);if(!p.startsWith(path.resolve(base)+path.sep))throw Error('Packet path escaped its root');return p;};
const pointer=await read(candidate), manifestPath=confined(path.dirname(candidate),pointer.manifest);
const manifestBytes=await readFile(manifestPath), manifest=JSON.parse(manifestBytes);
if(sha(manifestBytes)!==pointer.manifest_sha256||manifest.schema!=='fleet-registrar-publication/1'||manifest.schema_version!==1||manifest.bundle_id!==pointer.bundle_id)throw Error('Invalid candidate manifest');
const bundle=path.dirname(manifestPath), files=new Map();
for(const file of manifest.files){
  if(files.has(file.path)||!(/^(assets\/[a-f0-9]{64}\.(png|svg)|revisions\/fr1-[a-f0-9]{64}\.json|catalog\.json|[^/]+\.json)$/.test(file.path)))throw Error('Unexpected/duplicate public file: '+file.path);
  const bytes=await readFile(confined(bundle,file.path));
  if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Packet checksum failed: '+file.path);
  files.set(file.path,file);
}
const catalog=await read(path.join(bundle,'catalog.json'));
if(catalog.ships.length!==manifest.ship_count||catalog.schema_version!==1)throw Error('Catalog count/version mismatch');
const sections=Object.keys(catalog.sections).sort();
let previous=null;try{previous=await read(statePath);}catch(e){if(e.code!=='ENOENT')throw e;}
const ships={...(previous?.ships||{})}, revisions={...(previous?.revisions||{})};
let newRevisions=0;
const changes=[];
for(const ship of catalog.ships){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ship.ship_key)||ship.ship_key.length>68)throw Error('Invalid permanent ship key');
  for(const config of ship.configurations){
    if(!files.has(config.path)||!/^fr1-[a-f0-9]{64}$/.test(config.revision_id))throw Error('Missing edition');
    const d=await read(confined(bundle,config.path));
    if(d.ship_key!==ship.ship_key||d.revision_id!==config.revision_id||d.configuration.definition_hash!==config.definition_hash||d.configuration.recipe_id!==config.recipe_id||JSON.stringify(d.sections.map(s=>s.key).sort())!==JSON.stringify(sections))throw Error('Dossier identity mismatch');
    const checkAssets=v=>{if(!v||typeof v!=='object')return;if(typeof v.path==='string'&&v.path.startsWith('assets/')){if(!files.has(v.path)||v.sha256&&files.get(v.path).sha256!==v.sha256)throw Error('Unmatched asset');}Object.values(v).forEach(checkAssets);};checkAssets(d.art);
    const row={ship_key:ship.ship_key,path:config.path,sha256:files.get(config.path).sha256,recipe_id:config.recipe_id,definition_hash:config.definition_hash,exported_utc:config.exported_utc};
    if(revisions[config.revision_id]&&JSON.stringify(revisions[config.revision_id])!==JSON.stringify(row))throw Error('Immutable revision collision');
    if(!revisions[config.revision_id])newRevisions++;
    revisions[config.revision_id]=row;
  }
  if(!ship.configurations.some(c=>c.revision_id===ship.default_exported_revision))throw Error('Missing proposed default');
  const old=ships[ship.ship_key];
  // Retain historical configuration choices even if absent from a later export.
  const configs=new Map((old?.configurations||[]).map(c=>[c.revision_id,c]));
  ship.configurations.forEach(c=>configs.set(c.revision_id,c));
  const selected=previous?.bundle_id===manifest.bundle_id&&old?.current_revision?old.current_revision:ship.default_exported_revision;
  ships[ship.ship_key]={...ship,configurations:[...configs.values()],current_revision:selected};
  if(old?.current_revision!==selected)changes.push({ship:ship.ship_key,expected:old?.current_revision||null,proposed:selected,configurations:ship.configurations.length,notice:ship.revision_notice||null});
}
const state={schema_version:1,bundle_id:manifest.bundle_id,manifest_sha256:pointer.manifest_sha256,sections:catalog.sections,fact_status_labels:catalog.fact_status_labels,machine_units:catalog.machine_units,scale_art:catalog.scale_art,ships,revisions};
const report={mode:args.includes('--stage')?'local-stage':'dry-run',expected_bundle:previous?.bundle_id||'none',bundle:state.bundle_id,ships:Object.keys(ships).length,revisions:Object.keys(revisions).length,new_revisions:newRevisions,verified_files:files.size+1,changes};
await mkdir(path.join(root,'qa-output'),{recursive:true});await writeFile(path.join(root,'qa-output/ship-import.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,changes:changes.length,review:'qa-output/ship-import.json'},null,2));
if(!args.includes('--stage'))process.exit(0);
if(!args.includes('--expect')||value('--expect')!==(previous?.bundle_id||'none'))throw Error('Stale/missing --expect. Review the dry-run, then supply its expected_bundle.');
// Only immutable art and dossier JSON enter the public output. No private source files.
for(const file of manifest.files.filter(f=>/^(assets|revisions)\//.test(f.path))){
  const output=confined(path.join(root,'site/assets/fleet-register'),file.path);
  try{const bytes=await readFile(output);if(sha(bytes)!==file.sha256)throw Error('Public immutable file collision');continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(path.dirname(output),{recursive:true});await copyFile(confined(bundle,file.path),output);
}
if(previous){await mkdir(path.join(root,'content/fleet-register-history'),{recursive:true});const history=path.join(root,'content/fleet-register-history',previous.bundle_id+'.json');try{await stat(history);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(history,JSON.stringify(previous)+'\n');}}
await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
console.log('Local staging complete. No database or production change.');
