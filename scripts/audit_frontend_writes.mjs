import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function searchDir(dir, pattern, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('dist')) {
      searchDir(fullPath, pattern, callback);
    } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (pattern.test(content)) {
        callback(fullPath, content);
      }
    }
  }
}

console.log('=====================================================');
console.log('AUDIT: FRONTEND DIRECT WRITES TO FINANCIAL TABLES');
console.log('=====================================================');

const tables = ['treasury_transactions', 'client_payments', 'purchase_payments', 'expenses', 'transfers', 'purchases', 'technicians'];

tables.forEach(table => {
  console.log(`\n\n--- TABLE: ${table} ---`);
  const regex = new RegExp(`from\\([\\\"\\']${table}[\\\"\\']\\)\\.(insert|update|delete|upsert)`, 'g');
  searchDir(srcDir, regex, (filePath, content) => {
    const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const match = line.match(new RegExp(`from\\([\\\"\\']${table}[\\\"\\']\\)\\.(insert|update|delete|upsert)`));
      if (match) {
        console.log(`\n[${relPath}:${idx + 1}] Operation: ${match[1]}`);
        const snippetStart = Math.max(0, idx - 1);
        const snippetEnd = Math.min(lines.length - 1, idx + 10);
        for (let i = snippetStart; i <= snippetEnd; i++) {
          console.log(`  ${i + 1}: ${lines[i]}`);
        }
      }
    });
  });
});
