#!/usr/bin/env node

// Performance Check Script
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  buildDir: path.join(__dirname, '../dist'),
  performanceThresholds: {
    buildTime: 30000, // 30 seconds
    bundleSize: {
      js: 500 * 1024, // 500 KB
      css: 100 * 1024, // 100 KB
    },
    metrics: {
      lcp: 2500, // 2.5s
      fid: 100, // 100ms
      cls: 0.1, // 0.1
      ttfb: 800, // 800ms
    },
  },
};

// Helper functions
function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${kb.toFixed(2)} KB`;
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (e) {
    return 0;
  }
}

// Check build performance
async function checkBuildPerformance() {
  console.log('🏗️  Checking build performance...\n');

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  // Clean build directory
  if (fs.existsSync(config.buildDir)) {
    fs.rmSync(config.buildDir, { recursive: true, force: true });
  }

  // Measure build time
  const startTime = performance.now();
  
  try {
    console.log('Building project...');
    await execAsync('npm run build', { cwd: path.join(__dirname, '..') });
    
    const buildTime = performance.now() - startTime;
    const isWithinThreshold = buildTime <= config.performanceThresholds.buildTime;
    
    console.log(
      `\nBuild completed in: ${isWithinThreshold ? '✅' : '❌'} ${formatTime(buildTime)} ` +
      `(threshold: ${formatTime(config.performanceThresholds.buildTime)})`
    );

    return { buildTime, passed: isWithinThreshold };
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return { buildTime: 0, passed: false, error: error.message };
  }
}

// Analyze runtime performance
function analyzeRuntimePerformance() {
  console.log('\n🚀 Runtime Performance Analysis:\n');

  const statsFile = path.join(config.buildDir, 'stats.html');
  const bundleReport = path.join(config.buildDir, 'bundle-size-report.json');

  // Check if visualization exists
  if (fs.existsSync(statsFile)) {
    console.log(`📊 Bundle visualization available at: ${statsFile}`);
  }

  // Load bundle report if exists
  if (fs.existsSync(bundleReport)) {
    const report = JSON.parse(fs.readFileSync(bundleReport, 'utf-8'));
    
    console.log('\n📦 Bundle Analysis:');
    console.log('─'.repeat(50));
    console.log(`Total Size: ${formatSize(report.summary.totalSize)}`);
    console.log(`Gzipped Size: ${formatSize(report.summary.totalGzipSize)}`);
    console.log(`JavaScript: ${formatSize(report.summary.jsSize)}`);
    console.log(`CSS: ${formatSize(report.summary.cssSize)}`);
    console.log(`Images: ${formatSize(report.summary.imageSize)}`);
  }

  // Check index.html for performance hints
  const indexPath = path.join(config.buildDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    
    console.log('\n🔍 Performance Optimizations Found:');
    console.log('─'.repeat(50));
    
    // Check for preload/prefetch
    const preloadCount = (indexContent.match(/rel="preload"/g) || []).length;
    const prefetchCount = (indexContent.match(/rel="prefetch"/g) || []).length;
    console.log(`${preloadCount > 0 ? '✅' : '❌'} Preload hints: ${preloadCount}`);
    console.log(`${prefetchCount > 0 ? '✅' : '❌'} Prefetch hints: ${prefetchCount}`);
    
    // Check for async/defer scripts
    const asyncScripts = (indexContent.match(/script[^>]+async/g) || []).length;
    const deferScripts = (indexContent.match(/script[^>]+defer/g) || []).length;
    console.log(`${asyncScripts > 0 ? '✅' : '❌'} Async scripts: ${asyncScripts}`);
    console.log(`${deferScripts > 0 ? '✅' : '❌'} Deferred scripts: ${deferScripts}`);
    
    // Check for service worker
    const hasServiceWorker = indexContent.includes('serviceWorker');
    console.log(`${hasServiceWorker ? '✅' : '❌'} Service Worker: ${hasServiceWorker ? 'Yes' : 'No'}`);
  }
}

// Generate performance recommendations
function generateRecommendations() {
  console.log('\n💡 Performance Recommendations:\n');

  const recommendations = [];

  // Check for large bundles
  const jsFiles = fs.readdirSync(config.buildDir)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, size: getFileSize(path.join(config.buildDir, f)) }))
    .sort((a, b) => b.size - a.size);

  if (jsFiles.length > 0 && jsFiles[0].size > 200 * 1024) {
    recommendations.push({
      issue: 'Large JavaScript bundles detected',
      suggestion: 'Consider code splitting and lazy loading for better initial load performance',
      severity: 'high',
    });
  }

  // Check for too many chunks
  if (jsFiles.length > 20) {
    recommendations.push({
      issue: 'Too many JavaScript chunks',
      suggestion: 'Consider optimizing chunk splitting strategy to reduce HTTP requests',
      severity: 'medium',
    });
  }

  // Check for missing compression
  const hasGzFiles = fs.readdirSync(config.buildDir).some(f => f.endsWith('.gz'));
  const hasBrFiles = fs.readdirSync(config.buildDir).some(f => f.endsWith('.br'));
  
  if (!hasGzFiles && !hasBrFiles) {
    recommendations.push({
      issue: 'No compressed assets found',
      suggestion: 'Enable gzip/brotli compression in your build process',
      severity: 'high',
    });
  }

  // Display recommendations
  if (recommendations.length === 0) {
    console.log('✅ No major performance issues detected!');
  } else {
    recommendations.forEach((rec, index) => {
      const icon = rec.severity === 'high' ? '🔴' : '🟡';
      console.log(`${icon} ${index + 1}. ${rec.issue}`);
      console.log(`   → ${rec.suggestion}\n`);
    });
  }

  return recommendations;
}

// Generate performance report
function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    buildPerformance: results.buildPerformance,
    recommendations: results.recommendations,
    thresholds: config.performanceThresholds,
  };

  const reportPath = path.join(__dirname, '../performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Performance report saved to: ${reportPath}`);
}

// Main function
async function main() {
  console.log('🎯 Frontend Performance Check\n');
  console.log('=' .repeat(50));

  const results = {
    buildPerformance: await checkBuildPerformance(),
    recommendations: [],
  };

  if (results.buildPerformance.passed) {
    analyzeRuntimePerformance();
    results.recommendations = generateRecommendations();
  }

  generateReport(results);

  // Exit with appropriate code
  const hasErrors = !results.buildPerformance.passed || 
    results.recommendations.some(r => r.severity === 'high');

  if (hasErrors) {
    console.log('\n❌ Performance check failed!');
    process.exit(1);
  } else {
    console.log('\n✅ Performance check passed!');
    process.exit(0);
  }
}

// Run the check
main().catch(error => {
  console.error('❌ Error running performance check:', error);
  process.exit(1);
});