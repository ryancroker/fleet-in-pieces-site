import { fail } from './community.js';

// Emergency brake: change to true, commit and deploy through the normal main
// branch. No dashboard setting or database migration is needed. Restore false
// the same way. This is deliberately server-only; visitors cannot toggle it.
export const COMMUNITY_READ_ONLY = false;

export function checkCommunityWrites(request, path) {
  if (!COMMUNITY_READ_ONLY || request.method === 'GET' || path[0] === 'admin') return;
  // Existing members can sign in/out; Fleet Command can still moderate. All
  // other community mutations (including new registrations) stop before D1.
  const existingSignin = request.method === 'POST' && path[0] === 'auth' &&
    (path.length === 3 && path[1] === 'signin' && ['options', 'verify'].includes(path[2]) ||
     path.length === 2 && path[1] === 'logout');
  if (!existingSignin) fail(503, 'community_read_only', 'The community is temporarily read-only. You can still browse; please try posting again later. Your draft stays here.');
}
