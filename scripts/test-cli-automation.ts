#!/usr/bin/env tsx
/**
 * Terminal CLI Automation Test
 * Simulates human CLI usage to test the job-dorker tool end-to-end
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger({ module: 'cli-automation' });

interface TestScenario {
  name: string;
  description: string;
  commands: Array<{
    command: string;
    args: string[];
    expectedPatterns?: string[];
    timeout?: number;
    workingDir?: string;
  }>;
  cleanup?: Array<{
    type: 'file' | 'directory';
    path: string;
  }>;
}

class CLIAutomationTester {
  private readonly workspaceRoot: string;
  private readonly tempDir: string;

  constructor() {
    this.workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    this.tempDir = join(this.workspaceRoot, 'temp', 'cli-automation');
  }

  /**
   * Run a command and capture output
   */
  private async runCommand(
    command: string,
    args: string[],
    options: {
      timeout?: number;
      workingDir?: string;
      expectedPatterns?: string[];
    } = {},
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
  }> {
    const startTime = Date.now();
    const timeout = options.timeout || 30000;
    const workingDir = options.workingDir || this.workspaceRoot;

    logger.info({ command, args, workingDir }, 'Running command');

    return new Promise((resolve, reject) => {
      const child: ChildProcess = spawn(command, args, {
        cwd: workingDir,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        // Log real-time output for debugging
        if (chunk.trim()) {
          logger.debug({ output: chunk.trim() }, 'Command stdout');
        }
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        if (chunk.trim()) {
          logger.debug({ error: chunk.trim() }, 'Command stderr');
        }
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;

        logger.info(
          { command, exitCode, duration, outputLength: stdout.length },
          'Command completed',
        );

        // Check expected patterns if provided
        if (options.expectedPatterns) {
          for (const pattern of options.expectedPatterns) {
            if (!stdout.includes(pattern) && !stderr.includes(pattern)) {
              logger.warn(
                { pattern, stdout: stdout.slice(0, 500) },
                'Expected pattern not found in output',
              );
            }
          }
        }

        resolve({
          exitCode: exitCode || 0,
          stdout,
          stderr,
          duration,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Setup test environment
   */
  private async setup(): Promise<void> {
    logger.info('Setting up CLI automation test environment');

    // Create temporary directory
    await fs.mkdir(this.tempDir, { recursive: true });

    // Ensure the project is built
    logger.info('Building project');
    const buildResult = await this.runCommand('npm', ['run', 'build'], {
      timeout: 60000,
    });

    if (buildResult.exitCode !== 0) {
      throw new Error(`Build failed: ${buildResult.stderr}`);
    }

    logger.info('CLI automation test environment ready');
  }

  /**
   * Cleanup test environment
   */
  private async cleanup(): Promise<void> {
    logger.info('Cleaning up CLI automation test environment');

    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      logger.info('Cleanup completed');
    } catch (error) {
      logger.warn({ error }, 'Cleanup failed, continuing anyway');
    }
  }

  /**
   * Execute a test scenario
   */
  private async executeScenario(scenario: TestScenario): Promise<{
    success: boolean;
    results: Array<{
      command: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
  }> {
    logger.info({ scenario: scenario.name }, 'Executing test scenario');

    const results: Array<{
      command: string;
      success: boolean;
      duration: number;
      error?: string;
    }> = [];

    for (const cmd of scenario.commands) {
      try {
        const result = await this.runCommand(cmd.command, cmd.args, {
          timeout: cmd.timeout,
          workingDir: cmd.workingDir,
          expectedPatterns: cmd.expectedPatterns,
        });

        const success = result.exitCode === 0;
        results.push({
          command: `${cmd.command} ${cmd.args.join(' ')}`,
          success,
          duration: result.duration,
          error: success ? undefined : result.stderr || 'Non-zero exit code',
        });

        if (!success) {
          logger.error(
            {
              command: cmd.command,
              args: cmd.args,
              exitCode: result.exitCode,
              stderr: result.stderr,
            },
            'Command failed',
          );
        }
      } catch (error) {
        logger.error({ error, command: cmd.command }, 'Command execution failed');
        results.push({
          command: `${cmd.command} ${cmd.args.join(' ')}`,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Cleanup scenario-specific resources
    if (scenario.cleanup) {
      for (const cleanup of scenario.cleanup) {
        try {
          if (cleanup.type === 'directory') {
            await fs.rm(cleanup.path, { recursive: true, force: true });
          } else {
            await fs.unlink(cleanup.path);
          }
        } catch (error) {
          logger.warn({ error, path: cleanup.path }, 'Cleanup item failed');
        }
      }
    }

    const success = results.every((r) => r.success);
    logger.info(
      { scenario: scenario.name, success, totalCommands: results.length },
      'Scenario completed',
    );

    return { success, results };
  }

  /**
   * Run all test scenarios
   */
  async runTests(): Promise<void> {
    logger.info('Starting CLI automation tests');

    try {
      await this.setup();

      const scenarios: TestScenario[] = [
        {
          name: 'Build and Lint',
          description: 'Test build and linting process',
          commands: [
            {
              command: 'npm',
              args: ['run', 'build'],
              expectedPatterns: ['tsc'],
              timeout: 60000,
            },
            {
              command: 'npm',
              args: ['run', 'lint'],
              expectedPatterns: ['Checked'],
              timeout: 30000,
            },
          ],
        },
        {
          name: 'Unit Tests',
          description: 'Run all unit tests',
          commands: [
            {
              command: 'npm',
              args: ['test', '--run'],
              expectedPatterns: ['Test Files', 'passed'],
              timeout: 60000,
            },
          ],
        },
        {
          name: 'Integration Tests',
          description: 'Run integration tests specifically',
          commands: [
            {
              command: 'npm',
              args: ['test', '--run', 'tests/integration/'],
              expectedPatterns: ['integration', 'passed'],
              timeout: 30000,
            },
          ],
        },
        {
          name: 'Code Quality',
          description: 'Check code formatting and quality',
          commands: [
            {
              command: 'npm',
              args: ['run', 'format:check'],
              expectedPatterns: ['Checked'],
              timeout: 20000,
            },
            {
              command: 'npm',
              args: ['run', 'type-check'],
              expectedPatterns: [],
              timeout: 30000,
            },
          ],
        },
        {
          name: 'CLI Help and Version',
          description: 'Test basic CLI functionality',
          commands: [
            {
              command: 'node',
              args: ['dist/cli/index.js', '--version'],
              expectedPatterns: ['1.0.0'],
              timeout: 10000,
            },
            {
              command: 'node',
              args: ['dist/cli/index.js', '--help'],
              expectedPatterns: ['Usage', 'Options'],
              timeout: 10000,
            },
          ],
        },
        {
          name: 'JSON Generation Test',
          description: 'Test JSON generator with mock data',
          commands: [
            {
              command: 'node',
              args: [
                '-e',
                `
                const { JsonGenerator } = require('./dist/generators/json-generator.js');
                const mockJobs = [{
                  id: 'test-1',
                  title: 'Test Job',
                  company: 'Test Company',
                  location: 'Test Location',
                  description: 'Test Description',
                  url: 'https://example.com/job',
                  employmentType: 'full-time',
                  remote: false,
                  source: {
                    site: 'test-site',
                    originalUrl: 'https://example.com/job',
                    scrapedAt: new Date()
                  },
                  metadata: { confidence: 0.9, rawData: {} },
                  requirements: [],
                  benefits: [],
                  tags: []
                }];
                JsonGenerator.generateReport(mockJobs, {
                  outputPath: 'temp/cli-automation/test-output.json',
                  pretty: true
                }).then(() => console.log('JSON generation successful')).catch(console.error);
                `,
              ],
              expectedPatterns: ['JSON generation successful'],
              timeout: 15000,
            },
          ],
          cleanup: [
            {
              type: 'file',
              path: join(this.tempDir, 'test-output.json'),
            },
          ],
        },
      ];

      const allResults: Array<{
        scenario: string;
        success: boolean;
        results: Array<{
          command: string;
          success: boolean;
          duration: number;
          error?: string;
        }>;
      }> = [];

      // Run all scenarios
      for (const scenario of scenarios) {
        const result = await this.executeScenario(scenario);
        allResults.push({
          scenario: scenario.name,
          success: result.success,
          results: result.results,
        });
      }

      // Generate summary report
      const totalScenarios = allResults.length;
      const successfulScenarios = allResults.filter((r) => r.success).length;
      const totalCommands = allResults.reduce((sum, r) => sum + r.results.length, 0);
      const successfulCommands = allResults.reduce(
        (sum, r) => sum + r.results.filter((cmd) => cmd.success).length,
        0,
      );

      logger.info(
        {
          totalScenarios,
          successfulScenarios,
          totalCommands,
          successfulCommands,
          overallSuccess: successfulScenarios === totalScenarios,
        },
        'CLI automation test summary',
      );

      // Log detailed results
      console.info('\n=== CLI AUTOMATION TEST RESULTS ===\n');
      for (const result of allResults) {
        console.info(`${result.success ? '✅' : '❌'} ${result.scenario}`);
        for (const cmd of result.results) {
          console.info(
            `  ${cmd.success ? '  ✓' : '  ✗'} ${cmd.command} (${cmd.duration}ms)${
              cmd.error ? ` - ${cmd.error}` : ''
            }`,
          );
        }
        console.info();
      }

      console.info(`Summary: ${successfulScenarios}/${totalScenarios} scenarios passed`);
      console.info(`Commands: ${successfulCommands}/${totalCommands} commands successful`);

      if (successfulScenarios === totalScenarios) {
        console.info('\n🎉 All CLI automation tests passed!');
        process.exit(0);
      } else {
        console.info('\n💥 Some CLI automation tests failed!');
        process.exit(1);
      }
    } catch (error) {
      logger.error({ error }, 'CLI automation tests failed');
      console.error('CLI automation tests failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CLIAutomationTester();
  tester.runTests().catch((error) => {
    console.error('Failed to run CLI automation tests:', error);
    process.exit(1);
  });
}

export { CLIAutomationTester };
