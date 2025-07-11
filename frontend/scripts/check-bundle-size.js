#!/usr/bin/env node

// Bundle Size Checker Script
const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

// Configuration
const config = {
  distPath: path.join(__dirname, '../dist'),
  maxSizes: {
    js: {
      total: 500 * 1024, // 500 KB total JS
      main: 200 * 1024, // 200 KB main bundle
      vendor: 300 * 1024, // 300 KB vendor chunks
      chunk: 50 * 1024, // 50 KB per lazy chunk
    },
    css: {
      total: 100 * 1024, // 100 KB total CSS
      main: 50 * 1024, // 50 KB main CSS
      chunk: 20 * 1024, // 20 KB per CSS chunk
    },
    images: {
      total: 2 * 1024 * 1024, // 2 MB total images
      individual: 500 * 1024, // 500 KB per image
    },
  },
};

// Helper functions
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return gzipSync(content).length;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${kb.toFixed(2)} KB`;
}

function getColorForRatio(ratio) {
  if (ratio < 0.7) return '\x1b[32m'; // Green
  if (ratio < 0.9) return '\x1b[33m'; // Yellow
  return '\x1b[31m'; // Red
}

// Analyze bundle sizes
function analyzeBundle() {
  console.log('🔍 Analyzing bundle sizes...\n');

  const results = {
    js: { files: [], total: 0, gzipTotal: 0 },
    css: { files: [], total: 0, gzipTotal: 0 },
    images: { files: [], total: 0 },
    other: { files: [], total: 0 },
  };

  // Walk through dist directory
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        const ext = path.extname(file).toLowerCase();
        const size = getFileSize(filePath);
        const relPath = path.relative(config.distPath, filePath);
        
        if (ext === '.js') {
          const gzipSize = getGzipSize(filePath);
          results.js.files.push({ path: relPath, size, gzipSize });
          results.js.total += size;
          results.js.gzipTotal += gzipSize;
        } else if (ext === '.css') {
          const gzipSize = getGzipSize(filePath);
          results.css.files.push({ path: relPath, size, gzipSize });
          results.css.total += size;
          results.css.gzipTotal += gzipSize;
        } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif'].includes(ext)) {
          results.images.files.push({ path: relPath, size });
          results.images.total += size;
        } else {
          results.other.files.push({ path: relPath, size });
          results.other.total += size;
        }
      }
    });
  }

  if (!fs.existsSync(config.distPath)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  walkDir(config.distPath);

  // Print JavaScript bundles
  console.log('📦 JavaScript Bundles:');
  console.log('─'.repeat(80));
  
  results.js.files.sort((a, b) => b.size - a.size).forEach((file) => {
    const ratio = file.size / config.maxSizes.js.chunk;
    const color = getColorForRatio(ratio);
    const isMain = file.path.includes('index') || file.path.includes('main');
    const maxSize = isMain ? config.maxSizes.js.main : config.maxSizes.js.chunk;
    
    console.log(
      `${color}${file.path.padEnd(50)}${'\x1b[0m'} ` +
      `${formatSize(file.size).padStart(10)} ` +
      `(gzip: ${formatSize(file.gzipSize).padStart(10)}) ` +
      `${file.size > maxSize ? '⚠️  EXCEEDS LIMIT' : '✅'}`
    );
  });
  
  const jsRatio = results.js.total / config.maxSizes.js.total;
  const jsColor = getColorForRatio(jsRatio);
  console.log('─'.repeat(80));
  console.log(
    `${jsColor}Total JS: ${formatSize(results.js.total)}${'\x1b[0m'} ` +
    `(gzip: ${formatSize(results.js.gzipTotal)}) ` +
    `/ ${formatSize(config.maxSizes.js.total)} ` +
    `${results.js.total > config.maxSizes.js.total ? '❌' : '✅'}`
  );

  // Print CSS bundles
  console.log('\n💅 CSS Bundles:');
  console.log('─'.repeat(80));
  
  results.css.files.sort((a, b) => b.size - a.size).forEach((file) => {
    const ratio = file.size / config.maxSizes.css.chunk;
    const color = getColorForRatio(ratio);
    const isMain = file.path.includes('index') || file.path.includes('main');
    const maxSize = isMain ? config.maxSizes.css.main : config.maxSizes.css.chunk;
    
    console.log(
      `${color}${file.path.padEnd(50)}${'\x1b[0m'} ` +
      `${formatSize(file.size).padStart(10)} ` +
      `(gzip: ${formatSize(file.gzipSize).padStart(10)}) ` +
      `${file.size > maxSize ? '⚠️  EXCEEDS LIMIT' : '✅'}`
    );
  });
  
  const cssRatio = results.css.total / config.maxSizes.css.total;
  const cssColor = getColorForRatio(cssRatio);
  console.log('─'.repeat(80));
  console.log(
    `${cssColor}Total CSS: ${formatSize(results.css.total)}${'\x1b[0m'} ` +
    `(gzip: ${formatSize(results.css.gzipTotal)}) ` +
    `/ ${formatSize(config.maxSizes.css.total)} ` +
    `${results.css.total > config.maxSizes.css.total ? '❌' : '✅'}`
  );

  // Print images
  if (results.images.files.length > 0) {
    console.log('\n🖼️  Images:');
    console.log('─'.repeat(80));
    
    results.images.files
      .sort((a, b) => b.size - a.size)
      .slice(0, 10) // Show top 10 largest images
      .forEach((file) => {
        const ratio = file.size / config.maxSizes.images.individual;
        const color = getColorForRatio(ratio);
        
        console.log(
          `${color}${file.path.padEnd(50)}${'\x1b[0m'} ` +
          `${formatSize(file.size).padStart(10)} ` +
          `${file.size > config.maxSizes.images.individual ? '⚠️  LARGE IMAGE' : '✅'}`
        );
      });
    
    if (results.images.files.length > 10) {
      console.log(`... and ${results.images.files.length - 10} more images`);
    }
    
    const imgRatio = results.images.total / config.maxSizes.images.total;
    const imgColor = getColorForRatio(imgRatio);
    console.log('─'.repeat(80));
    console.log(
      `${imgColor}Total Images: ${formatSize(results.images.total)}${'\x1b[0m'} ` +
      `/ ${formatSize(config.maxSizes.images.total)} ` +
      `${results.images.total > config.maxSizes.images.total ? '❌' : '✅'}`
    );
  }

  // Summary
  const totalSize = results.js.total + results.css.total + results.images.total + results.other.total;
  const totalGzipSize = results.js.gzipTotal + results.css.gzipTotal;
  
  console.log('\n📊 Summary:');
  console.log('─'.repeat(80));
  console.log(`Total Bundle Size: ${formatSize(totalSize)}`);
  console.log(`Total Gzipped Size: ${formatSize(totalGzipSize)}`);
  console.log(`Files: ${
    results.js.files.length + results.css.files.length + 
    results.images.files.length + results.other.files.length
  }`);
  console.log(`JS Chunks: ${results.js.files.length}`);
  console.log(`CSS Chunks: ${results.css.files.length}`);
  console.log(`Images: ${results.images.files.length}`);

  // Generate report file
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSize,
      totalGzipSize,
      jsSize: results.js.total,
      cssSize: results.css.total,
      imageSize: results.images.total,
    },
    details: results,
    limits: config.maxSizes,
  };

  fs.writeFileSync(
    path.join(config.distPath, 'bundle-size-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Detailed report saved to: dist/bundle-size-report.json');

  // Exit with error if limits exceeded
  const hasError = 
    results.js.total > config.maxSizes.js.total ||
    results.css.total > config.maxSizes.css.total ||
    results.images.total > config.maxSizes.images.total;

  if (hasError) {
    console.log('\n❌ Bundle size limits exceeded!');
    process.exit(1);
  } else {
    console.log('\n✅ All bundle sizes within limits!');
  }
}

// Run analysis
analyzeBundle();