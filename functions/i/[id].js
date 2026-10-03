import { ApiError, database, htmlEscape, positiveId, securityHeaders } from '../_lib/community.js';

const ORIGIN = 'https://fleetinpieces.space';
export async function onRequest(context) {
  const { request, env } = context;
  const headers = securityHeaders(true);
  if (!['GET', 'HEAD'].includes(request.method)) {
    headers.set('X-Robots-Tag', 'noindex');
    return new Response('Method not allowed', { status: 405, headers });
  }
  let status = 200, idea = null, id = null;
  try {
    id = positiveId(context.params.id);
    idea = await database(env).prepare(`SELECT i.id,i.body,c.title AS content_title,c.path AS content_path
      FROM ideas i JOIN content_objects c ON c.id=i.content_id WHERE i.id=? AND i.hidden=0 AND c.is_public=1`).bind(id).first();
    if (!idea) status = 404;
  } catch (error) { status = error instanceof ApiError && error.status === 404 ? 404 : 503; }
  const title = idea ? `${[...idea.body.replace(/\s+/g, ' ')].slice(0, 80).join('')} — ${idea.content_title} — Fleet in Pieces` : status === 404 ? 'Idea not found — Fleet in Pieces' : 'Community temporarily unavailable — Fleet in Pieces';
  const description = idea ? [...idea.body.replace(/\s+/g, ' ')].slice(0, 180).join('') : status === 404 ? 'This discussion is unavailable. Explore the missile ideas board.' : 'Please try the community board again in a moment.';
  const canonical = `${ORIGIN}${id ? '/i/' + id : '/systems/missiles'}`;
  if (status !== 200 || new URL(request.url).hostname.endsWith('.pages.dev') || new URL(request.url).hostname === 'localhost') headers.set('X-Robots-Tag', 'noindex');
  try {
    const shellUrl = new URL('/idea.html', request.url);
    let shell = await env.ASSETS.fetch(new Request(shellUrl));
    // Pages may canonicalize the .html filename to its extensionless asset URL.
    if ([301, 302, 307, 308].includes(shell.status)) {
      const next = new URL(shell.headers.get('Location') || '/idea', shellUrl);
      if (next.origin !== shellUrl.origin || !['/idea', '/idea/'].includes(next.pathname)) throw new Error('Invalid shell redirect');
      shell = await env.ASSETS.fetch(new Request(next));
    }
    if (!shell.ok) throw new Error('Unavailable shell');
    let body = await shell.text();
    const tokens = { '__IDEA_CANONICAL__': canonical, '__IDEA_OG_TITLE__': title, '__IDEA_OG_DESCRIPTION__': description };
    for (const [token, value] of Object.entries(tokens)) {
      if (!body.includes(token)) throw new Error('Missing shell token');
      body = body.replaceAll(token, htmlEscape(value));
    }
    body = body.replaceAll('__IDEA_CONTENT_PATH__', htmlEscape(idea?.content_path || '/systems/missiles'))
      .replaceAll('__IDEA_CONTENT_TITLE__', htmlEscape(idea?.content_title || 'Missiles'));
    return new Response(request.method === 'HEAD' ? null : body, { status, headers });
  } catch {
    headers.set('X-Robots-Tag', 'noindex');
    const fallback = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Community unavailable — Fleet in Pieces</title><h1>Community temporarily unavailable</h1><p>Please try again in a moment.</p><a href="/systems/missiles">Missile ideas</a></html>`;
    return new Response(request.method === 'HEAD' ? null : fallback, { status: 503, headers });
  }
}
