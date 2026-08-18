import fs from 'fs';
import path from 'path';

export class AccountingTestHarness {
  constructor(runId = `AUTO-INV-${Date.now()}`) {
    this.runId = runId;
    this.startTime = new Date().toISOString();
    this.results = [];
    this.warnings = [];
  }

  assert(id, name, condition, details = '', expected = null, actual = null) {
    const status = condition ? 'PASS' : 'FAIL';
    const entry = {
      id,
      name,
      status,
      details,
      expected: expected !== null ? String(expected) : undefined,
      actual: actual !== null ? String(actual) : undefined,
      timestamp: new Date().toISOString()
    };

    this.results.push(entry);

    if (condition) {
      console.log(`  [PASS] ${id.padEnd(8)}: ${name}`);
      if (details) console.log(`         └─ ${details}`);
    } else {
      console.error(`  [FAIL] ${id.padEnd(8)}: ${name}`);
      console.error(`         ├─ Details:  ${details}`);
      console.error(`         ├─ Expected: ${expected}`);
      console.error(`         └─ Actual:   ${actual}`);
    }

    return condition;
  }

  warn(id, message) {
    this.warnings.push({ id, message, timestamp: new Date().toISOString() });
    console.warn(`  [WARN] ${id.padEnd(8)}: ${message}`);
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const isSuccess = failed === 0;

    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      total,
      passed,
      failed,
      warningsCount: this.warnings.length,
      isSuccess
    };
  }

  exportJson(outputFilePath) {
    const summary = this.getSummary();
    const data = {
      summary,
      results: this.results,
      warnings: this.warnings
    };

    const dir = path.dirname(outputFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\n📄 Machine-readable report saved to: ${outputFilePath}`);
  }

  // Regression-proof testing method to verify the harness itself catches faults
  static testHarnessIntegrity() {
    console.log('\n🔍 Running Regression-Proof Harness Validation...');
    const dummyHarness = new AccountingTestHarness('SELF-TEST');
    
    // Simulate failing condition
    const passedFalse = dummyHarness.assert('SELF-01', 'Intentional Failure Detection', 100 === 200, 'Checking if harness catches inequality', '100', '200');
    const caught = !passedFalse && dummyHarness.results[0].status === 'FAIL';

    if (caught) {
      console.log('  [PASS] HARNESS-INTEGRITY: Assert engine correctly identifies discrepancies (Not always-green)');
      return true;
    } else {
      console.error('  [FAIL] HARNESS-INTEGRITY: Assert engine failed to flag discrepancy!');
      return false;
    }
  }
}
