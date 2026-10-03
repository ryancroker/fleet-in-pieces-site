(() => {
  'use strict';
  const list = document.getElementById('idea-list');
  if (!list) return;
  const system = document.body.dataset.communitySystem || 'missiles';
  const threadPage = document.body.hasAttribute('data-idea-page');
  const feedMessage = document.getElementById('feed-feedback');
  const more = document.getElementById('more-ideas');
  const statusNames = {new:'Submitted',reviewing:'Under review',planned:'Planned',building:'Building',implemented:'Implemented',declined:'Declined'};
  const dateFormat = new Intl.DateTimeFormat(undefined, {year:'numeric',month:'short',day:'numeric'});
  const cards = new Map();
  let sort = 'top', offset = 0, generation = 0, serial = 0;
  const storagePrefix = 'fleet-community:';
  const memoryStorage = new Map();

  function readLocal(key) {
    try { return localStorage.getItem(storagePrefix + key) || memoryStorage.get(key) || ''; }
    catch { return memoryStorage.get(key) || ''; }
  }
  function writeLocal(key, value) {
    memoryStorage.set(key, value);
    try { if (value) localStorage.setItem(storagePrefix + key, value); else localStorage.removeItem(storagePrefix + key); } catch {}
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  function button(text, className = 'text-button') {
    const element = node('button', className, text); element.type = 'button'; return element;
  }
  function feedback(element, message, kind = '') {
    element.textContent = message; element.classList.toggle('error', kind === 'error'); element.classList.toggle('success', kind === 'success');
  }
  function formBusy(form, busy) { Array.from(form.elements).forEach(control => { control.disabled = busy; }); }
  function formatDate(value) {
    const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
  }
  function byline(handle, created, className) {
    const line = node('p', className);
    line.append(node('span', '', handle || 'Anonymous Crew Member'));
    const when = node('time', '', formatDate(created));
    if (when.textContent) { when.dateTime = created; line.append(when); }
    line.title = 'Public handles are unverified.';
    return line;
  }
  function uuid() { return crypto.randomUUID(); }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(path, {credentials:'same-origin',...options,headers:{...(options.body ? {'Content-Type':'application/json'} : {}),...(options.headers || {})},signal:controller.signal});
      let data;
      try { data = await response.json(); } catch { throw new Error('The crew desk is temporarily unavailable. Your draft is still here. Please try again.'); }
      if (!response.ok) {
        let message = typeof data.message === 'string' ? data.message : 'That request didn’t go through. Please try again.';
        const retry = Number(response.headers.get('Retry-After'));
        if (response.status === 429 && retry > 0) message += ` Try again in about ${Math.ceil(retry / 60)} minute${retry > 60 ? 's' : ''}.`;
        const error = new Error(message); error.status = response.status; throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The connection took too long. Your draft is safe; try again to confirm the post.');
      if (error instanceof TypeError) throw new Error('Couldn’t reach the crew. Check your connection and try again. Your draft is still here.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function initHandle(input) {
    input.value = readLocal('handle').slice(0, 32);
    input.addEventListener('input', () => {
      writeLocal('handle', input.value);
      document.querySelectorAll('[data-handle]').forEach(other => { if (other !== input) other.value = input.value; });
    });
  }
  function initDraft(form, key) {
    const area = form.elements.body;
    let saved;
    try { saved = JSON.parse(readLocal(`draft:${key}`)); } catch {}
    let requestId = saved && typeof saved.request_id === 'string' ? saved.request_id : uuid();
    if (saved && typeof saved.body === 'string') area.value = saved.body.slice(0, area.maxLength);
    area.addEventListener('input', () => { requestId = uuid(); writeLocal(`draft:${key}`, JSON.stringify({body:area.value,request_id:requestId})); });
    initHandle(form.elements.handle);
    return {id:() => requestId,clear:() => { area.value = ''; requestId = uuid(); writeLocal(`draft:${key}`, ''); }};
  }
  function field(form, labelText, name, options = {}) {
    const id = `community-field-${++serial}`;
    const label = node('label', '', labelText); label.htmlFor = id;
    const control = node(options.tag || 'input'); control.id = id; control.name = name;
    Object.entries(options).forEach(([key, value]) => { if (key !== 'tag') control[key] = value; });
    form.append(label, control); return control;
  }
  function honeypot(form) {
    const trap = node('div', 'honeypot'); trap.setAttribute('aria-hidden', 'true');
    field(trap, 'Website', 'website', {tabIndex:-1,autocomplete:'off'}); form.append(trap);
  }
  function retryMessage(container, message, retry) {
    feedback(container, message, 'error');
    const action = button('Try again'); action.addEventListener('click', retry); container.append(action);
  }
  function reportControl(type, id) {
    const details = node('details', 'report-panel');
    details.append(node('summary', '', 'Report'));
    const form = node('form', 'report-form');
    const reason = field(form, 'What’s wrong?', 'reason', {tag:'select'});
    [['spam','Spam / malicious link'],['privacy','Private information / impersonation'],['threat','Threat'],['illegal','Illegal material'],['other','Something else']].forEach(([value, label]) => { const option = node('option', '', label); option.value = value; reason.append(option); });
    field(form, 'Anything else? (optional)', 'detail', {tag:'textarea',maxLength:500,rows:2});
    const send = node('button', 'button secondary', 'Send report'); send.type = 'submit';
    const message = node('p', 'form-feedback'); message.setAttribute('role', 'status');
    form.append(send, message); details.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); send.disabled = true; feedback(message, 'Sending report…');
      try {
        await api('/api/reports', {method:'POST',body:JSON.stringify({target_type:type,target_id:id,reason:reason.value,detail:form.elements.detail.value.trim()})});
        feedback(message, 'Report sent. The developer can review it.', 'success'); send.textContent = 'Report sent';
      } catch (error) { feedback(message, error.message, 'error'); send.disabled = false; }
    });
    return details;
  }
  function renderReply(reply) {
    const article = node('article', 'reply-card');
    article.dataset.replyId = String(reply.id);
    article.append(node('p', 'reply-body', reply.body), byline(reply.handle, reply.created_at, 'reply-byline'), reportControl('reply', reply.id));
    return article;
  }
  function replySection(idea, onCount) {
    const section = node('section', 'reply-section'); section.id = `replies-${idea.id}`;
    section.append(node('h3', '', 'The discussion'));
    const message = node('p', 'feed-feedback'); message.setAttribute('role', 'status');
    const replies = node('div', 'reply-list'), seen = new Set();
    const load = button('More replies'); load.hidden = true;
    const form = node('form', 'reply-form');
    field(form, 'Your reply', 'body', {tag:'textarea',minLength:2,maxLength:1500,rows:3,required:true,placeholder:'Make the idea better. Or make your objection.'});
    const handle = field(form, 'Name / handle (optional)', 'handle', {maxLength:32,autocomplete:'nickname',placeholder:'Anonymous Crew Member'}); handle.dataset.handle = '';
    honeypot(form);
    const send = node('button', 'button secondary', 'Post reply'); send.type = 'submit';
    const replyMessage = node('p', 'form-feedback'); replyMessage.setAttribute('role', 'status');
    form.append(send, replyMessage, node('p', 'field-hint', 'Replies are public. Handles are unverified. Don’t post private information or outside links.'));
    const draft = initDraft(form, `${idea.id}:reply`);
    section.append(message, replies, load, form);
    let replyOffset = 0, started = false;
    async function loadReplies() {
      load.disabled = true; feedback(message, 'Loading replies…');
      try {
        const data = await api(`/api/ideas/${encodeURIComponent(idea.id)}/replies?offset=${replyOffset}`);
        const rows = Array.isArray(data.replies) ? data.replies : [];
        rows.forEach(reply => { if (!seen.has(String(reply.id))) { seen.add(String(reply.id)); replies.append(renderReply(reply)); } });
        replyOffset += rows.length; load.hidden = !data.has_more;
        feedback(message, seen.size ? '' : 'No replies yet. Take the first shot.');
      } catch (error) { retryMessage(message, error.message, loadReplies); }
      finally { load.disabled = false; }
    }
    load.addEventListener('click', loadReplies);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      formBusy(form, true); feedback(replyMessage, 'Posting reply…');
      try {
        const data = await api(`/api/ideas/${encodeURIComponent(idea.id)}/replies`, {method:'POST',body:JSON.stringify({body:form.elements.body.value.trim(),handle:form.elements.handle.value.trim(),request_id:draft.id(),website:form.elements.website.value})});
        if (!data.reply) throw new Error('The reply could not be confirmed. Your draft is still here; please try again.');
        if (!seen.has(String(data.reply.id))) { seen.add(String(data.reply.id)); replies.append(renderReply(data.reply)); onCount(); }
        draft.clear(); feedback(message, ''); feedback(replyMessage, 'Reply posted.', 'success');
      } catch (error) { feedback(replyMessage, error.message, 'error'); }
      finally { formBusy(form, false); }
    });
    return {element:section,open:() => { if (!started) { started = true; loadReplies(); } }};
  }
  function renderIdea(idea, expanded = false) {
    const article = node('article', 'idea-card'); article.id = `idea-${idea.id}`;
    const main = node('div', 'idea-main'), content = node('div', 'idea-content');
    const vote = button('', 'vote-button'), arrow = node('span', 'vote-arrow', '▲'), count = node('span', '', Number(idea.votes) || 0);
    vote.append(arrow, count); vote.setAttribute('aria-pressed', String(Boolean(idea.voted)));
    let voted = Boolean(idea.voted), replyCount = Number(idea.reply_count) || 0;
    const message = node('p', 'card-feedback'); message.setAttribute('role', 'status');
    const updateVoteLabel = () => vote.setAttribute('aria-label', `${voted ? 'Remove your vote' : 'Vote for this idea'}. ${count.textContent} votes.`);
    updateVoteLabel();
    vote.addEventListener('click', async () => {
      vote.disabled = true; feedback(message, '');
      try {
        const data = await api(`/api/ideas/${encodeURIComponent(idea.id)}/vote`, {method:'POST',body:JSON.stringify({voted:!voted})});
        voted = Boolean(data.voted); count.textContent = String(Number(data.votes) || 0); vote.setAttribute('aria-pressed', String(voted)); updateVoteLabel();
        feedback(message, voted ? 'Vote counted.' : 'Vote removed.');
      } catch (error) { feedback(message, error.message, 'error'); }
      finally { vote.disabled = false; }
    });
    content.append(node('p', 'idea-body', idea.body), byline(idea.handle, idea.created_at, 'idea-byline'));
    const status = node('p', 'idea-status', idea.status_label || statusNames[idea.status] || 'Submitted'); status.dataset.status = idea.status || 'new'; content.append(status);
    if (idea.developer_response) { const response = node('p', 'developer-response'); response.append(node('strong', '', 'Developer response'), document.createTextNode(idea.developer_response)); content.append(response); }
    if (idea.status === 'implemented' && idea.implemented_at) content.append(node('p', 'implementation-date', `Implemented ${formatDate(idea.implemented_at)}`));
    const actions = node('div', 'idea-actions'), toggle = button('', 'reply-toggle'), share = button('Share');
    const updateReplies = () => { toggle.textContent = `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`; };
    updateReplies(); toggle.setAttribute('aria-expanded', String(expanded)); toggle.setAttribute('aria-controls', `replies-${idea.id}`);
    const permalink = node('a', '', 'Open idea'); permalink.href = `/i/${encodeURIComponent(idea.id)}`;
    actions.append(toggle, share); if (!threadPage) actions.append(permalink);
    content.append(actions, message, reportControl('idea', idea.id));
    const discussion = replySection(idea, () => { replyCount++; updateReplies(); }); discussion.element.hidden = !expanded; content.append(discussion.element);
    toggle.addEventListener('click', () => { const open = discussion.element.hidden; discussion.element.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) discussion.open(); });
    share.addEventListener('click', async () => {
      const url = new URL(`/i/${encodeURIComponent(idea.id)}`, location.origin).href;
      try {
        if (navigator.share) { await navigator.share({title:'A Fleet in Pieces idea',url}); feedback(message, ''); }
        else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); feedback(message, 'Link copied.'); }
        else throw new Error('manual');
      } catch (error) {
        if (error.name === 'AbortError') return;
        feedback(message, 'Copy this link: '); const link = node('a', '', url); link.href = url; message.classList.add('share-fallback'); message.append(link);
      }
    });
    main.append(vote, content); article.append(main);
    if (expanded) discussion.open();
    return article;
  }
  function addIdea(idea, prepend = false, expanded = false) {
    if (!idea || idea.id === undefined || cards.has(String(idea.id))) return;
    const card = renderIdea(idea, expanded); cards.set(String(idea.id), card);
    if (prepend) list.prepend(card); else list.append(card);
    if (idea.status === 'implemented') { const history = document.querySelector('.feedback-history'); if (history) history.hidden = false; }
  }
  async function loadIdeas(reset = false) {
    if (reset) { generation++; offset = 0; cards.clear(); list.replaceChildren(); const history = document.querySelector('.feedback-history'); if (history) history.hidden = true; }
    const version = generation;
    if (more) more.disabled = true;
    feedback(feedMessage, 'Loading the crew’s ideas…');
    try {
      const data = await api(`/api/ideas?system=${encodeURIComponent(system)}&sort=${sort}&offset=${offset}`);
      if (version !== generation) return;
      const rows = Array.isArray(data.ideas) ? data.ideas : [];
      rows.forEach(idea => addIdea(idea)); offset += rows.length;
      feedback(feedMessage, cards.size ? '' : 'No ideas yet. Yours can be the first questionable decision.');
      if (more) more.hidden = !data.has_more;
    } catch (error) { if (version === generation) retryMessage(feedMessage, error.message, () => loadIdeas(false)); }
    finally { if (more && version === generation) more.disabled = false; }
  }
  function offlineNotice() { document.querySelectorAll('[data-offline]').forEach(element => { element.hidden = navigator.onLine !== false; }); }
  window.addEventListener('online', offlineNotice); window.addEventListener('offline', offlineNotice); offlineNotice();
  document.querySelectorAll('video').forEach(video => { video.addEventListener('play', () => { document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); }); }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause()); });
  if (threadPage) {
    const match = location.pathname.match(/^\/i\/([a-zA-Z0-9_-]+)\/?$/);
    if (!match) { feedback(feedMessage, 'This idea link is incomplete. Open the missile page to find the discussion.', 'error'); return; }
    const loadThread = async () => {
      feedback(feedMessage, 'Loading the discussion…');
      try { const data = await api(`/api/ideas/${encodeURIComponent(match[1])}`); if (!data.idea) throw new Error('This idea is no longer available.'); addIdea(data.idea, false, true); feedback(feedMessage, ''); }
      catch (error) { if (error.status === 404) feedback(feedMessage, 'This idea is unavailable. It may have been removed. The missile page has the current discussions.', 'error'); else retryMessage(feedMessage, error.message, loadThread); }
    };
    loadThread();
  } else {
    document.querySelectorAll('[data-sort]').forEach(control => control.addEventListener('click', () => { if (sort === control.dataset.sort) return; sort = control.dataset.sort; document.querySelectorAll('[data-sort]').forEach(item => item.setAttribute('aria-pressed', String(item === control))); loadIdeas(true); }));
    if (more) more.addEventListener('click', () => loadIdeas());
    const form = document.getElementById('idea-form');
    if (form) {
      const draft = initDraft(form, `${system}:idea`), submit = form.querySelector('[type=submit]'), message = form.querySelector('.form-feedback'); submit.disabled = false;
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (!form.reportValidity()) return;
        formBusy(form, true); feedback(message, 'Posting your idea…');
        try {
          const data = await api('/api/ideas', {method:'POST',body:JSON.stringify({system,body:form.elements.body.value.trim(),handle:form.elements.handle.value.trim(),request_id:draft.id(),website:form.elements.website.value})});
          if (!data.idea) throw new Error('The post could not be confirmed. Your draft is still here; please try again.');
          addIdea(data.idea, true); draft.clear(); feedback(feedMessage, ''); feedback(message, 'Posted. Your idea is public.', 'success');
          const link = node('a', 'back-link', 'Open your idea →'); link.href = `/i/${encodeURIComponent(data.idea.id)}`; message.append(document.createTextNode(' '), link);
        } catch (error) { feedback(message, error.message, 'error'); }
        finally { formBusy(form, false); }
      });
    }
    loadIdeas(true);
  }
})();
