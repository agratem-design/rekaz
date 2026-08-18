// scripts/test-live-operations.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bpnhzaexmqruzaxyzlyc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let passed = 0;
let failed = 0;

function assert(condition, title, details = "") {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${title}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${title}`);
    if (details) console.error(`         -> ${details}`);
  }
}

async function runLiveTransactions() {
  console.log("===============================================================================");
  console.log("   LIVE TREASURY TRANSACTIONS & SETTLEMENTS TEST SUITE");
  console.log("===============================================================================\n");

  const cashTreasuryId = "c504cce9-8bfd-4cda-8296-80febdec2432";
  const bankTreasuryId = "ff7416dd-5295-4e55-bd52-2196eef9ec37";
  const clientId = "11111111-1111-1111-1111-111111111111";
  const projectId = "66666666-6666-6666-6666-666666666666";
  const purchaseId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const debtId = "e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0";

  // --- Initial State Check ---
  console.log("--- 0. Checking Baseline Treasury Balances ---");
  const { data: t0 } = await supabase.from("treasuries").select("id, name, balance").order("name");
  const initialCash = Number(t0.find(t => t.id === cashTreasuryId)?.balance);
  const initialBank = Number(t0.find(t => t.id === bankTreasuryId)?.balance);
  console.log(`  Baseline Cash: ${initialCash} LYD | Baseline Bank: ${initialBank} LYD | Total: ${initialCash + initialBank} LYD`);
  assert(initialCash === 14000, `Initial Cash is 14,000 LYD (Found: ${initialCash})`);
  assert(initialBank === 4500, `Initial Bank is 4,500 LYD (Found: ${initialBank})`);

  // --- Operation 1: Client Payment (5,000 LYD) ---
  console.log("\n--- 1. Performing Client Payment (تسديد دفعة زبون: 5,000 د.ل) ---");
  const newClientPaymentId = "eeeeeeee-eeee-eeee-eeee-111111111111";
  const { error: errCp } = await supabase.from("client_payments").insert([{
    id: newClientPaymentId,
    client_id: clientId,
    project_id: projectId,
    treasury_id: cashTreasuryId,
    amount: 5000.00,
    date: "2026-02-16",
    payment_method: "cash",
    notes: "تسديد دفعة إضافية من العميل شركة الأفق"
  }]);
  assert(!errCp, "Inserted new client payment of 5,000 LYD", errCp?.message);

  // Check Cash Treasury after Client Payment
  const { data: t1 } = await supabase.from("treasuries").select("balance").eq("id", cashTreasuryId).single();
  const cashAfterCp = Number(t1?.balance);
  assert(cashAfterCp === 19000, `Cash Treasury increased to 19,000 LYD (Found: ${cashAfterCp})`);

  // Check Client Total Paid
  const { data: allCp } = await supabase.from("client_payments").select("amount");
  const totalClientPaid = allCp.reduce((s, p) => s + Number(p.amount), 0);
  assert(totalClientPaid === 25000, `Client total payments = 25,000 LYD (30k contract - 25k paid = 5k remaining)`);

  // --- Operation 2: Supplier Settlement (1,500 LYD to fully pay invoice) ---
  console.log("\n--- 2. Performing Supplier Full Settlement (سداد كامل الفاتورة: 1,500 د.ل) ---");
  const newPurchasePaymentId = "dddddddd-dddd-dddd-dddd-111111111111";
  const { error: errPp } = await supabase.from("purchase_payments").insert([{
    id: newPurchasePaymentId,
    purchase_id: purchaseId,
    amount: 1500.00,
    date: "2026-02-16",
    payment_method: "cash",
    treasury_id: cashTreasuryId,
    commission: 0,
    notes: "سداد باقي قيمة فاتورة توريد الجبس بورد"
  }]);
  assert(!errPp, "Inserted final purchase payment of 1,500 LYD", errPp?.message);

  // Check Cash Treasury after Supplier Payment
  const { data: t2 } = await supabase.from("treasuries").select("balance").eq("id", cashTreasuryId).single();
  const cashAfterPp = Number(t2?.balance);
  assert(cashAfterPp === 17500, `Cash Treasury decreased to 17,500 LYD (Found: ${cashAfterPp})`);

  // Check Purchase status auto-updated to 'paid'
  const { data: purUpdated } = await supabase.from("purchases").select("total_amount, paid_amount, status").eq("id", purchaseId).single();
  assert(Number(purUpdated?.paid_amount) === 4000, `Purchase paid_amount auto-updated to 4,000 LYD`);
  assert(purUpdated?.status === "paid", `Purchase status auto-updated to 'paid'`);

  // --- Operation 3: Transfer between Treasuries (2,500 LYD from Cash to Bank) ---
  console.log("\n--- 3. Performing Inter-Treasury Transfer (تحويل بين الخزائن: 2,500 د.ل) ---");
  const transferTxId = "30303030-3030-3030-3030-111111111111";
  const { error: errTr } = await supabase.from("transfers").insert([{
    id: transferTxId,
    amount: 2500.00,
    date: "2026-02-16",
    type: "bank_transfer",
    subtype: "treasury_transfer",
    party_name: "تحويل إلى حساب مصرف الوحدة",
    status: "completed",
    notes: "تحويل سيولة من الخزينة النقدية للمصرف"
  }]);
  assert(!errTr, "Recorded transfer in transfers table", errTr?.message);

  // Insert corresponding ledger entries for the transfer
  const { error: errTxOut } = await supabase.from("treasury_transactions").insert([
    {
      treasury_id: cashTreasuryId,
      type: "withdrawal",
      amount: 2500.00,
      balance_after: 15000.00,
      description: "تحويل صادر إلى حساب مصرف الوحدة",
      reference_id: transferTxId,
      reference_type: "transfer_out",
      date: "2026-02-16",
      source: "transfers"
    },
    {
      treasury_id: bankTreasuryId,
      type: "deposit",
      amount: 2500.00,
      balance_after: 7000.00,
      description: "تحويل وارد من الخزينة الرئيسية",
      reference_id: transferTxId,
      reference_type: "transfer_in",
      date: "2026-02-16",
      source: "transfers"
    }
  ]);
  assert(!errTxOut, "Inserted twin ledger entries for transfer", errTxOut?.message);

  // Re-sync and verify both treasuries
  await supabase.rpc("sync_treasury_balance", { p_treasury_id: cashTreasuryId });
  await supabase.rpc("sync_treasury_balance", { p_treasury_id: bankTreasuryId });

  const { data: t3Cash } = await supabase.from("treasuries").select("balance").eq("id", cashTreasuryId).single();
  const { data: t3Bank } = await supabase.from("treasuries").select("balance").eq("id", bankTreasuryId).single();
  const cashAfterTr = Number(t3Cash?.balance);
  const bankAfterTr = Number(t3Bank?.balance);

  assert(cashAfterTr === 15000, `Cash Treasury balance is now 15,000 LYD (17.5k - 2.5k)`);
  assert(bankAfterTr === 7000, `Bank Treasury balance is now 7,000 LYD (4.5k + 2.5k)`);
  assert(cashAfterTr + bankAfterTr === 22000, `Total Liquidity preserved: 22,000 LYD`);

  // --- Operation 4: Settle Treasury Debt (500 LYD) ---
  console.log("\n--- 4. Settling Treasury Debt (سداد سلفة الخزينة: 500 د.ل) ---");
  const { error: errDebt } = await supabase.from("treasury_debts").update({
    paid_amount: 500.00,
    remaining_amount: 500.00,
    status: "partial"
  }).eq("id", debtId);
  assert(!errDebt, "Updated treasury debt with 500 LYD partial payment", errDebt?.message);

  const { data: debtUpdated } = await supabase.from("treasury_debts").select("*").eq("id", debtId).single();
  assert(Number(debtUpdated?.paid_amount) === 500, `Debt paid_amount is 500 LYD`);
  assert(Number(debtUpdated?.remaining_amount) === 500, `Debt remaining_amount is 500 LYD`);
  assert(debtUpdated?.status === "partial", `Debt status is partial`);

  // --- Operation 5: Deposit New Direct Income (1,000 LYD) ---
  console.log("\n--- 5. Receiving New Direct Income (إيداع إيراد مباشر: 1,000 د.ل) ---");
  const newIncomeId = "20202020-2020-2020-2020-111111111111";
  const { error: errInc } = await supabase.from("income").insert([{
    id: newIncomeId,
    client_id: clientId,
    type: "supervision",
    subtype: "site_inspection",
    amount: 1000.00,
    date: "2026-02-16",
    payment_method: "bank_transfer",
    status: "received",
    notes: "إيراد إشراف هندسي إضافي على الموقع"
  }]);
  assert(!errInc, "Inserted new direct income of 1,000 LYD", errInc?.message);

  // Insert bank deposit transaction for income
  await supabase.from("treasury_transactions").insert([{
    treasury_id: bankTreasuryId,
    type: "deposit",
    amount: 1000.00,
    balance_after: 8000.00,
    description: "إيراد إشراف هندسي إضافي",
    reference_id: newIncomeId,
    reference_type: "income",
    date: "2026-02-16",
    source: "income"
  }]);
  await supabase.rpc("sync_treasury_balance", { p_treasury_id: bankTreasuryId });

  const { data: t5Bank } = await supabase.from("treasuries").select("balance").eq("id", bankTreasuryId).single();
  const bankAfterInc = Number(t5Bank?.balance);
  assert(bankAfterInc === 8000, `Bank Treasury increased to 8,000 LYD (Found: ${bankAfterInc})`);
  assert(cashAfterTr + bankAfterInc === 23000, `Total System Liquidity is now exactly 23,000.00 LYD (15k + 8k)`);

  // --- Full Ledger Rolling Balance Validation ---
  console.log("\n--- 6. Validating Ledger History & Rolling Balance_After Integrity ---");
  const { data: allTx } = await supabase
    .from("treasury_transactions")
    .select("*")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  let checkCash = 0;
  let checkBank = 0;
  let ledgerClean = true;

  allTx.forEach(tx => {
    const amt = Number(tx.amount);
    if (tx.treasury_id === cashTreasuryId) {
      checkCash += tx.type === "deposit" ? amt : -amt;
    } else if (tx.treasury_id === bankTreasuryId) {
      checkBank += tx.type === "deposit" ? amt : -amt;
    }
  });

  assert(checkCash === 15000, `Cash rolling sum from ledger = 15,000 LYD (Found: ${checkCash})`);
  assert(checkBank === 8000, `Bank rolling sum from ledger = 8,000 LYD (Found: ${checkBank})`);

  console.log("\n===============================================================================");
  console.log(`   LIVE OPERATIONS SUMMARY: PASSED: ${passed} | FAILED: ${failed}`);
  console.log("===============================================================================");

  if (failed > 0) process.exit(1);
}

runLiveTransactions().catch(e => {
  console.error("Live test crashed:", e);
  process.exit(1);
});
