import { useParams, Link } from "react-router-dom";
import { useOperationKey } from "@/hooks/useOperationKey";
import { ClientCreditPanel } from "@/components/clients/ClientCreditPanel";
import { HierarchicalTreasurySelect } from "@/components/treasury/HierarchicalTreasurySelect";
import { availableClientCredit } from "@/lib/financialCore";
import { financialRpc, invalidateFinancialQueries } from "@/lib/financialMutations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeterministicBreadcrumb } from "@/components/navigation/DeterministicBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  Pencil,
  Copy,
  Check,
  Sparkles,
  LayoutGrid,
  TableProperties,
  ChevronDown,
  ChevronUp,
  Search,
  Phone,
  Mail,
  MapPin,
  Building,
  Building2,
  FolderOpen,
  FileText,
  DollarSign,
  Printer,
  Calendar,
  Wallet,
  ArrowUpRight,
  Coins,
  Plus,
  Hammer,
  Paintbrush,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Info,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { openPrintWindow } from "@/lib/printStyles";
import { toast } from "sonner";
import { calculateProjectFinancials } from "@/lib/financialCore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  project_type: string;
  client_id: string;
  description: string | null;
  status: string;
  budget: number;
  spent: number;
  created_at?: string;
};

type Phase = {
  id: string;
  project_id: string;
  name: string;
  phase_number: number | null;
  reference_number: string | null;
  has_percentage: boolean;
  percentage_value: number;
  created_at: string;
};

type ProjectItem = {
  id: string;
  project_id?: string | null;
  phase_id: string;
  total_price: number;
};

type Purchase = {
  id: string;
  project_id?: string | null;
  phase_id: string;
  total_amount: number;
  rental_id: string | null;
};

type ClientPayment = {
  id: string;
  amount: number;
  date: string;
  payment_method: string;
  notes: string | null;
  project_id: string | null;
  treasuries?: {
    name: string;
  } | null;
  projects?: {
    name: string;
    project_type: string;
  } | null;
};

type Contract = {
  id: string;
  title: string;
  contract_number: string;
  status: string;
  amount: number;
  start_date: string;
  project_id?: string | null;
  client_id?: string | null;
};

