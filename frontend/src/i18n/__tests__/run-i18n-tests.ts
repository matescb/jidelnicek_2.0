#!/usr/bin/env node

/**
 * Comprehensive i18n Test Runner
 * 
 * This script runs all internationalization tests and generates comprehensive reports
 * for translation coverage, quality, and compliance.
 * 
 * Usage:
 *   npm run test:i18n
 *   npm run test:i18n -- --coverage
 *   npm run test:i18n -- --report
 *   npm run test:i18n -- --ci
 */

import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { performance } from 'perf_hooks'

// Import our automation utilities
import {
  TranslationValidator,
  TranslationQualityAnalyzer,
  TranslationPerformanceAnalyzer,
  TranslationCompletionReporter,
  ValidationResult,
  PerformanceMetrics,
  CompletionReport,
  QualityReport,
} from './automation-utils.test'

interface TestResults {
  timestamp: Date
  environment: string
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
    duration: number
  }
  coverage: {
    languages: CompletionReport[]
    averageCompletion: number
    criticalMissing: string[]
  }
  quality: QualityReport & {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
  }
  performance: Record<string, PerformanceMetrics>
  validation: Record<string, ValidationResult>
  recommendations: string[]
  ciStatus: 'pass' | 'fail' | 'warning'
}

class I18nTestRunner {
  private readonly outputDir = path.join(process.cwd(), 'i18n-reports')
  private readonly supportedLanguages = ['en', 'cs', 'ar']
  
  private validator = new TranslationValidator()
  private qualityAnalyzer = new TranslationQualityAnalyzer()
  private performanceAnalyzer = new TranslationPerformanceAnalyzer()
  private completionReporter = new TranslationCompletionReporter()

  constructor() {
    this.ensureOutputDirectory()
  }

  /**
   * Main entry point for running i18n tests
   */
  async run(options: {
    coverage?: boolean
    report?: boolean
    ci?: boolean
    verbose?: boolean
  } = {}): Promise<TestResults> {
    console.log('🌍 Starting comprehensive i18n test suite...\n')
    
    const startTime = performance.now()
    const timestamp = new Date()

    try {
      // Run test suites
      const testResults = await this.runTestSuites(options.verbose)
      
      // Generate analysis reports
      const coverage = this.generateCoverageReport()
      const quality = this.generateQualityReport()
      const performanceMetrics = this.generatePerformanceReport()
      const validation = this.generateValidationReport()
      
      // Calculate summary metrics
      const duration = performance.now() - startTime
      const recommendations = this.generateRecommendations(coverage, quality, validation)
      const ciStatus = this.determineCiStatus(coverage, quality, validation)

      const results: TestResults = {
        timestamp,
        environment: process.env.NODE_ENV || 'development',
        summary: {
          ...testResults,
          duration: Math.round(duration),
        },
        coverage,
        quality,
        performance: performanceMetrics,
        validation,
        recommendations,
        ciStatus,
      }

      // Generate reports if requested
      if (options.report || options.ci) {
        await this.generateReports(results)
      }

      // Display results
      this.displayResults(results, options.verbose)

      // Handle CI mode
      if (options.ci) {
        this.handleCiMode(results)
      }

      return results

    } catch (error) {
      console.error('❌ i18n test suite failed:', error)
      throw error
    }
  }

  /**
   * Run all test suites and collect results
   */
  private async runTestSuites(verbose = false): Promise<{
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
  }> {
    console.log('🧪 Running test suites...')

    const testFiles = [
      'src/i18n/__tests__/comprehensive.test.tsx',
      'src/i18n/__tests__/critical-flows.test.tsx',
      'src/i18n/__tests__/components.test.tsx',
      'src/i18n/__tests__/hooks.test.tsx',
      'src/i18n/__tests__/integration.test.tsx',
      'src/i18n/__tests__/automation-utils.test.ts',
    ]

    let totalTests = 0
    let passedTests = 0
    let failedTests = 0
    let skippedTests = 0

    for (const testFile of testFiles) {
      try {
        console.log(`  Running ${testFile.split('/').pop()}...`)
        
        const output = execSync(
          `npx vitest run ${testFile} --reporter=json`,
          { 
            encoding: 'utf8',
            cwd: process.cwd(),
          }
        )

        const result = JSON.parse(output)
        
        if (result.testResults) {
          for (const fileResult of result.testResults) {
            totalTests += fileResult.assertionResults.length
            
            for (const testResult of fileResult.assertionResults) {
              switch (testResult.status) {
                case 'passed':
                  passedTests++
                  break
                case 'failed':
                  failedTests++
                  if (verbose) {
                    console.log(`    ❌ ${testResult.title}`)
                  }
                  break
                case 'skipped':
                  skippedTests++
                  break
              }
            }
          }
        }

        console.log(`    ✅ Completed`)

      } catch (error) {
        console.log(`    ❌ Failed: ${error}`)
        failedTests++
      }
    }

    return { totalTests, passedTests, failedTests, skippedTests }
  }

