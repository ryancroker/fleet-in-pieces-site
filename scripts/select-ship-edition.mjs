// Change a local page default before prepare-site. Does not publish or delete history.
import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2),v=k=>args[args.indexOf(k)+1];
if(!['--ship','--revision','--expect'].every(k=>args.includes(k)))throw Error('Use --ship <key> --revision <id> --expect <current-id>.');
const file=new URL('../content/fleet-register.json',import.meta.url),s=JSON.parse(await readFile(file,'utf8')),ship=s.ships[v('--ship')],id=v('--revision');
if(!ship||ship.current_revision!==v('--expect')||!ship.configurations.some(c=>c.revision_id===id))throw Error('Unknown edition or stale expected current.');
ship.current_revision=id;await writeFile(file,JSON.stringify(s,null,2)+'\n');console.log('Local page default selected. Run prepare-site, review, and use the separately authorized publication workflow.');
