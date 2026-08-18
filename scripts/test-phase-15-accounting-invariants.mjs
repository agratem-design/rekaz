import path from 'path';
import { fileURLToPath } from 'url';
import { AccountingTestHarness } from './financial-tests/harness.mjs';
import { captureBaselineSnapshot } from './financial-tests/fixtures.mjs';
import { runAllInvariants } from './financial-tests/invariants.mjs';
import { runFinishingCostPlusInvariants } from './financial-tests/finishing-cost-plus-invariants.mjs';
import { runClientCreditInvariants } from './financial-tests/client-credit-invariants.mjs';
import { runClientCreditDbInvariants } from './financial-tests/client-credit-db-invariants.mjs';
import { runGoldenSystemReconciliation } from './financial-tests/golden-reconciliation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('================================================================');
  console.log('   PHASE 15: AUTOMATED ACCOUNTING INVARIANTS TEST RUNNER');
  console.log('================================================================\n');

  const harness = new AccountingTestHarness(`AUTO-INV-${Date.now()}`);

  // 1. Regression-proof self validation
  const harnessValid = AccountingTestHarness.testHarnessIntegrity();
  if (!harnessValid) {
    console.error('Fatal: Test harness integrity check failed!');
    process.exit(1);
  }

  // 2. Pre-Test Baseline Snapshot
  console.log('\n📊 Step 1: Capturing Pre-Test Baseline Snapshot...');
  const baseline = await captureBaselineSnapshot();
  console.log(`   Baseline Total Cash: ${baseline.totalTreasuryBalance} LYD across ${baseline.treasuries.length} accounts`);
  console.log(`   Baseline Transaction Count: ${baseline.treasuryTxCount} postings`);

  // 3. Run all DB Invariants (INV-01 to INV-24)
  console.log('\n⚡ Step 2: Running Automated Accounting Invariants...');
  await runAllInvariants(harness, baseline);

  // 4. Run FC-01 Finishing Cost-Plus & Client Payment Invariants (FINISHING-01 to FINISHING-12, DEDUP-01 to DEDUP-04, CP-01 to CP-06, NO-CROSS-SETTLEMENT-01 to 03)
  await runFinishingCostPlusInvariants(harness);

  // 5. Run FC-02 Client Advance / Credit Domain Invariants (CREDIT-01 to CREDIT-14)
  await runClientCreditInvariants(harness);

  // 6. Run FC-02 Client Credit Database Persistence & Concurrency Invariants (CREDIT-DB-01 to CREDIT-DB-08)
  await runClientCreditDbInvariants(harness, baseline);

  // 7. Run Golden System Read-Only Reconciliation (Contracting Golden Golden-01 to Golden-05)
  console.log('\n🏆 Step 4: Running Golden System Reconciliation...');
  await runGoldenSystemReconciliation(harness);

  // 8. Document Phase 16 candidate findings
  harness.warn('PHASE-16-FINDING-01', 'CHECK (amount > 0) is deferred to Phase 16 Database Hardening');
  harness.warn('PHASE-16-FINDING-02', 'Foreign Key deletion restrictions deferred to Phase 16 Database Hardening');
  harness.warn('PHASE-16-FINDING-03', 'Advisory / Row locks for high-concurrency posting deferred to Phase 16');

  // 9. Export Results
  const reportPath = path.join(rootDir, 'test-results', 'financial-invariants.json');
  harness.exportJson(reportPath);

  // 10. Final Summary & Exit Code
  const summary = harness.getSummary();
  console.log('\n================================================================');
  console.log('                      TEST RUN SUMMARY');
  console.log('================================================================');
  console.log(`  Run ID:         ${summary.runId}`);
  console.log(`  Total Tests:    ${summary.total}`);
  console.log(`  Passed:         ${summary.passed}`);
  console.log(`  Failed:         ${summary.failed}`);
  console.log(`  Warnings:       ${summary.warningsCount} (Documented Phase 16 Candidates)`);
  console.log(`  Status:         ${summary.isSuccess ? 'ALL INVARIANTS PASSED' : 'SOME INVARIANTS FAILED'}`);
  console.log('================================================================\n');

  if (summary.isSuccess) {
    console.log('✓ All accounting invariants passed with 100% mathematical precision.\n');
    process.exit(0);
  } else {
    console.error('✗ Some accounting invariants failed! Please check logs above.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});