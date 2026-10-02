(() => {
  'use strict';
  const config = window.FLEET_CONFIG || {};
  function httpsUrl(value, hosts) {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && (!hosts || hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) ? url.href : '';
    } catch { return ''; }
  }
  const steam = httpsUrl(config.STEAM_URL, ['store.steampowered.com']);
  if (steam) {
    document.querySelectorAll('[data-steam], [data-steam-direct]').forEach(link => { link.href = steam; link.textContent = 'Wishlist on Steam'; link.hidden = false; });
    document.querySelectorAll('[data-steam-note]').forEach(node => { node.textContent = 'Wishlist it. Future you has a fleet to preserve.'; });
    const title = document.querySelector('#steam-title');
    if (title) title.textContent = 'The Steam page is live.';
    document.querySelectorAll('[data-steam-description]').forEach(node => { node.textContent = 'Add Fleet in Pieces to your Steam wishlist and follow development there. The game is still in development.'; });
  }
  const hosts = { TIKTOK_URL: ['tiktok.com'], YOUTUBE_URL: ['youtube.com', 'youtu.be'], STEAM_URL: ['store.steampowered.com'] };
  document.querySelectorAll('[data-social]').forEach(link => {
    const key = link.dataset.social;
    // A failed config request preserves the working static TikTok link.
    if (!(key in config)) return;
    const url = httpsUrl(config[key], hosts[key]);
    link.hidden = !url;
    if (url) link.href = url;
  });
  if (typeof config.CONTACT_EMAIL === 'string' && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(config.CONTACT_EMAIL) && !/[?&#\r\n]/.test(config.CONTACT_EMAIL)) {
    document.querySelectorAll('[data-contact]').forEach(link => { link.href = 'mailto:' + config.CONTACT_EMAIL; link.hidden = false; });
    document.querySelectorAll('[data-contact-placeholder]').forEach(node => { node.hidden = true; });
  }
  const videos = [...document.querySelectorAll('video[data-loop]')];
  if (!videos.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 600px)');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const state = new Map(videos.map(video => [video, { visible: false, manuallyPaused: false, manualPlay: false }]));
  const mayAutoplay = () => !reduced.matches && !narrow.matches && !connection?.saveData && !/^(slow-2g|2g|3g)$/.test(connection?.effectiveType || '');
  function pauseOthers(current) { videos.forEach(video => { if (video !== current && !video.paused) video.pause(); }); }
  function play(video) { pauseOthers(video); video.play().catch(() => {}); }
  function refresh() {
    if (document.hidden) { videos.forEach(video => video.pause()); return; }
    // Only the hero autoplays. All feature clips remain explicit choices.
    const hero = videos.find(video => video.dataset.auto === 'hero');
    if (!hero) return;
    const s = state.get(hero);
    if (s.visible && !s.manuallyPaused && mayAutoplay() && !videos.some(v => v !== hero && !v.paused)) play(hero);
    else if (!s.visible || (!mayAutoplay() && !s.manualPlay)) hero.pause();
  }
  videos.forEach(video => {
    const control = document.querySelector(`button[aria-controls="${video.id}"]`);
    if (control) {
      control.hidden = false;
      control.addEventListener('click', () => {
        const s = state.get(video);
        if (video.paused) { s.manuallyPaused = false; s.manualPlay = true; play(video); }
        else { s.manuallyPaused = true; s.manualPlay = false; video.pause(); }
      });
      video.controls = false;
    }
    // Native controls remain as a progressive-enhancement fallback if JS fails.
    video.addEventListener('play', () => { pauseOthers(video); if (control) control.textContent = 'Pause footage'; });
    video.addEventListener('pause', () => { if (control) control.textContent = 'Play footage'; });
    video.addEventListener('error', () => { if (video.closest('.wide-hero')) return; if (control) { control.textContent = 'Clip unavailable'; control.disabled = true; } });
  });
  const hero = document.querySelector('#hero-video');
  const localAsset = value => typeof value === 'string' && /^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..');
  if (hero && localAsset(config.HERO_WIDE_VIDEO) && localAsset(config.HERO_WIDE_POSTER)) {
    // If the optional file fails, restore the complete included hero.
    const originalSource = hero.querySelector('source').getAttribute('src');
    const originalPoster = hero.getAttribute('poster');
    hero.addEventListener('error', () => { hero.src = originalSource; hero.poster = originalPoster; hero.closest('.hero').classList.remove('wide-hero'); hero.load(); }, { once: true });
    hero.src = config.HERO_WIDE_VIDEO; hero.poster = config.HERO_WIDE_POSTER;
    hero.closest('.hero').classList.add('wide-hero');
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { const s = state.get(entry.target); s.visible = entry.isIntersecting; if (!s.visible) { entry.target.pause(); s.manualPlay = false; } });
      refresh();
    }, { threshold: .2 });
    videos.forEach(video => observer.observe(video));
  }
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', () => { if (reduced.matches) videos.forEach(video => { state.get(video).manualPlay = false; video.pause(); }); else refresh(); });
  narrow.addEventListener('change', refresh);
})();
