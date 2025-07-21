import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Integration tests for the CLI application
 */
describe('CLI Integration Tests', () => {
  const cliPath = path.join(process.cwd(), 'dist/cli/index.js');

  it('should show help message', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf8' });
    expect(output).toContain('Node.js Job Scraper using Google Dorks');
    expect(output).toContain('search');
    expect(output).toContain('config');
  });

  it('should show version', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const output = execSync(`node ${cliPath} --version`, { encoding: 'utf8' });
    expect(output.trim()).toBe(packageJson.version);
  });

  it('should show search command help', () => {
    const output = execSync(`node ${cliPath} search --help`, { encoding: 'utf8' });
    expect(output).toContain('Search for jobs using Google Dorks');
    expect(output).toContain('--keywords');
    expect(output).toContain('--location');
    expect(output).toContain('--remote');
  });

  it('should show config command help', () => {
    const output = execSync(`node ${cliPath} config --help`, { encoding: 'utf8' });
    expect(output).toContain('Manage configuration');
    expect(output).toContain('--show');
    expect(output).toContain('--reset');
  });

  it('should handle invalid commands gracefully', () => {
    try {
      execSync(`node ${cliPath} invalid-command`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error: unknown) {
      const execError = error as { status: number; stderr: string };
      expect(execError.status).toBe(1);
      expect(execError.stderr).toContain('error');
    }
  });
});
