// Authoring helper, run before committing. Cloudflare still publishes site/ with no build command.
import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {renderPages} from './render-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(root, 'site');
const read = async file => (await readFile(file, 'utf8')).replace(/\r\n?/g, '\n');
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configContext = {window:{}};
runInNewContext(await read(path.join(site,'config.js')), configContext, {timeout:1000});
const quartermasterURL = configContext.window.FLEET_CONFIG.QUARTERMASTER_URL;
const productURL = new URL(quartermasterURL);
if(productURL.protocol!=='https:' || productURL.hostname!=='fleet-in-pieces-shop.fourthwall.com' || !productURL.pathname.startsWith('/products/') || productURL.username || productURL.password) throw Error('Quartermaster must link to a direct Fourthwall product');
const quartermasterLink = '<a href="/quartermaster">Quartermaster / first issue</a>';
const nav = `<header class="site-header wrap"><a class="brand" href="/" aria-label="Fleet in Pieces home">FLEET <span>IN</span> PIECES</a><nav aria-label="Main navigation"><a href="/game">Game</a><a href="/systems">Systems</a><a href="/ships">Ships</a><a href="/community">Community</a><a href="/dev-log">Dev Log</a><a href="/quartermaster" class="nav-quartermaster">Quartermaster</a></nav></header>`;
const statusBar='<aside class="site-status wrap" aria-label="Developer updates and your access"><a class="button secondary latest-replies-link" href="/developer-replies">Latest developer replies ↗</a><p class="site-update" data-developer-update hidden></p><div class="access-status" data-access-status role="status" aria-live="polite"><strong class="access-label">Your Fleet identity</strong><a href="/register">Register / sign in →</a></div></aside>';
const footer = '<footer class="site-footer wrap"><div><a class="brand" href="/">FLEET <span>IN</span> PIECES</a><p>Development, in public. Ship what survives.</p></div><div class="footer-end"><a href="/game#steam-status" data-steam>Steam page coming soon</a><a href="https://www.tiktok.com/@fleet_in_pieces">Follow development on TikTok ↗</a><small>© 2026 Fleet in Pieces</small></div></footer>';
const template = await read(path.join(root, 'templates/system.html'));
const contents = JSON.parse(await read(path.join(root, 'content/systems.json')));
const updates = JSON.parse(await read(path.join(root, 'content/development.json')));
const merch = JSON.parse(await read(path.join(root, 'content/merch.json')));
for (const [name, html] of Object.entries(renderPages(contents, updates, quartermasterURL, merch))) {
  await writeFile(path.join(site, name + '.html'), html);
}
for (const content of contents) {
  if (!/^[a-z0-9-]+$/.test(content.slug) || !['system','ship'].includes(content.kind)) throw Error('Invalid content path');
  const kindPath = content.kind === 'ship' ? 'ships' : 'systems';
  const fields = {ID:content.id,SLUG:content.slug,KIND_PATH:kindPath,KIND_LABEL:content.kind === 'ship' ? 'Ships' : 'Systems',TITLE:content.title,DESCRIPTION:content.description,TAGLINE:content.tagline,STATUS:content.status,QUESTION:content.question,PLACEHOLDER:content.placeholder,MEDIA_WIDTH:content.media.width,MEDIA_HEIGHT:content.media.height,MEDIA_TITLE:content.media.title,MEDIA_DESCRIPTION:content.media.description,VIDEO:content.media.src,POSTER:content.media.poster};
  const related = (content.related || []).map(id => contents.find(item => item.id === id)).filter(Boolean).map(item => `<a href="/${item.kind === 'ship' ? 'ships' : 'systems'}/${escape(item.slug)}"><span>${escape(item.kind === 'ship' ? 'Ships' : 'Systems')}</span><strong>${escape(item.title)} →</strong></a>`).join('');
  let html = template.replace(/\{\{([A-Z_]+)\}\}/g, (token,key) => key === 'NAV' ? nav : key === 'FOOTER' ? footer : key === 'RELATED' ? related : key === 'FACTS' ? content.facts.map(fact=>`<li>${escape(fact)}</li>`).join('') : key in fields ? escape(fields[key]) : (()=>{throw Error(`Unknown template token ${token}`);})());
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
const assets = ['styles.css','community.css','visitor.css','creator.css','creator.js','creator-tools.js','network.js','community.js','crew.js','dashboard.js','hub.js','register.css','register.js','profile.js','config.js','script.js'];
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
  html=html.replace(/\s*<script src="\/network(?:\.[a-f0-9]{12})?\.js" defer><\/script>/g,'');
  html=html.replace(/\s*<script src="\/creator(?:\.[a-f0-9]{12})?\.js"[^>]*><\/script>/g,'');
  html=html.replace('<script ', '<script src="/network.js" defer></script>\n  <script src="/creator.js" data-tools-src="/creator-tools.js" defer></script>\n  <script ');
  if(!/href="\/creator(?:\.[a-f0-9]{12})?\.css"/.test(html)) html=html.replace('</head>','<link rel="stylesheet" href="/creator.css"></head>');
  html=html.replace(/<aside class="site-status wrap"[\s\S]*?<\/aside>/g,'');
  html=html.replace(/<header class="site-header wrap">[\s\S]*?<\/header>/,nav+statusBar);
  // Keep existing footer destinations while exposing identity below the game navigation.
  html=html.replace(/<div class="footer-end">[\s\S]*?<\/div>/g,section => {
    section = section.replace(/<a\b[^>]*\bdata-quartermaster\b[^>]*>[\s\S]*?<\/a>/g,quartermasterLink);
    if (!section.includes('href="/quartermaster"')) section = section.replace('<small>',quartermasterLink+'<small>');
    if (!section.includes('data-register-link')) section = section.replace('<small>','<a href="/register" data-register-link>Register / sign in</a><small>');
    if (!section.includes('href="/fleet"')) section = section.replace('<small>','<a href="/fleet">Fleet Register & allegiance</a><small>');
    if (!section.includes('href="/crew"')) section = section.replace('<small>','<a href="/crew">Fleet Command</a><small>');
    return section;
  });
  html=html.replace(/<a\b[^>]*\bdata-quartermaster\b[^>]*>/g,tag => tag.replace(/\bhref="[^"]*"/,`href="${escape(quartermasterURL)}"`));
  for(const script of ['config','script','hub']){
    if(!new RegExp(`src="/${script}(?:\\.[a-f0-9]{12})?\\.js"`).test(html)) html=html.replace('</head>',`  <script src="/${script}.js" defer></script>\n</head>`);
  }
  for(const {stem,ext,filename} of releases){
    const regex=new RegExp(`((?:href|src)="/)${stem}(?:\\.[a-f0-9]{12})?\\${ext}(?:\\?[^" ]*)?"`,'g');
    html=html.replace(regex,`$1${filename}"`);
  }
  await writeFile(file,html);
}
const routes = ['/', '/game', '/systems', '/ships', '/community', '/developer-replies', '/dev-log', '/quartermaster', '/fleet', '/register', ...contents.map(c=>`/${c.kind === 'ship' ? 'ships' : 'systems'}/${c.slug}`)];
await writeFile(path.join(site,'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+routes.map(route=>`  <url><loc>https://fleetinpieces.space${route}</loc></url>`).join('\n')+'\n</urlset>\n');
console.log('Prepared content and fingerprinted assets: '+releases.map(r=>r.filename).join(', '));
