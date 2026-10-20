import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import path from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readText = async file => (await readFile(file, 'utf8')).replace(/\r\n?/g, '\n');

export async function prepareGameInformation(root) {
  const site = path.join(root, 'site');
  const information = JSON.parse(await readText(path.join(root, 'content/game-information.json')));
  const context = {window:{}};
  runInNewContext(await readText(path.join(site, 'config.js')), context, {timeout:1000});
  const config = context.window.FLEET_CONFIG;
  for (const [key, host] of [['DISCORD_URL','discord.gg'],['TIKTOK_URL','www.tiktok.com']]) {
    const url = new URL(config[key]);
    if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password) throw Error(`Invalid ${key}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(information.steamPageTarget) || !/^\d{4}-\d{2}-\d{2}$/.test(information.updated)) throw Error('Use explicit calendar dates.');
  if (!information.heroImage.startsWith('/assets/fleet-register/assets/') || !/^\/assets\/[a-zA-Z0-9/._-]+$/.test(information.heroImage)) throw Error('Use retained native ship artwork.');
  await readFile(path.join(site, information.heroImage.slice(1)));
  const releases = {};
  for (const asset of ['game-information.css','game-information.js']) {
    const bytes = Buffer.from(await readText(path.join(site, asset)));
    const ext = path.extname(asset);
    const hashed = asset.slice(0, -ext.length) + '.' + createHash('sha256').update(bytes).digest('hex').slice(0,12) + ext;
    const output = path.join(site, hashed);
    try { if (!(await readFile(output)).equals(bytes)) throw Error('Existing fingerprint collision.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(output, bytes); }
    releases[asset] = '/' + hashed;
  }
  let steamCTA = '<a class="button button-outline" href="' + escape(config.DISCORD_URL) + '" target="_blank" rel="noopener noreferrer">Get updates on Discord ↗</a>';
  if (config.STEAM_URL) {
    const steam = new URL(config.STEAM_URL);
    if (steam.protocol !== 'https:' || steam.hostname !== 'store.steampowered.com' || !/^\/app\/\d+\//.test(steam.pathname)) throw Error('Use a real Steam app URL.');
    steamCTA = '<a class="button button-outline" href="' + escape(steam.href) + '" target="_blank" rel="noopener noreferrer">Visit on Steam ↗</a>';
  }
  const fields = {
    DESCRIPTION:information.description, HERO_IMAGE:information.heroImage, HERO_ALT:information.heroImageAlt,
    STYLESHEET:releases['game-information.css'], SCRIPT:releases['game-information.js'],
    DISCORD_URL:config.DISCORD_URL, TIKTOK_URL:config.TIKTOK_URL,
    STEAM_DATE:information.steamPageTarget, STEAM_LABEL:information.steamPageTargetLabel,
    STEAM_YEAR:information.steamPageTarget.slice(0,4),
    STEAM_FULL_LABEL:new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(information.steamPageTarget+'T12:00:00Z')),
    RELEASE_STATUS:information.releaseStatus,
    UPDATED_LABEL:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(information.updated+'T12:00:00Z'))
  };
  const focus = information.currentFocus.map(item => `<li><strong>${escape(item.title)}</strong><span>${escape(item.description)}</span></li>`).join('');
  const template = await readText(path.join(root,'templates/game-information.html'));
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (key === 'FOCUS_ITEMS') return focus;
    if (key === 'STEAM_CTA') return steamCTA;
    if (!Object.hasOwn(fields,key)) throw Error(`Unknown template field ${key}`);
    return escape(fields[key]);
  });
  await writeFile(path.join(site,'index.html'), html);
  const redirects = new Map([['/index.html','/'],['/index','/']]);
  for (const [slug, anchor] of [['game','game'],['systems','game'],['dev-log','development'],['ships','game'],['ship-lab','game'],['ship-design','game'],['quartermaster','discord']]) {
    for (const suffix of ['', '/', '.html']) redirects.set('/'+slug+suffix, '/#'+anchor);
    if (['systems','ships','ship-lab'].includes(slug)) redirects.set('/'+slug+'/*','/#'+anchor);
  }
  for (const slug of ['community','fleet','register','people','recruitment','mess-deck','feedback','activity','notifications','developer-replies']) {
    for (const suffix of ['', '/', '.html']) redirects.set('/'+slug+suffix, config.DISCORD_URL);
  }
  // Only static retired pages move. API, admin and permanent historical links retain their existing routes.
  const rules = [...redirects].sort(([a],[b]) => Number(a.includes('*'))-Number(b.includes('*')));
  await writeFile(path.join(site,'_redirects'), '# Game-information site. Historical data and server permissions are unchanged.\n'+rules.map(([from,to])=>`${from} ${to} 302`).join('\n')+'\n');
  await writeFile(path.join(site,'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://fleetinpieces.space/</loc><lastmod>'+information.updated+'</lastmod></url></urlset>\n');
  await writeFile(path.join(site,'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /crew\nDisallow: /i/\nDisallow: /u/\nDisallow: /topics/\nSitemap: https://fleetinpieces.space/sitemap.xml\n');
  await writeFile(path.join(site,'404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Back to the fleet — Fleet in Pieces</title><link rel="stylesheet" href="${fields.STYLESHEET}"><link rel="icon" href="/assets/icons/favicon.svg"></head><body class="not-found"><main class="shell"><p class="eyebrow">Fleet in Pieces / 404</p><h1>Back to<br>the fleet.</h1><p>This page has moved or is no longer here.</p><a class="button button-discord" href="/">About the game →</a><a class="text-link" href="${escape(config.DISCORD_URL)}">Join the Discord ↗</a></main></body></html>\n`);
  console.log(JSON.stringify({page:'/', stylesheet:fields.STYLESHEET, script:fields.SCRIPT, redirects:rules.length, steamPageTarget:information.steamPageTarget, steamReleaseDate:null, publicDatabaseRequests:0},null,2));
}
