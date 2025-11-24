const fs = require('fs');
const path = require('path');

// Build-time config writer for Netlify. Writes `js/config.js` that the
// frontend reads to obtain `window.API_BASE_URL`.

const apiBase = process.env.API_BASE_URL || '';
const outPath = path.join(__dirname, '..', 'js', 'config.js');

const content = `/* Auto-generated — do not commit secrets into repo */\n` +
  `window.API_BASE_URL = ${JSON.stringify(apiBase)};\n` +
  `try { console.info('runtime: API_BASE_URL =', window.API_BASE_URL); } catch(e){}\n`;

try {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  console.log('Wrote', outPath, 'with API_BASE_URL =', apiBase);
  process.exit(0);
} catch (err) {
  console.error('Failed to write config file', err);
  process.exit(2);
}
