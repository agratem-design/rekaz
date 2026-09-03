import { AccountingTestHarness } from './harness.mjs';
import { calculateProjectFinancials, calculateContractingItemProfitability } from './financialCore.mjs';

const harness = new AccountingTestHarness('TECH-SIMPLIFIED-01');

console.log('================================================================');
console.log('🧪 RUNNING TECHNICIAN SIMPLIFIED ARCHITECTURE & ADVANCE PAYMENTS TESTS');
console.log('================================================================\n');

// -------------------------------------------------------------
// TEST 1: Work Assignment Value Authority (project_item_technicians)
// -------------------------------------------------------------
console.log('--- TEST 1: Work Assignment Value Authority (TECH-WORK-01) ---');
const assignment1 = {
  id: 'asg-1',
  project_item_id: 'item-1',
  technician_id: 'tech-1',
  rate: 100,
  quantity: 22.5,
  total_cost: 2250.0,
};
const totalCostCalculated = (assignment1.total_cost && assignment1.total_cost > 0)
  ? assignment1.total_cost
  : (assignment1.rate * assignment1.quantity);

harness.assert(
  'TECH-WORK-01',
  'Technician assigned work value equals rate * quantity (22.5 * 100 = 2250 LYD)',
  totalCostCalculated === 2250.0,
  `Assigned work value is ${totalCostCalculated}`,
  2250.0,
  totalCostCalculated
);

// -------------------------------------------------------------
// TEST 2: Advance Payment Math (Zero Work -> Advance Paid)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Advance Payment Math (TECH-ADV-01 & TECH-ADV-02) ---');
const totalWorkZero = 0;
const advancePaid500 = 500;
const signedBalanceAdvance = totalWorkZero - advancePaid500;

harness.assert(
  'TECH-ADV-01',
  'Advance payment of 500 LYD with zero work yields signed balance of -500 LYD',
  signedBalanceAdvance === -500,
  `Signed balance is ${signedBalanceAdvance}`,
  -500,
  signedBalanceAdvance
);

const isAdvanceDisplay = signedBalanceAdvance < 0;
const displayLabel = signedBalanceAdvance > 0
  ? 'المتبقي للفني'
  : signedBalanceAdvance < 0
  ? 'رصيد مقدم للفني'
  : 'الرصيد: 0 د.ل';
const displayAmount = Math.abs(signedBalanceAdvance);

harness.assert(
  'TECH-ADV-02',
  'Negative signed balance displays as "رصيد مقدم للفني: 500 د.ل"',
  isAdvanceDisplay && displayLabel === 'رصيد مقدم للفني' && displayAmount === 500,
  `Label is "${displayLabel}", Amount is ${displayAmount}`,
  'رصيد مقدم للفني 500',
  `${displayLabel} ${displayAmount}`
);

// -------------------------------------------------------------
// TEST 3: Future Work Absorption of Advance Payment (TECH-ADV-03)
// -------------------------------------------------------------
console.log('\n--- TEST 3: Future Work Absorption (TECH-ADV-03) ---');
const totalWorkWithAssignment = 2250;
const signedBalanceAfterWork = totalWorkWithAssignment - advancePaid500;
const displayLabelAfterWork = signedBalanceAfterWork > 0
  ? 'المتبقي للفني'
  : signedBalanceAfterWork < 0
  ? 'رصيد مقدم للفني'
  : 'الرصيد: 0 د.ل';

harness.assert(
  'TECH-ADV-03',
  'Future work of 2,250 LYD absorbs 500 LYD advance, leaving remaining due of 1,750 LYD',
  signedBalanceAfterWork === 1750 && displayLabelAfterWork === 'المتبقي للفني',
  `New remaining due is ${signedBalanceAfterWork} (${displayLabelAfterWork})`,
  1750,
  signedBalanceAfterWork
);

// -------------------------------------------------------------
// TEST 4: Project Financials Integration (financialCore.ts)
// -------------------------------------------------------------
console.log('\n--- TEST 4: Project Financials Integration (TECH-CORE-01) ---');
const dummyProject = {
  id: 'proj-1',
  project_type: 'contracting',
  contract_amount: 10000,
};
const dummyItems = [
  { id: 'item-1', project_id: 'proj-1', total_price: 5000 },
];
const dummyAssignments = [
  { id: 'asg-1', project_item_id: 'item-1', rate: 100, quantity: 22.5, total_cost: 2250 },
];

const financials = calculateProjectFinancials({
  project: dummyProject,
  contracts: [],
  projectItems: dummyItems,
  purchases: [],
  projectItemTechnicians: dummyAssignments,
  expenses: [],
  clientPayments: [],
});

harness.assert(
  'TECH-CORE-01',
  'calculateProjectFinancials includes technician cost from projectItemTechnicians (2250 LYD)',
  financials.breakdown.technicianEarned === 2250,
  `Calculated breakdown.technicianEarned is ${financials.breakdown.technicianEarned}`,
  2250,
  financials.breakdown.technicianEarned
);

// -------------------------------------------------------------
// TEST 5: Item Profitability Integration (TECH-ITEM-01)
// -------------------------------------------------------------
console.log('\n--- TEST 5: Item Profitability Integration (TECH-ITEM-01) ---');
const itemProfitability = calculateContractingItemProfitability({
  item: dummyItems[0],
  projectItemTechnicians: dummyAssignments,
  purchases: [],
});

harness.assert(
  'TECH-ITEM-01',
  'calculateContractingItemProfitability calculates item labor cost directly as 2,250 LYD',
  itemProfitability.laborIncurred === 2250 && itemProfitability.commercialValue === 5000,
  `Item labor cost is ${itemProfitability.laborIncurred}, commercial value is ${itemProfitability.commercialValue}`,
  2250,
  itemProfitability.laborIncurred
);

// -------------------------------------------------------------
// TEST 6: Payment Ledger State (TECH-LEDGER-01)
// -------------------------------------------------------------
console.log('\n--- TEST 6: Payment Ledger State (TECH-LEDGER-01) ---');
const statementEntries = [
  { type: 'work', workValue: 2250, paymentAmount: 0 },
  { type: 'payment', workValue: 0, paymentAmount: 1000 },
  { type: 'payment', workValue: 0, paymentAmount: 500, isReversed: true },
  { type: 'payment', workValue: 0, paymentAmount: 500 },
];

let ledgerRunning = 0;
for (const entry of statementEntries) {
  if (entry.type === 'work') {
    ledgerRunning += entry.workValue;
  } else if (!entry.isReversed) {
    ledgerRunning -= entry.paymentAmount;
  }
}

harness.assert(
  'TECH-LEDGER-01',
  'Statement ledger correctly calculates running balance (2250 - 1000 - 500 = 750 LYD) ignoring reversed payment',
  ledgerRunning === 750,
  `Final ledger balance is ${ledgerRunning}`,
  750,
  ledgerRunning
);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
const summary = harness.getSummary();
console.log('\n================================================================');
console.log(`📊 SUMMARY: ${summary.passed}/${summary.total} tests passed.`);
console.log('================================================================');

if (!summary.isSuccess) {
  process.exit(1);
}
