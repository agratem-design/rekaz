import React, { useState, useMemo, useEffect } from "react";
import { useOperationKey } from "@/hooks/useOperationKey";
import { invalidateFinancialQueries } from "@/lib/financialMutations";
import { SupplierAdvancePanel } from "@/components/suppliers/SupplierAdvancePanel";
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
  Layers, CheckCircle2, AlertCircle, FileText, Sparkles, Plus, Eye
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
  const paymentOperation = useOperationKey();

  const [activeTab, setActiveTab] = useState<"projects" | "statement">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedProjectInvoices, setExpandedProjectInvoices] = useState<Record<string, boolean>>({});

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

  // Allocation rows distinguish supplier advances from amounts actually
  // settled against invoices. Unallocated header amounts remain supplier
  // credit and must not reduce invoice dues.
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
  const { clientGroups, globalPurchases, globalPaid, globalDue, signedBalance } = useMemo(() => {
    let gPurchases = 0;

    const projectMap = new Map<string, ProjectGroup>();

    // 1. Group Purchases by Project
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

    // 2. Attach Direct Payments to Projects
    directPurchasePayments.forEach((pay: any) => {
      const projId = pay.purchases?.project_id || "unassigned";
      if (projectMap.has(projId)) {
        const group = projectMap.get(projId)!;
        group.payments.push(pay);
      }
    });

    // 3. Finalize Project Dues
    projectMap.forEach((grp) => {
      grp.totalDue = Math.max(0, grp.totalPurchases - grp.totalPaid);
    });

    // 4. Group Projects into Clients
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

    // Authoritative Paid = Sum of supplier_payments + Sum of direct purchase_payments
    const sPaid = supplierPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const dPaid = directPurchasePayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const gPaid = sPaid + dPaid;
    // Invoice dues and unallocated advances are separate until explicitly allocated.
    const allocated = supplierPaymentAllocations.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const gDue = Math.max(0, gPurchases - allocated - dPaid);
    const signedBalance = gPurchases - gPaid;

    return {
      clientGroups: Array.from(clientMap.values()),
      globalPurchases: gPurchases,
      globalPaid: gPaid,
      globalDue: gDue,
      signedBalance,
    };
  }, [purchases, supplierPayments, supplierPaymentAllocations, directPurchasePayments]);

  const supplierBalanceInfo = useMemo(() => {
    if (signedBalance < 0) {
      return {
        label: "رصيد مقدم للمورد",
        amount: Math.abs(signedBalance),
        color: "text-blue-600 dark:text-blue-400",
        description: "دفعة مقدمة محفوظة لحساب المورد وتُسوّى مع الفواتير القادمة",
      };
    }
    if (signedBalance === 0) {
      return {
        label: "الرصيد",
        amount: 0,
        color: "text-foreground",
        description: "الحساب متوازن بالكامل",
      };
    }
    return {
      label: "المتبقي للمورد",
      amount: signedBalance,
      color: "text-amber-600 dark:text-amber-400",
      description: "صافي الرصيد المستحق في ذمة المؤسسة",
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

  // When opening pay modal, set default treasury & amount
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

  // When treasury changes in modal, auto-update payAmount to domain due if full payment desired
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

      toast.success(`تم تسجيل دفعة بقيمة ${formatCurrencyLYD(paidAmt)} على حساب المورد بنجاح`, {
        action: {
          label: "طباعة سند الصرف",
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

  // Chronological running balance ledger for supplier account statement
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
            p.purchases.some((item) =>
              (item.invoice_number && item.invoice_number.toLowerCase().includes(q)) ||
              (item.title && item.title.toLowerCase().includes(q))
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
      .filter(Boolean) as ClientGroup[];
  }, [clientGroups, searchQuery]);

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === undefined ? false : !prev[clientId],
    }));
  };

  const toggleProjectInvoices = (projectId: string) => {
    setExpandedProjectInvoices((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handlePrintStatement = () => {
    const htmlContent = `
      <div class="print-area">
        <div class="print-report-header">
          <div class="print-report-title">كشف حساب المورد: ${supplier?.name || ""}</div>
          <div class="print-report-meta">التاريخ: ${new Date().toLocaleDateString("ar-LY")}</div>
        </div>
        <div class="print-content">
          <table class="print-info-table">
            <tr>
              <td class="info-label">إجمالي المشتريات</td>
              <td class="info-value">${formatCurrencyLYD(globalPurchases)}</td>
              <td class="info-label">إجمالي المسدد</td>
              <td class="info-value">${formatCurrencyLYD(globalPaid)}</td>
            </tr>
            <tr>
              <td class="info-label">المتبقي المستحق</td>
              <td class="info-value" colspan="3">${formatCurrencyLYD(globalDue)}</td>
            </tr>
          </table>
        </div>
      </div>
    `;
    openPrintWindow(`كشف حساب المورد: ${supplier?.name || ""}`, htmlContent, companySettings);
  };

  if (loadingSupplier) {
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

  if (supplierError || !supplier) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-bold text-foreground">تعذر العثور على المورد</h3>
        <p className="text-sm text-muted-foreground mt-1">المورد المطلوب غير موجود أو تم حذفه.</p>
        <Button className="mt-4" onClick={() => navigate("/suppliers")}>
          العودة لقائمة الموردين
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6" dir="rtl">
      {/* Breadcrumb Navigation */}
      <DeterministicBreadcrumb
        items={[
          { label: "الموردون", href: "/suppliers" },
          { label: supplier?.name || "تفاصيل المورد", isCurrent: true },
        ]}
        fallbackBackHref="/suppliers"
      />

      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-amber-600" />
            <span>{supplier.name}</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {supplier.category && <Badge variant="secondary">{supplier.category}</Badge>}
            {supplier.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">{supplier.phone}</span>
              </span>
            )}
            {supplier.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{supplier.address}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenPayModal}
            className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer"
            title="تسجيل دفعة على الحساب للمورد"
          >
            <Sparkles className="h-4 w-4" />
            <span>دفع على الحساب</span>
            <Badge variant="secondary" className="mr-1 text-[10px] bg-primary-foreground/20 text-primary-foreground font-black px-1.5 py-0">
              {globalDue > 0 ? formatCurrencyLYD(globalDue) : "مقدم"}
            </Badge>
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrintStatement} className="gap-1.5 text-xs font-bold bg-card border-border/80 hover:bg-muted cursor-pointer shadow-2xs">
            <Printer className="h-4 w-4 text-primary" />
            <span>طباعة كشف الحساب</span>
          </Button>
        </div>
      </div>

      {/* Top Reconciled Summary KPIs */}
      <SupplierAdvancePanel supplierId={id!} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-bold">إجمالي الفواتير</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(globalPurchases)}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium">مجموع الفواتير المسجلة للمورد</span>
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
          <span className="text-[11px] text-muted-foreground font-medium">سندات الصرف والدفعات المسددة</span>
        </Card>

        <Card className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/[0.03] to-card p-4 shadow-xs flex flex-col justify-between">
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
            <span className="text-[11px] text-foreground/80 font-medium">{supplierBalanceInfo.description}</span>
          </div>

          <Button
            size="sm"
            onClick={handleOpenPayModal}
            className="mt-3 w-full h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs cursor-pointer gap-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{globalDue > 0 ? `دفع على الحساب (${formatCurrencyLYD(globalDue)})` : "تسجيل دفعة مقدمة"}</span>
          </Button>
        </Card>
      </div>

      {/* Tabs Layout: Projects & Clients (Default) vs Statement */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="projects" className="rounded-lg text-xs font-semibold gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span>المشاريع والزبائن</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                {purchases.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="statement" className="rounded-lg text-xs font-semibold gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>سجل السندات والعمليات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                {supplierPayments.length + directPurchasePayments.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Instant Search Bar */}
          {activeTab === "projects" && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الزبون أو المشروع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-9 text-xs rounded-xl"
              />
            </div>
          )}
        </div>

        {/* TAB 1: CLIENTS -> PROJECTS HIERARCHY */}
        <TabsContent value="projects" className="space-y-4 mt-2">
          {loadingPurchases ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : filteredClientGroups.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-dashed">
              <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-foreground">لا توجد مشتريات أو مشاريع مسجلة</h4>
              <p className="text-xs text-muted-foreground mt-1">لم يتم تسجيل أي فواتير مواد لهذا المورد حتى الآن.</p>
            </Card>
          ) : (
            filteredClientGroups.map((client) => {
              const isClientExpanded = expandedClients[client.clientId] !== false; // expanded by default

              return (
                <Card
                  key={client.clientId}
                  className="rounded-2xl border border-border/60 shadow-sm overflow-hidden bg-card/60"
                >
                  {/* Client Group Header */}
                  <div
                    className="p-3.5 bg-muted/20 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleClientExpand(client.clientId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>{client.clientName}</span>
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            {client.projects.length} مشاريع
                          </Badge>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-[10px] text-muted-foreground block">مستحق الزبون للمورد</span>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                          {formatCurrencyLYD(client.totalDue)}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        {isClientExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Projects under this Client */}
                  {isClientExpanded && (
                    <div className="p-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                      {client.projects.map((proj) => {
                        const isInvoicesExpanded = !!expandedProjectInvoices[proj.projectId];

                        return (
                          <div
                            key={proj.projectId}
                            className="p-4 rounded-xl border border-border/60 bg-card hover:border-amber-500/30 transition-all flex flex-col justify-between"
                          >
                            <div>
                              {/* Project Title & Badge */}
                              <div className="flex items-start justify-between gap-2 mb-2.5">
                                <div>
                                  <Link
                                    to={`/projects/${proj.projectId}`}
                                    className="font-bold text-sm text-foreground hover:text-amber-600 transition-colors flex items-center gap-1.5"
                                  >
                                    <Layers className="h-3.5 w-3.5 text-amber-600" />
                                    <span>{proj.projectName}</span>
                                  </Link>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 shrink-0 ${
                                    proj.projectType === "contracting"
                                      ? "border-amber-500/30 text-amber-700 bg-amber-500/10 font-bold"
                                      : "border-purple-500/30 text-purple-700 bg-purple-500/10 font-bold"
                                  }`}
                                >
                                  {proj.projectType === "contracting" ? "مقاولات" : "تشطيبات"}
                                </Badge>
                              </div>

                              {/* Project Metrics Box */}
                              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center mb-3">
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">المشتريات</span>
                                  <span className="text-xs font-bold text-foreground" dir="ltr">
                                    {formatCurrencyLYD(proj.totalPurchases)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">المسدد</span>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                                    {formatCurrencyLYD(proj.totalPaid)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">المتبقي</span>
                                  <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400" dir="ltr">
                                    {formatCurrencyLYD(proj.totalDue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Invoices Accordion */}
                            <div>
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                                  onClick={() => toggleProjectInvoices(proj.projectId)}
                                >
                                  {isInvoicesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  <span>فواتير المشروع ({proj.purchases.length})</span>
                                </Button>

                                <Button
                                  size="sm"
                                  className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 text-xs px-3 shadow-sm"
                                  onClick={handleOpenPayModal}
                                  disabled={proj.totalDue <= 0}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>سداد ({formatCurrencyLYD(proj.totalDue)})</span>
                                </Button>
                              </div>

                              {/* Collapsible Invoices List */}
                              {isInvoicesExpanded && (
                                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                                  {proj.purchases.map((pur: any) => {
                                    const remaining = Number(pur.total_amount || 0) - Number(pur.paid_amount || 0);
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
                                            className={`text-[10px] ${
                                              remaining <= 0
                                                ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                                : "border-amber-500/30 text-amber-700 bg-amber-500/10 font-bold"
                                            }`}
                                          >
                                            {remaining <= 0 ? "مدفوعة بالكامل" : `متبقي: ${formatCurrencyLYD(remaining)}`}
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
            })
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
                    <TableHead className="text-right font-bold text-foreground">قيمة الفاتورة (+)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الدفعة المسددة (-)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">الرصيد التراكمي</TableHead>
                    <TableHead className="text-center font-bold text-foreground">سند الصرف</TableHead>
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
                      <TableRow key={st.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">{st.date}</TableCell>
                        <TableCell>
                          <div className="font-bold text-foreground">{st.description}</div>
                          {st.projectName && (
                            <div className="text-[11px] text-muted-foreground">مشروع: {st.projectName}</div>
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
                          {st.type === "payment" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="طباعة سند الصرف"
                              onClick={() =>
                                openReceiptPrintWindow(
                                  {
                                    receiptNumber: `PAY-${st.paymentRecord?.id?.slice(0, 8) || Date.now().toString().slice(-6)}`,
                                    date: st.date,
                                    type: "payment",
                                    amount: st.paymentAmount,
                                    paidToOrBy: supplier.name,
                                    description: st.description || `سداد مستحقات توريد مواد`,
                                    projectName: st.projectName,
                                    paymentMethod: st.paymentRecord?.payment_method || "cash",
                                    treasuryName: st.paymentRecord?.treasuries?.name,
                                    notes: st.paymentRecord?.notes || undefined,
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
      </Tabs>

      {/* DIALOG: SIMPLE ON-ACCOUNT PAYMENT FOR SUPPLIER */}
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

              {/* Dynamic Domain Due Calculation Indicator */}
              {payTreasuryId && (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/60 text-[11px] mt-1">
                  <span className="text-muted-foreground font-medium">المستحق من هذه الخزينة:</span>
                  <span className={`font-black ${treasuryEligibleDue > 0 ? "text-primary" : "text-blue-600 dark:text-blue-400"}`} dir="ltr">
                    {formatCurrencyLYD(treasuryEligibleDue)}
                  </span>
                </div>
              )}
              {payTreasuryId && treasuryEligibleDue <= 0 && (
                <p className="text-[11px] text-primary font-bold flex items-center gap-1 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>لا توجد فواتير مستحقة حالياً؛ ستُسجّل الدفعة كرصد مقدم للمورد</span>
                </p>
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
                    سداد كامل الرصيد المتاح
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
