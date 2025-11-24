const serverless = require('serverless-http');
// Import the app exported by server.js
const mod = require('../../server');

// server.js exports the Express `app` as `app`.
const app = mod && (mod.app || mod.default || mod);

if (!app) {
  console.error('Netlify function wrapper: failed to import Express app from server.js');
  throw new Error('App import failed');
}

module.exports.handler = serverless(app);
