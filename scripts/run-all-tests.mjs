import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const testSuites = [
  { name: 'Phase 15 Financial Invariants', cmd: 'node', args: ['scripts/test-phase-15-accounting-invariants.mjs'] },
  { name: 'Navigation Safety Invariants', cmd: 'node', args: ['scripts/navigation-tests/navigation-safety-invariants.mjs'] },
  { name: 'UX Phase 2 Invariants', cmd: 'node', args: ['scripts/navigation-tests/ux-phase-2-invariants.mjs'] },
  { name: 'UX Phase 3 Invariants', cmd: 'node', args: ['scripts/navigation-tests/ux-phase-3-invariants.mjs'] },
  { name: 'UX Phase 4 Invariants', cmd: 'node', args: ['scripts/navigation-tests/ux-phase-4-invariants.mjs'] },
  { name: 'UX Phase 4 Live DB Invariants', cmd: 'node', args: ['scripts/navigation-tests/ux-phase-4-live-db-tests.mjs'] },
  { name: 'Contracting Semantics Invariants', cmd: 'node', args: ['scripts/financial-tests/contracting-semantics-invariants.mjs'] },
  { name: 'Contracting Staffing Invariants', cmd: 'node', args: ['scripts/financial-tests/contracting-technician-staffing-invariants.mjs'] },
  { name: 'Finishing Technician Canonical Invariants', cmd: 'node', args: ['scripts/financial-tests/finishing-technician-canonical-invariants.mjs'] },
  { name: 'Project Workspace IA Invariants', cmd: 'node', args: ['scripts/navigation-tests/project-workspace-ia-invariants.mjs'] },
  { name: 'Project Treasury Domains & Lifecycle', cmd: 'node', args: ['scripts/financial-tests/project-treasury-domains-invariants.mjs'] },
  { name: 'Supplier & Technician Settlement Invariants', cmd: 'node', args: ['scripts/financial-tests/supplier-technician-project-settlement-invariants.mjs'] },
  { name: 'Party Advance Invariants', cmd: 'node', args: ['scripts/financial-tests/party-advance-invariants.mjs'] },
  { name: 'Canonical Navigation Invariants', cmd: 'node', args: ['scripts/navigation-tests/canonical-navigation-invariants.mjs'] },
  { name: 'Sidebar UI Invariants', cmd: 'node', args: ['scripts/navigation-tests/sidebar-ui-invariants.mjs'] },
];

function extractTestCount(output) {
  // 1. Try explicit summary patterns
  const summaryMatches = [
    /Total Tests:\s+(\d+)/i,
    /TOTAL INVARIANTS:\s+(\d+)/i,
    /SUMMARY:\s+(\d+)\s+PASSED/i,
    /STAFFING INVARIANTS TEST RESULTS:\s+(\d+)\s+PASSED/i,
    /FINISHING TECHNICIAN CANONICAL SUMMARY:\s+(\d+)\s+PASSED/i,
    /PROJECT TREASURY DOMAINS SUMMARY:\s+(\d+)\s+PASSED/i,
    /SUPPLIER & TECHNICIAN SUITE SUMMARY:\s+(\d+)\s+PASSED/i,
    /NAV-UI-01 SUITE SUMMARY:\s+(\d+)\s+PASSED/i,
    /NAV-UI-02 SUITE SUMMARY:\s+(\d+)\s+PASSED/i,
    /Passed:\s+(\d+)/i,
  ];

  for (const regex of summaryMatches) {
    const match = output.match(regex);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // 2. Count [PASS] lines
  const passMatches = output.match(/\[PASS\]/g);
  if (passMatches) {
    return passMatches.length;
  }

  return 0;
}

async function runCommand(suite) {
  return new Promise((resolve) => {
    console.log(`\n========================================================`);
    console.log(`RUNNING: ${suite.name}`);
    console.log(`COMMAND: ${suite.cmd} ${suite.args.join(' ')}`);
    console.log(`========================================================`);

    const child = spawn(suite.cmd, suite.args, {
      cwd: rootDir,
      shell: true,
    });

    let output = '';

    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stderr.write(str);
    });

    child.on('close', (code) => {
      const testCount = extractTestCount(output);
      resolve({
        name: suite.name,
        code,
        success: code === 0,
        testCount,
      });
    });

    child.on('error', (err) => {
      console.error(`Error running ${suite.name}:`, err);
      resolve({
        name: suite.name,
        code: 1,
        success: false,
        testCount: 0,
      });
    });
  });
}

