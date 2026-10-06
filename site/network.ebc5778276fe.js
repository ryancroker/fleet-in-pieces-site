(() => {
  'use strict';
  // Background refreshes stop after five quiet minutes, or immediately when
  // hidden. A real return/interaction resumes them without a page reload.
  let lastInteraction = Date.now();
  window.FleetActive = () => !document.hidden && Date.now() - lastInteraction < 300000;
  function resume() {
    lastInteraction = Date.now();
    window.dispatchEvent(new Event('fleet:resume'));
  }
  for (const type of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(type, event => {
    if (!event.isTrusted || document.hidden) return;
    const wasIdle = !window.FleetActive();
    lastInteraction = Date.now();
    if (wasIdle) resume();
  }, {passive:true});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
  // Community, register and profile requests share the first cookie-setting response.
  // Starting several anonymous identities at once can otherwise lose a visitor's vote.
  let firstRequest;
  window.FleetRequest = async (path, options = {}) => {
    let release;
    if (firstRequest) await firstRequest;
    else firstRequest = new Promise(resolve => { release = resolve; });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(path, {credentials:'same-origin',cache:'no-store',...options,
        headers:{...(options.body ? {'Content-Type':'application/json'} : {}),...(options.headers || {})},signal:controller.signal});
      let data;
      try { data = await response.json(); }
      catch { throw new Error('The fleet desk is temporarily unavailable. Please try again. Your draft stays here.'); }
      if (!response.ok) {
        if(data.error==='community_read_only')window.dispatchEvent(new Event('fleet:read-only'));
        let message = data.message || 'That request did not go through. Please try again.';
        const retry = Number(response.headers.get('Retry-After'));
        if (response.status === 429 && retry > 0) message += ` Try again in about ${Math.ceil(retry / 60)} minute${retry > 60 ? 's' : ''}.`;
        const error = new Error(message); error.status = response.status; error.code = data.error; throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The connection took too long. Your draft stays here; retry to confirm whether it was posted.');
      if (error instanceof TypeError) throw new Error('Could not reach the fleet. Check your connection and try again. Your draft stays here.');
      throw error;
    } finally { clearTimeout(timeout); if (release) release(); }
  };
})();
