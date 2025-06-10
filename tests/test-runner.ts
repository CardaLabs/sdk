/**
 * Test runner utility for running specific test suites
 */
import { execSync } from 'child_process';

export interface TestOptions {
  pattern?: string;
  coverage?: boolean;
  watch?: boolean;
  verbose?: boolean;
  timeout?: number;
}

export class TestRunner {
  static runUnit(options: TestOptions = {}): void {
    const cmd = this.buildJestCommand('tests/unit', options);
    console.log(`Running unit tests: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  }

  static runIntegration(options: TestOptions = {}): void {
    const cmd = this.buildJestCommand('tests/integration', options);
    console.log(`Running integration tests: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  }

  static runAll(options: TestOptions = {}): void {
    const cmd = this.buildJestCommand('tests', options);
    console.log(`Running all tests: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  }

  static runSpecific(testFile: string, options: TestOptions = {}): void {
    const cmd = this.buildJestCommand(testFile, options);
    console.log(`Running specific test: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  }

  private static buildJestCommand(path: string, options: TestOptions): string {
    let cmd = 'npx jest';

    cmd += ` ${path}`;

    if (options.pattern) {
      cmd += ` --testNamePattern="${options.pattern}"`;
    }

    if (options.coverage) {
      cmd += ' --coverage';
    }

    if (options.watch) {
      cmd += ' --watch';
    }

    if (options.verbose) {
      cmd += ' --verbose';
    }

    if (options.timeout) {
      cmd += ` --testTimeout=${options.timeout}`;
    }

    return cmd;
  }
}

// CLI usage when run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const options: TestOptions = {
    coverage: args.includes('--coverage'),
    watch: args.includes('--watch'),
    verbose: args.includes('--verbose'),
    pattern: args.find((arg) => arg.startsWith('--pattern='))?.split('=')[1],
    timeout: parseInt(args.find((arg) => arg.startsWith('--timeout='))?.split('=')[1] || '10000'),
  };

  switch (command) {
    case 'unit':
      TestRunner.runUnit(options);
      break;
    case 'integration':
      TestRunner.runIntegration(options);
      break;
    case 'all':
      TestRunner.runAll(options);
      break;
    default:
      if (command && command.endsWith('.test.ts')) {
        TestRunner.runSpecific(command, options);
      } else {
        console.log('Usage: ts-node test-runner.ts [unit|integration|all|<test-file>] [options]');
        console.log('Options:');
        console.log('  --coverage     Generate coverage report');
        console.log('  --watch        Watch mode');
        console.log('  --verbose      Verbose output');
        console.log('  --pattern=X    Test name pattern');
        console.log('  --timeout=X    Test timeout in ms');
      }
  }
}
