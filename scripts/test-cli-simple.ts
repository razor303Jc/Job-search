#!/usr/bin/env tsx
/**
 * Simple CLI automation test
 * Tests core CLI functionality without timeout issues
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
}

class SimpleCLITester {
  private workingDir: string;

  constructor(workingDir: string) {
    this.workingDir = workingDir;
  }

  /**
   * Execute a command and return results
   */
  async executeCommand(command: string, args: string[] = []): Promise<CommandResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: this.workingDir,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          command: `${command} ${args.join(' ')}`,
          duration,
        });
      });

      // Kill after 15 seconds to prevent hanging
      setTimeout(() => {
        child.kill('SIGTERM');
        const duration = Date.now() - startTime;
        resolve({
          exitCode: 1,
          stdout,
          stderr: `${stderr}\nTimeout: Command killed after 15 seconds`,
          command: `${command} ${args.join(' ')}`,
          duration,
        });
      }, 15000);
    });
  }

  /**
   * Test basic CLI commands
   */
  async testBasicCommands(): Promise<boolean> {
    console.info('🧪 Testing basic CLI commands...\n');

    const tests = [
      { name: 'Build project', cmd: 'npm', args: ['run', 'build'] },
      { name: 'Lint check', cmd: 'npm', args: ['run', 'lint'] },
      { name: 'Type check', cmd: 'npm', args: ['run', 'type-check'] },
      { name: 'CLI help', cmd: 'node', args: ['dist/cli/index.js', '--help'] },
      { name: 'CLI version', cmd: 'node', args: ['dist/cli/index.js', '--version'] },
    ];

    let allPassed = true;

    for (const test of tests) {
      console.info(`  Testing: ${test.name}`);
      const result = await this.executeCommand(test.cmd, test.args);

      const success = result.exitCode === 0;
      console.info(`    ${success ? '✅' : '❌'} ${test.name} (${result.duration}ms)`);

      if (!success) {
        console.info(`    Error: ${result.stderr.substring(0, 200)}...`);
        allPassed = false;
      }
    }

    return allPassed;
  }
}

async function main(): Promise<void> {
  try {
    const workingDir = join(process.cwd());
    const tester = new SimpleCLITester(workingDir);

    console.info('Starting simple CLI automation test');

    const success = await tester.testBasicCommands();

    console.info('\n=== SIMPLE CLI TEST RESULTS ===');
    console.info(`Overall result: ${success ? '✅ PASSED' : '❌ FAILED'}`);

    if (success) {
      console.info('\n🎉 All basic CLI tests passed!');
      process.exit(0);
    } else {
      console.info('\n💥 Some CLI tests failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('Simple CLI test failed:', error);
    console.error('CLI test failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { SimpleCLITester };
