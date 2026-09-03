import { useState, useMemo, useEffect } from "react";
import { useOperationKey } from "@/hooks/useOperationKey";
import { TechnicianDepositsPanel } from "@/components/technicians/TechnicianDepositsPanel";
import { invalidateFinancialQueries } from "@/lib/financialMutations";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeterministicBreadcrumb } from "@/components/navigation/DeterministicBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyLYD } from "@/lib/currency";
import { openReceiptPrintWindow, openPrintWindow } from "@/lib/printStyles";
import {
  Wrench,
  DollarSign,
  Wallet,
  Building2,
  Phone,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  AlertCircle,
  Sparkles,
  Layers,
  Box,
  Pencil,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const rateTypeLabels: Record<string, string> = {
  unit: "لكل وحدة",
  meter: "لكل متر",
  m2: "لكل م²",
  m3: "لكل م³",
  piece: "لكل قطعة",
  lump_sum: "مقطوعية",
  daily: "يومي",
  fixed: "مبلغ مقطوع",
  hour: "بالساعة",
};

interface TechnicianItemAssignment {
  id: string;
  projectItemId: string;
  projectItemName: string;
  phaseId: string | null;
  phaseName: string;
  rate: number | null;
  rateType: string | null;
  quantity: number | null;
  totalCost: number | null;
  workValue: number;
  notes: string | null;
  createdAt: string;
}

interface TechnicianProjectGroup {
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientId: string;
  clientName: string;
  totalWorkValue: number;
  assignments: TechnicianItemAssignment[];
}

interface TechnicianClientGroup {
  clientId: string;
  clientName: string;
  projects: TechnicianProjectGroup[];
}

export default function TechnicianDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const paymentOperation = useOperationKey();

  const [activeTab, setActiveTab] = useState<"projects" | "statement">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  // On-Account Payment State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payTreasuryId, setPayTreasuryId] = useState("");
  const [payPaymentMethod, setPayPaymentMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payContextProjectId, setPayContextProjectId] = useState<string | null>(null);

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editTreasuryId, setEditTreasuryId] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("cash");
  const [editDate, setEditDate] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Reverse Payment State
  const [reversingPayment, setReversingPayment] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  // 1. Fetch active treasuries
  const { data: treasuriesList = [], isLoading: loadingTreasuries } = useQuery<any[]>({
    queryKey: ["parent-treasuries-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, project_category, parent_id, balance, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const [paySelectedParentTreasuryId, setPaySelectedParentTreasuryId] = useState("");

  const parentTreasuries = useMemo(() => {
    return treasuriesList.filter((t: any) => !t.parent_id);
  }, [treasuriesList]);

  const eligibleBranches = useMemo(() => {
    if (!paySelectedParentTreasuryId) return [];
    const children = treasuriesList.filter((t: any) => t.parent_id === paySelectedParentTreasuryId);
    if (children.length > 0) return children;
    const parent = treasuriesList.find((t: any) => t.id === paySelectedParentTreasuryId);
    return parent ? [parent] : [];
  }, [treasuriesList, paySelectedParentTreasuryId]);

  // Keep the payment form actionable by selecting the first active treasury as soon as it is available
  useEffect(() => {
    if (!paySelectedParentTreasuryId && parentTreasuries.length > 0) {
      setPaySelectedParentTreasuryId(parentTreasuries[0].id);
    }
  }, [paySelectedParentTreasuryId, parentTreasuries]);

  useEffect(() => {
    if (eligibleBranches.length > 0) {
      if (!payTreasuryId || !eligibleBranches.some((b: any) => b.id === payTreasuryId)) {
        setPayTreasuryId(eligibleBranches[0].id);
      }
    }
  }, [eligibleBranches, payTreasuryId]);

  // 2. Fetch technician base profile
  const { data: technician, isLoading: loadingTechnician, error: technicianError } = useQuery({
    queryKey: ["technician", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*, technician_types(id, name, code)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // 3. Fetch canonical staffing assignments (Technician Work Authority)
  const { 
    data: assignments = [], 
    isLoading: loadingAssignments, 
    error: assignmentsError,
    refetch: refetchAssignments 
  } = useQuery({
    queryKey: ["technician-assignments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_item_technicians")
        .select(`
          id,
          project_item_id,
          technician_id,
          rate,
          rate_type,
          quantity,
          total_cost,
          notes,
          created_at,
          project_items (
            id,
            name,
            phase_id,
            project_id,
            project_phases (id, name),
            projects (id, name, project_type, client_id, clients (id, name))
          )
        `)
        .eq("technician_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: laborPurchases = [], error: laborWorkError, isLoading: loadingLaborWork } = useQuery({
    queryKey: ["technician-labor-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases")
        .select("id, title, items, total_amount, paid_amount, date, created_at, phase_id, notes, projects(id, name, project_type, clients(id, name))")
        .eq("technician_id", id!);
      if (error) throw error;
      return data || [];
    }, enabled: !!id,
  });

  // 4. Fetch on-account technician payment headers
  const { data: laborInvoicePayments = [], error: laborInvoicePaymentsError, isLoading: loadingLaborInvoicePayments } = useQuery({
    queryKey: ["technician-labor-invoice-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_payments")
        .select("id, amount, date, created_at, purchases!inner(technician_id, title, projects(name))")
        .eq("purchases.technician_id", id!);
      if (error) throw error;
      return data || [];
    }, enabled: !!id,
  });

  const { data: technicianPayments = [], isLoading: loadingTechPayments, error: techPaymentsError } = useQuery({
    queryKey: ["technician-direct-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_payments")
        .select(`
          id, amount, date, created_at, payment_method, reference, notes, 
          status, reversed_at, reversal_reason, context_project_id, treasury_id,
          treasuries (id, name, treasury_type)
        `)
        .eq("technician_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // 5. Fetch legacy technician labor payments
  const { 
    data: laborPayments = [], 
    isLoading: loadingPayments, 
    error: paymentsError,
    refetch: refetchPayments 
  } = useQuery({
    queryKey: ["technician-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          id, amount, date, created_at, description,
          projects (id, name, project_type, clients (id, name))
        `)
        .eq("technician_id", id!)
        .eq("type", "labor")
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // 6. Company settings for receipt printing
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 7. Canonical Global Financial Account & Operational Project Views
  const {
    clientGroups,
    globalWorkValue,
    globalPaid,
    signedBalance,
    distinctProjectsCount,
    totalAssignmentsCount,
  } = useMemo(() => {
    let gWorkValue = 0;
    const projectMap = new Map<string, TechnicianProjectGroup>();

    const getOrCreateGroup = (
      projId: string,
      projName: string,
      projType: "contracting" | "finishing",
      cliId: string,
      cliName: string
    ): TechnicianProjectGroup => {
      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          projectId: projId,
          projectName: projName,
          projectType: projType,
          clientId: cliId,
          clientName: cliName,
          totalWorkValue: 0,
          assignments: [],
        });
      }
      return projectMap.get(projId)!;
    };

    assignments.forEach((a: any) => {
      const pItem = a.project_items;
      const proj = pItem?.projects;
      const grp = getOrCreateGroup(
        proj?.id || "unassigned",
        proj?.name || "مشروع مقاولات",
        (proj?.project_type || "contracting") as "contracting" | "finishing",
        proj?.clients?.id || "unassigned",
        proj?.clients?.name || "بدون زبون"
      );
      const rawCost = Number(a.total_cost);
      const wVal = rawCost > 0 ? rawCost : (Number(a.rate || 0) * Number(a.quantity || 1));
      gWorkValue += wVal;
      grp.totalWorkValue += wVal;

      grp.assignments.push({
        id: a.id,
        projectItemId: a.project_item_id,
        projectItemName: pItem?.name || "بند",
        phaseId: pItem?.phase_id || null,
        phaseName: pItem?.project_phases?.name || "المرحلة",
        rate: a.rate,
        rateType: a.rate_type,
        quantity: a.quantity,
        totalCost: a.total_cost,
        workValue: wVal,
        notes: a.notes,
        createdAt: a.created_at,
      });
    });

    laborPurchases.forEach((work) => {
      const proj = work.projects;
      const group = getOrCreateGroup(proj?.id || "unassigned", proj?.name || "عمل فني",
        (proj?.project_type || "finishing") as "contracting" | "finishing",
        proj?.clients?.id || "unassigned", proj?.clients?.name || "بدون زبون");
      const value = Number(work.total_amount || 0);
      gWorkValue += value;
      group.totalWorkValue += value;
      group.assignments.push({ id: `labor-${work.id}`, projectItemId: "", projectItemName: work.title || "عمل فني",
        phaseId: work.phase_id, phaseName: "أعمال العمالة", rate: Number((work.items?.[0] as any)?.price || 0), rateType: "unit", quantity: Number((work.items?.[0] as any)?.qty || 1),
        totalCost: value, workValue: value, notes: work.notes, createdAt: work.created_at });
    });

    const clientMap = new Map<string, TechnicianClientGroup>();
    projectMap.forEach((projGrp) => {
      const cId = projGrp.clientId;
      if (!clientMap.has(cId)) {
        clientMap.set(cId, { clientId: cId, clientName: projGrp.clientName, projects: [] });
      }
      clientMap.get(cId)!.projects.push(projGrp);
    });

    const completedPayments = technicianPayments.filter((p: any) => p.status !== "reversed");
    const tPaid = completedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const lPaid = laborPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const gPaid = tPaid + lPaid + laborInvoicePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const sBalance = gWorkValue - gPaid;

    return {
      clientGroups: Array.from(clientMap.values()),
      globalWorkValue: gWorkValue,
      globalPaid: gPaid,
      signedBalance: sBalance,
      distinctProjectsCount: projectMap.size,
      totalAssignmentsCount: assignments.length + laborPurchases.length,
    };
  }, [assignments, technicianPayments, laborPayments, laborPurchases, laborInvoicePayments]);

  const balanceInfo = useMemo(() => {
    if (signedBalance > 0) {
      return {
        label: "المتبقي للفني",
        amount: signedBalance,
        color: "text-amber-600 dark:text-amber-400",
        description: "صافي المستحقات المتبقية في ذمة المؤسسة",
      };
    }
    if (signedBalance === 0) {
      return {
        label: "الرصيد",
        amount: 0,
        color: "text-foreground",
        description: "الحساب متوازن بالكامل (لا توجد مستحقات)",
      };
    }
    return {
      label: "رصيد مقدم للفني",
      amount: Math.abs(signedBalance),
      color: "text-blue-600 dark:text-blue-400",
      description: "دفعة مقدمة على الحساب تستوعب الأعمال القادمة تلقائياً",
    };
  }, [signedBalance]);

  const handleOpenPayModal = (contextProjId?: string) => {
    setPayContextProjectId(contextProjId || null);
    if (treasuriesList.length > 0 && !payTreasuryId) setPayTreasuryId(treasuriesList[0].id);
    setPayAmount(signedBalance > 0 ? signedBalance.toString() : "");
    setIsPayModalOpen(true);
  };

  const handleStartEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setEditAmount(payment.amount?.toString() || "");
    setEditTreasuryId(payment.treasury_id || payment.treasuries?.id || "");
    setEditPaymentMethod(payment.payment_method || "cash");
    setEditDate(payment.date || "");
    setEditReference(payment.reference || "");
    setEditNotes(payment.notes || "");
  };

  const handleStartReversePayment = (payment: any) => {
    setReversingPayment(payment);
    setReversalReason("إلغاء دفعة بطلب المستخدم");
  };

  const payOnAccountMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) throw new Error("يرجى إدخال مبلغ دفع صحيح");
      if (!payTreasuryId) throw new Error("يرجى اختيار الخزينة");

      const { data, error } = await (supabase.rpc as any)("pay_technician_on_account_atomic", {
        p_technician_id: id,
        p_treasury_id: payTreasuryId,
        p_amount: amt,
        p_payment_method: payPaymentMethod,
        p_date: payDate,
        p_notes: payNotes || null,
        p_reference: payReference || null,
        p_idempotency_key: paymentOperation.getKey([id, payTreasuryId, amt, payPaymentMethod, payDate, payNotes, payReference, payContextProjectId]),
        p_context_project_id: payContextProjectId || null,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      paymentOperation.reset();
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["technician-direct-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["parent-treasuries-list"] });
      toast.success("تم تسجيل الدفعة بنجاح");
      setIsPayModalOpen(false);
      setPayAmount("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("update_technician_payment_atomic", {
        p_payment_id: editingPayment.id,
        p_amount: parseFloat(editAmount),
        p_treasury_id: editTreasuryId,
        p_payment_method: editPaymentMethod,
        p_date: editDate,
        p_notes: editNotes || null,
        p_reference: editReference || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["technician-direct-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["parent-treasuries-list"] });
      toast.success("تم التعديل بنجاح");
      setEditingPayment(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reversePaymentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("reverse_technician_payment_atomic", {
        p_payment_id: reversingPayment.id,
        p_reversal_reason: reversalReason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["technician-direct-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["parent-treasuries-list"] });
      toast.success("تم إلغاء الدفعة بنجاح");
      setReversingPayment(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const chronologicalStatement = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      createdAt: string;
      type: "work" | "payment";
      description: string;
      projectName?: string;
      workValue: number;
      paymentAmount: number;
      runningBalance: number;
      isReversed?: boolean;
      paymentRecord?: any;
    }> = [];

    for (const asg of assignments) {
      const pItem = (asg as any).project_items;
      const rawCost = Number(asg.total_cost);
      const wVal = rawCost > 0 ? rawCost : (Number(asg.rate || 0) * Number(asg.quantity || 1));
      items.push({
        id: `asg-${asg.id}`,
        date: asg.created_at?.slice(0, 10) || "",
        createdAt: asg.created_at || "",
        type: "work",
        description: `إسناد عمل: ${pItem?.name || "بند عمل"}${asg.quantity ? ` (${asg.quantity} ${rateTypeLabels[asg.rate_type || ''] || asg.rate_type || ''})` : ''}`,
        projectName: pItem?.projects?.name || "مشروع",
        workValue: wVal,
        paymentAmount: 0,
        runningBalance: 0,
      });
    }

    for (const work of laborPurchases) {
      items.push({ id: `labor-${work.id}`, date: work.date, createdAt: work.created_at, type: "work",
        description: work.title || "عمل فني", projectName: work.projects?.name,
        workValue: Number(work.total_amount || 0), paymentAmount: 0, runningBalance: 0 });
    }
    for (const payment of laborInvoicePayments) {
      items.push({ id: `labor-paid-${payment.id}`, date: payment.date, createdAt: payment.created_at,
        type: "payment", description: `سداد فاتورة العمالة: ${payment.purchases?.title || "عمل فني"}`,
        projectName: payment.purchases?.projects?.name, workValue: 0, paymentAmount: Number(payment.amount), runningBalance: 0 });
    }

    for (const tp of technicianPayments) {
      const isRev = tp.status === "reversed";
      items.push({
        id: `tp-${tp.id}`,
        date: tp.date || tp.created_at?.slice(0, 10) || "",
        createdAt: tp.created_at || "",
        type: "payment",
        description: isRev ? `دفعة ملغاة - ${tp.notes || "سند ملغي"}` : (tp.notes || `دفعة على الحساب - ${tp.treasuries?.name || "الخزينة"}`),
        projectName: "دفعة على الحساب (حساب الفني العام)",
        workValue: 0,
        paymentAmount: isRev ? 0 : Number(tp.amount || 0),
        runningBalance: 0,
        isReversed: isRev,
        paymentRecord: tp,
      });
    }

    for (const pay of laborPayments) {
      items.push({
        id: `pay-${pay.id}`,
        date: pay.date || pay.created_at?.slice(0, 10) || "",
        createdAt: pay.created_at || "",
        type: "payment",
        description: pay.description || "دفعة على الحساب (تاريخية)",
        projectName: pay.projects?.name,
        workValue: 0,
        paymentAmount: Number(pay.amount || 0),
        runningBalance: 0,
        paymentRecord: pay,
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt.localeCompare(b.createdAt);
    });

    let running = 0;
    for (const item of items) {
      if (item.type === "work") {
        running += item.workValue;
      } else if (!item.isReversed) {
        running -= item.paymentAmount;
      }
      item.runningBalance = running;
    }

    return items;
  }, [assignments, technicianPayments, laborPayments, laborPurchases, laborInvoicePayments]);

  // Filter Client/Project by Search Query
  const filteredClientGroups = useMemo(() => {
    if (!searchQuery.trim()) return clientGroups;
    const q = searchQuery.trim().toLowerCase();

    return clientGroups
      .map((c) => {
        const matchingProjects = c.projects.filter(
          (p) =>
            p.projectName.toLowerCase().includes(q) ||
            p.clientName.toLowerCase().includes(q) ||
            p.assignments.some(
              (a) =>
                a.projectItemName.toLowerCase().includes(q) ||
                (a.phaseName && a.phaseName.toLowerCase().includes(q))
            )
        );

        if (c.clientName.toLowerCase().includes(q)) {
          return c;
        }

        if (matchingProjects.length > 0) {
          return {
            ...c,
            projects: matchingProjects,
          };
        }

        return null;
      })
      .filter(Boolean) as TechnicianClientGroup[];
  }, [clientGroups, searchQuery]);

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === undefined ? false : !prev[clientId],
    }));
  };

  const handlePrintStatement = () => {
    const balanceText = signedBalance > 0
      ? `المتبقي للفني: ${formatCurrencyLYD(signedBalance)}`
      : signedBalance < 0
      ? `رصيد مقدم للفني: ${formatCurrencyLYD(Math.abs(signedBalance))}`
      : `الرصيد: متوازن (0.00 د.ل)`;

    const htmlContent = `
      <div class="print-area" dir="rtl">
        <div class="print-report-header">
          <div class="print-report-title">كشف حساب الفني: ${technician?.name || ""}</div>
          <div class="print-report-subtitle">التخصص: ${technician?.specialty || (technician as any)?.technician_types?.name || "فني"}</div>
          <div class="print-report-meta">التاريخ: ${new Date().toLocaleDateString("ar-LY")}</div>
        </div>
        <div class="print-content">
          <table class="print-info-table">
            <tr>
              <td class="info-label">إجمالي قيمة الأعمال</td>
              <td class="info-value">${formatCurrencyLYD(globalWorkValue)}</td>
              <td class="info-label">إجمالي المدفوعات</td>
              <td class="info-value">${formatCurrencyLYD(globalPaid)}</td>
            </tr>
            <tr>
              <td class="info-label">المشاريع المرتبط بها</td>
              <td class="info-value">${distinctProjectsCount} مشروع</td>
              <td class="info-label">الأعمال المسندة</td>
              <td class="info-value">${totalAssignmentsCount} عمل</td>
            </tr>
            <tr>
              <td class="info-label">حالة الرصيد</td>
              <td class="info-value" colspan="3" style="font-weight: bold; color: #d6ac40;">${balanceText}</td>
            </tr>
          </table>
        </div>
      </div>
    `;
    openPrintWindow(`كشف حساب الفني: ${technician?.name || ""}`, htmlContent, companySettings);
  };

  if (loadingTechnician) {
    return (
      <div className="space-y-4 p-6" dir="rtl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (technicianError || !technician) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-bold text-foreground">تعذر العثور على الفني</h3>
        <p className="text-sm text-muted-foreground mt-1">الفني المطلوب غير موجود أو تم حذفه.</p>
        <Button className="mt-4" onClick={() => navigate("/technicians")}>
          العودة لقائمة الفنيين
        </Button>
      </div>
    );
  }

  const isLoadingData = loadingAssignments || loadingPayments || loadingLaborWork || loadingTechPayments || loadingLaborInvoicePayments;

  if (assignmentsError || paymentsError || laborWorkError || laborInvoicePaymentsError || techPaymentsError) return (
    <Card className="m-6 p-6 space-y-3" dir="rtl" role="alert">
      <p>تعذر تحميل حساب الفني كاملاً. لم نعرض أرصدة جزئية.</p>
      <Button variant="outline" onClick={() => invalidateFinancialQueries(queryClient)}>إعادة المحاولة</Button>
    </Card>
  );
  if (isLoadingData) return <div className="p-6 text-muted-foreground" dir="rtl" role="status">جاري مطابقة أعمال الفني ومدفوعاته…</div>;

  return (
    <div className="space-y-5 p-4 sm:p-6" dir="rtl">
      {/* Breadcrumb Navigation */}
      <DeterministicBreadcrumb
        items={[
          { label: "الفنيون", href: "/technicians" },
          { label: technician?.name || "تفاصيل الفني", isCurrent: true },
        ]}
        fallbackBackHref="/technicians"
      />

      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>{technician.name}</span>
            </h1>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-1 flex-wrap">
              {(technician.specialty || (technician as any).technician_types?.name) && (
                <Badge variant="secondary" className="font-bold">
                  {technician.specialty || (technician as any).technician_types?.name}
                </Badge>
              )}
              {technician.phone && (
                <span className="flex items-center gap-1 font-semibold text-foreground/80">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span dir="ltr">{technician.phone}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenPayModal()}
            className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>دفع على الحساب</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrintStatement} className="gap-1.5 text-xs font-bold bg-card border-border/80 hover:bg-muted cursor-pointer shadow-2xs">
            <Printer className="h-4 w-4 text-primary" />
            <span>طباعة كشف الحساب</span>
          </Button>
        </div>
      </div>

      {/* Top Reconciled Summary KPIs (Financial Authority) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي قيمة الأعمال</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(globalWorkValue)}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium">إجمالي أجور وقيم الأعمال المسندة للفني بكافة المشاريع</span>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي المدفوعات</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2" dir="ltr">
            {formatCurrencyLYD(globalPaid)}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium">سندات الصرف والدفعات النقدية المسددة</span>
        </Card>

        <Card className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/[0.03] to-card p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-primary font-bold">{balanceInfo.label}</span>
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <p className={`text-2xl font-black ${balanceInfo.color} mt-2`} dir="ltr">
              {formatCurrencyLYD(balanceInfo.amount)}
            </p>
            <span className="text-[11px] text-foreground/80 font-semibold">{balanceInfo.description}</span>
          </div>

          <Button
            size="sm"
            onClick={() => handleOpenPayModal()}
            className="mt-3 w-full h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>دفع على الحساب</span>
          </Button>
        </Card>
      </div>

      {/* Operational Stats Strip */}
      <TechnicianDepositsPanel technicianId={id!} />
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/80 text-xs shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-2 pr-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground font-bold">المشاريع المرتبط بها:</span>
          <Badge variant="secondary" className="font-bold text-xs">{distinctProjectsCount}</Badge>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-muted-foreground font-bold">الأعمال المسندة:</span>
          <Badge variant="secondary" className="font-bold text-xs">{totalAssignmentsCount}</Badge>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-muted-foreground font-bold">عدد الدفعات المسددة:</span>
          <Badge variant="secondary" className="font-bold text-xs">
            {technicianPayments.filter((p: any) => p.status !== "reversed").length + laborPayments.length}
          </Badge>
        </div>
      </div>

      {/* Query Error Alert if any query fails */}
      {(assignmentsError || paymentsError || laborWorkError || laborInvoicePaymentsError) && (
        <Card className="p-3.5 bg-destructive/10 border-destructive/30 rounded-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-destructive text-xs font-bold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>حدث خطأ أثناء جلب بعض بيانات الفني أو سجلات العمل.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 font-bold border-destructive/30 hover:bg-destructive/10 cursor-pointer"
            onClick={() => {
              refetchAssignments();
              refetchPayments();
            }}
          >
            إعادة المحاولة
          </Button>
        </Card>
      )}

      {/* Tabs Layout: Projects & Assignments vs Statement */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-card border border-border/80 p-1 rounded-xl shadow-2xs h-11">
            <TabsTrigger value="projects" className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer">
              <Building2 className="h-4 w-4 text-primary" />
              <span>المشاريع والأعمال المسندة</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {distinctProjectsCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="statement" className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer">
              <Receipt className="h-4 w-4 text-primary" />
              <span>سجل السندات والعمليات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {chronologicalStatement.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Instant Search Bar */}
          {activeTab === "projects" && (
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الزبون، المشروع، أو البند..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-10 text-xs rounded-xl bg-card border-border/80"
              />
            </div>
          )}
        </div>

        {/* TAB 1: CLIENTS -> PROJECTS -> ASSIGNMENTS */}
        <TabsContent value="projects" className="space-y-4 mt-2">
          {isLoadingData ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : filteredClientGroups.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-dashed border-border/80 bg-card">
              <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-base font-bold text-foreground">لا توجد أعمال أو مشاريع مسندة لهذا الفني</h4>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                يمكن إسناد الفني إلى بنود المشاريع مباشرة وتحديد أجر العمل، أو تسجيل دفعات مقدمة على حسابه.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-r-2 border-primary pr-3">
                <Building2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-extrabold text-foreground">المشاريع والزبائن</h2>
                <span className="hidden text-xs text-muted-foreground sm:inline">تجميع الأعمال حسب العميل ثم المشروع</span>
              </div>
              {filteredClientGroups.map((client) => {
              const isClientExpanded = expandedClients[client.clientId] !== false;
              const clientTotalWork = client.projects.reduce((sum, p) => sum + p.totalWorkValue, 0);

              return (
                <Card
                  key={client.clientId}
                  className="rounded-2xl border border-border/80 shadow-xs overflow-hidden bg-card"
                >
                  {/* Client Group Header */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isClientExpanded}
                    className="flex cursor-pointer items-center justify-between border-b border-border/80 bg-muted/30 p-3.5 transition-all duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => toggleClientExpand(client.clientId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleClientExpand(client.clientId);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>العميل: {client.clientName}</span>
                          <Badge variant="outline" className="text-[10px] font-bold py-0.5 border-border/80">
                            {client.projects.length} {client.projects.length === 1 ? "مشروع" : "مشاريع"}
                          </Badge>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-[10px] text-muted-foreground font-bold block">إجمالي أعمال العميل</span>
                        <span className="text-xs font-black text-foreground" dir="ltr">
                          {formatCurrencyLYD(clientTotalWork)}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        {isClientExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Projects under this Client */}
                  {isClientExpanded && (
                    <div className="p-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                      {client.projects.map((proj) => (
                        <div
                          key={proj.projectId}
                          className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between shadow-2xs space-y-3"
                        >
                          <div className="space-y-3">
                            {/* Project Title & Badges */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <Link
                                  to={`/projects/${proj.projectId}`}
                                  className="font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                                >
                                  <Layers className="h-4 w-4 text-primary shrink-0" />
                                  <span>{proj.projectName}</span>
                                </Link>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 font-bold ${
                                    proj.projectType === "contracting"
                                      ? "border-amber-500/30 text-amber-700 bg-amber-500/10"
                                      : "border-purple-500/30 text-purple-700 bg-purple-500/10"
                                  }`}
                                >
                                  {proj.projectType === "contracting" ? "مقاولات" : "تشطيبات"}
                                </Badge>
                              </div>
                            </div>

                            {/* Project Financial Metrics Box */}
                            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-center">
                              <div>
                                <span className="text-[10px] text-muted-foreground font-bold block">إجمالي قيمة الأعمال</span>
                                <span className="text-xs font-black text-foreground" dir="ltr">
                                  {formatCurrencyLYD(proj.totalWorkValue)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground font-bold block">الأعمال المسندة</span>
                                <span className="text-xs font-black text-primary" dir="ltr">
                                  {proj.assignments.length} بند
                                </span>
                              </div>
                            </div>

                            {/* Assigned BOQ Items List */}
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 py-1">
                                <Box className="h-3.5 w-3.5 text-primary" />
                                <span>الأعمال والبنود المسندة ({proj.assignments.length})</span>
                              </span>

                              <div className="space-y-2">
                                {proj.assignments.length === 0 ? (
                                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg text-center">
                                    لا توجد بنود مسندة حالياً في هذا المشروع.
                                  </p>
                                ) : (
                                  proj.assignments.map((asg) => (
                                    <div
                                      key={asg.id}
                                      className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1.5"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="font-bold text-foreground flex items-center gap-1.5">
                                            <span>{asg.projectItemName}</span>
                                          </div>
                                          <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                            المرحلة: <span className="text-foreground/80 font-semibold">{asg.phaseName}</span>
                                          </div>
                                        </div>
                                        <div className="text-left font-black text-foreground" dir="ltr">
                                          {formatCurrencyLYD(asg.workValue)}
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40 font-medium">
                                        <div>
                                          {asg.rate ? (
                                            <span>
                                              الأجر: <strong className="text-foreground">{formatCurrencyLYD(asg.rate)}</strong> {rateTypeLabels[asg.rateType || ""] || asg.rateType}
                                              {asg.quantity ? ` × ${asg.quantity}` : ""}
                                            </span>
                                          ) : (
                                            <span>معدل الأجر: غير محدد</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1 text-xs px-3 shadow-2xs cursor-pointer"
                              onClick={() => handleOpenPayModal(proj.projectId)}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>دفع على الحساب</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: FULL CHRONOLOGICAL RUNNING BALANCE STATEMENT */}
        <TabsContent value="statement" className="mt-2">
          <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
            <CardHeader className="p-4 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Receipt className="h-4 w-4 text-primary" />
                <span>كشف الحساب التراكمي وسجل الحركات المالية</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold border-border/80">
                  {chronologicalStatement.length} حركة مسجلة
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrintStatement}
                  className="h-7 text-xs gap-1 font-bold cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  <span>طباعة الكشف</span>
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="text-xs" dir="rtl">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-right font-bold text-foreground">التاريخ</TableHead>
                    <TableHead className="text-right font-bold text-foreground">البيان / المشروع</TableHead>
                    <TableHead className="text-right font-bold text-foreground">قيمة العمل (+)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الدفعة المسددة (-)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الرصيد التراكمي</TableHead>
                    <TableHead className="text-center font-bold text-foreground">الإجراءات والسندات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chronologicalStatement.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-medium">
                        لا توجد حركات مسجلة في كشف حساب الفني حتى الآن.
                      </TableCell>
                    </TableRow>
                  ) : (
                    chronologicalStatement.map((st) => (
                      <TableRow key={st.id} className={`hover:bg-muted/30 ${st.isReversed ? "opacity-50 line-through bg-muted/10" : ""}`}>
                        <TableCell className="font-semibold">{st.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{st.description}</span>
                            {st.isReversed && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1 font-bold">
                                ملغاة
                              </Badge>
                            )}
                          </div>
                          {st.projectName && (
                            <div className="text-[11px] text-muted-foreground">مشروع: {st.projectName}</div>
                          )}
                          {st.isReversed && st.paymentRecord?.reversal_reason && (
                            <div className="text-[10px] text-destructive font-medium">سبب الإلغاء: {st.paymentRecord.reversal_reason}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                          {st.workValue > 0 ? `+${formatCurrencyLYD(st.workValue)}` : "—"}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                          {st.paymentAmount > 0 ? `-${formatCurrencyLYD(st.paymentAmount)}` : (st.isReversed ? "0.00 د.ل" : "—")}
                        </TableCell>
                        <TableCell className="font-black text-foreground" dir="ltr">
                          <span className={st.runningBalance > 0 ? "text-amber-600 dark:text-amber-400" : st.runningBalance < 0 ? "text-blue-600 dark:text-blue-400" : ""}>
                            {st.runningBalance > 0 ? `متبقي: ${formatCurrencyLYD(st.runningBalance)}` : st.runningBalance < 0 ? `مقدم: ${formatCurrencyLYD(Math.abs(st.runningBalance))}` : formatCurrencyLYD(0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {st.type === "payment" && st.paymentRecord && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="طباعة سند الصرف"
                                onClick={() =>
                                  openReceiptPrintWindow(
                                    {
                                      receiptNumber: `PAY-${st.paymentRecord.id.slice(0, 8)}`,
                                      date: st.paymentRecord.date,
                                      type: "salary",
                                      amount: Number(st.paymentRecord.amount || 0),
                                      paidToOrBy: technician.name,
                                      description: st.paymentRecord.description || `صرف مستحقات فني`,
                                      projectName: st.paymentRecord.projects?.name,
                                      paymentMethod: st.paymentRecord.payment_method,
                                      treasuryName: st.paymentRecord.treasuries?.name,
                                      notes: st.paymentRecord.notes || undefined,
                                      isCancelled: st.isReversed,
                                      reversalReason: st.paymentRecord.reversal_reason || undefined,
                                      reversedAt: st.paymentRecord.reversed_at || undefined,
                                    },
                                    companySettings
                                  )
                                }
                              >
                                <Printer className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            )}

                            {/* Edit & Reversal Actions for Canonical Technician Payments */}
                            {st.type === "payment" && st.paymentRecord && !st.isReversed && !st.paymentRecord.project_id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-blue-600 cursor-pointer"
                                  title="تعديل الدفعة"
                                  onClick={() => handleStartEditPayment(st.paymentRecord)}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                                  title="إلغاء الدفعة"
                                  onClick={() => handleStartReversePayment(st.paymentRecord)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: SIMPLE ON-ACCOUNT PAYMENT FOR TECHNICIAN */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>دفع على حساب الفني</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              صرف دفعة مالية مباشرة أو دفعة مقدمة/وديعة على حساب الفني، مع تحديث الخزينة فوراً.
            </DialogDescription>
          </DialogHeader>

          {/* Party Summary Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-bold">الفني:</span>
              <span className="font-black text-foreground">{technician.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">إجمالي الأعمال</span>
                <span className="text-xs font-black text-foreground" dir="ltr">
                  {formatCurrencyLYD(globalWorkValue)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">المدفوع سابقاً</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {formatCurrencyLYD(globalPaid)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">{balanceInfo.label}</span>
                <span className={`text-xs font-black ${balanceInfo.color}`} dir="ltr">
                  {formatCurrencyLYD(balanceInfo.amount)}
                </span>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              payOnAccountMutation.mutate();
            }}
            className="space-y-3.5 py-1"
          >
            <div className="space-y-3 p-3 bg-muted/40 rounded-xl border border-border/80">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">القسم / الخزينة الرئيسية *</Label>
                <Select
                  value={paySelectedParentTreasuryId}
                  onValueChange={(pId) => {
                    setPaySelectedParentTreasuryId(pId);
                    const children = treasuriesList.filter((t: any) => t.parent_id === pId);
                    const chosen = children.length > 0 ? children[0].id : pId;
                    setPayTreasuryId(chosen);
                  }}
                  required
                  dir="rtl"
                  disabled={loadingTreasuries || payOnAccountMutation.isPending}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="اختر الخزينة الرئيسية..." />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {parentTreasuries.map((pt: any) => (
                      <SelectItem key={pt.id} value={pt.id} className="text-xs">
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الحساب / الفرع المخصوم منه *</Label>
                <Select
                  value={payTreasuryId}
                  onValueChange={setPayTreasuryId}
                  required
                  dir="rtl"
                  disabled={!paySelectedParentTreasuryId || loadingTreasuries || payOnAccountMutation.isPending}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={paySelectedParentTreasuryId ? "اختر الحساب أو الفرع..." : "حدد الخزينة الرئيسية أولاً"} />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {eligibleBranches.map((tr: any) => (
                      <SelectItem key={tr.id} value={tr.id} className="text-xs">
                        {tr.name} ({tr.treasury_type === 'bank' ? 'مصرفي' : 'نقدي'}) - رصيد: {formatCurrencyLYD(tr.balance || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingTreasuries && (
                  <p className="text-[11px] text-muted-foreground">جاري تحميل الخزائن المتاحة...</p>
                )}
                {!loadingTreasuries && treasuriesList.length === 0 && (
                  <p className="text-[11px] text-destructive">لا توجد خزينة نشطة متاحة للصرف. فعّل خزينة من الإعدادات أولاً.</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">المبلغ المدفوع الآن (د.ل) *</Label>
                {signedBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(signedBalance.toString())}
                    className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                  >
                    صرف كامل المستحق ({formatCurrencyLYD(signedBalance)})
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="أدخل المبلغ المراد صرفه"
                className="text-left font-black text-sm h-9"
                dir="ltr"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">طريقة الدفع *</Label>
                <Select value={payPaymentMethod} onValueChange={setPayPaymentMethod} dir="rtl">
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل مصرفي</SelectItem>
                    <SelectItem value="check">صك مصدق</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">التاريخ *</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">رقم المرجع / الشيك (اختياري)</Label>
              <Input
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="رقم الحوالة أو الصك أو الإيصال اليدوي"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات (اختياري)</Label>
              <Textarea
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="أي ملاحظات حول هذه الدفعة..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 text-xs h-9 font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs gap-1.5"
                disabled={
                  payOnAccountMutation.isPending || 
                  !payAmount || 
                  parseFloat(payAmount) <= 0 || 
                  !payTreasuryId || loadingTreasuries
                }
              >
                <Sparkles className="h-4 w-4" />
                <span>{payOnAccountMutation.isPending ? "جاري حفظ الدفعة..." : "حفظ الدفعة وصرف السند"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 cursor-pointer"
                onClick={() => setIsPayModalOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDIT TECHNICIAN PAYMENT */}
      <Dialog open={editingPayment !== null} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              <span>تعديل سند صرف الفني</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تعديل تفاصيل الدفعة مع إعادة ضبط حركة الخزينة تلقائياً.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updatePaymentMutation.mutate();
            }}
            className="space-y-3.5 py-1"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">الخزينة المخصوم منها *</Label>
              <Select value={editTreasuryId} onValueChange={setEditTreasuryId} required dir="rtl">
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="اختر الخزينة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {treasuriesList.map((tr: any) => (
                    <SelectItem key={tr.id} value={tr.id} className="text-xs">
                      {tr.name} ({formatCurrencyLYD(tr.balance || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">المبلغ (د.ل) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="أدخل المبلغ"
                className="text-left font-black text-sm h-9"
                dir="ltr"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">طريقة الدفع *</Label>
                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod} dir="rtl">
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل مصرفي</SelectItem>
                    <SelectItem value="check">صك مصدق</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">التاريخ *</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">رقم المرجع / الشيك</Label>
              <Input
                value={editReference}
                onChange={(e) => setEditReference(e.target.value)}
                placeholder="رقم المرجع"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="ملاحظات..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 text-xs h-9 font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs gap-1.5"
                disabled={updatePaymentMutation.isPending || !editAmount || parseFloat(editAmount) <= 0}
              >
                <Pencil className="h-4 w-4" />
                <span>{updatePaymentMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 cursor-pointer"
                onClick={() => setEditingPayment(null)}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: REVERSE TECHNICIAN PAYMENT */}
      <Dialog open={reversingPayment !== null} onOpenChange={(open) => !open && setReversingPayment(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5 text-destructive" />
              <span>إلغاء سند صرف الفني واستعادة الرصيد</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              سيتم إلغاء الدفعة واسترجاع المبلغ تلقائياً إلى رصيد الخزينة المخصوم منها مع الاحتفاظ بالسجل في الأرشيف المالي.
            </DialogDescription>
          </DialogHeader>

          {reversingPayment && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-bold">المبلغ المسترجع:</span>
                <span className="font-black text-destructive" dir="ltr">
                  {formatCurrencyLYD(Number(reversingPayment.amount || 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-bold">الخزينة المستفيدة:</span>
                <span className="font-bold text-foreground">
                  {reversingPayment.treasuries?.name || "الخزينة الأصلية"}
                </span>
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              reversePaymentMutation.mutate();
            }}
            className="space-y-3.5 py-1"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-destructive">سبب الإلغاء (إجباري للتوثيق والرقابة) *</Label>
              <Textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="أدخل سبب إلغاء هذا السند..."
                rows={3}
                className="text-xs border-destructive/40 focus-visible:ring-destructive"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                variant="destructive"
                className="flex-1 text-xs h-9 font-bold cursor-pointer shadow-xs gap-1.5"
                disabled={reversePaymentMutation.isPending || !reversalReason.trim()}
              >
                <RotateCcw className="h-4 w-4" />
                <span>{reversePaymentMutation.isPending ? "جاري الإلغاء..." : "تأكيد إلغاء السند واسترجاع الرصيد"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 cursor-pointer"
                onClick={() => setReversingPayment(null)}
              >
                تراجع
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
