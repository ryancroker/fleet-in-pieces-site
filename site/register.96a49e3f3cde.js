(() => {
  'use strict';
  async function api(path, data) {
    return window.FleetRequest(path, data === undefined ? {} : {method:'POST',body:JSON.stringify(data)});
  }
  function node(tag, className = '', value = '') { const element = document.createElement(tag); element.className = className; element.textContent = value; return element; }
  function message(element, value = '', error = false) { if (!element) return; element.textContent = value; element.dataset.error = String(error); }
  function updateNav(state) {
    for (const link of document.querySelectorAll('[data-register-link]')) {
      link.textContent = state.profile ? 'My service record' : 'Register / sign in'; link.href = state.profile?.path || '/register';
      if (document.body.hasAttribute('data-register-page') && state.profile) link.removeAttribute('aria-current');
    }
  }
  async function refreshSession() {
    window.FleetSession = api('/api/session');
    const state = await window.FleetSession;
    updateNav(state); window.dispatchEvent(new CustomEvent('fleet:session', { detail: state })); return state;
  }
  window.FleetSession ||= api('/api/session');
  window.FleetIdentity = { api, node, message, refreshSession, session: () => window.FleetSession };
  window.FleetSession.then(updateNav).catch(() => {});
  if (!document.body.hasAttribute('data-register-page')) return;

  const byId = id => document.getElementById(id);
  const feedback = byId('register-feedback');
  let busy = false, state = { profile: null, can_claim: false }, recoveryCode = '', recoveryCallsign = '';
  const date = value => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not used yet';
  function supported() {
    if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) {
      throw new Error('Passkeys need a supported browser on HTTPS. Open fleetinpieces.space in your browser. You can keep using the community without registering.');
    }
  }
  function decode(value) {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(raw, character => character.charCodeAt(0));
  }
  function encode(value) {
    if (value == null) return null;
    let raw = ''; for (const byte of new Uint8Array(value)) raw += String.fromCharCode(byte);
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function creationOptions(options) {
    if (typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function') return PublicKeyCredential.parseCreationOptionsFromJSON(options);
    return { ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) },
      excludeCredentials: (options.excludeCredentials || []).map(item => ({ ...item, id: decode(item.id) })) };
  }
  function requestOptions(options) {
    if (typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') return PublicKeyCredential.parseRequestOptionsFromJSON(options);
    return { ...options, challenge: decode(options.challenge),
      ...(options.allowCredentials ? { allowCredentials: options.allowCredentials.map(item => ({ ...item, id: decode(item.id) })) } : {}) };
  }
  function serialize(credential) {
    if (!credential) throw new Error('No passkey was selected. Please try again.');
    const response = credential.response;
    const data = { id: credential.id, rawId: encode(credential.rawId), type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      ...(credential.authenticatorAttachment ? { authenticatorAttachment: credential.authenticatorAttachment } : {}),
      response: { clientDataJSON: encode(response.clientDataJSON) } };
    if ('attestationObject' in response) {
      data.response.attestationObject = encode(response.attestationObject);
      if (typeof response.getTransports === 'function') data.response.transports = response.getTransports();
    } else {
      data.response.authenticatorData = encode(response.authenticatorData); data.response.signature = encode(response.signature);
      data.response.userHandle = encode(response.userHandle);
    }
    return data;
  }
  function friendly(error) {
    if (['NotAllowedError', 'AbortError'].includes(error?.name)) return 'The passkey request was cancelled or timed out. Nothing else is needed; you can try again.';
    if (error?.name === 'InvalidStateError') return 'This device already has that passkey. Try signing in, or choose another device to add a key.';
    if (error?.name === 'SecurityError') return 'Open https://fleetinpieces.space/register in your browser to use passkeys.';
    if (error?.name === 'NotSupportedError') return 'This device cannot create the required passkey. Try a current browser or another device.';
    return error?.message || 'That action could not be completed. Please try again.';
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll('button')].filter(button => !button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    message(feedback, 'Working…');
    try { await action(); }
    catch (error) { message(feedback, friendly(error), true); }
    finally { buttons.forEach(button => { if (button.isConnected) button.disabled = false; }); busy = false; }
  }
  function showRecovery(code, callsign) {
    recoveryCode = code; recoveryCallsign = callsign;
    byId('recovery-output').value = code; byId('recovery-result').hidden = false;
    message(byId('recovery-feedback'));
    byId('recovery-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearRecovery() {
    recoveryCode = ''; recoveryCallsign = ''; byId('recovery-output').value = ''; byId('recovery-result').hidden = true;
  }
  async function render(next) {
    state = next;
    byId('signed-in').hidden = !state.profile; byId('signed-out').hidden = Boolean(state.profile);
    updateNav(state);
    if (!state.profile) return;
    byId('signed-in-callsign').textContent = '@' + state.profile.callsign;
    byId('signed-in-rank').textContent = state.profile.rank + ' · Registered ' + date(state.profile.joined_at);
    byId('my-record').href = state.profile.path;
    byId('claim-existing').hidden = !state.can_claim;
    try { await loadPasskeys(); }
    catch (error) { byId('passkey-list').replaceChildren(node('li', '', friendly(error))); }
  }
  async function loadPasskeys() {
    const result = await api('/api/auth/passkeys'), list = byId('passkey-list'); list.replaceChildren();
    for (const key of result.passkeys) {
      const item = node('li', '', ''), details = node('div', '', '');
      details.append(node('strong', '', key.label), node('small', '', 'Added ' + date(key.created_at) + ' · Last used: ' + date(key.last_used_at)));
      const remove = node('button', '', 'Remove'); remove.type = 'button'; remove.disabled = result.passkeys.length < 2;
      remove.setAttribute('aria-label', 'Remove passkey ' + key.label);
      if (remove.disabled) remove.title = 'Keep at least one passkey.';
      remove.addEventListener('click', () => run(async () => {
        await api('/api/auth/passkeys/' + encodeURIComponent(key.id) + '/remove', {}); await loadPasskeys();
        message(feedback, 'Passkey removed. Existing signed-in sessions are unchanged.');
      }));
      item.append(details, remove); list.append(item);
    }
  }
  async function createPasskey(purpose, data, label) {
    supported();
    const start = await api('/api/auth/' + purpose + '/options', data);
    message(feedback, 'Follow your device’s passkey prompt.');
    const credential = await navigator.credentials.create({ publicKey: creationOptions(start.options) });
    message(feedback, 'Verifying your new passkey…');
    return api('/api/auth/' + purpose + '/verify', { challenge_id: start.challenge_id, credential: serialize(credential), ...(label ? { label } : {}) });
  }
  async function signIn() {
    supported();
    const start = await api('/api/auth/signin/options', {});
    message(feedback, 'Choose your passkey and verify on your device.');
    const credential = await navigator.credentials.get({ publicKey: requestOptions(start.options) });
    await api('/api/auth/signin/verify', { challenge_id: start.challenge_id, credential: serialize(credential) });
    await render(await refreshSession()); message(feedback, 'Signed in. Your fleet record is ready.');
  }
  byId('register-form').addEventListener('submit', event => {
    event.preventDefault(); run(async () => {
      const result = await createPasskey('register', { callsign: byId('callsign').value.trim(), claim_activity: byId('claim-on-register').checked, website: byId('register-website').value }, 'First passkey');
      showRecovery(result.recovery_code, result.profile.callsign);
      await render(await refreshSession()); message(feedback, 'Your fleet record is ready. Save the recovery code below.');
    });
  });
  byId('signin').addEventListener('click', () => run(signIn));
  byId('reauthenticate').addEventListener('click', () => run(signIn));
  byId('recover-form').addEventListener('submit', event => {
    event.preventDefault(); run(async () => {
      const callsign = byId('recover-callsign').value.trim(), code = byId('recover-code').value;
      byId('recover-code').value = '';
      const result = await createPasskey('recover', { callsign, recovery_code: code }, 'Recovered passkey');
      byId('recover-confirm').checked = false; showRecovery(result.recovery_code, result.profile.callsign);
      await render(await refreshSession()); message(feedback, 'Access restored. Old passkeys and sessions were removed. Save your replacement recovery code.');
    });
  });
  byId('add-passkey-form').addEventListener('submit', event => {
    event.preventDefault(); run(async () => { await createPasskey('passkeys', {}, byId('passkey-label').value.trim()); await loadPasskeys(); message(feedback, 'Your additional passkey is ready.'); });
  });
  byId('signout').addEventListener('click', () => run(async () => {
    await api('/api/auth/logout', {}); clearRecovery(); await render(await refreshSession()); message(feedback, 'Signed out. You can keep using the community anonymously.');
  }));
  byId('claim-form').addEventListener('submit', event => {
    event.preventDefault(); run(async () => { await api('/api/auth/claim', {}); byId('claim-confirm').checked = false; await render(await refreshSession()); message(feedback, 'This browser’s activity is now attached to your record.'); });
  });
  byId('rotate-recovery-form').addEventListener('submit', event => {
    event.preventDefault(); run(async () => {
      const result = await api('/api/auth/recovery/rotate', {}); byId('rotate-confirm').checked = false;
      showRecovery(result.recovery_code, result.profile.callsign); await render(await refreshSession());
      message(feedback, 'Your previous recovery code no longer works. Other sessions were signed out. Save the new code.');
    });
  });
  byId('copy-recovery').addEventListener('click', async () => {
    if (!recoveryCode) return;
    try { await navigator.clipboard.writeText(recoveryCode); message(byId('recovery-feedback'), 'Copied. Store it somewhere private.'); }
    catch { byId('recovery-output').focus(); byId('recovery-output').select(); message(byId('recovery-feedback'), 'Select and copy the code from the box above.'); }
  });
  byId('download-recovery').addEventListener('click', () => {
    if (!recoveryCode) return;
    const contents = 'Fleet in Pieces — private recovery code\n\nCallsign: ' + recoveryCallsign + '\nRecovery code: ' + recoveryCode +
      '\n\nKeep this file private and separate from your device. Anyone with this code and callsign can take over your record.\nUse only at https://fleetinpieces.space/register\nRecovery creates a new passkey, replaces all old passkeys and sessions, and issues a new code.\nThere is no email recovery if every passkey and this code are lost.\n';
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fleet-in-pieces-recovery.txt'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); message(byId('recovery-feedback'), 'Download requested. Keep the file private.');
  });
  byId('saved-recovery').addEventListener('click', () => { clearRecovery(); message(feedback, 'Recovery code cleared from this page. Keep your saved copy private.'); });
  window.addEventListener('pagehide', clearRecovery);
  window.FleetSession.then(async result => {
    await render(result); message(feedback);
    if (!result.profile && location.hash === '#return') byId('return').scrollIntoView({block:'start'});
  }).catch(error => {
    byId('signed-out').hidden = false; message(feedback, friendly(error), true);
  });
})();
