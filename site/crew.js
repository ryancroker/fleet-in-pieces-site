(() => {
  'use strict';
  const login = document.getElementById('crew-login'), desk = document.getElementById('crew-desk');
  const access = document.getElementById('access-form'), list = document.getElementById('crew-list');
  if (!access || !list) return;
  const message = document.getElementById('crew-feedback'), more = document.getElementById('crew-more');
  const statusNames = {new:'Submitted',reviewing:'Under review',planned:'Planned',building:'Building',implemented:'Implemented',declined:'Declined'};
  const dateFormat = new Intl.DateTimeFormat(undefined, {year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  let accessKey = '', view = 'reports', offset = 0, generation = 0, serial = 0;
  const seen = new Set(), drafts = new Map();

  function node(tag, className, text) {
    const element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text); return element;
  }
  function button(text, className = 'button secondary') { const element = node('button', className, text); element.type = 'button'; return element; }
  function feedback(element, text, kind = '') { element.textContent = text; element.classList.toggle('error', kind === 'error'); element.classList.toggle('success', kind === 'success'); }
  function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : dateFormat.format(d); }
  function field(parent, title, name, options = {}) {
    const id = `crew-field-${++serial}`, label = node('label', '', title); label.htmlFor = id;
    const input = node(options.tag || 'input'); input.id = id; input.name = name;
    Object.entries(options).forEach(([key, value]) => { if (key !== 'tag') input[key] = value; });
    parent.append(label, input); return input;
  }
  function lock(note = '') {
    accessKey = ''; access.elements.key.value = ''; generation++; offset = 0; seen.clear(); drafts.clear();
    list.replaceChildren(); desk.hidden = true; login.hidden = false;
    feedback(access.querySelector('.form-feedback'), note); access.elements.key.focus();
  }
  async function api(path, options = {}) {
    if (!accessKey) throw new Error('Unlock the crew desk first.');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(path, {credentials:'same-origin',...options,headers:{Authorization:`Bearer ${accessKey}`,...(options.body ? {'Content-Type':'application/json'} : {})},signal:controller.signal});
      let data; try { data = await response.json(); } catch { throw new Error('The crew service is unavailable. Your edits remain in this tab.'); }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { lock('Access was denied. Enter the current developer key.'); throw new Error('Access was denied. Unlock the desk with the current key.'); }
        throw new Error(typeof data.message === 'string' ? data.message : 'The change could not be confirmed. Please retry.');
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The connection timed out. Your edits remain in this tab; retry to confirm the change.');
      if (error instanceof TypeError) throw new Error('Couldn’t connect. Your edits remain in this tab. Check the connection and retry.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function ideaLink(id, label = 'Open public idea →') {
    const link = node('a', 'back-link', label); link.href = `/i/${encodeURIComponent(id)}`; link.target = '_blank'; link.rel = 'noopener'; return link;
  }
  function adminReply(reply) {
    const row = node('article', 'reply-card');
    row.append(node('p', 'reply-body', reply.body), node('p', 'reply-byline', `${reply.handle || 'Anonymous Crew Member'} · ${date(reply.created_at)}`));
    const flag = node('p', 'crew-flag', reply.hidden ? 'Hidden from the public page' : 'Public reply');
    const toggle = button(reply.hidden ? 'Restore reply' : 'Hide reply'), msg = node('p', 'form-feedback'); msg.setAttribute('role', 'status');
    let hidden = Boolean(reply.hidden);
    toggle.addEventListener('click', async () => {
      toggle.disabled = true; feedback(msg, 'Saving…');
      try { await api(`/api/admin/replies/${encodeURIComponent(reply.id)}`, {method:'PATCH',body:JSON.stringify({hidden:!hidden})}); hidden = !hidden; toggle.textContent = hidden ? 'Restore reply' : 'Hide reply'; flag.textContent = hidden ? 'Hidden from the public page' : 'Public reply'; feedback(msg, hidden ? 'Reply hidden.' : 'Reply restored.', 'success'); }
      catch (error) { feedback(msg, error.message, 'error'); }
      finally { toggle.disabled = false; }
    });
    row.append(flag, toggle, msg); return row;
  }
  function adminReplies(ideaId) {
    const section = node('section', 'reply-section'); section.hidden = true;
    section.append(node('h3', '', 'Replies, including hidden'));
    const msg = node('p', 'feed-feedback'), rows = node('div'), load = button('More replies'); msg.setAttribute('role', 'status'); load.hidden = true;
    section.append(msg, rows, load);
    let replyOffset = 0, started = false; const seenReplies = new Set();
    async function fetchReplies() {
      load.disabled = true; feedback(msg, 'Loading replies…');
      try {
        const data = await api(`/api/admin/ideas/${encodeURIComponent(ideaId)}?offset=${replyOffset}`);
        const replies = Array.isArray(data.replies) ? data.replies : [];
        replies.forEach(reply => { if (!seenReplies.has(String(reply.id))) { seenReplies.add(String(reply.id)); rows.append(adminReply(reply)); } });
        replyOffset += replies.length; load.hidden = !data.has_more; feedback(msg, seenReplies.size ? '' : 'No replies yet.');
      } catch (error) { feedback(msg, error.message, 'error'); const retry = button('Try again', 'text-button'); retry.addEventListener('click', fetchReplies); msg.append(retry); }
      finally { load.disabled = false; }
    }
    load.addEventListener('click', fetchReplies);
    return {element:section,open:() => { if (!started) { started = true; fetchReplies(); } }};
  }
  function ideaCard(idea) {
    const card = node('article', 'crew-card'); card.dataset.ideaId = String(idea.id);
    card.append(node('h2', '', `Missiles · idea ${idea.id}`), node('p', 'crew-meta', `${idea.handle || 'Anonymous Crew Member'} · ${date(idea.created_at)} · ${Number(idea.votes) || 0} votes · ${Number(idea.reply_count) || 0} replies`), node('p', 'crew-body', idea.body));
    const form = node('form', 'crew-form'), row = node('div', 'crew-form-row');
    const statusCell = node('div'), labelCell = node('div'); row.append(statusCell, labelCell);
    const status = field(statusCell, 'Development status', 'status', {tag:'select'});
    Object.entries(statusNames).forEach(([value, text]) => { const option = node('option', '', text); option.value = value; status.append(option); });
    field(labelCell, 'Public status label (optional)', 'status_label', {maxLength:60,placeholder:'TECHNICALLY POSSIBLE, UNFORTUNATELY'}); form.append(row);
    field(form, 'Developer response', 'developer_response', {tag:'textarea',rows:4,maxLength:2000,placeholder:'What fits, what doesn’t, what you’re building.'});
    const hiddenLabel = node('label', 'crew-check'), hidden = node('input'); hidden.type = 'checkbox'; hidden.name = 'hidden'; hiddenLabel.append(hidden, document.createTextNode('Hide this idea from public pages')); form.append(hiddenLabel);
    const saved = drafts.get(String(idea.id)) || idea;
    status.value = saved.status in statusNames ? saved.status : 'new'; form.elements.status_label.value = saved.status_label || ''; form.elements.developer_response.value = saved.developer_response || ''; hidden.checked = Boolean(saved.hidden);
    const draft = () => ({status:status.value,status_label:form.elements.status_label.value,developer_response:form.elements.developer_response.value,hidden:hidden.checked});
    form.addEventListener('input', () => drafts.set(String(idea.id), draft())); form.addEventListener('change', () => drafts.set(String(idea.id), draft()));
    const save = node('button', 'button primary', 'Save developer update'); save.type = 'submit';
    const msg = node('p', 'form-feedback'); msg.setAttribute('role', 'status'); form.append(save, msg); card.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!form.reportValidity()) return; save.disabled = true; feedback(msg, 'Saving…');
      try { const payload = draft(); await api(`/api/admin/ideas/${encodeURIComponent(idea.id)}`, {method:'PATCH',body:JSON.stringify(payload)}); drafts.set(String(idea.id), payload); feedback(msg, payload.hidden ? 'Saved. This idea is hidden.' : 'Saved. The developer update is public.', 'success'); }
      catch (error) { feedback(msg, error.message, 'error'); }
      finally { save.disabled = false; }
    });
    const actions = node('div', 'crew-actions'), repliesButton = button('Inspect replies'), replies = adminReplies(idea.id);
    repliesButton.setAttribute('aria-expanded', 'false'); repliesButton.addEventListener('click', () => { const open = replies.element.hidden; replies.element.hidden = !open; repliesButton.setAttribute('aria-expanded', String(open)); if (open) replies.open(); });
    actions.append(repliesButton, ideaLink(idea.id)); card.append(actions, replies.element); return card;
  }
  function reportCard(report) {
    const card = node('article', 'crew-card');
    const type = report.target_type === 'reply' ? 'reply' : 'idea';
    const reasonNames = {spam:'Spam / malicious link',privacy:'Private information / impersonation',threat:'Threat',illegal:'Illegal material',other:'Other'};
    card.append(node('h2', '', `${reasonNames[report.reason] || report.reason || 'Report'} · ${type}`), node('p', 'crew-meta', `Report ${report.id} · ${date(report.created_at)} · ${report.target_handle || 'Anonymous Crew Member'}`), node('p', 'crew-body', report.target_body || '(Content unavailable)'));
    if (report.detail) card.append(node('p', 'crew-detail', report.detail));
    let isHidden = Boolean(report.target_own_hidden ?? report.target_hidden);
    const visibility = () => report.parent_hidden ? `Parent idea is hidden. This reply is also ${isHidden ? 'hidden' : 'not individually hidden'}.` : isHidden ? 'Target is hidden' : 'Target is public';
    const flag = node('p', 'crew-flag', visibility());
    const actions = node('div', 'crew-actions'), hide = button(isHidden ? `Restore ${type}` : `Hide ${type}`), resolve = button('Resolve report');
    const msg = node('p', 'form-feedback'); msg.setAttribute('role', 'status');
    hide.addEventListener('click', async () => {
      hide.disabled = true; feedback(msg, 'Saving…');
      try { await api(`/api/admin/${type === 'reply' ? 'replies' : 'ideas'}/${encodeURIComponent(report.target_id)}`, {method:'PATCH',body:JSON.stringify({hidden:!isHidden})}); isHidden = !isHidden; flag.textContent = visibility(); hide.textContent = isHidden ? `Restore ${type}` : `Hide ${type}`; feedback(msg, isHidden ? 'Hidden. Resolve the report when you’re finished.' : report.parent_hidden ? 'Reply restored. Its parent idea is still hidden.' : 'Restored.', 'success'); }
      catch (error) { feedback(msg, error.message, 'error'); }
      finally { hide.disabled = false; }
    });
    resolve.addEventListener('click', async () => {
      resolve.disabled = true; feedback(msg, 'Resolving…');
      try { await api(`/api/admin/reports/${encodeURIComponent(report.id)}`, {method:'PATCH',body:JSON.stringify({resolved:true})}); if (view === 'reports' && list.contains(card)) offset = Math.max(0, offset - 1); resolve.textContent = 'Resolved'; feedback(msg, 'Report resolved.', 'success'); }
      catch (error) { feedback(msg, error.message, 'error'); resolve.disabled = false; }
    });
    actions.append(hide, resolve);
    const ideaId = type === 'idea' ? report.target_id : report.idea_id;
    if (ideaId !== undefined && ideaId !== null) {
      actions.append(ideaLink(ideaId));
      const inspect = button('Inspect idea & replies');
      const detail = node('div'); detail.hidden = true; let loaded = false;
      inspect.setAttribute('aria-expanded', 'false');
      inspect.addEventListener('click', async () => {
        const open = detail.hidden; detail.hidden = !open; inspect.setAttribute('aria-expanded', String(open));
        if (!open || loaded) return;
        inspect.disabled = true;
        try { const data = await api(`/api/admin/ideas/${encodeURIComponent(ideaId)}`); if (data.idea) { detail.append(ideaCard(data.idea)); loaded = true; } else feedback(msg, 'The original idea is unavailable.', 'error'); }
        catch (error) { feedback(msg, error.message, 'error'); }
        finally { inspect.disabled = false; }
      });
      actions.append(inspect); card.append(flag, actions, msg, detail);
    } else card.append(flag, actions, msg);
    return card;
  }
  function renderPage(data, expectedGeneration) {
    if (expectedGeneration !== generation || !accessKey) return;
    const rows = Array.isArray(data[view]) ? data[view] : [];
    rows.forEach(row => { if (!seen.has(String(row.id))) { seen.add(String(row.id)); list.append(view === 'reports' ? reportCard(row) : ideaCard(row)); } });
    offset += rows.length; more.hidden = !data.has_more;
    feedback(message, seen.size ? '' : view === 'reports' ? 'No unresolved reports. A rare moment of peace.' : 'No ideas have been submitted yet.');
  }
  async function loadView(reset = false) {
    if (!accessKey) return;
    if (reset) { generation++; offset = 0; seen.clear(); list.replaceChildren(); }
    const expectedGeneration = generation; more.disabled = true; feedback(message, 'Loading…');
    try { const data = await api(`/api/admin?view=${view}&offset=${offset}`); renderPage(data, expectedGeneration); }
    catch (error) { if (expectedGeneration === generation) { feedback(message, error.message, 'error'); const retry = button('Try again', 'text-button'); retry.addEventListener('click', () => loadView()); message.append(retry); } }
    finally { if (expectedGeneration === generation) more.disabled = false; }
  }
  access.addEventListener('submit', async event => {
    event.preventDefault(); if (!access.reportValidity()) return;
    const submit = access.querySelector('[type=submit]'), msg = access.querySelector('.form-feedback');
    accessKey = access.elements.key.value.trim(); access.elements.key.value = ''; submit.disabled = true; feedback(msg, 'Checking access…');
    try {
      const data = await api('/api/admin?view=reports&offset=0'); view = 'reports'; generation++; offset = 0; seen.clear(); list.replaceChildren();
      document.querySelectorAll('[data-view]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.view === view)));
      login.hidden = true; desk.hidden = false; feedback(msg, ''); renderPage(data, generation);
    } catch (error) { accessKey = ''; feedback(msg, error.message, 'error'); }
    finally { submit.disabled = false; }
  });
  document.querySelectorAll('[data-view]').forEach(control => control.addEventListener('click', () => { if (view === control.dataset.view) return; view = control.dataset.view; document.querySelectorAll('[data-view]').forEach(other => other.setAttribute('aria-pressed', String(other === control))); loadView(true); }));
  document.getElementById('crew-refresh').addEventListener('click', () => loadView(true));
  document.getElementById('crew-lock').addEventListener('click', () => lock('Desk locked. The access key was cleared.'));
  more.addEventListener('click', () => loadView());
  window.addEventListener('pagehide', () => { accessKey = ''; access.elements.key.value = ''; generation++; drafts.clear(); list.replaceChildren(); desk.hidden = true; login.hidden = false; });
})();
