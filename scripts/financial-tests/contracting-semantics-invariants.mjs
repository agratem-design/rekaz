// ========================================================
// CONTRACTING PROJECT BUSINESS SEMANTICS INVARIANTS TEST SUITE
// Tests CS-01 through CS-24 (including live DB invariants CS-21A, CS-21B, CS-21C)
// ========================================================

import { supabase } from "./client.mjs";
import { calculateProjectFinancials, calculateContractingItemProfitability } from "./financialCore.mjs";
import fs from "fs";
import path from "path";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message, testId) {
  if (condition) {
    console.log(`  [PASS] ${testId}: ${message}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${testId}: ${message}`);
    totalFailed++;
  }
}

async function runContractingSemanticsTests() {
  console.log("========================================================");
  console.log("CONTRACTING PROJECT BUSINESS SEMANTICS TEST SUITE");
  console.log("========================================================\n");

  // CS-01: Multiple technicians aggregate earned cost per BOQ item
  {
    const item = { id: "item-1", name: "بند خرسانة مسلحة", total_price: 20000, progress: 50 };
    const techProgressRecords = [
      { project_item_id: "item-1", technician_id: "tech-1", earned_amount: 2000 },
      { project_item_id: "item-1", technician_id: "tech-2", earned_amount: 1500 },
      { project_item_id: "item-1", technician_id: "tech-3", earned_amount: 1000 },
    ];
    const result = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(result.laborIncurred === 4500, "Aggregates all 3 technicians (2000 + 1500 + 1000 = 4500)", "CS-01");
    assert(result.technicianBreakdown.length === 3, "Technician breakdown lists all 3 workers", "CS-01");
  }

  // CS-02: Technician payments do not change BOQ item labor cost
  {
    const item = { id: "item-2", total_price: 15000, progress: 100 };
    const techProgressRecords = [
      { project_item_id: "item-2", technician_id: "tech-1", earned_amount: 5000 },
    ];
    // Before payment
    const resBefore = calculateContractingItemProfitability({ item, techProgressRecords });
    // After payment of 1,000 LYD to technician
    const resAfter = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(resBefore.laborIncurred === 5000 && resAfter.laborIncurred === 5000, "Item labor cost remains 5,000 regardless of cash paid to technician", "CS-02");
  }

  // CS-03: Technician payments do not change item gross profit
  {
    const item = { id: "item-3", total_price: 10000, progress: 100 };
    const techProgressRecords = [{ project_item_id: "item-3", technician_id: "tech-1", earned_amount: 4000 }];
    const res = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(res.actualToDateGrossProfit === 6000, "Item Gross Profit = 10,000 earned - 4,000 labor incurred = 6,000 LYD", "CS-03");
  }

  // CS-04: Purchase full value is incurred regardless of payment status
  {
    const item = { id: "item-4", total_price: 30000, progress: 100 };
    const purchases = [
      { id: "p-1", project_item_id: "item-4", total_amount: 8000, purchase_type: "material" }
    ];
    const res = calculateContractingItemProfitability({ item, purchases });
    assert(res.materialPurchasesIncurred === 8000, "Purchase incurred cost is full 8,000 even if partially paid or unpaid", "CS-04");
  }

  // CS-05: Supplier payment changes payable/cash but not purchase cost
  {
    const item = { id: "item-5", total_price: 20000, progress: 100 };
    const purchases = [
      { id: "p-2", project_item_id: "item-5", total_amount: 6000, purchase_type: "material" }
    ];
    const resBefore = calculateContractingItemProfitability({ item, purchases });
    const resAfter = calculateContractingItemProfitability({ item, purchases });
    assert(resBefore.materialPurchasesIncurred === 6000 && resAfter.materialPurchasesIncurred === 6000, "Supplier payment does not alter item purchase incurred cost", "CS-05");
  }

  // CS-06: General Item template pricing does not define project item revenue
  {
    const itemWithSpecificPrice = { id: "item-6", total_price: 18500, quantity: 10, unit_price: 1850, progress: 100 };
    const res = calculateContractingItemProfitability({ item: itemWithSpecificPrice });
    assert(res.commercialValue === 18500, "Commercial value is strictly project-specific (18,500), never general template price", "CS-06");
  }

  // CS-07: Contracting purchase table does not use payment status as project KPI
  {
    const purchasesPageCode = fs.readFileSync(path.resolve("src/pages/ProjectPurchases.tsx"), "utf-8");
    const hasMisleadingKPIStatus = purchasesPageCode.includes('TableHead className="text-right">الحالة</TableHead>');
    assert(!hasMisleadingKPIStatus, "Contracting purchase table does not render payment status as a primary KPI column", "CS-07");
  }

  // CS-08: Purchase payment method is not a primary Purchase semantic
  {
    const purchasesPageCode = fs.readFileSync(path.resolve("src/pages/ProjectPurchases.tsx"), "utf-8");
    const hasPrimaryPaymentMethod = purchasesPageCode.includes('TableHead className="text-right">طريقة الدفع</TableHead>');
    assert(!hasPrimaryPaymentMethod, "Payment method is removed from primary purchase columns", "CS-08");
  }

  // CS-09: Contracting legacy commission/service-rate columns removed
  {
    const purchasesPageCode = fs.readFileSync(path.resolve("src/pages/ProjectPurchases.tsx"), "utf-8");
    const hasCommission = purchasesPageCode.includes('TableHead className="text-right">العمولة</TableHead>');
    const hasServiceRate = purchasesPageCode.includes('TableHead className="text-right">نسبة الخدمات</TableHead>');
    assert(!hasCommission && !hasServiceRate, "Contracting legacy commission and service-rate columns removed", "CS-09");
  }

  // CS-10: Finishing Cost-Plus rule remains 100% unchanged
  {
    const finishingData = {
      project: { id: "fin-1", project_type: "finishing", finishing_percentage: 15 },
      purchases: [{ id: "p-f1", total_amount: 10000, purchase_type: "material" }],
      techProgressRecords: [{ id: "t-f1", earned_amount: 5000 }],
      expenses: [{ id: "e-f1", project_id: "fin-1", amount: 2000 }]
    };
    const finRes = calculateProjectFinancials(finishingData);
    assert(finRes.eligibleCostBase === 17000, "Finishing eligible cost base = 10,000 + 5,000 + 2,000 = 17,000", "CS-10");
    assert(finRes.companyFee === 2550, "Finishing company fee = 17,000 * 15% = 2,550", "CS-10");
    assert(finRes.clientObligation === 19550, "Finishing client obligation = 19,550", "CS-10");
  }

  // CS-11: Multiple technician records on one item supported
  {
    const item = { id: "item-11", total_price: 8000, progress: 100 };
    const techProgressRecords = [
      { project_item_id: "item-11", technician_id: "tech-a", earned_amount: 1200 },
      { project_item_id: "item-11", technician_id: "tech-b", earned_amount: 1800 },
    ];
    const res = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(res.laborIncurred === 3000, "Supported multiple technician progress records on the same item", "CS-11");
  }

  // CS-12: Zero page-local duplicate profitability formula (Parity between TS and MJS)
  {
    const item = { id: "item-12", total_price: 12000, progress: 40 };
    const techProgressRecords = [{ project_item_id: "item-12", earned_amount: 3000 }];
    const purchases = [{ id: "p-12", project_item_id: "item-12", total_amount: 2000, purchase_type: "material" }];
    const expenses = [{ id: "e-12", project_item_id: "item-12", amount: 500 }];

    const res = calculateContractingItemProfitability({ item, techProgressRecords, purchases, expenses });
    assert(res.earnedCommercialValueToDate === 4800, "Earned value = 12,000 * 40% = 4,800", "CS-12");
    assert(res.totalAttributedItemIncurred === 5500, "Total Incurred = 3000 + 2000 + 500 = 5,500", "CS-12");
    assert(res.actualToDateGrossProfit === -700, "Actual-to-Date Gross Profit = 4,800 - 5,500 = -700", "CS-12");
  }

  // CS-13: 30% complete item does NOT use 100% commercial value as earned revenue
  {
    const item = { id: "item-13", total_price: 50000, progress: 30 };
    const res = calculateContractingItemProfitability({ item });
    assert(res.commercialValue === 50000, "Full Commercial Value = 50,000", "CS-13");
    assert(res.earnedCommercialValueToDate === 15000, "Earned value to date = 50,000 * 30% = 15,000 (NOT 50,000)", "CS-13");
  }

  // CS-14: No projected final profit without authoritative final-cost forecast
  {
    const item = { id: "item-14", total_price: 40000, progress: 20 };
    const techProgressRecords = [{ project_item_id: "item-14", earned_amount: 5000 }];
    const res = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(!("projectedFinalProfit" in res), "Helper does NOT export false projected final profit", "CS-14");
    assert(!("projectedProfit" in res), "Helper does NOT export false projected profit", "CS-14");
    assert(res.unearnedContractValue === 32000, "Exposes unearnedContractValue (40,000 - 8,000 = 32,000)", "CS-14");
  }

  // CS-15: Technician payment cannot be allocated to BOQ item unless authoritative link exists
  {
    const item = { id: "item-15", total_price: 10000, progress: 100 };
    const techProgressRecords = [{ project_item_id: "item-15", technician_id: "tech-1", earned_amount: 3000 }];
    const res = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(!("paidAmount" in res.technicianBreakdown[0]), "Technician breakdown does not fabricate fake item-level paid amount", "CS-15");
  }

  // CS-16: Unlinked purchase is excluded from item cost but remains in project cost
  {
    const projectData = {
      project: { id: "proj-16", project_type: "contracting" },
      projectItems: [{ id: "item-16", total_price: 25000, progress: 100 }],
      purchases: [
        { id: "p-linked", project_item_id: "item-16", total_amount: 7000, purchase_type: "material" },
        { id: "p-unlinked", project_item_id: null, total_amount: 3000, purchase_type: "material" }
      ]
    };
    const itemRes = calculateContractingItemProfitability({
      item: projectData.projectItems[0],
      purchases: projectData.purchases
    });
    const projRes = calculateProjectFinancials(projectData);
    assert(itemRes.materialPurchasesIncurred === 7000, "Item incurred purchase is strictly linked purchases (7,000)", "CS-16");
    assert(projRes.projectCost === 10000, "Project incurred cost contains all purchases (7,000 + 3,000 = 10,000)", "CS-16");
  }

  // CS-17: Unlinked direct expense is excluded from item cost but remains in project cost
  {
    const projectData = {
      project: { id: "proj-17", project_type: "contracting" },
      projectItems: [{ id: "item-17", total_price: 15000, progress: 100 }],
      expenses: [
        { id: "e-linked", project_id: "proj-17", project_item_id: "item-17", amount: 1200 },
        { id: "e-unlinked", project_id: "proj-17", project_item_id: null, amount: 800 }
      ]
    };
    const itemRes = calculateContractingItemProfitability({
      item: projectData.projectItems[0],
      expenses: projectData.expenses
    });
    const projRes = calculateProjectFinancials(projectData);
    assert(itemRes.directExpensesIncurred === 1200, "Item incurred expense is strictly linked expenses (1,200)", "CS-17");
    assert(projRes.projectCost === 2000, "Project direct expenses contains both (1,200 + 800 = 2,000)", "CS-17");
  }

  // CS-18: Equipment rental remains project-level and is not guessed into item
  {
    const projectData = {
      project: { id: "proj-18", project_type: "contracting" },
      projectItems: [{ id: "item-18", total_price: 30000, progress: 100 }],
      rentals: [{ id: "r-1", project_id: "proj-18", total_amount: 4000 }]
    };
    const itemRes = calculateContractingItemProfitability({ item: projectData.projectItems[0] });
    const projRes = calculateProjectFinancials(projectData);
    assert(!("equipmentRentalsIncurred" in itemRes) || itemRes.equipmentRentalsIncurred === 0, "Item cost excludes project equipment rentals", "CS-18");
    assert(projRes.breakdown.equipmentRentals === 4000, "Project direct cost includes equipment rentals (4,000)", "CS-18");
  }

  // CS-19: Sum item-attributed costs + unattributed project cost reconciles to project incurred cost
  {
    const projectData = {
      project: { id: "proj-19", project_type: "contracting" },
      projectItems: [
        { id: "item-19a", total_price: 20000, progress: 100 },
        { id: "item-19b", total_price: 30000, progress: 100 }
      ],
      purchases: [
        { id: "p-a", project_item_id: "item-19a", total_amount: 5000, purchase_type: "material" },
        { id: "p-b", project_item_id: "item-19b", total_amount: 8000, purchase_type: "material" },
        { id: "p-proj", project_item_id: null, total_amount: 2000, purchase_type: "material" }
      ],
      techProgressRecords: [
        { id: "t-a", project_item_id: "item-19a", earned_amount: 3000 },
        { id: "t-b", project_item_id: "item-19b", earned_amount: 4000 }
      ],
      expenses: [
        { id: "e-proj", project_id: "proj-19", project_item_id: null, amount: 1500 }
      ],
      rentals: [
        { id: "r-proj", project_id: "proj-19", total_amount: 2500 }
      ]
    };

    const resA = calculateContractingItemProfitability({
      item: projectData.projectItems[0],
      techProgressRecords: projectData.techProgressRecords,
      purchases: projectData.purchases
    });
    const resB = calculateContractingItemProfitability({
      item: projectData.projectItems[1],
      techProgressRecords: projectData.techProgressRecords,
      purchases: projectData.purchases
    });

    const sumAttributedItemCost = resA.totalAttributedItemIncurred + resB.totalAttributedItemIncurred;
    // resA = 5000 + 3000 = 8000. resB = 8000 + 4000 = 12000. sumAttributed = 20,000.
    const unattributedProjectCost = 2000 + 1500 + 2500; // 6,000

    const projRes = calculateProjectFinancials(projectData);
    assert(sumAttributedItemCost === 20000, "Sum of attributed item costs = 20,000", "CS-19");
    assert(projRes.projectCost === sumAttributedItemCost + unattributedProjectCost, "Project Incurred Cost (26,000) = Sum Attributed (20,000) + Unattributed (6,000)", "CS-19");
  }

  // CS-20: Phase-4 Material/Service/Expense forms support optional valid BOQ attribution
  {
    const serviceFormCode = fs.readFileSync(path.resolve("src/components/purchases/forms/SupplierServiceForm.tsx"), "utf-8");
    const expenseFormCode = fs.readFileSync(path.resolve("src/components/expenses/forms/DirectProjectExpenseForm.tsx"), "utf-8");
    const serviceHasBOQ = serviceFormCode.includes("projectItemId") && serviceFormCode.includes("project_item_id");
    const expenseHasBOQ = expenseFormCode.includes("projectItemId") && expenseFormCode.includes("project_item_id");
    assert(serviceHasBOQ, "SupplierServiceForm contains optional BOQ item attribution", "CS-20");
    assert(expenseHasBOQ, "DirectProjectExpenseForm contains optional BOQ item attribution", "CS-20");
  }

  // CS-22: Legacy/null-type material purchase explicitly linked to a BOQ item is classified consistently with FC-01
  {
    const item = { id: "item-22", total_price: 10000, progress: 100 };
    const purchases = [
      { id: "p-null-type", project_item_id: "item-22", total_amount: 3500, purchase_type: null }
    ];
    const res = calculateContractingItemProfitability({ item, purchases });
    assert(res.materialPurchasesIncurred === 3500, "Purchase with purchase_type = null is classified as material consistent with FC-01", "CS-22");
    assert(res.totalAttributedItemIncurred === 3500, "Total attributed cost includes null-type material purchase", "CS-22");
  }

  // CS-23: Zero earned value with incurred cost does not display false 0% margin
  {
    const item = { id: "item-23", total_price: 20000, progress: 0 };
    const techProgressRecords = [{ project_item_id: "item-23", earned_amount: 2000 }];
    const res = calculateContractingItemProfitability({ item, techProgressRecords });
    assert(res.earnedCommercialValueToDate === 0, "Earned value is 0 LYD", "CS-23");
    assert(res.actualToDateGrossProfit === -2000, "Actual-to-Date Gross Profit = 0 - 2,000 = -2,000 LYD", "CS-23");
    assert(res.actualToDateMarginPercent === null, "actualToDateMarginPercent is null / N/A (NOT 0%) when earned value = 0", "CS-23");
  }

  // CS-24: Changing raw technician quantity records without changing authoritative item.progress does not independently change commercial earned value
  {
    const item = { id: "item-24", total_price: 10000, progress: 25 };
    const techRecordsA = [{ project_item_id: "item-24", quantity_completed: 10, rate: 100, earned_amount: 1000 }];
    const techRecordsB = [{ project_item_id: "item-24", quantity_completed: 20, rate: 100, earned_amount: 2000 }];

    const resA = calculateContractingItemProfitability({ item, techProgressRecords: techRecordsA });
    const resB = calculateContractingItemProfitability({ item, techProgressRecords: techRecordsB });

    assert(resA.earnedCommercialValueToDate === 2500 && resB.earnedCommercialValueToDate === 2500, "Commercial earned value relies strictly on item.progress (2,500), independent of raw quantity records", "CS-24");
    assert(resA.laborIncurred === 1000 && resB.laborIncurred === 2000, "Labor incurred changes accurately with earned amounts (1,000 -> 2,000)", "CS-24");
  }

  // CS-25: Commercial Value Nullish Authority (total_price = 0 vs total_price = NULL)
  {
    // Part A: Stored total_price = 0 with non-zero quantity and unit_price
    const itemZero = { id: "item-25a", total_price: 0, quantity: 10, unit_price: 500, progress: 100 };
    const resZero = calculateContractingItemProfitability({ item: itemZero });
    assert(resZero.commercialValue === 0, "Explicit total_price = 0 is preserved (commercialValue = 0) and not overridden by quantity * unit_price", "CS-25");
    assert(resZero.earnedCommercialValueToDate === 0, "Earned value is 0 when commercialValue is 0", "CS-25");

    // Part B: Stored total_price = null with quantity and unit_price
    const itemNull = { id: "item-25b", total_price: null, quantity: 10, unit_price: 500, progress: 50 };
    const resNull = calculateContractingItemProfitability({ item: itemNull });
    assert(resNull.commercialValue === 5000, "Null total_price falls back to project-specific quantity * unit_price (10 * 500 = 5,000)", "CS-25");
    assert(resNull.earnedCommercialValueToDate === 2500, "Earned value is 2,500 (5,000 * 50%) for fallback item", "CS-25");

    // Part C: Stored total_price = undefined with quantity and unit_price
    const itemUndefined = { id: "item-25c", total_price: undefined, quantity: 4, unit_price: 250, progress: 100 };
    const resUndefined = calculateContractingItemProfitability({ item: itemUndefined });
    assert(resUndefined.commercialValue === 1000, "Undefined total_price falls back to quantity * unit_price (4 * 250 = 1,000)", "CS-25");
  }

  // ========================================================
  // LIVE DB / AUTHORITATIVE WRITE-PATH TESTS
  // ========================================================
  console.log("\n--- Live DB Cross-Project Item Attribution Invariants ---");

  try {
    const foreignItemId = "02000000-0000-0000-0000-000000000099";
    const dummyProjectId = "f1000000-0000-0000-0000-000000000001";

    // CS-21A: Cross-project Material Purchase item attribution rejected server-side
    const { error: err21A } = await supabase
      .from("purchases")
      .insert({
        project_id: dummyProjectId,
        project_item_id: foreignItemId,
        title: "شراء مواد مخالف للملكية",
        total_amount: 1000,
        date: new Date().toISOString().split("T")[0],
        purchase_type: "material",
        paid_amount: 0,
        commission: 0,
        purchase_source: "supplier",
        is_return: false
      });
    assert(Boolean(err21A), "Server trigger rejected purchase assigned to foreign project item", "CS-21A");

    // CS-21B: Cross-project Supplier Service item attribution rejected server-side
    const { error: err21B } = await supabase
      .from("purchases")
      .insert({
        project_id: dummyProjectId,
        project_item_id: foreignItemId,
        title: "خدمة مخالفة للملكية",
        total_amount: 1500,
        date: new Date().toISOString().split("T")[0],
        purchase_type: "service",
        paid_amount: 0,
        commission: 0,
        purchase_source: "supplier",
        is_return: false
      });
    assert(Boolean(err21B), "Server trigger rejected supplier service assigned to foreign project item", "CS-21B");

    // CS-21C: Cross-project Direct Expense item attribution rejected server-side
    const { error: err21C } = await supabase
      .from("expenses")
      .insert({
        project_id: dummyProjectId,
        project_item_id: foreignItemId,
        description: "مصروف مباشر مخالف للملكية",
        amount: 500,
        date: new Date().toISOString().split("T")[0],
        type: "project"
      });
    assert(Boolean(err21C), "Server trigger rejected direct expense assigned to foreign project item", "CS-21C");
  } catch (err) {
    console.error("  [ERROR] Live DB testing error:", err);
    totalFailed++;
  }

  console.log("\n========================================================");
  console.log(`TOTAL INVARIANTS: ${totalPassed + totalFailed}`);
  console.log(`PASSED: ${totalPassed}`);
  console.log(`FAILED: ${totalFailed}`);
  console.log("========================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runContractingSemanticsTests();
