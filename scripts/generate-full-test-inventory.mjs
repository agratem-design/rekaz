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

for (const s of suites) {
  const res = spawnSync('node', [s.file], { encoding: 'utf-8' });
  const output = (res.stdout || '') + (res.stderr || '');
  const passLines = output.split('\n').filter(l => l.includes('[PASS]')).map(l => l.replace(/.*\[PASS\]\s*/, '').trim());
  console.log(`\n### Suite ${s.id}: ${s.name} (${passLines.length} assertions)`);
  console.log(`File: \`${s.file}\``);
  passLines.forEach((t, i) => {
    console.log(`${i + 1}. ${t}`);
  });
}
