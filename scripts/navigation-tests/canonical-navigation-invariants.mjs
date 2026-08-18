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
console.log('NAV-UI-01: CANONICAL GLOBAL NAVIGATION METADATA INVARIANTS');
console.log('========================================================\n');

// -----------------------------------------------------------------
// 1. HIERARCHY & EXACT COUNTS INVARIANTS (NAVCFG-01 .. 02)
// -----------------------------------------------------------------
console.log('--- HIERARCHY & EXACT COUNTS INVARIANTS ---');

runTest('NAVCFG-01', 'Global group count = exactly 6 groups', () => {
  assert.strictEqual(
    PRIMARY_SIDEBAR_GROUP_IDS.length,
    6,
    `Expected exactly 6 group IDs, got ${PRIMARY_SIDEBAR_GROUP_IDS.length}`
  );
  assert.strictEqual(
    Object.keys(PRIMARY_SIDEBAR_GROUPS_META).length,
    6,
    `Expected exactly 6 groups in metadata, got ${Object.keys(PRIMARY_SIDEBAR_GROUPS_META).length}`
  );
});

runTest('NAVCFG-02', 'Primary Sidebar item count = exactly 17 items (1+4+3+5+2+2)', () => {
  const primaryItems = ALL_NAVIGATION_ITEMS.filter((i) => i.isPrimarySidebar);
  assert.strictEqual(
    primaryItems.length,
    17,
    `Expected exactly 17 primary sidebar items, got ${primaryItems.length}`
  );

  const groupCounts = PRIMARY_SIDEBAR_GROUP_IDS.map(
    (gId) => primaryItems.filter((i) => i.groupId === gId).length
  );
  assert.deepStrictEqual(
    groupCounts,
    [1, 4, 3, 5, 2, 2],
    `Expected group counts [1, 4, 3, 5, 2, 2], got ${JSON.stringify(groupCounts)}`
  );
});

// -----------------------------------------------------------------
// 2. ROLE-SAFE VISIBILITY & BOUNDARIES (NAVCFG-03 .. 10)
// -----------------------------------------------------------------
console.log('\n--- ROLE-SAFE VISIBILITY INVARIANTS ---');

runTest('NAVCFG-03', 'Admin visibility equals allowed target set (17 primary items in 6 groups)', () => {
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  assert.strictEqual(adminGroups.length, 6, 'Admin must see all 6 groups');
  const totalAdminItems = adminGroups.reduce((sum, g) => sum + g.items.length, 0);
  assert.strictEqual(totalAdminItems, 17, 'Admin must see all 17 primary items');
});

runTest('NAVCFG-04', 'Accountant does not gain Project routes (/projects/contracting & finishing)', () => {
  const accountantGroups = getCanonicalSidebarGroups('accountant', false);
  const accountantHrefs = accountantGroups.flatMap((g) => g.items.map((i) => i.href));
  assert(
    !accountantHrefs.includes('/projects/contracting'),
    'Accountant must not have /projects/contracting in sidebar'
  );
  assert(
    !accountantHrefs.includes('/projects/finishing'),
    'Accountant must not have /projects/finishing in sidebar'
  );
});

runTest('NAVCFG-05', 'Engineer does not gain Finance routes (/treasuries, /expenses, /transfers, etc.)', () => {
  const engineerGroups = getCanonicalSidebarGroups('engineer', false);
  const engineerHrefs = engineerGroups.flatMap((g) => g.items.map((i) => i.href));
  assert(!engineerHrefs.includes('/treasuries'), 'Engineer must not see /treasuries');
  assert(!engineerHrefs.includes('/expenses'), 'Engineer must not see /expenses');
  assert(!engineerHrefs.includes('/transfers'), 'Engineer must not see /transfers');
  assert(!engineerHrefs.includes('/invoice-control'), 'Engineer must not see /invoice-control');
});

runTest('NAVCFG-06', 'Supervisor does not gain Treasury/Finance routes', () => {
  const supervisorGroups = getCanonicalSidebarGroups('supervisor', false);
  const supervisorHrefs = supervisorGroups.flatMap((g) => g.items.map((i) => i.href));
  assert(!supervisorHrefs.includes('/treasuries'), 'Supervisor must not see /treasuries');
  assert(!supervisorHrefs.includes('/expenses'), 'Supervisor must not see /expenses');
  assert(!supervisorHrefs.includes('/transfers'), 'Supervisor must not see /transfers');
});

runTest('NAVCFG-07', 'Employee gains zero unauthorized global links (empty sidebar)', () => {
  const employeeGroups = getCanonicalSidebarGroups('employee', false);
  assert.strictEqual(
    employeeGroups.length,
    0,
    'Employee has no primary global navigation links under current authority'
  );
});

