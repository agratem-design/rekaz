// scripts/verify-accounting-and-integrity.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bpnhzaexmqruzaxyzlyc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbmh6YWV4bXFydXpheHl6bHljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUwOTQsImV4cCI6MjA4NjMyMTA5NH0.YnLb_sCMT0Pz4LgK1uCLQtr5kUTaIBQtvyMmG3OHDMA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("   REKAZ TREASURIES, TRANSACTIONS & SETTLEMENTS VERIFICATION TEST SUITE");
  console.log("===============================================================================\n");

  // TEST SUITE 1: Entity Traceability & Operational Links
  console.log("--- 1. Testing Entity Traceability & Master Data Integrity ---");
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, name, budget, spent, status,
      clients (id, name),
      engineers (id, name),
      treasuries (id, name)
    `)
    .single();

  assert(project !== null, "Project exists and fetched");
  assert(project?.clients?.name === "شركة الأفق للاستثمار العقاري", `Project belongs to client: ${project?.clients?.name}`);
  assert(project?.engineers?.name === "م. طارق المهدي", `Project supervised by engineer: ${project?.engineers?.name}`);
  assert(project?.treasuries?.name === "الخزينة الرئيسية (نقدية)", `Project linked to default treasury: ${project?.treasuries?.name}`);

  const { data: contract } = await supabase
    .from("contracts")
    .select(`id, contract_number, amount, status, clients(name), projects(name)`)
    .single();
  assert(Number(contract?.amount) === 30000, `Contract total amount is 30,000 LYD`);

  // TEST SUITE 2: Treasury Balances & Transaction Ledger Accuracy
  console.log("\n--- 2. Testing Treasury Balances & Transaction Reconciliation ---");
  const { data: treasuries } = await supabase.from("treasuries").select("*").order("name");
  const cashTreasury = treasuries?.find((t) => t.treasury_type === "cash");
  const bankTreasury = treasuries?.find((t) => t.treasury_type === "bank");

  const cashBalance = Number(cashTreasury?.balance);
  const bankBalance = Number(bankTreasury?.balance);
  const totalLiquidity = cashBalance + bankBalance;

  assert(cashBalance === 15000, `Cash Treasury balance is exactly 15,000.00 LYD (Found: ${cashBalance})`);
  assert(bankBalance === 8000, `Bank Treasury balance is exactly 8,000.00 LYD (Found: ${bankBalance})`);
  assert(totalLiquidity === 23000, `Total company liquidity is exactly 23,000.00 LYD (Found: ${totalLiquidity})`);

  const { data: transactions } = await supabase
    .from("treasury_transactions")
    .select("*")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  assert(transactions?.length === 11, `Treasury transactions ledger contains exactly 11 valid movements`);

  // Verify chronological balance_after
  let simulatedCash = 0;
  let simulatedBank = 0;
  let rollingLedgerValid = true;

  transactions?.forEach((tx) => {
    const amt = Number(tx.amount);
    if (tx.treasury_id === cashTreasury.id) {
      simulatedCash += tx.type === "deposit" ? amt : -amt;
      if (Math.abs(simulatedCash - Number(tx.balance_after)) > 0.01) {
        rollingLedgerValid = false;
        console.error(`Ledger discrepancy at tx ${tx.description}: expected ${simulatedCash}, found ${tx.balance_after}`);
      }
    } else if (tx.treasury_id === bankTreasury.id) {
      simulatedBank += tx.type === "deposit" ? amt : -amt;
      if (Math.abs(simulatedBank - Number(tx.balance_after)) > 0.01) {
        rollingLedgerValid = false;
        console.error(`Ledger discrepancy at tx ${tx.description}: expected ${simulatedBank}, found ${tx.balance_after}`);
      }
    }
  });

  assert(rollingLedgerValid, "All treasury transaction 'balance_after' values are 100% chronologically accurate");

  // TEST SUITE 3: Client Accounts & Receivables Reconciliation
  console.log("\n--- 3. Testing Client Statement & Receivables ---");
  const { data: clientPayments } = await supabase.from("client_payments").select("amount");
  const clientPaid = clientPayments?.reduce((s, p) => s + Number(p.amount), 0) || 0;
  const clientContractAmount = Number(contract?.amount || 0);
  const clientRemainingDue = clientContractAmount - clientPaid;

  assert(clientPaid === 25000, `Client total paid amount is 25,000.00 LYD (20k deposit + 5k installment)`);
  assert(clientRemainingDue === 5000, `Client remaining due is 5,000.00 LYD (30,000 - 25,000)`);

  // TEST SUITE 4: Supplier Accounts & Payables Reconciliation
  console.log("\n--- 4. Testing Supplier Statement & Payables ---");
  const { data: purchase } = await supabase.from("purchases").select("total_amount, paid_amount, status").single();
  const purchaseTotal = Number(purchase?.total_amount || 0);
  const purchasePaid = Number(purchase?.paid_amount || 0);
  const purchaseRemaining = purchaseTotal - purchasePaid;

  assert(purchaseTotal === 4000, `Supplier invoice total is 4,000.00 LYD`);
  assert(purchasePaid === 4000, `Supplier paid amount is 4,000.00 LYD (2.5k + 1.5k full settlement)`);
  assert(purchaseRemaining === 0, `Supplier remaining payables is 0.00 LYD (Fully paid)`);
  assert(purchase?.status === "paid", `Purchase status is 'paid'`);

  // TEST SUITE 5: Treasury Debt & Loan Settlement
  console.log("\n--- 5. Testing Treasury Debt & Loan Settlement ---");
  const { data: debt } = await supabase.from("treasury_debts").select("*").single();
  assert(Number(debt?.amount) === 1000, `Original debt amount is 1,000.00 LYD`);
  assert(Number(debt?.paid_amount) === 500, `Debt paid amount is 500.00 LYD`);
  assert(Number(debt?.remaining_amount) === 500, `Debt remaining amount is 500.00 LYD`);
  assert(debt?.status === "partial", `Debt status is 'partial'`);

  // TEST SUITE 6: Dashboard & Financial KPI Metrics
  console.log("\n--- 6. Testing Dashboard & Financial Summary Metrics ---");
  const { data: incomeList } = await supabase.from("income").select("amount");
  const { data: expenseList } = await supabase.from("expenses").select("amount");
  const { data: purchaseList } = await supabase.from("purchases").select("total_amount, paid_amount");

  const totalIncome = incomeList?.reduce((s, r) => s + Number(r.amount), 0) || 0;
  const totalExpenses = expenseList?.reduce((s, r) => s + Number(r.amount), 0) || 0;
  const totalPurchases = purchaseList?.reduce((s, r) => s + Number(r.total_amount), 0) || 0;
  const totalPurchasesPaid = purchaseList?.reduce((s, r) => s + Number(r.paid_amount), 0) || 0;

  const dashboardNetProfit = totalIncome - totalExpenses - totalPurchasesPaid;

  assert(totalIncome === 2500, `Total Direct Company Income is 2,500.00 LYD (1,500 + 1,000)`);
  assert(totalExpenses === 500, `Total Company Expenses is 500.00 LYD`);
  assert(totalPurchases === 4000, `Total Invoiced Purchases is 4,000.00 LYD`);
  assert(totalPurchasesPaid === 4000, `Total Cash Purchases Paid is 4,000.00 LYD`);
  assert(dashboardNetProfit === -2000, `Dashboard Net Profit (2,500 income - 500 expenses - 4,000 purchases paid) = -2,000.00 LYD`);

  console.log("\n===============================================================================");
  console.log(`   TEST RESULTS SUMMARY: TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log("===============================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
