const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Set isolated user data directory to avoid cache lock issues
const tempUserData = path.join(os.tmpdir(), 'rekaz-e2e-profile-' + Date.now());
app.setPath('userData', tempUserData);

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOTS_DIR = path.resolve('test-results/screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Supabase config
const SUPABASE_URL = "https://bpnhzaexmqruzaxyzlyc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA";
const AUTH_STORAGE_KEY = "sb-bpnhzaexmqruzaxyzlyc-auth-token";

// Standard web browser user-agent to test web/BrowserRouter mode cleanly
const CHROME_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Canonical Sample IDs from real database
const SAMPLE_PROJECT_ID = '8fb26230-cf72-4463-84c4-444929306280';
const SAMPLE_PHASE_ID = 'f2cb0f24-ea14-451b-9713-31f298af2472';
const SAMPLE_CLIENT_ID = '4247bd10-a05e-4f78-8eb9-23cc4d63f49a';
const SAMPLE_SUPPLIER_ID = '9ccae955-17b4-4448-b780-7b89bb17607c';
const SAMPLE_TECHNICIAN_ID = 'f71cd19a-5bed-4687-aaf9-a6d3c70697b6';
const SAMPLE_TREASURY_ID = '176f2792-f794-45a2-ba51-8a4ac9a0e93a';

// Routes to test in order
const ROUTES_TO_TEST = [
  { path: '/', name: 'لوحة التحكم الرئيسية' },
  { path: '/accountant', name: 'لوحة تحكم المحاسب' },
  { path: '/projects', name: 'قائمة المشاريع' },
  { path: '/projects/contracting', name: 'مشاريع المقاولات' },
  { path: '/projects/finishing', name: 'مشاريع التشطيبات' },
  { path: '/projects/new', name: 'إنشاء مشروع جديد' },
  { path: `/projects/${SAMPLE_PROJECT_ID}`, name: 'مراحل المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/overview`, name: 'نظرة عامة على المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/phases`, name: 'تبويب مراحل المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/phases/${SAMPLE_PHASE_ID}`, name: 'مساحة عمل المرحلة' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/phases/${SAMPLE_PHASE_ID}/items`, name: 'بنود المرحلة' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/items`, name: 'بنود المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/purchases`, name: 'مشتريات وفواتير المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/expenses`, name: 'مصروفات المشروع المباشرة' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/payments`, name: 'دفعات ومقبوضات المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/progress`, name: 'إنجاز الفنيين والعمالة بالمشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/equipment`, name: 'إيجارات ومعدات المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/contracts`, name: 'عقود المشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/report`, name: 'التقرير الشامل للمشروع' },
  { path: `/projects/${SAMPLE_PROJECT_ID}/settings`, name: 'إعدادات المشروع' },
  { path: '/general-items', name: 'مكتبة البنود العامة' },
  { path: '/measurement-types', name: 'وحدات القياس' },
  { path: '/contracts', name: 'سجل العقود' },
  { path: '/contract-templates', name: 'قوالب بنود العقود' },
  { path: '/clients', name: 'دليل العملاء' },
  { path: `/clients/${SAMPLE_CLIENT_ID}`, name: 'تفاصيل حساب العميل' },
  { path: '/debts', name: 'كشف ديون وذمم الزبائن' },
  { path: '/client-activities', name: 'سجل حركات الزبائن' },
  { path: '/client-payments', name: 'إيصالات وسندات المقبوضات' },
  { path: '/suppliers', name: 'دليل الموردين' },
  { path: `/suppliers/${SAMPLE_SUPPLIER_ID}`, name: 'تفاصيل حساب المورد' },
  { path: '/technicians', name: 'دليل الفنيين' },
  { path: `/technicians/${SAMPLE_TECHNICIAN_ID}`, name: 'تفاصيل حساب الفني' },
  { path: '/treasuries', name: 'الخزائن والحسابات' },
  { path: `/treasuries/${SAMPLE_TREASURY_ID}`, name: 'كشف حركة الخزينة' },
  { path: '/invoice-control', name: 'مركز الفواتير' },
  { path: '/expenses', name: 'المصروفات العامة' },
  { path: '/project-expenses', name: 'مصروفات المشاريع المجمعة' },
  { path: '/transfers', name: 'التحويلات بين الخزائن' },
  { path: '/custody', name: 'العهد المالية' },
  { path: '/equipment', name: 'سجل المعدات والآليات' },
  { path: '/rentals', name: 'إيجارات المعدات' },
  { path: '/inventory', name: 'إدارة المستودعات والمخازن' },
  { path: '/engineers', name: 'دليل المهندسين' },
  { path: '/employees', name: 'سجل الموظفين' },
  { path: '/reports', name: 'مركز التقارير الشاملة' },
  { path: '/calendar', name: 'التقويم والمواعيد' },
  { path: '/settings', name: 'إعدادات النظام العامة' },
  { path: '/print-design', name: 'تصميم وهوية المطبوعات' },
  { path: '/users', name: 'إدارة المستخدمين والصلاحيات' },
  { path: '/database-backup', name: 'النسخ الاحتياطي لقاعدة البيانات' },
  { path: '/audit-log', name: 'سجل التعديلات والرقابة' }
];

async function runE2ETests() {
  console.log('========================================================');
  console.log('STARTING COMPREHENSIVE LIVE E2E NAVIGATION RUNNER');
  console.log('User: rekazabdo@admin.com');
  console.log('========================================================\n');

  // Step 1: Authenticate with Supabase server
  console.log('1. Authenticating rekazabdo@admin.com with Supabase Auth Server...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'rekazabdo@admin.com',
    password: 'rekazabdo-2026'
  });

  if (authError || !authData.session) {
    console.error('Authentication error with Supabase:', authError?.message);
    app.exit(1);
    return;
  }

  console.log('   Authenticated with server! User ID: ' + authData.user.id);
  const sessionJson = JSON.stringify(authData.session);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Preserve native Electron user agent so HashRouter is naturally activated for desktop
  const pageErrors = [];
  win.webContents.on('console-message', (event) => {
    const msg = typeof event === 'object' && event.message ? event.message : String(event);
    if (msg.includes('Error') && !msg.includes('favicon') && !msg.includes('DevTools')) {
      pageErrors.push(msg);
    }
  });

  const results = [];

  try {
    // Step 2: Inject session into browser localStorage
    console.log('2. Booting application and injecting session token...');
    await win.loadURL(`${BASE_URL}/`);
    await new Promise((r) => setTimeout(r, 1500));

    await win.webContents.executeJavaScript(`
      localStorage.setItem('${AUTH_STORAGE_KEY}', ${JSON.stringify(sessionJson)});
      window.location.reload();
    `);

    // Wait for Dashboard to hydrate
    console.log('3. Waiting for authenticated Dashboard hydration...');
    await new Promise((r) => setTimeout(r, 3500));

    const initialCheck = await win.webContents.executeJavaScript(`
      (() => {
        const text = document.body.innerText;
        return {
          url: window.location.href,
          title: document.title,
          hasSidebar: !!document.querySelector('aside'),
          hasHeader: !!document.querySelector('header'),
          isRTL: document.documentElement.dir === 'rtl' || document.querySelector('[dir="rtl"]') !== null,
          contentLength: text.length,
          snippet: text.substring(0, 80).replace(/\\n/g, ' ')
        };
      })()
    `);

    console.log('   Initial Dashboard State:', initialCheck);

    // Step 3: Test every route
    let passedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < ROUTES_TO_TEST.length; i++) {
      const route = ROUTES_TO_TEST[i];
      const stepNum = i + 1;

      console.log(`\\n[${stepNum}/${ROUTES_TO_TEST.length}] Testing: ${route.path} - ${route.name}`);

      try {
        await win.webContents.executeJavaScript(`
          window.location.hash = "${route.path}";
        `);
        await new Promise((r) => setTimeout(r, 1800));

        const healthCheck = await win.webContents.executeJavaScript(`
          (() => {
            const textContent = document.body.innerText.trim();
            const hasErrorFallback = !!document.querySelector('.error-fallback, [data-error="true"], #error-boundary');
            const has404 = textContent.includes('404') && textContent.includes('الصفحة غير موجودة');
            const isRTL = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl' || !!document.querySelector('[dir="rtl"]');
            const hasContent = textContent.length > 20;
            const hasSidebar = !!document.querySelector('aside');
            const hasHeader = !!document.querySelector('header');

            return {
              hasErrorFallback,
              has404,
              isRTL: !!isRTL,
              hasContent,
              hasSidebar,
              hasHeader,
              title: document.title,
              textSnippet: textContent.substring(0, 100).replace(/\\n/g, ' ')
            };
          })()
        `);

        const isHealthy = !healthCheck.hasErrorFallback && !healthCheck.has404 && healthCheck.hasContent;

        if (isHealthy) {
          passedCount++;
          console.log(`  [PASS] Clean render. Title: "${healthCheck.title}"`);
          console.log(`         RTL: ${healthCheck.isRTL ? 'Verified' : 'Missing'}, Sidebar: ${healthCheck.hasSidebar ? 'Yes' : 'No'}, Header: ${healthCheck.hasHeader ? 'Yes' : 'No'}`);
          results.push({
            route: route.path,
            name: route.name,
            status: 'PASS',
            details: healthCheck.textSnippet
          });
        } else {
          failedCount++;
          console.error(`  [FAIL] 404: ${healthCheck.has404}, ErrorFallback: ${healthCheck.hasErrorFallback}, Content: ${healthCheck.hasContent}`);
          results.push({
            route: route.path,
            name: route.name,
            status: 'FAIL',
            details: `404: ${healthCheck.has404}, ErrorFallback: ${healthCheck.hasErrorFallback}`
          });
        }

        // Save screenshots for representative pages using split/join to avoid regex escape issues
        const safeName = route.path.split('/').filter(Boolean).join('_') || 'dashboard';
        if (i < 8 || route.path.includes('overview') || route.path.includes('items') || route.path.includes('purchases') || route.path === '/treasuries' || route.path === '/clients' || route.path === '/reports' || route.path === '/invoice-control') {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `${safeName}.png`);
          const image = await win.webContents.capturePage();
          fs.writeFileSync(screenshotPath, image.toPNG());
          console.log(`  Screenshot saved: test-results/screenshots/${safeName}.png`);
        }

      } catch (err) {
        failedCount++;
        console.error(`  [ERROR] loading ${route.path}: ${err.message}`);
        results.push({
          route: route.path,
          name: route.name,
          status: 'ERROR',
          details: err.message
        });
      }
    }

    console.log('\n========================================================');
    console.log('LIVE E2E NAVIGATION RUNNER SUMMARY');
    console.log('========================================================');
    console.log(`Total Routes Tested: ${ROUTES_TO_TEST.length}`);
    console.log(`Passed:              ${passedCount}`);
    console.log(`Failed:              ${failedCount}`);
    console.log('========================================================\n');

    fs.writeFileSync(
      path.resolve('test-results/e2e-navigation-results.json'),
      JSON.stringify({ total: ROUTES_TO_TEST.length, passed: passedCount, failed: failedCount, results }, null, 2)
    );

    if (failedCount > 0) {
      app.exit(1);
    } else {
      app.exit(0);
    }

  } catch (globalErr) {
    console.error('Fatal E2E error:', globalErr.message);
    app.exit(1);
  }
}

app.whenReady().then(runE2ETests);