runTest('NAVCFG-08', 'Contracts remains admin-only', () => {
  const contractsItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'contracts');
  assert.deepStrictEqual(contractsItem.roles, ['admin'], 'Contracts must be restricted to admin');
});

runTest('NAVCFG-09', 'Reports remains admin-only', () => {
  const reportsItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'reports');
  assert.deepStrictEqual(reportsItem.roles, ['admin'], 'Reports must be restricted to admin');
});

runTest('NAVCFG-10', 'Settings remains admin-only', () => {
  const settingsItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'settings');
  assert.deepStrictEqual(settingsItem.roles, ['admin'], 'Settings must be restricted to admin');
});

// -----------------------------------------------------------------
// 3. DASHBOARD SPECIAL CASE & RESOLVER (NAVCFG-11 .. 16)
// -----------------------------------------------------------------
console.log('\n--- DASHBOARD SPECIAL CASE & RESOLVER INVARIANTS ---');

runTest('NAVCFG-11', 'Admin Dashboard destination = "/"', () => {
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  const dashboard = adminGroups[0].items.find((i) => i.id === 'dashboard');
  assert.strictEqual(dashboard.href, '/');
});

runTest('NAVCFG-12', 'Engineer Dashboard destination = "/"', () => {
  const engineerGroups = getCanonicalSidebarGroups('engineer', false);
  const dashboard = engineerGroups[0].items.find((i) => i.id === 'dashboard');
  assert.strictEqual(dashboard.href, '/');
});

runTest('NAVCFG-13', 'Supervisor Dashboard destination = "/"', () => {
  const supervisorGroups = getCanonicalSidebarGroups('supervisor', false);
  const dashboard = supervisorGroups[0].items.find((i) => i.id === 'dashboard');
  assert.strictEqual(dashboard.href, '/');
});

runTest('NAVCFG-14', 'Accountant Dashboard destination = "/accountant"', () => {
  const accountantGroups = getCanonicalSidebarGroups('accountant', false);
  const dashboard = accountantGroups[0].items.find((i) => i.id === 'dashboard');
  assert.strictEqual(dashboard.href, '/accountant');
});

runTest('NAVCFG-15', 'Employee Dashboard item = not visible', () => {
  const employeeGroups = getCanonicalSidebarGroups('employee', false);
  const dashboard = employeeGroups.flatMap((g) => g.items).find((i) => i.id === 'dashboard');
  assert.strictEqual(dashboard, undefined);
});

runTest('NAVCFG-16', 'Both "/" and "/accountant" map to same visual Dashboard nav identity', () => {
  const dashboardItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'dashboard');
  assert.strictEqual(isNavItemActive(dashboardItem, '/', 'admin'), true);
  assert.strictEqual(isNavItemActive(dashboardItem, '/accountant', 'accountant'), true);
  assert.strictEqual(isNavItemActive(dashboardItem, '/accountant', 'admin'), true);
  assert.strictEqual(isNavItemActive(dashboardItem, '/clients', 'admin'), false);
});

// -----------------------------------------------------------------
// 4. LONG-TAIL ACCESSIBILITY & SEARCHABILITY (NAVCFG-17 .. 21)
// -----------------------------------------------------------------
console.log('\n--- LONG-TAIL ACCESSIBILITY & SEARCHABILITY INVARIANTS ---');

runTest('NAVCFG-17', 'Removed Sidebar route /audit-log still exists in Command Palette for admin', () => {
  const searchItems = getAllSearchableNavItems('admin', true);
  const auditLog = searchItems.find((i) => i.href === '/audit-log');
  assert(auditLog !== undefined, '/audit-log must be searchable for admin');
});

runTest('NAVCFG-18', '/database-backup still searchable for admin', () => {
  const searchItems = getAllSearchableNavItems('admin', true);
  const backup = searchItems.find((i) => i.href === '/database-backup');
  assert(backup !== undefined, '/database-backup must be searchable for admin');
});

runTest('NAVCFG-19', '/general-items still searchable for existing authorized roles', () => {
  const adminSearch = getAllSearchableNavItems('admin', true);
  const supervisorSearch = getAllSearchableNavItems('supervisor', false);
  const accountantSearch = getAllSearchableNavItems('accountant', false);
  assert(adminSearch.some((i) => i.href === '/general-items'), 'Admin must find /general-items');
  assert(supervisorSearch.some((i) => i.href === '/general-items'), 'Supervisor must find /general-items');
  assert(!accountantSearch.some((i) => i.href === '/general-items'), 'Accountant must not find /general-items');
});

