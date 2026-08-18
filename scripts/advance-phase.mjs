#!/usr/bin/env node
/**
 * سكريبت إدارة وتتبع مراحل إعادة بناء النظام المالي
 * Financial Rebuild Playbook Runner & Phase Tracker
 * 
 * المرجع: MASTER_FINANCIAL_SYSTEM_REBUILD_PLAYBOOK_AR.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const controlFilePath = path.join(rootDir, 'docs', 'financial-system-rebuild.md');

const PHASES = [
  { id: 0, name: 'إنشاء نظام التحكم والتوثيق', doc: 'docs/financial-system-rebuild.md' },
  { id: 1, name: 'AUDIT شامل بدون تعديل', doc: 'docs/financial-audit-phase-1.md' },
  { id: 2, name: 'Target Financial Architecture', doc: 'docs/financial-target-architecture.md' },
  { id: 3, name: 'Backup + Financial Baseline', doc: 'docs/financial-baseline-before-fix.md' },
  { id: 4, name: 'إصلاح Client Payments', doc: 'docs/phase-4-client-payments.md' },
  { id: 5, name: 'إصلاح Purchases + Suppliers', doc: 'docs/phase-5-purchases-suppliers.md' },
  { id: 6, name: 'إصلاح Technicians', doc: 'docs/phase-6-technicians.md' },
  { id: 7, name: 'إصلاح Expenses', doc: 'docs/phase-7-expenses.md' },
  { id: 8, name: 'إصلاح Transfers بين الخزائن', doc: 'docs/phase-8-transfers.md' },
  { id: 9, name: 'إزالة Double Accounting من Frontend', doc: 'docs/phase-9-frontend-cleanup.md' },
  { id: 10, name: 'تنظيف البيانات التاريخية المكررة', doc: 'docs/financial-historical-cleanup.md' },
  { id: 11, name: 'إعادة بناء ومطابقة الأرصدة', doc: 'docs/phase-11-reconciliation.md' },
  { id: 12, name: 'الملخص المالي للمشاريع', doc: 'docs/phase-12-project-financial-summary.md' },
  { id: 13, name: 'التقارير وكشوف الحسابات والطباعة', doc: 'docs/phase-13-reports.md' },
  { id: 14, name: 'Full End-to-End Financial Test', doc: 'docs/phase-14-e2e-tests.md' },
  { id: 15, name: 'Automated Accounting Invariants', doc: 'docs/phase-15-accounting-invariants.md' },
  { id: 16, name: 'Database Hardening', doc: 'docs/phase-16-database-hardening.md' },
  { id: 17, name: 'Final Independent Audit', doc: 'docs/phase-17-final-audit.md' }
];

function getStatus() {
  if (!fs.existsSync(controlFilePath)) {
    console.error('Error: Control file not found at:', controlFilePath);
    process.exit(1);
  }

  const content = fs.readFileSync(controlFilePath, 'utf8');
  const statusMap = {};

  PHASES.forEach(p => {
    const regex = new RegExp(`\\|\\s*\\*\\*PHASE\\s*${p.id}\\*\\*\\s*\\|.*?\\|\\s*\\*\\*?(COMPLETE|IN_PROGRESS|BLOCKED|NOT STARTED)\\*\\*?\\s*\\|`, 'i');
    const match = content.match(regex);
    statusMap[p.id] = match ? match[1].toUpperCase() : 'NOT STARTED';
  });

  return { content, statusMap };
}

function displayStatus() {
  const { statusMap } = getStatus();
  console.log('\n===============================================================');
  console.log('   خطة إعادة بناء النظام المالي — لوحة التحكم ومتابعة المراحل');
  console.log('===============================================================\n');

  let currentFound = false;
  let nextPhase = null;

  PHASES.forEach(p => {
    const st = statusMap[p.id];
    let icon = '[ ]';
    if (st === 'COMPLETE') icon = '[✓]';
    else if (st === 'IN_PROGRESS') icon = '[►]';
    else if (st === 'BLOCKED') icon = '[✗]';

    const docExists = p.doc && fs.existsSync(path.join(rootDir, p.doc)) ? ' (ملف التوثيق متاح)' : '';
    console.log(`${icon} PHASE ${p.id.toString().padEnd(2)}: ${p.name.padEnd(36)} -> [${st}]${docExists}`);

    if (!currentFound && st !== 'COMPLETE') {
      nextPhase = p;
      currentFound = true;
    }
  });

  console.log('\n---------------------------------------------------------------');
  if (nextPhase) {
    console.log(`▶ المرحلة النشطة التالية المستهدفة: PHASE ${nextPhase.id} — ${nextPhase.name}`);
    console.log(`▶ ملف المخرجات المطلوب: ${nextPhase.doc}`);
  } else {
    console.log('🎉 جميع مراحل النظام المالي مكتملة بنجاح 100%!');
  }
  console.log('===============================================================\n');
}

function advanceToPhase(targetPhaseId) {
  const { content, statusMap } = getStatus();
  const target = PHASES.find(p => p.id === targetPhaseId);
  if (!target) {
    console.error(`Error: Phase ${targetPhaseId} does not exist.`);
    process.exit(1);
  }

  // Check previous phase
  if (targetPhaseId > 0 && statusMap[targetPhaseId - 1] !== 'COMPLETE') {
    console.error(`Cannot advance to Phase ${targetPhaseId}. Phase ${targetPhaseId - 1} is not COMPLETE yet.`);
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0];

  // Update table row in control file
  const regex = new RegExp(`(\\|\\s*\\*\\*PHASE\\s*${targetPhaseId}\\*\\*\\s*\\|.*?\\|\\s*\\*\\*?)[^|]+(\\*\\*?\\s*\\|\\s*)[^|]+(\\|)`, 'i');
  let updatedContent = content.replace(regex, `$1COMPLETE$2${today} $3`);

  fs.writeFileSync(controlFilePath, updatedContent, 'utf8');
  console.log(`\n✓ تم تحديث المرحلة بنجاح: PHASE ${targetPhaseId} [${target.name}] = COMPLETE`);
  displayStatus();
}

const action = process.argv[2] || 'status';

if (action === 'status') {
  displayStatus();
} else if (action === 'advance') {
  const phaseId = parseInt(process.argv[3], 10);
  if (isNaN(phaseId)) {
    console.error('Usage: node scripts/advance-phase.mjs advance <phase_number>');
    process.exit(1);
  }
  advanceToPhase(phaseId);
} else {
  console.log('Usage:');
  console.log('  node scripts/advance-phase.mjs status         (عرض حالة المراحل)');
  console.log('  node scripts/advance-phase.mjs advance <N>    (إغلاق المرحلة N والانتقال للتالية)');
}
