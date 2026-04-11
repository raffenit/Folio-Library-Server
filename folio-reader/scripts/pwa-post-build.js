#!/usr/bin/env node
/**
 * Post-build script: injects PWA meta tags into dist/index.html
 * and copies public/ files into dist/.
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const indexPath = path.join(distDir, 'index.html');

// --- Copy public/ → dist/ (recursive) ---
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${srcPath.replace(publicDir + path.sep, 'public/')} → dist/${destPath.replace(distDir + path.sep, '')}`);
    }
  }
}
copyDir(publicDir, distDir);

// --- Patch index.html ---
let html = fs.readFileSync(indexPath, 'utf8');

const pwaTags = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0d0d12" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Folio" />
    <link rel="apple-touch-icon" href="/assets/icon.png" />
    <style>
      html, body { background-color: #0d0d12; }
      body { margin: 0; padding: 0; }
    </style>`;

const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
      });
    }
  </script>`;

// Inject PWA tags before </head>
html = html.replace('</head>', `${pwaTags}\n  </head>`);

// Inject SW registration before </body>
html = html.replace('</body>', `${swScript}\n</body>`);

fs.writeFileSync(indexPath, html);
console.log('Patched dist/index.html with PWA meta tags and SW registration');
