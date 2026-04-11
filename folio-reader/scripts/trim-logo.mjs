// scripts/trim-logo.mjs
// Removes artifact rows from tight-login-logo.png, re-trims, saves as login-logo.png

import { createReadStream, createWriteStream } from 'fs';
import { PNG } from '../node_modules/pngjs/lib/png.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT  = path.resolve(__dirname, '../assets/tight-login-logo.png');
const OUTPUT = path.resolve(__dirname, '../assets/login-logo.png');

const src = new PNG({ filterType: 4 });

createReadStream(INPUT)
  .pipe(src)
  .on('parsed', function () {
    const { width, height, data } = this;
    console.log(`Source: ${width}x${height}`);

    // Step 1: Zero out any rows that have fewer than 50 non-transparent pixels
    // (artifact line rows have only a handful of faint pixels, the book rows have hundreds)
    const ARTIFACT_THRESHOLD = 50;
    let erasedRows = 0;
    for (let y = 0; y < height; y++) {
      let visiblePixels = 0;
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) visiblePixels++;
      }
      if (visiblePixels > 0 && visiblePixels < ARTIFACT_THRESHOLD) {
        // Erase this row
        for (let x = 0; x < width; x++) {
          data[(y * width + x) * 4 + 3] = 0;
        }
        console.log(`  Erased artifact row y=${y} (${visiblePixels} px)`);
        erasedRows++;
      }
    }
    console.log(`Erased ${erasedRows} artifact rows.`);

    // Step 2: Find bounding box of remaining non-transparent content
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Add a small margin (2%)
    const margin = Math.round(Math.min(width, height) * 0.02);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width  - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);

    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;
    console.log(`Cropped output: ${newW}x${newH}`);

    // Step 3: Copy cropped region to new PNG
    const dst = new PNG({ width: newW, height: newH, filterType: 4 });
    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const si = ((y + minY) * width + (x + minX)) * 4;
        const di = (y * newW + x) * 4;
        dst.data[di]     = data[si];
        dst.data[di + 1] = data[si + 1];
        dst.data[di + 2] = data[si + 2];
        dst.data[di + 3] = data[si + 3];
      }
    }

    dst.pack().pipe(createWriteStream(OUTPUT))
      .on('finish', () => console.log('✅  Saved:', OUTPUT))
      .on('error', (e) => console.error('Write error:', e));
  })
  .on('error', (err) => {
    console.error('Parse error:', err.message);
    process.exit(1);
  });
