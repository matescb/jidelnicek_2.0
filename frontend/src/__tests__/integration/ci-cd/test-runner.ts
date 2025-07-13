#!/usr/bin/env node

/**
 * Comprehensive Integration Test Runner for CI/CD Pipeline
 * 
 * This script orchestrates the execution of all integration tests
 * with proper reporting, parallelization, and CI-specific configurations.
 */

import { execSync, spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

interface TestSuite {
  name: string
  pattern: string
  timeout: number
  parallel?: boolean
  requirements?: string[]
  retries?: number
  critical?: boolean
}

interface TestResult {
  suite: string
  passed: number
  failed: number
  skipped: number
  duration: number
  coverage: number
  errors: string[]
}

interface TestReport {
  timestamp: string
  environment: string
  totalDuration: number
  overallCoverage: number
  results: TestResult[]
  summary: {
    totalTests: number
    totalPassed: number
    totalFailed: number
    totalSkipped: number
    criticalFailures: number
  }
}

class IntegrationTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Setup and Utilities',
      pattern: 'src/__tests__/integration/setup/**/*.test.{ts,tsx}',
      timeout: 30000,
      parallel: false,
      critical: true
    },
    {
      name: 'User Journey Tests',
      pattern: 'src/__tests__/integration/user-journeys/**/*.test.{ts,tsx}',
      timeout: 120000,
      parallel: false,
      critical: true,
      retries: 2
    },
    {
      name: 'Cross-Component Integration',
      pattern: 'src/__tests__/integration/cross-component/**/*.test.{ts,tsx}',
      timeout: 60000,
      parallel: true,
      critical: true
    },
    {
      name: 'API Integration',
      pattern: 'src/__tests__/integration/api/**/*.test.{ts,tsx}',
      timeout: 45000,
      parallel: true,
      critical: true
    },
    {
      name: 'Browser Environment',
      pattern: 'src/__tests__/integration/browser/**/*.test.{ts,tsx}',
      timeout: 30000,
      parallel: true,
      critical: false
    },
    {
      name: 'Business Logic',
      pattern: 'src/__tests__/integration/business-logic/**/*.test.{ts,tsx}',
      timeout: 45000,
      parallel: true,
      critical: true
    },
    {
      name: 'Performance Tests',
      pattern: 'src/__tests__/integration/performance/**/*.test.{ts,tsx}',
      timeout: 90000,
      parallel: false,
      critical: false,
      requirements: ['PERFORMANCE_TESTING_ENABLED']
    }
  ]

  private environment: string
  private outputDir: string
  private startTime: number = 0

  constructor() {
    this.environment = process.env.NODE_ENV || 'test'
    this.outputDir = resolve(process.cwd(), 'coverage', 'integration')
    
    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true })
    }
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Comprehensive Integration Test Suite...')
    console.log(`Environment: ${this.environment}`)
    console.log(`Output Directory: ${this.outputDir}`)
    console.log('=' .repeat(60))

    this.startTime = Date.now()
    const results: TestResult[] = []

    // Pre-flight checks
    await this.performPreflightChecks()

    // Run test suites
    for (const suite of this.testSuites) {
      console.log(`\n📋 Running: ${suite.name}`)
      
      // Check requirements
      if (suite.requirements && !this.checkRequirements(suite.requirements)) {
        console.log(`⏭️  Skipping ${suite.name} - requirements not met`)
        continue
      }

      try {
        const result = await this.runTestSuite(suite)
        results.push(result)
        
        if (suite.critical && result.failed > 0) {
          console.log(`❌ Critical test suite failed: ${suite.name}`)
          console.log('Stopping execution due to critical failure')
          break
        }
      } catch (error) {
        console.error(`💥 Failed to run ${suite.name}:`, error)
        
        const errorResult: TestResult = {
          suite: suite.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          coverage: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        }
        results.push(errorResult)
        
        if (suite.critical) {
          break
        }
      }
    }

    // Generate comprehensive report
    await this.generateReport(results)
    
    // Determine exit code
    const hasFailures = results.some(r => r.failed > 0)
    const hasCriticalFailures = results.some((r, i) => r.failed > 0 && this.testSuites[i]?.critical)
    
    if (hasCriticalFailures) {
      console.log('\n❌ Critical test failures detected')
      process.exit(1)
    } else if (hasFailures) {
      console.log('\n⚠️  Some tests failed, but no critical failures')
      process.exit(process.env.CI ? 1 : 0) // Fail in CI, warn locally
    } else {
      console.log('\n✅ All tests passed!')
      process.exit(0)
    }
  }

  private async performPreflightChecks(): Promise<void> {
    console.log('🔍 Performing pre-flight checks...')

    // Check Node.js version
    const nodeVersion = process.version
    console.log(`Node.js version: ${nodeVersion}`)

    // Check dependencies
    try {
      execSync('npm list vitest @testing-library/react', { stdio: 'pipe' })
      console.log('✅ Test dependencies verified')
    } catch (error) {
      throw new Error('Missing required test dependencies')
    }

    // Check test environment setup
    if (!process.env.VITE_API_URL) {
      console.log('⚠️  VITE_API_URL not set, using default')
      process.env.VITE_API_URL = '/api/v1'
    }

    // Setup test database if needed
    if (process.env.TEST_DATABASE_URL) {
      console.log('🗄️  Setting up test database...')
      try {
        execSync('npm run test:db:setup', { stdio: 'pipe' })
        console.log('✅ Test database ready')
      } catch (error) {
        console.log('⚠️  Could not setup test database, using mocks')
      }
    }

    // Clear previous coverage
    try {
      execSync(`rm -rf ${this.outputDir}/*`, { stdio: 'pipe' })
      console.log('✅ Previous coverage cleared')
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('✅ Pre-flight checks completed\n')
  }

  private checkRequirements(requirements: string[]): boolean {
    return requirements.every(req => {
      const envVar = process.env[req]
      return envVar && envVar.toLowerCase() !== 'false'
    })
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now()
    
    // Build vitest command
    const vitestArgs = [
      'run',
      '--config', 'vite.config.ts',
      '--reporter=json',
      '--reporter=verbose',
      `--testTimeout=${suite.timeout}`,
      '--coverage',
      '--coverage.reporter=json',
      '--coverage.reporter=text-summary',
      suite.pattern
    ]

    if (suite.parallel) {
      vitestArgs.push('--pool=threads', '--poolOptions.threads.minThreads=2')
    } else {
      vitestArgs.push('--pool=forks', '--poolOptions.forks.singleFork=true')
    }

    if (suite.retries) {
      vitestArgs.push(`--retry=${suite.retries}`)
    }

    // Add CI-specific options
    if (process.env.CI) {
      vitestArgs.push('--run', '--no-watch')
    }

    console.log(`   Command: vitest ${vitestArgs.join(' ')}`)

    try {
      const output = execSync(`npx vitest ${vitestArgs.join(' ')}`, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: process.env.CI || 'false'
        },
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      // Parse test results
      const duration = Date.now() - startTime
      const result = this.parseTestOutput(suite.name, output, duration)
      
      console.log(`   ✅ ${result.passed} passed, ❌ ${result.failed} failed, ⏭️  ${result.skipped} skipped`)
      console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`)
      console.log(`   📊 Coverage: ${result.coverage.toFixed(1)}%`)

      return result

    } catch (error: any) {
      const duration = Date.now() - startTime
      console.log(`   💥 Suite execution failed after ${(duration / 1000).toFixed(2)}s`)
      
      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        coverage: 0,
        errors: [error.message || 'Unknown error']
      }
    }
  }

  private parseTestOutput(suiteName: string, output: string, duration: number): TestResult {
    // Parse vitest JSON output
    try {
      const lines = output.split('\n')
      const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('"testResults"'))
      
      if (jsonLine) {
        const results = JSON.parse(jsonLine)
        
        const passed = results.testResults?.filter((t: any) => t.status === 'passed').length || 0
        const failed = results.testResults?.filter((t: any) => t.status === 'failed').length || 0
        const skipped = results.testResults?.filter((t: any) => t.status === 'skipped').length || 0
        
        // Extract coverage information
        let coverage = 0
        const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/)
        if (coverageMatch) {
          coverage = parseFloat(coverageMatch[1])
        }

        // Extract errors
        const errors: string[] = []
        const errorMatches = output.match(/FAIL .+/g)
        if (errorMatches) {
          errors.push(...errorMatches)
        }

        return {
          suite: suiteName,
          passed,
          failed,
          skipped,
          duration,
          coverage,
          errors
        }
      }
    } catch (parseError) {
      console.log('   ⚠️  Could not parse test output, using fallback parsing')
    }

    // Fallback parsing
    const passedMatch = output.match(/(\d+) passed/)
    const failedMatch = output.match(/(\d+) failed/)
    const skippedMatch = output.match(/(\d+) skipped/)
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/)

    return {
      suite: suiteName,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      duration,
      coverage: coverageMatch ? parseFloat(coverageMatch[1]) : 0,
      errors: []
    }
  }

  private async generateReport(results: TestResult[]): Promise<void> {
    const totalDuration = Date.now() - this.startTime
    
    const summary = {
      totalTests: results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0),
      totalPassed: results.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
      totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
      criticalFailures: results.filter((r, i) => r.failed > 0 && this.testSuites[i]?.critical).length
    }

    const overallCoverage = results.length > 0 
      ? results.reduce((sum, r) => sum + r.coverage, 0) / results.length 
      : 0

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      totalDuration,
      overallCoverage,
      results,
      summary
    }

    // Write JSON report
    const jsonReportPath = join(this.outputDir, 'integration-test-report.json')
    writeFileSync(jsonReportPath, JSON.stringify(report, null, 2))

    // Write HTML report
    const htmlReportPath = join(this.outputDir, 'integration-test-report.html')
    const htmlReport = this.generateHtmlReport(report)
    writeFileSync(htmlReportPath, htmlReport)

    // Write JUnit XML for CI systems
    const junitReportPath = join(this.outputDir, 'integration-test-report.xml')
    const junitReport = this.generateJunitReport(report)
    writeFileSync(junitReportPath, junitReport)

    // Console summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 INTEGRATION TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log(`Overall Coverage: ${overallCoverage.toFixed(1)}%`)
    console.log(`Total Tests: ${summary.totalTests}`)
    console.log(`✅ Passed: ${summary.totalPassed}`)
    console.log(`❌ Failed: ${summary.totalFailed}`)
    console.log(`⏭️  Skipped: ${summary.totalSkipped}`)
    console.log(`🚨 Critical Failures: ${summary.criticalFailures}`)
    console.log('\nDetailed Results:')
    
    results.forEach((result, index) => {
      const suite = this.testSuites[index]
      const status = result.failed > 0 ? '❌' : '✅'
      const critical = suite?.critical ? '🚨' : '  '
      console.log(`${status} ${critical} ${result.suite}: ${result.passed}/${result.passed + result.failed + result.skipped} (${result.coverage.toFixed(1)}% coverage)`)
    })

    console.log(`\n📄 Reports generated:`)
    console.log(`   JSON: ${jsonReportPath}`)
    console.log(`   HTML: ${htmlReportPath}`)
    console.log(`   JUnit: ${junitReportPath}`)
  }

  private generateHtmlReport(report: TestReport): string {
    const statusClass = (result: TestResult) => 
      result.failed > 0 ? 'failed' : 'passed'

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 5px; }
        .suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .suite-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; }
        .suite-header.passed { background: #d4edda; }
        .suite-header.failed { background: #f8d7da; }
        .suite-body { padding: 15px; }
        .test-stats { display: flex; gap: 20px; margin-top: 10px; }
        .stat { padding: 5px 10px; border-radius: 4px; font-size: 0.9em; }
        .stat.passed { background: #d4edda; color: #155724; }
        .stat.failed { background: #f8d7da; color: #721c24; }
        .stat.skipped { background: #fff3cd; color: #856404; }
        .errors { margin-top: 15px; }
        .error { background: #f8d7da; padding: 10px; border-radius: 4px; margin-bottom: 5px; font-family: monospace; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <p><strong>Environment:</strong> ${report.environment}</p>
        <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${(report.totalDuration / 1000).toFixed(2)}s</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${report.summary.totalTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #28a745;">${report.summary.totalPassed}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #dc3545;">${report.summary.totalFailed}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.overallCoverage.toFixed(1)}%</div>
            <div class="metric-label">Coverage</div>
        </div>
    </div>

    ${report.results.map(result => `
        <div class="suite">
            <div class="suite-header ${statusClass(result)}">
                <h3>${result.suite}</h3>
                <div class="test-stats">
                    <span class="stat passed">${result.passed} passed</span>
                    <span class="stat failed">${result.failed} failed</span>
                    <span class="stat skipped">${result.skipped} skipped</span>
                </div>
            </div>
            <div class="suite-body">
                <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(2)}s</p>
                <p><strong>Coverage:</strong> ${result.coverage.toFixed(1)}%</p>
                ${result.errors.length > 0 ? `
                    <div class="errors">
                        <h4>Errors:</h4>
                        ${result.errors.map(error => `<div class="error">${error}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('')}
</body>
</html>
    `
  }

  private generateJunitReport(report: TestReport): string {
    const totalTests = report.summary.totalTests
    const failures = report.summary.totalFailed
    const errors = report.summary.criticalFailures
    const time = (report.totalDuration / 1000).toFixed(3)

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Integration Tests" tests="${totalTests}" failures="${failures}" errors="${errors}" time="${time}" timestamp="${report.timestamp}">
  ${report.results.map(result => `
    <testcase classname="${result.suite}" name="${result.suite}" time="${(result.duration / 1000).toFixed(3)}">
      ${result.failed > 0 ? `
        <failure message="Test suite failed" type="TestFailure">
          ${result.errors.join('\n')}
        </failure>
      ` : ''}
    </testcase>
  `).join('')}
</testsuite>`
  }
}

// CLI execution
if (require.main === module) {
  const runner = new IntegrationTestRunner()
  runner.run().catch(error => {
    console.error('💥 Test runner crashed:', error)
    process.exit(1)
  })
}

export { IntegrationTestRunner }