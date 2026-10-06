(() => {
  'use strict';
  if (!document.body.hasAttribute('data-profile-page')) return;
  const feedback = document.getElementById('profile-feedback');
  const record = document.getElementById('fleet-record');
  const identity = window.FleetIdentity;
  if (!identity || !record || !feedback) return;
  const {api, node, message} = identity;
  const path = location.pathname.match(/^\/u\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  if (!path) { message(feedback, 'This fleet record link is incomplete. Return to the Fleet Register to find a callsign.', true); return; }
  const profileId = path[1].toLowerCase();
  const action = document.getElementById('allegiance-action');
  const actionFeedback = document.getElementById('allegiance-feedback');
  const vassals = document.getElementById('vassal-list');
  const more = document.getElementById('more-vassals');
  const vassalFeedback = document.getElementById('vassal-feedback');
  const dates = new Intl.DateTimeFormat(undefined, {year:'numeric',month:'long',day:'numeric'});
  const numbers = new Intl.NumberFormat();
  const statusLabels = {new:'Submitted',reviewing:'Looking at this',planned:'Planned',building:'Prototyping',implemented:'Implemented',declined:'No'};
  const knownVassals = new Set();
  const activity = document.getElementById('profile-activity');
  const activityMessage = document.getElementById('activity-feedback');
  const activityMore = document.getElementById('more-activity');
  const activitySeen = new Set();
  let activityOffset = 0, activityBusy = false, activityStarted = false;
  async function loadActivity() {
    if (!activity || activityBusy) return;
    activityBusy = true; activityMore.disabled = true;
    message(activityMessage,'Loading the service record…');
    try {
      const data = await api(`/api/profiles/${encodeURIComponent(profileId)}/activity?offset=${activityOffset}`);
      for (const item of data.activity) {
        const key = `${item.type}:${item.id}`;
        if (activitySeen.has(key)) continue;
        activitySeen.add(key);
        const entry = node('article','service-entry');
        const heading = node('p','eyebrow',`${item.type === 'reply' ? 'Reply' : item.type==='post'?'Post':'Suggestion'} / ${item.content_title}`);
        const body = node('p','service-body',item.body);
        const link = node('a','back-link','Open discussion →');
        link.href = `/i/${encodeURIComponent(item.idea_id)}${item.type === 'reply' ? '#replies-'+item.idea_id : ''}`;
        const date = new Date(item.created_at), meta = node('p','register-note',Number.isNaN(date.getTime()) ? '' : dates.format(date));
        if (item.type === 'idea') meta.append(document.createTextNode(` · ${count(item.votes)} votes · ${item.status_label || statusLabels[item.status] || 'Submitted'}`));
        entry.append(heading,body,meta,link); activity.append(entry);
      }
      activityOffset += data.activity.length; activityMore.hidden = !data.has_more;
      message(activityMessage,activitySeen.size ? '' : 'No public contributions yet. The next useful idea could start here.');
    } catch (error) { retry(activityMessage,error,loadActivity); }
    finally { activityBusy = false; activityMore.disabled = false; }
  }
  let profile = null, viewer = null, viewerProfile = null, offset = 0;
  let loading = false, mutating = false, viewerGeneration = 0;

  function text(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
  function count(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? numbers.format(n) : '—'; }
  function callsign(value) { const name = value?.callsign || 'Unnamed record'; return name.startsWith('@') ? name : `@${name}`; }
  function profileLink(value) {
    const link = node('a', '', callsign(value));
    link.href = `/u/${encodeURIComponent(value.id)}`;
    return link;
  }
  function button(label, primary = false) { const control = node('button', `button ${primary ? 'primary' : 'secondary'}`, label); control.type = 'button'; return control; }
  function retry(element, error, callback) {
    message(element, error?.message || 'The fleet record could not be loaded. Please try again.', true);
    const control = button('Try again'); control.addEventListener('click', callback); element.append(control);
  }
  function renderSummary() {
    text('profile-callsign', callsign(profile));
    text('profile-rank', profile.rank || 'Rank not assigned');
    const joined = new Date(profile.joined_at);
    text('profile-joined', Number.isNaN(joined.getTime()) ? 'Join date unavailable.' : `Entered the Fleet Register ${dates.format(joined)}.`);
    text('profile-ideas', count(profile.ideas_count));
    text('profile-votes', count(profile.votes_received));
    text('profile-implemented', count(profile.implemented_count));
    const superior = document.getElementById('profile-superior'); superior.replaceChildren();
    if (profile.superior) superior.append(document.createTextNode('Sworn to '), profileLink(profile.superior), document.createTextNode('.'));
    else superior.textContent = 'Sworn to no superior.';
    text('profile-branch', `${count(profile.subtree_count)} people beneath this command, including ${count(profile.direct_count)} direct vassals.`);
    text('vassal-count', `${count(profile.direct_count)} directly sworn to ${callsign(profile)}.`);
    const eligibility = profile.promotion_eligibility;
    text('profile-promotion', eligibility ? `Eligible for ${eligibility.label || 'a future rank'}. ${eligibility.requires_superior_approval ? 'A superior’s approval is required. ' : ''}Current rank remains ${profile.rank || 'unassigned'}.` : 'No promotion eligibility is currently recorded.');
  }
  function appendVassals(rows) {
    for (const entry of rows) {
      if (!entry?.id || knownVassals.has(entry.id)) continue;
      knownVassals.add(entry.id);
      const item = node('li', ''), link = profileLink(entry);
      link.append(node('small', '', entry.rank || 'Rank not assigned')); item.append(link); vassals.append(item);
    }
  }
  async function loadProfile(reset = true) {
    if (loading) return false;
    loading = true; more.disabled = true;
    const status = reset ? feedback : vassalFeedback;
    message(status, reset ? 'Loading the fleet record…' : 'Loading direct vassals…');
    try {
      const data = await api(`/api/profiles/${encodeURIComponent(profileId)}?offset=${reset ? 0 : offset}`);
      if (!data.profile) throw new Error('That fleet record is unavailable.');
      profile = data.profile;
      if (reset) { offset = 0; knownVassals.clear(); vassals.replaceChildren(); }
      const rows = Array.isArray(profile.direct_vassals) ? profile.direct_vassals : [];
      appendVassals(rows); offset += rows.length; more.hidden = !data.has_more;
      renderSummary(); record.hidden = false; message(feedback, '');
      if (!activityStarted) { activityStarted = true; loadActivity(); }
      message(vassalFeedback, knownVassals.size ? '' : 'No direct vassals. The chain of command starts somewhere.');
      if (viewer?.id === profile.id) viewerProfile = profile;
      renderAction();
      if (reset) window.dispatchEvent(new CustomEvent('fleet:profile',{detail:profile}));
      if (viewer && viewer.id !== profile.id && !viewerProfile && !mutating) refreshViewer({profile:viewer});
      return true;
    } catch (error) { retry(status, error, () => loadProfile(reset)); return false; }
    finally { loading = false; more.disabled = false; }
  }
  function renderAction() {
    action.replaceChildren();
    if(window.FleetCreator?.authorized()){
      const link=node('a','button secondary','Open Fleet Command →');link.href='/crew';
      action.append(node('p','register-note','Viewing as Fleet Command · Developer'),link);return;
    }
    if (!viewer) {
      const link = node('a', 'button secondary', 'Enter the Fleet Register'); link.href = '/register';
      action.append(node('p', 'register-note', 'An identity is needed only to swear allegiance. Browsing, posting, voting and replies remain open to everyone.'), link); return;
    }
    if (!viewerProfile) { action.append(node('p', 'register-note', 'Loading your current command…')); return; }
    const own = viewer.id === profile.id;
    if (own && !viewerProfile.superior) {
      const link = node('a', 'button secondary', 'Find a commanding superior'); link.href = '/fleet';
      action.append(node('p', 'register-note', 'Your branch is currently independent.'), link); return;
    }
    const leaving = own || viewerProfile.superior?.id === profile.id;
    const label = leaving ? 'Leave current superior' : 'Swear allegiance';
    const begin = button(label, !leaving); begin.disabled = mutating;
    action.append(begin);
    begin.addEventListener('click', () => {
      if (mutating || action.querySelector('.allegiance-confirm')) return;
      begin.hidden = true;
      const confirmation = node('section', 'allegiance-confirm'); confirmation.tabIndex = -1;
      const heading = node('h3', '', leaving ? 'Take your branch with you?' : `Swear to ${callsign(profile)}?`); heading.id = 'allegiance-confirm-title'; confirmation.setAttribute('aria-labelledby', heading.id);
      const details = leaving ? 'You and everyone beneath your command will leave your current superior together. Your branch becomes independent. This does not change anyone’s rank.' : `You and everyone beneath your command will move together beneath ${callsign(profile)}. ${viewerProfile.superior ? `Your branch will leave ${callsign(viewerProfile.superior)}. ` : ''}You can leave or change patron later. This does not change anyone’s rank.`;
      const controls = node('div', 'register-actions'), confirm = button(leaving ? 'Confirm departure' : 'Confirm allegiance', true), cancel = button('Cancel');
      controls.append(confirm, cancel); confirmation.append(heading, node('p', '', details), node('p','field-hint','Maximum 12 command levels and 2,000 members. A move beyond either limit is refused.'), controls); action.append(confirmation); confirmation.focus();
      cancel.addEventListener('click', () => { if (mutating) return; confirmation.remove(); begin.hidden = false; begin.focus(); });
      confirm.addEventListener('click', async () => {
        if (mutating) return;
        mutating = true; confirm.disabled = true; cancel.disabled = true; more.disabled = true;
        message(actionFeedback, 'Updating the chain of command…');
        try {
          const result = await api('/api/allegiance', {superior_id:leaving ? null : profile.id});
          if (result.profile) viewerProfile = result.profile;
          message(actionFeedback, leaving ? 'Your branch is now independent.' : `You now serve under ${callsign(profile)}.`);
          if(!leaving){const meet=node('a','back-link','Meet your fellow vassals →');meet.href='/u/'+viewer.id+'#relationships';actionFeedback.append(document.createTextNode(' '),meet);}
          // Refreshing a session/read can fail after the mutation has already succeeded.
          // Keep the successful decision visible and offer a read-only refresh in that case.
          try {
            const session = await identity.refreshSession(); viewer = session?.profile || viewer;
            if (!await loadProfile(true)) message(actionFeedback, 'Allegiance changed. The public record could not refresh; use Try again above.');
          } catch { message(actionFeedback, 'Allegiance changed. Reload the page to refresh the public record.'); }
        } catch (error) { message(actionFeedback, error.message || 'The move was not confirmed. Please try again.', true); }
        finally { mutating = false; more.disabled = false; renderAction(); }
      });
    });
  }
  async function refreshViewer(session) {
    const generation = ++viewerGeneration; viewer = session?.profile || null; viewerProfile = null;
    if (!profile) return;
    if (!viewer) { renderAction(); return; }
    if (viewer.id === profile.id) { viewerProfile = profile; renderAction(); return; }
    renderAction();
    try {
      const data = await api(`/api/profiles/${encodeURIComponent(viewer.id)}?offset=0`);
      if (generation !== viewerGeneration) return;
      viewerProfile = data.profile; renderAction();
    } catch (error) { if (generation === viewerGeneration) retry(actionFeedback, error, () => refreshViewer({profile:viewer})); }
  }
  more.addEventListener('click', () => loadProfile(false));
  activityMore?.addEventListener('click',loadActivity);
  window.addEventListener('fleet:session', event => { if (!mutating) refreshViewer(event.detail); });
  window.addEventListener('fleet:creator',()=>{if(profile&&!mutating)renderAction();});
  (async () => {
    let session;
    try { session = await identity.session(); } catch { session = {profile:null}; }
    await window.FleetCreator?.ready;
    viewer = session?.profile || null;
    await loadProfile(true);
  })();
})();