  /**
   * Generate translation coverage report
   */
  private generateCoverageReport(): {
    languages: CompletionReport[]
    averageCompletion: number
    criticalMissing: string[]
  } {
    console.log('📊 Analyzing translation coverage...')

    const languages = this.completionReporter.generateCompletionReport()
    const averageCompletion = languages.reduce(
      (sum, lang) => sum + lang.completionPercentage, 0
    ) / languages.length

    // Identify critical missing translations
    const criticalNamespaces = ['auth', 'navigation', 'common', 'errors']
    const criticalMissing: string[] = []

    for (const lang of languages) {
      for (const missingKey of lang.missingKeys) {
        const namespace = missingKey.split('.')[0]
        if (criticalNamespaces.includes(namespace)) {
          criticalMissing.push(`${lang.language}:${missingKey}`)
        }
      }
    }

    return {
      languages,
      averageCompletion: Math.round(averageCompletion * 10) / 10,
      criticalMissing,
    }
  }

  /**
   * Generate quality analysis report
   */
  private generateQualityReport(): QualityReport & {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
  } {
    console.log('🔍 Analyzing translation quality...')

    const baseReport = this.qualityAnalyzer.generateQualityReport()
    
    // Calculate quality score (0-100)
    let score = 100
    
    // Deduct points for issues
    score -= Math.min(baseReport.inconsistentFormatting.length * 2, 20)
    score -= Math.min(baseReport.suspiciousTranslations.length * 3, 30)
    score -= Math.min(baseReport.pluralizationIssues.length * 4, 20)
    score -= Math.min(baseReport.contextIssues.length * 3, 15)
    
    // Deduct for significant length variations
    const extremeVariations = baseReport.lengthVariations.filter(v => v.maxVariation > 200)
    score -= Math.min(extremeVariations.length * 2, 15)

    score = Math.max(0, score)

    // Assign grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (score >= 90) grade = 'A'
    else if (score >= 80) grade = 'B'
    else if (score >= 70) grade = 'C'
    else if (score >= 60) grade = 'D'
    else grade = 'F'

    return {
      ...baseReport,
      score: Math.round(score),
      grade,
    }
  }

  /**
   * Generate performance analysis report
   */
  private generatePerformanceReport(): Record<string, PerformanceMetrics> {
    console.log('⚡ Analyzing translation performance...')
    return this.performanceAnalyzer.analyzePerformanceMetrics()
  }

  /**
   * Generate validation report
   */
  private generateValidationReport(): Record<string, ValidationResult> {
    console.log('✅ Validating translations...')
    return this.validator.validateAllTranslations()
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    coverage: any,
    quality: any,
    validation: Record<string, ValidationResult>
  ): string[] {
    const recommendations: string[] = []

    // Coverage recommendations
    if (coverage.averageCompletion < 90) {
      recommendations.push(
        `Translation completion is ${coverage.averageCompletion}%. Aim for 95%+ for production.`
      )
    }

    if (coverage.criticalMissing.length > 0) {
      recommendations.push(
        `${coverage.criticalMissing.length} critical translations are missing. Prioritize: ${coverage.criticalMissing.slice(0, 3).join(', ')}`
      )
    }

    // Quality recommendations
    if (quality.score < 80) {
      recommendations.push(
        `Translation quality score is ${quality.score}/100 (Grade ${quality.grade}). Focus on reducing inconsistencies.`
      )
    }

    if (quality.suspiciousTranslations.length > 10) {
      recommendations.push(
        `${quality.suspiciousTranslations.length} suspicious translations detected. Review for accuracy.`
      )
    }

    if (quality.lengthVariations.filter((v: any) => v.maxVariation > 200).length > 5) {
      recommendations.push(
        'Significant text length variations detected. Review UI layout adaptation.'
      )
    }

    // Validation recommendations
    for (const [language, result] of Object.entries(validation)) {
      if (!result.valid) {
        recommendations.push(
          `${language.toUpperCase()} has ${result.errors.length} validation errors. Fix interpolation and key issues.`
        )
      }
    }

    // Performance recommendations
    const totalMemory = Object.values(this.generatePerformanceReport())
      .reduce((sum, metrics) => sum + metrics.memoryUsage, 0)
    
    if (totalMemory > 1000 * 1024) { // 1MB total
      recommendations.push(
        `Total translation memory usage is ${Math.round(totalMemory / 1024)}KB. Consider optimization.`
      )
    }

    return recommendations
  }

