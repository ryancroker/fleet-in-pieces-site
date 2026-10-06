import { fail } from './community.js';

// Source fallback; wrangler.toml supplies the same named production variable.
// Set COMMUNITY_WRITES_ENABLED=false and deploy to disable community writes.
export const COMMUNITY_WRITES_ENABLED = true;
export function writesConfigured(env) {
  const value = env.COMMUNITY_WRITES_ENABLED ?? COMMUNITY_WRITES_ENABLED;
  return value === true || value === 'true'; // Invalid values fail closed.
}
export function readOnly() {
  fail(503, 'community_read_only', 'The community is temporarily read-only. Existing posts are still available. Your draft stays here.');
}
export function checkCommunityWrites(request, path, env) {
  if (request.method !== 'GET' && path[0] !== 'admin' && !writesConfigured(env)) readOnly();
}
