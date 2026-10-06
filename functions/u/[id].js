import { database, htmlEscape, securityHeaders } from '../_lib/community.js';

const ORIGIN = 'https://fleetinpieces.space';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function onRequest({ request, env, params }) {
  const headers = securityHeaders(true);
  headers.set('X-Robots-Tag', 'noindex, follow');
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers });
  let status = 200, profile = null;
  const id = typeof params.id === 'string' && UUID.test(params.id) ? params.id.toLowerCase() : null;
  if (!id) status = 404;
  else {
    try {
      profile = await database(env,{readOnly:true,maxStatements:1}).prepare('SELECT p.callsign,r.label AS rank FROM profiles p JOIN rank_definitions r ON r.id=p.rank_id WHERE p.id=?').bind(id).first();
      if (!profile) status = 404;
    } catch { status = 503; }
  }
  const title = profile ? `@${profile.callsign} — Fleet Register — Fleet in Pieces` : status === 404 ? 'Record not found — Fleet in Pieces' : 'Fleet Register unavailable — Fleet in Pieces';
  const description = profile ? `${profile.callsign}, ${profile.rank}. Public contributions and chain of command in the Fleet in Pieces community.` : status === 404 ? 'That fleet record is unavailable.' : 'Please try the Fleet Register again in a moment.';
  try {
    const shellUrl = new URL('/profile.html', request.url);
    let shell = await env.ASSETS.fetch(new Request(shellUrl));
    if ([301, 302, 307, 308].includes(shell.status)) {
      const next = new URL(shell.headers.get('Location') || '/profile', shellUrl);
      if (next.origin !== shellUrl.origin || !['/profile', '/profile/'].includes(next.pathname)) throw new Error('Invalid shell redirect');
      shell = await env.ASSETS.fetch(new Request(next));
    }
    if (!shell.ok) throw new Error('Unavailable shell');
    let body = await shell.text();
    for (const [token, value] of Object.entries({ '__PROFILE_TITLE__': title, '__PROFILE_DESCRIPTION__': description, '__PROFILE_CANONICAL__': ORIGIN + (id ? '/u/' + id : '/fleet') })) {
      if (!body.includes(token)) throw new Error('Missing shell token');
      body = body.replaceAll(token, htmlEscape(value));
    }
    return new Response(request.method === 'HEAD' ? null : body, { status, headers });
  } catch {
    return new Response(request.method === 'HEAD' ? null : '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fleet Register unavailable</title><h1>Fleet Register temporarily unavailable</h1><p>Please try again in a moment.</p><a href="/fleet">Fleet Register</a></html>', { status: 503, headers });
  }
}
