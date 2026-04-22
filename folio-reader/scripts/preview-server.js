#!/usr/bin/env node
/**
 * Dev proxy server — serves dist/ and proxies /api/* to your Kavita instance.
 * Avoids CORS entirely: the browser only talks to localhost.
 *
 * Usage:
 *   node scripts/preview-server.js 
 *   KAVITA_URL=http://100.x.x.x:8050 node scripts/preview-server.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3000;

// --- NEW ENV PARSING LOGIC ---
function getEnvKavitaUrl() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    // Look for EXPO_PUBLIC_KAVITA_URL in the file
    const match = envContent.match(/^EXPO_PUBLIC_KAVITA_URL=(.*)$/m);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

// Priority: Command line arg > Environment Var > .env file
let kavitaUrl = process.argv[2] || process.env.KAVITA_URL || getEnvKavitaUrl();

if (!kavitaUrl) {
  console.log('\n  [!] Warning: No KAVITA_URL or EXPO_PUBLIC_KAVITA_URL set.');
  console.log('      /api/* proxy will be disabled, but /proxy dynamic mode is available.');
  kavitaUrl = 'http://localhost:8050'; // dummy default
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
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
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
  const dynamicTarget = req.headers['x-folio-proxy-target'];
  const targetToUse = dynamicTarget ? dynamicTarget.replace(/\/$/, '') : kavitaUrl.replace(/\/$/, '');
  const isImageRequest = req.url.includes('/api/image/');
  
  try {
    const targetUrl = new URL(targetToUse);
    const options = {
      hostname: targetUrl.hostname,
      port: Number(targetUrl.port) || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: req.url,
      method: req.method,
      headers: { ...req.headers },
    };

    // Clean up headers for the upstream request
    delete options.headers['host'];
    delete options.headers['accept-encoding'];
    delete options.headers['x-folio-proxy-target'];
    options.headers.host = targetUrl.host;

    // Force Kavita not to serve cached images
    if (isImageRequest) {
      options.headers['cache-control'] = 'no-cache';
      options.headers['pragma'] = 'no-cache';
    }

    const transport = targetUrl.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      // Inject CORS headers
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] = '*';

      // Strip cache headers for images so the browser always re-fetches
      if (isImageRequest) {
        headers['cache-control'] = 'no-store, no-cache, must-revalidate';
        headers['pragma'] = 'no-cache';
        delete headers['etag'];
        delete headers['last-modified'];
        console.log(`[proxy-image] ${proxyRes.statusCode} ${req.url} (via ${targetToUse})`);
      } else {
        console.log(`[proxy-api] ${req.method} ${proxyRes.statusCode} ${req.url} (via ${targetToUse})`);
      }
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[proxy error to ${targetToUse}]`, err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(`Proxy error: ${err.message}`);
      }
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error(`[proxy config error]`, err.message);
    res.writeHead(400);
    res.end(`Invalid target URL: ${targetToUse}`);
  }
}

// Fetch a URL, following redirects, and return a full data URL
function fetchDataUrl(imageUrl, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = imageUrl.startsWith('https') ? https : http;
    const req = mod.get(imageUrl, { headers: { 'User-Agent': 'KavitaReader/1.0' } }, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        console.log(`[cover-proxy] redirect ${res.statusCode} → ${res.headers.location}`);
        res.resume(); // drain
        resolve(fetchDataUrl(res.headers.location, redirectCount + 1));
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`Image fetch returned ${res.statusCode}`));
        return;
      }
      const contentType = res.headers['content-type'] || 'image/jpeg';
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const b64 = Buffer.concat(chunks).toString('base64');
        resolve(`data:${contentType};base64,${b64}`);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// POST /cover-proxy — fetch image server-side, upload to Kavita
function handleCoverProxy(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { seriesId, imageUrl, token } = JSON.parse(body);
      console.log(`[cover-proxy] seriesId=${seriesId} imageUrl=${imageUrl}`);

      const dataUrl = await fetchDataUrl(imageUrl);
      const mimeSnip = dataUrl.substring(0, 40);
      const totalKB = Math.round(Buffer.byteLength(dataUrl) / 1024);
      console.log(`[cover-proxy] fetched image: ${mimeSnip}… (${totalKB} KB)`);

      // Kavita expects raw base64, not a data URL
      const rawBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      const payload = JSON.stringify({ id: seriesId, url: rawBase64 });
      const payloadKB = Math.round(Buffer.byteLength(payload) / 1024);
      console.log(`[cover-proxy] sending to Kavita: ${payloadKB} KB payload`);

      const options = {
        hostname: target.hostname,
        port: Number(target.port) || (target.protocol === 'https:' ? 443 : 80),
        path: '/api/Upload/series',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const transport = target.protocol === 'https:' ? https : http;
      const proxyReq = transport.request(options, (proxyRes) => {
        let respBody = '';
        proxyRes.on('data', c => { respBody += c; });
        proxyRes.on('end', () => {
          console.log(`[cover-proxy] Kavita responded: ${proxyRes.statusCode} — ${respBody.substring(0, 200)}`);
          const ok = proxyRes.statusCode >= 200 && proxyRes.statusCode < 300;
          res.writeHead(ok ? 200 : proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: proxyRes.statusCode,
            ok,
            body: respBody,
          }));
        });
      });
      proxyReq.on('error', (err) => {
        console.error('[cover-proxy] request error:', err.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });
      proxyReq.write(payload);
      proxyReq.end();
    } catch (e) {
      console.error('[cover-proxy] exception:', e.message);
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// GET /openlibrary-proxy?url=... — fetch any openlibrary URL server-side, following redirects
function handleOpenLibraryProxy(req, res, targetUrl, redirectCount = 0) {
  if (!targetUrl) {
    const parsed = new URL(req.url, 'http://localhost');
    targetUrl = parsed.searchParams.get('url');
  }
  if (!targetUrl || !targetUrl.startsWith('https://')) {
    res.writeHead(400); res.end(JSON.stringify({ error: 'Missing or invalid url param' })); return;
  }
  if (redirectCount > 5) { res.writeHead(502); res.end(JSON.stringify({ error: 'Too many redirects' })); return; }
  console.log(`[ol-proxy] fetching: ${targetUrl}`);
  https.get(targetUrl, { headers: { 'User-Agent': 'KavitaReader/1.0' } }, (upstream) => {
    if ((upstream.statusCode === 301 || upstream.statusCode === 302 || upstream.statusCode === 307 || upstream.statusCode === 308) && upstream.headers.location) {
      console.log(`[ol-proxy] redirect → ${upstream.headers.location}`);
      upstream.resume();
      handleOpenLibraryProxy(req, res, upstream.headers.location, redirectCount + 1);
      return;
    }
    const ct = upstream.headers['content-type'] || 'application/octet-stream';
    res.writeHead(upstream.statusCode, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
    upstream.pipe(res);
  }).on('error', (err) => {
    console.error('[ol-proxy] error:', err.message);
    if (!res.headersSent) { res.writeHead(502); res.end(JSON.stringify({ error: err.message })); }
  });
}

// POST /abs-cover-proxy — fetch image server-side, upload to Audiobookshelf via multipart
function handleABSCoverProxy(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { itemId, imageUrl, absUrl, token } = JSON.parse(body);
      console.log(`[abs-cover-proxy] itemId=${itemId} absUrl=${absUrl} imageUrl=${imageUrl?.substring(0, 80)}...`);

      if (!absUrl) {
        throw new Error('Missing absUrl parameter');
      }

      // Fetch the image as binary (or extract from data URL)
      let imageBuffer;
      let contentType = 'image/jpeg';
      let extension = 'jpg';

      if (imageUrl.startsWith('data:')) {
        // Handle data URL (base64 encoded image)
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          throw new Error('Invalid data URL format');
        }
        contentType = match[1] || 'image/jpeg';
        // Extract extension from content type
        const ctLower = contentType.toLowerCase();
        if (ctLower.includes('webp')) extension = 'webp';
        else if (ctLower.includes('png')) extension = 'png';
        else if (ctLower.includes('gif')) extension = 'gif';
        else if (ctLower.includes('bmp')) extension = 'bmp';
        const base64Data = match[2];
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`[abs-cover-proxy] extracted from data URL: ${Math.round(imageBuffer.length / 1024)} KB, type: ${contentType}, ext: ${extension}`);
      } else {
        // Fetch HTTP(S) URL
        imageBuffer = await fetchImageBuffer(imageUrl);
        console.log(`[abs-cover-proxy] fetched image: ${Math.round(imageBuffer.length / 1024)} KB`);

        // Detect content type from URL or default to jpeg
        const urlLower = imageUrl.toLowerCase();
        if (urlLower.endsWith('.webp')) { contentType = 'image/webp'; extension = 'webp'; }
        else if (urlLower.endsWith('.png')) { contentType = 'image/png'; extension = 'png'; }
        else if (urlLower.endsWith('.gif')) { contentType = 'image/gif'; extension = 'gif'; }
        else if (urlLower.endsWith('.bmp')) { contentType = 'image/bmp'; extension = 'bmp'; }
      }

      // Build multipart/form-data payload
      const boundary = '----FolioFormBoundary' + Math.random().toString(36).substring(2);
      const preAmble = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="cover"; filename="cover.${extension}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
      );
      const postAmble = Buffer.from(`\r\n--${boundary}--\r\n`);
      const payload = Buffer.concat([preAmble, imageBuffer, postAmble]);

      const absTarget = new URL(absUrl.replace(/\/$/, ''));
      const options = {
        hostname: absTarget.hostname,
        port: Number(absTarget.port) || (absTarget.protocol === 'https:' ? 443 : 80),
        path: `/api/items/${itemId}/cover?token=${token}`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
        },
      };

      const transport = absTarget.protocol === 'https:' ? https : http;
      const proxyReq = transport.request(options, (proxyRes) => {
        let respBody = '';
        proxyRes.on('data', c => { respBody += c; });
        proxyRes.on('end', () => {
          console.log(`[abs-cover-proxy] ABS responded: ${proxyRes.statusCode} — ${respBody.substring(0, 200)}`);
          const ok = proxyRes.statusCode >= 200 && proxyRes.statusCode < 300;
          res.writeHead(ok ? 200 : proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: proxyRes.statusCode,
            ok,
            body: respBody,
          }));
        });
      });

      proxyReq.on('error', (err) => {
        console.error('[abs-cover-proxy] request error:', err.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(payload);
      proxyReq.end();
    } catch (e) {
      console.error('[abs-cover-proxy] exception:', e.message, e.stack);
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message, stack: e.stack }));
    }
  });
}

// Helper to fetch image as binary buffer
function fetchImageBuffer(imageUrl, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = imageUrl.startsWith('https') ? https : http;
    const req = mod.get(imageUrl, { headers: { 'User-Agent': 'Folio/1.0' } }, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        res.resume();
        resolve(fetchImageBuffer(res.headers.location, redirectCount + 1));
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`Image fetch returned ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

function dynamicProxy(req, res) {
  console.log(`[dynamic-proxy] Received request: ${req.url}`);
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let targetParam = parsedUrl.searchParams.get('url');
  console.log(`[dynamic-proxy] Extracted targetParam: ${targetParam}`);
  
  if (!targetParam) {
    console.log(`[dynamic-proxy] ERROR: Missing url parameter`);
    res.writeHead(400);
    res.end('Missing url parameter for proxy');
    return;
  }

  // Ensure target has protocol
  if (!/^https?:\/\//i.test(targetParam)) targetParam = 'http://' + targetParam;
  const targetUrl = new URL(targetParam);
  
  const options = {
    hostname: targetUrl.hostname,
    port: Number(targetUrl.port) || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: { ...req.headers },
  };
  
  // Hardening: Set a real-looking User-Agent if not provided
  if (!options.headers['user-agent']) {
    options.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Folio/1.0';
  }

  // Stop headers that interfere with proxying or trigger anti-bot protections
  delete options.headers['accept-encoding'];
  delete options.headers['connection'];
  delete options.headers['host'];
  
  // Only strip sensitive headers for external APIs (like Google Books)
  // Local servers (ABS/Kavita) may actually need these or at least shouldn't mind them.
  const isExternal = targetUrl.hostname.includes('google') || targetUrl.hostname.includes('openlibrary');
  if (isExternal) {
    delete options.headers['referer'];
    delete options.headers['origin'];
    delete options.headers['cookie']; // Never pass local cookies to external APIs
  }
  
  options.headers.host = targetUrl.host;

  console.log(`[dynamic-proxy] ${req.method} ${targetParam}`);

  const transport = targetUrl.protocol === 'https:' ? https : http;
  const proxyReq = transport.request(options, (proxyRes) => {
    // Forward the status code and headers, allowing CORS
    const headers = { ...proxyRes.headers };
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = '*';
    
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[proxy error to ${targetParam}]`, err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(`Proxy error: ${err.message}`);
    }
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = req.url.split('?')[0];
  console.log(`[server] ${req.method} ${req.url} -> urlPath: ${urlPath}`);

  if (urlPath === '/proxy' || urlPath.startsWith('/proxy?')) {
    console.log('[server] Routing to dynamicProxy');
    dynamicProxy(req, res);
  } else if (req.url === '/cover-proxy' && req.method === 'POST') {
    console.log('[server] Routing to cover-proxy');
    handleCoverProxy(req, res);
  } else if (req.url === '/abs-cover-proxy' && req.method === 'POST') {
    console.log('[server] Routing to abs-cover-proxy');
    handleABSCoverProxy(req, res);
  } else if (req.url.startsWith('/openlibrary-proxy')) {
    console.log('[server] Routing to openlibrary-proxy');
    handleOpenLibraryProxy(req, res, null);
  } else if (req.url.startsWith('/api/')) {
    // Legacy fixed proxy for backwards compatibility
    console.log('[server] Routing to legacy proxy');
    proxyRequest(req, res);
  } else {
    console.log('[server] Routing to serveStatic');
    serveStatic(req, res);
  }
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n  Folio Preview Server (Universal Proxy Mode)`);
    console.log(`  -------------------------------------------`);
    console.log(`  Preview:  http://localhost:${port}`);
    console.log(`  Default:  /api/* → ${kavitaUrl}`);
    console.log(`  Dynamic:  /proxy?url=<any-url>\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  [!] Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err.message);
    }
  });
}

startServer(PORT);
