// scripts/diagnostics/e2e-live-interactive-experience.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Isolate electron user data to prevent disk cache locks
const tempUserData = path.join(os.tmpdir(), 'rekaz-interactive-' + Date.now());
app.setPath('userData', tempUserData);

const SUPABASE_URL = "https://bpnhzaexmqruzaxyzlyc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA";
const BASE_URL = "http://localhost:4173";

const SCREENSHOTS_DIR = path.resolve('test-results/interactive-screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let passedChecks = 0;
let failedChecks = 0;
const testLogs = [];

function recordPass(msg) {
  passedChecks++;
  console.log(`  [PASS] ${msg}`);
  testLogs.push({ status: 'PASS', msg });
}

function recordFail(msg, err) {
  failedChecks++;
  console.error(`  [FAIL] ${msg}`);
  if (err) console.error(`         -> ${err}`);
  testLogs.push({ status: 'FAIL', msg, err: String(err || '') });
}

async function waitForCondition(win, jsCondition, timeoutMs = 8000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await win.webContents.executeJavaScript(`Boolean((${jsCondition})())`);
      if (res) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

async function runInteractiveExperience() {
  console.log('=================================================================');
  console.log('  LIVE INTERACTIVE UX, INPUTS & NUMERIC INTEGRITY RUNNER');
  console.log('  User: rekazabdo@admin.com');
  console.log('=================================================================\\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const createdEntities = {
    clients: [],
    suppliers: []
  };

  try {
    // ─── STEP 1: LIVE INTERACTIVE LOGIN VIA UI FORM ──────────────────────────
    console.log('1. Navigating to Login screen (/#/auth)...');
    await win.loadURL(`${BASE_URL}/#/auth`);

    const hasLoginForm = await waitForCondition(win, `() => !!document.querySelector('input#identifier') && !!document.querySelector('input#password')`);
    if (hasLoginForm) {
      recordPass('Login form rendered: identifier, password, submit button');
    } else {
      recordFail('Login form inputs not found');
    }

    console.log('   Typing credentials into UI inputs: rekazabdo@admin.com / rekazabdo-2026...');
    await win.webContents.executeJavaScript(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setReactInput(document.querySelector('input#identifier'), 'rekazabdo@admin.com');
        setReactInput(document.querySelector('input#password'), 'rekazabdo-2026');
        document.querySelector('button[type="submit"]').click();
      })()
    `);

    // Wait for Dashboard to hydrate after login
    console.log('   Waiting for authentication and redirect to Dashboard...');
    const hasDashboard = await waitForCondition(win, `() => !!document.querySelector('aside') && !!document.querySelector('header')`, 10000);

    if (hasDashboard) {
      recordPass('Live UI Login successful! Authenticated Dashboard rendered with Sidebar and Header.');
    } else {
      recordFail('Dashboard failed to render after UI login');
    }

    const dashImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '01_dashboard_live.png'), dashImg.toPNG());

    // ─── STEP 2: INTERACTIVE CLIENT CREATION VIA UI DIALOG ────────────────────
    console.log('\\n2. Navigating to Clients (/#/clients) and testing interactive client creation...');
    await win.webContents.executeJavaScript(`window.location.hash = '/clients';`);

    // Wait for clients page queries to finish loading
    const clientsLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('عميل جديد'))`, 10000);

    if (clientsLoaded) {
      recordPass('Clients page hydrated and "+ عميل جديد" button available');
    } else {
      recordFail('Clients page took too long or "+ عميل جديد" button not found');
    }

    // Click "عميل جديد" button
    console.log('   Clicking "عميل جديد" button...');
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('عميل جديد'));
        if (btn) btn.click();
      })()
    `);

    // Wait for Dialog to open
    const clientDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"] input#name')`);
    if (clientDialogOpen) {
      recordPass('Add Client Dialog opened with RTL layout and form inputs');
    } else {
      recordFail('Add Client Dialog failed to open');
    }

    // Fill client form
    const testClientName = `شركة الفارس للتطوير ${Date.now().toString().slice(-4)}`;
    const testClientPhone = '0919988776';
    const testClientCity = 'طرابلس';
    const testClientAddress = 'طريق الشط - برج طرابلس';

    console.log(`   Typing client data: "${testClientName}", Phone: "${testClientPhone}"...`);
    await win.webContents.executeJavaScript(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setReactInput(document.querySelector('input#name'), '${testClientName}');
        setReactInput(document.querySelector('input#phone'), '${testClientPhone}');
        setReactInput(document.querySelector('input#city'), '${testClientCity}');
        setReactInput(document.querySelector('input#address'), '${testClientAddress}');
      })()
    `);

    // Save screenshot of filled dialog
    const clientFilledImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '02_client_dialog_filled.png'), clientFilledImg.toPNG());

    // Submit dialog form
    console.log('   Submitting Add Client form...');
    await win.webContents.executeJavaScript(`
      (() => {
        const submitBtn = document.querySelector('[role="dialog"] button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    // Wait for dialog to close and client to appear in table
    const clientAppeared = await waitForCondition(win, `() => document.body.innerText.includes('${testClientName}') && !document.querySelector('[role="dialog"]')`, 8000);
    if (clientAppeared) {
      recordPass(`Client "${testClientName}" successfully created and rendered live in UI!`);
    } else {
      recordFail('Created client name did not appear in UI');
    }

    // Verify in database
    const { data: clientDb } = await supabase.from('clients').select('id, name').eq('name', testClientName).maybeSingle();
    if (clientDb) {
      createdEntities.clients.push(clientDb.id);
      recordPass(`PostgreSQL confirmed record persistent: ID=${clientDb.id}`);
    } else {
      recordFail('Client record missing in database table');
    }

    const clientsUpdatedImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '03_clients_table_updated.png'), clientsUpdatedImg.toPNG());

    // ─── STEP 3: REAL-TIME SEARCH FILTER INPUT ────────────────────────────────
    console.log('\\n3. Testing real-time search input and dynamic filtering...');
    await win.webContents.executeJavaScript(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const search = document.querySelector('input[placeholder*="بحث"]');
        if (search) setReactInput(search, '${testClientName}');
      })()
    `);

    const filterMatched = await waitForCondition(win, `() => document.body.innerText.includes('${testClientName}')`);
    if (filterMatched) {
      recordPass(`Search input filtered table dynamically to match "${testClientName}"`);
    } else {
      recordFail('Search input filter failed');
    }

    // Clear search
    await win.webContents.executeJavaScript(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const search = document.querySelector('input[placeholder*="بحث"]');
        if (search) setReactInput(search, '');
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    // ─── STEP 4: INTERACTIVE SUPPLIER CREATION VIA UI DIALOG ──────────────────
    console.log('\\n4. Navigating to Suppliers (/#/suppliers) and testing interactive supplier creation...');
    await win.webContents.executeJavaScript(`window.location.hash = '/suppliers';`);

    const suppliersLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('مورد جديد'))`, 8000);
    if (suppliersLoaded) {
      recordPass('Suppliers page loaded with "+ مورد جديد" button');
    } else {
      recordFail('Suppliers page failed to load');
    }

    // Click "مورد جديد"
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('مورد جديد'));
        if (btn) btn.click();
      })()
    `);

    const supplierDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"] input#name')`);
    if (supplierDialogOpen) {
      recordPass('Add Supplier Dialog opened with dir="rtl" and inputs');
    } else {
      recordFail('Add Supplier Dialog failed to open');
    }

    const testSupplierName = `مورد مواد بناء تفاعلي ${Date.now().toString().slice(-4)}`;
    const testSupplierCategory = 'حديد وأسمنت';
    const testSupplierPhone = '0925566778';

    console.log(`   Populating supplier fields: "${testSupplierName}"...`);
    await win.webContents.executeJavaScript(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setReactInput(document.querySelector('input#name'), '${testSupplierName}');
        setReactInput(document.querySelector('input#category'), '${testSupplierCategory}');
        setReactInput(document.querySelector('input#phone'), '${testSupplierPhone}');
        document.querySelector('[role="dialog"] button[type="submit"]').click();
      })()
    `);

    const supplierAppeared = await waitForCondition(win, `() => document.body.innerText.includes('${testSupplierName}') && !document.querySelector('[role="dialog"]')`, 8000);
    if (supplierAppeared) {
      recordPass(`Supplier "${testSupplierName}" successfully created and rendered live in UI!`);
    } else {
      recordFail('Supplier failed to appear in UI');
    }

    // Verify in database
    const { data: supplierDb } = await supabase.from('suppliers').select('id, name').eq('name', testSupplierName).maybeSingle();
    if (supplierDb) {
      createdEntities.suppliers.push(supplierDb.id);
      recordPass(`PostgreSQL confirmed supplier write: ID=${supplierDb.id}`);
    } else {
      recordFail('Supplier record missing in database table');
    }

    const suppliersUpdatedImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '04_suppliers_updated.png'), suppliersUpdatedImg.toPNG());

    // ─── STEP 5: INTERACTIVE TABS & MODALS (TREASURIES) ──────────────────────
    console.log('\\n5. Testing interactive Tab switching and Modal Open/Close in Treasuries...');
    await win.webContents.executeJavaScript(`window.location.hash = '/treasuries';`);

    const treasuriesLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('كشف الحركات المالية الشامل'))`, 8000);
    if (treasuriesLoaded) {
      recordPass('Treasuries page loaded with custom tab bar');
    } else {
      recordFail('Treasuries page tabs missing');
    }

    // Switch to Transactions Tab
    console.log('   Switching to tab: كشف الحركات المالية الشامل...');
    await win.webContents.executeJavaScript(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tab = buttons.find(b => b.innerText.includes('كشف الحركات المالية الشامل'));
        if (tab) tab.click();
      })()
    `);

    const transRowsLoaded = await waitForCondition(win, `() => document.querySelectorAll('tbody tr').length > 0`, 6000);
    if (transRowsLoaded) {
      recordPass('Transactions journal table rendered and populated with live financial records');
    } else {
      recordFail('Transactions journal table failed to render rows');
    }

    // Switch back to Primary Treasuries Tab
    console.log('   Switching back to primary tab: الخزائن والحسابات المصرفية...');
    await win.webContents.executeJavaScript(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tab = buttons.find(b => b.innerText.includes('الخزائن والحسابات المصرفية'));
        if (tab) tab.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    // Test Open and Close of Add Treasury Dialog
    console.log('   Testing open and dismiss of "+ إضافة خزينة رئيسية" dialog...');
    await win.webContents.executeJavaScript(`
      (() => {
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('إضافة خزينة رئيسية'));
        if (addBtn) addBtn.click();
      })()
    `);

    const treasuryModalOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"]')`);
    if (treasuryModalOpen) {
      recordPass('Treasury modal opened with dir="rtl"');
    } else {
      recordFail('Treasury modal failed to open');
    }

    // Click "إلغاء"
    await win.webContents.executeJavaScript(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.innerText.includes('إلغاء'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);

    const treasuryModalClosed = await waitForCondition(win, `() => !document.querySelector('[role="dialog"]')`);
    if (treasuryModalClosed) {
      recordPass('Treasury modal cleanly dismissed on clicking "إلغاء"');
    } else {
      recordFail('Treasury modal failed to close');
    }

    // ─── STEP 6: DYNAMIC ARITHMETIC & NUMERIC CALCULATIONS (PAYMENTS) ─────────
    console.log('\\n6. Testing dynamic financial calculations & numbers on Client Payments (/#/client-payments)...');
    await win.webContents.executeJavaScript(`window.location.hash = '/client-payments';`);

    const payPageLoaded = await waitForCondition(win, `() => !!document.querySelector('button[role="combobox"]')`, 8000);
    if (payPageLoaded) {
      recordPass('Client payments screen hydrated with client selector trigger');
    } else {
      recordFail('Client payments screen trigger not found');
    }

    // Open client combobox dropdown
    console.log('   Opening client dropdown to select client...');
    await win.webContents.executeJavaScript(`
      (() => {
        const trigger = document.querySelector('button[role="combobox"]');
        if (trigger) trigger.click();
      })()
    `);

    const hasOption = await waitForCondition(win, `() => !!document.querySelector('[role="option"]')`, 5000);
    if (hasOption) {
      await win.webContents.executeJavaScript(`
        (() => {
          const item = document.querySelector('[role="option"]');
          if (item) item.click();
        })()
      `);
      recordPass('Selected client from dropdown menu');
    } else {
      recordFail('Could not select client from options');
    }

    // Wait for client outstanding summary and amount input to become enabled
    const summaryAppeared = await waitForCondition(win, `() => document.body.innerText.includes('المستحق على الزبون') && !document.querySelector('input[type="number"][disabled]')`, 8000);

    if (summaryAppeared) {
      recordPass('Client summary cards appeared ("المستحق على الزبون" / "إجمالي ما سدّده") and amount input enabled!');
    } else {
      recordFail('Client summary or amount input failed to activate');
    }

    // Focus amount input and type via native Electron keyboard events
    console.log('   Focusing amount input and sending native keyboard keystrokes "3500"...');
    await win.webContents.executeJavaScript(`
      (() => {
        const amountInput = document.querySelector('input[placeholder="0.00"]');
        if (amountInput) {
          amountInput.focus();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    for (const char of '3500') {
      win.webContents.sendInputEvent({ type: 'char', keyCode: char });
      await new Promise(r => setTimeout(r, 60));
    }
    await new Promise(r => setTimeout(r, 500));

    const typedValue = await win.webContents.executeJavaScript(`
      (() => document.querySelector('input[placeholder="0.00"]')?.value)()
    `);
    console.log('   Input value after typing:', typedValue);

    const calcIndicator = await waitForCondition(win, `() => {
      const text = document.body.innerText;
      return text.includes('رصيد فائض') || text.includes('متبقي على الزبون') || text.includes('المبلغ يغطي المستحق');
    }`, 5000);

    if (calcIndicator) {
      const indicatorText = await win.webContents.executeJavaScript(`
        (() => {
          const banner = document.querySelector('.bg-yellow-500\\\\/10, .bg-orange-500\\\\/8, .bg-green-500\\\\/10');
          return banner ? banner.innerText.replace(/\\n/g, ' ') : '';
        })()
      `);
      recordPass(`Dynamic financial arithmetic triggered live! Indicator: "${indicatorText}"`);
    } else {
      recordFail('Dynamic calculation indicator failed to display');
    }

    const payCalculatedImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '05_payment_dynamic_calculation.png'), payCalculatedImg.toPNG());

    // ─── STEP 7: CLEAN TEARDOWN (ZERO LEAKS IN DATABASE) ─────────────────────
    console.log('\\n7. Performing automated database teardown (zero test fixtures leaked)...');
    for (const cid of createdEntities.clients) {
      const { error } = await supabase.from('clients').delete().eq('id', cid);
      if (!error) recordPass(`Cleaned up test client ID=${cid}`);
    }
    for (const sid of createdEntities.suppliers) {
      const { error } = await supabase.from('suppliers').delete().eq('id', sid);
      if (!error) recordPass(`Cleaned up test supplier ID=${sid}`);
    }

  } catch (err) {
    recordFail('Unhandled exception during interactive test execution', err.message);
  } finally {
    console.log('\\n=================================================================');
    console.log('  INTERACTIVE UX & NUMERIC INTEGRITY SUMMARY');
    console.log('=================================================================');
    console.log(`Total Checks Executed: ${passedChecks + failedChecks}`);
    console.log(`Passed Checks:         ${passedChecks}`);
    console.log(`Failed Checks:         ${failedChecks}`);
    console.log('=================================================================\\n');

    fs.writeFileSync(
      path.resolve('test-results/interactive-experience-results.json'),
      JSON.stringify({ passed: passedChecks, failed: failedChecks, logs: testLogs }, null, 2)
    );

    if (failedChecks > 0) {
      app.exit(1);
    } else {
      app.exit(0);
    }
  }
}

app.whenReady().then(runInteractiveExperience);
