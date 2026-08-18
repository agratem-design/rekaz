const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Database Connection Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
  port: process.env.DB_PORT || '6543',
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.bpnhzaexmqruzaxyzlyc',
  password: process.env.DB_PASSWORD || 'Zer4oBi57gZ',
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://bpnhzaexmqruzaxyzlyc.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA'
};

// Fallback Google Apps Script URL if not in database
const FALLBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwO6pL4Z58tUf5d71rA0bO9M2XvWqF8HjK/exec';

let lastBackupState = {
  status: 'idle',
  lastRunTime: null,
  lastFileName: null,
  lastFilePath: null,
  lastFileSize: null,
  lastError: null,
  isUploading: false
};

/**
 * Locate pg_dump.exe across standard installation paths
 */
function findPgDumpPath() {
  if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
    return process.env.PG_DUMP_PATH;
  }

  const potentialVersions = ['18', '17', '16', '15', '14', '13', '12'];
  for (const v of potentialVersions) {
    const p1 = `C:\\Program Files\\PostgreSQL\\${v}\\bin\\pg_dump.exe`;
    if (fs.existsSync(p1)) return p1;
    const p2 = `C:\\Program Files (x86)\\PostgreSQL\\${v}\\bin\\pg_dump.exe`;
    if (fs.existsSync(p2)) return p2;
  }

  // Fallback to command name in PATH
  return 'pg_dump';
}

/**
 * Get backup storage directory
 */
function getBackupDirectory() {
  const dir = path.join(os.homedir(), 'Documents', 'AdHub_Backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Format timestamp for filename: REKAZ_YYYY-MM-DD_HH-mm-ss.dump
 */
function generateBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `REKAZ_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.dump`;
}

/**
 * Fetch Google Drive Script URL from Supabase company_settings table
 */
async function fetchGoogleDriveScriptUrl() {
  try {
    const url = `${DB_CONFIG.supabaseUrl}/rest/v1/company_settings?select=google_drive_script_url&limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': DB_CONFIG.supabaseAnonKey,
        'Authorization': `Bearer ${DB_CONFIG.supabaseAnonKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.google_drive_script_url) {
        return data[0].google_drive_script_url;
      }
    }
  } catch (err) {
    console.warn('[Desktop Backup] Could not query company_settings for script URL:', err.message);
  }

  return FALLBACK_SCRIPT_URL;
}

/**
 * Upload dump file to Google Drive via Apps Script Web App
 */
async function uploadToGoogleDrive(filePath, scriptUrl) {
  if (!scriptUrl) {
    throw new Error('Google Apps Script URL is not configured');
  }

  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const base64Data = fileBuffer.toString('base64');

  const payload = {
    filename: fileName,
    fileData: base64Data,
    mimeType: 'application/octet-stream',
    description: `Automated silent backup of REKAZ database (${new Date().toLocaleString('ar-LY')})`
  };

  const response = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let resultJson = null;
  try {
    resultJson = JSON.parse(responseText);
  } catch {
    resultJson = { raw: responseText };
  }

  return resultJson;
}

/**
 * Format bytes to readable size
 */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Main Backup Runner
 */