runTest('NAVCFG-20', '/rentals still searchable for existing authorized roles', () => {
  const adminSearch = getAllSearchableNavItems('admin', true);
  const supervisorSearch = getAllSearchableNavItems('supervisor', false);
  assert(adminSearch.some((i) => i.href === '/rentals'), 'Admin must find /rentals');
  assert(supervisorSearch.some((i) => i.href === '/rentals'), 'Supervisor must find /rentals');
});

runTest('NAVCFG-21', '/client-activities still searchable for existing authorized roles', () => {
  const adminSearch = getAllSearchableNavItems('admin', true);
  const accountantSearch = getAllSearchableNavItems('accountant', false);
  const engineerSearch = getAllSearchableNavItems('engineer', false);
  assert(adminSearch.some((i) => i.href === '/client-activities'), 'Admin must find /client-activities');
  assert(accountantSearch.some((i) => i.href === '/client-activities'), 'Accountant must find /client-activities');
  assert(!engineerSearch.some((i) => i.href === '/client-activities'), 'Engineer must not find /client-activities');
});

// -----------------------------------------------------------------
// 5. ACTIVE STATE RESOLUTION (NAVCFG-22 .. 26)
// -----------------------------------------------------------------
console.log('\n--- ACTIVE STATE RESOLUTION INVARIANTS ---');

runTest('NAVCFG-22', '/suppliers/:id activates Suppliers', () => {
  const suppliersItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'suppliers');
  assert.strictEqual(
    isNavItemActive(suppliersItem, '/suppliers/55555555-5555-5555-5555-555555555555'),
    true
  );
  assert.strictEqual(isNavItemActive(suppliersItem, '/clients'), false);
});

runTest('NAVCFG-23', '/technicians/:id activates Technicians', () => {
  const techsItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'technicians');
  assert.strictEqual(
    isNavItemActive(techsItem, '/technicians/33333333-3333-3333-3333-333333333333'),
    true
  );
  assert.strictEqual(isNavItemActive(techsItem, '/suppliers'), false);
});

runTest('NAVCFG-24', '/treasuries/:id activates Treasuries', () => {
  const treasuriesItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'treasuries');
  assert.strictEqual(
    isNavItemActive(treasuriesItem, '/treasuries/11111111-1111-1111-1111-111111111111'),
    true
  );
  assert.strictEqual(isNavItemActive(treasuriesItem, '/expenses'), false);
});

runTest('NAVCFG-25', '/contracts/:id activates Contracts', () => {
  const contractsItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'contracts');
  assert.strictEqual(
    isNavItemActive(contractsItem, '/contracts/99999999-9999-9999-9999-999999999999'),
    true
  );
  assert.strictEqual(isNavItemActive(contractsItem, '/projects/contracting'), false);
});

runTest('NAVCFG-26', '/accountant activates Dashboard visual identity', () => {
  const dashboardItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'dashboard');
  assert.strictEqual(isNavItemActive(dashboardItem, '/accountant', 'accountant'), true);
});

// -----------------------------------------------------------------
// 6. RUNTIME INTEGRITY & STALE VARIABLE GUARDS (NAVCFG-RUNTIME-01 .. 03)
// -----------------------------------------------------------------
console.log('\n--- RUNTIME INTEGRITY & STALE VARIABLE GUARDS ---');

runTest('NAVCFG-RUNTIME-01', 'GlobalCommandPalette source code has ZERO undefined / stale variables (0 systemPages references)', () => {
  const paletteSrc = fs.readFileSync(path.resolve('src/components/navigation/GlobalCommandPalette.tsx'), 'utf-8');
  const indexSrc = fs.readFileSync(path.resolve('src/pages/Index.tsx'), 'utf-8');
  const sidebarSrc = fs.readFileSync(path.resolve('src/components/layout/AppSidebar.tsx'), 'utf-8');

  assert(
    !paletteSrc.includes('systemPages'),
    'GlobalCommandPalette.tsx must not contain any stale systemPages references'
  );
  assert(
    !indexSrc.includes('getNavigationGroups') && !sidebarSrc.includes('getNavigationGroups'),
    'Navigation components must not declare duplicate getNavigationGroups'
  );
  assert(
    paletteSrc.includes('getAllSearchableNavItems'),
    'GlobalCommandPalette.tsx must import and use getAllSearchableNavItems'
  );
  assert(
    sidebarSrc.includes('getCanonicalSidebarGroups'),
    'AppSidebar.tsx must import and use getCanonicalSidebarGroups'
  );
});

