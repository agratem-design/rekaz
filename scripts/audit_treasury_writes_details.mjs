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

const results = [];
const regex = /from\(["']treasury_transactions["']\)\.(insert|update|delete|upsert)/g;

searchDir(srcDir, regex, (filePath, content) => {
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/from\(["']treasury_transactions["']\)\.(insert|update|delete|upsert)/);
    if (match) {
      results.push({
        file: relPath,
        line: idx + 1,
        op: match[1],
        content: line.trim(),
        context: lines.slice(Math.max(0, idx - 3), Math.min(lines.length, idx + 15)).join('\n')
      });
    }
  });
});

console.log(JSON.stringify(results, null, 2));
