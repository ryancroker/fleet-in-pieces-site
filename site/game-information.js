// The public overview has no account, database, polling or analytics dependency.
// Pausing a clip when it leaves the page also keeps mobile playback quiet.
for (const video of document.querySelectorAll('video')) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
  });
}
