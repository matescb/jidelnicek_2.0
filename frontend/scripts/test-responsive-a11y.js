#!/usr/bin/env node

/**
 * Comprehensive Responsive Design and Accessibility Test Runner
 * 
 * This script runs the full test suite for responsive design and accessibility,
 * generates detailed reports, and provides recommendations for improvements.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const config = {
  outputDir: path.join(__dirname, '..', 'test-reports'),
  coverageDir: path.join(__dirname, '..', 'coverage'),
  timeoutMs: 300000, // 5 minutes
  retries: 2,
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  ciMode: process.env.CI === 'true',
  browserstack: process.argv.includes('--browserstack'),
  skipPerformance: process.argv.includes('--skip-performance'),
  skipVisual: process.argv.includes('--skip-visual'),
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Utility functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const execCommand = (command, options = {}) => {
  if (config.verbose) {
    log(`Executing: ${command}`, 'cyan');
  }
  
  try {
    const result = execSync(command, {
      stdio: config.verbose ? 'inherit' : 'pipe',
      encoding: 'utf8',
      timeout: config.timeoutMs,
      ...options,
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || '',
    };
  }
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const writeReport = (filename, content) => {
  const filePath = path.join(config.outputDir, filename);
  fs.writeFileSync(filePath, typeof content === 'object' ? JSON.stringify(content, null, 2) : content);
  return filePath;
};

// Test runners
const testSuites = {
  responsive: {
    name: 'Responsive Design Tests',
    command: 'npm test src/__tests__/responsive/',
    weight: 30,
  },
  accessibility: {
    name: 'Accessibility Tests', 
    command: 'npm test src/__tests__/accessibility/',
    weight: 35,
  },
  mobile: {
    name: 'Mobile Interaction Tests',
    command: 'npm test src/__tests__/mobile/',
    weight: 20,
  },
  comprehensive: {
    name: 'Comprehensive Integration Tests',
    command: 'npm test src/__tests__/run-comprehensive-tests.ts',
    weight: 15,
  },
};

const performanceTests = {
  name: 'Performance Tests',
  command: 'npm test src/__tests__/performance/',
  weight: 10,
};

// Main test runner
async function runTestSuite() {
  log('🚀 Starting Comprehensive Responsive Design and Accessibility Test Suite', 'bold');
  log(`Platform: ${os.platform()} ${os.arch()}`, 'blue');
  log(`Node.js: ${process.version}`, 'blue');
  log(`CI Mode: ${config.ciMode ? 'Yes' : 'No'}`, 'blue');
  log('─'.repeat(80), 'blue');

  // Ensure output directories exist
  ensureDir(config.outputDir);
  ensureDir(config.coverageDir);

  const results = {
    timestamp: new Date().toISOString(),
    platform: `${os.platform()} ${os.arch()}`,
    nodeVersion: process.version,
    ciMode: config.ciMode,
    suites: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      coverage: null,
    },
    recommendations: [],
  };

  const startTime = Date.now();

  // Run core test suites
  for (const [key, suite] of Object.entries(testSuites)) {
    log(`\n📋 Running ${suite.name}...`, 'yellow');
    
    const suiteStartTime = Date.now();
    const result = execCommand(suite.command);
    const suiteDuration = Date.now() - suiteStartTime;

    results.suites[key] = {
      name: suite.name,
      success: result.success,
      duration: suiteDuration,
      weight: suite.weight,
      output: result.output,
      error: result.error,
    };

    if (result.success) {
      log(`✅ ${suite.name} passed (${suiteDuration}ms)`, 'green');
      results.summary.passed++;
    } else {
      log(`❌ ${suite.name} failed (${suiteDuration}ms)`, 'red');
      if (config.verbose && result.error) {
        log(`Error: ${result.error}`, 'red');
      }
      results.summary.failed++;
    }
    
    results.summary.total++;
  }

  // Run performance tests if not skipped
  if (!config.skipPerformance) {
    log(`\n⚡ Running ${performanceTests.name}...`, 'yellow');
    
    const perfStartTime = Date.now();
    const perfResult = execCommand(performanceTests.command);
    const perfDuration = Date.now() - perfStartTime;

    results.suites.performance = {
      name: performanceTests.name,
      success: perfResult.success,
      duration: perfDuration,
      weight: performanceTests.weight,
      output: perfResult.output,
      error: perfResult.error,
    };

    if (perfResult.success) {
      log(`✅ ${performanceTests.name} passed (${perfDuration}ms)`, 'green');
      results.summary.passed++;
    } else {
      log(`❌ ${performanceTests.name} failed (${perfDuration}ms)`, 'red');
      results.summary.failed++;
    }
    
    results.summary.total++;
  }

  // Run coverage analysis
  log('\n📊 Generating coverage report...', 'yellow');
  const coverageResult = execCommand('npm run test:coverage -- --reporter=json-summary');
  
  if (coverageResult.success) {
    try {
      const coveragePath = path.join(config.coverageDir, 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        results.summary.coverage = coverage.total;
        log('✅ Coverage report generated', 'green');
      }
    } catch (error) {
      log(`⚠️ Could not parse coverage report: ${error.message}`, 'yellow');
    }
  }

  results.summary.duration = Date.now() - startTime;

  // Generate recommendations
  generateRecommendations(results);

  // Write detailed report
  const reportPath = writeReport('responsive-a11y-report.json', results);
  const htmlReportPath = generateHtmlReport(results);

  // Display summary
  displaySummary(results);

  log(`\n📄 Detailed report saved to: ${reportPath}`, 'blue');
  log(`📄 HTML report saved to: ${htmlReportPath}`, 'blue');

  // Exit with appropriate code
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

function generateRecommendations(results) {
  const recommendations = [];

  // Coverage recommendations
  if (results.summary.coverage) {
    const coverage = results.summary.coverage;
    
    if (coverage.lines.pct < 80) {
      recommendations.push({
        type: 'coverage',
        priority: 'high',
        message: `Line coverage is ${coverage.lines.pct}% (target: 80%+). Add more unit tests.`,
        action: 'Increase test coverage for critical components',
      });
    }

    if (coverage.functions.pct < 80) {
      recommendations.push({
        type: 'coverage',
        priority: 'medium',
        message: `Function coverage is ${coverage.functions.pct}% (target: 80%+). Test more function paths.`,
        action: 'Add tests for untested functions and edge cases',
      });
    }
  }

  // Performance recommendations
  if (results.suites.performance && !results.suites.performance.success) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: 'Performance tests failed. Components may be rendering slowly.',
      action: 'Profile components and optimize render times',
    });
  }

  // Accessibility recommendations
  if (results.suites.accessibility && !results.suites.accessibility.success) {
    recommendations.push({
      type: 'accessibility',
      priority: 'critical',
      message: 'Accessibility tests failed. This may affect users with disabilities.',
      action: 'Review ARIA attributes, keyboard navigation, and color contrast',
    });
  }

  // Responsive design recommendations
  if (results.suites.responsive && !results.suites.responsive.success) {
    recommendations.push({
      type: 'responsive',
      priority: 'high',
      message: 'Responsive design tests failed. Components may not work on all devices.',
      action: 'Test components at different viewport sizes and fix layout issues',
    });
  }

  // Mobile recommendations
  if (results.suites.mobile && !results.suites.mobile.success) {
    recommendations.push({
      type: 'mobile',
      priority: 'high',
      message: 'Mobile interaction tests failed. Touch interactions may not work properly.',
      action: 'Test gesture handling and touch target sizes',
    });
  }

  // Overall health recommendations
  const totalWeight = Object.values(results.suites).reduce((sum, suite) => sum + (suite.weight || 0), 0);
  const weightedScore = Object.values(results.suites)
    .reduce((sum, suite) => sum + (suite.success ? suite.weight || 0 : 0), 0);
  const healthScore = (weightedScore / totalWeight) * 100;

  if (healthScore < 70) {
    recommendations.push({
      type: 'overall',
      priority: 'critical',
      message: `Overall health score is ${healthScore.toFixed(1)}% (target: 90%+). Multiple test suites are failing.`,
      action: 'Prioritize fixing failing tests, especially accessibility and responsive design',
    });
  } else if (healthScore < 90) {
    recommendations.push({
      type: 'overall',
      priority: 'medium',
      message: `Overall health score is ${healthScore.toFixed(1)}% (target: 90%+). Some improvements needed.`,
      action: 'Focus on improving test coverage and fixing minor issues',
    });
  }

  results.recommendations = recommendations;
  return recommendations;
}

function generateHtmlReport(results) {
  const template = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Responsive Design & Accessibility Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .title { font-size: 28px; margin: 0 0 8px 0; color: #1a202c; }
        .subtitle { color: #718096; margin: 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .summary-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .summary-card h3 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #718096; }
        .summary-card .value { font-size: 24px; font-weight: bold; margin: 0; }
        .success { color: #38a169; }
        .error { color: #e53e3e; }
        .warning { color: #d69e2e; }
        .suites { display: grid; gap: 16px; margin-bottom: 24px; }
        .suite { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .suite-header { display: flex; justify-content: between; align-items: center; margin-bottom: 12px; }
        .suite-name { font-size: 18px; font-weight: 600; margin: 0; }
        .suite-status { padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .status-passed { background: #c6f6d5; color: #22543d; }
        .status-failed { background: #fed7d7; color: #742a2a; }
        .recommendations { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .recommendation { border-left: 4px solid #e2e8f0; padding: 12px 16px; margin: 8px 0; background: #f7fafc; }
        .recommendation.critical { border-color: #e53e3e; background: #fed7d7; }
        .recommendation.high { border-color: #d69e2e; background: #faf089; }
        .recommendation.medium { border-color: #4299e1; background: #bee3f8; }
        .progress-bar { background: #e2e8f0; border-radius: 4px; height: 8px; margin: 8px 0; }
        .progress-fill { background: #38a169; height: 100%; border-radius: 4px; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Responsive Design & Accessibility Test Report</h1>
            <p class="subtitle">Generated on ${new Date(results.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <p class="value">${results.summary.total}</p>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <p class="value success">${results.summary.passed}</p>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <p class="value error">${results.summary.failed}</p>
            </div>
            <div class="summary-card">
                <h3>Duration</h3>
                <p class="value">${(results.summary.duration / 1000).toFixed(1)}s</p>
            </div>
            ${results.summary.coverage ? `
            <div class="summary-card">
                <h3>Line Coverage</h3>
                <p class="value ${results.summary.coverage.lines.pct >= 80 ? 'success' : 'warning'}">${results.summary.coverage.lines.pct}%</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${results.summary.coverage.lines.pct}%"></div>
                </div>
            </div>
            ` : ''}
        </div>

        <div class="suites">
            ${Object.entries(results.suites).map(([key, suite]) => `
                <div class="suite">
                    <div class="suite-header">
                        <h3 class="suite-name">${suite.name}</h3>
                        <span class="suite-status status-${suite.success ? 'passed' : 'failed'}">
                            ${suite.success ? 'Passed' : 'Failed'}
                        </span>
                    </div>
                    <p>Duration: ${(suite.duration / 1000).toFixed(1)}s | Weight: ${suite.weight}%</p>
                    ${suite.error ? `<div class="error" style="font-family: monospace; font-size: 12px; margin-top: 8px;">${suite.error}</div>` : ''}
                </div>
            `).join('')}
        </div>

        ${results.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            ${results.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <strong>${rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}</strong> (${rec.priority} priority)<br>
                    ${rec.message}<br>
                    <em>Action: ${rec.action}</em>
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>
</body>
</html>
  `;

  return writeReport('responsive-a11y-report.html', template);
}

function displaySummary(results) {
  log('\n' + '='.repeat(80), 'blue');
  log('📊 TEST SUMMARY', 'bold');
  log('='.repeat(80), 'blue');

  const passed = results.summary.passed;
  const failed = results.summary.failed;
  const total = results.summary.total;
  const duration = (results.summary.duration / 1000).toFixed(1);

  log(`Total Tests: ${total}`, 'blue');
  log(`Passed: ${passed}`, passed > 0 ? 'green' : 'red');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Duration: ${duration}s`, 'blue');

  if (results.summary.coverage) {
    const coverage = results.summary.coverage;
    log(`Line Coverage: ${coverage.lines.pct}%`, coverage.lines.pct >= 80 ? 'green' : 'yellow');
    log(`Function Coverage: ${coverage.functions.pct}%`, coverage.functions.pct >= 80 ? 'green' : 'yellow');
    log(`Branch Coverage: ${coverage.branches.pct}%`, coverage.branches.pct >= 80 ? 'green' : 'yellow');
  }

  // Calculate overall health score
  const totalWeight = Object.values(results.suites).reduce((sum, suite) => sum + (suite.weight || 0), 0);
  const weightedScore = Object.values(results.suites)
    .reduce((sum, suite) => sum + (suite.success ? suite.weight || 0 : 0), 0);
  const healthScore = (weightedScore / totalWeight) * 100;

  log(`\nOverall Health Score: ${healthScore.toFixed(1)}%`, healthScore >= 90 ? 'green' : healthScore >= 70 ? 'yellow' : 'red');

  if (results.recommendations.length > 0) {
    log('\n🔍 RECOMMENDATIONS:', 'yellow');
    results.recommendations.forEach((rec, i) => {
      const priority = rec.priority.toUpperCase();
      const color = rec.priority === 'critical' ? 'red' : rec.priority === 'high' ? 'yellow' : 'blue';
      log(`${i + 1}. [${priority}] ${rec.message}`, color);
      log(`   Action: ${rec.action}`, 'cyan');
    });
  }

  log('\n' + '='.repeat(80), 'blue');
  
  if (failed === 0) {
    log('🎉 All tests passed! Your application meets responsive design and accessibility standards.', 'green');
  } else {
    log(`❌ ${failed} test suite(s) failed. Please review the recommendations above.`, 'red');
  }
}

// Run the test suite
if (require.main === module) {
  runTestSuite().catch(error => {
    log(`💥 Test runner failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runTestSuite, generateRecommendations, config };