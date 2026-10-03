(() => {
  'use strict';
  const list = document.getElementById('idea-list');
  const system = document.body.dataset.communitySystem || 'missiles';
  const contentId = document.body.dataset.contentId || '';
  const threadPage = document.body.hasAttribute('data-idea-page');
  const feedMessage = document.getElementById('feed-feedback');
  const more = document.getElementById('more-ideas');
  const statusNames = {new:'Submitted',reviewing:'Looking at this',planned:'Planned',building:'Prototyping',implemented:'Implemented',declined:'No'};
  const dateFormat = new Intl.DateTimeFormat(undefined, {year:'numeric',month:'short',day:'numeric'});
  const cards = new Map();
  const voteViews = new Map();
  let sort = 'top', offset = 0, generation = 0, serial = 0, loadingGeneration = -1;
  const storagePrefix = 'fleet-community:';
  const memoryStorage = new Map();
  const reportDrafts = new Map();
  let reportDialog = null;
  let sessionStarted = false, sessionProfile = null, sessionRevision = 0;
  const identityForms = new Set();
  let firstRequestReady = null;

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
  function localPath(value, fallback) {
    return typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9_/?=&.%#-]*$/.test(value) ? value : fallback;
  }
  function authorPath(author) {
    if (!author || !author.id) return '';
    return localPath(author.path, `/u/${encodeURIComponent(author.id)}`);
  }
  function displayHandle(handle) {
    if (!handle || handle === 'Anonymous Crew Member') return 'Anonymous Crew Member';
    return handle.startsWith('@') ? handle : `@${handle}`;
  }
  function byline(handle, created, className, author = null) {
    const line = node('p', className);
    const path = authorPath(author);
    const name = node(path ? 'a' : 'span', path ? 'author-link' : '', displayHandle(author?.callsign || handle));
    if (path) { name.href = path; name.title = 'Fleet Register identity'; }
    else name.title = 'This public handle is unverified.';
    line.append(name);
    const when = node('time', '', formatDate(created));
    if (when.textContent) { when.dateTime = created; line.append(when); }
    return line;
  }
  function uuid() { return crypto.randomUUID(); }
  async function api(path, options = {}) {
    // The first response establishes the anonymous browser cookie. Parallel first
    // visits must not race several Set-Cookie identities against one another.
    let releaseFirstRequest;
    if (firstRequestReady) await firstRequestReady;
    else firstRequestReady = new Promise(resolve => { releaseFirstRequest = resolve; });
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
    } finally { clearTimeout(timeout); if (releaseFirstRequest) releaseFirstRequest(); }
  }
  function initHandle(input) {
    input.value = readLocal('handle').slice(0, 32);
    input.addEventListener('input', () => {
      writeLocal('handle', input.value);
      document.querySelectorAll('[data-handle]').forEach(other => { if (other !== input) other.value = input.value; });
    });
  }
  function applyIdentity(form) {
    const input = form.elements.handle;
    let note = form.querySelector('.posting-identity');
    if (!note) { note = node('p', 'posting-identity field-hint'); note.setAttribute('aria-live', 'polite'); input.after(note); }
    note.replaceChildren(); note.hidden = !sessionProfile;
    const wasRegistered = input.readOnly;
    input.readOnly = Boolean(sessionProfile);
    if (sessionProfile) {
      input.value = sessionProfile.callsign || '';
      note.append(document.createTextNode('Posting as '));
      const profile = node('a', 'author-link', displayHandle(sessionProfile.callsign)); profile.href = authorPath(sessionProfile) || '/register';
      const manage = node('a', '', 'Manage identity'); manage.href = '/register';
      note.append(profile, document.createTextNode(' · '), manage);
    } else if (wasRegistered) input.value = readLocal('handle').slice(0, 32);
  }
  function attachIdentity(form) {
    identityForms.add(form); applyIdentity(form);
    if (sessionStarted) return;
    sessionStarted = true;
    const revision = sessionRevision;
    window.FleetSession ||= api('/api/session').catch(() => ({profile:null}));
    window.FleetSession.then(data => {
      if (revision !== sessionRevision) return;
      sessionProfile = data.profile || null;
      identityForms.forEach(item => { if (item.isConnected) applyIdentity(item); });
    }).catch(() => { /* Identity is optional; anonymous posting stays available. */ });
  }
  window.addEventListener('fleet:session', event => {
    sessionRevision++;
    sessionProfile = event.detail?.profile || null;
    identityForms.forEach(form => { if (form.isConnected) applyIdentity(form); });
  });
  function initDraft(form, key) {
    const area = form.elements.body;
    let saved;
    try { saved = JSON.parse(readLocal(`draft:${key}`)); } catch {}
    let requestId = saved && typeof saved.request_id === 'string' ? saved.request_id : uuid();
    let payloadKey = saved && typeof saved.payload_key === 'string' ? saved.payload_key : null;
    if (saved && typeof saved.body === 'string') area.value = saved.body.slice(0, area.maxLength);
    area.addEventListener('input', () => { requestId = uuid(); payloadKey = null; writeLocal(`draft:${key}`, JSON.stringify({body:area.value,request_id:requestId})); });
    initHandle(form.elements.handle);
    attachIdentity(form);
    return {
      id:() => {
        const nextKey = JSON.stringify([area.value.trim(),form.elements.handle.value.trim()]);
        if (payloadKey !== null && payloadKey !== nextKey) requestId = uuid();
        payloadKey = nextKey;
        writeLocal(`draft:${key}`, JSON.stringify({body:area.value,request_id:requestId,payload_key:payloadKey}));
        return requestId;
      },
      clear:() => { area.value = ''; requestId = uuid(); payloadKey = null; writeLocal(`draft:${key}`, ''); }
    };
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
  function ensureReportDialog() {
    if (reportDialog) return reportDialog;
    const dialog = node('dialog', 'report-dialog'); dialog.id = 'community-report-dialog';
    dialog.setAttribute('aria-labelledby', 'report-dialog-title'); dialog.setAttribute('aria-describedby', 'report-dialog-note');
    const heading = node('div', 'report-dialog-header'), title = node('h2', '', 'Report content'); title.id = 'report-dialog-title';
    const close = button('Close', 'text-button report-close'); close.setAttribute('aria-label', 'Close report');
    heading.append(title, close);
    const note = node('p', 'field-hint', 'Disagreeing is fine. Report spam, threats, private information, impersonation or illegal material.'); note.id = 'report-dialog-note';
    const form = node('form', 'report-form');
    const reason = field(form, 'What’s wrong?', 'reason', {tag:'select'});
    [['spam','Spam / malicious link'],['privacy','Private information / impersonation'],['threat','Threat'],['illegal','Illegal material'],['other','Something else']].forEach(([value, label]) => { const option = node('option', '', label); option.value = value; reason.append(option); });
    field(form, 'Anything else? (optional)', 'detail', {tag:'textarea',maxLength:500,rows:2});
    const actions = node('div', 'dialog-actions'), cancel = button('Cancel', 'button secondary');
    const send = node('button', 'button primary', 'Send report'); send.type = 'submit';
    const message = node('p', 'form-feedback'); message.setAttribute('role', 'status');
    actions.append(cancel, send); form.append(actions, message); dialog.append(heading, note, form); document.body.append(dialog);
    let target = null, opener = null, cycle = 0;
    const saveDraft = () => { if (target && !target.sent) reportDrafts.set(target.key, {reason:reason.value,detail:form.elements.detail.value}); };
    close.addEventListener('click', () => dialog.close()); cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { saveDraft(); cycle++; const previous = opener; opener = null; if (previous?.isConnected) previous.focus(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!target || !form.reportValidity()) return;
      const current = {...target}, version = cycle;
      const payload = {target_type:current.type,target_id:current.id,reason:reason.value,detail:form.elements.detail.value.trim()};
      saveDraft(); formBusy(form, true); cancel.disabled = false; feedback(message, 'Sending report…');
      try {
        await api('/api/reports', {method:'POST',body:JSON.stringify(payload)});
        reportDrafts.delete(current.key);
        if (version !== cycle) return;
        target.sent = true; feedback(message, 'Report sent. Fleet Command can review it.', 'success'); send.textContent = 'Report sent'; cancel.textContent = 'Done';
      } catch (error) { if (version === cycle) { feedback(message, error.message, 'error'); formBusy(form, false); } }
    });
    reportDialog = {open:(type, id, trigger) => {
      cycle++; target = {type,id,key:`${type}:${id}`,sent:false}; opener = trigger;
      const saved = reportDrafts.get(target.key);
      form.reset(); formBusy(form, false); reason.value = saved?.reason || 'spam'; form.elements.detail.value = saved?.detail || '';
      title.textContent = type === 'reply' ? 'Report reply' : 'Report idea'; send.textContent = 'Send report'; cancel.textContent = 'Cancel'; feedback(message, '');
      dialog.showModal(); reason.focus();
    }};
    return reportDialog;
  }
  function reportControl(type, id) {
    const action = button('Report', 'report-action'); action.setAttribute('aria-haspopup', 'dialog');
    action.addEventListener('click', () => ensureReportDialog().open(type, id, action));
    return action;
  }
  function renderReply(reply) {
    const article = node('article', 'reply-card');
    article.dataset.replyId = String(reply.id);
    article.append(node('p', 'reply-body', reply.body), byline(reply.handle, reply.created_at, 'reply-byline', reply.author), reportControl('reply', reply.id));
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
  function renderStatus(idea, options = {}) {
    const responded = Boolean(idea.command_responded || idea.developer_response || (idea.status && idea.status !== 'new') || (idea.status_label && !/^submitted$/i.test(idea.status_label)));
    const panel = node('div', responded ? 'fleet-command' : 'idea-state');
    if (responded) panel.append(node('p', 'fleet-command-label', 'Fleet Command'));
    const status = node('p', 'idea-status', idea.status_label || statusNames[idea.status] || 'Submitted'); status.dataset.status = idea.status || 'new'; panel.append(status);
    if (responded && idea.developer_response && !options.compact) panel.append(node('p', 'developer-response', idea.developer_response));
    if (idea.status === 'implemented' && idea.implemented_at) panel.append(node('p', 'implementation-date', `Implemented ${formatDate(idea.implemented_at)}`));
    return panel;
  }
  function contentSource(idea) {
    return {title:idea.content?.title || (idea.system === 'missiles' ? 'Missiles' : 'Fleet discussion'),path:localPath(idea.content?.path, '/systems/missiles')};
  }
  function renderIdea(idea, options = {}) {
    if (typeof options === 'boolean') options = {detail:options};
    const detail = Boolean(options.detail), compact = Boolean(options.compact), href = `/i/${encodeURIComponent(idea.id)}`;
    const article = node('article', `idea-card${detail ? ' idea-detail' : ''}${compact ? ' idea-compact' : ''}`); article.id = `idea-${idea.id}${compact ? `-compact-${++serial}` : ''}`;
    if (!detail) {
      article.classList.add('idea-card-linked');
      article.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.target.closest('a,button,input,textarea,select,label,summary,details,dialog') || window.getSelection()?.toString()) return;
        location.assign(href);
      });
    }
    const main = node('div', 'idea-main'), content = node('div', 'idea-content');
    const vote = button('', 'vote-button'), arrow = node('span', 'vote-arrow', '▲'), count = node('span', 'vote-count', Number(idea.votes) || 0);
    vote.append(arrow, count); vote.setAttribute('aria-pressed', String(Boolean(idea.voted)));
    let voted = Boolean(idea.voted), replyCount = Number(idea.reply_count) || 0;
    const message = node('p', 'card-feedback'); message.setAttribute('role', 'status');
    const updateVoteLabel = () => vote.setAttribute('aria-label', `${voted ? 'Remove your vote' : 'Vote for this idea'}. ${count.textContent} votes.`);
    updateVoteLabel();
    const voteKey = String(idea.id), views = voteViews.get(voteKey) || new Set();
    const voteView = {element:article,update:data => { voted = Boolean(data.voted); count.textContent = String(Number(data.votes) || 0); vote.setAttribute('aria-pressed', String(voted)); updateVoteLabel(); }};
    views.add(voteView); voteViews.set(voteKey, views);
    vote.addEventListener('click', async () => {
      vote.disabled = true; feedback(message, '');
      try {
        const data = await api(`/api/ideas/${encodeURIComponent(idea.id)}/vote`, {method:'POST',body:JSON.stringify({voted:!voted})});
        views.forEach(item => { if (item.element.isConnected) item.update(data); else views.delete(item); });
        feedback(message, voted ? 'Vote counted.' : 'Vote removed.');
      } catch (error) { feedback(message, error.message, 'error'); }
      finally { vote.disabled = false; }
    });
    const source = contentSource(idea), sourceLink = node('a', 'idea-source', source.title); sourceLink.href = source.path;
    const body = node('p', `idea-body${detail ? '' : ' is-clamped'}`, idea.body); content.append(sourceLink, body);
    if (!detail) {
      const read = node('a', 'read-full-idea', 'Read full idea →'); read.href = href; read.hidden = true; content.append(read);
      const measure = () => { if (body.isConnected) read.hidden = body.scrollHeight <= body.clientHeight + 2; };
      requestAnimationFrame(measure);
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(measure); observer.observe(body);
        // Stop retaining detached feed cards after a filter change.
        const removal = new MutationObserver(() => { if (!article.isConnected) { observer.disconnect(); removal.disconnect(); } });
        requestAnimationFrame(() => { if (article.isConnected) removal.observe(article.parentNode, {childList:true}); else observer.disconnect(); });
      }
    }
    content.append(byline(idea.handle, idea.created_at, 'idea-byline', idea.author), renderStatus(idea, {compact}));
    const actions = node('div', 'idea-actions'), replyLink = node('a', 'reply-link'), share = button('Share');
    const updateReplies = () => { replyLink.textContent = `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`; };
    updateReplies(); replyLink.href = detail ? `#replies-${idea.id}` : `${href}#replies-${idea.id}`;
    const permalink = node('a', '', 'Open idea'); permalink.href = `/i/${encodeURIComponent(idea.id)}`;
    actions.append(replyLink, share); if (!detail) actions.append(permalink); actions.append(reportControl('idea', idea.id));
    content.append(actions, message);
    let discussion = null;
    if (detail) { discussion = replySection(idea, () => { replyCount++; updateReplies(); }); content.append(discussion.element); }
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
    if (discussion) discussion.open();
    return article;
  }
  function addIdea(idea, prepend = false, expanded = false) {
    if (!idea || idea.id === undefined || cards.has(String(idea.id))) return;
    const card = renderIdea(idea, {detail:expanded}); cards.set(String(idea.id), card);
    if (prepend) list.prepend(card); else list.append(card);
    if (idea.status === 'implemented') { const history = document.querySelector('.feedback-history'); if (history) history.hidden = false; }
  }
  async function loadIdeas(reset = false) {
    if (reset) { generation++; offset = 0; cards.clear(); list.replaceChildren(); const history = document.querySelector('.feedback-history'); if (history) history.hidden = true; }
    const version = generation;
    if (loadingGeneration === version) return;
    loadingGeneration = version;
    if (more) more.disabled = true;
    feedback(feedMessage, 'Loading the crew’s ideas…');
    try {
      const sourceQuery = contentId ? `content_id=${encodeURIComponent(contentId)}` : `system=${encodeURIComponent(system)}`;
      const data = await api(`/api/ideas?${sourceQuery}&sort=${sort}&offset=${offset}`);
      if (version !== generation) return;
      const rows = Array.isArray(data.ideas) ? data.ideas : [];
      rows.forEach(idea => addIdea(idea)); offset += rows.length;
      const emptyMessages = {responded:'No Fleet Command responses here yet. The suggestions are still open.',implemented:'Nothing marked implemented here yet. This record will grow when an idea reaches the game.'};
      feedback(feedMessage, cards.size ? '' : emptyMessages[sort] || 'No ideas yet. Yours can be the first questionable decision.');
      if (more) more.hidden = !data.has_more;
    } catch (error) { if (version === generation) retryMessage(feedMessage, error.message, () => loadIdeas(false)); }
    finally { if (loadingGeneration === version) loadingGeneration = -1; if (more && version === generation) more.disabled = false; }
  }
  window.FleetCommunity = Object.freeze({api,renderIdea,renderStatus});
  if (!list) return;
  function offlineNotice() { document.querySelectorAll('[data-offline]').forEach(element => { element.hidden = navigator.onLine !== false; }); }
  window.addEventListener('online', offlineNotice); window.addEventListener('offline', offlineNotice); offlineNotice();
  document.querySelectorAll('video').forEach(video => { video.addEventListener('play', () => { document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); }); }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause()); });
  if (threadPage) {
    const match = location.pathname.match(/^\/i\/([a-zA-Z0-9_-]+)\/?$/);
    if (!match) { feedback(feedMessage, 'This idea link is incomplete. Open the missile page to find the discussion.', 'error'); return; }
    const loadThread = async () => {
      feedback(feedMessage, 'Loading the discussion…');
      try {
        const data = await api(`/api/ideas/${encodeURIComponent(match[1])}`); if (!data.idea) throw new Error('This idea is no longer available.');
        const source = contentSource(data.idea);
        document.querySelectorAll('[data-idea-back]').forEach(link => { link.href = source.path; link.textContent = `← All ${source.title.toLowerCase()} ideas`; });
        document.querySelectorAll('[data-idea-source-title]').forEach(element => { element.textContent = source.title; });
        addIdea(data.idea, false, true); feedback(feedMessage, '');
        if (location.hash === `#replies-${data.idea.id}`) requestAnimationFrame(() => document.getElementById(`replies-${data.idea.id}`)?.scrollIntoView({block:'start'}));
      }
      catch (error) { if (error.status === 404) feedback(feedMessage, 'This idea is unavailable. It may have been removed. The missile page has the current discussions.', 'error'); else retryMessage(feedMessage, error.message, loadThread); }
    };
    loadThread();
  } else {
    document.querySelectorAll('[data-sort]').forEach(control => control.addEventListener('click', () => { if (sort === control.dataset.sort || !['top','new','responded','implemented'].includes(control.dataset.sort)) return; sort = control.dataset.sort; document.querySelectorAll('[data-sort]').forEach(item => item.setAttribute('aria-pressed', String(item === control))); loadIdeas(true); }));
    if (more) more.addEventListener('click', () => loadIdeas());
    const form = document.getElementById('idea-form');
    if (form) {
      const draft = initDraft(form, `${system}:idea`), submit = form.querySelector('[type=submit]'), message = form.querySelector('.form-feedback'); submit.disabled = false;
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (!form.reportValidity()) return;
        formBusy(form, true); feedback(message, 'Posting your idea…');
        try {
          const data = await api('/api/ideas', {method:'POST',body:JSON.stringify({system,...(contentId ? {content_id:contentId} : {}),body:form.elements.body.value.trim(),handle:form.elements.handle.value.trim(),request_id:draft.id(),website:form.elements.website.value})});
          if (!data.idea) throw new Error('The post could not be confirmed. Your draft is still here; please try again.');
          if (sort === 'responded' || sort === 'implemented') {
            sort = 'new'; generation++; offset = 0; cards.clear(); list.replaceChildren(); if (more) more.hidden = true;
            document.querySelectorAll('[data-sort]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.sort === 'new')));
            addIdea(data.idea, true); loadIdeas();
          } else { addIdea(data.idea, true); feedback(feedMessage, ''); }
          draft.clear(); feedback(message, 'Posted. Your idea is public.', 'success');
          const link = node('a', 'back-link', 'Open your idea →'); link.href = `/i/${encodeURIComponent(data.idea.id)}`; message.append(document.createTextNode(' '), link);
        } catch (error) { feedback(message, error.message, 'error'); }
        finally { formBusy(form, false); }
      });
    }
    loadIdeas(true);
  }
})();
