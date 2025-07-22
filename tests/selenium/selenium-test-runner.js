/**
 * Selenium Test Runner Configuration
 * Manages test execution, parallel testing, and reporting
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SeleniumTestRunner {
    constructor() {
        this.testConfig = {
            baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
            browsers: (process.env.TEST_BROWSERS || 'chrome,firefox').split(','),
            parallel: process.env.TEST_PARALLEL === 'true',
            headless: process.env.CI === 'true' || process.env.TEST_HEADLESS === 'true',
            timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
            retries: parseInt(process.env.TEST_RETRIES || '2'),
            screenshotOnFailure: process.env.TEST_SCREENSHOTS !== 'false',
            reportDir: path.join(__dirname, 'reports'),
            screenshotDir: path.join(__dirname, 'screenshots')
        };

        this.ensureDirectories();
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        [this.testConfig.reportDir, this.testConfig.screenshotDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Start web server for testing
     */
    async startWebServer() {
        return new Promise((resolve, reject) => {
            console.log('🚀 Starting web server for testing...');
            
            const serverProcess = spawn('npm', ['run', 'start:web'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                cwd: path.join(__dirname, '../../')
            });

            let serverReady = false;
            
            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('Server:', output.trim());
                
                if (output.includes('Server listening') || output.includes('localhost:3000')) {
                    serverReady = true;
                    resolve(serverProcess);
                }
            });

            serverProcess.stderr.on('data', (data) => {
                const error = data.toString();
                console.error('Server Error:', error.trim());
                
                if (!serverReady) {
                    reject(new Error(`Server failed to start: ${error}`));
                }
            });

            serverProcess.on('close', (code) => {
                if (!serverReady && code !== 0) {
                    reject(new Error(`Server process exited with code ${code}`));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (!serverReady) {
                    serverProcess.kill();
                    reject(new Error('Server start timeout'));
                }
            }, 30000);
        });
    }

    /**
     * Wait for server to be ready
     */
    async waitForServer() {
        const maxAttempts = 30;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${this.testConfig.baseUrl}/health`);
                if (response.ok) {
                    console.log('✅ Server is ready');
                    return true;
                }
            } catch (error) {
                // Server not ready yet
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        throw new Error('Server not ready after waiting');
    }

    /**
     * Run Selenium tests
     */
    async runSeleniumTests() {
        console.log('🧪 Running comprehensive Selenium tests');
        
        const testFiles = [
            'web-app-selenium.test.js',
            'export-sharing-selenium.test.js'
        ];

        const results = [];
        
        for (const testFile of testFiles) {
            const testPath = path.join(__dirname, testFile);
            
            if (!fs.existsSync(testPath)) {
                console.log(`⚠️  Test file not found: ${testFile}, skipping...`);
                continue;
            }
            
            console.log(`\n🏃 Running ${testFile}`);
            
            try {
                const result = await this.runTestFile(testPath);
                results.push({ file: testFile, ...result });
            } catch (error) {
                console.error(`❌ Error running ${testFile}:`, error.message);
                results.push({ 
                    file: testFile, 
                    success: false, 
                    error: error.message 
                });
            }
        }
        
        return results;
    }

    /**
     * Run individual test file
     */
    async runTestFile(testPath) {
        return new Promise((resolve, reject) => {
            const testProcess = spawn('node', [testPath], {
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    TEST_BASE_URL: this.testConfig.baseUrl,
                    TEST_BROWSERS: this.testConfig.browsers.join(','),
                    TEST_HEADLESS: this.testConfig.headless.toString(),
                    TEST_TIMEOUT: this.testConfig.timeout.toString()
                }
            });

            let stdout = '';
            let stderr = '';

            testProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                process.stdout.write(output);
            });

            testProcess.stderr.on('data', (data) => {
                const error = data.toString();
                stderr += error;
                process.stderr.write(error);
            });

            testProcess.on('close', (code) => {
                const result = {
                    exitCode: code,
                    success: code === 0,
                    stdout,
                    stderr
                };

                if (code === 0) {
                    resolve(result);
                } else {
                    resolve(result); // Don't reject, we want to collect all results
                }
            });

            testProcess.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Generate comprehensive test report
     */
    async generateReport(results) {
        console.log('\n📊 Generating comprehensive test report...');
        
        const summary = {
            timestamp: new Date().toISOString(),
            totalFiles: results.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            config: this.testConfig,
            results
        };

        // Generate HTML report
        const htmlReport = this.generateHtmlReport(summary);
        const htmlReportPath = path.join(this.testConfig.reportDir, 'selenium-test-report.html');
        fs.writeFileSync(htmlReportPath, htmlReport);

        // Generate JSON report
        const jsonReportPath = path.join(this.testConfig.reportDir, 'selenium-test-report.json');
        fs.writeFileSync(jsonReportPath, JSON.stringify(summary, null, 2));

        console.log(`📄 HTML report: ${htmlReportPath}`);
        console.log(`📄 JSON report: ${jsonReportPath}`);

        return summary;
    }

    /**
     * Generate HTML test report
     */
    generateHtmlReport(summary) {
        const successRate = ((summary.passed / summary.totalFiles) * 100).toFixed(1);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selenium Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .success { background: #d4edda; color: #155724; }
        .failure { background: #f8d7da; color: #721c24; }
        .test-results { margin-top: 30px; }
        .test-file { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .test-file.passed { border-left: 5px solid #28a745; }
        .test-file.failed { border-left: 5px solid #dc3545; }
        .config { margin-top: 30px; background: #e9ecef; padding: 15px; border-radius: 8px; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Selenium Test Report</h1>
            <div class="timestamp">Generated: ${new Date(summary.timestamp).toLocaleString()}</div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Files</h3>
                <div style="font-size: 2em; font-weight: bold;">${summary.totalFiles}</div>
            </div>
            <div class="summary-card success">
                <h3>Passed</h3>
                <div style="font-size: 2em; font-weight: bold;">${summary.passed}</div>
            </div>
            <div class="summary-card failure">
                <h3>Failed</h3>
                <div style="font-size: 2em; font-weight: bold;">${summary.failed}</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div style="font-size: 2em; font-weight: bold;">${successRate}%</div>
            </div>
        </div>

        <div class="test-results">
            <h2>Test Results</h2>
            ${summary.results.map(result => `
                <div class="test-file ${result.success ? 'passed' : 'failed'}">
                    <h3>${result.success ? '✅' : '❌'} ${result.file}</h3>
                    <p><strong>Exit Code:</strong> ${result.exitCode}</p>
                    ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
                    ${result.stdout ? `
                        <details>
                            <summary>Standard Output</summary>
                            <pre>${result.stdout}</pre>
                        </details>
                    ` : ''}
                    ${result.stderr ? `
                        <details>
                            <summary>Error Output</summary>
                            <pre>${result.stderr}</pre>
                        </details>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="config">
            <h2>Test Configuration</h2>
            <pre>${JSON.stringify(summary.config, null, 2)}</pre>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Main test runner
     */
    async run() {
        let serverProcess = null;
        
        try {
            // Start web server
            serverProcess = await this.startWebServer();
            await this.waitForServer();

            // Run Selenium tests
            const results = await this.runSeleniumTests();

            // Generate report
            const summary = await this.generateReport(results);

            // Print final summary
            console.log('\n' + '='.repeat(60));
            console.log('🏁 SELENIUM TEST EXECUTION COMPLETE');
            console.log('='.repeat(60));
            console.log(`📊 Total Test Files: ${summary.totalFiles}`);
            console.log(`✅ Passed: ${summary.passed}`);
            console.log(`❌ Failed: ${summary.failed}`);
            console.log(`📈 Success Rate: ${((summary.passed / summary.totalFiles) * 100).toFixed(1)}%`);
            
            if (summary.failed > 0) {
                console.log('\n❌ Some tests failed. Check the detailed report for more information.');
                process.exitCode = 1;
            } else {
                console.log('\n🎉 All Selenium tests passed!');
            }

        } catch (error) {
            console.error('❌ Test runner error:', error.message);
            process.exitCode = 1;
        } finally {
            // Clean up server
            if (serverProcess) {
                console.log('🛑 Stopping web server...');
                serverProcess.kill('SIGTERM');
                
                // Give server time to shut down gracefully
                setTimeout(() => {
                    if (!serverProcess.killed) {
                        serverProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
        }
    }
}

// Export for programmatic use
export default SeleniumTestRunner;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new SeleniumTestRunner();
    runner.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}