  /**
   * Determine CI/CD status
   */
  private determineCiStatus(
    coverage: any,
    quality: any,
    validation: Record<string, ValidationResult>
  ): 'pass' | 'fail' | 'warning' {
    const minCoverage = process.env.NODE_ENV === 'production' ? 90 : 80
    const minQualityScore = process.env.NODE_ENV === 'production' ? 80 : 70

    // Fail conditions
    if (coverage.averageCompletion < minCoverage) return 'fail'
    if (quality.score < minQualityScore) return 'fail'
    if (coverage.criticalMissing.length > 0) return 'fail'
    
    // Check for validation errors
    const hasValidationErrors = Object.values(validation).some(result => !result.valid)
    if (hasValidationErrors) return 'fail'

    // Warning conditions
    if (coverage.averageCompletion < 95) return 'warning'
    if (quality.suspiciousTranslations.length > 5) return 'warning'
    if (quality.lengthVariations.filter((v: any) => v.maxVariation > 150).length > 10) return 'warning'

    return 'pass'
  }

  /**
   * Generate comprehensive reports
   */
  private async generateReports(results: TestResults): Promise<void> {
    console.log('📝 Generating reports...')

    // JSON report for programmatic access
    await this.writeJsonReport(results)
    
    // HTML report for human review
    await this.writeHtmlReport(results)
    
    // Markdown report for documentation
    await this.writeMarkdownReport(results)
    
    // CSV report for tracking over time
    await this.writeCsvReport(results)

    console.log(`📁 Reports saved to: ${this.outputDir}`)
  }

  /**
   * Write JSON report
   */
  private async writeJsonReport(results: TestResults): Promise<void> {
    const filename = `i18n-report-${this.formatDate(results.timestamp)}.json`
    const filepath = path.join(this.outputDir, filename)
    
    await fs.writeFile(filepath, JSON.stringify(results, null, 2))
    
    // Also write latest.json for easy access
    await fs.writeFile(
      path.join(this.outputDir, 'latest.json'),
      JSON.stringify(results, null, 2)
    )
  }

  /**
   * Write HTML report
   */
  private async writeHtmlReport(results: TestResults): Promise<void> {
    const html = this.generateHtmlReport(results)
    const filename = `i18n-report-${this.formatDate(results.timestamp)}.html`
    const filepath = path.join(this.outputDir, filename)
    
    await fs.writeFile(filepath, html)
    await fs.writeFile(path.join(this.outputDir, 'latest.html'), html)
  }

  /**
   * Write Markdown report
   */
  private async writeMarkdownReport(results: TestResults): Promise<void> {
    const markdown = this.generateMarkdownReport(results)
    const filename = `i18n-report-${this.formatDate(results.timestamp)}.md`
    const filepath = path.join(this.outputDir, filename)
    
    await fs.writeFile(filepath, markdown)
  }

  /**
   * Write CSV tracking report
   */
  private async writeCsvReport(results: TestResults): Promise<void> {
    const csvPath = path.join(this.outputDir, 'i18n-tracking.csv')
    const row = [
      this.formatDate(results.timestamp),
      results.environment,
      results.coverage.averageCompletion,
      results.quality.score,
      results.quality.grade,
      results.summary.passedTests,
      results.summary.failedTests,
      results.ciStatus,
    ].join(',')

    // Check if file exists to determine if we need headers
    let csvContent = ''
    try {
      await fs.access(csvPath)
      csvContent = await fs.readFile(csvPath, 'utf8')
    } catch {
      // File doesn't exist, add headers
      csvContent = 'Date,Environment,Coverage%,Quality Score,Grade,Passed Tests,Failed Tests,CI Status\n'
    }

    csvContent += row + '\n'
    await fs.writeFile(csvPath, csvContent)
  }

