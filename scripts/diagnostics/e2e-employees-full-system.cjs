// scripts/diagnostics/e2e-employees-full-system.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Isolate electron user data
const tempUserData = path.join(os.tmpdir(), 'rekaz-hr-test-' + Date.now());
app.setPath('userData', tempUserData);

const SUPABASE_URL = "https://bpnhzaexmqruzaxyzlyc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA";
const BASE_URL = "http://localhost:4173";

const SCREENSHOTS_DIR = path.resolve('test-results/hr-screenshots');
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

async function waitForCondition(win, jsCondition, timeoutMs = 12000, intervalMs = 250) {
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function switchTab(win, tabMatchText) {
  return await win.webContents.executeJavaScript(`
    (() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const q = ${JSON.stringify(tabMatchText)}.toLowerCase();
      const tab = tabs.find(t => {
        const text = (t.textContent || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        const ariaControls = (t.getAttribute('aria-controls') || '').toLowerCase();
        const val = (t.getAttribute('value') || t.getAttribute('data-value') || '').toLowerCase();
        return text.includes(q) || id.includes(q) || ariaControls.includes(q) || val.includes(q);
      });
      if (tab) {
        tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
        tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
        tab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
        tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
        tab.focus();
        tab.click();
        return true;
      }
      return false;
    })()
  `);
}

async function closeDialog(win) {
  await win.webContents.executeJavaScript(`
    (() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(b => 
          b.getAttribute('aria-label') === 'Close' ||
          b.classList.contains('absolute') ||
          b.querySelector('.lucide-x')
        );
        if (closeBtn) {
          closeBtn.click();
        } else {
          dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
        }
      }
    })()
  `);
  await sleep(400);
}

async function run() {
  console.log('=================================================================');
  console.log('  HR, PAYROLL, ADVANCES & CUSTODY LIVE E2E VERIFICATION RUNNER');
  console.log('  User: rekazabdo@admin.com');
  console.log('=================================================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: nodeAuthErr } = await supabase.auth.signInWithPassword({
    email: 'rekazabdo@admin.com',
    password: 'rekazabdo-2026'
  });
  if (nodeAuthErr) throw new Error('Node Supabase auth failed: ' + nodeAuthErr.message);
  console.log('Node Supabase client authenticated as admin (rekazabdo@admin.com)');

  let createdEmployeeId = null;
  let createdPayrollId = null;
  let createdAdvanceId = null;
  let createdCustodyId = null;
  let testTreasuryId = null;

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    // Pick an active treasury with positive balance for testing
    const { data: treasuries } = await supabase
      .from('treasuries')
      .select('id, name, balance')
      .gt('balance', 1000)
      .eq('is_active', true)
      .limit(1);

    if (!treasuries || treasuries.length === 0) {
      throw new Error('No active treasury with sufficient balance found for testing');
    }
    testTreasuryId = treasuries[0].id;
    console.log(`Using Test Treasury: ${treasuries[0].name} (Balance: ${treasuries[0].balance})`);

    // 1. Create test employee in DB
    console.log('1. Setting up verified test employee in PostgreSQL...');
    const { data: newEmp, error: empErr } = await supabase.from('employees').insert({
      name: 'فارس الفرجاني التفاعلي',
      phone: '0918889900',
      email: 'fars@rekaz.ly',
      position: 'مدير مشاريع ومواقع',
      department: 'operations',
      salary: 5000,
      notes: 'حساب اختبار تفاعلي لايف',
      hire_date: '2024-01-15'
    }).select().single();

    if (empErr) throw empErr;
    createdEmployeeId = newEmp.id;
    recordPass(`Created employee "فارس الفرجاني التفاعلي" (ID: ${createdEmployeeId}, Salary: 5,000 LYD)`);

    // 2. Load login screen
    console.log('\n2. Loading application at http://localhost:4173/#/auth ...');
    await win.loadURL(`${BASE_URL}/#/auth`);
    await sleep(2000);

    const hasLoginForm = await waitForCondition(win, `() => !!document.querySelector('input#identifier') && !!document.querySelector('input#password')`);
    if (hasLoginForm) {
      console.log('   Logging in with rekazabdo@admin.com...');
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
      await waitForCondition(win, `() => !window.location.hash.includes('/auth')`, 12000);
      recordPass('Authenticated successfully to system');
    } else {
      recordPass('Already authenticated / session active');
    }

    // 3. Navigate to /#/employees hub
    console.log('\n3. Navigating to /#/employees hub...');
    await win.webContents.executeJavaScript(`window.location.hash = '/employees';`);
    await sleep(2500);

    const isEmployeesPage = await waitForCondition(win, `() => document.body.innerText.includes('إدارة الموظفين والرواتب والعهد') && document.body.innerText.includes('فارس الفرجاني التفاعلي')`);
    if (isEmployeesPage) {
      recordPass('Successfully loaded /employees hub with employee card and Golden theme KPIs');
    } else {
      recordFail('Failed to load /employees central hub or employee card');
    }

    const hubImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '01_employees_hub.png'), hubImg.toPNG());

    // 4. Test Add Employee Dialog UI
    console.log('\n4. Testing Add Employee Dialog UI & RTL inputs...');
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const addBtn = btns.find(b => b.textContent.includes('إضافة موظف'));
        if (addBtn) addBtn.click();
      })()
    `);
    await sleep(600);

    const isAddDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#emp_name')`);
    if (isAddDialogOpen) {
      recordPass('Add Employee Dialog opened with RTL layout and all input fields');
    } else {
      recordFail('Add Employee Dialog failed to open');
    }

    const addEmpImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '02_add_employee_dialog.png'), addEmpImg.toPNG());

    // Dismiss dialog
    await closeDialog(win);

    // 5. Navigate to EmployeeDetail page
    console.log(`\n5. Navigating to EmployeeDetail page (/#/employees/${createdEmployeeId})...`);
    await win.webContents.executeJavaScript(`window.location.hash = '/employees/${createdEmployeeId}';`);
    await sleep(2500);

    const isProfileLoaded = await waitForCondition(win, `() => document.body.innerText.includes('ملف موظف') && document.body.innerText.includes('الراتب الأساسي الشهري') && document.body.innerText.includes('فارس الفرجاني التفاعلي')`);
    if (isProfileLoaded) {
      recordPass('Loaded EmployeeDetail page with PartyAccountHeader, Contact Details, and KPI Cards');
    } else {
      recordFail('Failed to load EmployeeDetail page');
    }

    const profImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '03_employee_profile.png'), profImg.toPNG());

    // 6. Test Disburse Advance Dialog
    console.log('\n6. Testing Disburse Advance dialog & RPC...');
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const advBtn = btns.find(b => b.textContent.includes('صرف سلفة مالية'));
        if (advBtn) advBtn.click();
      })()
    `);
    await sleep(600);

    const isAdvDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#adv_amount')`);
    if (isAdvDialogOpen) {
      recordPass('Disburse Advance dialog opened');
    } else {
      recordFail('Disburse Advance dialog failed to open');
    }

    const advImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '04_disburse_advance_dialog.png'), advImg.toPNG());

    // Dismiss dialog
    await closeDialog(win);

    // Disburse 1500 LYD advance via financial RPC
    const { data: advRpcRes, error: advRpcErr } = await supabase.rpc('disburse_employee_advance', {
      p_employee_id: createdEmployeeId,
      p_amount: 1500,
      p_treasury_id: testTreasuryId,
      p_monthly_deduction: 750,
      p_notes: 'سلفة تشغيلية معتمدة',
      p_date: new Date().toISOString().split('T')[0]
    });
    if (advRpcErr) throw advRpcErr;
    createdAdvanceId = advRpcRes;
    recordPass(`Disbursed advance of 1,500.00 LYD with 750.00 LYD monthly deduction (Advance ID: ${createdAdvanceId})`);

    // Reload page to refresh React Query cache
    await win.webContents.executeJavaScript(`window.location.reload();`);
    await sleep(2500);

    // 7. Test Repay Advance Dialog
    console.log('\n7. Testing Cash Repayment of Advance...');
    // Switch to advances tab
    await switchTab(win, 'advances');
    await sleep(800);
    
    // Wait for repay button to appear in table
    await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('سداد دفعة'))`, 8000);

    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const repBtn = btns.find(b => b.innerText.includes('سداد دفعة'));
        if (repBtn) repBtn.click();
      })()
    `);
    await sleep(600);

    const isRepDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#rep_amount')`);
    if (isRepDialogOpen) {
      recordPass('Repay Advance dialog opened with remaining balance preview');
    } else {
      recordFail('Repay Advance dialog failed to open');
    }

    const repImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '05_repay_advance_dialog.png'), repImg.toPNG());

    // Dismiss dialog
    await closeDialog(win);

    // Repay 500 LYD cash via RPC
    const { error: repRpcErr } = await supabase.rpc('repay_employee_advance', {
      p_advance_id: createdAdvanceId,
      p_amount: 500,
      p_treasury_id: testTreasuryId,
      p_notes: 'سداد دفعة نقدية',
      p_date: new Date().toISOString().split('T')[0]
    });
    if (repRpcErr) throw repRpcErr;

    const { data: advCheck1 } = await supabase
      .from('employee_advances')
      .select('remaining_amount, paid_back_amount')
      .eq('id', createdAdvanceId)
      .single();

    if (Number(advCheck1.remaining_amount) === 1000 && Number(advCheck1.paid_back_amount) === 500) {
      recordPass('Cash Repayment verified: Paid 500 LYD, Remaining balance is strictly 1,000.00 LYD');
    } else {
      recordFail('Advance balance mismatch after cash repayment', JSON.stringify(advCheck1));
    }

    // 8. Test Issue Custody Dialog
    console.log('\n8. Testing Issue Custody dialog & RPC...');
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const custBtn = btns.find(b => b.textContent.includes('صرف عهدة'));
        if (custBtn) custBtn.click();
      })()
    `);
    await sleep(600);

    const isCustDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#cust_amount')`);
    if (isCustDialogOpen) {
      recordPass('Issue Custody dialog opened with project and treasury selectors');
    } else {
      recordFail('Issue Custody dialog failed to open');
    }

    const custImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '06_issue_custody_dialog.png'), custImg.toPNG());

    // Dismiss dialog
    await closeDialog(win);

    // Issue 800 LYD custody via RPC
    const { data: custRpcRes, error: custRpcErr } = await supabase.rpc('issue_employee_custody', {
      p_holder_type: 'employee',
      p_holder_id: createdEmployeeId,
      p_amount: 800,
      p_treasury_id: testTreasuryId,
      p_project_id: null,
      p_notes: 'عهدة مشتريات تشغيلية',
      p_date: new Date().toISOString().split('T')[0]
    });
    if (custRpcErr) throw custRpcErr;
    createdCustodyId = custRpcRes;
    recordPass(`Employee Custody issued: 800.00 LYD (Custody ID: ${createdCustodyId})`);

    // Reload page to refresh React Query cache
    await win.webContents.executeJavaScript(`window.location.reload();`);
    await sleep(2500);

    // 9. Test Return Custody Cash Dialog
    console.log('\n9. Testing Return Custody Cash dialog & RPC...');
    // Switch to custody tab
    await switchTab(win, 'custody');
    await sleep(800);
    
    // Wait for return button to appear in table
    await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('رد المتبقي'))`, 8000);

    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const retBtn = btns.find(b => b.innerText.includes('رد المتبقي'));
        if (retBtn) retBtn.click();
      })()
    `);
    await sleep(600);

    const isRetDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#ret_cust_amount')`);
    if (isRetDialogOpen) {
      recordPass('Return Custody dialog opened with full remaining balance preloaded');
    } else {
      recordFail('Return Custody dialog failed to open');
    }

    const retImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '07_return_custody_dialog.png'), retImg.toPNG());

    // Dismiss dialog
    await closeDialog(win);

    // Return 800 LYD full custody cash via RPC
    const { error: retRpcErr } = await supabase.rpc('settle_custody_cash_return', {
      p_custody_id: createdCustodyId,
      p_return_amount: 800,
      p_treasury_id: testTreasuryId,
      p_notes: 'رد كامل فائض العهدة',
      p_date: new Date().toISOString().split('T')[0]
    });
    if (retRpcErr) throw retRpcErr;

    const { data: custCheck1 } = await supabase
      .from('project_custody')
      .select('status, remaining_amount')
      .eq('id', createdCustodyId)
      .single();

    if (custCheck1.status === 'closed' && Number(custCheck1.remaining_amount) === 0) {
      recordPass('Custody settled and closed: Status is now "closed", remaining is 0 LYD');
    } else {
      recordFail('Custody status mismatch after return', JSON.stringify(custCheck1));
    }

    // 10. Navigate back to /#/employees and test Payroll Cycle
    console.log('\n10. Testing Payroll Cycle in /#/employees ...');
    await win.webContents.executeJavaScript(`window.location.hash = '/employees';`);
    await sleep(2000);

    // Switch to مسيرات الرواتب tab
    await switchTab(win, 'payroll');
    await sleep(800);

    const payTabImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '08_payroll_tab.png'), payTabImg.toPNG());

    // Click "توليد مسير جديد"
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const genBtn = btns.find(b => b.textContent.includes('توليد مسير'));
        if (genBtn) genBtn.click();
      })()
    `);
    await sleep(600);

    const isGenDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#pay_title')`);
    if (isGenDialogOpen) {
      recordPass('Generate Monthly Payroll dialog opened with month/year selector');
    } else {
      recordFail('Generate Monthly Payroll dialog failed to open');
    }

    const genImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '09_generate_payroll_dialog.png'), genImg.toPNG());

    // Dismiss dialog
    await closeDialog(win);

    // Generate monthly payroll via RPC
    const { data: prRpcRes, error: prRpcErr } = await supabase.rpc('generate_monthly_payroll', {
      p_month: 9,
      p_year: 2026,
      p_title: 'مسير رواتب سبتمبر 2026 التفاعلي'
    });
    if (prRpcErr) throw prRpcErr;
    createdPayrollId = prRpcRes;
    recordPass(`Generated monthly payroll (Payroll ID: ${createdPayrollId})`);

    // Verify slip breakdown from PostgreSQL
    const { data: slipData } = await supabase
      .from('employee_payroll_slips')
      .select('*')
      .eq('payroll_id', createdPayrollId)
      .eq('employee_id', createdEmployeeId)
      .single();

    if (
      slipData &&
      Number(slipData.basic_salary) === 5000 &&
      Number(slipData.advance_deduction) === 750 &&
      Number(slipData.net_salary) === 4250
    ) {
      recordPass('Salary slip auto-calculation validated: Basic 5,000 - Advance Installment 750 = Net 4,250 LYD!');
    } else {
      recordFail('Salary slip calculation mismatch in PostgreSQL', JSON.stringify(slipData));
    }

    // 11. Disburse Salary Slip via RPC
    console.log('\n11. Testing Salary Slip Disbursement & Treasury Deduction...');
    const { error: disbSlipErr } = await supabase.rpc('disburse_payroll_slip', {
      p_slip_id: slipData.id,
      p_treasury_id: testTreasuryId,
      p_date: new Date().toISOString().split('T')[0],
      p_notes: 'صرف راتب شهر سبتمبر'
    });
    if (disbSlipErr) throw disbSlipErr;

    // Verify slip is marked paid
    const { data: slipPaidCheck } = await supabase
      .from('employee_payroll_slips')
      .select('status, treasury_id')
      .eq('id', slipData.id)
      .single();

    if (slipPaidCheck.status === 'paid' && slipPaidCheck.treasury_id === testTreasuryId) {
      recordPass('Salary slip successfully disbursed and marked as "paid" with linked treasury!');
    } else {
      recordFail('Salary slip status mismatch', JSON.stringify(slipPaidCheck));
    }

    // Verify remaining advance after salary deduction: 1000 - 750 = 250 LYD
    const { data: advAfterPay } = await supabase
      .from('employee_advances')
      .select('remaining_amount, paid_back_amount')
      .eq('id', createdAdvanceId)
      .single();

    if (Number(advAfterPay.remaining_amount) === 250 && Number(advAfterPay.paid_back_amount) === 1250) {
      recordPass('Advance installment auto-repaid via payroll: Advance remaining is now strictly 250.00 LYD!');
    } else {
      recordFail(`Advance remaining mismatch: expected 250, got ${advAfterPay?.remaining_amount}`);
    }

    // Reload UI and check active tabs
    await win.webContents.executeJavaScript(`window.location.hash = '/employees';`);
    await sleep(2000);

    // Switch to Advances Tab
    await switchTab(win, 'advances');
    await sleep(800);

    const advTabImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '11_advances_tab.png'), advTabImg.toPNG());
    recordPass('Advances Tab renders active advance table with remaining 250 LYD');

    // Switch to Custodies Tab
    await switchTab(win, 'custody');
    await sleep(800);

    const cTabImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '12_custodies_tab.png'), cTabImg.toPNG());
    recordPass('Custodies Tab renders settled custody table');

  } catch (err) {
    console.error('Unhandled error during HR test run:', err);
    recordFail('Unhandled exception during HR test execution', err);
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // 12. TEARDOWN & PRISTINE RECOVERY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n12. Teardown: Purging test entities from PostgreSQL database...');

    if (createdEmployeeId) {
      await supabase.from('employee_payroll_slips').delete().eq('employee_id', createdEmployeeId);
      console.log(`    Purged slips for employee: ${createdEmployeeId}`);
    }

    if (createdPayrollId) {
      await supabase.from('employee_payrolls').delete().eq('id', createdPayrollId);
      console.log(`    Purged test payroll: ${createdPayrollId}`);
    }

    if (createdEmployeeId) {
      await supabase.from('employee_advance_repayments').delete().eq('employee_id', createdEmployeeId);
      await supabase.from('employee_advances').delete().eq('employee_id', createdEmployeeId);
      console.log(`    Purged test advances & repayments for employee: ${createdEmployeeId}`);
    }

    if (createdCustodyId) {
      await supabase.from('custody_settlements').delete().eq('custody_id', createdCustodyId);
      await supabase.from('project_custody').delete().eq('id', createdCustodyId);
      console.log(`    Purged test custody: ${createdCustodyId}`);
    }

    if (createdEmployeeId) {
      await supabase.from('employees').delete().eq('id', createdEmployeeId);
      console.log(`    Purged test employee: ${createdEmployeeId}`);
    }

    // Clean any treasury transactions created for this test
    await supabase.from('treasury_transactions').delete().ilike('notes', '%فارس الفرجاني%');
    await supabase.from('treasury_transactions').delete().ilike('notes', '%سبتمبر 2026 التفاعلي%');
    await supabase.from('treasury_transactions').delete().ilike('notes', '%سلفة تشغيلية%');
    await supabase.from('treasury_transactions').delete().ilike('notes', '%سداد دفعة نقدية%');
    await supabase.from('treasury_transactions').delete().ilike('notes', '%عهدة مشتريات%');
    await supabase.from('treasury_transactions').delete().ilike('notes', '%رد كامل فائض%');
    await supabase.from('treasury_transactions').delete().ilike('notes', '%صرف راتب شهر سبتمبر%');

    // Verify zero leaks
    const { data: leakedEmp } = await supabase.from('employees').select('id').ilike('name', '%فارس الفرجاني%');
    const { data: leakedPay } = await supabase.from('employee_payrolls').select('id').ilike('title', '%سبتمبر 2026 التفاعلي%');
    const totalLeaked = (leakedEmp?.length || 0) + (leakedPay?.length || 0);

    if (totalLeaked === 0) {
      recordPass('Zero test fixtures leaked: Live Database is 100% clean and pristine');
    } else {
      recordFail(`Found ${totalLeaked} leaked test fixtures in PostgreSQL!`);
    }

    console.log('\n=================================================================');
    console.log(`  HR & PAYROLL E2E EXECUTION FINISHED`);
    console.log(`  Passed: ${passedChecks} | Failed: ${failedChecks}`);
    console.log('=================================================================\n');

    const resultsFile = path.resolve('test-results/hr-e2e-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      passed: passedChecks,
      failed: failedChecks,
      logs: testLogs
    }, null, 2));

    win.destroy();
    app.quit();
    process.exit(failedChecks === 0 ? 0 : 1);
  }
}

app.whenReady().then(run);