runTest('NAVCFG-RUNTIME-02', 'Ctrl+K searchable items are derived from canonical navigation config', () => {
  const adminItems = getAllSearchableNavItems('admin', true);
  assert(adminItems.length >= 16, 'Admin searchable items must include primary and long-tail items');
  assert(adminItems.some((i) => i.id === 'dashboard'));
  assert(adminItems.some((i) => i.id === 'contracts'));
  assert(adminItems.some((i) => i.id === 'audit-log'));
  assert(adminItems.some((i) => i.id === 'database-backup'));
  assert(adminItems.some((i) => i.id === 'general-items'));
});

runTest('NAVCFG-RUNTIME-03', 'Accountant Dashboard result resolves to /accountant', () => {
  const accountantItems = getAllSearchableNavItems('accountant', false);
  const dashboard = accountantItems.find((i) => i.id === 'dashboard');
  assert(dashboard !== undefined, 'Accountant must have dashboard');
  assert.strictEqual(dashboard.href, '/accountant', 'Accountant dashboard must resolve to /accountant');
});

// -----------------------------------------------------------------
// 7. GENERAL ITEMS BUSINESS NAVIGATION CORRECTION (NAVCFG-GI-01 .. 08)
// -----------------------------------------------------------------
console.log('\n--- GENERAL ITEMS BUSINESS NAVIGATION INVARIANTS ---');

runTest('NAVCFG-GI-01', 'Group count = exactly 6', () => {
  assert.strictEqual(PRIMARY_SIDEBAR_GROUP_IDS.length, 6);
});

runTest('NAVCFG-GI-02', 'Primary Sidebar item count = exactly 17 items', () => {
  const primaryItems = ALL_NAVIGATION_ITEMS.filter((i) => i.isPrimarySidebar);
  assert.strictEqual(primaryItems.length, 17);
});

runTest('NAVCFG-GI-03', 'General Items belongs to projects_contracts group', () => {
  const giItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'general-items');
  assert(giItem !== undefined, 'General items must exist in navigation items');
  assert.strictEqual(giItem.groupId, 'projects_contracts');
  assert.strictEqual(giItem.isPrimarySidebar, true);
});

runTest('NAVCFG-GI-04', 'General Items visible to existing authorized roles only (admin, supervisor)', () => {
  const giItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'general-items');
  assert.deepStrictEqual(giItem.roles.sort(), ['admin', 'supervisor'].sort());
  const adminGroups = getCanonicalSidebarGroups('admin', true);
  const supervisorGroups = getCanonicalSidebarGroups('supervisor', false);
  assert(adminGroups.flatMap((g) => g.items).some((i) => i.id === 'general-items'));
  assert(supervisorGroups.flatMap((g) => g.items).some((i) => i.id === 'general-items'));
});

runTest('NAVCFG-GI-05', 'Measurement Types remains non-primary but searchable/reachable', () => {
  const mtItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'measurement-types');
  assert(mtItem !== undefined);
  assert.strictEqual(mtItem.isPrimarySidebar, false);
  const adminSearch = getAllSearchableNavItems('admin', true);
  assert(adminSearch.some((i) => i.id === 'measurement-types'));
});

runTest('NAVCFG-GI-06', 'General Items remains searchable in Command Palette', () => {
  const adminSearch = getAllSearchableNavItems('admin', true);
  const giSearch = adminSearch.find((i) => i.id === 'general-items');
  assert(giSearch !== undefined);
  assert.strictEqual(giSearch.href, '/general-items');
});

runTest('NAVCFG-GI-07', '/general-items active-state works correctly', () => {
  const giItem = ALL_NAVIGATION_ITEMS.find((i) => i.id === 'general-items');
  assert.strictEqual(isNavItemActive(giItem, '/general-items'), true);
  assert.strictEqual(isNavItemActive(giItem, '/projects/contracting'), false);
});

runTest('NAVCFG-GI-08', 'No authorization expansion for General Items', () => {
  const accountantGroups = getCanonicalSidebarGroups('accountant', false);
  const engineerGroups = getCanonicalSidebarGroups('engineer', false);
  const employeeGroups = getCanonicalSidebarGroups('employee', false);
  assert(!accountantGroups.flatMap((g) => g.items).some((i) => i.id === 'general-items'));
  assert(!engineerGroups.flatMap((g) => g.items).some((i) => i.id === 'general-items'));
  assert(!employeeGroups.flatMap((g) => g.items).some((i) => i.id === 'general-items'));
});

// -----------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------
console.log('\n========================================================');
console.log(`NAV-UI-01 SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