  /**
   * Generate HTML report content
   */
  private generateHtmlReport(results: TestResults): string {
    const statusColor = {
      pass: '#22c55e',
      warning: '#f59e0b',
      fail: '#ef4444',
    }[results.ciStatus]

    const gradeColor = {
      A: '#22c55e',
      B: '#84cc16',
      C: '#f59e0b',
      D: '#f97316',
      F: '#ef4444',
    }[results.quality.grade]

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>i18n Test Report - ${this.formatDate(results.timestamp)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 8px; 
            color: white; 
            font-weight: bold;
            background: ${statusColor};
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
        .metric { font-size: 2em; font-weight: bold; color: #1f2937; }
        .metric-label { color: #6b7280; font-size: 0.875em; }
        .recommendations li { margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .quality-grade { 
            font-size: 1.5em; 
            font-weight: bold; 
            padding: 8px 16px; 
            border-radius: 8px; 
            color: white;
            background: ${gradeColor};
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌍 i18n Test Report</h1>
        <p>${this.formatDate(results.timestamp)} • ${results.environment} environment</p>
        <span class="status-badge">${results.ciStatus.toUpperCase()}</span>
    </div>

    <div class="grid">
        <div class="card">
            <h3>📊 Test Summary</h3>
            <div class="metric">${results.summary.passedTests}/${results.summary.totalTests}</div>
            <div class="metric-label">Tests Passed</div>
            <p>Duration: ${(results.summary.duration / 1000).toFixed(1)}s</p>
        </div>

        <div class="card">
            <h3>🌐 Translation Coverage</h3>
            <div class="metric">${results.coverage.averageCompletion}%</div>
            <div class="metric-label">Average Completion</div>
            <p>Critical Missing: ${results.coverage.criticalMissing.length}</p>
        </div>

        <div class="card">
            <h3>🔍 Quality Score</h3>
            <div class="metric">${results.quality.score}/100</div>
            <div class="metric-label">Quality Score</div>
            <span class="quality-grade">${results.quality.grade}</span>
        </div>

        <div class="card">
            <h3>⚡ Performance</h3>
            <div class="metric">${Object.keys(results.performance).length}</div>
            <div class="metric-label">Languages Analyzed</div>
            <p>Total Memory: ${Math.round(Object.values(results.performance).reduce((sum, m) => sum + m.memoryUsage, 0) / 1024)}KB</p>
        </div>
    </div>

    <div class="card">
        <h3>📋 Recommendations</h3>
        <ul class="recommendations">
            ${results.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="card">
        <h3>🌐 Language Coverage Details</h3>
        <table>
            <thead>
                <tr>
                    <th>Language</th>
                    <th>Completion</th>
                    <th>Translated</th>
                    <th>Missing</th>
                    <th>Empty</th>
                </tr>
            </thead>
            <tbody>
                ${results.coverage.languages.map(lang => `
                    <tr>
                        <td>${lang.language.toUpperCase()}</td>
                        <td>${lang.completionPercentage}%</td>
                        <td>${lang.translatedKeys}/${lang.totalKeys}</td>
                        <td>${lang.missingKeys.length}</td>
                        <td>${lang.emptyTranslations.length}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="card">
        <h3>🔧 Quality Issues</h3>
        <table>
            <thead>
                <tr>
                    <th>Issue Type</th>
                    <th>Count</th>
                    <th>Examples</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Inconsistent Formatting</td>
                    <td>${results.quality.inconsistentFormatting.length}</td>
                    <td>${results.quality.inconsistentFormatting.slice(0, 3).join(', ') || 'None'}</td>
                </tr>
                <tr>
                    <td>Suspicious Translations</td>
                    <td>${results.quality.suspiciousTranslations.length}</td>
                    <td>${results.quality.suspiciousTranslations.slice(0, 3).join(', ') || 'None'}</td>
                </tr>
                <tr>
                    <td>Length Variations</td>
                    <td>${results.quality.lengthVariations.length}</td>
                    <td>${results.quality.lengthVariations.slice(0, 3).map((v: any) => v.key).join(', ') || 'None'}</td>
                </tr>
                <tr>
                    <td>Pluralization Issues</td>
                    <td>${results.quality.pluralizationIssues.length}</td>
                    <td>${results.quality.pluralizationIssues.slice(0, 3).join(', ') || 'None'}</td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>`
  }

  /**
   * Generate Markdown report content
   */
  private generateMarkdownReport(results: TestResults): string {
    return `# 🌍 i18n Test Report

**Date:** ${this.formatDate(results.timestamp)}  
**Environment:** ${results.environment}  
**Status:** ${results.ciStatus.toUpperCase()}  

## Summary

- **Tests:** ${results.summary.passedTests}/${results.summary.totalTests} passed
- **Duration:** ${(results.summary.duration / 1000).toFixed(1)}s
- **Coverage:** ${results.coverage.averageCompletion}%
- **Quality Score:** ${results.quality.score}/100 (Grade ${results.quality.grade})

## Language Coverage

| Language | Completion | Translated | Missing | Empty |
|----------|------------|------------|---------|-------|
${results.coverage.languages.map(lang => 
  `| ${lang.language.toUpperCase()} | ${lang.completionPercentage}% | ${lang.translatedKeys}/${lang.totalKeys} | ${lang.missingKeys.length} | ${lang.emptyTranslations.length} |`
).join('\n')}

## Quality Issues

- **Inconsistent Formatting:** ${results.quality.inconsistentFormatting.length}
- **Suspicious Translations:** ${results.quality.suspiciousTranslations.length}
- **Length Variations:** ${results.quality.lengthVariations.length}
- **Pluralization Issues:** ${results.quality.pluralizationIssues.length}
- **Context Issues:** ${results.quality.contextIssues.length}

## Recommendations

${results.recommendations.map(rec => `- ${rec}`).join('\n')}

## Performance Metrics

| Language | Keys | Avg Key Length | Avg Value Length | Memory |
|----------|------|----------------|------------------|--------|
${Object.entries(results.performance).map(([lang, metrics]) => 
  `| ${lang.toUpperCase()} | ${metrics.keyCount} | ${metrics.averageKeyLength} | ${metrics.averageValueLength} | ${Math.round(metrics.memoryUsage / 1024)}KB |`
).join('\n')}
`
  }

  /**
   * Display results in console
   */
  private displayResults(results: TestResults, verbose = false): void {
    console.log('\n📊 i18n Test Results Summary')
    console.log('═'.repeat(50))
    
    const statusEmoji = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌',
    }[results.ciStatus]

    console.log(`${statusEmoji} Status: ${results.ciStatus.toUpperCase()}`)
    console.log(`🧪 Tests: ${results.summary.passedTests}/${results.summary.totalTests} passed`)
    console.log(`🌐 Coverage: ${results.coverage.averageCompletion}%`)
    console.log(`🔍 Quality: ${results.quality.score}/100 (Grade ${results.quality.grade})`)
    console.log(`⏱️  Duration: ${(results.summary.duration / 1000).toFixed(1)}s`)

    if (results.coverage.criticalMissing.length > 0) {
      console.log(`\n⚠️  Critical missing translations: ${results.coverage.criticalMissing.length}`)
    }

    if (results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      results.recommendations.slice(0, 5).forEach(rec => {
        console.log(`   • ${rec}`)
      })
    }

    if (verbose) {
      console.log('\n🌐 Language Details:')
      results.coverage.languages.forEach(lang => {
        console.log(`   ${lang.language.toUpperCase()}: ${lang.completionPercentage}% complete (${lang.missingKeys.length} missing)`)
      })
    }

    console.log('\n═'.repeat(50))
  }

  /**
   * Handle CI mode exit codes and reporting
   */
  private handleCiMode(results: TestResults): void {
    console.log('\n🤖 CI Mode Results:')
    
    if (results.ciStatus === 'pass') {
      console.log('✅ All i18n quality gates passed')
      process.exit(0)
    } else if (results.ciStatus === 'warning') {
      console.log('⚠️  i18n quality gates passed with warnings')
      process.exit(0) // Don't fail CI for warnings
    } else {
      console.log('❌ i18n quality gates failed')
      console.log('\nFailure reasons:')
      
      if (results.coverage.averageCompletion < 80) {
        console.log(`   • Coverage too low: ${results.coverage.averageCompletion}% (minimum: 80%)`)
      }
      if (results.quality.score < 70) {
        console.log(`   • Quality score too low: ${results.quality.score}/100 (minimum: 70)`)
      }
      if (results.coverage.criticalMissing.length > 0) {
        console.log(`   • Critical translations missing: ${results.coverage.criticalMissing.length}`)
      }
      
      process.exit(1)
    }
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.outputDir)
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true })
    }
  }

  /**
   * Format date for filenames
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 19).replace(/[:.]/g, '-')
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const options = {
    coverage: args.includes('--coverage'),
    report: args.includes('--report'),
    ci: args.includes('--ci'),
    verbose: args.includes('--verbose'),
  }

  const runner = new I18nTestRunner()
  
  try {
    await runner.run(options)
  } catch (error) {
    console.error('Failed to run i18n tests:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { I18nTestRunner }
export type { TestResults }