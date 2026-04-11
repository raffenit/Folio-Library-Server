// scripts/trim-logo.js  — CommonJS, no flags needed
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const INPUT  = path.resolve(__dirname, '../assets/login-logo-original.png');
const OUTPUT = path.resolve(__dirname, '../assets/login-logo.png');

const src = new PNG({ filterType: 4 });

fs.createReadStream(INPUT)
  .pipe(src)
  .on('parsed', function () {
    const { width, height, data } = this;
    console.log('Source: ' + width + 'x' + height);

    // Erase rows that have fewer than 50 non-transparent pixels (artifact lines)
    const THRESHOLD = 50;
    let erasedRows = 0;
    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) count++;
      }
      if (count > 0 && count < THRESHOLD) {
        for (let x = 0; x < width; x++) {
          data[(y * width + x) * 4 + 3] = 0;
        }
        console.log('  Erased row y=' + y + ' (' + count + ' px)');
        erasedRows++;
      }
    }
    console.log('Erased ' + erasedRows + ' artifact rows.');

    // Find tight bounding box
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

    const margin = Math.round(Math.min(width, height) * 0.03);
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width  - 1, maxX + margin);
    maxY = Math.min(height - 1, maxY + margin);

    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;
    console.log('Cropped: ' + newW + 'x' + newH);

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

    dst.pack().pipe(fs.createWriteStream(OUTPUT))
      .on('finish', function() { console.log('Done: ' + OUTPUT); })
      .on('error',  function(e) { console.error('Write error:', e.message); });
  })
  .on('error', function(err) {
    console.error('Parse error:', err.message);
    process.exit(1);
  });
