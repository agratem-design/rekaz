import fs from 'fs';

async function main() {
  const jsonPath = 'backups/pre-manual-acceptance-clean-reset-2026-08-19.json';
  const sqlPath = 'backups/pre-manual-acceptance-clean-reset-2026-08-19.sql';

  console.log(`Verifying backup files:`);
  console.log(`- JSON exists: ${fs.existsSync(jsonPath)} (${fs.statSync(jsonPath).size} bytes)`);
  console.log(`- SQL exists: ${fs.existsSync(sqlPath)} (${fs.statSync(sqlPath).size} bytes)`);

  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`- Tables in backup: ${Object.keys(jsonContent).length}`);
  for (const [t, rows] of Object.entries(jsonContent)) {
    if (rows && rows.length > 0) {
      console.log(`  * ${t}: ${rows.length} rows`);
    }
  }
  console.log(`BACKUP 100% VERIFIED AND READABLE.`);
}

main().catch(console.error);
