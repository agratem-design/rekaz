import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const suites = [
  { id: 1, name: 'Phase 15 Financial Invariants', file: 'scripts/test-phase-15-accounting-invariants.mjs' },
  { id: 2, name: 'Navigation Safety Invariants', file: 'scripts/navigation-tests/navigation-safety-invariants.mjs' },
  { id: 3, name: 'UX Phase 2 Invariants', file: 'scripts/navigation-tests/ux-phase-2-invariants.mjs' },
  { id: 4, name: 'UX Phase 3 Invariants', file: 'scripts/navigation-tests/ux-phase-3-invariants.mjs' },
  { id: 5, name: 'UX Phase 4 Invariants', file: 'scripts/navigation-tests/ux-phase-4-invariants.mjs' },
  { id: 6, name: 'UX Phase 4 Live DB Invariants', file: 'scripts/navigation-tests/ux-phase-4-live-db-tests.mjs' },
  { id: 7, name: 'Contracting Semantics Invariants', file: 'scripts/financial-tests/contracting-semantics-invariants.mjs' },
  { id: 8, name: 'Contracting Staffing Invariants', file: 'scripts/financial-tests/contracting-technician-staffing-invariants.mjs' },
  { id: 9, name: 'Finishing Technician Canonical Invariants', file: 'scripts/financial-tests/finishing-technician-canonical-invariants.mjs' },
  { id: 10, name: 'Project Workspace IA Invariants', file: 'scripts/navigation-tests/project-workspace-ia-invariants.mjs' },
  { id: 11, name: 'Project Treasury Domains & Lifecycle', file: 'scripts/financial-tests/project-treasury-domains-invariants.mjs' },
  { id: 12, name: 'Supplier & Technician Settlement Invariants', file: 'scripts/financial-tests/supplier-technician-project-settlement-invariants.mjs' },
  { id: 13, name: 'Canonical Navigation Invariants', file: 'scripts/navigation-tests/canonical-navigation-invariants.mjs' },
  { id: 14, name: 'Sidebar UI Invariants', file: 'scripts/navigation-tests/sidebar-ui-invariants.mjs' },
];

console.log('========================================================');
console.log('FORENSIC INVENTORY & EXECUTION OF ALL 14 TEST SUITES');
console.log('========================================================\n');

let grandTotalTests = 0;
const report = [];

for (const suite of suites) {
  const fullPath = path.resolve(suite.file);
  const fileExists = fs.existsSync(fullPath);
  if (!fileExists) {
    console.error(`File NOT found: ${suite.file}`);
    continue;
  }

  // Execute child process
  const res = spawnSync('node', [suite.file], { encoding: 'utf-8' });
  const output = (res.stdout || '') + (res.stderr || '');
  
  // Count [PASS] instances in actual output
  const passLines = output.split('\n').filter(line => line.includes('[PASS]'));
  const passCount = passLines.length;

  grandTotalTests += passCount;

  report.push({
    id: suite.id,
    name: suite.name,
    file: suite.file,
    exitCode: res.status,
    passCount: passCount,
    firstTest: passLines[0] ? passLines[0].trim() : 'NONE',
    lastTest: passLines[passLines.length - 1] ? passLines[passLines.length - 1].trim() : 'NONE',
  });
}

console.log('ID | Suite Name                                 | Passed | Exit | First Test -> Last Test');
console.log('---+--------------------------------------------+--------+------+-------------------------------------------');
for (const r of report) {
  const idStr = String(r.id).padStart(2, '0');
  const nameStr = r.name.padEnd(42, ' ');
  const countStr = String(r.passCount).padStart(6, ' ');
  const exitStr = String(r.exitCode).padStart(4, ' ');
  console.log(`${idStr} | ${nameStr} | ${countStr} | ${exitStr} | ${r.firstTest.slice(0, 30)}... -> ${r.lastTest.slice(0, 30)}...`);
}

console.log('---+--------------------------------------------+--------+------+-------------------------------------------');
console.log(`TOTAL MACHINE-COUNTED [PASS] ASSERTIONS: ${grandTotalTests}`);
console.log('========================================================\n');
