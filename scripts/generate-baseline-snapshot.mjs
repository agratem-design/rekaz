import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const supabaseUrl = 'https://bpnhzaexmqruzaxyzlyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA';

const supabase = createClient(supabaseUrl, supabaseKey);

const backupDir = path.join(rootDir, 'backups', 'pre-fix-snapshot');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function run() {
  console.log('=== CREATING FINANCIAL SNAPSHOT & RECONSTRUCTING BASELINE ===');

  const tables = [
    'treasuries',
    'treasury_transactions',
    'clients',
    'client_payments',
    'client_payment_allocations',
    'suppliers',
    'purchases',
    'purchase_payments',
    'technicians',
    'technician_progress_records',
    'expenses',
    'projects',
    'contracts',
    'transfers'
  ];

  const data = {};
  for (const table of tables) {
    const { data: records, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`Warning reading ${table}:`, error.message);
      data[table] = [];
    } else {
      data[table] = records || [];
      fs.writeFileSync(
        path.join(backupDir, `${table}.json`),
        JSON.stringify(records, null, 2),
        'utf8'
      );
      console.log(`Saved snapshot for ${table}: ${records.length} records`);
    }
  }

  // --- 1. Treasury Reconstruction ---
  console.log('\n--- 1. TREASURY RECONSTRUCTION ---');
  const treasuryReport = data.treasuries.map(t => {
    const txs = data.treasury_transactions.filter(tx => tx.treasury_id === t.id);
    const totalDeposits = txs.filter(tx => tx.type === 'deposit').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const totalWithdrawals = txs.filter(tx => tx.type === 'withdrawal').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const reconstructed = totalDeposits - totalWithdrawals;
    const reported = Number(t.balance) || 0;
    const diff = reported - reconstructed;

    return {
      id: t.id,
      name: t.name,
      type: t.treasury_type,
      reportedBalance: reported,
      reconstructedBalance: reconstructed,
      difference: diff,
      txCount: txs.length,
      deposits: totalDeposits,
      withdrawals: totalWithdrawals
    };
  });
  console.log(JSON.stringify(treasuryReport, null, 2));

  // --- 2. Client Reconstruction ---
  console.log('\n--- 2. CLIENT RECONSTRUCTION ---');
  const clientReport = data.clients.map(c => {
    const contracts = data.contracts.filter(ct => ct.client_id === c.id);
    const totalContractValue = contracts.reduce((sum, ct) => sum + (Number(ct.amount) || 0), 0);

    const payments = data.client_payments.filter(p => p.client_id === c.id);
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const expectedRemaining = totalContractValue - totalPaid;

    return {
      id: c.id,
      name: c.name,
      totalObligation: totalContractValue,
      totalPaid: totalPaid,
      expectedRemaining: expectedRemaining,
      paymentsCount: payments.length
    };
  });
  console.log(JSON.stringify(clientReport, null, 2));

  // --- 3. Supplier Reconstruction ---
  console.log('\n--- 3. SUPPLIER RECONSTRUCTION ---');
  const supplierReport = data.suppliers.map(s => {
    const purchases = data.purchases.filter(p => p.supplier_id === s.id);
    const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

    const purchaseIds = purchases.map(p => p.id);
    const payments = data.purchase_payments.filter(pp => purchaseIds.includes(pp.purchase_id));
    const totalPaid = payments.reduce((sum, pp) => sum + (Number(pp.amount) || 0), 0);

    const expectedRemaining = totalPurchases - totalPaid;

    return {
      id: s.id,
      name: s.name,
      totalPurchases: totalPurchases,
      totalPaid: totalPaid,
      expectedRemaining: expectedRemaining,
      purchasesCount: purchases.length,
      paymentsCount: payments.length
    };
  });
  console.log(JSON.stringify(supplierReport, null, 2));

  // --- 4. Technician Reconstruction ---
  console.log('\n--- 4. TECHNICIAN RECONSTRUCTION ---');
  const techReport = data.technicians.map(t => {
    const progress = data.technician_progress_records.filter(r => r.technician_id === t.id);
    const totalEarned = progress.reduce((sum, r) => sum + (Number(r.amount) || (Number(r.quantity) * (Number(t.meter_rate) || 25))), 0);

    const payments = data.purchase_payments.filter(pp => pp.technician_id === t.id);
    const totalPaid = payments.reduce((sum, pp) => sum + (Number(pp.amount) || 0), 0);

    return {
      id: t.id,
      name: t.name,
      specialty: t.specialty,
      totalEarned: totalEarned,
      totalPaid: totalPaid,
      expectedRemaining: totalEarned - totalPaid
    };
  });
  console.log(JSON.stringify(techReport, null, 2));

  // Summary JSON
  const summary = {
    generatedAt: new Date().toISOString(),
    treasuries: treasuryReport,
    clients: clientReport,
    suppliers: supplierReport,
    technicians: techReport,
    totalExpenses: data.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    totalTransfers: data.transfers.length
  };

  fs.writeFileSync(
    path.join(backupDir, 'baseline-summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  console.log('\n✓ Baseline Snapshot completed successfully.');
}

run().catch(console.error);
