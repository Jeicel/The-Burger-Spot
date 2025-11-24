/*
  API base URL for the backend API.
  - Leave as an empty string to use same-origin (e.g. when running frontend + backend together).
  - When frontend is hosted separately (Netlify), set this to your backend URL, e.g.
      window.API_BASE_URL = 'https://your-api.example.com';
*/
// Default: empty = same-origin. But when developing locally it's common to serve
// static files on a different port (e.g. Live Server on :5500) while the API
// runs on :5000. Detect that case and default API base to http://localhost:5000
// so fetch('/api/...') calls go to the running backend during local testing.
window.API_BASE_URL = window.API_BASE_URL || '';

try {
  const loc = window.location;
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (!window.API_BASE_URL && isLocal) {
    const protocol = loc.protocol === 'https:' ? 'https:' : 'http:';
    window.API_BASE_URL = `${protocol}//${loc.hostname}:5000`;
    console.info('js/config.js: auto-set API_BASE_URL to', window.API_BASE_URL);
  }
} catch (e) {
  // ignore in non-browser contexts
}

