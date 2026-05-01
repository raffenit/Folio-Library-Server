const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 80;
const STATIC_DIR = '/usr/share/nginx/html';

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found - serve index.html for SPA routing
        fs.readFile(path.join(STATIC_DIR, 'index.html'), (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }

    const headers = { 'Content-Type': contentType };
    if (ext.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$/)) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    res.writeHead(200, headers);
    res.end(data);
  });
}

function handleProxy(req, res) {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let targetUrl = parsedUrl.searchParams.get('url');

  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  // Double-decode in case URL got double-encoded
  if (targetUrl.includes('%3A') || targetUrl.includes('%2F')) {
    targetUrl = decodeURIComponent(targetUrl);
  }

  console.log(`[Proxy] ${req.method} ${targetUrl}`);
  console.log(`[Proxy] Incoming headers:`, JSON.stringify(req.headers, null, 2));

  const target = url.parse(targetUrl);
  const isHttps = target.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: target.path,
    method: req.method,
    headers: {
      ...req.headers,
      host: target.host,
    },
  };

  // Clean up headers that might cause issues
  delete options.headers['accept-encoding'];
  delete options.headers['connection'];
  delete options.headers['origin'];
  delete options.headers['referer'];
  
  console.log(`[Proxy] Outgoing headers to target:`, JSON.stringify(options.headers, null, 2));

  const proxyReq = transport.request(options, (proxyRes) => {
    // Add CORS headers
    const headers = {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    // Log non-200 responses for debugging
    if (proxyRes.statusCode >= 400) {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        console.error(`[Proxy Error] ${proxyRes.statusCode} from ${targetUrl}`);
        console.error(`[Proxy Error] Response: ${body.substring(0, 500)}`);
        res.writeHead(proxyRes.statusCode, headers);
        res.end(body);
      });
    } else {
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy Error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy failed', message: err.message }));
  });

  req.pipe(proxyReq);
}

function handleOptions(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Length': 0,
  });
  res.end();
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  // Handle proxy requests
  if (parsedUrl.pathname === '/proxy' || parsedUrl.pathname === '/dynamic-proxy') {
    handleProxy(req, res);
    return;
  }

  // Serve static files
  let filePath = path.join(STATIC_DIR, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving static files from ${STATIC_DIR}`);
});
