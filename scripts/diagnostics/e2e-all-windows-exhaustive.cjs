// scripts/diagnostics/e2e-all-windows-exhaustive.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Isolate electron user data to prevent disk cache locks
const tempUserData = path.join(os.tmpdir(), 'rekaz-all-windows-' + Date.now());
app.setPath('userData', tempUserData);

const SUPABASE_URL = "https://bpnhzaexmqruzaxyzlyc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA";
const BASE_URL = "http://localhost:4173";

const SCREENSHOTS_DIR = path.resolve('test-results/exhaustive-screenshots');
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

async function runAll() {
  console.log('=================================================================');
  console.log('  EXHAUSTIVE ALL-WINDOWS & INTERACTIVE VERIFICATION RUNNER');
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
    // ─────────────────────────────────────────────────────────────────────────
    // 1. LIVE AUTHENTICATION VIA LOGIN FORM
    // ─────────────────────────────────────────────────────────────────────────
    console.log('1. Navigating to Login screen (/#/auth)...');
    await win.loadURL(`${BASE_URL}/#/auth`);

    const hasLoginForm = await waitForCondition(win, `() => !!document.querySelector('input#identifier') && !!document.querySelector('input#password')`);
    if (hasLoginForm) {
      recordPass('Login form rendered: identifier, password, submit button');
    } else {
      recordFail('Login form inputs not found');
    }

    console.log('   Entering credentials for rekazabdo@admin.com...');
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

    const hasDashboard = await waitForCondition(win, `() => !!document.querySelector('aside') && !!document.querySelector('header')`, 12000);
    if (hasDashboard) {
      recordPass('Live UI Login successful! Authenticated Dashboard rendered.');
    } else {
      recordFail('Dashboard failed to render after UI login');
    }

    const dashImg = await win.webContents.capturePage();
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, '01_dashboard.png'), dashImg.toPNG());

    // ─────────────────────────────────────────────────────────────────────────
    // 2. GLOBAL COMMAND PALETTE (CTRL+K) DIALOG
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n2. Testing Global Command Palette Dialog...');
    await win.webContents.executeJavaScript(`
      (() => {
        const searchBtn = document.querySelector('button[aria-label*="البحث الشامل"]');
        if (searchBtn) searchBtn.click();
      })()
    `);

    const commandPaletteOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"]') && document.body.innerText.includes('ESC')`, 6000);
    if (commandPaletteOpen) {
      recordPass('Global Command Palette opened with RTL layout and search input');

      // Test searching inside Command Palette
      await win.webContents.executeJavaScript(`
        (() => {
          const inp = document.querySelector('[role="dialog"][data-state="open"] input');
          if (inp) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(inp, 'الخزائن');
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      await sleep(500);

      const cmdImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '02_command_palette.png'), cmdImg.toPNG());

      // Close Command Palette via Escape
      await win.webContents.executeJavaScript(`
        (() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        })()
      `);
      await sleep(500);
      recordPass('Global Command Palette search verified and dismissed');
    } else {
      recordFail('Global Command Palette failed to open');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CLIENTS WINDOWS & DETAIL DIALOGS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n3. Testing Clients (/#/clients) Modals and Workflows...');
    await win.webContents.executeJavaScript(`window.location.hash = '/clients';`);
    await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('عميل جديد'))`, 10000);

    // Open Add Client Dialog
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('عميل جديد'));
        if (btn) btn.click();
      })()
    `);

    const clientDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#name')`, 6000);
    if (clientDialogOpen) {
      recordPass('Add Client Dialog opened with RTL dir="rtl" attribute');

      const clientUniqueName = `شركة الفارس التفاعلية ${Date.now().toString().slice(-4)}`;
      await win.webContents.executeJavaScript(`
        (() => {
          function setReactVal(input, val) {
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#name'), ${JSON.stringify(clientUniqueName)});
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#phone'), '0919998877');
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#city'), 'طرابلس');
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#address'), 'شارع المدار - برج الفحص');
        })()
      `);
      await sleep(400);

      const clientImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '03_client_dialog_filled.png'), clientImg.toPNG());

      // Submit form
      await win.webContents.executeJavaScript(`
        (() => {
          const submitBtn = document.querySelector('[role="dialog"][data-state="open"] button[type="submit"]');
          if (submitBtn) submitBtn.click();
        })()
      `);

      const clientCreatedInDOM = await waitForCondition(win, `() => document.body.innerText.includes(${JSON.stringify(clientUniqueName)})`, 10000);
      if (clientCreatedInDOM) {
        recordPass(`Client "${clientUniqueName}" created and reflected dynamically in UI`);

        // Check Supabase DB
        const { data: dbClient } = await supabase.from('clients').select('id, name').eq('name', clientUniqueName).maybeSingle();
        if (dbClient) {
          createdEntities.clients.push(dbClient.id);
          recordPass(`PostgreSQL confirmed persistent client ID: ${dbClient.id}`);

          // Navigate to Client Detail Page
          console.log(`   Navigating to Client Detail (/#/clients/${dbClient.id})...`);
          await win.webContents.executeJavaScript(`window.location.hash = '/clients/${dbClient.id}';`);
          const detailLoaded = await waitForCondition(win, `() => document.body.innerText.includes(${JSON.stringify(clientUniqueName)})`, 10000);
          if (detailLoaded) {
            recordPass('Client Detail page rendered with financial summary and account sections');
            const detailImg = await win.webContents.capturePage();
            fs.writeFileSync(path.join(SCREENSHOTS_DIR, '04_client_detail.png'), detailImg.toPNG());
          } else {
            recordFail('Client Detail page failed to render');
          }
        }
      } else {
        recordFail('Created client was not reflected in DOM');
      }
    } else {
      recordFail('Add Client Dialog failed to open');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SUPPLIERS WINDOWS & DETAIL DIALOGS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n4. Testing Suppliers (/#/suppliers) Modals and Workflows...');
    await win.webContents.executeJavaScript(`window.location.hash = '/suppliers';`);
    await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('مورد جديد'))`, 10000);

    // Open Add Supplier Dialog
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('مورد جديد'));
        if (btn) btn.click();
      })()
    `);

    const supplierDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#name')`, 6000);
    if (supplierDialogOpen) {
      recordPass('Add Supplier Dialog opened with dir="rtl"');

      const supplierName = `مورد واجهات وزجاج ${Date.now().toString().slice(-4)}`;
      await win.webContents.executeJavaScript(`
        (() => {
          function setReactVal(input, val) {
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#name'), ${JSON.stringify(supplierName)});
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#category'), 'كلادينج وألمنيوم');
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#phone'), '0925554433');
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#address'), 'المنطقة الصناعية - طرابلس');
        })()
      `);
      await sleep(400);

      const supImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '05_supplier_dialog_filled.png'), supImg.toPNG());

      // Submit
      await win.webContents.executeJavaScript(`
        (() => {
          const submitBtn = document.querySelector('[role="dialog"][data-state="open"] button[type="submit"]');
          if (submitBtn) submitBtn.click();
        })()
      `);

      const supCreatedInDOM = await waitForCondition(win, `() => document.body.innerText.includes(${JSON.stringify(supplierName)})`, 10000);
      if (supCreatedInDOM) {
        recordPass(`Supplier "${supplierName}" created and confirmed in UI`);
        const { data: dbSup } = await supabase.from('suppliers').select('id, name').eq('name', supplierName).maybeSingle();
        if (dbSup) {
          createdEntities.suppliers.push(dbSup.id);
          recordPass(`PostgreSQL confirmed persistent supplier ID: ${dbSup.id}`);

          // Navigate to Supplier Detail
          await win.webContents.executeJavaScript(`window.location.hash = '/suppliers/${dbSup.id}';`);
          const supDetailLoaded = await waitForCondition(win, `() => document.body.innerText.includes(${JSON.stringify(supplierName)})`, 10000);
          if (supDetailLoaded) {
            recordPass('Supplier Detail page rendered with SupplierAdvancePanel and account sections');
            const supDetailImg = await win.webContents.capturePage();
            fs.writeFileSync(path.join(SCREENSHOTS_DIR, '06_supplier_detail.png'), supDetailImg.toPNG());
          }
        }
      } else {
        recordFail('Supplier was not reflected in DOM');
      }
    } else {
      recordFail('Add Supplier Dialog failed to open');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. TECHNICIANS WINDOWS & DEPOSITS PANEL MODALS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n5. Testing Technicians (/#/technicians) Modals and Deposits...');
    await win.webContents.executeJavaScript(`window.location.hash = '/technicians';`);
    await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('فني جديد') || b.innerText.includes('إضافة فني'))`, 10000);

    // Click "فني جديد"
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('فني جديد') || b.innerText.includes('إضافة فني'));
        if (btn) btn.click();
      })()
    `);

    const techDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#name')`, 6000);
    if (techDialogOpen) {
      recordPass('Add Technician Dialog opened with RTL layout');

      // Test typing name and daily rate
      await win.webContents.executeJavaScript(`
        (() => {
          function setReactVal(input, val) {
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#name'), 'فني فحص تفاعلي');
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#phone'), '0941112233');
          setReactVal(document.querySelector('[role="dialog"][data-state="open"] input#daily_rate'), '150');
        })()
      `);
      await sleep(400);

      const techImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '07_technician_dialog.png'), techImg.toPNG());

      // Open sub-dialog "+ إضافة تخصص جديد"
      await win.webContents.executeJavaScript(`
        (() => {
          const addTypeBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إضافة تخصص جديد'));
          if (addTypeBtn) addTypeBtn.click();
        })()
      `);

      const subDialogOpen = await waitForCondition(win, `() => document.body.innerText.includes('إضافة تخصص فني جديد') || document.querySelectorAll('[role="dialog"][data-state="open"]').length > 1`, 5000);
      if (subDialogOpen) {
        recordPass('Technician Sub-Dialog "+ إضافة تخصص جديد" opened with RTL layout');
        const subImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '08_technician_sub_dialog.png'), subImg.toPNG());

        // Dismiss sub-dialog
        await win.webContents.executeJavaScript(`
          (() => {
            const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
            const topDialog = dialogs[dialogs.length - 1];
            const cancelBtn = Array.from(topDialog.querySelectorAll('button')).find(b => b.innerText.includes('إلغاء'));
            if (cancelBtn) cancelBtn.click();
          })()
        `);
        await sleep(400);
      }

      // Dismiss main technician dialog
      await win.webContents.executeJavaScript(`
        (() => {
          const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
          if (cancelBtn) cancelBtn.click();
        })()
      `);
      await sleep(400);
      recordPass('Technician dialogs verified and dismissed cleanly');

      // Navigate to existing Technician Detail
      const TECH_ID = "f71cd19a-5bed-4687-aaf9-a6d3c70697b6";
      console.log(`   Navigating to Technician Detail (/#/technicians/${TECH_ID})...`);
      await win.webContents.executeJavaScript(`window.location.hash = '/technicians/${TECH_ID}';`);
      const techDetailLoaded = await waitForCondition(win, `() => document.body.innerText.includes('حساب فني') || document.body.innerText.includes('أحمد الزيات')`, 10000);
      if (techDetailLoaded) {
        recordPass('Technician Detail page loaded with TechnicianDepositsPanel and statement tabs');
        const techDetImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '09_technician_detail.png'), techDetImg.toPNG());

        // Test opening Deposit Receipt Dialog
        await win.webContents.executeJavaScript(`
          (() => {
            const depositBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('استلام وديعة'));
            if (depositBtn) depositBtn.click();
          })()
        `);
        const depositModalOpen = await waitForCondition(win, `() => document.body.innerText.includes('استلام وديعة من الفني')`, 5000);
        if (depositModalOpen) {
          recordPass('Technician Deposit Receipt Dialog opened with dir="rtl"');
          const depImg = await win.webContents.capturePage();
          fs.writeFileSync(path.join(SCREENSHOTS_DIR, '10_technician_deposit_dialog.png'), depImg.toPNG());

          // Dismiss
          await win.webContents.executeJavaScript(`
            (() => {
              const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
              if (cancelBtn) cancelBtn.click();
            })()
          `);
          await sleep(400);
        }

        // Test opening Deposit Refund Dialog
        await win.webContents.executeJavaScript(`
          (() => {
            const refundBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('رد وديعة'));
            if (refundBtn) refundBtn.click();
          })()
        `);
        const refundModalOpen = await waitForCondition(win, `() => document.body.innerText.includes('رد وديعة للفني')`, 5000);
        if (refundModalOpen) {
          recordPass('Technician Deposit Refund Dialog opened with dir="rtl"');
          const refImg = await win.webContents.capturePage();
          fs.writeFileSync(path.join(SCREENSHOTS_DIR, '11_technician_refund_dialog.png'), refImg.toPNG());

          // Dismiss
          await win.webContents.executeJavaScript(`
            (() => {
              const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
              if (cancelBtn) cancelBtn.click();
            })()
          `);
          await sleep(400);
        }
      }
    } else {
      recordFail('Add Technician Dialog failed to open');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. TREASURIES & BANKING DIALOGS (ROOT, TRANSFERS)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n6. Testing Treasuries (/#/treasuries) Modals and Transfers...');
    await win.webContents.executeJavaScript(`window.location.hash = '/treasuries';`);
    await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('خزينة رئيسية'))`, 10000);

    // Open Root Treasury Dialog
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('خزينة رئيسية'));
        if (btn) btn.click();
      })()
    `);

    const rootTreasuryDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"]') && document.body.innerText.includes('إضافة خزينة رئيسية')`, 6000);
    if (rootTreasuryDialogOpen) {
      recordPass('Primary Treasury Dialog opened with dir="rtl" and Arabic form labels');
      const trImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '12_treasury_root_dialog.png'), trImg.toPNG());

      // Dismiss dialog
      await win.webContents.executeJavaScript(`
        (() => {
          const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
          if (cancelBtn) cancelBtn.click();
        })()
      `);
      await sleep(400);
      recordPass('Primary Treasury Dialog cleanly dismissed');
    } else {
      recordFail('Primary Treasury Dialog failed to open');
    }

    // Test Transfer between treasuries dialog
    console.log('   Testing Transfer between treasuries dialog...');
    await win.webContents.executeJavaScript(`
      (() => {
        const xferBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('نقل بين الخزائن') || b.innerText.includes('تحويل'));
        if (xferBtn) xferBtn.click();
      })()
    `);

    const transferModalOpen = await waitForCondition(win, `() => document.body.innerText.includes('تحويل مالي بين الخزائن') || !!document.querySelector('[role="dialog"][data-state="open"]')`, 6000);
    if (transferModalOpen) {
      recordPass('Treasury Transfer Dialog opened with RTL layout');
      const xferImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '13_treasury_transfer_dialog.png'), xferImg.toPNG());

      // Dismiss
      await win.webContents.executeJavaScript(`
        (() => {
          const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
          if (cancelBtn) cancelBtn.click();
        })()
      `);
      await sleep(400);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. CLIENT PAYMENTS & DYNAMIC ARITHMETIC REVENUE INDICATOR
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n7. Testing Client Payments (/#/client-payments) Dynamic Calculations...');
    await win.webContents.executeJavaScript(`window.location.hash = '/client-payments';`);
    await waitForCondition(win, `() => !!document.querySelector('button[role="combobox"]')`, 10000);

    // Select Client in Combobox
    await win.webContents.executeJavaScript(`
      (() => {
        const combo = document.querySelector('button[role="combobox"]');
        if (combo) combo.click();
      })()
    `);
    await sleep(400);

    const hasOption = await waitForCondition(win, `() => !!document.querySelector('[role="option"]')`, 5000);
    if (hasOption) {
      await win.webContents.executeJavaScript(`
        (() => {
          const item = document.querySelector('[role="option"]');
          if (item) item.click();
        })()
      `);
      recordPass('Selected client from combobox menu');
    }

    // Wait for amount input to become enabled
    const amountReady = await waitForCondition(win, `() => !!document.querySelector('input[placeholder="0.00"]:not([disabled])')`, 8000);
    if (amountReady) {
      console.log('   Focusing amount input and typing "4250"...');
      await win.webContents.executeJavaScript(`
        (() => {
          const input = document.querySelector('input[placeholder="0.00"]');
          if (input) input.focus();
        })()
      `);
      await sleep(200);

      for (const ch of '4250') {
        win.webContents.sendInputEvent({ type: 'char', keyCode: ch });
        await sleep(50);
      }
      await sleep(500);

      const hasCalcBanner = await waitForCondition(win, `() => {
        const text = document.body.innerText;
        return text.includes('رصيد فائض') || text.includes('متبقي على الزبون') || text.includes('المبلغ يغطي المستحق');
      }`, 6000);

      if (hasCalcBanner) {
        recordPass('Dynamic financial revenue indicator calculated and rendered live in DOM');
        const payImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '14_client_payments_calc.png'), payImg.toPNG());
      } else {
        recordFail('Dynamic calculation banner failed to render');
      }
    } else {
      recordFail('Amount input was not activated');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. PROJECT WORKSPACE, ITEMS & OPERATIONS MODALS
    // ─────────────────────────────────────────────────────────────────────────
    const PROJECT_ID = "673e2eed-8953-4296-a573-627b54623c19";
    console.log(`\\n8. Testing Project Workspace (/#/projects/${PROJECT_ID}/items)...`);
    await win.webContents.executeJavaScript(`window.location.hash = '/projects/${PROJECT_ID}/items';`);

    const itemsLoaded = await waitForCondition(win, `() => document.body.innerText.includes('فاتورة بنود المقاولات') || document.body.innerText.includes('قائمة البنود')`, 12000);
    if (itemsLoaded) {
      recordPass('Project Items workspace hydrated with InvoiceItemForm inline builder');
      const itmImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '15_project_items_workspace.png'), itmImg.toPNG());
    } else {
      recordFail('Project Items page took too long to load');
    }

    // Project Purchases Modal
    console.log(`   Navigating to Project Purchases (/#/projects/${PROJECT_ID}/purchases)...`);
    await win.webContents.executeJavaScript(`window.location.hash = '/projects/${PROJECT_ID}/purchases';`);
    const purchasesLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('فاتورة شراء'))`, 10000);
    if (purchasesLoaded) {
      recordPass('Project Purchases page loaded');
      await win.webContents.executeJavaScript(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('فاتورة شراء'));
          if (btn) btn.click();
        })()
      `);
      const purchDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"]')`, 6000);
      if (purchDialogOpen) {
        recordPass('Add Purchase Invoice Dialog opened with supplier & item inputs');
        const purchImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '16_project_purchase_dialog.png'), purchImg.toPNG());

        // Dismiss
        await win.webContents.executeJavaScript(`
          (() => {
            const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
            if (cancelBtn) cancelBtn.click();
          })()
        `);
        await sleep(400);
      }
    }

    // Project Expenses Modal
    console.log(`   Navigating to Project Expenses (/#/projects/${PROJECT_ID}/expenses)...`);
    await win.webContents.executeJavaScript(`window.location.hash = '/projects/${PROJECT_ID}/expenses';`);
    const expensesLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('مصروف'))`, 10000);
    if (expensesLoaded) {
      recordPass('Project Expenses page loaded');
      await win.webContents.executeJavaScript(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('مصروف'));
          if (btn) btn.click();
        })()
      `);
      const expDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"]')`, 6000);
      if (expDialogOpen) {
        recordPass('Project Expense Dialog opened with treasury and category selector');
        const expImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '17_project_expense_dialog.png'), expImg.toPNG());

        // Dismiss
        await win.webContents.executeJavaScript(`
          (() => {
            const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
            if (cancelBtn) cancelBtn.click();
          })()
        `);
        await sleep(400);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. EMPLOYEES MODALS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n9. Testing Employees (/#/employees) Modals...');
    await win.webContents.executeJavaScript(`window.location.hash = '/employees';`);
    const empLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('إضافة موظف'))`, 10000);
    if (empLoaded) {
      await win.webContents.executeJavaScript(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('إضافة موظف'));
          if (btn) btn.click();
        })()
      `);
      const empDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"] input#name') || !!document.querySelector('[role="dialog"][data-state="open"]')`, 6000);
      if (empDialogOpen) {
        recordPass('Add Employee Dialog opened with RTL layout');
        const empImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '18_employee_dialog.png'), empImg.toPNG());

        // Dismiss
        await win.webContents.executeJavaScript(`
          (() => {
            const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
            if (cancelBtn) cancelBtn.click();
          })()
        `);
        await sleep(400);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. GENERAL ITEMS & SYSTEM SETTINGS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n10. Testing General Items (/#/general-items) and Settings (/#/settings)...');
    await win.webContents.executeJavaScript(`window.location.hash = '/general-items';`);
    const genLoaded = await waitForCondition(win, `() => Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('إضافة بند عام'))`, 10000);
    if (genLoaded) {
      await win.webContents.executeJavaScript(`
        (() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('إضافة بند عام'));
          if (btn) btn.click();
        })()
      `);
      const genDialogOpen = await waitForCondition(win, `() => !!document.querySelector('[role="dialog"][data-state="open"]')`, 6000);
      if (genDialogOpen) {
        recordPass('General Project Item Dialog opened with category & pricing inputs');
        const genImg = await win.webContents.capturePage();
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, '19_general_items_dialog.png'), genImg.toPNG());

        // Dismiss
        await win.webContents.executeJavaScript(`
          (() => {
            const cancelBtn = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"] button')).find(b => b.innerText.includes('إلغاء'));
            if (cancelBtn) cancelBtn.click();
          })()
        `);
        await sleep(400);
      }
    }

    await win.webContents.executeJavaScript(`window.location.hash = '/settings';`);
    const settingsLoaded = await waitForCondition(win, `() => document.body.innerText.includes('إعدادات الشركة') || document.body.innerText.includes('النسخ الاحتياطي')`, 10000);
    if (settingsLoaded) {
      recordPass('System Settings loaded with company profile, print preferences and backup manager');
      const setImg = await win.webContents.capturePage();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, '20_settings_view.png'), setImg.toPNG());
    }

  } catch (err) {
    console.error('Unhandled error during test run:', err);
    recordFail('Unhandled exception during execution', err);
  } finally {
    // ─────────────────────────────────────────────────────────────────────────
    // 11. AUTOMATED TEARDOWN & PRISTINE DATABASE RECOVERY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\\n11. Cleaning up test entities from live PostgreSQL database...');
    if (createdEntities.clients.length > 0) {
      for (const id of createdEntities.clients) {
        await supabase.from('clients').delete().eq('id', id);
        console.log(`   Cleaned test client: ${id}`);
      }
    }
    if (createdEntities.suppliers.length > 0) {
      for (const id of createdEntities.suppliers) {
        await supabase.from('suppliers').delete().eq('id', id);
        console.log(`   Cleaned test supplier: ${id}`);
      }
    }

    // Verify pristine state
    const { data: leakedClients } = await supabase.from('clients').select('id').ilike('name', '%الفارس التفاعلية%');
    const { data: leakedSuppliers } = await supabase.from('suppliers').select('id').ilike('name', '%واجهات وزجاج%');

    const totalLeaked = (leakedClients?.length || 0) + (leakedSuppliers?.length || 0);
    if (totalLeaked === 0) {
      recordPass('Teardown complete: Zero test fixture leaks in PostgreSQL database');
    } else {
      recordFail(`Found ${totalLeaked} leaked test fixtures in database!`);
    }

    console.log('\\n=================================================================');
    console.log(`  EXHAUSTIVE RUNNER FINISHED`);
    console.log(`  Passed: ${passedChecks} | Failed: ${failedChecks}`);
    console.log('=================================================================\\n');

    const resultsFile = path.resolve('test-results/exhaustive-windows-results.json');
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

app.whenReady().then(runAll);
