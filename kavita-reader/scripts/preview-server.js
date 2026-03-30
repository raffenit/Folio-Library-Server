#!/usr/bin/env node
/**
 * Dev proxy server — serves dist/ and proxies /api/* to your Kavita instance.
 * Avoids CORS entirely: the browser only talks to localhost.
 *
 * Usage:
 *   node scripts/preview-server.js http://100.x.x.x:5000
 *   KAVITA_URL=http://100.x.x.x:5000 node scripts/preview-server.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3000;

let kavitaUrl = process.argv[2] || process.env.KAVITA_URL || '';
if (!kavitaUrl) {
  console.error('\nUsage: node scripts/preview-server.js <kavita-url>');
  console.error('  e.g. node scripts/preview-server.js http://100.104.199.67:5000\n');
  process.exit(1);
}
if (!/^https?:\/\//i.test(kavitaUrl)) kavitaUrl = 'http://' + kavitaUrl;
const target = new URL(kavitaUrl.replace(/\/$/, ''));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Patch index.html once to inject proxy config
let indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const injection = `<script>window.__KAVITA_PROXY__=true;window.__KAVITA_URL__=${JSON.stringify(kavitaUrl)};</script>`;
indexHtml = indexHtml.replace('<head>', '<head>\n  ' + injection);

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(DIST, urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback — serve patched index.html
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
  }
}

function proxyRequest(req, res) {
  const options = {
    hostname: target.hostname,
    port: Number(target.port) || (target.protocol === 'https:' ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };
  delete options.headers['accept-encoding']; // avoid compressed responses we'd need to decompress

  const transport = target.protocol === 'https:' ? https : http;
  const proxyReq = transport.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('[proxy]', err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(`Proxy error: ${err.message}`);
    }
  });
  req.pipe(proxyReq);
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyRequest(req, res);
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, () => {
  console.log(`\n  Preview:  http://localhost:${PORT}`);
  console.log(`  Proxying: /api/* → ${kavitaUrl}\n`);
});
