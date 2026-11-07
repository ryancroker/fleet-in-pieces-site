// External links are rendered into the public HTML by scripts/prepare-site.mjs.
// Prepare the site before committing; Cloudflare's build command remains blank.
window.FLEET_CONFIG = Object.freeze({
  SITE_URL: 'https://fleetinpieces.space',
  STEAM_URL: 'https://store.steampowered.com/app/5547060/Fleet_In_Pieces/',
  TIKTOK_URL: 'https://www.tiktok.com/@fleet_in_pieces',
  DISCORD_URL: 'https://discord.gg/ASV7xWfQQ2',
  QUARTERMASTER_URL: 'https://fleet-in-pieces-shop.fourthwall.com/products/first-it-was-a-ship-now-its-a-shirt',
  YOUTUBE_URL: '',
  CONTACT_EMAIL: '',
  // Optional clean landscape replacement. Leave blank to use the included portrait hero.
  // Example: '/assets/video/hero-loop-wide.mp4'; poster must also be supplied.
  HERO_WIDE_VIDEO: '',
  HERO_WIDE_POSTER: ''
});
