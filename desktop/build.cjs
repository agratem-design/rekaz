const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const packagerModule = require('@electron/packager');
const packager = packagerModule.packager || packagerModule;

const ROOT_DIR = path.resolve(__dirname, '..');
const STAGE_DIR = path.join(ROOT_DIR, 'app_stage');
const OUT_DIR = path.join(ROOT_DIR, 'dist_desktop');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DESKTOP_DIR = path.join(ROOT_DIR, 'desktop');

/**
 * Copy directory recursively
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean directory
 */
function removeDirSync(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function build() {
  console.log('====================================================');
  console.log('🚀 [1/5] Building Vite React Web Application...');
  console.log('====================================================');
  
  execSync('npm run build', {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  console.log('\n====================================================');
  console.log('📦 [2/5] Preparing Isolated App Staging Directory...');
  console.log('====================================================');

  removeDirSync(STAGE_DIR);
  fs.mkdirSync(STAGE_DIR, { recursive: true });

  // Copy dist/
  console.log('  -> Copying dist/ to app_stage/dist/...');
  copyDirSync(DIST_DIR, path.join(STAGE_DIR, 'dist'));

  // Copy desktop/
  console.log('  -> Copying desktop/ to app_stage/desktop/...');
  copyDirSync(DESKTOP_DIR, path.join(STAGE_DIR, 'desktop'));

  // Copy icon if available
  const iconSource = path.join(ROOT_DIR, 'public', 'favicon.ico');
  let iconPath = undefined;
  if (fs.existsSync(iconSource)) {
    fs.copyFileSync(iconSource, path.join(STAGE_DIR, 'favicon.ico'));
    iconPath = iconSource;
  }

  // Create staging minimal package.json
  console.log('  -> Creating minimal app_stage/package.json (Excluding root node_modules)...');
  const stagePkg = {
    name: 'AdHub-Pro',
    productName: 'AdHub Pro - ركاز',
    version: '1.0.0',
    description: 'منظومة ركاز لإدارة المشاريع والمقاولات',
    main: 'desktop/main.cjs',
    author: 'REKAZ'
  };

  fs.writeFileSync(
    path.join(STAGE_DIR, 'package.json'),
    JSON.stringify(stagePkg, null, 2),
    'utf-8'
  );

  console.log('\n====================================================');
  console.log('⚡ [3/5] Packaging Windows Executable via @electron/packager...');
  console.log('====================================================');

  const appPaths = await packager({
    dir: STAGE_DIR,
    out: OUT_DIR,
    name: 'AdHub-Pro',
    platform: 'win32',
    arch: 'x64',
    asar: true,
    overwrite: true,
    icon: iconPath,
    appVersion: '1.0.0',
    appCopyright: 'Copyright © 2026 REKAZ',
    prune: true,
    quiet: false,
    win32metadata: {
      CompanyName: 'REKAZ',
      FileDescription: 'منظومة ركاز لإدارة المشاريع والمقاولات',
      OriginalFilename: 'AdHub-Pro.exe',
      ProductName: 'AdHub Pro',
      InternalName: 'AdHub-Pro'
    }
  });

  console.log('\n====================================================');
  console.log('🧹 [4/5] Cleaning Up Temporary Staging Directory...');
  console.log('====================================================');
  removeDirSync(STAGE_DIR);

  console.log('\n====================================================');
  console.log('🎉 [5/5] Desktop Application Built Successfully!');
  console.log('====================================================');
  
  if (appPaths && appPaths.length > 0) {
    const targetDir = appPaths[0];
    const exePath = path.join(targetDir, 'AdHub-Pro.exe');
    const asarPath = path.join(targetDir, 'resources', 'app.asar');

    console.log(`📂 Output Folder: ${targetDir}`);
    console.log(`💻 Executable:    ${exePath}`);
    if (fs.existsSync(asarPath)) {
      const asarStats = fs.statSync(asarPath);
      const asarSizeMB = (asarStats.size / (1024 * 1024)).toFixed(2);
      console.log(`📦 app.asar Size: ${asarSizeMB} MB (Ultra-compact!)`);
    }
  }
}

build().catch((err) => {
  console.error('\n❌ Desktop build failed:', err);
  removeDirSync(STAGE_DIR);
  process.exit(1);
});
