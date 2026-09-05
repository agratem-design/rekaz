import React, { useState, useMemo, useEffect } from "react";
import { useOperationKey } from "@/hooks/useOperationKey";
import { invalidateFinancialQueries } from "@/lib/financialMutations";
import { SupplierAdvancePanel } from "@/components/suppliers/SupplierAdvancePanel";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeterministicBreadcrumb } from "@/components/navigation/DeterministicBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Building2, User, Phone, Mail, MapPin, Truck, ShoppingCart, 
  Receipt, Wallet, Printer, Search, ArrowRight, ChevronDown, ChevronUp,
  Layers, CheckCircle2, AlertCircle, FileText, Sparkles, Plus, Eye,
  TableProperties, LayoutGrid, Copy, Check, Pencil, RotateCcw, ExternalLink
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openReceiptPrintWindow, openPrintWindow } from "@/lib/printStyles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ProjectGroup {
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientId: string;
  clientName: string;
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  purchases: any[];
  payments: any[];
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  totalDue: number;
  projects: ProjectGroup[];
}

export default function SupplierDetail() {
  const { id, projectId } = useParams<{ id: string; projectId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const canManagePayments = role === "admin" || role === "accountant";
  const paymentOperation = useOperationKey();

  // Active Tab: projects (المشاريع والزبائن) | payments | statement | advances
  const [activeTab, setActiveTab] = useState<"projects" | "payments" | "statement" | "advances">("projects");

  // View mode for invoices: "grouped" vs "table"
  const [invoicesViewMode, setInvoicesViewMode] = useState<"grouped" | "table">("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [projectTypeFilter, setProjectTypeFilter] = useState<"all" | "contracting" | "finishing">("all");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedProjectInvoices, setExpandedProjectInvoices] = useState<Record<string, boolean>>({});
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Edit Supplier Profile State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileCategory, setEditProfileCategory] = useState("");
  const [editProfileAddress, setEditProfileAddress] = useState("");
  const [editProfileNotes, setEditProfileNotes] = useState("");

  // On-Account Payment States
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payTreasuryId, setPayTreasuryId] = useState("");
  const [payPaymentMethod, setPayPaymentMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Auto expand project if projectId route param is present
  useEffect(() => {
    if (projectId) {
      setExpandedProjectInvoices((prev) => ({ ...prev, [projectId]: true }));
    }
  }, [projectId]);

  // Fetch active treasuries for payment with category domain
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

  // Fetch supplier base data
  const { data: supplier, isLoading: loadingSupplier, error: supplierError } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Populate edit fields
  useEffect(() => {
    if (supplier) {
      setEditProfileName(supplier.name || "");
      setEditProfilePhone(supplier.phone || "");
      setEditProfileCategory(supplier.category || "");
      setEditProfileAddress(supplier.address || "");
      setEditProfileNotes(supplier.notes || "");
    }
  }, [supplier]);

  // Fetch all purchases for this supplier with project & client data
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["supplier-purchases-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          id,
          invoice_number,
          title,
          date,
          created_at,
          total_amount,
          paid_amount,
          status,
          notes,
          project_id,
          projects (
            id,
            name,
            project_type,
            client_id,
            clients (
              id,
              name
            )
          )
        `)
        .eq("supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch on-account supplier payment headers
  const { data: supplierPayments = [], isLoading: loadingSupplierPayments } = useQuery({
    queryKey: ["supplier-direct-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payments")
        .select(`
          id,
          amount,
          date,
          created_at,
          payment_method,
          reference,
          notes,
          treasuries (
            id,
            name,
            treasury_type,
            project_category
          )
        `)
        .eq("supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Allocation rows distinguish supplier advances
  const { data: supplierPaymentAllocations = [] } = useQuery({
    queryKey: ["supplier-payment-allocations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payment_allocations")
        .select("payment_id, purchase_id, amount, supplier_payments!inner(supplier_id)")
        .eq("supplier_payments.supplier_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch standalone purchase payments for this supplier's purchases
  const { data: directPurchasePayments = [], isLoading: loadingDirectPayments } = useQuery({
    queryKey: ["supplier-purchase-payments-list", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_payments")
        .select(`
          id,
          purchase_id,
          amount,
          date,
          created_at,
          payment_method,
          notes,
          treasuries (
            id,
            name,
            treasury_type,
            project_category
          ),
          purchases!inner (
            id,
            supplier_id,
            invoice_number,
            title,
            project_id,
            projects (
              id,
              name,
              project_type,
              client_id,
              clients (
                id,
                name
              )
            )
          )
        `)
        .eq("purchases.supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Company settings for receipt printing
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

  // Compute Client -> Project Hierarchy & Global Authoritative Balances
  const { clientGroups, globalPurchases, globalPaid, globalDue, signedBalance, unallocatedAdvance } = useMemo(() => {
    let gPurchases = 0;
    const projectMap = new Map<string, ProjectGroup>();

    purchases.forEach((p: any) => {
      const pAmt = Number(p.total_amount || 0);
      gPurchases += pAmt;

      const projId = p.project_id || "unassigned";
      const projName = p.projects?.name || "مشتريات عامة بدون مشروع";
      const projType = (p.projects?.project_type || "contracting") as "contracting" | "finishing";
      const cliId = p.projects?.clients?.id || "unassigned";
      const cliName = p.projects?.clients?.name || "بدون زبون محدد";

      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          projectId: projId,
          projectName: projName,
          projectType: projType,
          clientId: cliId,
          clientName: cliName,
          totalPurchases: 0,
          totalPaid: 0,
          totalDue: 0,
          purchases: [],
          payments: [],
        });
      }

      const group = projectMap.get(projId)!;
      group.totalPurchases += pAmt;
      group.totalPaid += Number(p.paid_amount || 0);
      group.purchases.push(p);
    });

    directPurchasePayments.forEach((pay: any) => {
      const projId = pay.purchases?.project_id || "unassigned";
      if (projectMap.has(projId)) {
        const group = projectMap.get(projId)!;
        group.payments.push(pay);
      }
    });

    projectMap.forEach((grp) => {
      grp.totalDue = Math.max(0, grp.totalPurchases - grp.totalPaid);
    });

    const clientMap = new Map<string, ClientGroup>();
    projectMap.forEach((projGrp) => {
      const cId = projGrp.clientId;
      if (!clientMap.has(cId)) {
        clientMap.set(cId, {
          clientId: cId,
          clientName: projGrp.clientName,
          totalDue: 0,
          projects: [],
        });
      }
      const cGrp = clientMap.get(cId)!;
      cGrp.projects.push(projGrp);
      cGrp.totalDue += projGrp.totalDue;
    });

    const sPaid = supplierPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const dPaid = directPurchasePayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const gPaid = sPaid + dPaid;
    const allocated = supplierPaymentAllocations.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const gDue = Math.max(0, gPurchases - allocated - dPaid);
    const signedBal = gPurchases - gPaid;
    const advanceAvailable = Math.max(0, sPaid - allocated);

    return {
      clientGroups: Array.from(clientMap.values()),
      globalPurchases: gPurchases,
      globalPaid: gPaid,
      globalDue: gDue,
      signedBalance: signedBal,
      unallocatedAdvance: advanceAvailable,
    };
  }, [purchases, supplierPayments, supplierPaymentAllocations, directPurchasePayments]);

  const supplierBalanceInfo = useMemo(() => {
    if (signedBalance < 0) {
      return {
        label: "رصيد مقدم للمورد (دائن)",
        amount: Math.abs(signedBalance),
        color: "text-blue-700 dark:text-blue-400",
        badgeBg: "bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-300",
        statusText: "دفعة مقدمة محفوظة لحساب المورد وتُسوّى مع الفواتير",
      };
    }
    if (signedBalance === 0) {
      return {
        label: "الحساب متوازن بالكامل",
        amount: 0,
        color: "text-emerald-700 dark:text-emerald-400",
        badgeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
        statusText: "كافة الفواتير مسددة بالكامل",
      };
    }
    return {
      label: "المستحق للمورد (مدين للمؤسسة)",
      amount: signedBalance,
      color: "text-amber-700 dark:text-amber-400",
      badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300",
      statusText: "صافي الرصيد المستحق في ذمة المؤسسة",
    };
  }, [signedBalance]);

  // Selected Treasury Domain Dues calculation
  const selectedTreasury = useMemo(() => {
    return treasuriesList.find((t: any) => t.id === payTreasuryId) || null;
  }, [treasuriesList, payTreasuryId]);

  const selectedTreasuryDomain = useMemo(() => {
    if (!selectedTreasury) return null;
    if (selectedTreasury.project_category) return selectedTreasury.project_category;
    if (selectedTreasury.name?.includes("تشطيب")) return "finishing";
    if (selectedTreasury.name?.includes("مقاولات")) return "contracting";
    return null;
  }, [selectedTreasury]);

  const treasuryEligibleDue = useMemo(() => {
    if (!selectedTreasuryDomain) {
      return globalDue;
    }
    const domainPurchases = purchases.filter((p: any) => p.projects?.project_type === selectedTreasuryDomain);
    const totalDomainInvoices = domainPurchases.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);
    const totalDomainPaid = domainPurchases.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);
    return Math.max(0, totalDomainInvoices - totalDomainPaid);
  }, [selectedTreasuryDomain, purchases, globalDue]);

  const handleOpenPayModal = () => {
    if (treasuriesList.length > 0 && !payTreasuryId) {
      setPayTreasuryId(treasuriesList[0].id);
    }
    if (globalDue > 0) {
      setPayAmount(globalDue.toString());
    } else {
      setPayAmount("");
    }
    setIsPayModalOpen(true);
  };

  const handleTreasuryChange = (newTreasuryId: string) => {
    setPayTreasuryId(newTreasuryId);
    const tr = treasuriesList.find((t: any) => t.id === newTreasuryId);
    const dom = tr?.project_category || (tr?.name?.includes("تشطيب") ? "finishing" : tr?.name?.includes("مقاولات") ? "contracting" : null);
    if (dom) {
      const dPurchases = purchases.filter((p: any) => p.projects?.project_type === dom);
      const dInvoices = dPurchases.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);
      const dPaid = dPurchases.reduce((sum: number, p: any) => sum + Number(p.paid_amount || 0), 0);
      const dDue = Math.max(0, dInvoices - dPaid);
      if (dDue > 0) {
        setPayAmount(dDue.toString());
      }
    } else if (globalDue > 0) {
      setPayAmount(globalDue.toString());
    }
  };

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: { name: string; phone: string; category: string; address: string; notes: string }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update({
          name: payload.name,
          phone: payload.phone || null,
          category: payload.category || null,
          address: payload.address || null,
          notes: payload.notes || null,
        })
        .eq("id", id!)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("تم تحديث بيانات المورد بنجاح");
      setIsEditProfileOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "تعذر تحديث بيانات المورد"),
  });

  const payOnAccountMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(payAmount);
      if (!amt || amt <= 0) {
        throw new Error("يرجى إدخال مبلغ دفع صحيح أكبر من صفر");
      }
      if (!payTreasuryId) {
        throw new Error("يرجى اختيار الخزينة المخصوم منها");
      }

      const idempotencyKey = paymentOperation.getKey([id, payTreasuryId, amt, payPaymentMethod, payDate, payNotes, payReference]);

      const { data, error } = await (supabase.rpc as any)("pay_supplier_on_account_atomic", {
        p_supplier_id: id,
        p_treasury_id: payTreasuryId,
        p_amount: amt,
        p_payment_method: payPaymentMethod,
        p_date: payDate,
        p_notes: payNotes || null,
        p_reference: payReference || null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        throw new Error(error.message || "فشلت عملية الدفع على الحساب");
      }
      return data;
    },
    onSuccess: (data: any) => {
      paymentOperation.reset();
      invalidateFinancialQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["supplier-direct-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payment-allocations", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-stats"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["parent-treasuries-list"] });

      const paidAmt = parseFloat(payAmount);

      toast.success(`تم تسجيل دفعة بقيمة ${formatCurrencyLYD(paidAmt)} للمورد بنجاح`, {
        action: {
          label: "طباعة السند",
          onClick: () => {
            openReceiptPrintWindow(
              {
                receiptNumber: `PAY-${data?.payment_id?.slice(0, 8) || Date.now().toString().slice(-6)}`,
                date: payDate,
                type: "payment",
                amount: paidAmt,
                paidToOrBy: supplier?.name || "المورد",
                description: `سداد دفعة على الحساب للمورد: ${supplier?.name || ""}`,
                paymentMethod: payPaymentMethod,
                treasuryName: selectedTreasury?.name,
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
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ الدفعة");
    },
  });

  // Chronological running balance ledger
  const chronologicalStatement = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      createdAt: string;
      type: "invoice" | "payment";
      description: string;
      projectName?: string;
      invoiceAmount: number;
      paymentAmount: number;
      runningBalance: number;
      paymentRecord?: any;
    }> = [];

    for (const pur of purchases) {
      items.push({
        id: `pur-${pur.id}`,
        date: pur.date || pur.created_at?.slice(0, 10) || "",
        createdAt: pur.created_at || "",
        type: "invoice",
        description: `فاتورة رقم ${pur.invoice_number || "—"} (${pur.title || "توريد مواد"})`,
        projectName: pur.projects?.name,
        invoiceAmount: Number(pur.total_amount || 0),
        paymentAmount: 0,
        runningBalance: 0,
      });
    }

    for (const sp of supplierPayments) {
      items.push({
        id: `sp-${sp.id}`,
        date: sp.date || sp.created_at?.slice(0, 10) || "",
        createdAt: sp.created_at || "",
        type: "payment",
        description: sp.notes || `دفعة على الحساب - ${sp.treasuries?.name || "الخزينة"}`,
        projectName: "دفعة على الحساب (تسوية عامة)",
        invoiceAmount: 0,
        paymentAmount: Number(sp.amount || 0),
        runningBalance: 0,
        paymentRecord: sp,
      });
    }

    for (const dp of directPurchasePayments) {
      items.push({
        id: `dp-${dp.id}`,
        date: dp.date || dp.created_at?.slice(0, 10) || "",
        createdAt: dp.created_at || "",
        type: "payment",
        description: dp.notes || `سداد دفعة فاتورة ${dp.purchases?.invoice_number || ""}`,
        projectName: dp.purchases?.projects?.name,
        invoiceAmount: 0,
        paymentAmount: Number(dp.amount || 0),
        runningBalance: 0,
        paymentRecord: dp,
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt.localeCompare(b.createdAt);
    });

    let running = 0;
    for (const item of items) {
      if (item.type === "invoice") {
        running += item.invoiceAmount;
      } else {
        running -= item.paymentAmount;
      }
      item.runningBalance = running;
    }

    return items;
  }, [purchases, supplierPayments, directPurchasePayments]);

  // Flat Filtered Invoices Table
  const filteredFlatInvoices = useMemo(() => {
    return purchases.filter((pur: any) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        (pur.invoice_number && pur.invoice_number.toLowerCase().includes(q)) ||
        (pur.title && pur.title.toLowerCase().includes(q)) ||
        (pur.projects?.name && pur.projects.name.toLowerCase().includes(q)) ||
        (pur.projects?.clients?.name && pur.projects.clients.name.toLowerCase().includes(q));

      const remaining = Number(pur.total_amount || 0) - Number(pur.paid_amount || 0);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "unpaid" && remaining > 0) ||
        (statusFilter === "paid" && remaining <= 0);

      const matchesCategory = projectTypeFilter === "all" ||
        pur.projects?.project_type === projectTypeFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [purchases, searchQuery, statusFilter, projectTypeFilter]);

  // Filter Client/Project by Search Query & Filters
  const filteredClientGroups = useMemo(() => {
    if (!searchQuery.trim() && statusFilter === "all" && projectTypeFilter === "all") return clientGroups;
    const q = searchQuery.trim().toLowerCase();

    return clientGroups
      .map((c) => {
        const matchingProjects = c.projects.filter((p) => {
          const projectMatchesType = projectTypeFilter === "all" || p.projectType === projectTypeFilter;

          const matchingPurchases = p.purchases.filter((pur) => {
            const rem = Number(pur.total_amount || 0) - Number(pur.paid_amount || 0);
            const statusOk = statusFilter === "all" || (statusFilter === "unpaid" && rem > 0) || (statusFilter === "paid" && rem <= 0);
            const searchOk = !q ||
              (pur.invoice_number && pur.invoice_number.toLowerCase().includes(q)) ||
              (pur.title && pur.title.toLowerCase().includes(q)) ||
              p.projectName.toLowerCase().includes(q) ||
              c.clientName.toLowerCase().includes(q);
            return statusOk && searchOk;
          });

          return projectMatchesType && matchingPurchases.length > 0;
        });

        if (matchingProjects.length > 0) {
          return {
            ...c,
            projects: matchingProjects,
          };
        }

        return null;
      })
      .filter(Boolean) as ClientGroup[];
  }, [clientGroups, searchQuery, statusFilter, projectTypeFilter]);

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === undefined ? false : !prev[clientId],
    }));
  };

  const toggleProjectInvoices = (projId: string) => {
    setExpandedProjectInvoices((prev) => ({
      ...prev,
      [projId]: !prev[projId],
    }));
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success("تم نسخ رقم الهاتف");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handlePrintStatement = () => {
    const tableRows = chronologicalStatement.map(st => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${st.date}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${st.description} ${st.projectName ? `(${st.projectName})` : ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left; direction: ltr;">${st.invoiceAmount > 0 ? formatCurrencyLYD(st.invoiceAmount) : '—'}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left; direction: ltr;">${st.paymentAmount > 0 ? formatCurrencyLYD(st.paymentAmount) : '—'}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: left; direction: ltr; font-weight: bold;">${formatCurrencyLYD(st.runningBalance)}</td>
      </tr>
    `).join("");

    const htmlContent = `
      <div class="print-area" dir="rtl">
        <div class="print-report-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #d6ac40; padding-bottom: 12px;">
          <h2 style="margin: 0; font-size: 20px; color: #111;">كشف حساب مورد مواد</h2>
          <h3 style="margin: 6px 0; font-size: 16px; color: #d6ac40;">${supplier?.name || ""}</h3>
          <div style="font-size: 12px; color: #666;">
            التصنيف: ${supplier?.category || "مورد مواد"} | 
            الهاتف: ${supplier?.phone || "—"} | 
            التاريخ: ${new Date().toLocaleDateString("ar-LY")}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr style="background: #fdfaf3;">
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">إجمالي الفواتير:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left; font-weight: bold;">${formatCurrencyLYD(globalPurchases)}</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">إجمالي المسدد:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left; font-weight: bold; color: #16a34a;">${formatCurrencyLYD(globalPaid)}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">المتبقي المستحق:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left; font-weight: bold; color: #d6ac40;">${formatCurrencyLYD(globalDue)}</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; font-weight: bold;">الرصيد المقدم:</td>
            <td style="padding: 10px; border: 1px solid #d6ac40; direction: ltr; text-align: left;">${formatCurrencyLYD(unallocatedAdvance)}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f5f5f5; border: 1px solid #ddd;">
              <th style="padding: 8px; border: 1px solid #ddd;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">البيان / الفاتورة أو السند</th>
              <th style="padding: 8px; border: 1px solid #ddd;">قيمة الفاتورة (+)</th>
              <th style="padding: 8px; border: 1px solid #ddd;">المسدد (-)</th>
              <th style="padding: 8px; border: 1px solid #ddd;">الرصيد التراكمي</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
    openPrintWindow(`كشف حساب المورد: ${supplier?.name || ""}`, htmlContent, companySettings);
  };

  if (loadingSupplier) {
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

  if (supplierError || !supplier) {
    return (
      <div className="p-12 text-center" dir="rtl">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <h3 className="text-xl font-bold text-foreground">تعذر العثور على المورد</h3>
        <p className="text-sm text-muted-foreground mt-1">المورد المطلوب غير موجود أو تم حذفه من النظام.</p>
        <Button className="mt-4 bg-primary text-primary-foreground font-bold cursor-pointer" onClick={() => navigate("/suppliers")}>
          العودة لقائمة الموردين
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6" dir="rtl">
      {/* Deterministic Breadcrumb Navigation */}
      <DeterministicBreadcrumb
        items={[
          { label: "الموردون", href: "/suppliers" },
          { label: supplier?.name || "تفاصيل المورد", isCurrent: true },
        ]}
        fallbackBackHref="/suppliers"
      />

      {/* Hero Party Account Header */}
      <Card className="overflow-hidden border border-border/80 bg-gradient-to-l from-card via-card to-primary/[0.04] shadow-xs rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-amber-500 to-primary/40" />
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Right side: Party Info */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <Truck className="h-8 w-8 text-primary animate-in fade-in" />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-foreground">{supplier.name}</h1>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
                  مورد مواد
                </Badge>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>نشط</span>
                </Badge>
              </div>

              {/* Category, Address, Contact Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                {supplier.category && (
                  <div className="flex items-center gap-1 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60 text-foreground font-semibold">
                    <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                    <span>{supplier.category}</span>
                  </div>
                )}

                {supplier.phone ? (
                  <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    <a
                      href={`tel:${supplier.phone}`}
                      className="text-foreground hover:text-primary font-bold hover:underline transition-colors"
                      dir="ltr"
                    >
                      {supplier.phone}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(supplier.phone)}
                      className="p-1 hover:text-primary text-muted-foreground transition-colors cursor-pointer"
                      title="نسخ الرقم"
                    >
                      {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs italic">لا يوجد رقم هاتف</span>
                )}

                {supplier.address && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{supplier.address}</span>
                  </div>
                )}

                {supplier.notes && (
                  <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                    ملاحظات: {supplier.notes}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Left side: Quick Actions & Live Balance Pill */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            {/* Live Balance Banner Chip */}
            <div className={`px-3.5 py-1.5 rounded-xl border flex items-center justify-between sm:justify-start gap-2.5 ${supplierBalanceInfo.badgeBg}`}>
              <div className="text-right">
                <span className="text-[10px] font-bold block text-muted-foreground">{supplierBalanceInfo.label}</span>
                <span className="text-base font-black text-foreground" dir="ltr">
                  {formatCurrencyLYD(supplierBalanceInfo.amount)}
                </span>
              </div>
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {canManagePayments && (
                <Button
                  onClick={handleOpenPayModal}
                  className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  <Wallet className="h-4 w-4" />
                  <span>{globalDue > 0 ? "سداد دفعة للمورد" : "تسجيل دفعة مقدمة"}</span>
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
                title="تعديل بيانات المورد"
              >
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Executive Summary Grid (4 Cohesive Financial & Activity Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Purchases */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي الفواتير والمشتريات</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(globalPurchases)}
          </p>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>مجموع فواتير التوريد</span>
            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-muted">
              {purchases.length} فاتورة
            </Badge>
          </div>
        </Card>

        {/* KPI 2: Total Payments */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي المدفوعات المسددة</span>
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
              {supplierPayments.length + directPurchasePayments.length} سند
            </Badge>
          </div>
        </Card>

        {/* KPI 3: Signed Balance */}
        <Card className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between ${
          signedBalance > 0 
            ? "border-amber-500/40 bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.02] to-card"
            : signedBalance < 0
            ? "border-blue-500/40 bg-gradient-to-br from-blue-500/[0.08] via-blue-500/[0.02] to-card"
            : "border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.02] to-card"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${supplierBalanceInfo.color}`}>{supplierBalanceInfo.label}</span>
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <p className={`text-2xl font-black ${supplierBalanceInfo.color} mt-2`} dir="ltr">
              {formatCurrencyLYD(supplierBalanceInfo.amount)}
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-foreground/80 font-medium line-clamp-1">
            {supplierBalanceInfo.statusText}
          </div>
        </Card>

        {/* KPI 4: Advance Credit & Projects Count */}
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">دفعات مقدمة قابلة للتوزيع</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(unallocatedAdvance)}
          </p>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>المشاريع المورد لها:</span>
            <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 border-border/80">
              {clientGroups.reduce((s, c) => s + c.projects.length, 0)} مشروع
            </Badge>
          </div>
        </Card>
      </div>

      {/* Main Interactive Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="bg-card border border-border/80 p-1 rounded-xl shadow-2xs h-11 flex-wrap">
            <TabsTrigger 
              value="projects" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span>المشاريع والزبائن</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {purchases.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger 
              value="payments" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>سندات الصرف والمدفوعات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-muted">
                {supplierPayments.length + directPurchasePayments.length}
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
              value="advances" 
              className="rounded-lg text-xs font-bold gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary cursor-pointer transition-all"
            >
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>الدفعات المقدمة والتسويات</span>
              {unallocatedAdvance > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 font-bold bg-blue-500/10 text-blue-700">
                  {formatCurrencyLYD(unallocatedAdvance)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Filters for Invoices */}
          {activeTab === "projects" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Domain Filter */}
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
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)} dir="rtl">
                <SelectTrigger className="h-9 w-36 text-xs rounded-xl bg-card border-border/80">
                  <SelectValue placeholder="حالة السداد" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="all" className="text-xs font-bold">كافة الحالات</SelectItem>
                  <SelectItem value="unpaid" className="text-xs">فواتير متبقية</SelectItem>
                  <SelectItem value="paid" className="text-xs">مسددة بالكامل</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-xl border border-border/80 bg-card p-0.5 shadow-2xs">
                <Button
                  variant={invoicesViewMode === "grouped" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                  onClick={() => setInvoicesViewMode("grouped")}
                  title="عرض مجمّع حسب المشروع"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">مجموعات المشاريع</span>
                </Button>
                <Button
                  variant={invoicesViewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs font-bold gap-1 rounded-lg cursor-pointer"
                  onClick={() => setInvoicesViewMode("table")}
                  title="عرض كجدول ERP موحد"
                >
                  <TableProperties className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">جدول ERP</span>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-52">
                <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="بحث برقم الفاتورة أو المشروع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 h-9 text-xs rounded-xl bg-card border-border/80"
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: PURCHASE INVOICES                                     */}
        {/* ============================================================ */}
        <TabsContent value="projects" className="space-y-4 mt-1">
          {loadingPurchases ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : filteredFlatInvoices.length === 0 ? (
            <Card className="p-10 text-center rounded-2xl border-dashed border-border/80 bg-card">
              <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-base font-bold text-foreground">لا توجد فواتير مطابقة للبحث أو الفلتر</h4>
              <p className="text-xs text-muted-foreground mt-1 font-medium max-w-md mx-auto">
                لم يتم تسجيل أي فواتير مواد لهذا المورد بالمعايير الحالية. يمكنك تسجيل فواتير جديدة من قسم المشتريات.
              </p>
            </Card>
          ) : invoicesViewMode === "table" ? (
            /* ERP Table View */
            <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
              <CardHeader className="p-3.5 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableProperties className="h-4 w-4 text-primary" />
                  <CardTitle className="text-xs font-bold text-foreground">
                    جدول كافة فواتير المورد ({filteredFlatInvoices.length})
                  </CardTitle>
                </div>
                <div className="text-xs font-bold text-muted-foreground">
                  إجمالي الفواتير: <strong className="text-foreground text-sm" dir="ltr">{formatCurrencyLYD(filteredFlatInvoices.reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0))}</strong>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table className="text-xs" dir="rtl">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-right font-bold text-foreground w-12">#</TableHead>
                      <TableHead className="text-right font-bold text-foreground">رقم الفاتورة</TableHead>
                      <TableHead className="text-right font-bold text-foreground">البيان / المواد</TableHead>
                      <TableHead className="text-right font-bold text-foreground">المشروع والعميل</TableHead>
                      <TableHead className="text-right font-bold text-foreground">القطاع</TableHead>
                      <TableHead className="text-right font-bold text-foreground">إجمالي القيمة</TableHead>
                      <TableHead className="text-right font-bold text-foreground">المسدد</TableHead>
                      <TableHead className="text-right font-bold text-foreground">المتبقي</TableHead>
                      <TableHead className="text-right font-bold text-foreground">الحالة</TableHead>
                      <TableHead className="text-center font-bold text-foreground">الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFlatInvoices.map((pur: any, idx: number) => {
                      const total = Number(pur.total_amount || 0);
                      const paid = Number(pur.paid_amount || 0);
                      const remaining = Math.max(0, total - paid);
                      const isFullyPaid = remaining <= 0;

                      return (
                        <TableRow key={pur.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono font-bold text-foreground">
                            {pur.invoice_number || "بدون رقم"}
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-foreground">{pur.title || "توريد مواد"}</div>
                            <div className="text-[10px] text-muted-foreground">{pur.date}</div>
                          </TableCell>
                          <TableCell>
                            {pur.projects ? (
                              <Link 
                                to={`/projects/${pur.project_id}`} 
                                className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                              >
                                <span>{pur.projects.name}</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground italic">مشتريات عامة</span>
                            )}
                            {pur.projects?.clients?.name && (
                              <div className="text-[10px] text-muted-foreground">العميل: {pur.projects.clients.name}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] font-bold ${
                                pur.projects?.project_type === "contracting"
                                  ? "border-amber-500/30 text-amber-700 bg-amber-500/10"
                                  : "border-purple-500/30 text-purple-700 bg-purple-500/10"
                              }`}
                            >
                              {pur.projects?.project_type === "contracting" ? "مقاولات" : "تشطيبات"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-black text-foreground" dir="ltr">
                            {formatCurrencyLYD(total)}
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                            {formatCurrencyLYD(paid)}
                          </TableCell>
                          <TableCell className="font-black text-amber-700 dark:text-amber-400" dir="ltr">
                            {remaining > 0 ? formatCurrencyLYD(remaining) : "0.00 د.ل"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold ${
                                isFullyPaid
                                  ? "border-emerald-500/30 text-emerald-700 bg-emerald-500/10"
                                  : paid > 0
                                  ? "border-blue-500/30 text-blue-700 bg-blue-500/10"
                                  : "border-amber-500/30 text-amber-700 bg-amber-500/10"
                              }`}
                            >
                              {isFullyPaid ? "مسددة بالكامل" : paid > 0 ? "مسددة جزئياً" : "غير مسددة"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {!isFullyPaid && (
                              <Button
                                size="sm"
                                className="h-7 text-[11px] px-2.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-2xs"
                                onClick={handleOpenPayModal}
                                disabled={!canManagePayments}
                                title="سداد الفاتورة"
                              >
                                <Wallet className="h-3 w-3 ml-1" />
                                <span>سداد</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            /* Grouped View (Client -> Projects) */
            <div className="space-y-3.5">
              {filteredClientGroups.map((client) => {
                const isClientExpanded = expandedClients[client.clientId] !== false;

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
                          <span className="text-[10px] text-muted-foreground font-bold block">إجمالي المستحق</span>
                          <span className="text-xs font-black text-amber-700 dark:text-amber-400" dir="ltr">
                            {formatCurrencyLYD(client.totalDue)}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                          {isClientExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isClientExpanded && (
                      <div className="p-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                        {client.projects.map((proj) => {
                          const isInvoicesExpanded = !!expandedProjectInvoices[proj.projectId];

                          return (
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

                                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-center">
                                  <div>
                                    <span className="text-[10px] text-muted-foreground font-bold block">المشتريات</span>
                                    <span className="text-xs font-black text-foreground" dir="ltr">
                                      {formatCurrencyLYD(proj.totalPurchases)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground font-bold block">المسدد</span>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                                      {formatCurrencyLYD(proj.totalPaid)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground font-bold block">المتبقي</span>
                                    <span className="text-xs font-black text-amber-700 dark:text-amber-400" dir="ltr">
                                      {formatCurrencyLYD(proj.totalDue)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border/60">
                                <div className="flex items-center justify-between gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 cursor-pointer"
                                    onClick={() => toggleProjectInvoices(proj.projectId)}
                                  >
                                    {isInvoicesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    <span>فواتير المشروع ({proj.purchases.length})</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1 text-xs px-3 shadow-2xs cursor-pointer"
                                    onClick={handleOpenPayModal}
                                    disabled={!canManagePayments || proj.totalDue <= 0}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span>سداد ({formatCurrencyLYD(proj.totalDue)})</span>
                                  </Button>
                                </div>

                                {isInvoicesExpanded && (
                                  <div className="mt-3 pt-3 border-t border-border/40 space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {proj.purchases.map((pur: any) => {
                                      const rem = Number(pur.total_amount || 0) - Number(pur.paid_amount || 0);
                                      return (
                                        <div
                                          key={pur.id}
                                          className="p-2 rounded-lg bg-card border border-border/40 text-xs flex items-center justify-between gap-2"
                                        >
                                          <div>
                                            <div className="font-semibold text-foreground">
                                              {pur.title || (pur.invoice_number ? `فاتورة رقم: ${pur.invoice_number}` : "فاتورة توريد")}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                              <span>{pur.date}</span>
                                              <span>•</span>
                                              <span>المبلغ: {formatCurrencyLYD(pur.total_amount)}</span>
                                            </div>
                                          </div>

                                          <div className="text-left shrink-0">
                                            <Badge
                                              variant="outline"
                                              className={`text-[10px] font-bold ${
                                                rem <= 0
                                                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                                  : "border-amber-500/30 text-amber-700 bg-amber-500/10"
                                              }`}
                                            >
                                              {rem <= 0 ? "مدفوعة بالكامل" : `متبقي: ${formatCurrencyLYD(rem)}`}
                                            </Badge>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: PAYMENT VOUCHERS                                      */}
        {/* ============================================================ */}
        <TabsContent value="payments" className="space-y-4 mt-1">
          <Card className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
            <CardHeader className="p-4 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-xs font-bold text-foreground">
                  سجل سندات الصرف والمدفوعات المسددة للمورد ({supplierPayments.length + directPurchasePayments.length})
                </CardTitle>
              </div>
              {canManagePayments && (
                <Button
                  size="sm"
                  onClick={handleOpenPayModal}
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
                    <TableHead className="text-right font-bold text-foreground">البيان / الفاتورة</TableHead>
                    <TableHead className="text-right font-bold text-foreground">المبلغ المسدد</TableHead>
                    <TableHead className="text-center font-bold text-foreground">طباعة السند</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierPayments.length === 0 && directPurchasePayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-medium">
                        لا توجد سندات صرف مسجلة لهذا المورد حتى الآن.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {supplierPayments.map((pay: any) => (
                        <TableRow key={`sp-${pay.id}`} className="hover:bg-muted/30 transition-colors">
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
                            <span className="text-foreground font-medium">{pay.notes || "دفعة على الحساب (تسوية عامة)"}</span>
                          </TableCell>
                          <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                            {formatCurrencyLYD(Number(pay.amount || 0))}
                          </TableCell>
                          <TableCell className="text-center">
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
                                    type: "payment",
                                    amount: Number(pay.amount || 0),
                                    paidToOrBy: supplier.name,
                                    description: pay.notes || `سداد دفعة على الحساب للمورد`,
                                    paymentMethod: pay.payment_method,
                                    treasuryName: pay.treasuries?.name,
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

                      {directPurchasePayments.map((pay: any) => (
                        <TableRow key={`dp-${pay.id}`} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            DIR-{pay.id.slice(0, 8)}
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
                            <span className="text-foreground font-medium">{pay.notes || `سداد فاتورة: ${pay.purchases?.title || ""}`}</span>
                            {pay.purchases?.projects?.name && (
                              <div className="text-[10px] text-muted-foreground">مشروع: {pay.purchases.projects.name}</div>
                            )}
                          </TableCell>
                          <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-sm" dir="ltr">
                            {formatCurrencyLYD(Number(pay.amount || 0))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="طباعة سند الصرف"
                              onClick={() =>
                                openReceiptPrintWindow(
                                  {
                                    receiptNumber: `DIR-${pay.id.slice(0, 8)}`,
                                    date: pay.date,
                                    type: "payment",
                                    amount: Number(pay.amount || 0),
                                    paidToOrBy: supplier.name,
                                    description: pay.notes || `سداد مستحقات توريد مواد`,
                                    projectName: pay.purchases?.projects?.name,
                                    paymentMethod: pay.payment_method,
                                    treasuryName: pay.treasuries?.name,
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
                    <TableHead className="text-right font-bold text-foreground">البيان / تفاصيل الفاتورة أو السند</TableHead>
                    <TableHead className="text-right font-bold text-foreground">قيمة الفاتورة (+)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الدفعة المسددة (-)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الرصيد التراكمي</TableHead>
                    <TableHead className="text-center font-bold text-foreground">السند</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chronologicalStatement.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-medium">
                        لا توجد حركات مسجلة في كشف حساب المورد حتى الآن.
                      </TableCell>
                    </TableRow>
                  ) : (
                    chronologicalStatement.map((st) => (
                      <TableRow key={st.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-semibold text-muted-foreground">{st.date}</TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground">{st.description}</div>
                          {st.projectName && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">المشروع: {st.projectName}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                          {st.invoiceAmount > 0 ? `+${formatCurrencyLYD(st.invoiceAmount)}` : "—"}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                          {st.paymentAmount > 0 ? `-${formatCurrencyLYD(st.paymentAmount)}` : "—"}
                        </TableCell>
                        <TableCell className="font-black text-foreground" dir="ltr">
                          {formatCurrencyLYD(st.runningBalance)}
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
                                    type: "payment",
                                    amount: Number(st.paymentRecord.amount || 0),
                                    paidToOrBy: supplier.name,
                                    description: st.paymentRecord.notes || `سداد مستحقات توريد مواد`,
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
        {/* TAB 4: ADVANCE PAYMENTS & ALLOCATIONS                        */}
        {/* ============================================================ */}
        <TabsContent value="advances" className="space-y-4 mt-1">
          <SupplierAdvancePanel supplierId={id!} />
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOG: EDIT SUPPLIER PROFILE                                */}
      {/* ============================================================ */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-600" />
              <span>تعديل بيانات المورد</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تحديث بيانات الاتصال والتصنيف والعنوان والملاحظات الخاصة بالمورد.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfileMutation.mutate({
                name: editProfileName,
                phone: editProfilePhone,
                category: editProfileCategory,
                address: editProfileAddress,
                notes: editProfileNotes,
              });
            }}
            className="space-y-3.5 py-1"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم المورد / الشركة *</Label>
              <Input
                value={editProfileName}
                onChange={(e) => setEditProfileName(e.target.value)}
                placeholder="اسم المورد أو المحل التجاري"
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
              <Label className="text-xs font-bold">التصنيف / نوع المواد</Label>
              <Input
                value={editProfileCategory}
                onChange={(e) => setEditProfileCategory(e.target.value)}
                placeholder="مثال: مواد بناء، صحي، كهرباء، دهانات"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">العنوان / الموقع</Label>
              <Input
                value={editProfileAddress}
                onChange={(e) => setEditProfileAddress(e.target.value)}
                placeholder="المدينة / المنطقة / الشارع"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">ملاحظات عامة</Label>
              <Textarea
                value={editProfileNotes}
                onChange={(e) => setEditProfileNotes(e.target.value)}
                placeholder="أي تفاصيل أو شروط دفع متفق عليها..."
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
      {/* DIALOG: PAY ON ACCOUNT FOR SUPPLIER                          */}
      {/* ============================================================ */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>دفع على حساب المورد</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تسجيل دفعة مالية للمورد؛ تُسوّى تلقائياً مع الفواتير القائمة، وأي فائض يُحفظ كرصد مقدم للفواتير القادمة.
            </DialogDescription>
          </DialogHeader>

          {/* Party Summary Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-bold">المورد:</span>
              <span className="font-black text-foreground">{supplier.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">إجمالي الفواتير</span>
                <span className="text-xs font-black text-foreground" dir="ltr">
                  {formatCurrencyLYD(globalPurchases)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">المدفوع سابقاً</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {formatCurrencyLYD(globalPaid)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-bold block">{supplierBalanceInfo.label}</span>
                <span className={`text-xs font-black ${supplierBalanceInfo.color}`} dir="ltr">
                  {formatCurrencyLYD(supplierBalanceInfo.amount)}
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
                    handleTreasuryChange(chosen);
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
                  onValueChange={handleTreasuryChange}
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

            {/* Dynamic Domain Due Calculation Indicator */}
            {payTreasuryId && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/60 text-[11px]">
                <span className="text-muted-foreground font-medium">المستحق من قطاع هذه الخزينة:</span>
                <span className={`font-black ${treasuryEligibleDue > 0 ? "text-primary" : "text-blue-600 dark:text-blue-400"}`} dir="ltr">
                  {formatCurrencyLYD(treasuryEligibleDue)}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">المبلغ المدفوع الآن (د.ل) *</Label>
                {treasuryEligibleDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(treasuryEligibleDue.toString())}
                    className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                  >
                    سداد كامل الرصيد المتاح ({formatCurrencyLYD(treasuryEligibleDue)})
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="أدخل المبلغ المراد سداده"
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
                  !payTreasuryId ||
                  loadingTreasuries
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
    </div>
  );
}
