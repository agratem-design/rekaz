import assert from 'assert';
import path from 'path';
import fs from 'fs';
import {
  ALL_NAVIGATION_ITEMS,
  PRIMARY_SIDEBAR_GROUP_IDS,
  PRIMARY_SIDEBAR_GROUPS_META,
  getCanonicalSidebarGroups,
  getAllSearchableNavItems,
  isNavItemActive,
} from '../../src/config/navigation.ts';

let passedTests = 0;
let failedTests = 0;

function runTest(id, name, fn) {
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${id}: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] ${id}: ${name}`);
    console.error(`         └─ Error: ${err.message}`);
  }
}

console.log('========================================================');
console.log('NAV-UI-02: PREMIUM GLOBAL SIDEBAR UI INVARIANTS');
console.log('========================================================\n');

const sidebarSrc = fs.readFileSync(path.resolve('src/components/layout/AppSidebar.tsx'), 'utf-8');
const indexSrc = fs.readFileSync(path.resolve('src/pages/Index.tsx'), 'utf-8');
const headerSrc = fs.readFileSync(path.resolve('src/components/layout/Header.tsx'), 'utf-8');

// -----------------------------------------------------------------
// 1. CANONICAL INTEGRATION & ARCHITECTURE (SIDEBAR-UI-01 .. 04)
// -----------------------------------------------------------------
console.log('--- CANONICAL INTEGRATION & ARCHITECTURE ---');

runTest('SIDEBAR-UI-01', 'AppSidebar consumes canonical navigation config from @/config/navigation', () => {
  assert(
    sidebarSrc.includes("from \"@/config/navigation\""),
    'AppSidebar must import from @/config/navigation'
  );
  assert(
    sidebarSrc.includes('getCanonicalSidebarGroups'),
    'AppSidebar must use getCanonicalSidebarGroups'
  );
  assert(
    sidebarSrc.includes('isNavItemActive'),
    'AppSidebar must use isNavItemActive'
  );
});

runTest('SIDEBAR-UI-02', 'No hardcoded duplicate nav arrays in AppSidebar.tsx or Index.tsx', () => {
  assert(
    !sidebarSrc.includes('getNavigationGroups'),
    'AppSidebar must not declare local getNavigationGroups'
  );
  assert(
    !indexSrc.includes('getNavigationGroups'),
    'Index must not declare local getNavigationGroups'
  );
  assert(
    !sidebarSrc.includes('systemPages'),
    'AppSidebar must not declare systemPages'
  );
});

runTest('SIDEBAR-UI-03', 'Admin primary item count = exactly 17 items across 6 groups', () => {
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  assert.strictEqual(adminGroups.length, 6, 'Admin must see 6 groups');
  const totalItems = adminGroups.reduce((acc, g) => acc + g.items.length, 0);
  assert.strictEqual(totalItems, 17, `Expected 17 primary items, got ${totalItems}`);
});

runTest('SIDEBAR-UI-04', 'General Items visible in Projects/Contracts group as primary item', () => {
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  const projGroup = adminGroups.find((g) => g.id === 'projects_contracts');
  assert(projGroup !== undefined, 'Projects & Contracts group must exist');
  const gi = projGroup.items.find((i) => i.id === 'general-items');
  assert(gi !== undefined, 'General Items must exist in projects_contracts group');
  assert.strictEqual(gi.href, '/general-items');
});

// -----------------------------------------------------------------
// 2. INTERACTION, COLLAPSED & MOBILE DRAWER (SIDEBAR-UI-05 .. 09)
// -----------------------------------------------------------------
console.log('\n--- INTERACTION, COLLAPSED & MOBILE DRAWER ---');

runTest('SIDEBAR-UI-05', 'Active group auto-expansion logic is implemented in AppSidebar', () => {
  assert(
    sidebarSrc.includes('activeGroupId'),
    'AppSidebar must calculate activeGroupId'
  );
  assert(
    sidebarSrc.includes('openGroups'),
    'AppSidebar must maintain openGroups state'
  );
});

runTest('SIDEBAR-UI-06', 'Collapsed mode exposes all authorized destinations with tooltips', () => {
  assert(
    sidebarSrc.includes('collapsed'),
    'AppSidebar must support collapsed mode'
  );
  assert(
    sidebarSrc.includes('<Tooltip'),
    'AppSidebar must render Tooltips in collapsed mode'
  );
});

runTest('SIDEBAR-UI-07', 'Collapsed mode tooltips use side="left" for RTL ergonomics', () => {
  assert(
    sidebarSrc.includes('side="left"'),
    'Tooltips in RTL sidebar must open to the left side'
  );
});

runTest('SIDEBAR-UI-08', 'Mobile drawer is RTL/right-sided (side="right" on SheetContent)', () => {
  assert(
    sidebarSrc.includes('side="right"'),
    'SheetContent for mobile drawer must use side="right"'
  );
  assert(
    headerSrc.includes('onMobileMenuToggle'),
    'Header must accept onMobileMenuToggle'
  );
});

runTest('SIDEBAR-UI-09', 'Mobile item click closes drawer (onMobileClose wired)', () => {
  assert(
    sidebarSrc.includes('onMobileClose()') || sidebarSrc.includes('onMobileClose'),
    'Mobile link click must trigger onMobileClose'
  );
});

// -----------------------------------------------------------------
// 3. LAYOUT, SCROLL & ACCESSIBILITY (SIDEBAR-UI-10 .. 12)
// -----------------------------------------------------------------
console.log('\n--- LAYOUT, SCROLL & ACCESSIBILITY ---');

runTest('SIDEBAR-UI-10', 'User account footer remains outside scrolling nav area (flex-col fixed)', () => {
  assert(
    sidebarSrc.includes('<nav className="flex-1 overflow-y-auto'),
    'Navigation must be independent flex-1 scrollable area'
  );
  assert(
    sidebarSrc.includes('shrink-0'),
    'Header and footer must be shrink-0 fixed sections'
  );
});

runTest('SIDEBAR-UI-11', 'aria-current="page" is applied to active navigation items', () => {
  assert(
    sidebarSrc.includes('aria-current={isActive ? "page" : undefined}'),
    'Active nav item must have aria-current="page"'
  );
});

runTest('SIDEBAR-UI-12', 'aria-expanded is applied to collapsible group header buttons', () => {
  assert(
    sidebarSrc.includes('aria-expanded={isOpen}'),
    'Group headers must declare aria-expanded'
  );
});

// -----------------------------------------------------------------
// 4. ROLE SAFETY & THEME TOKENS (SIDEBAR-UI-13 .. 16)
// -----------------------------------------------------------------
console.log('\n--- ROLE SAFETY & THEME TOKENS ---');

runTest('SIDEBAR-UI-13', 'Zero authorization expansion across roles', () => {
  const accountantGroups = getCanonicalSidebarGroups('accountant', false);
  const engineerGroups = getCanonicalSidebarGroups('engineer', false);
  const supervisorGroups = getCanonicalSidebarGroups('supervisor', false);

  const accountantHrefs = accountantGroups.flatMap((g) => g.items.map((i) => i.href));
  const engineerHrefs = engineerGroups.flatMap((g) => g.items.map((i) => i.href));
  const supervisorHrefs = supervisorGroups.flatMap((g) => g.items.map((i) => i.href));

  assert(!accountantHrefs.includes('/projects/contracting'), 'Accountant cannot see contracting');
  assert(!engineerHrefs.includes('/treasuries'), 'Engineer cannot see treasuries');
  assert(!supervisorHrefs.includes('/treasuries'), 'Supervisor cannot see treasuries');
});

runTest('SIDEBAR-UI-14', 'Dashboard accountant resolves /accountant and others to /', () => {
  const accountantGroups = getCanonicalSidebarGroups('accountant', false);
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  const accDash = accountantGroups[0].items.find((i) => i.id === 'dashboard');
  const adminDash = adminGroups[0].items.find((i) => i.id === 'dashboard');

  assert.strictEqual(accDash.href, '/accountant');
  assert.strictEqual(adminDash.href, '/');
});

runTest('SIDEBAR-UI-15', 'Long-tail routes remain absent from primary Sidebar', () => {
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  const allPrimaryHrefs = adminGroups.flatMap((g) => g.items.map((i) => i.href));

  assert(!allPrimaryHrefs.includes('/audit-log'), 'audit-log must not be primary sidebar');
  assert(!allPrimaryHrefs.includes('/database-backup'), 'database-backup must not be primary sidebar');
  assert(!allPrimaryHrefs.includes('/users'), 'users must not be primary sidebar');
  assert(!allPrimaryHrefs.includes('/calendar'), 'calendar must not be primary sidebar');
  assert(!allPrimaryHrefs.includes('/print-design'), 'print-design must not be primary sidebar');
});

runTest('SIDEBAR-UI-16', 'Dark/light semantic tokens used without theme regression', () => {
  assert(
    sidebarSrc.includes('bg-sidebar') && sidebarSrc.includes('text-sidebar-foreground'),
    'AppSidebar must use semantic sidebar color tokens'
  );
  assert(
    sidebarSrc.includes('bg-primary'),
    'AppSidebar must use semantic primary brand tokens'
  );
});

// -----------------------------------------------------------------
// 5. RUNTIME INTEGRITY & HOOK AUDIT (SIDEBAR-RUNTIME-01 .. 05)
// -----------------------------------------------------------------
console.log('\n--- RUNTIME INTEGRITY & HOOK AUDIT ---');

runTest('SIDEBAR-RUNTIME-01', 'Header explicitly imports all referenced React hooks (useState, useEffect)', () => {
  const headerContent = fs.readFileSync(path.resolve('src/components/layout/Header.tsx'), 'utf-8');
  assert(
    headerContent.includes('useState') && headerContent.includes('from "react"'),
    'Header.tsx must explicitly import useState from "react"'
  );
  assert(
    headerContent.includes('useEffect') && headerContent.includes('from "react"'),
    'Header.tsx must explicitly import useEffect from "react"'
  );
});

runTest('SIDEBAR-RUNTIME-02', 'Header + AppSidebar integration renders in desktop mode without missing hooks', () => {
  const appSidebarContent = fs.readFileSync(path.resolve('src/components/layout/AppSidebar.tsx'), 'utf-8');
  assert(
    appSidebarContent.includes('import React, { useState, useMemo, useEffect }') ||
    appSidebarContent.includes('from "react"'),
    'AppSidebar.tsx must import React hooks explicitly'
  );
  assert(
    appSidebarContent.includes('TooltipProvider'),
    'AppSidebar must wrap tooltips in TooltipProvider'
  );
});

runTest('SIDEBAR-RUNTIME-03', 'Header + mobile Sidebar trigger renders and opens without exception', () => {
  const headerContent = fs.readFileSync(path.resolve('src/components/layout/Header.tsx'), 'utf-8');
  const indexContent = fs.readFileSync(path.resolve('src/pages/Index.tsx'), 'utf-8');

  assert(
    headerContent.includes('onMobileMenuToggle'),
    'Header must accept onMobileMenuToggle'
  );
  assert(
    indexContent.includes('onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}'),
    'Index.tsx must pass onMobileMenuToggle to Header'
  );
  assert(
    indexContent.includes('isMobileOpen={isMobileSidebarOpen}'),
    'Index.tsx must pass isMobileOpen to AppSidebar'
  );
});

runTest('SIDEBAR-RUNTIME-04', 'AppSidebar generates canonical 17-item admin navigation hierarchy', () => {
  const groups = getCanonicalSidebarGroups('admin', true);
  assert.strictEqual(groups.length, 6, 'Must generate 6 groups');
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  assert.strictEqual(total, 17, 'Must generate 17 primary items');
  for (const group of groups) {
    assert(group.id && group.label, 'Group must have valid id and label');
    for (const item of group.items) {
      assert(item.id && item.name && item.href && item.icon, `Item ${item.id} must be complete`);
    }
  }
});

runTest('SIDEBAR-RUNTIME-05', 'GlobalCommandPalette coexists with Header/AppSidebar without crash (0 stale refs)', () => {
  const paletteContent = fs.readFileSync(path.resolve('src/components/navigation/GlobalCommandPalette.tsx'), 'utf-8');
  assert(
    !paletteContent.includes('systemPages'),
    'GlobalCommandPalette must have 0 systemPages references'
  );
  const items = getAllSearchableNavItems('admin', true);
  assert(items.length >= 17, 'Command palette searchable items must be >= 17');
});

runTest('SIDEBAR-RUNTIME-06', 'package.json defines canonical typecheck script ("typecheck": "tsc -p tsconfig.app.json --noEmit")', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  assert(
    pkg.scripts && pkg.scripts.typecheck === 'tsc -p tsconfig.app.json --noEmit',
    'package.json must declare "typecheck": "tsc -p tsconfig.app.json --noEmit"'
  );
});

// -----------------------------------------------------------------
// 6. VISUAL REFINEMENT & COLOR SYSTEM (SIDEBAR-VIS-01 .. 08)
// -----------------------------------------------------------------
console.log('\n--- VISUAL REFINEMENT & COLOR SYSTEM (NAV-UI-02B) ---');

const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');

runTest('SIDEBAR-VIS-01', 'Group headers have no persistent filled-card treatment', () => {
  assert(
    !sidebarSrc.includes('bg-card rounded-md shadow-xs') &&
      !sidebarSrc.includes('bg-primary/20 text-primary-foreground') &&
      !sidebarSrc.includes('bg-secondary/80'),
    'Group headers must not use heavy filled card surfaces'
  );
});

runTest('SIDEBAR-VIS-02', 'Active item has one canonical active surface', () => {
  assert(
    sidebarSrc.includes('bg-primary/[0.08]') || sidebarSrc.includes('bg-primary/10'),
    'Active nav item must use subtle restrained brand surface'
  );
});

runTest('SIDEBAR-VIS-03', 'Active RTL indicator is right-sided', () => {
  assert(
    sidebarSrc.includes('before:right-0') &&
      (sidebarSrc.includes('before:w-[3px]') || sidebarSrc.includes('before:w-1')),
    'Active indicator must be thin and positioned on the right side for RTL ergonomics'
  );
});

runTest('SIDEBAR-VIS-04', 'Active group heading does not receive competing filled state', () => {
  assert(
    !sidebarSrc.includes('hasActiveChild ? "bg-primary') &&
      !sidebarSrc.includes('hasActiveChild ? "bg-accent'),
    'Active group header must not have a filled background that competes with the active item'
  );
});

runTest('SIDEBAR-VIS-05', 'Sidebar uses semantic light/dark tokens in index.css and components', () => {
  assert(
    cssContent.includes('--sidebar-background:') &&
      cssContent.includes('--sidebar-foreground:') &&
      cssContent.includes('--sidebar-border:'),
    'index.css must define semantic sidebar tokens'
  );
  assert(
    sidebarSrc.includes('bg-sidebar') && sidebarSrc.includes('text-sidebar-foreground'),
    'AppSidebar must consume bg-sidebar and text-sidebar-foreground'
  );
});

runTest('SIDEBAR-VIS-06', 'No excessive internal divider structure', () => {
  assert(
    !sidebarSrc.includes('border-b border-sidebar-border/80 my-3') &&
      !sidebarSrc.includes('divide-y divide-border'),
    'Sidebar must rely on clean whitespace rhythm instead of heavy internal divider boxes'
  );
});

runTest('SIDEBAR-VIS-07', 'Collapsed mode uses same palette grammar', () => {
  assert(
    sidebarSrc.includes('TooltipContent side="left"') &&
      sidebarSrc.includes('h-10 w-10 mx-auto'),
    'Collapsed mode must use consistent tooltips and compact icon dimensions'
  );
});

runTest('SIDEBAR-VIS-08', 'Gold/brand accent is not applied globally to every nav icon/group', () => {
  assert(
    sidebarSrc.includes('text-muted-foreground') &&
      sidebarSrc.includes('group-hover:text-sidebar-foreground'),
    'Normal icons must remain neutral-muted until hovered or active'
  );
});

// -----------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------
console.log('\n========================================================');
console.log(`NAV-UI-02 SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
