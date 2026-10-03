// Authoring helper, run before committing. Cloudflare still publishes site/ with no build command.
import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'site');
const read = async file => (await readFile(file, 'utf8')).replace(/\r\n?/g, '\n');
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav = '<header class="site-header wrap"><a class="brand" href="/" aria-label="Fleet in Pieces home">FLEET <span>IN</span> PIECES</a><nav aria-label="Main navigation"><a href="/game">Game</a><a href="/fleet">Fleet</a><a href="/systems">Systems</a><a href="/community">Community</a><a href="/register" data-register-link>Register</a></nav></header>';
const footer = '<footer class="site-footer wrap"><div><a class="brand" href="/">FLEET <span>IN</span> PIECES</a><p>Development, in public. Ship what survives.</p></div><div class="footer-end"><a href="/game#steam-status" data-steam>Steam page coming soon</a><a href="https://www.tiktok.com/@fleet_in_pieces">Follow development on TikTok ↗</a><small>© 2026 Fleet in Pieces</small></div></footer>';
const template = await read(path.join(root, 'templates/system.html'));
const contents = JSON.parse(await read(path.join(root, 'content/systems.json')));
for (const content of contents) {
  if (!/^[a-z0-9-]+$/.test(content.slug) || !['system','ship'].includes(content.kind)) throw Error('Invalid content path');
  const kindPath = content.kind === 'ship' ? 'ships' : 'systems';
  const fields = {ID:content.id,SLUG:content.slug,KIND_PATH:kindPath,TITLE:content.title,DESCRIPTION:content.description,TAGLINE:content.tagline,STATUS:content.status,QUESTION:content.question,PLACEHOLDER:content.placeholder,MEDIA_WIDTH:content.media.width,MEDIA_HEIGHT:content.media.height,MEDIA_TITLE:content.media.title,MEDIA_DESCRIPTION:content.media.description,VIDEO:content.media.src,POSTER:content.media.poster};
  let html = template.replace(/\{\{([A-Z_]+)\}\}/g, (token,key) => key === 'NAV' ? nav : key === 'FOOTER' ? footer : key === 'FACTS' ? content.facts.map(fact=>`<li>${escape(fact)}</li>`).join('') : key in fields ? escape(fields[key]) : (()=>{throw Error(`Unknown template token ${token}`);})());
  await mkdir(path.join(site,kindPath),{recursive:true});
  await writeFile(path.join(site,kindPath,content.slug+'.html'),html);
}
async function htmlFiles(folder) {
  const files=[];
  for (const entry of await readdir(folder,{withFileTypes:true})) {
    if (entry.isDirectory() && entry.name!=='assets') files.push(...await htmlFiles(path.join(folder,entry.name)));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path.join(folder,entry.name));
  }
  return files;
}
const assets = ['styles.css','community.css','community.js','crew.js','hub.js','register.css','register.js','profile.js','config.js','script.js'];
const releases=[];
for(const asset of assets){
  let bytes;
  try{bytes=Buffer.from(await read(path.join(site,asset)),'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
  const ext=path.extname(asset),stem=asset.slice(0,-ext.length),filename=`${stem}.${hash}${ext}`;
  const output=path.join(site,filename);
  try {if(!(await readFile(output)).equals(bytes))throw Error(`Fingerprint collision: ${filename}`);}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(output,bytes);}
  releases.push({stem,ext,filename});
}
for(const file of await htmlFiles(site)){
  let html=await read(file);
  html=html.replace(/<header class="site-header wrap">[\s\S]*?<\/header>/,nav);
  for(const script of ['config','script','hub']){
    if(!new RegExp(`src="/${script}(?:\\.[a-f0-9]{12})?\\.js"`).test(html)) html=html.replace('</head>',`  <script src="/${script}.js" defer></script>\n</head>`);
  }
  for(const {stem,ext,filename} of releases){
    const regex=new RegExp(`((?:href|src)="/)${stem}(?:\\.[a-f0-9]{12})?\\${ext}(?:\\?[^" ]*)?"`,'g');
    html=html.replace(regex,`$1${filename}"`);
  }
  await writeFile(file,html);
}
console.log('Prepared content and fingerprinted assets: '+releases.map(r=>r.filename).join(', '));
