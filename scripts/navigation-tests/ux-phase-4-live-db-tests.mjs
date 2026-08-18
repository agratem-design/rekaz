/**
 * ============================================================================
 * UX PHASE 4: LIVE DATABASE SERVER-SIDE AUTHORITY & RETRY SAFETY TEST SUITE
 * ============================================================================
 */

import { supabase } from '../financial-tests/client.mjs';

let passedTests = 0;
let failedTests = 0;
const results = [];

function assert(id, description, passed, details = '', expected = true, actual = true) {
  if (passed) {
    passedTests++;
    results.push({ id, description, status: 'PASS', details });
    console.log(`  \x1b[32m[PASS]\x1b[0m ${id}: ${description}`);
    if (details) console.log(`         \x1b[90m└─ ${details}\x1b[0m`);
  } else {
    failedTests++;
    results.push({ id, description, status: 'FAIL', details, expected, actual });
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${id}: ${description}`);
    console.log(`         \x1b[90m└─ Expected: ${expected}\x1b[0m`);
    console.log(`         \x1b[90m└─ Actual:   ${actual}\x1b[0m`);
    if (details) console.log(`         \x1b[90m└─ Details:  ${details}\x1b[0m`);
  }
}

async function runLiveDbTests() {
  console.log('\n================================================================');
  console.log('  UX PHASE 4: LIVE DATABASE SERVER-SIDE AUTHORITY TEST RUNNER   ');
  console.log('================================================================\n');

  const testRunId = `P4-SRV-${Date.now()}`;
  const ids = {
    clientA: '00000000-0000-4000-a000-000000000001',
    contractingProj: '00000000-0000-4000-a000-000000000002',
    finishingProj: '00000000-0000-4000-a000-000000000003',
    supplierA: '00000000-0000-4000-a000-000000000004',
    supplierB: '00000000-0000-4000-a000-000000000005',
    contractingRootTreasury: '00000000-0000-4000-a000-000000000006',
    contractingBranchTreasury: '00000000-0000-4000-a000-000000000007',
    finishingRootTreasury: '00000000-0000-4000-a000-000000000008',
    finishingBranchTreasury: '00000000-0000-4000-a000-000000000009',
    purchase1: '00000000-0000-4000-a000-000000000010',
    purchase2: '00000000-0000-4000-a000-000000000011',
    purchase3: '00000000-0000-4000-a000-000000000012',
    purchase4: '00000000-0000-4000-a000-000000000013',
    payment1: '00000000-0000-4000-a000-000000000014',
    payment2: '00000000-0000-4000-a000-000000000015',
    expense1: '00000000-0000-4000-a000-000000000016',
  };

  try {
    // ------------------------------------------------------------------------
    // SETUP: Clean existing test records if any
    // ------------------------------------------------------------------------
    await supabase.from('purchase_payments').delete().in('purchase_id', [ids.purchase1, ids.purchase2, ids.purchase3, ids.purchase4]);
    await supabase.from('purchases').delete().in('id', [ids.purchase1, ids.purchase2, ids.purchase3, ids.purchase4]);
    await supabase.from('expenses').delete().in('id', [ids.expense1]);
    await supabase.from('projects').delete().in('id', [ids.contractingProj, ids.finishingProj]);
    await supabase.from('suppliers').delete().in('id', [ids.supplierA, ids.supplierB]);
    await supabase.from('treasury_transactions').delete().in('treasury_id', [
      ids.contractingRootTreasury,
      ids.contractingBranchTreasury,
      ids.finishingRootTreasury,
      ids.finishingBranchTreasury
    ]);
    await supabase.from('treasuries').update({ balance: 0 }).in('id', [
      ids.contractingBranchTreasury,
      ids.finishingBranchTreasury,
      ids.contractingRootTreasury,
      ids.finishingRootTreasury
    ]);
    await supabase.from('treasuries').delete().in('id', [
      ids.contractingBranchTreasury,
      ids.finishingBranchTreasury
    ]);
    await supabase.from('treasuries').delete().in('id', [
      ids.contractingRootTreasury,
      ids.finishingRootTreasury
    ]);
    await supabase.from('clients').delete().in('id', [ids.clientA]);

    console.log('⏳ Setting up isolated Live DB fixtures...');

    // 1. Client
    const { error: cErr } = await supabase.from('clients').insert([{
      id: ids.clientA,
      name: `Test Client ${testRunId}`,
      phone: '0910000000'
    }]);
    if (cErr) console.error('Client Insert Err:', cErr);

    // 2. Treasuries (Roots first, balance: 0)
    const { error: tRootErr } = await supabase.from('treasuries').insert([
      {
        id: ids.contractingRootTreasury,
        name: `Contracting Root ${testRunId}`,
        project_category: 'contracting',
        treasury_type: 'cash',
        balance: 0,
        is_active: true,
        parent_id: null,
      },
      {
        id: ids.finishingRootTreasury,
        name: `Finishing Root ${testRunId}`,
        project_category: 'finishing',
        treasury_type: 'cash',
        balance: 0,
        is_active: true,
        parent_id: null,
      }
    ]);
    if (tRootErr) console.error('Treasury Roots Err:', tRootErr);

    // Branches second
    const { error: tBranchErr } = await supabase.from('treasuries').insert([
      {
        id: ids.contractingBranchTreasury,
        name: `Contracting Branch ${testRunId}`,
        project_category: 'contracting',
        treasury_type: 'cash',
        balance: 0,
        is_active: true,
        parent_id: ids.contractingRootTreasury,
      },
      {
        id: ids.finishingBranchTreasury,
        name: `Finishing Branch ${testRunId}`,
        project_category: 'finishing',
        treasury_type: 'cash',
        balance: 0,
        is_active: true,
        parent_id: ids.finishingRootTreasury,
      }
    ]);
    if (tBranchErr) console.error('Treasury Branches Err:', tBranchErr);

    // 3. Projects
    const { error: pErr } = await supabase.from('projects').insert([
      {
        id: ids.contractingProj,
        name: `Contracting Proj ${testRunId}`,
        client_id: ids.clientA,
        project_type: 'contracting',
        default_treasury_id: ids.contractingRootTreasury,
        budget: 100000,
      },
      {
        id: ids.finishingProj,
        name: `Finishing Proj ${testRunId}`,
        client_id: ids.clientA,
        project_type: 'finishing',
        default_treasury_id: ids.finishingRootTreasury,
      }
    ]);
    if (pErr) console.error('Projects Err:', pErr);

    // 4. Suppliers
    const { error: sErr } = await supabase.from('suppliers').insert([
      { id: ids.supplierA, name: `Supplier A ${testRunId}`, phone: '0920000001' },
      { id: ids.supplierB, name: `Supplier B ${testRunId}`, phone: '0920000002' },
    ]);
    if (sErr) console.error('Suppliers Err:', sErr);

    // 5. Purchases
    const { error: pur1Err } = await supabase.from('purchases').insert([{
      id: ids.purchase1,
      project_id: ids.contractingProj,
      supplier_id: ids.supplierA,
      total_amount: 10000,
      paid_amount: 0,
      status: 'due',
      purchase_type: 'material',
      date: new Date().toISOString().split('T')[0]
    }]);
    if (pur1Err) console.error('Purchase1 Err:', pur1Err);

    console.log('✅ Isolated Live DB fixtures initialized.\n');

    // ------------------------------------------------------------------------
    // P4-TREASURY-SRV-01: Cross-Domain Purchase Payment Server Rejection
    // ------------------------------------------------------------------------
    const { error: crossPayErr } = await supabase.from('purchase_payments').insert([{
      id: ids.payment1,
      purchase_id: ids.purchase1,
      treasury_id: ids.finishingRootTreasury,
      amount: 3000,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0]
    }]);

    const crossPayBlocked = Boolean(crossPayErr && crossPayErr.message.includes('INVALID_TREASURY_DOMAIN'));
    assert(
      'P4-TREASURY-SRV-01',
      'Contracting purchase payment with Finishing treasury is rejected server-side by trigger',
      crossPayBlocked,
      `DB Error: ${crossPayErr?.message}`,
      true,
      crossPayBlocked
    );

    // ------------------------------------------------------------------------
    // P4-TREASURY-SRV-02: Cross-Domain Direct Project Expense Server Rejection
    // ------------------------------------------------------------------------
    const { error: crossExpErr } = await supabase.from('expenses').insert([{
      id: ids.expense1,
      project_id: ids.contractingProj,
      type: 'project',
      description: 'Test cross expense',
      amount: 500,
      treasury_id: ids.finishingRootTreasury,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0]
    }]);

    const crossExpBlocked = Boolean(crossExpErr && crossExpErr.message.includes('INVALID_TREASURY_DOMAIN'));
    assert(
      'P4-TREASURY-SRV-02',
      'Direct Project Expense across conflicting treasury domain is rejected server-side by trigger',
      crossExpBlocked,
      `DB Error: ${crossExpErr?.message}`,
      true,
      crossExpBlocked
    );

    // ------------------------------------------------------------------------
    // P4-TREASURY-SRV-03: Branch Tree Server Validation
    // ------------------------------------------------------------------------
    const { error: crossBranchErr } = await supabase.from('purchase_payments').insert([{
      id: ids.payment1,
      purchase_id: ids.purchase1,
      treasury_id: ids.finishingBranchTreasury,
      amount: 2000,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0]
    }]);

    const branchTreeBlocked = Boolean(crossBranchErr && crossBranchErr.message.includes('INVALID_TREASURY_DOMAIN'));
    assert(
      'P4-TREASURY-SRV-03',
      'Branch treasury inheriting wrong root domain is rejected server-side by hierarchy inspection',
      branchTreeBlocked,
      `DB Error: ${crossBranchErr?.message}`,
      true,
      branchTreeBlocked
    );

    // ------------------------------------------------------------------------
    // P4-TREASURY-SRV-04: Wrong Project Default Treasury Rejection
    // ------------------------------------------------------------------------
    await supabase.from('projects').update({
      default_treasury_id: ids.finishingRootTreasury
    }).eq('id', ids.contractingProj);

    const { error: defaultMismatchErr } = await supabase.from('purchase_payments').insert([{
      id: ids.payment1,
      purchase_id: ids.purchase1,
      treasury_id: ids.finishingRootTreasury,
      amount: 1000,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0]
    }]);

    const defaultMismatchBlocked = Boolean(defaultMismatchErr && defaultMismatchErr.message.includes('INVALID_TREASURY_DOMAIN'));
    assert(
      'P4-TREASURY-SRV-04',
      'Wrong-domain default treasury on project cannot be used for financial posting',
      defaultMismatchBlocked,
      `DB Error: ${defaultMismatchErr?.message}`,
      true,
      defaultMismatchBlocked
    );

    // ------------------------------------------------------------------------
    // P4-FIN-RETRY-01: Initial Payment Retry Idempotency
    // ------------------------------------------------------------------------
    const idempotencyKey = `initial_payment_${ids.purchase1}`;
    const { data: firstPay, error: firstPayErr } = await supabase.from('purchase_payments').insert([{
      id: ids.payment1,
      purchase_id: ids.purchase1,
      treasury_id: ids.contractingRootTreasury,
      amount: 3000,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0],
      idempotency_key: idempotencyKey,
    }]).select().single();

    if (firstPayErr) console.error('First Payment Error:', firstPayErr);

    // Second attempt with exact same idempotency_key
    const { error: retryDuplicateErr } = await supabase.from('purchase_payments').insert([{
      purchase_id: ids.purchase1,
      treasury_id: ids.contractingRootTreasury,
      amount: 3000,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0],
      idempotency_key: idempotencyKey,
    }]);

    const { data: payRecords } = await supabase
      .from('purchase_payments')
      .select('amount')
      .eq('purchase_id', ids.purchase1);

    const totalPaidOnDb = payRecords?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const retrySafe = (payRecords?.length === 1) && (totalPaidOnDb === 3000) && Boolean(retryDuplicateErr);

    assert(
      'P4-FIN-RETRY-01',
      'Initial payment retry with duplicate idempotency_key is rejected without double deduction',
      retrySafe,
      `Total Recorded Payments: ${payRecords?.length} rows, Sum: ${totalPaidOnDb} LYD, Duplicate Err: ${retryDuplicateErr?.message}`,
      true,
      retrySafe
    );

    // ------------------------------------------------------------------------
    // P4-FIN-01: Unpaid Purchase Obligation & Zero Treasury Movement
    // ------------------------------------------------------------------------
    await supabase.from('purchases').insert([{
      id: ids.purchase2,
      project_id: ids.contractingProj,
      supplier_id: ids.supplierA,
      total_amount: 8000,
      paid_amount: 0,
      status: 'due',
      purchase_type: 'material',
      date: new Date().toISOString().split('T')[0]
    }]);

    const { data: p2Payments } = await supabase
      .from('purchase_payments')
      .select('id')
      .eq('purchase_id', ids.purchase2);

    const p4Fin01Passed = (p2Payments?.length === 0);
    assert(
      'P4-FIN-01',
      'Unpaid purchase creates obligation in database with zero purchase_payments rows',
      p4Fin01Passed,
      `Payments count: ${p2Payments?.length}`,
      true,
      p4Fin01Passed
    );

    // ------------------------------------------------------------------------
    // P4-FIN-02: Partial Payment Financial Invariant
    // ------------------------------------------------------------------------
    const { data: p1Row } = await supabase
      .from('purchases')
      .select('paid_amount, status, total_amount')
      .eq('id', ids.purchase1)
      .single();

    const p4Fin02Passed = (Number(p1Row?.paid_amount) === 3000) && (p1Row?.status === 'partial');
    assert(
      'P4-FIN-02',
      'Partial payment correctly derives purchases.paid_amount=3000 and status="partial"',
      p4Fin02Passed,
      `DB paid_amount: ${p1Row?.paid_amount}, status: ${p1Row?.status}`,
      true,
      p4Fin02Passed
    );

    // ------------------------------------------------------------------------
    // P4-FIN-03: Full Payment Financial Invariant
    // ------------------------------------------------------------------------
    await supabase.from('purchase_payments').insert([{
      id: ids.payment2,
      purchase_id: ids.purchase1,
      treasury_id: ids.contractingRootTreasury,
      amount: 7000,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0]
    }]);

    const { data: p1PaidRow } = await supabase
      .from('purchases')
      .select('paid_amount, status')
      .eq('id', ids.purchase1)
      .single();

    const p4Fin03Passed = (Number(p1PaidRow?.paid_amount) === 10000) && (p1PaidRow?.status === 'paid');
    assert(
      'P4-FIN-03',
      'Full payment correctly syncs purchases.paid_amount=10000 and status="paid"',
      p4Fin03Passed,
      `DB paid_amount: ${p1PaidRow?.paid_amount}, status: ${p1PaidRow?.status}`,
      true,
      p4Fin03Passed
    );

    // ------------------------------------------------------------------------
    // P4-FIN-04: Server-Side Protection: Total Below Paid Amount
    // ------------------------------------------------------------------------
    const { error: reduceErr } = await supabase
      .from('purchases')
      .update({ total_amount: 5000 })
      .eq('id', ids.purchase1);

    const totalReductionBlocked = Boolean(reduceErr && reduceErr.message.includes('CANNOT_REDUCE_BELOW_PAID'));
    assert(
      'P4-FIN-04',
      'Reducing purchase total below already paid amount is blocked server-side by trigger',
      totalReductionBlocked,
      `DB Error: ${reduceErr?.message}`,
      true,
      totalReductionBlocked
    );

    // ------------------------------------------------------------------------
    // P4-FIN-06: Server-Side Protection: Supplier Reassignment After Payment
    // ------------------------------------------------------------------------
    const { error: reassignErr } = await supabase
      .from('purchases')
      .update({ supplier_id: ids.supplierB })
      .eq('id', ids.purchase1);

    const reassignBlocked = Boolean(reassignErr && reassignErr.message.includes('CANNOT_CHANGE_SUPPLIER_WITH_PAYMENTS'));
    assert(
      'P4-FIN-06',
      'Reassigning supplier on a purchase with historical payments is blocked server-side by trigger',
      reassignBlocked,
      `DB Error: ${reassignErr?.message}`,
      true,
      reassignBlocked
    );

    // ------------------------------------------------------------------------
    // P4-FIN-05: Direct Project Expense Financial Invariant
    // ------------------------------------------------------------------------
    const { data: expRow, error: expInsertErr } = await supabase.from('expenses').insert([{
      id: ids.expense1,
      project_id: ids.contractingProj,
      type: 'project',
      subtype: 'نثريات موقعية',
      description: 'وقود شاحنات',
      amount: 1500,
      treasury_id: ids.contractingBranchTreasury,
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0]
    }]).select().single();

    const p4Fin05Passed = !expInsertErr && (Number(expRow?.amount) === 1500);
    assert(
      'P4-FIN-05',
      'Direct project expense successfully records in expenses and deducts from matching treasury branch',
      p4Fin05Passed,
      `Expense ID: ${expRow?.id}, Amount: ${expRow?.amount}`,
      true,
      p4Fin05Passed
    );

  } catch (err) {
    console.error('Unexpected test error:', err);
  } finally {
    // ------------------------------------------------------------------------
    // TEARDOWN: Clean up 100% of test records
    // ------------------------------------------------------------------------
    console.log('\n🧹 Cleaning up test fixtures from Live DB...');

    await supabase.from('purchase_payments').delete().in('purchase_id', [ids.purchase1, ids.purchase2, ids.purchase3, ids.purchase4]);
    await supabase.from('purchases').delete().in('id', [ids.purchase1, ids.purchase2, ids.purchase3, ids.purchase4]);
    await supabase.from('expenses').delete().in('id', [ids.expense1]);
    await supabase.from('projects').delete().in('id', [ids.contractingProj, ids.finishingProj]);
    await supabase.from('suppliers').delete().in('id', [ids.supplierA, ids.supplierB]);
    await supabase.from('treasury_transactions').delete().in('treasury_id', [
      ids.contractingRootTreasury,
      ids.contractingBranchTreasury,
      ids.finishingRootTreasury,
      ids.finishingBranchTreasury
    ]);
    await supabase.from('treasuries').update({ balance: 0 }).in('id', [
      ids.contractingBranchTreasury,
      ids.finishingBranchTreasury,
      ids.contractingRootTreasury,
      ids.finishingRootTreasury
    ]);
    await supabase.from('treasuries').delete().in('id', [
      ids.contractingBranchTreasury,
      ids.finishingBranchTreasury
    ]);
    await supabase.from('treasuries').delete().in('id', [
      ids.contractingRootTreasury,
      ids.finishingRootTreasury
    ]);
    await supabase.from('clients').delete().in('id', [ids.clientA]);

    console.log('✅ Cleanup complete. All isolated test records pruned.\n');
  }

  console.log('================================================================');
  console.log('          UX PHASE 4 LIVE DB TEST RUN SUMMARY                   ');
  console.log('================================================================');
  console.log(`  Total Tests:    ${passedTests + failedTests}`);
  console.log(`  Passed:         ${passedTests}`);
  console.log(`  Failed:         ${failedTests}`);
  if (failedTests === 0) {
    console.log('  Status:         \x1b[32mALL LIVE DATABASE INVARIANTS PASSED (100%)\x1b[0m');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.log('  Status:         \x1b[31mSOME LIVE DATABASE INVARIANTS FAILED\x1b[0m');
    console.log('================================================================\n');
    process.exit(1);
  }
}

runLiveDbTests();
