import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateProjectFinancials, ProjectFinancialResult } from "@/lib/financialCore";

export const PROJECT_FINANCIAL_SUMMARY_KEY = "project-financial-summary-authoritative-v4";

export function invalidateProjectFinancialSummary(queryClient: QueryClient, projectId?: string) {
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: [PROJECT_FINANCIAL_SUMMARY_KEY, projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-financial-summary", projectId] });
  } else {
    queryClient.invalidateQueries({ queryKey: [PROJECT_FINANCIAL_SUMMARY_KEY] });
    queryClient.invalidateQueries({ queryKey: ["project-financial-summary"] });
  }
}

export interface ProjectFinancialSummaryData {
  // 1. Client Section (Authoritative: contracts / client_payments / finishing cost-plus)
  contractValue: number;
  clientCollected: number;
  clientRemaining: number;
  clientObligation: number;
  companyFee: number;
  eligibleCostBase: number;
  finishingPercentage: number;
  projectType: string;

  // 2. Supplier Section (Authoritative: purchases (material & services) / purchase_payments)
  supplierPurchases: number;
  supplierPaid: number;
  supplierRemaining: number;

  // 3. Technician Section (Authoritative: technician_progress_records / purchase_payments (labor))
  technicianObligations: number;
  technicianPaid: number;
  technicianRemaining: number;

  // 4. Project Expenses Section (Authoritative: expenses WHERE project_id = ...)
  projectExpenses: number;

  // 5. Equipment Rentals & Custody
  equipmentRentals: number;
  custodyTotal: number;

  // 6. Profitability (Accrual basis: Revenue - Recognized Direct Costs)
  projectRevenue: number;
  projectCost: number;
  grossProfit: number;
  profitMarginPercent: number;

  // 7. Cash Flow (Cash basis: Actual Project Cash IN - Actual Project Cash OUT)
  cashCollected: number;
  cashPaid: number;
  netCashFlow: number;

  // 8. Settlement Clarity (Cash vs Credit breakdown)
  cashReceived: number;
  creditApplied: number;

  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProjectFinancialSummary(projectId?: string): ProjectFinancialSummaryData {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["project-financial-summary-authoritative-v4", projectId],
    queryFn: async (): Promise<ProjectFinancialResult & { custodyTotal: number } | null> => {
      if (!projectId) return null;

      const results = await Promise.all([
        supabase.from("projects").select("id, client_id, project_type, finishing_percentage, budget, spent").eq("id", projectId).maybeSingle(),
        supabase.from("contracts").select("amount, status, project_id").eq("project_id", projectId),
        supabase.from("project_items").select("total_price, progress").eq("project_id", projectId),
        supabase.from("client_payments").select("id, amount, project_id").is("reversed_at", null).eq("project_id", projectId),
        supabase.from("purchases").select("id, total_amount, paid_amount, purchase_type, supplier_id, technician_id, rental_id, phase_id").eq("project_id", projectId),
        supabase.from("purchase_payments").select("id, purchase_id, amount, purchases!inner(id, project_id, purchase_type, supplier_id)").eq("purchases.project_id", projectId),
        supabase.from("project_item_technicians").select("id, project_item_id, rate, quantity, total_cost, technician_id, project_items!inner(project_id)").eq("project_items.project_id", projectId),
        supabase.from("expenses").select("id, amount, project_id, type, technician_id").eq("project_id", projectId),
        supabase.from("equipment_rentals").select("id, total_amount").eq("project_id", projectId),
        supabase.from("project_custody").select("amount").eq("project_id", projectId),
        supabase.from("supplier_payment_allocations").select("purchase_id, amount, purchases!inner(project_id)").eq("purchases.project_id", projectId),
      ]);
      for (const result of results) {
        if (result.error) throw result.error;
      }
      const [{ data: project }, { data: contracts }, { data: projectItems }, { data: clientPayments },
        { data: purchases }, { data: purchasePayments }, { data: projectItemTechnicians },
        { data: expenses }, { data: rentals }, { data: custody }, { data: supplierAllocations }] = results;
      if (!project) throw new Error("تعذر العثور على المشروع");
      const { data: creditLedger, error: creditError } = project.client_id
        ? await supabase.from("client_credit_ledger").select("entry_type, amount, target_project_id, source_payment_id").eq("client_id", project.client_id)
        : { data: [], error: null };
      if (creditError) throw creditError;

      const result = calculateProjectFinancials({
        project: {
          id: project.id,
          project_type: project.project_type,
          finishing_percentage: project.finishing_percentage,
          budget: project.budget,
        },
        contracts: contracts || [],
        projectItems: projectItems || [],
        clientPayments: clientPayments || [],
        purchases: purchases || [],
        purchasePayments: purchasePayments || [],
        supplierPaymentAllocations: supplierAllocations || [],
        creditLedger: creditLedger || [],
        projectItemTechnicians: (projectItemTechnicians as any) || [],
        rentals: rentals || [],
        expenses: expenses || [],
      });

      const custodyTotal = custody?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0;

      return {
        ...result,
        custodyTotal,
      };
    },
    enabled: !!projectId,
  });

  return {
    contractValue: data?.contractValue || 0,
    clientCollected: data?.clientPaid || 0,
    clientRemaining: data?.clientRemaining || 0,
    clientObligation: data?.clientObligation || 0,
    companyFee: data?.companyFee || 0,
    eligibleCostBase: data?.eligibleCostBase || 0,
    finishingPercentage: data?.finishingPercentage || 0,
    projectType: data?.projectType || "contracting",
    supplierPurchases: (data?.breakdown.materials || 0) + (data?.breakdown.supplierServices || 0),
    supplierPaid: data?.cashFlow.supplierPaid || 0,
    supplierRemaining: data?.cashFlow.supplierRemaining || 0,
    technicianObligations: data?.breakdown.technicianEarned || 0,
    technicianPaid: data?.cashFlow.technicianPaid || 0,
    technicianRemaining: data?.cashFlow.technicianRemaining || 0,
    projectExpenses: data?.breakdown.directProjectExpenses || 0,
    equipmentRentals: data?.breakdown.equipmentRentals || 0,
    custodyTotal: data?.custodyTotal || 0,
    projectRevenue: data?.projectRevenue || 0,
    projectCost: data?.projectCost || 0,
    grossProfit: data?.grossProfit || 0,
    profitMarginPercent: data?.profitMarginPercent || 0,
    cashCollected: data?.cashFlow.actualCashIn || 0,
    cashPaid: data?.cashFlow.actualCashOut || 0,
    netCashFlow: data?.cashFlow.netCashFlow || 0,
    cashReceived: data?.cashReceived || 0,
    creditApplied: data?.creditApplied || 0,
    isLoading,
    error,
    refetch,
  };
}