type Treasury = {
  id: string;
  name: string;
  treasury_type: string;
  parent_id?: string | null;
  balance: number;
  project_category?: string | null;
  is_active?: boolean;
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  active: "bg-green-500/10 text-green-500",
  completed: "bg-blue-500/10 text-blue-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const methodLabels: Record<string, string> = {
  cash: "نقدي (كاش)",
  cheque: "صك مصرفي",
  check: "صك مصرفي",
  transfer: "تحويل بنكي",
  bank_transfer: "تحويل بنكي",
  bank: "تحويل بنكي",
  installments: "أقساط",
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const receiptOperation = useOperationKey();

  // View mode and filter states
  const [activeTab, setActiveTab] = useState<"projects" | "payments" | "statement" | "credit">("projects");
  const [projectsViewMode, setProjectsViewMode] = useState<"cards" | "table">("cards");
  const [projectTypeFilter, setProjectTypeFilter] = useState<"all" | "contracting" | "finishing">("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Edit Client Modal state
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const openEditClientModal = () => {
    if (!client) return;
    setEditName(client.name || "");
    setEditPhone(client.phone || "");
    setEditEmail(client.email || "");
    setEditCity(client.city || "");
    setEditAddress(client.address || "");
    setEditNotes(client.notes || "");
    setIsEditClientOpen(true);
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success("تم نسخ رقم الهاتف");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const updateClientMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("بيانات العميل غير متوفرة");
      const { error } = await supabase
        .from("clients")
        .update({
          name: editName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          city: editCity.trim() || null,
          address: editAddress.trim() || null,
          notes: editNotes.trim() || null,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("تم تحديث بيانات العميل بنجاح");
      setIsEditClientOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ البيانات");
    },
  });

  // Add payment states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [paymentProjectType, setPaymentProjectType] = useState<"all" | "contracting" | "finishing">("all");
  // "none" represents a general client advance/credit not tied to a project.
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  // Fetch company settings for printing
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-client-detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch client details
  const { data: client, isLoading: clientLoading, error: clientError } = useQuery<Client | null>({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client projects
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({
    queryKey: ["client-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client contracts
  const { data: contracts, isLoading: contractsLoading, error: contractsError } = useQuery<Contract[]>({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client payments with treasury and project names
  const { data: payments, isLoading: paymentsLoading, error: paymentsError } = useQuery<ClientPayment[]>({
    queryKey: ["client-payments-list", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, amount, date, payment_method, notes, project_id, treasuries(name), projects(name, project_type)").is("reversed_at", null)
        .eq("client_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // Filter projects for payment selection based on selected project type
  const filteredProjectsForPayment = useMemo(() => {
    if (!projects) return [];
    if (paymentProjectType === "all") return projects;
    return projects.filter((p) => p.project_type === paymentProjectType);
  }, [projects, paymentProjectType]);

  // Fetch active treasuries
  const { data: treasuries } = useQuery<Treasury[]>({
    queryKey: ["treasuries-active-client-detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, parent_id, balance, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // ── Auto-select parent treasury based on selected project or dominant sector ──
  useEffect(() => {
    if (!treasuries || treasuries.length === 0) return;
    const parentList = treasuries.filter((t) => !t.parent_id && t.is_active !== false);
    if (!parentList.length) return;

    if (selectedProjectId && selectedProjectId !== "none") {
      const proj = projects?.find((p) => p.id === selectedProjectId);
      if (proj) {
        if ((proj as any).default_treasury_id) {
          const defId = (proj as any).default_treasury_id;
          const directParent = parentList.find((t) => t.id === defId);
          if (directParent) {
            setSelectedParentTreasuryId(directParent.id);
            return;
          }
          const child = treasuries.find((t) => t.id === defId);
          if (child?.parent_id) {
            setSelectedParentTreasuryId(child.parent_id);
            return;
          }
        }
        const pType = proj.project_type;
        const matched = parentList.find(
          (t) =>
            t.project_category === pType ||
            (pType === "contracting" && t.name.includes("مقاولات")) ||
            (pType === "finishing" && t.name.includes("تشطيب"))
        );
        if (matched) {
          setSelectedParentTreasuryId(matched.id);
          return;
        }
      }
    } else if (!selectedParentTreasuryId) {
      const hasContractingOnly = projects?.length && projects.every((p) => p.project_type === "contracting");
      const contractingRoot = parentList.find((t) => t.name.includes("مقاولات"));
      if (hasContractingOnly && contractingRoot) {
        setSelectedParentTreasuryId(contractingRoot.id);
      } else {
        setSelectedParentTreasuryId(parentList[0].id);
      }
    }
  }, [selectedProjectId, projects, treasuries, selectedParentTreasuryId]);

  // Fetch other related data for billing calculations
  const { data: phases, isLoading: phasesLoading, error: phasesError } = useQuery<Phase[]>({
    queryKey: ["client-phases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectItems, isLoading: itemsLoading, error: itemsError } = useQuery<ProjectItem[]>({
    queryKey: ["client-items", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_items").select("id, project_id, phase_id, total_price");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: purchases, isLoading: purchasesLoading, error: purchasesError } = useQuery<Purchase[]>({
    queryKey: ["client-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("id, project_id, phase_id, total_amount, paid_amount, purchase_type, supplier_id, technician_id, rental_id");
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: clientExpenses, isLoading: expensesLoading, error: expensesError } = useQuery({
    queryKey: ["client-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id, project_id, amount, type, technician_id");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: clientItemTechs, isLoading: techsLoading, error: techsError } = useQuery({
    queryKey: ["client-item-techs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_item_technicians").select("id, total_cost, rate, quantity, project_item_id, project_items(project_id)");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Add Payment Mutation
  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(paymentAmount);
      if (amt <= 0) {
        throw new Error("يجب إدخال قيمة صحيحة للمبلغ");
      }
      if (!selectedTreasuryId) {
        throw new Error("يجب اختيار الخزينة المستلمة");
      }

      const targetProjId = selectedProjectId && selectedProjectId !== "none" ? selectedProjectId : null;

      // The server RPC records the payment, treasury deposit, income journal,
      // and any client-credit event atomically. This also supports a general
      // advance when no project is selected.
      const payload = { project_id: targetProjId, client_id: id!, treasury_id: selectedTreasuryId,
        amount: amt, payment_method: paymentMethod, date: paymentDate, notes: notes || null };
      await financialRpc("record_client_receipt_v2", { p_payload: payload, p_request_key: receiptOperation.getKey(payload) });
    },
    onSuccess: () => {
      receiptOperation.reset();
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["client-projects", id] });
      queryClient.invalidateQueries({ queryKey: ["client-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["client-credit-ledger", id] });
      queryClient.invalidateQueries({ queryKey: ["client-credit-panel", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["all-clients-debts"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active-client-detail"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast.success("تم تسجيل الدفعة وإضافتها للخزينة بنجاح");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setNotes("");
      setSelectedParentTreasuryId("");
      setSelectedTreasuryId("");
      setPaymentProjectType("all");
      setSelectedProjectId("none");
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء تسجيل الدفعة");
    },
  });

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPaymentMutation.mutate();
  };

  const { data: clientCreditLedger = [], isLoading: creditLoading, error: creditError } = useQuery({
    queryKey: ["client-credit-ledger", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_credit_ledger")
        .select("entry_type, amount, target_project_id, source_payment_id").eq("client_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Calculate detailed financial totals using Central Financial Domain
  const clientFinancials = useMemo(() => {
    if (!projects || !phases || !projectItems || !purchases || !payments) {
      return {
        totalBilled: 0,
        totalPaid: 0,
        remaining: 0,
        contractingBilled: 0,
        finishingBilled: 0,
        contractingCount: 0,
        finishingCount: 0,
        contractingPaid: 0,
        finishingPaid: 0,
        contractingRemaining: 0,
        finishingRemaining: 0,
        projectBills: {} as Record<string, number>,
        projectRemainders: {} as Record<string, number>,
      };
    }

    let totalBilled = 0;
    let contractingBilled = 0;
    let finishingBilled = 0;
    let contractingCount = 0;
    let finishingCount = 0;
    let projectRemainingTotal = 0;
    let contractingRemainingTotal = 0;
    let finishingRemainingTotal = 0;
    let totalProjectSettled = 0;
    const projectBills: Record<string, number> = {};
    const projectRemainders: Record<string, number> = {};

    projects.forEach((proj) => {
      const projPurchases = purchases.filter((p) => p.project_id === proj.id);
      const projItems = projectItems.filter((item) => item.project_id === proj.id);
      const projContracts = (contracts || []).filter(
        (c) => c.status !== "cancelled" && c.project_id === proj.id
      );
      const projExpenses = (clientExpenses || []).filter((e: any) => e.project_id === proj.id);
      const projItemTechs = (clientItemTechs || []).filter((r: any) => r.project_items?.project_id === proj.id);
      const projPayments = (payments || []).filter((p: any) => p.project_id === proj.id);

      const projResult = calculateProjectFinancials({
        project: proj,
        contracts: projContracts,
        projectItems: projItems,
        purchases: projPurchases,
        projectItemTechnicians: projItemTechs,
        expenses: projExpenses,
        clientPayments: projPayments,
        creditLedger: clientCreditLedger,
      });

      const projectTotal = projResult.clientObligation;
      projectBills[proj.id] = projectTotal;
      projectRemainders[proj.id] = projResult.clientRemaining;
      totalBilled += projectTotal;
      projectRemainingTotal += projResult.clientRemaining;
      totalProjectSettled += projResult.totalSettled;

      if (proj.project_type === "contracting") {
        contractingBilled += projectTotal;
        contractingCount++;
        contractingRemainingTotal += projResult.clientRemaining;
      } else {
        finishingBilled += projectTotal;
        finishingCount++;
        finishingRemainingTotal += projResult.clientRemaining;
      }
    });

    let contractingPaid = 0;
    let finishingPaid = 0;

    (payments || []).forEach((p) => {
      const amt = Number(p.amount || 0);
      const projType = (p as any).projects?.project_type;
      if (projType === "contracting") {
        contractingPaid += amt;
      } else if (projType === "finishing") {
        finishingPaid += amt;
      }
    });

    const contractingRemaining = contractingRemainingTotal;
    const finishingRemaining = finishingRemainingTotal;

    // General payments with project_id = null are client credit/advances and
    // must not reduce project obligations until explicitly applied.
    const totalPaid = totalProjectSettled;
    const remaining = projectRemainingTotal;

    return {
      totalBilled,
      totalPaid,
      remaining,
      contractingBilled,
      finishingBilled,
      contractingCount,
      finishingCount,
      contractingPaid,
      finishingPaid,
      contractingRemaining,
      finishingRemaining,
      projectBills,
      projectRemainders,
    };
  }, [projects, phases, projectItems, purchases, payments, contracts, clientExpenses, clientItemTechs, clientCreditLedger]);

  const totalContractsAmount = useMemo(() => {
    if (!contracts) return 0;
    return contracts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [contracts]);

  // Comprehensive Payments Summary Breakdown
  const paymentsSummary = useMemo(() => {
    if (!payments) {
      return {
        totalPaid: 0,
        contractingPaid: 0,
        finishingPaid: 0,
        generalPaid: 0,
        cashPaid: 0,
        bankPaid: 0,
        count: 0,
      };
    }

    let contractingPaid = 0;
    let finishingPaid = 0;
    let generalPaid = 0;
    let cashPaid = 0;
    let bankPaid = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount || 0);
      const projType = (p as any).projects?.project_type;
      if (projType === "contracting") {
        contractingPaid += amt;
      } else if (projType === "finishing") {
        finishingPaid += amt;
      } else {
        generalPaid += amt;
      }

      if (p.payment_method === "cash") {
        cashPaid += amt;
      } else {
        bankPaid += amt;
      }
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      totalPaid,
      contractingPaid,
      finishingPaid,
      generalPaid,
      cashPaid,
      bankPaid,
      count: payments.length,
    };
  }, [payments]);

  // Map of project payments
  const projectPaymentsMap = useMemo(() => {
    const map: Record<string, number> = {};
    payments?.forEach((p: any) => {
      if (p.project_id) {
        map[p.project_id] = (map[p.project_id] || 0) + Number(p.amount || 0);
      }
    });
    return map;
  }, [payments]);

  // Selected project metrics
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "none" || !projects) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  const selectedProjectBill = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "none") return 0;
    return clientFinancials.projectBills[selectedProjectId] || 0;
  }, [selectedProjectId, clientFinancials.projectBills]);

  const selectedProjectPaid = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "none") return 0;
    return projectPaymentsMap[selectedProjectId] || 0;
  }, [selectedProjectId, projectPaymentsMap]);

  const selectedProjectRemaining = clientFinancials.projectRemainders[selectedProjectId] || 0;

  const contractingProjectsForSelect = useMemo(() => {
    return projects?.filter((p) => p.project_type === "contracting") || [];
  }, [projects]);

  const finishingProjectsForSelect = useMemo(() => {
    return projects?.filter((p) => p.project_type === "finishing") || [];
  }, [projects]);

  // Client Credit / Unallocated Advances
  const clientCredit = useMemo(() => {
    return availableClientCredit(clientCreditLedger as any);
  }, [clientCreditLedger]);

  // Chronological Statement Memo
  const chronologicalStatement = useMemo(() => {
    type StatementRow = {
      id: string;
      date: string;
      type: "bill" | "payment";
      description: string;
      projectName: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const rows: StatementRow[] = [];

    (projects || []).forEach((proj) => {
      const bill = clientFinancials.projectBills[proj.id] || 0;
      if (bill > 0) {
        rows.push({
          id: 'proj-' + proj.id,
          date: proj.created_at || new Date().toISOString(),
          type: "bill",
          description: 'مطالبات أعمال: ' + proj.name,
          projectName: proj.name,
          debit: bill,
          credit: 0,
          balance: 0,
        });
      }
    });

    (payments || []).forEach((p) => {
      const projName = p.projects?.name || "رصيد عام للزبون";
      rows.push({
        id: 'pay-' + p.id,
        date: p.date,
        type: "payment",
        description: 'دفعة مستلمة: ' + (p.notes || methodLabels[p.payment_method] || "سداد"),
        projectName: projName,
        debit: 0,
        credit: Number(p.amount) || 0,
        balance: 0,
      });
    });

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    return rows.map((r) => {
      running += r.debit - r.credit;
      return { ...r, balance: running };
    });
  }, [projects, payments, clientFinancials]);

  // Filtered Projects Memo
  const filteredProjects = useMemo(() => {
    let list = projects || [];
    if (projectTypeFilter !== "all") {
      list = list.filter((p) => p.project_type === projectTypeFilter);
    }
    if (projectStatusFilter !== "all") {
      list = list.filter((p) => p.status === projectStatusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    }
    return list;
  }, [projects, projectTypeFilter, projectStatusFilter, searchQuery]);

  // Print Payment Receipt (إيصال قبض)
  const handlePrintReceipt = async (payment: any) => {
    // 1. Fetch allocations for this payment on the fly
    const { data: paymentAllocs } = await supabase
      .from("client_payment_allocations")
      .select("id, payment_id, reference_id, reference_type, amount, phase_id, phase:phase_id(name)")
      .eq("payment_id", payment.id);

    // 2. Fetch referenced purchases/items
    const refIds = paymentAllocs?.map(a => a.reference_id) || [];
    let refPurchases: any[] = [];
    let refItems: any[] = [];

    if (refIds.length > 0) {
      const { data: purData } = await supabase
        .from("purchases")
        .select("id, invoice_number, suppliers:supplier_id(name)")
        .in("id", refIds);
      refPurchases = purData || [];

      const { data: itemData } = await supabase
        .from("project_items")
        .select("id, name")
        .in("id", refIds);
      refItems = itemData || [];
    }

    const clientName = client?.name || "بدون عميل";
    const companyName = companySettings?.company_name || "شركة الفارس الذهبي للدعاية";
    const dateStr = format(new Date(payment.date), "dd/MM/yyyy");

    // Find linked project name if exists
    let matchedProjectName = "رصيد عام للزبون";
    if (payment.project_id) {
      const proj = projects?.find((p) => p.id === payment.project_id);
      if (proj) matchedProjectName = proj.name;
    }

    const borderStyle = `border: 1px solid ${companySettings?.print_table_border_color || "#ccc"};`;

    const contentHtml = `
      <div class="print-area" style="box-shadow: none; margin: 0; padding: 20px; direction: rtl;">
        <!-- Header -->
        <div class="print-report-header" style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 12px;">
          <div class="print-report-company" style="font-size: 20pt; font-weight: bold; color: ${companySettings?.print_section_title_color || '#7A5A10'}; font-family: 'Cairo', sans-serif;">${companyName}</div>
          <div class="print-report-title" style="font-size: 14pt; font-weight: bold; margin-top: 5px; font-family: 'Cairo', sans-serif;">إيصال قبض مالي (Payment Receipt)</div>
          <div class="print-report-meta" style="font-size: 10pt; color: #666; margin-top: 5px; font-family: 'Cairo', sans-serif;">
            رقم الإيصال: ${payment.id.split('-')[0].toUpperCase()} &nbsp;|&nbsp; التاريخ: ${dateStr}
          </div>
        </div>

        <!-- Info Table -->
        <div class="print-section" style="margin-bottom: 20px; font-family: 'Cairo', sans-serif;">
          <table class="print-info-table" style="width: 100%; border-collapse: collapse; margin-top: 10px; ${borderStyle}">
            <tbody>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle} width: 25%;">استلمنا من السيد / السادة</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${clientName}</td>
              </tr>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">وذلك عن مشروع</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${matchedProjectName}</td>
              </tr>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">مبلـغ وقدره</td>
                <td class="info-value" style="padding: 8px; ${borderStyle} font-weight: bold; font-size: 13pt; color: #15803d; font-family: 'Cairo', sans-serif;">${payment.amount.toLocaleString()} د.ل</td>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle} width: 15%;">طريقة الدفع</td>
                <td class="info-value" style="padding: 8px; ${borderStyle} width: 25%;">
                  ${payment.payment_method === 'cash' ? 'نقداً (كاش)' : payment.payment_method === 'cheque' ? 'شيك مصرفي' : 'تحويل بنكي'}
                </td>
              </tr>
              ${payment.notes ? `
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">ملاحظات / البيان</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${payment.notes}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- Allocations table if available -->
        ${(() => {
          if (!paymentAllocs || paymentAllocs.length === 0) return '';
          
          const processedAllocs = paymentAllocs.map(alloc => {
            const purchase = refPurchases?.find(p => p.id === alloc.reference_id);
            const item = refItems?.find(i => i.id === alloc.reference_id);
            const phaseName = alloc.phase?.name || '';
            const desc = alloc.reference_type === 'purchase' 
              ? `شراء: ${purchase?.invoice_number ? `فاتورة رقم ${purchase.invoice_number}` : 'مشتريات'}` 
              : alloc.reference_type === 'rental' 
                ? 'إيجار معدات' 
                : `بند: ${item?.name || 'بند مقاولات'}`;
            
            return {
              desc,
              phaseName,
              amount: Number(alloc.amount)
            };
          });

          return `
          <div class="print-section" style="margin-bottom: 25px; font-family: 'Cairo', sans-serif;">
            <div class="print-section-title" style="font-weight: bold; font-size: 12pt; color: ${companySettings?.print_section_title_color || '#7A5A10'}; border-bottom: 1.5px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 4px; margin-bottom: 8px;">تسوية وتوزيع الدفعة على المستندات:</div>
            <table class="print-table" style="width: 100%; border-collapse: collapse; text-align: right; ${borderStyle}">
              <thead>
                <tr style="background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'};">
                  <th style="padding: 8px; ${borderStyle}">التفاصيل / المستند</th>
                  <th style="padding: 8px; ${borderStyle}">المرحلة</th>
                  <th style="padding: 8px; ${borderStyle} text-align: left;">المبلغ المستقطع</th>
                </tr>
              </thead>
              <tbody>
                ${processedAllocs.map(r => `
                  <tr>
                    <td style="padding: 8px; ${borderStyle}">${r.desc}</td>
                    <td style="padding: 8px; ${borderStyle}">${r.phaseName || "-"}</td>
                    <td style="padding: 8px; ${borderStyle} text-align: left; font-weight: bold; font-family: 'Cairo', sans-serif;">${r.amount.toLocaleString()} د.ل</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          `;
        })()}

        <!-- Signatures -->
        <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; font-family: 'Cairo', sans-serif;">
          <div style="text-align: center; width: 220px;">
            <p style="font-weight: bold; margin-bottom: 50px;">توقيع المستلم</p>
            <p style="border-top: 1px dotted #555; width: 100%;"></p>
          </div>
          <div style="text-align: center; width: 220px;">
            <p style="font-weight: bold; margin-bottom: 50px;">توقيع ومصادقة الجهة</p>
            <p style="border-top: 1px dotted #555; width: 100%;"></p>
          </div>
        </div>
      </div>
    `;

    const windowTitle = `إيصال قبض - رقم ${payment.id.split('-')[0].toUpperCase()} - ${clientName}`;
    
    // Force header settings for plain paper receipt printing
    const printSettings = companySettings ? {
      ...companySettings,
      print_header_enabled: true,
      print_footer_enabled: true,
    } : null;

    openPrintWindow(windowTitle, contentHtml, printSettings);
  };

  // Print Account Statement
  const handlePrintStatement = () => {
    if (!client) return;

    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });

    const headerBg = companySettings?.print_table_header_color || '#B4A078';
    const headerText = companySettings?.print_header_text_color || '#ffffff';
    const titleColor = companySettings?.print_section_title_color || '#7A5A10';
    const borderColor = companySettings?.print_table_border_color || '#d1d5db';
    const borderWidth = 1;
    const borderCss = `border: ${borderWidth}px solid ${borderColor};`;

    const contractingProjects = projects?.filter((p) => p.project_type === "contracting") || [];
    const finishingProjects = projects?.filter((p) => p.project_type === "finishing") || [];

    // Contracting projects HTML
    let contractingBillsHTML = "";
    contractingProjects.forEach((p) => {
      const billAmount = clientFinancials.projectBills[p.id] || 0;
      contractingBillsHTML += `
        <tr>
          <td style="padding: 8px; ${borderCss} font-weight: bold;">${p.name}</td>
          <td style="padding: 8px; ${borderCss} text-align: center;">${statusLabels[p.status] || p.status}</td>
          <td style="padding: 8px; ${borderCss} text-align: center; font-weight: bold; font-family: 'Cairo', sans-serif;">${billAmount.toLocaleString()} د.ل</td>
        </tr>
      `;
    });

    // Finishing projects HTML
    let finishingBillsHTML = "";
    finishingProjects.forEach((p) => {
      const billAmount = clientFinancials.projectBills[p.id] || 0;
      finishingBillsHTML += `
        <tr>
          <td style="padding: 8px; ${borderCss} font-weight: bold;">${p.name}</td>
          <td style="padding: 8px; ${borderCss} text-align: center;">${statusLabels[p.status] || p.status}</td>
          <td style="padding: 8px; ${borderCss} text-align: center; font-weight: bold; font-family: 'Cairo', sans-serif;">${billAmount.toLocaleString()} د.ل</td>
        </tr>
      `;
    });

    // Payments list HTML
    let paymentsHTML = "";
    payments?.forEach((p, idx) => {
      const projName = p.projects?.name ? `${p.projects.name} (${p.projects.project_type === "contracting" ? "مقاولات" : "تشطيب"})` : "رصيد عام للزبون";
      const methodStr = methodLabels[p.payment_method] || (p.payment_method === "cash" ? "نقدي (كاش)" : p.payment_method === "cheque" || p.payment_method === "check" ? "صك مصرفي" : "تحويل بنكي");
      paymentsHTML += `
        <tr>
          <td style="padding: 8px; ${borderCss} text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; ${borderCss} text-align: center;">${format(new Date(p.date), "yyyy/MM/dd")}</td>
          <td style="padding: 8px; ${borderCss} font-weight: bold;">${projName}</td>
          <td style="padding: 8px; ${borderCss} text-align: center; font-weight: bold; color: #15803d; font-family: 'Cairo', sans-serif;">${p.amount.toLocaleString()} د.ل</td>
          <td style="padding: 8px; ${borderCss} text-align: center;">${methodStr}</td>
          <td style="padding: 8px; ${borderCss}">${p.treasuries?.name || "---"}</td>
          <td style="padding: 8px; ${borderCss}">${p.notes || "---"}</td>
        </tr>
      `;
    });

    const contentHtml = `
      <div class="print-area" style="box-shadow: none; margin: 0; padding: 20px; direction: rtl; font-family: 'Cairo', sans-serif;">
        <!-- Title Banner -->
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid ${titleColor}; padding-bottom: 12px;">
          <h2 style="font-size: 18pt; font-weight: bold; color: ${titleColor}; margin: 0; font-family: 'Cairo', sans-serif;">كشف حساب تفصيلي للعميل</h2>
          <div style="font-size: 10pt; color: #666; margin-top: 5px;">تاريخ التقرير: ${dateStr}</div>
        </div>

        <!-- Client Info Block -->
        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; ${borderCss}">
            <tbody>
              <tr>
                <td style="padding: 8px; background-color: ${headerBg}; color: ${headerText}; font-weight: bold; width: 18%; ${borderCss}">اسم العميل</td>
                <td style="padding: 8px; font-weight: bold; ${borderCss}">${client.name}</td>
                <td style="padding: 8px; background-color: ${headerBg}; color: ${headerText}; font-weight: bold; width: 18%; ${borderCss}">رقم الهاتف</td>
                <td style="padding: 8px; ${borderCss}">${client.phone || "---"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; background-color: ${headerBg}; color: ${headerText}; font-weight: bold; ${borderCss}">المدينة / العنوان</td>
                <td style="padding: 8px; ${borderCss}">${client.city || "---"} - ${client.address || "---"}</td>
                <td style="padding: 8px; background-color: ${headerBg}; color: ${headerText}; font-weight: bold; ${borderCss}">البريد الإلكتروني</td>
                <td style="padding: 8px; ${borderCss}">${client.email || "---"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Financial Summary Banner Box -->
        <div style="display: flex; justify-content: space-around; background-color: #fafafa; border: 1.5px solid ${titleColor}; border-radius: 10px; padding: 15px; margin-bottom: 25px;">
          <div style="text-align: center;">
            <div style="font-size: 10pt; color: #555; font-weight: bold;">إجمالي الأعمال والبنود</div>
            <div style="font-size: 14pt; font-weight: 900; color: #1e293b; margin-top: 4px; font-family: 'Cairo', sans-serif;">${clientFinancials.totalBilled.toLocaleString()} د.ل</div>
            <div style="font-size: 8.5pt; color: #64748b; margin-top: 4px;">
              مقاولات: ${clientFinancials.contractingBilled.toLocaleString()} د.ل | تشطيب: ${clientFinancials.finishingBilled.toLocaleString()} د.ل
            </div>
          </div>
          <div style="text-align: center; border-right: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; padding: 0 20px;">
            <div style="font-size: 10pt; color: #555; font-weight: bold;">إجمالي المسدد</div>
            <div style="font-size: 14pt; font-weight: 900; color: #15803d; margin-top: 4px; font-family: 'Cairo', sans-serif;">${clientFinancials.totalPaid.toLocaleString()} د.ل</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10pt; color: #555; font-weight: bold;">القيمة المتبقية المستحقة</div>
            <div style="font-size: 14pt; font-weight: 900; color: ${clientFinancials.remaining > 0 ? "#b91c1c" : "#15803d"}; margin-top: 4px; font-family: 'Cairo', sans-serif;">
              ${clientFinancials.remaining.toLocaleString()} د.ل
            </div>
          </div>
        </div>

        <!-- Contracting Projects Section -->
        <div style="margin-bottom: 25px;">
          <div style="font-weight: bold; font-size: 11pt; color: ${titleColor}; border-bottom: 1.5px solid ${titleColor}; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; flex-direction: row-reverse;">
            <span>إجمالي المطالبات: ${clientFinancials.contractingBilled.toLocaleString()} د.ل</span>
            <span>مشاريع المقاولات (${contractingProjects.length})</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: right; ${borderCss}">
            <thead>
              <tr style="background-color: ${headerBg}; color: ${headerText};">
                <th style="padding: 8px; ${borderCss}">اسم المشروع</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 20%;">حالة المشروع</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 30%;">قيمة الأعمال المنجزة</th>
              </tr>
            </thead>
            <tbody>
              ${contractingBillsHTML || `<tr><td colspan="3" style="padding: 12px; text-align: center; ${borderCss}">لا توجد مشاريع مقاولات مسجلة</td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Finishing Projects Section -->
        <div style="margin-bottom: 25px;">
          <div style="font-weight: bold; font-size: 11pt; color: ${titleColor}; border-bottom: 1.5px solid ${titleColor}; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; flex-direction: row-reverse;">
            <span>إجمالي المطالبات: ${clientFinancials.finishingBilled.toLocaleString()} د.ل</span>
            <span>مشاريع التشطيبات (${finishingProjects.length})</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: right; ${borderCss}">
            <thead>
              <tr style="background-color: ${headerBg}; color: ${headerText};">
                <th style="padding: 8px; ${borderCss}">اسم المشروع</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 20%;">حالة المشروع</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 30%;">قيمة الأعمال المنجزة</th>
              </tr>
            </thead>
            <tbody>
              ${finishingBillsHTML || `<tr><td colspan="3" style="padding: 12px; text-align: center; ${borderCss}">لا توجد مشاريع تشطيب مسجلة</td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Payments Section -->
        <div style="margin-bottom: 25px;">
          <div style="font-weight: bold; font-size: 11pt; color: ${titleColor}; border-bottom: 1.5px solid ${titleColor}; padding-bottom: 4px; margin-bottom: 8px;">
            جدول الدفعات والتسديدات المستلمة (${payments?.length || 0})
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: right; ${borderCss}">
            <thead>
              <tr style="background-color: ${headerBg}; color: ${headerText};">
                <th style="padding: 8px; ${borderCss} text-align: center; width: 5%;">ر.م</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 14%;">تاريخ السداد</th>
                <th style="padding: 8px; ${borderCss} width: 22%;">المشروع</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 18%;">قيمة الدفعة</th>
                <th style="padding: 8px; ${borderCss} text-align: center; width: 15%;">طريقة الدفع</th>
                <th style="padding: 8px; ${borderCss} width: 16%;">الخزينة/الحساب</th>
                <th style="padding: 8px; ${borderCss}">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsHTML || `<tr><td colspan="7" style="padding: 12px; text-align: center; ${borderCss}">لا توجد دفعات مسجلة</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Force header/footer enabled for statement printing
    const printSettings = companySettings ? {
      ...companySettings,
      print_header_enabled: true,
      print_footer_enabled: true,
    } : null;

    openPrintWindow(`كشف حساب - ${client.name}`, contentHtml, printSettings);
  };

  if (clientLoading || projectsLoading || contractsLoading || paymentsLoading || phasesLoading || itemsLoading || purchasesLoading || expensesLoading || techsLoading || creditLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (clientError || projectsError || contractsError || paymentsError || phasesError || itemsError || purchasesError || expensesError || techsError || creditError) {
    return <Card className="space-y-3 p-6" dir="rtl" role="alert">
      <h1 className="font-bold">تعذر تحميل بيانات الحساب كاملة</h1>
      <p className="text-sm text-muted-foreground">لم نعرض أرصدة جزئية. تحقق من الاتصال وتطبيق تحديث قاعدة البيانات ثم أعد المحاولة.</p>
      <Button onClick={() => invalidateFinancialQueries(queryClient)}>إعادة المحاولة</Button>
      <Button asChild variant="outline"><Link to="/clients">العودة للزبائن</Link></Button>
    </Card>;
  }
  if (!client) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-muted-foreground">العميل غير موجود</p>
        <Link to="/clients">
          <Button variant="link">العودة للعملاء</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb & Print */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DeterministicBreadcrumb
          items={[
            { label: "العملاء", href: "/clients" },
            { label: client.name, isCurrent: true },
          ]}
          fallbackBackHref="/clients"
        />
        <div className="flex gap-2">
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 rounded-xl px-5 h-11">
                <Plus className="h-4 w-4" />
                <span>إضافة دفعة أو رصيد مقدم للزبون</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl bg-background p-6 rounded-2xl border border-border shadow-2xl overflow-y-auto max-h-[90vh]" dir="rtl">
              <DialogHeader className="pb-3 border-b border-border/40">
                <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-lg">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <span>تسجيل دفعة أو رصيد مقدم للزبون: {client.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  إدخال الدفعة المالية وتوجيهها للمشروع أو حفظها كرصد دائن عام، مع تحديث الخزينة تلقائياً.
                </DialogDescription>
              </DialogHeader>

              {/* ── Summary Cards Box (المستحقات والمتبقي الحقيقي) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-2">
                {/* الرصيد الدائن المتاح */}
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1">
                  <div className="flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-semibold">
                    <span>رصيد دائن متاح للزبون</span>
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-lg font-black text-blue-700 dark:text-blue-400 font-mono" dir="ltr">
                    {formatCurrencyLYD(clientCredit)}
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-blue-500/15">
                    <span>دفعات وسلف عامة غير مخصصة</span>
                  </div>
                </div>

                {/* العميل ككل */}
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                  <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    <span>المتبقي المستحق على الزبون</span>
                    <Coins className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-400 font-mono" dir="ltr">
                    {formatCurrencyLYD(clientFinancials.remaining)}
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-amber-500/15 flex justify-between">
                    <span>مطالبات: {formatCurrencyLYD(clientFinancials.totalBilled)}</span>
                    <span>مسدد: {formatCurrencyLYD(clientFinancials.totalPaid)}</span>
                  </div>
                </div>

                {/* المشروع المختار (عند اختياره) */}
                <div className={`p-3 rounded-xl border space-y-1 transition-all ${
                  selectedProjectId && selectedProjectId !== "none"
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-muted/30 border-border/40 opacity-70"
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="truncate">
                      {selectedProjectId && selectedProjectId !== "none"
                        ? `متبقي: ${selectedProject?.name || ''}`
                        : "متبقي المشروع"}
                    </span>
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono" dir="ltr">
                    {selectedProjectId && selectedProjectId !== "none"
                      ? formatCurrencyLYD(selectedProjectRemaining)
                      : "حدد مشروعاً"}
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-emerald-500/15 flex justify-between">
                    {selectedProjectId && selectedProjectId !== "none" ? (
                      <>
                        <span>أعمال: {formatCurrencyLYD(selectedProjectBill)}</span>
                        <span>مسدد: {formatCurrencyLYD(selectedProjectPaid)}</span>
                      </>
                    ) : (
                      <span>اختر المشروع لعرض تفاصيله</span>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddPaymentSubmit} className="space-y-4 pt-1">
                {/* 1. قيمة الدفعة الحالية + حاسبة المتبقي الحيّة */}
                <div className="space-y-2 p-4 rounded-xl bg-card border border-border/60 shadow-sm">
                  <Label htmlFor="pay-amount" className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    <span>قيمة الدفعة المستلمة (د.ل) *</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="pay-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={paymentAmount}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
                          .replace(/,/g, "");
                        setPaymentAmount(val);
                      }}
                      placeholder="0.00"
                      className="h-14 text-2xl font-black text-center rounded-xl border-emerald-500/30 focus:border-emerald-600 bg-background"
                      dir="ltr"
                    />
                    {Number(paymentAmount) > 0 && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">د.ل</span>
                    )}
                  </div>

                  {/* المؤشر والتأثير الحي لمبلغ الدفعة على المتبقي */}
                  {Number(paymentAmount) > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-bold">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Receipt className="h-3.5 w-3.5 text-primary" />
                            <span>{selectedProjectId === "none" ? "المتبقي المستحق (لا يتغير قبل تطبيق الرصيد):" : "المتبقي المستحق الجديد للزبون بعد السداد:"}</span>
                        </span>
                        <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                          {formatCurrencyLYD(
                            selectedProjectId === "none"
                              ? clientFinancials.remaining
                              : Math.max(0, clientFinancials.remaining - Number(paymentAmount))
                          )}
                        </span>
                      </div>

                      {selectedProjectId && selectedProjectId !== "none" && (
                        <div className="flex items-center justify-between font-bold pt-1 border-t border-border/40">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-blue-600" />
                            <span>المتبقي الجديد لمشروع ({selectedProject?.name}):</span>
                          </span>
                          <span className="text-sm font-extrabold font-mono text-blue-700 dark:text-blue-400">
                            {formatCurrencyLYD(Math.max(0, selectedProjectRemaining - Number(paymentAmount)))}
                          </span>
                        </div>
                      )}

                      <div className="pt-1 flex items-center gap-1 text-[11px]">
                        {selectedProjectId === "none" ? (
                          <Badge variant="outline" className="border-blue-500/40 text-blue-700 bg-blue-500/10 gap-1">
                            <Wallet className="h-3 w-3" />
                            <span>ستُحفظ الدفعة كرصد دائن عام للزبون ويمكن استخدامها لاحقاً</span>
                          </Badge>
                        ) : Number(paymentAmount) > (selectedProjectId ? selectedProjectRemaining : clientFinancials.remaining) && (selectedProjectId ? selectedProjectRemaining > 0 : clientFinancials.remaining > 0) ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700 bg-amber-500/10 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>يوجد رصيد فائض بقيمة {formatCurrencyLYD(Number(paymentAmount) - (selectedProjectId && selectedProjectId !== "none" ? selectedProjectRemaining : clientFinancials.remaining))} سيُحسب لصالح رصيد العميل العام</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 bg-emerald-500/10 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>الدفعة تخفض الدين المستحق بنجاح</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. اختيار المشروع المستهدف (قائمة واحدة منظمة بأسماء المشاريع والمتبقي) */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>المشروع المستهدف بالسداد *</span>
                  </Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(val) => setSelectedProjectId(val)}
                    dir="rtl"
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/80 text-sm font-medium">
                      <SelectValue placeholder="اختر المشروع المستهدف..." />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="none" className="font-semibold">
                        بدون مشروع محدد (تسديد عام لحساب الزبون)
                      </SelectItem>

                      {contractingProjectsForSelect.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-amber-700 dark:text-amber-400 font-extrabold text-xs px-2 py-1 bg-amber-500/10 rounded my-1">
                            مشاريع المقاولات ({contractingProjectsForSelect.length})
                          </SelectLabel>
                          {contractingProjectsForSelect.map((p) => {
                            const rem = clientFinancials.projectRemainders[p.id] || 0;
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-bold">{p.name}</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    (متبقي: {rem > 0 ? `${formatCurrencyLYD(rem)}` : "مسدد بالكامل"})
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}

                      {finishingProjectsForSelect.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="text-blue-700 dark:text-blue-400 font-extrabold text-xs px-2 py-1 bg-blue-500/10 rounded my-1">
                            مشاريع التشطيبات ({finishingProjectsForSelect.length})
                          </SelectLabel>
                          {finishingProjectsForSelect.map((p) => {
                            const rem = clientFinancials.projectRemainders[p.id] || 0;
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span className="font-bold">{p.name}</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    (متبقي: {rem > 0 ? `${formatCurrencyLYD(rem)}` : "مسدد بالكامل"})
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedProjectId === "none" && (
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      لا توجد مطالبة مرتبطة بمشروع؛ سيتم حفظ كامل المبلغ كرصد دائن للزبون.
                    </p>
                  )}
                </div>

                {/* 3. تاريخ السداد وطريقة الدفع */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="pay-date" className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>تاريخ القبض والسداد *</span>
                    </Label>
                    <Input
                      id="pay-date"
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="h-10 rounded-xl"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>طريقة الدفع *</span>
                    </Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(val) => setPaymentMethod(val)}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="cash">نقداً (كاش)</SelectItem>
                        <SelectItem value="cheque">صك مصرفي</SelectItem>
                        <SelectItem value="transfer">تحويل بنكي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 4. القسم والخزينة الفرعية المستلمة */}
                <HierarchicalTreasurySelect
                  value={selectedTreasuryId}
                  onValueChange={setSelectedTreasuryId}
                  treasuries={treasuries || []}
                  selectedParentId={selectedParentTreasuryId}
                  onParentChange={setSelectedParentTreasuryId}
                  parentLabel="القسم / الخزينة الرئيسية *"
                  childLabel="الحساب / الفرع المستلم *"
                  required
                />

                {/* 5. ملاحظات */}
                <div className="space-y-2">
                  <Label htmlFor="pay-notes" className="text-xs font-semibold">ملاحظات / البيان</Label>
                  <Textarea
                    id="pay-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب أي ملاحظات على الدفعة أو رقم الصك..."
                    rows={2}
                    className="rounded-xl text-xs"
                  />
                </div>

                {/* أزرار الإجراءات */}
                <div className="flex gap-3 pt-3 border-t border-border/40">
                  <Button
                    type="submit"
                    className="flex-1 h-11 text-sm font-extrabold cursor-pointer rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md shadow-emerald-600/20"
                    disabled={addPaymentMutation.isPending || Number(paymentAmount) <= 0 || !selectedTreasuryId}
                  >
                    {addPaymentMutation.isPending ? (
                      "جاري الحفظ..."
                    ) : (
                      <>
                        <Wallet className="h-4 w-4" />
                        <span>تسجيل الدفعة والإضافة للخزينة</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPaymentDialogOpen(false)}
                    className="cursor-pointer h-11 rounded-xl px-5"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={handlePrintStatement} className="gap-2 cursor-pointer font-bold" variant="outline">
            <Printer className="h-4 w-4" />
            <span>طباعة كشف حساب تفصيلي</span>
          </Button>
        </div>
      </div>

      {/* Golden Hero Header */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-l from-primary/5 via-background to-card p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {client.name}
                </h1>
                <Badge
                  variant="outline"
                  className="text-[11px] font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 gap-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>نشط</span>
                </Badge>
                <Badge variant="secondary" className="text-[11px] font-bold bg-muted/60">
                  <span>حساب زبون</span>
                </Badge>
                {client.city && (
                  <Badge variant="outline" className="text-[11px] font-medium border-border/70 gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{client.city}{client.address ? ` - ${client.address}` : ""}</span>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                  onClick={openEditClientModal}
                  title="تعديل بيانات العميل"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Contact details & Notes */}
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {client.phone ? (
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-lg border border-border/50">
                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${client.phone}`}
                      className="font-mono text-foreground hover:text-primary transition-colors text-xs"
                      dir="ltr"
                    >
                      {client.phone}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => copyPhone(client.phone!)}
                      title="نسخ رقم الهاتف"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">لا يوجد رقم هاتف مسجل</span>
                )}

                {client.email && (
                  <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-lg border border-border/50">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={`mailto:${client.email}`} className="text-foreground hover:text-primary transition-colors text-xs" dir="ltr">
                      {client.email}
                    </a>
                  </div>
                )}

                {client.notes && (
                  <span className="text-xs text-muted-foreground/80 line-clamp-1 max-w-md">
                    ملاحظات: {client.notes}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Balance Status Chip */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {clientCredit > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border shadow-2xs border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200">
                <div className="p-1.5 rounded-lg bg-background/80 shadow-2xs shrink-0">
                  <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block">
                    رصيد دائن متاح (مقدم)
                  </span>
                  <span className="text-base font-black font-mono tracking-tight text-blue-700 dark:text-blue-300" dir="ltr">
                    {formatCurrencyLYD(clientCredit)}
                  </span>
                </div>
              </div>
            )}
            <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-2xs ${
              clientFinancials.remaining > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            }`}>
              <div className="p-1.5 rounded-lg bg-background/80 shadow-2xs shrink-0">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">
                  {clientFinancials.remaining > 0 ? "صافي المستحق على الزبون" : "الحساب مسدد بالكامل"}
                </span>
                <span className="text-base font-black font-mono tracking-tight" dir="ltr">
                  {formatCurrencyLYD(clientFinancials.remaining)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                setSelectedProjectId("none");
                setPaymentDialogOpen(true);
              }}
              className="h-9 cursor-pointer gap-2 font-bold shadow-2xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Wallet className="h-4 w-4" />
              <span>تسجيل دفعة / قبض</span>
            </Button>

            <Button
              variant="outline"
              onClick={handlePrintStatement}
              className="h-9 cursor-pointer gap-2 border-border/80 font-bold bg-card hover:bg-muted"
            >
              <Printer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>كشف الحساب</span>
            </Button>

            <Button
              variant="outline"
              asChild
              className="h-9 cursor-pointer gap-2 border-border/80 font-bold bg-card hover:bg-muted"
            >
              <Link to="/projects/new">
                <Plus className="h-4 w-4 text-primary" />
                <span>مشروع جديد</span>
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>المشاريع المسجلة:</span>
            <Badge variant="outline" className="font-mono font-bold text-xs">
              {projects?.length || 0}
            </Badge>
          </div>
        </div>
      </div>

      {/* 4-Card Golden KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Billed Works */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي قيمة الأعمال والمطالبات</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-foreground font-mono" dir="ltr">
              {formatCurrencyLYD(clientFinancials.totalBilled)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مقاولات: {formatCurrencyLYD(clientFinancials.contractingBilled)}</span>
            <span>تشطيب: {formatCurrencyLYD(clientFinancials.finishingBilled)}</span>
          </div>
        </Card>

        {/* Card 2: Received Payments */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-emerald-500/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي المقبوضات المسددة</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono" dir="ltr">
              {formatCurrencyLYD(paymentsSummary.totalPaid)}
            </span>
            <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
              {paymentsSummary.count} دفعة
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مسدد للمشاريع: {formatCurrencyLYD(clientFinancials.totalPaid)}</span>
            <span>كاش: {formatCurrencyLYD(paymentsSummary.cashPaid)}</span>
          </div>
        </Card>

        {/* Card 3: Net Due */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-amber-500/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">صافي الرصيد المستحق (المتبقي)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono" dir="ltr">
              {formatCurrencyLYD(clientFinancials.remaining)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>متبقي المقاولات: {formatCurrencyLYD(clientFinancials.contractingRemaining)}</span>
            <span>التشطيبات: {formatCurrencyLYD(clientFinancials.finishingRemaining)}</span>
          </div>
        </Card>

        {/* Card 4: Available Credit / Advance */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card hover:border-blue-500/40 transition-all shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الرصيد المتاح على الحساب</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono" dir="ltr">
              {formatCurrencyLYD(clientCredit)}
            </span>
            <Badge variant="outline" className="text-[10px] font-bold border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/10">
              رصيد دائن
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>دفعات عامة غير مخصصة</span>
            <span>{projects?.length || 0} مشاريع مؤهلة</span>
          </div>
        </Card>
      </div>

      {/* Main Interactive Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4" dir="rtl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-card border border-border/80 p-1 rounded-xl shadow-2xs h-11 flex-wrap">
            <TabsTrigger
              value="projects"
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <FolderOpen className="h-4 w-4 text-primary" />
              <span>المشاريع والتعاقدات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {projects?.length || 0}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="payments"
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>سندات القبض والدفعات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {payments?.length || 0}
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
              value="credit"
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>الرصيد الدائن والتسويات</span>
              {clientCredit > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-blue-500/10 text-blue-700">
                  {formatCurrencyLYD(clientCredit)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Filters for Projects Tab */}
          {activeTab === "projects" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Sector Filter */}
              <Select value={projectTypeFilter} onValueChange={(val: any) => setProjectTypeFilter(val)} dir="rtl">
                <SelectTrigger className="h-9 w-32 text-xs rounded-xl bg-card border-border/80">
                  <SelectValue placeholder="القطاع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all" className="text-xs font-bold">كافة القطاعات</SelectItem>
                  <SelectItem value="contracting" className="text-xs">مقاولات</SelectItem>
                  <SelectItem value="finishing" className="text-xs">تشطيبات</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={projectStatusFilter} onValueChange={(val: any) => setProjectStatusFilter(val)} dir="rtl">
                <SelectTrigger className="h-9 w-32 text-xs rounded-xl bg-card border-border/80">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all" className="text-xs font-bold">كافة الحالات</SelectItem>
                  <SelectItem value="active" className="text-xs">نشط</SelectItem>
                  <SelectItem value="completed" className="text-xs">مكتمل</SelectItem>
                  <SelectItem value="pending" className="text-xs">قيد الانتظار</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-xl border border-border/80 bg-card p-0.5 shadow-2xs">
                <Button
                  variant={projectsViewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                  onClick={() => setProjectsViewMode("cards")}
                  title="عرض بطاقات المشاريع"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">بطاقات</span>
                </Button>
                <Button
                  variant={projectsViewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                  onClick={() => setProjectsViewMode("table")}
                  title="عرض كجدول ERP موحد"
                >
                  <TableProperties className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">جدول ERP</span>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-48">
                <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="بحث باسم المشروع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 h-9 text-xs rounded-xl bg-card border-border/80"
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: PROJECTS & CONTRACTS */}
        <TabsContent value="projects" className="space-y-4 mt-1">
          {filteredProjects.length === 0 ? (
            <Card className="p-10 text-center rounded-2xl border-dashed border-border/80 bg-card">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-base font-bold text-foreground">لا توجد مشاريع مطابقة للبحث أو الفلتر</h4>
              <p className="text-xs text-muted-foreground mt-1 font-medium max-w-md mx-auto">
                لم يتم العثور على مشاريع لهذا العميل بالمعايير المحددة. يمكنك إضافة مشروع جديد أو تغيير شروط التصفية.
              </p>
            </Card>
          ) : projectsViewMode === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
              {filteredProjects.map((project) => {
                const billAmount = clientFinancials.projectBills[project.id] || 0;
                const remainder = clientFinancials.projectRemainders[project.id] || 0;
                const paidAmount = Math.max(0, billAmount - remainder);
                const isContracting = project.project_type === "contracting";

                return (
                  <div
                    key={project.id}
                    className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/50 transition-all flex flex-col justify-between shadow-2xs space-y-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                          <span>{project.name}</span>
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 font-bold ${
                              isContracting
                                ? "border-amber-500/30 text-amber-700 bg-amber-500/10"
                                : "border-blue-500/30 text-blue-700 bg-blue-500/10"
                            }`}
                          >
                            {isContracting ? "مقاولات" : "تشطيبات"}
                          </Badge>
                          <Badge className={`text-[10px] ${statusColors[project.status] || ""}`}>
                            {statusLabels[project.status] || project.status}
                          </Badge>
                        </div>
                      </div>

                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {/* 3-column stats */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-center">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">الميزانية</span>
                          <span className="font-mono font-bold text-xs" dir="ltr">
                            {Number(project.budget) > 0 ? formatCurrencyLYD(project.budget) : "---"}
                          </span>
                        </div>
                        <div className="border-r border-border/50 pr-2">
                          <span className="text-[10px] text-muted-foreground block">قيمة الأعمال</span>
                          <span className="font-mono font-bold text-xs text-foreground" dir="ltr">
                            {formatCurrencyLYD(billAmount)}
                          </span>
                        </div>
                        <div className="border-r border-border/50 pr-2">
                          <span className="text-[10px] text-muted-foreground block">المتبقي</span>
                          <span className={`font-mono font-black text-xs ${remainder > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"}`} dir="ltr">
                            {formatCurrencyLYD(remainder)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-bold gap-1 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setPaymentDialogOpen(true);
                        }}
                      >
                        <Wallet className="h-3 w-3" />
                        <span>سداد للمشروع</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="h-7 px-2.5 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Link to={`/projects/${project.id}`}>
                          <span>عرض المشروع</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-right text-xs font-bold">المشروع</TableHead>
                    <TableHead className="text-right text-xs font-bold">القطاع</TableHead>
                    <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                    <TableHead className="text-center text-xs font-bold">الميزانية</TableHead>
                    <TableHead className="text-center text-xs font-bold">قيمة الأعمال</TableHead>
                    <TableHead className="text-center text-xs font-bold">المسدد</TableHead>
                    <TableHead className="text-center text-xs font-bold">المتبقي</TableHead>
                    <TableHead className="text-left text-xs font-bold">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => {
                    const billAmount = clientFinancials.projectBills[project.id] || 0;
                    const remainder = clientFinancials.projectRemainders[project.id] || 0;
                    const paidAmount = Math.max(0, billAmount - remainder);
                    const isContracting = project.project_type === "contracting";

                    return (
                      <TableRow key={project.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-bold text-xs">
                          <Link to={`/projects/${project.id}`} className="hover:text-primary transition-colors flex items-center gap-1.5">
                            <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{project.name}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              isContracting
                                ? "border-amber-500/30 text-amber-700 bg-amber-500/10"
                                : "border-blue-500/30 text-blue-700 bg-blue-500/10"
                            }`}
                          >
                            {isContracting ? "مقاولات" : "تشطيبات"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[project.status] || ""}`}>
                            {statusLabels[project.status] || project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs" dir="ltr">
                          {Number(project.budget) > 0 ? formatCurrencyLYD(project.budget) : "---"}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-xs text-foreground" dir="ltr">
                          {formatCurrencyLYD(billAmount)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-emerald-600" dir="ltr">
                          {formatCurrencyLYD(paidAmount)}
                        </TableCell>
                        <TableCell className="text-center font-mono font-black text-xs text-amber-700 dark:text-amber-400" dir="ltr">
                          {formatCurrencyLYD(remainder)}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs font-bold gap-1 border-primary/30 text-primary cursor-pointer"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <Wallet className="h-3 w-3" />
                              <span>سداد</span>
                            </Button>
                            <Button size="sm" variant="ghost" asChild className="h-7 w-7 p-0 cursor-pointer">
                              <Link to={`/projects/${project.id}`}>
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Contracts Subcard if any */}
          {contracts && contracts.length > 0 && (
            <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs mt-4">
              <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-bold">عقود واتفاقيات العميل ({contracts.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="text-right text-xs">العقد</TableHead>
                      <TableHead className="text-right text-xs">رقم العقد</TableHead>
                      <TableHead className="text-right text-xs">الحالة</TableHead>
                      <TableHead className="text-center text-xs">القيمة التعاقدية</TableHead>
                      <TableHead className="text-right text-xs">تاريخ البداية</TableHead>
                      <TableHead className="text-left text-xs w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-bold text-xs">{contract.title}</TableCell>
                        <TableCell className="text-xs font-mono">{contract.contract_number}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[contract.status] || ""}`}>
                            {statusLabels[contract.status] || contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-xs" dir="ltr">
                          {formatCurrencyLYD(contract.amount)}
                        </TableCell>
                        <TableCell className="text-xs">{contract.start_date}</TableCell>
                        <TableCell className="text-left">
                          <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs cursor-pointer">
                            <Link to={`/contracts/${contract.id}`}>
                              <span>عرض</span>
                              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: PAYMENTS (سندات القبض والدفعات) */}
        <TabsContent value="payments" className="space-y-4 mt-1">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">إجمالي المقبوضات</span>
              <span className="font-black text-sm text-emerald-600 font-mono" dir="ltr">
                {formatCurrencyLYD(paymentsSummary.totalPaid)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">توزيع المقبوضات حسب القطاع</span>
              <span className="font-semibold text-foreground font-mono text-[11px]">
                مقاولات: {paymentsSummary.contractingPaid.toLocaleString()} | تشطيب: {paymentsSummary.finishingPaid.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">وسيلة القبض كاش vs بنكي</span>
              <span className="font-semibold text-foreground font-mono text-[11px]">
                كاش: {paymentsSummary.cashPaid.toLocaleString()} | بنكي: {paymentsSummary.bankPaid.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">إجمالي عدد السندات</span>
              <span className="font-bold text-foreground font-mono">{paymentsSummary.count} سند قبض</span>
            </div>
          </div>

          {payments && payments.length > 0 ? (
            <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-2xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-right text-xs font-bold w-[60px]">#</TableHead>
                    <TableHead className="text-right text-xs font-bold">تاريخ السداد</TableHead>
                    <TableHead className="text-right text-xs font-bold">المشروع</TableHead>
                    <TableHead className="text-center text-xs font-bold">قيمة الدفعة</TableHead>
                    <TableHead className="text-right text-xs font-bold">طريقة القبض</TableHead>
                    <TableHead className="text-right text-xs font-bold">الخزينة المستلمة</TableHead>
                    <TableHead className="text-right text-xs font-bold">ملاحظات / البيان</TableHead>
                    <TableHead className="text-left text-xs font-bold w-[80px]">طباعة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment, idx) => (
                    <TableRow key={payment.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-xs flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{format(new Date(payment.date), "yyyy/MM/dd")}</span>
                      </TableCell>
                      <TableCell>
                        {payment.projects ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              payment.projects.project_type === "contracting"
                                ? "border-amber-500/30 text-amber-700 bg-amber-500/10"
                                : "border-blue-500/30 text-blue-700 bg-blue-500/10"
                            }`}
                          >
                            {payment.projects.name} ({payment.projects.project_type === "contracting" ? "مقاولات" : "تشطيب"})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-muted/80">
                            رصيد عام للزبون
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs" dir="ltr">
                        {formatCurrencyLYD(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {methodLabels[payment.payment_method] || payment.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {payment.treasuries?.name || "---"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {payment.notes || "---"}
                      </TableCell>
                      <TableCell className="text-left">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 cursor-pointer text-primary hover:text-primary/80"
                          onClick={() => handlePrintReceipt(payment)}
                          title="طباعة إيصال القبض"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card className="p-10 text-center rounded-2xl border-dashed border-border/80 bg-card">
              <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-base font-bold text-foreground">لم يتم تسجيل أي دفعات مستلمة</h4>
              <p className="text-xs text-muted-foreground mt-1 font-medium max-w-md mx-auto">
                يمكنك تسجيل دفعات وسندات قبض جديدة بالنقر على زر "تسجيل دفعة / قبض" أعلاه.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: CHRONOLOGICAL STATEMENT */}
        <TabsContent value="statement" className="space-y-4 mt-1">
          <div className="flex items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/80">
            <div>
              <h4 className="text-xs font-bold text-foreground">كشف الحساب التراكمي للعميل</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                تتبع كرونولوجي زمني دقيق لكافة المطالبات والمقبوضات مع الرصيد اللحظي التراكمي
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintStatement}
              className="h-8 text-xs font-bold gap-1.5 border-border/80 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-amber-600" />
              <span>طباعة الكشف</span>
            </Button>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-x-auto shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-right text-xs font-bold w-[60px]">#</TableHead>
                  <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                  <TableHead className="text-right text-xs font-bold">النوع</TableHead>
                  <TableHead className="text-right text-xs font-bold">البيان / المشروع</TableHead>
                  <TableHead className="text-center text-xs font-bold text-amber-700">مدين (مطالبات)</TableHead>
                  <TableHead className="text-center text-xs font-bold text-emerald-600">دائن (مقبوضات)</TableHead>
                  <TableHead className="text-center text-xs font-bold">الرصيد التراكمي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chronologicalStatement.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      لا توجد حركات مسجلة لهذا العميل
                    </TableCell>
                  </TableRow>
                ) : (
                  chronologicalStatement.map((row, idx) => (
                    <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(row.date), "yyyy/MM/dd")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            row.type === "bill"
                              ? "border-amber-500/30 text-amber-700 bg-amber-500/10"
                              : "border-emerald-500/30 text-emerald-700 bg-emerald-500/10"
                          }`}
                        >
                          {row.type === "bill" ? "مطالبة منجز" : "سند قبض"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-xs text-amber-700 dark:text-amber-400" dir="ltr">
                        {row.debit > 0 ? formatCurrencyLYD(row.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {row.credit > 0 ? formatCurrencyLYD(row.credit) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono font-black text-xs text-foreground" dir="ltr">
                        {formatCurrencyLYD(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 4: CLIENT CREDIT (الرصيد الدائن والتسويات) */}
        <TabsContent value="credit" className="space-y-4 mt-1">
          <ClientCreditPanel
            clientId={id!}
            projects={(projects || []).map((p) => ({
              id: p.id,
              name: p.name,
              remaining: clientFinancials.projectRemainders[p.id] || 0,
            }))}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Edit Client Profile Dialog */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="max-w-md bg-background p-6 rounded-2xl border border-border shadow-2xl" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-base">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Pencil className="h-4 w-4" />
              </div>
              <span>تعديل بيانات العميل</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              قم بتحديث معلومات الاتصال والعنوان لهذا العميل ثم اضغط حفظ
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateClientMutation.mutate();
            }}
            className="space-y-3.5 mt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم العميل *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">رقم الهاتف</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  placeholder="09..."
                  className="h-9 text-xs rounded-xl font-mono text-right"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">المدينة</Label>
                <Input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="طرابلس، مصراتة..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">البريد الإلكتروني</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                dir="ltr"
                placeholder="client@example.com"
                className="h-9 text-xs rounded-xl text-right"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">العنوان التفصيلي</Label>
              <Input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="الشارع، الحي، المعلم القريب..."
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">ملاحظات إضافية</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="أي شروط أو تفاصيل تعاقدية خاصة بالعميل..."
                className="text-xs rounded-xl min-h-[70px]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditClientOpen(false)}
                className="h-9 text-xs rounded-xl cursor-pointer"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={updateClientMutation.isPending || !editName.trim()}
                className="h-9 text-xs rounded-xl font-bold bg-primary text-primary-foreground cursor-pointer"
              >
                {updateClientMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}