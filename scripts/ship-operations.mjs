// Narrow chat-operated publication/recognition interface. Dry-run is the default.
// The caller supplies an already-authorized key; never read a production secret file.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const args=process.argv.slice(2),option=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
const origin=new URL(option('--origin','http://127.0.0.1:8788'));
const local=['localhost','127.0.0.1'].includes(origin.hostname)&&origin.protocol==='http:';
if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(!local&&origin.origin!=='https://fleetinpieces.space'))throw Error('Use localhost or the canonical production origin.');
if(!local&&!args.includes('--production'))throw Error('Production requires an explicit --production flag and separate human release authorization.');
const key=process.env.FLEET_OPERATOR_KEY;if(!key||key.length<32)throw Error('Supply FLEET_OPERATOR_KEY in this process environment. It will not be printed or stored.');
const request=async(route,body)=>{const res=await fetch(new URL(route,origin),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json',Origin:origin.origin}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw Error(res.status+' '+(data.error?.message||data.message||'Ship operation rejected'));return data;};
if(args.includes('--plan')){
 const data=await request('/api/admin/ship-designs');
 const operations=data.ships.filter(s=>s.current_revision!==s.expected_current).map(s=>({ship_key:s.key,action:'publish',body:{id:randomUUID(),revision_id:s.current_revision,expected_current:s.expected_current,note:'Publish reviewed Fleet Registrar edition; no gameplay acceptance inferred.'}}));
 await writeFile(option('--plan'),JSON.stringify({schema_version:1,origin:origin.origin,operations},null,2)+'\n');console.log(`Prepared ${operations.length} publication operations. No writes. Review the plan before --apply.`);
}else{
 const file=option('--file');if(!file)throw Error('Use --plan <output.json>, or --file <reviewed-plan.json> [--apply].');
 const plan=JSON.parse(await readFile(file,'utf8'));if(plan.schema_version!==1||plan.origin!==origin.origin||!Array.isArray(plan.operations)||plan.operations.length>200)throw Error('Invalid plan or origin mismatch.');
 for(const op of plan.operations){if(!/^[a-z0-9-]{1,68}$/.test(op.ship_key)||!['publish','record'].includes(op.action)||!op.body||typeof op.body!=='object')throw Error('Invalid operation');}
 if(!args.includes('--apply')){console.log(JSON.stringify(plan,null,2));console.log('Dry run only. Nothing sent.');}
 else{for(const op of plan.operations){await request('/api/admin/ship-designs/'+op.ship_key+'/'+op.action,op.body);console.log(`${op.action}: ${op.ship_key} (${op.body.id})`);}console.log('Completed reviewed operations. Retain this plan as the idempotent receipt.');}
}