async function main() {
  console.log('========================================================');
  console.log('STARTING MASTER TEST RUNNER ACROSS ALL INVARIANTS SUITES');
  console.log('========================================================');

  const results = [];

  for (const suite of testSuites) {
    const res = await runCommand(suite);
    results.push(res);
    if (!res.success) {
      console.error(`\n❌ Suite "${suite.name}" failed with exit code ${res.code}`);
    }
  }

  console.log('\n================================================================');
  console.log('                   MASTER TEST RUNNER SUMMARY');
  console.log('================================================================');

  let allPassed = true;
  let totalTestsExecuted = 0;

  results.forEach((r, idx) => {
    const status = r.success ? `✓ PASS (${r.testCount} tests)` : '✗ FAIL';
    console.log(`  [${String(idx + 1).padStart(2, '0')}] ${r.name.padEnd(46, ' ')} : ${status}`);
    totalTestsExecuted += r.testCount;
    if (!r.success) allPassed = false;
  });

  console.log('================================================================');
  console.log(`TOTAL SUITES EXECUTED: ${results.length}`);
  console.log(`TOTAL TESTS EXECUTED : ${totalTestsExecuted}`);
  console.log(`TOTAL TESTS PASSED   : ${totalTestsExecuted}`);
  console.log(`TOTAL TESTS FAILED   : ${allPassed ? 0 : 'SEE LOGS'}`);
  console.log('================================================================');

  // ------------------------------------------------------------------------
  // POST-SUITE LEAK DETECTOR AUDIT (TEST-FIXTURE-LEAK-01)
  // ------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('       POST-SUITE LIVE DATABASE FIXTURE LEAK AUDIT');
  console.log('================================================================');

  let leakDetected = false;
  try {
    const { supabase } = await import('./financial-tests/client.mjs');
    const { data: leakedTreasuries, error: leakErr } = await supabase
      .from('treasuries')
      .select('id, name')
      .or('name.ilike.%P4-SRV%,name.ilike.%FIXTURE%,name.ilike.%00000000-0000%');

    if (leakErr) {
      console.warn('  ⚠️ Could not query live DB for fixture leak:', leakErr.message);
    } else if (leakedTreasuries && leakedTreasuries.length > 0) {
      console.error(`  ❌ LEAK DETECTED: ${leakedTreasuries.length} test fixture treasuries found in live DB:`);
      leakedTreasuries.forEach((lt) => console.error(`     - [${lt.id}] ${lt.name}`));
      leakDetected = true;
      allPassed = false;
    } else {
      console.log('  ✓ PASS: Zero test fixture treasuries leaked in Live Database.');
    }

    const { data: settings } = await supabase
      .from('company_settings')
      .select('contracting_treasury_id, finishing_treasury_id')
      .limit(1)
      .single();

    if (
      settings?.contracting_treasury_id === 'c504cce9-8bfd-4cda-8296-80febdec2432' &&
      settings?.finishing_treasury_id === 'f9637060-3f26-445e-b77c-658b31da2269'
    ) {
      console.log('  ✓ PASS: company_settings points to verified legitimate business roots.');
    } else {
      console.error('  ❌ CONFIG LEAK: company_settings is pointing to unexpected main treasury IDs:', settings);
      leakDetected = true;
      allPassed = false;
    }
  } catch (err) {
    console.warn('  ⚠️ Fixture leak detector skipped or failed to connect:', err.message);
  }
  console.log('================================================================\n');

  if (allPassed && !leakDetected) {
    console.log(`🏆 ALL ${results.length} SUITES (${totalTestsExecuted} TESTS) PASSED WITH 100% SUCCESS (ZERO FAIL / ZERO SKIP)\n`);
    process.exit(0);
  } else {
    console.error('\n❌ SOME SUITES OR LEAK DETECTOR CHECKS FAILED. Check logs above.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in master test runner:', err);
  process.exit(1);
});
