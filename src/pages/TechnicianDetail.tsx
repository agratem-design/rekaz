import { useState, useMemo, useEffect } from "react";
import { useOperationKey } from "@/hooks/useOperationKey";
import { TechnicianDepositsPanel } from "@/components/technicians/TechnicianDepositsPanel";
import { HierarchicalTreasurySelect } from "@/components/treasury/HierarchicalTreasurySelect";
import { useAuth } from "@/contexts/AuthContext";
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
  CheckCircle2,
  TableProperties,
  LayoutGrid,
  Copy,
  Check,
  ShieldCheck,
  Briefcase,
  ExternalLink,
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
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientId: string;
  clientName: string;
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
  const { role } = useAuth();
  const canManagePayments = role === "admin" || role === "accountant";
  const paymentOperation = useOperationKey();

  // Active Tab: projects (المشاريع والزبائن) | payments | statement | deposits
  const [activeTab, setActiveTab] = useState<"projects" | "payments" | "statement" | "deposits">("projects");
  
  // View mode for assignments: "grouped" (default) vs "table"
  const [assignmentsViewMode, setAssignmentsViewMode] = useState<"grouped" | "table">("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Edit Technician Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileSpecialty, setEditProfileSpecialty] = useState("");
  const [editProfileNotes, setEditProfileNotes] = useState("");

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

  // Populate edit profile fields when technician is loaded
  useEffect(() => {
    if (technician) {
      setEditProfileName(technician.name || "");
      setEditProfilePhone(technician.phone || "");
      setEditProfileSpecialty(technician.specialty || (technician as any).technician_types?.name || "");
      setEditProfileNotes(technician.notes || "");
    }
  }, [technician]);

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

  // 6. Technician Deposits balance
  const { data: depositEntries = [] } = useQuery({
    queryKey: ["technician-deposits", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_deposits" as any)
        .select("id, entry_type, amount, date, notes")
        .eq("technician_id", id!)
        .order("date", { ascending: false });
      if (error) return [];
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const totalDepositBalance = useMemo(() => {
    return depositEntries.reduce((sum: number, e: any) => {
      return sum + (e.entry_type === "receipt" ? 1 : -1) * Number(e.amount || 0);
    }, 0);
  }, [depositEntries]);

  // 7. Company settings for receipt printing
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

  // 8. Canonical Global Financial Account & Operational Project Views
  const {
    allFlatAssignments,
    clientGroups,
    globalWorkValue,
    globalPaid,
    signedBalance,
    distinctProjects,
    distinctProjectsCount,
    totalAssignmentsCount,
  } = useMemo(() => {
    let gWorkValue = 0;
    const projectMap = new Map<string, TechnicianProjectGroup>();
    const flatList: TechnicianItemAssignment[] = [];

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
      const projId = proj?.id || "unassigned";
      const projName = proj?.name || "مشروع مقاولات";
      const projType = (proj?.project_type || "contracting") as "contracting" | "finishing";
      const cliId = proj?.clients?.id || "unassigned";
      const cliName = proj?.clients?.name || "بدون زبون";

      const grp = getOrCreateGroup(projId, projName, projType, cliId, cliName);
      const rawCost = Number(a.total_cost);
      const wVal = rawCost > 0 ? rawCost : (Number(a.rate || 0) * Number(a.quantity || 1));
      gWorkValue += wVal;
      grp.totalWorkValue += wVal;

      const itemAssignment: TechnicianItemAssignment = {
        id: a.id,
        projectItemId: a.project_item_id,
        projectItemName: pItem?.name || "بند",
        phaseId: pItem?.phase_id || null,
        phaseName: pItem?.project_phases?.name || "المرحلة الرئيسية",
        projectId: projId,
        projectName: projName,
        projectType: projType,
        clientId: cliId,
        clientName: cliName,
        rate: a.rate,
        rateType: a.rate_type,
        quantity: a.quantity,
        totalCost: a.total_cost,
        workValue: wVal,
        notes: a.notes,
        createdAt: a.created_at,
      };

      grp.assignments.push(itemAssignment);
      flatList.push(itemAssignment);
    });

    laborPurchases.forEach((work) => {
      const proj = work.projects;
      const projId = proj?.id || "unassigned";
      const projName = proj?.name || "عمل فني";
      const projType = (proj?.project_type || "finishing") as "contracting" | "finishing";
      const cliId = proj?.clients?.id || "unassigned";
      const cliName = proj?.clients?.name || "بدون زبون";

      const group = getOrCreateGroup(projId, projName, projType, cliId, cliName);
      const value = Number(work.total_amount || 0);
      gWorkValue += value;
      group.totalWorkValue += value;

      const laborAssignment: TechnicianItemAssignment = {
        id: `labor-${work.id}`,
        projectItemId: "",
        projectItemName: work.title || "عمل فني",
        phaseId: work.phase_id,
        phaseName: "أعمال العمالة والتشطيب",
        projectId: projId,
        projectName: projName,
        projectType: projType,
        clientId: cliId,
        clientName: cliName,
        rate: Number((work.items?.[0] as any)?.price || 0),
        rateType: "unit",
        quantity: Number((work.items?.[0] as any)?.qty || 1),
        totalCost: value,
        workValue: value,
        notes: work.notes,
        createdAt: work.created_at,
      };

      group.assignments.push(laborAssignment);
      flatList.push(laborAssignment);
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

    const projectsList = Array.from(projectMap.values()).map(p => ({
      id: p.projectId,
      name: p.projectName,
    }));

    return {
      allFlatAssignments: flatList,
      clientGroups: Array.from(clientMap.values()),
      globalWorkValue: gWorkValue,
      globalPaid: gPaid,
      signedBalance: sBalance,
      distinctProjects: projectsList,
      distinctProjectsCount: projectMap.size,
      totalAssignmentsCount: flatList.length,
    };
  }, [assignments, technicianPayments, laborPayments, laborPurchases, laborInvoicePayments]);

  const balanceInfo = useMemo(() => {
    if (signedBalance > 0) {
      return {
        label: "المتبقي للفني",
        amount: signedBalance,
        color: "text-amber-700 dark:text-amber-400",
        badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300",
        statusText: "صافي المستحقات المتبقية في ذمة المؤسسة",
      };
    }
    if (signedBalance === 0) {
      return {
        label: "الرصيد",
        amount: 0,
        color: "text-emerald-700 dark:text-emerald-400",
        badgeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
        statusText: "الحساب متوازن بالكامل (لا توجد مستحقات)",
      };
    }
    return {
      label: "رصيد مقدم للفني",
      amount: Math.abs(signedBalance),
      color: "text-blue-700 dark:text-blue-400",
      badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-300",
      statusText: "دفعة مقدمة على الحساب تستوعب الأعمال القادمة تلقائياً",
    };
  }, [signedBalance]);

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { name: string; phone: string; specialty: string; notes: string }) => {
      const { data, error } = await supabase
        .from("technicians")
        .update({
          name: payload.name,
          phone: payload.phone || null,
          specialty: payload.specialty || null,
          notes: payload.notes || null,
        })
        .eq("id", id!)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", id] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      toast.success("تم تحديث بيانات الفني بنجاح");
      setIsEditProfileOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "تعذر تحديث البيانات"),
  });

  const payOnAccountMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) throw new Error("يرجى إدخال مبلغ دفع صحيح أكبر من صفر");
      if (!payTreasuryId) throw new Error("يرجى اختيار الخزينة المخصوم منها");

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
    onSuccess: (data: any) => {
      paymentOperation.reset();
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["technician-direct-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["parent-treasuries-list"] });
      
      const paidAmt = parseFloat(payAmount);
      toast.success(`تم تسجيل دفعة بقيمة ${formatCurrencyLYD(paidAmt)} بنجاح`, {
        action: {
          label: "طباعة السند",
          onClick: () => {
            openReceiptPrintWindow(
              {
                receiptNumber: `PAY-${data?.payment_id?.slice(0, 8) || Date.now().toString().slice(-6)}`,
                date: payDate,
                type: "salary",
                amount: paidAmt,
                paidToOrBy: technician?.name || "الفني",
                description: payNotes || "صرف دفعة على الحساب",
                paymentMethod: payPaymentMethod,
                treasuryName: treasuriesList.find((t: any) => t.id === payTreasuryId)?.name,
                notes: payNotes || undefined,
              },
              companySettings
            );
          },
        },
      });

      setIsPayModalOpen(false);
      setPayAmount("");
      setPayNotes("");
      setPayReference("");
    },
    onError: (err: any) => toast.error(err.message || "فشلت عملية الصرف"),
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
      queryClient.invalidateQueries({ queryKey: ["technicians", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["parent-treasuries-list"] });
      toast.success("تم تعديل السند بنجاح");
      setEditingPayment(null);
    },
    onError: (err: any) => toast.error(err.message || "تعذر تعديل السند"),
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
      toast.success("تم إلغاء السند واستعادة الرصيد للخزينة");
      setReversingPayment(null);
    },
    onError: (err: any) => toast.error(err.message || "تعذر إلغاء السند"),
  });

  // Chronological statement computation
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
      items.push({
        id: `labor-${work.id}`,
        date: work.date || work.created_at?.slice(0, 10) || "",
        createdAt: work.created_at,
        type: "work",
        description: work.title || "عمل فني",
        projectName: work.projects?.name,
        workValue: Number(work.total_amount || 0),
        paymentAmount: 0,
        runningBalance: 0,
      });
    }

    for (const payment of laborInvoicePayments) {
      items.push({
        id: `labor-paid-${payment.id}`,
        date: payment.date || payment.created_at?.slice(0, 10) || "",
        createdAt: payment.created_at,
        type: "payment",
        description: `سداد فاتورة عمالة: ${payment.purchases?.title || "عمل فني"}`,
        projectName: payment.purchases?.projects?.name,
        workValue: 0,
        paymentAmount: Number(payment.amount),
        runningBalance: 0,
      });
    }

    for (const tp of technicianPayments) {
      const isRev = tp.status === "reversed";
      items.push({
        id: `tp-${tp.id}`,
        date: tp.date || tp.created_at?.slice(0, 10) || "",
        createdAt: tp.created_at || "",
        type: "payment",
        description: isRev 
          ? `سند صرف ملغي - ${tp.notes || "ملغي"}`
          : (tp.notes || `دفعة على الحساب - ${tp.treasuries?.name || "الخزينة"}`),
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
        description: pay.description || "دفعة عمالة على الحساب",
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

  // Filtered Flat Assignments
  const filteredFlatAssignments = useMemo(() => {
    return allFlatAssignments.filter((asg) => {
      const matchesSearch = !searchQuery.trim() || 
        asg.projectItemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asg.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asg.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asg.phaseName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesProject = filterProject === "all" || asg.projectId === filterProject;

      return matchesSearch && matchesProject;
    });
  }, [allFlatAssignments, searchQuery, filterProject]);

  // Filtered Client Groups (for grouped view)
  const filteredClientGroups = useMemo(() => {
    if (!searchQuery.trim() && filterProject === "all") return clientGroups;
    const q = searchQuery.trim().toLowerCase();

    return clientGroups
      .map((c) => {
        const matchingProjects = c.projects.filter((p) => {
          const projectMatchesFilter = filterProject === "all" || p.projectId === filterProject;
          const projectMatchesSearch = !q ||
            p.projectName.toLowerCase().includes(q) ||
            p.clientName.toLowerCase().includes(q) ||
            p.assignments.some(a => a.projectItemName.toLowerCase().includes(q) || a.phaseName.toLowerCase().includes(q));

          return projectMatchesFilter && projectMatchesSearch;
        });

        if (matchingProjects.length > 0) {
          return { ...c, projects: matchingProjects };
        }
        return null;
      })
      .filter(Boolean) as TechnicianClientGroup[];
  }, [clientGroups, searchQuery, filterProject]);

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === undefined ? false : !prev[clientId],
    }));
  };

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

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success("تم نسخ رقم الهاتف");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handlePrintStatement = () => {
    const balanceText = signedBalance > 0
      ? `المتبقي للفني: ${formatCurrencyLYD(signedBalance)}`
      : signedBalance < 0
      ? `رصيد مقدم للفني: ${formatCurrencyLYD(Math.abs(signedBalance))}`
      : `الرصيد: متوازن (0.00 د.ل)`;

    const tableRows = chronologicalStatement.map(st => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${st.date}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${st.description} ${st.projectName ? `(${st.projectName})` : ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left; direction: ltr;">${st.workValue > 0 ? formatCurrencyLYD(st.workValue) : '—'}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left; direction: ltr;">${st.paymentAmount > 0 ? formatCurrencyLYD(st.paymentAmount) : (st.isReversed ? 'ملغاة' : '—')}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left; direction: ltr; font-weight: bold;">${formatCurrencyLYD(st.runningBalance)}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <div class="print-area" dir="rtl">
        <div class="print-report-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #d6ac40; padding-bottom: 12px;">
          <h2 style="margin: 0; font-size: 20px; color: #111;">كشف حساب فني / عامل</h2>
          <h3 style="margin: 6px 0; font-size: 16px; color: #d6ac40;">${technician?.name || ""}</h3>
          <div style="font-size: 12px; color: #666;">
            التخصص: ${technician?.specialty || (technician as any)?.technician_types?.name || "فني عام"} | 
            الهاتف: ${technician?.phone || "—"} | 
            التاريخ: ${new Date().toLocaleDateString("ar-LY")}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr style="background: #fdfaf3;">
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">إجمالي قيمة الأعمال:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left; font-weight: bold;">${formatCurrencyLYD(globalWorkValue)}</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">إجمالي المدفوعات:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left; font-weight: bold; color: #16a34a;">${formatCurrencyLYD(globalPaid)}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">الوديعة المحفوظة:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left;">${formatCurrencyLYD(totalDepositBalance)}</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">صافي الرصيد:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left; font-weight: bold; font-size: 14px; color: #d6ac40;">${balanceText}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f5f5f5; border: 1px solid #ddd;">
              <th style="padding: 8px; border: 1px solid #ddd;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">البيان / تفاصيل العمل أو السند</th>
              <th style="padding: 8px; border: 1px solid #ddd;">قيمة العمل (+)</th>
              <th style="padding: 8px; border: 1px solid #ddd;">الدفعة الصادرة (-)</th>
              <th style="padding: 8px; border: 1px solid #ddd;">الرصيد التراكمي</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
    openPrintWindow(`كشف حساب: ${technician?.name || ""}`, htmlContent, companySettings);
  };

  if (loadingTechnician) {
    return (
      <div className="space-y-4 p-4 sm:p-6" dir="rtl">
        <Skeleton className="h-28 rounded-2xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl w-full" />
      </div>
    );
  }

  if (technicianError || !technician) {
    return (
      <div className="p-12 text-center" dir="rtl">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <h3 className="text-xl font-bold text-foreground">تعذر العثور على الفني أو العامل</h3>
        <p className="text-sm text-muted-foreground mt-1">السجل المطلوب غير موجود أو تم حذفه من النظام.</p>
        <Button className="mt-4 bg-primary text-primary-foreground font-bold cursor-pointer" onClick={() => navigate("/technicians")}>
          العودة لقائمة الفنيين والعمال
        </Button>
      </div>
    );
  }

  const isLoadingData = loadingAssignments || loadingPayments || loadingLaborWork || loadingTechPayments || loadingLaborInvoicePayments;

  return (
    <div className="space-y-5 p-4 sm:p-6" dir="rtl">
      {/* Deterministic Breadcrumbs */}
      <DeterministicBreadcrumb
        items={[
          { label: "الفنيين والعمال", href: "/technicians" },
          { label: technician?.name || "تفاصيل الفني", isCurrent: true },
        ]}
        fallbackBackHref="/technicians"
      />

      {/* Hero Party Account Header */}
      <Card className="overflow-hidden border border-border/80 bg-gradient-to-l from-card via-card to-primary/[0.04] shadow-xs rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-amber-500 to-primary/40" />
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Right side: Party Info */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <Wrench className="h-8 w-8 text-primary animate-in fade-in" />
            </div>
            
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-foreground">{technician.name}</h1>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
                  فني / عامل
                </Badge>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>نشط</span>
                </Badge>
              </div>

              {/* Specialty & Contact Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                {(technician.specialty || (technician as any).technician_types?.name) && (
                  <div className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60 text-foreground font-semibold">
                    <Briefcase className="h-3.5 w-3.5 text-primary" />
                    <span>{technician.specialty || (technician as any).technician_types?.name}</span>
                  </div>
                )}

                {technician.phone ? (
                  <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    <a
                      href={`tel:${technician.phone}`}
                      className="text-foreground hover:text-primary font-bold hover:underline transition-colors"
                      dir="ltr"
                    >
                      {technician.phone}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(technician.phone)}
                      className="p-1 hover:text-primary text-muted-foreground transition-colors cursor-pointer"
                      title="نسخ الرقم"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs italic">لا يوجد رقم هاتف مسجل</span>
                )}

                {technician.notes && (
                  <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                    ملاحظات: {technician.notes}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Left side: Quick Actions & Live Balance Pill */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            {/* Live Balance Banner Chip */}
            <div className={`px-3.5 py-1.5 rounded-xl border flex items-center justify-between sm:justify-start gap-2.5 ${balanceInfo.badgeBg}`}>
              <div className="text-right">
                <span className="text-[10px] font-bold block text-muted-foreground">{balanceInfo.label}</span>
                <span className="text-base font-black text-foreground" dir="ltr">
                  {formatCurrencyLYD(balanceInfo.amount)}
                </span>
              </div>
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {canManagePayments && (
                <Button
                  onClick={() => handleOpenPayModal()}
                  className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  <Wallet className="h-4 w-4" />
                  <span>صرف دفعة على الحساب</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handlePrintStatement}
                className="h-9 px-3 text-xs font-bold gap-1.5 cursor-pointer border-border/80 hover:bg-muted transition-all"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                <span>كشف الحساب</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditProfileOpen(true)}
                className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer border border-border/60 hover:bg-muted"
                title="تعديل بيانات الفني"
              >
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Executive Summary Grid (4 Cohesive Financial & Activity Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Work Value */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي قيمة الأعمال</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(globalWorkValue)}
          </p>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مجموع أجور الأعمال المسندة</span>
            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-muted">
              {totalAssignmentsCount} عمل
            </Badge>
          </div>
        </Card>

        {/* KPI 2: Total Paid Out */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي المدفوعات الصادرة</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2" dir="ltr">
            {formatCurrencyLYD(globalPaid)}
          </p>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>سندات الصرف والدفعات</span>
            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {technicianPayments.filter((p: any) => p.status !== "reversed").length + laborPayments.length} سند
            </Badge>
          </div>
        </Card>

        {/* KPI 3: Signed Net Balance */}
        <Card className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between ${
          signedBalance > 0 
            ? "border-amber-500/40 bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.02] to-card"
            : signedBalance < 0
            ? "border-blue-500/40 bg-gradient-to-br from-blue-500/[0.08] via-blue-500/[0.02] to-card"
            : "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.02] to-card"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${balanceInfo.color}`}>{balanceInfo.label}</span>
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <p className={`text-2xl font-black ${balanceInfo.color} mt-2`} dir="ltr">
              {formatCurrencyLYD(balanceInfo.amount)}
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-foreground/80 font-medium line-clamp-1">
            {balanceInfo.statusText}
          </div>
        </Card>

        {/* KPI 4: Security Deposit & Active Projects */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">الوديعة المحفوظة</span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(totalDepositBalance)}
          </p>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>المشاريع المرتبط بها:</span>
            <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 border-border/80">
              {distinctProjectsCount} مشروع
            </Badge>
          </div>
        </Card>
      </div>

      {/* Main Interactive Tabs Section */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-card border border-border/80 p-1 rounded-xl shadow-2xs h-11 flex-wrap">
            <TabsTrigger 
              value="projects" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Building2 className="h-4 w-4 text-primary" />
              <span>المشاريع والزبائن</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {distinctProjectsCount}
              </Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="payments" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>سندات الصرف والمدفوعات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {technicianPayments.length + laborPayments.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="statement" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>كشف الحساب التراكمي</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {chronologicalStatement.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="deposits" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>الوديعة والتسويات</span>
              {totalDepositBalance > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-purple-500/10 text-purple-700">
                  {formatCurrencyLYD(totalDepositBalance)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Quick Tab Controls & Filters */}
          {activeTab === "projects" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Project Filter Select */}
              <Select value={filterProject} onValueChange={setFilterProject} dir="rtl">
                <SelectTrigger className="h-9 w-40 text-xs rounded-xl bg-card border-border/80">
                  <SelectValue placeholder="كل المشاريع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all" className="text-xs font-bold">كافة المشاريع</SelectItem>
                  {distinctProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-xl border border-border/80 bg-card p-0.5 shadow-2xs">
                <Button
                  variant={assignmentsViewMode === "grouped" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                  onClick={() => setAssignmentsViewMode("grouped")}
                  title="عرض مجمّع حسب المشروع والعميل"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">مجموعات المشاريع</span>
                </Button>
                <Button
                  variant={assignmentsViewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                  onClick={() => setAssignmentsViewMode("table")}
                  title="عرض كجدول ERP تفصيلي"
                >
                  <TableProperties className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">جدول ERP</span>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="بحث في البنود والمشاريع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 h-9 text-xs rounded-xl bg-card border-border/80"
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: WORK ITEMS & ASSIGNMENTS (المشاريع والزبائن)          */}
        {/* ============================================================ */}
        <TabsContent value="projects" className="space-y-4 mt-1">
          {isLoadingData ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : filteredFlatAssignments.length === 0 ? (
            <Card className="p-10 text-center rounded-2xl border-dashed border-border/80 bg-card">
              <Box className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-base font-bold text-foreground">لا توجد أعمال أو بنود مسندة لهذا الفني</h4>
              <p className="text-xs text-muted-foreground mt-1 font-medium max-w-md mx-auto">
                يمكن إسناد الفني إلى بنود مقايسة المشاريع وتحديد أجر العمل، أو تسجيل دفعات وصرف سندات مباشرة على حسابه.
              </p>
            </Card>
          ) : assignmentsViewMode === "grouped" ? (
            /* Grouped View (Client -> Projects) - Canonical ERP Hierarchy */
            <div className="space-y-3.5">
              {filteredClientGroups.map((client) => {
                const isClientExpanded = expandedClients[client.clientId] !== false;
                const clientTotalWork = client.projects.reduce((sum, p) => sum + p.totalWorkValue, 0);

                return (
                  <Card key={client.clientId} className="rounded-2xl border border-border/80 shadow-xs overflow-hidden bg-card">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isClientExpanded}
                      className="flex cursor-pointer items-center justify-between border-b border-border/80 bg-muted/20 p-3.5 transition-all duration-200 hover:bg-muted/40 focus-visible:outline-none"
                      onClick={() => toggleClientExpand(client.clientId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
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

                    {isClientExpanded && (
                      <div className="p-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                        {client.projects.map((proj) => (
                          <div
                            key={proj.projectId}
                            className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between shadow-2xs space-y-3"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  to={`/projects/${proj.projectId}`}
                                  className="font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                                >
                                  <Layers className="h-4 w-4 text-primary shrink-0" />
                                  <span>{proj.projectName}</span>
                                </Link>
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

                              <div className="space-y-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 py-1">
                                  <Box className="h-3.5 w-3.5 text-primary" />
                                  <span>الأعمال والبنود المسندة ({proj.assignments.length})</span>
                                </span>

                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {proj.assignments.map((asg) => (
                                    <div key={asg.id} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="font-bold text-foreground">{asg.projectItemName}</div>
                                        <div className="text-left font-black text-foreground" dir="ltr">
                                          {formatCurrencyLYD(asg.workValue)}
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                                        <span>المرحلة: {asg.phaseName}</span>
                                        {asg.rate && (
                                          <span>
                                            الأجر: {formatCurrencyLYD(asg.rate)} {rateTypeLabels[asg.rateType || ""] || asg.rateType}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                              <Button
                                size="sm"
                                className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1 text-xs px-3 shadow-2xs cursor-pointer"
                                onClick={() => handleOpenPayModal(proj.projectId)}
                                disabled={!canManagePayments}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>صرف دفعة للمشروع</span>
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
          ) : (
            /* ERP Table View */
            <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
              <CardHeader className="p-3.5 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableProperties className="h-4 w-4 text-primary" />
                  <CardTitle className="text-xs font-bold text-foreground">
                    جدول كافة الأعمال والبنود المسندة ({filteredFlatAssignments.length})
                  </CardTitle>
                </div>
                <div className="text-xs font-bold text-muted-foreground">
                  إجمالي القيمة: <strong className="text-foreground text-sm" dir="ltr">{formatCurrencyLYD(filteredFlatAssignments.reduce((s, a) => s + a.workValue, 0))}</strong>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table className="text-xs" dir="rtl">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-right font-bold text-foreground w-12">#</TableHead>
                      <TableHead className="text-right font-bold text-foreground">اسم بند العمل</TableHead>
                      <TableHead className="text-right font-bold text-foreground">المشروع والعميل</TableHead>
                      <TableHead className="text-right font-bold text-foreground">المرحلة</TableHead>
                      <TableHead className="text-right font-bold text-foreground">معدل الأجر والكمية</TableHead>
                      <TableHead className="text-right font-bold text-foreground">إجمالي القيمة</TableHead>
                      <TableHead className="text-right font-bold text-foreground">التاريخ</TableHead>
                      <TableHead className="text-center font-bold text-foreground">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFlatAssignments.map((asg, idx) => (
                      <TableRow key={asg.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground text-xs">{asg.projectItemName}</div>
                          {asg.notes && <div className="text-[10px] text-muted-foreground mt-0.5">{asg.notes}</div>}
                        </TableCell>
                        <TableCell>
                          <Link 
                            to={`/projects/${asg.projectId}`} 
                            className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <span>{asg.projectName}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                          <div className="text-[10px] text-muted-foreground mt-0.5">العميل: {asg.clientName}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-medium">{asg.phaseName}</TableCell>
                        <TableCell>
                          {asg.rate ? (
                            <div>
                              <span className="font-bold text-foreground" dir="ltr">{formatCurrencyLYD(asg.rate)}</span>
                              <span className="text-[10px] text-muted-foreground mr-1">
                                {rateTypeLabels[asg.rateType || ""] || asg.rateType}
                              </span>
                              {asg.quantity ? <span className="text-[10px] font-semibold text-primary block">× {asg.quantity}</span> : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">مقطوع</span>
                          )}
                        </TableCell>
                        <TableCell className="font-black text-foreground" dir="ltr">
                          {formatCurrencyLYD(asg.workValue)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {asg.createdAt?.slice(0, 10) || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] px-2 font-bold text-primary hover:bg-primary/10 cursor-pointer"
                            onClick={() => handleOpenPayModal(asg.projectId)}
                            disabled={!canManagePayments}
                            title="صرف دفعة مرتبطة بهذا المشروع"
                          >
                            <Wallet className="h-3.5 w-3.5 ml-1" />
                            <span>صرف</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: PAYMENT VOUCHERS & DISBURSEMENTS                     */}
        {/* ============================================================ */}
        <TabsContent value="payments" className="space-y-4 mt-1">
          <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
            <CardHeader className="p-4 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-xs font-bold text-foreground">
                  سجل سندات الصرف والمدفوعات المسددة ({technicianPayments.length + laborPayments.length})
                </CardTitle>
              </div>
              {canManagePayments && (
                <Button
                  size="sm"
                  onClick={() => handleOpenPayModal()}
                  className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer shadow-xs"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>تسجيل دفعة جديدة</span>
                </Button>
              )}
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="text-xs" dir="rtl">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-right font-bold text-foreground">رقم السند</TableHead>
                    <TableHead className="text-right font-bold text-foreground">التاريخ</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الخزينة المخصوم منها</TableHead>
                    <TableHead className="text-right font-bold text-foreground">طريقة الدفع</TableHead>
                    <TableHead className="text-right font-bold text-foreground">البيان / الملاحظات</TableHead>
                    <TableHead className="text-right font-bold text-foreground">المبلغ المصروف</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الحالة</TableHead>
                    <TableHead className="text-center font-bold text-foreground">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicianPayments.length === 0 && laborPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground font-medium">
                        لا توجد سندات صرف أو دفعات مسجلة لهذا الفني حتى الآن.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {technicianPayments.map((pay: any) => {
                        const isRev = pay.status === "reversed";
                        return (
                          <TableRow key={`tp-${pay.id}`} className={`hover:bg-muted/30 transition-colors ${isRev ? "opacity-50 line-through bg-muted/10" : ""}`}>
                            <TableCell className="font-mono font-bold text-foreground text-[11px]">
                              PAY-{pay.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="font-semibold text-muted-foreground">{pay.date || pay.created_at?.slice(0, 10)}</TableCell>
                            <TableCell className="font-semibold text-foreground">
                              {pay.treasuries?.name || "الخزينة العامة"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-bold border-border/80">
                                {pay.payment_method === "cash" ? "نقداً" : pay.payment_method === "transfer" ? "تحويل" : "صك"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-foreground font-medium">{pay.notes || "صرف دفعة على الحساب"}</span>
                              {isRev && pay.reversal_reason && (
                                <div className="text-[10px] text-destructive font-medium mt-0.5">
                                  سبب الإلغاء: {pay.reversal_reason}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                              {formatCurrencyLYD(Number(pay.amount || 0))}
                            </TableCell>
                            <TableCell>
                              {isRev ? (
                                <Badge variant="destructive" className="text-[10px] font-bold">ملغاة</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-700 bg-emerald-500/10">
                                  معتمدة
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="طباعة سند الصرف"
                                  onClick={() =>
                                    openReceiptPrintWindow(
                                      {
                                        receiptNumber: `PAY-${pay.id.slice(0, 8)}`,
                                        date: pay.date,
                                        type: "salary",
                                        amount: Number(pay.amount || 0),
                                        paidToOrBy: technician.name,
                                        description: pay.notes || `صرف مستحقات فني`,
                                        paymentMethod: pay.payment_method,
                                        treasuryName: pay.treasuries?.name,
                                        notes: pay.notes || undefined,
                                        isCancelled: isRev,
                                        reversalReason: pay.reversal_reason || undefined,
                                        reversedAt: pay.reversed_at || undefined,
                                      },
                                      companySettings
                                    )
                                  }
                                >
                                  <Printer className="h-3.5 w-3.5 text-primary" />
                                </Button>

                                {!isRev && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-blue-600 cursor-pointer"
                                      title="تعديل الدفعة"
                                      onClick={() => handleStartEditPayment(pay)}
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                                      title="إلغاء الدفعة واسترجاع الرصيد"
                                      onClick={() => handleStartReversePayment(pay)}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {laborPayments.map((pay: any) => (
                        <TableRow key={`lp-${pay.id}`} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            EXP-{pay.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="font-semibold text-muted-foreground">{pay.date || pay.created_at?.slice(0, 10)}</TableCell>
                          <TableCell className="text-muted-foreground">صرف مباشر (مشروع)</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-bold border-border/80">نقداً</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground font-medium">{pay.description || "صرف عمالة مشروع"}</span>
                            {pay.projects?.name && (
                              <div className="text-[10px] text-muted-foreground">مشروع: {pay.projects.name}</div>
                            )}
                          </TableCell>
                          <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                            {formatCurrencyLYD(Number(pay.amount || 0))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-700 bg-emerald-500/10">
                              معتمدة
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="طباعة إيصال الصرف"
                              onClick={() =>
                                openReceiptPrintWindow(
                                  {
                                    receiptNumber: `EXP-${pay.id.slice(0, 8)}`,
                                    date: pay.date,
                                    type: "salary",
                                    amount: Number(pay.amount || 0),
                                    paidToOrBy: technician.name,
                                    description: pay.description || `صرف مستحقات عمالة`,
                                    projectName: pay.projects?.name,
                                  },
                                  companySettings
                                )
                              }
                            >
                              <Printer className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: RUNNING BALANCE STATEMENT (LEDGER)                    */}
        {/* ============================================================ */}
        <TabsContent value="statement" className="space-y-4 mt-1">
          <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
            <CardHeader className="p-4 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-bold text-foreground">
                  كشف الحساب التراكمي المالي المتسلسل ({chronologicalStatement.length} حركة)
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrintStatement}
                className="h-8 text-xs gap-1.5 font-bold cursor-pointer border-border/80 hover:bg-muted"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                <span>طباعة الكشف التراكمي</span>
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="text-xs" dir="rtl">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-right font-bold text-foreground">التاريخ</TableHead>
                    <TableHead className="text-right font-bold text-foreground">البيان / تفاصيل العملية</TableHead>
                    <TableHead className="text-right font-bold text-foreground">قيمة العمل (+)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الدفعة المسددة (-)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الرصيد التراكمي</TableHead>
                    <TableHead className="text-center font-bold text-foreground">السند</TableHead>
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
                      <TableRow key={st.id} className={`hover:bg-muted/30 transition-colors ${st.isReversed ? "opacity-50 line-through bg-muted/10" : ""}`}>
                        <TableCell className="font-semibold text-muted-foreground">{st.date}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{st.description}</span>
                            {st.isReversed && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1 font-bold">ملغاة</Badge>
                            )}
                          </div>
                          {st.projectName && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">المشروع: {st.projectName}</div>
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
                            {st.runningBalance > 0 
                              ? `مستحق: ${formatCurrencyLYD(st.runningBalance)}` 
                              : st.runningBalance < 0 
                              ? `مقدم: ${formatCurrencyLYD(Math.abs(st.runningBalance))}` 
                              : formatCurrencyLYD(0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {st.type === "payment" && st.paymentRecord && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="طباعة السند"
                              onClick={() =>
                                openReceiptPrintWindow(
                                  {
                                    receiptNumber: `PAY-${st.paymentRecord.id.slice(0, 8)}`,
                                    date: st.paymentRecord.date,
                                    type: "salary",
                                    amount: Number(st.paymentRecord.amount || 0),
                                    paidToOrBy: technician.name,
                                    description: st.paymentRecord.description || `صرف مستحقات فني`,
                                    paymentMethod: st.paymentRecord.payment_method,
                                    treasuryName: st.paymentRecord.treasuries?.name,
                                  },
                                  companySettings
                                )
                              }
                            >
                              <Printer className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 4: SECURITY DEPOSITS & SETTLEMENTS                      */}
        {/* ============================================================ */}
        <TabsContent value="deposits" className="space-y-4 mt-1">
          <TechnicianDepositsPanel technicianId={id!} />
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOG: EDIT TECHNICIAN PROFILE                              */}
      {/* ============================================================ */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-600" />
              <span>تعديل بيانات الفني / العامل</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تحديث معلومات الاتصال والتخصص والملاحظات الخاصة بالفني.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate({
                name: editProfileName,
                phone: editProfilePhone,
                specialty: editProfileSpecialty,
                notes: editProfileNotes,
              });
            }}
            className="space-y-3.5 py-1"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم الفني / العامل *</Label>
              <Input
                value={editProfileName}
                onChange={(e) => setEditProfileName(e.target.value)}
                placeholder="اسم الفني الثلاثي"
                className="text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">رقم الهاتف</Label>
              <Input
                value={editProfilePhone}
                onChange={(e) => setEditProfilePhone(e.target.value)}
                placeholder="09XXXXXXXX"
                className="text-xs h-9 text-left font-mono"
                dir="ltr"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">التخصص / المهنة</Label>
              <Input
                value={editProfileSpecialty}
                onChange={(e) => setEditProfileSpecialty(e.target.value)}
                placeholder="مثال: سباكة، نجارة، حدادة، كهرباء"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">ملاحظات عامة</Label>
              <Textarea
                value={editProfileNotes}
                onChange={(e) => setEditProfileNotes(e.target.value)}
                placeholder="أي تفاصيل أو ملاحظات حول العامل..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 text-xs h-9 font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs gap-1.5"
                disabled={updateProfileMutation.isPending || !editProfileName.trim()}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{updateProfileMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-9 cursor-pointer"
                onClick={() => setIsEditProfileOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: PAY ON ACCOUNT FOR TECHNICIAN                        */}
      {/* ============================================================ */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>صرف دفعة مالية للفني / العامل</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              صرف دفعة مالية مباشرة أو دفعة مقدمة/وديعة على حساب الفني، مع تحديث الخزينة فوراً.
            </DialogDescription>
          </DialogHeader>

          {/* Party Financial Recap Box */}
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
                    <SelectValue placeholder={paySelectedParentTreasuryId ? "اختر الحساب أو الفرع..." : "حدد الخزينة أولاً"} />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {eligibleBranches.map((tr: any) => (
                      <SelectItem key={tr.id} value={tr.id} className="text-xs">
                        {tr.name} ({tr.treasury_type === 'bank' ? 'مصرفي' : 'نقدي'}) - رصيد: {formatCurrencyLYD(tr.balance || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* ============================================================ */}
      {/* DIALOG: EDIT PAYMENT                                         */}
      {/* ============================================================ */}
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
            <HierarchicalTreasurySelect
              value={editTreasuryId}
              onValueChange={setEditTreasuryId}
              treasuries={treasuriesList}
              parentLabel="الخزينة الرئيسية المصروف منها *"
              childLabel="الحساب / الفرع المخصوم منه *"
              required
            />

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

      {/* ============================================================ */}
      {/* DIALOG: REVERSE PAYMENT                                      */}
      {/* ============================================================ */}
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
