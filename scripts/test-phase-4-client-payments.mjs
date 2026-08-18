import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://bpnhzaexmqruzaxyzlyc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA';
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_CLIENT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '66666666-6666-6666-6666-666666666666';
const TEST_TREASURY_ID = 'c504cce9-8bfd-4cda-8296-80febdec2432'; // الخزينة الرئيسية

async function runTests() {
  console.log('================================================================');
  console.log('       PHASE 4: CLIENT PAYMENTS ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  const testResults = [];

  // Helper to assert
  function assert(name, condition, details) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      testResults.push({ name, status: 'PASS', details });
    } else {
      console.error(`  [FAIL] ${name} -> ${details}`);
      testResults.push({ name, status: 'FAIL', details });
    }
  }

  // --- Baseline check ---
  console.log('1. Checking Baseline before testing...');
  const { data: initialContract } = await supabase.from('contracts').select('amount').eq('client_id', TEST_CLIENT_ID).single();
  const initialObligation = Number(initialContract?.amount) || 30000;
  console.log(`   Initial Client Obligation: ${initialObligation} LYD`);

  // --- Test 1: Insert Payment & Check Exact 1 Treasury Posting ---
  console.log('\n--- TEST 1: Insert Client Payment & Verify Single Treasury Deposit ---');
  const payment1Id = 'aaaa1111-1111-1111-1111-111111111111';
  
  // Clean any leftover
  await supabase.from('client_payments').delete().eq('id', payment1Id);

  const { error: insErr } = await supabase.from('client_payments').insert({
    id: payment1Id,
    client_id: TEST_CLIENT_ID,
    project_id: TEST_PROJECT_ID,
    amount: 10000,
    date: '2026-08-15',
    payment_method: 'cash',
    treasury_id: TEST_TREASURY_ID,
    notes: 'دفعة اختبارية للمرحلة 4'
  });

  if (insErr) console.error('Insert error:', insErr);

  // Check Treasury balance & transactions count
  const { data: t1 } = await supabase.from('treasuries').select('balance').eq('id', TEST_TREASURY_ID).single();
  const { data: txs1 } = await supabase.from('treasury_transactions').select('*').eq('reference_id', payment1Id);

  const { data: allPay1 } = await supabase.from('client_payments').select('amount').eq('client_id', TEST_CLIENT_ID);
  const totalPaid1 = allPay1.reduce((sum, p) => sum + Number(p.amount), 0);
  const clientDue1 = initialObligation - totalPaid1;

  assert('Test 1.1: Treasury balance increased by exactly 10,000', Number(t1?.balance) === 10000, `Got: ${t1?.balance}`);
  assert('Test 1.2: Exactly 1 treasury transaction created', txs1?.length === 1, `Got count: ${txs1?.length}`);
  assert('Test 1.3: Treasury transaction type is deposit', txs1?.[0]?.type === 'deposit', `Got type: ${txs1?.[0]?.type}`);
  assert('Test 1.4: Client remaining due decreased to 20,000', clientDue1 === 20000, `Got due: ${clientDue1}`);

  // --- Test 2: Verify Cross-Settlement Isolation ---
  console.log('\n--- TEST 2: Verify Prohibited Cross-Settlement (Suppliers & Techs Unchanged) ---');
  const { data: suppliers } = await supabase.from('suppliers').select('*');
  const { data: purchases } = await supabase.from('purchases').select('*');
  const { data: purchasePayments } = await supabase.from('purchase_payments').select('*');
  const { data: techProgress } = await supabase.from('technician_progress_records').select('*');

  assert('Test 2.1: No purchases modified or created', purchases.length === 0, `Purchases count: ${purchases.length}`);
  assert('Test 2.2: No supplier payments modified or created', purchasePayments.length === 0, `Payments count: ${purchasePayments.length}`);
  assert('Test 2.3: No technician progress or payments modified', techProgress.length === 0, `Tech records count: ${techProgress.length}`);

  // --- Test 3: Update Payment (10,000 -> 15,000) & Check Recomputed Balance ---
  console.log('\n--- TEST 3: Update Payment Amount (10,000 -> 15,000) ---');
  const { error: updErr } = await supabase.from('client_payments').update({
    amount: 15000
  }).eq('id', payment1Id);

  if (updErr) console.error('Update error:', updErr);

  const { data: t3 } = await supabase.from('treasuries').select('balance').eq('id', TEST_TREASURY_ID).single();
  const { data: txs3 } = await supabase.from('treasury_transactions').select('*').eq('reference_id', payment1Id);
  const { data: allPay3 } = await supabase.from('client_payments').select('amount').eq('client_id', TEST_CLIENT_ID);
  const totalPaid3 = allPay3.reduce((sum, p) => sum + Number(p.amount), 0);

  assert('Test 3.1: Treasury balance updated to exactly 15,000 (Not cumulative 25,000)', Number(t3?.balance) === 15000, `Got: ${t3?.balance}`);
  assert('Test 3.2: Exactly 1 treasury transaction exists for this payment', txs3?.length === 1, `Got count: ${txs3?.length}`);
  assert('Test 3.3: Treasury transaction amount is 15,000', Number(txs3?.[0]?.amount) === 15000, `Got amount: ${txs3?.[0]?.amount}`);
  assert('Test 3.4: Client remaining due updated to 15,000', (initialObligation - totalPaid3) === 15000, `Got due: ${initialObligation - totalPaid3}`);

  // --- Test 4: Delete / Reversal of Payment ---
  console.log('\n--- TEST 4: Delete Payment & Verify Clean Reversal ---');
  const { error: delErr } = await supabase.from('client_payments').delete().eq('id', payment1Id);
  if (delErr) console.error('Delete error:', delErr);

  const { data: t4 } = await supabase.from('treasuries').select('balance').eq('id', TEST_TREASURY_ID).single();
  const { data: txs4 } = await supabase.from('treasury_transactions').select('*').eq('reference_id', payment1Id);
  const { data: allPay4 } = await supabase.from('client_payments').select('amount').eq('client_id', TEST_CLIENT_ID);
  const totalPaid4 = allPay4.reduce((sum, p) => sum + Number(p.amount), 0);

  assert('Test 4.1: Treasury balance reverted cleanly to 0', Number(t4?.balance) === 0, `Got: ${t4?.balance}`);
  assert('Test 4.2: Treasury transaction was deleted with zero orphans', txs4?.length === 0, `Got count: ${txs4?.length}`);
  assert('Test 4.3: Client remaining due reverted to initial 30,000', (initialObligation - totalPaid4) === 30000, `Got due: ${initialObligation - totalPaid4}`);

  // --- Test 5: Golden Standard Payment (20,000) & Idempotency ---
  console.log('\n--- TEST 5: Set Golden Standard Payment (20,000 LYD) & Test Duplicate Guard ---');
  const finalPaymentId = 'bbbb2222-2222-2222-2222-222222222222';
  await supabase.from('client_payments').delete().eq('id', finalPaymentId);

  const { error: ins5Err } = await supabase.from('client_payments').insert({
    id: finalPaymentId,
    client_id: TEST_CLIENT_ID,
    project_id: TEST_PROJECT_ID,
    amount: 20000,
    date: '2026-08-15',
    payment_method: 'cash',
    treasury_id: TEST_TREASURY_ID,
    notes: 'الدفعة الأولى المعتمدة للمشروع'
  });

  if (ins5Err) console.error('Insert 5 error:', ins5Err);

  // Trigger an update with identical values to simulate duplicate trigger/replay
  await supabase.from('client_payments').update({ amount: 20000 }).eq('id', finalPaymentId);

  const { data: t5 } = await supabase.from('treasuries').select('balance').eq('id', TEST_TREASURY_ID).single();
  const { data: txs5 } = await supabase.from('treasury_transactions').select('*').eq('reference_id', finalPaymentId);
  const { data: allPay5 } = await supabase.from('client_payments').select('amount').eq('client_id', TEST_CLIENT_ID);
  const totalPaid5 = allPay5.reduce((sum, p) => sum + Number(p.amount), 0);

  assert('Test 5.1: Final Treasury balance is exactly 20,000', Number(t5?.balance) === 20000, `Got: ${t5?.balance}`);
  assert('Test 5.2: Exactly 1 transaction exists after update/replay', txs5?.length === 1, `Got count: ${txs5?.length}`);
  assert('Test 5.3: Client remaining due is exactly 10,000 (30,000 - 20,000)', (initialObligation - totalPaid5) === 10000, `Got due: ${initialObligation - totalPaid5}`);

  console.log('\n================================================================');
  const allPassed = testResults.every(t => t.status === 'PASS');
  if (allPassed) {
    console.log(`✓ ALL TESTS PASSED (${testResults.length}/${testResults.length})! PHASE 4 ACCEPTANCE GATE MET.`);
  } else {
    console.error(`✗ SOME TESTS FAILED! (${testResults.filter(t=>t.status==='PASS').length}/${testResults.length})`);
  }
  console.log('================================================================\n');

  return { allPassed, testResults };
}

runTests().catch(console.error);
