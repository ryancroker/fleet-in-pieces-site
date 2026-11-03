import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function prepareSupport(root){
 const site=path.join(root,'site'),context={window:{}};
 runInNewContext(await readFile(path.join(site,'config.js'),'utf8'),context,{timeout:1000});
 const config=context.window.FLEET_CONFIG,releases={};
 for(const asset of ['support.css','support.js','support-inbox.js']){
  const bytes=Buffer.from((await readFile(path.join(site,asset),'utf8')).replace(/\r\n?/g,'\n')),ext=path.extname(asset);
  const hashed=asset.slice(0,-ext.length)+'.'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+ext;
  try{if(!(await readFile(path.join(site,hashed))).equals(bytes))throw Error('Existing support fingerprint collision.');}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(path.join(site,hashed),bytes);}
  releases[asset]='/'+hashed;
 }
 const home=await readFile(path.join(site,'index.html'),'utf8'),gameCSS=home.match(/href="(\/game-information\.[a-f0-9]+\.css)"/)[1];
 for(const [template,route,title,script,robots] of [['support','support','Support','support.js',''],['support-inbox','crew-support','Private support inbox','support-inbox.js','<meta name="robots" content="noindex,nofollow">']]){
  const values={TITLE:title,PATH:route,GAME_CSS:gameCSS,SUPPORT_CSS:releases['support.css'],SCRIPT:releases[script],DISCORD_URL:config.DISCORD_URL,TIKTOK_URL:config.TIKTOK_URL};
  const text=(await readFile(path.join(root,'templates',template+'.html'),'utf8')).replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(key==='ROBOTS')return robots;if(!(key in values))throw Error('Unknown support template field '+key);return escape(values[key]);});
  await writeFile(path.join(site,route+'.html'),text+'\n');
 }
 let sitemap=await readFile(path.join(site,'sitemap.xml'),'utf8');
 sitemap=sitemap.replace('</urlset>','<url><loc>https://fleetinpieces.space/support</loc></url></urlset>');
 await writeFile(path.join(site,'sitemap.xml'),sitemap);
 console.log(JSON.stringify({support:'/support',privateInbox:'/crew-support',automaticEmail:false,legacyCommunityReopened:false}));
}