async function runBackup(options = {}) {
  const { onProgress = () => {}, triggerType = 'auto' } = options;
  const startTime = new Date();

  lastBackupState.status = 'running';
  lastBackupState.lastError = null;

  onProgress({
    status: 'starting',
    message: 'جاري تجهيز النسخ الاحتياطي التلقائي لقاعدة البيانات...',
    triggerType,
    startTime: startTime.toISOString()
  });

  const pgDumpExe = findPgDumpPath();
  const backupDir = getBackupDirectory();
  const fileName = generateBackupFilename();
  const filePath = path.join(backupDir, fileName);

  return new Promise(async (resolve, reject) => {
    try {
      onProgress({
        status: 'dumping',
        message: 'جاري استخراج قاعدة البيانات عبر pg_dump في الخلفية...',
        fileName,
        filePath
      });

      const args = [
        '-h', DB_CONFIG.host,
        '-p', DB_CONFIG.port,
        '-U', DB_CONFIG.user,
        '-F', 'c',
        '-b',
        '-f', filePath,
        DB_CONFIG.database
      ];

      const env = Object.assign({}, process.env, {
        PGPASSWORD: DB_CONFIG.password
      });

      const child = spawn(pgDumpExe, args, {
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrOutput = '';
      child.stderr.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      child.on('error', (err) => {
        const errMsg = `تعذر تشغيل pg_dump: ${err.message}. يرجى التأكد من تثبيت PostgreSQL.`;
        console.error('[Desktop Backup Error]:', errMsg);
        lastBackupState.status = 'error';
        lastBackupState.lastError = errMsg;
        onProgress({ status: 'error', message: errMsg, error: errMsg });
        reject(new Error(errMsg));
      });

      child.on('close', async (code) => {
        // Clear password immediately
        delete env.PGPASSWORD;

        if (code !== 0) {
          const errMsg = `فشل pg_dump بكود (${code}): ${stderrOutput || 'خطأ غير معروف'}`;
          console.error('[Desktop Backup Failed]:', errMsg);
          lastBackupState.status = 'error';
          lastBackupState.lastError = errMsg;
          onProgress({ status: 'error', message: errMsg, error: errMsg });
          return reject(new Error(errMsg));
        }

        // Verify created file
        let fileSizeFormatted = '0 MB';
        let fileSizeBytes = 0;
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          fileSizeBytes = stats.size;
          fileSizeFormatted = formatBytes(stats.size);
        }

        lastBackupState.lastFileName = fileName;
        lastBackupState.lastFilePath = filePath;
        lastBackupState.lastFileSize = fileSizeFormatted;
        lastBackupState.lastRunTime = new Date().toISOString();

        onProgress({
          status: 'dump_completed',
          message: `تم إنشاء النسخة المحلية بنجاح (${fileSizeFormatted})`,
          fileName,
          filePath,
          fileSize: fileSizeFormatted
        });

        // Step 2: Upload to Google Drive
        let driveUploadSuccess = false;
        let driveErrorMsg = null;
        try {
          onProgress({
            status: 'uploading',
            message: 'جاري رفع النسخة الاحتياطية إلى Google Drive...',
            fileName,
            filePath,
            fileSize: fileSizeFormatted
          });

          const scriptUrl = await fetchGoogleDriveScriptUrl();
          if (scriptUrl) {
            await uploadToGoogleDrive(filePath, scriptUrl);
            driveUploadSuccess = true;
          } else {
            driveErrorMsg = 'رابط Google Apps Script غير متوفر في الإعدادات';
          }
        } catch (uploadErr) {
          console.warn('[Desktop Backup] Google Drive upload failed:', uploadErr.message);
          driveErrorMsg = uploadErr.message;
        }

        lastBackupState.status = 'completed';
        const finalStatus = {
          status: 'completed',
          message: driveUploadSuccess
            ? `تم النسخ الاحتياطي والرفع إلى Google Drive بنجاح (${fileSizeFormatted})`
            : `تم حفظ النسخة محلياً (${fileSizeFormatted}) - تعذر الرفع: ${driveErrorMsg || 'غير محدد'}`,
          fileName,
          filePath,
          fileSize: fileSizeFormatted,
          fileSizeBytes,
          driveUploaded: driveUploadSuccess,
          driveError: driveErrorMsg,
          completedAt: new Date().toISOString()
        };

        onProgress(finalStatus);
        resolve(finalStatus);
      });
    } catch (outerErr) {
      lastBackupState.status = 'error';
      lastBackupState.lastError = outerErr.message;
      onProgress({ status: 'error', message: outerErr.message, error: outerErr.message });
      reject(outerErr);
    }
  });
}

/**
 * List recent local backup files
 */
function getLocalBackupList() {
  const dir = getBackupDirectory();
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.dump') || f.endsWith('.sql'))
      .map(f => {
        const fp = path.join(dir, f);
        const stats = fs.statSync(fp);
        return {
          name: f,
          path: fp,
          size: formatBytes(stats.size),
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return files.slice(0, 20);
  } catch {
    return [];
  }
}

function getBackupStatus() {
  return {
    ...lastBackupState,
    backupDir: getBackupDirectory(),
    localBackups: getLocalBackupList(),
    pgDumpPath: findPgDumpPath()
  };
}

module.exports = {
  runBackup,
  getBackupStatus,
  getBackupDirectory,
  getLocalBackupList,
  findPgDumpPath
};
