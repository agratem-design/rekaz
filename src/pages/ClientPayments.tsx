import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Users,
  Building2,
  Wallet,
  Landmark,
  Receipt,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Printer,
  Search,
  Pencil,
  Sparkles,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { openPrintWindow } from "@/lib/printStyles";

// ─── helpers ────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];

// ─── Component ──────────────────────────────────────────────────────────────

const ClientPayments = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── form state ──────────────────────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "check" | "bank_transfer">("cash");
  const [paymentDate, setPaymentDate] = useState(today());
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // ── search / audit state ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ── ui state ────────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── queries ─────────────────────────────────────────────────────────────

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: treasuries } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, parent_id, balance")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch company settings for printing
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

  // Fetch all payments for general log (auditing)
  const { data: allPaymentsList, isLoading: loadingAllPayments } = useQuery({
    queryKey: ["client-payments-all-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*, clients:client_id(name), projects:project_id(name, project_type)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Client's projects with their outstanding amounts
  const { data: clientSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["client-outstanding", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;

      // 1. Get all projects for this client
      const { data: projects, error: projErr } = await supabase
        .from("projects")
        .select("id, name, project_type")
        .eq("client_id", selectedClientId)
        .order("name");
      if (projErr) throw projErr;
      if (!projects?.length) return { projects: [], totalOutstanding: 0, totalPaid: 0, invoices: [], payments: [], allocations: [], refPurchases: [], refItems: [] };

      const projectIds = projects.map(p => p.id);

      // 2. Get all purchases (both non-rental and rental)
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, project_id, total_amount, paid_amount, invoice_number, rental_id, date, phase_id")
        .in("project_id", projectIds);

      // 3. Get all project items (contracting items)
      const { data: projectItems } = await supabase
        .from("project_items")
        .select("id, project_id, name, total_price, phase_id")
        .in("project_id", projectIds);

      // 4. Get all client payment allocations for these
      const purchaseIds = purchases?.map(p => p.id) || [];
      const itemIds = projectItems?.map(i => i.id) || [];
      const allRefIds = [...purchaseIds, ...itemIds];

      let existingAllocations: any[] = [];
      if (allRefIds.length > 0) {
        const { data: allocs } = await supabase
          .from("client_payment_allocations")
          .select("id, payment_id, reference_id, reference_type, amount, phase_id")
          .in("reference_id", allRefIds);
        existingAllocations = allocs || [];
      }

      const allocatedMap: Record<string, number> = {};
      existingAllocations.forEach(a => {
        allocatedMap[a.reference_id] = (allocatedMap[a.reference_id] || 0) + Number(a.amount);
      });

      // 5. Build unpaid invoices/items list
      const unpaidInvoices: Array<{
        id: string;
        project_id: string;
        type: "purchase" | "rental" | "item";
        description: string;
        total_amount: number;
        paid_amount: number;
        remaining: number;
        date: string;
        phase_id: string | null;
      }> = [];

      purchases?.forEach(p => {
        const totalAllocated = allocatedMap[p.id] || 0;
        const remaining = Number(p.total_amount) - totalAllocated;
        if (remaining > 0) {
          unpaidInvoices.push({
            id: p.id,
            project_id: p.project_id,
            type: p.rental_id ? "rental" : "purchase",
            description: p.rental_id ? "فاتورة إيجار معدات" : `فاتورة مشتريات ${p.invoice_number || ''}`.trim(),
            total_amount: Number(p.total_amount),
            paid_amount: totalAllocated,
            remaining,
            date: p.date || "",
            phase_id: p.phase_id,
          });
        }
      });

      projectItems?.forEach(item => {
        const totalAllocated = allocatedMap[item.id] || 0;
        const remaining = Number(item.total_price) - totalAllocated;
        if (remaining > 0) {
          unpaidInvoices.push({
            id: item.id,
            project_id: item.project_id,
            type: "item",
            description: `بند مقاولات: ${item.name}`,
            total_amount: Number(item.total_price),
            paid_amount: totalAllocated,
            remaining,
            date: "", // Project items usually don't have date
            phase_id: item.phase_id,
          });
        }
      });

      // 6. Get all client payments already made for this client (whether project_id is null or not!)
      const { data: payments } = await supabase
        .from("client_payments")
        .select("id, project_id, amount, date, payment_method, notes, treasury_id")
        .eq("client_id", selectedClientId)
        .order("date", { ascending: false });

      // Fetch payment allocations specifically for these client payments
      const paymentIds = payments?.map(p => p.id) || [];
      let clientPaymentAllocs: any[] = [];
      if (paymentIds.length > 0) {
        const { data: allocs } = await supabase
          .from("client_payment_allocations")
          .select("id, payment_id, reference_id, reference_type, amount, phase_id, phase:phase_id(name)")
          .in("payment_id", paymentIds);
        clientPaymentAllocs = allocs || [];
      }

      // Referenced items for display
      const refIds = clientPaymentAllocs.map(a => a.reference_id);
      let refPurchases: any[] = [];
      if (refIds.length > 0) {
        const { data: purData } = await supabase
          .from("purchases")
          .select("id, invoice_number, suppliers:supplier_id(name)")
          .in("id", refIds);
        refPurchases = purData || [];
      }

      let refItems: any[] = [];
      if (refIds.length > 0) {
        const { data: itemData } = await supabase
          .from("project_items")
          .select("id, name")
          .in("id", refIds);
        refItems = itemData || [];
      }

      // Group totals
      const paidPerProject: Record<string, number> = {};
      payments?.forEach(p => {
        if (p.project_id) {
          paidPerProject[p.project_id] = (paidPerProject[p.project_id] || 0) + Number(p.amount);
        }
      });

      const outstandingPerProject: Record<string, number> = {};
      unpaidInvoices.forEach(inv => {
        outstandingPerProject[inv.project_id] = (outstandingPerProject[inv.project_id] || 0) + inv.remaining;
      });

      const totalOutstanding = Object.values(outstandingPerProject).reduce((s, v) => s + v, 0);
      const totalPaid = Object.values(paidPerProject).reduce((s, v) => s + v, 0);

      return {
        projects: projects.map(p => ({
          ...p,
          outstanding: outstandingPerProject[p.id] || 0,
          paid: paidPerProject[p.id] || 0,
        })),
        totalOutstanding,
        totalPaid,
        invoices: unpaidInvoices,
        payments: payments || [],
        allocations: clientPaymentAllocs,
        refPurchases,
        refItems,
      };
    },
    enabled: !!selectedClientId,
  });

  // ── computed ────────────────────────────────────────────────────────────
  const amount = parseFloat(paymentAmount) || 0;

  // نوع المشروع يُشتَق تلقائياً من المشروع المختار
  const selectedProjectData = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "none") return null;
    return clientSummary?.projects.find(p => p.id === selectedProjectId) || null;
  }, [clientSummary?.projects, selectedProjectId]);

  const paymentProjectType = useMemo(() => {
    if (!selectedProjectData) return "all";
    return (selectedProjectData as any).project_type as "contracting" | "finishing";
  }, [selectedProjectData]);

  const contractingProjects = useMemo(() => {
    return clientSummary?.projects.filter(p => (p as any).project_type === "contracting") || [];
  }, [clientSummary?.projects]);

  const finishingProjects = useMemo(() => {
    return clientSummary?.projects.filter(p => (p as any).project_type === "finishing") || [];
  }, [clientSummary?.projects]);

  const totalOutstanding = useMemo(() => {
    if (!clientSummary?.projects) return 0;
    if (selectedProjectId && selectedProjectId !== "none") {
      return selectedProjectData?.outstanding || 0;
    }
    return clientSummary.projects.reduce((sum, p) => sum + (p.outstanding || 0), 0);
  }, [clientSummary?.projects, selectedProjectId, selectedProjectData]);

  const totalPaid = useMemo(() => {
    if (!clientSummary?.projects) return 0;
    if (selectedProjectId && selectedProjectId !== "none") {
      return selectedProjectData?.paid || 0;
    }
    return clientSummary.projects.reduce((sum, p) => sum + (p.paid || 0), 0);
  }, [clientSummary?.projects, selectedProjectId, selectedProjectData]);

  const remaining = totalOutstanding - amount;
  const isSurplus = amount > totalOutstanding && totalOutstanding > 0;
  const surplus = isSurplus ? amount - totalOutstanding : 0;

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const parentTreasuries = useMemo(() =>
    treasuries?.filter(t => !t.parent_id) ?? [], [treasuries]);
  const subTreasuries = useMemo(() =>
    treasuries?.filter(t => !!t.parent_id) ?? [], [treasuries]);

  // اقتراح الخزينة الرئيسية بناءً على نوع المشروع
  const suggestedParentTreasuries = useMemo(() => {
    if (!parentTreasuries.length) return [];
    if (paymentProjectType === "all") return parentTreasuries;
    const matched = parentTreasuries.filter((t: any) => {
      if (t.project_category) return t.project_category === paymentProjectType;
      if (paymentProjectType === "contracting") return t.name.includes("مقاولات");
      if (paymentProjectType === "finishing") return t.name.includes("تشطيب");
      return false;
    });
    const others = parentTreasuries.filter((t: any) => !matched.some(m => m.id === t.id));
    return [...matched, ...others];
  }, [parentTreasuries, paymentProjectType]);

  const filteredChildTreasuries = useMemo(() => {
    if (!selectedParentTreasuryId) return [];
    let list = subTreasuries.filter(t => t.parent_id === selectedParentTreasuryId);
    if (paymentMethod === "cash") {
      list = list.filter(t => t.treasury_type === "cash");
    } else {
      list = list.filter(t => t.treasury_type === "bank");
    }
    return list;
  }, [subTreasuries, selectedParentTreasuryId, paymentMethod]);

  // ── اختيار الخزينة الرئيسية تلقائياً عند اختيار الزبون / تغيير المشروع ──
  useEffect(() => {
    if (!parentTreasuries.length) return;

    let matched: any = null;
    if (selectedProjectId && selectedProjectId !== "none" && paymentProjectType !== "all") {
      matched = parentTreasuries.find(
        (t: any) => t.project_category === paymentProjectType ||
          (paymentProjectType === "contracting" && t.name.includes("مقاولات")) ||
          (paymentProjectType === "finishing" && t.name.includes("تشطيب"))
      );
    }

    const targetParentId = matched ? matched.id : (selectedParentTreasuryId || parentTreasuries[0]?.id || "");
    
    if (targetParentId && targetParentId !== selectedParentTreasuryId) {
      setSelectedParentTreasuryId(targetParentId);
    }
  }, [selectedProjectId, paymentProjectType, parentTreasuries, selectedParentTreasuryId]);

  // ── اختيار الخزينة الفرعية تلقائياً عند تغير الخزينة الرئيسية أو طريقة الدفع ──
  useEffect(() => {
    if (filteredChildTreasuries.length > 0) {
      if (!selectedTreasuryId || !filteredChildTreasuries.some(t => t.id === selectedTreasuryId)) {
        setSelectedTreasuryId(filteredChildTreasuries[0].id);
      }
    } else {
      setSelectedTreasuryId("");
    }
  }, [filteredChildTreasuries, selectedTreasuryId]);

  // General audit log calculations
  const filteredAllPayments = useMemo(() => {
    if (!allPaymentsList) return [];
    if (!searchQuery) return allPaymentsList;
    const q = searchQuery.toLowerCase();
    return allPaymentsList.filter(p => {
      const cName = p.clients?.name?.toLowerCase() || "";
      const pName = p.projects?.name?.toLowerCase() || "";
      const noteText = p.notes?.toLowerCase() || "";
      const valStr = String(p.amount);
      return cName.includes(q) || pName.includes(q) || noteText.includes(q) || valStr.includes(q);
    });
  }, [allPaymentsList, searchQuery]);

  const totalFilteredSum = useMemo(() => {
    return filteredAllPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  }, [filteredAllPayments]);

  // ── save mutation ────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || amount <= 0 || !selectedTreasuryId) {
        throw new Error("يجب اختيار الزبون والخزينة وإدخال المبلغ");
      }

      const targetProjId = selectedProjectId && selectedProjectId !== "none" ? selectedProjectId : null;

      // 1. Insert Client Payment record
      const { data: payment, error: payErr } = await supabase
        .from("client_payments")
        .insert({
          client_id: selectedClientId,
          project_id: targetProjId,
          amount: amount,
          date: paymentDate,
          payment_method: paymentMethod,
          treasury_id: selectedTreasuryId,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (payErr) throw payErr;

      // 2. Log Income record
      await supabase.from("income").insert({
        project_id: targetProjId,
        client_id: selectedClientId,
        amount: amount,
        date: paymentDate,
        type: "service",
        subtype: "client_payment",
        payment_method: paymentMethod,
        notes: notes || (targetProjId ? `تسديد دفعة لمشروع` : `تسديد دفعة عامة (رصيد زبون)`),
        status: "received",
        reference_id: payment.id,
      });

      // 3. Log Treasury Transaction
      const clientObj = clients?.find((c) => c.id === selectedClientId);
      await supabase.from("treasury_transactions").insert({
        treasury_id: selectedTreasuryId,
        type: "deposit",
        amount: amount,
        balance_after: 0,
        description: `تسديد من الزبون: ${clientObj?.name || ""}`,
        date: paymentDate,
        source: "client_payment",
        reference_type: "client_payment",
        reference_id: payment.id,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-outstanding", selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ["projects-payments-total"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["client-payments-all-list"] });
      toast({ title: "تم تسجيل التسديد بنجاح" });
      setPaymentAmount("");
      setNotes("");
      setSelectedParentTreasuryId("");
      setSelectedTreasuryId("");
      setSelectedProjectId("");
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // Get allocations to restore purchase paid_amount
      const { data: allocs } = await supabase
        .from("client_payment_allocations")
        .select("reference_id, reference_type, amount")
        .eq("payment_id", paymentId);

      if (allocs && allocs.length > 0) {
        for (const alloc of allocs) {
          if (alloc.reference_type === "purchase" || alloc.reference_type === "rental") {
            const { data: purchase } = await supabase
              .from("purchases")
              .select("paid_amount, total_amount")
              .eq("id", alloc.reference_id)
              .maybeSingle();

            if (purchase) {
              const newPaid = Math.max(0, Number(purchase.paid_amount) - Number(alloc.amount));
              const newStatus = newPaid === 0 ? "due" : newPaid < Number(purchase.total_amount) ? "partial" : "paid";
              await supabase
                .from("purchases")
                .update({ paid_amount: newPaid, status: newStatus })
                .eq("id", alloc.reference_id);
            }
          }
        }
      }

      // Delete associated income transaction
      await supabase.from("income").delete().eq("reference_id", paymentId);

      // Delete associated treasury transaction
      await supabase.from("treasury_transactions").delete().eq("reference_id", paymentId);

      // Delete payment (cascade will handle allocations)
      const { error } = await supabase.from("client_payments").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-outstanding", selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ["projects-payments-total"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["client-payments-all-list"] });
      toast({ title: "تم حذف التسديد" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const [editingClientPayment, setEditingClientPayment] = useState<any | null>(null);
  const [editClientPayDialogOpen, setEditClientPayDialogOpen] = useState(false);
  const [editClientPayFormData, setEditClientPayFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    notes: "",
  });

  const updateClientPaymentMutation = useMutation({
    mutationFn: async (data: typeof editClientPayFormData) => {
      if (!editingClientPayment) return;
      const amountVal = parseFloat(data.amount);
      if (isNaN(amountVal) || amountVal <= 0) {
        throw new Error("يرجى إدخال مبلغ صحيح");
      }

      // Update client_payments
      const { error } = await supabase
        .from("client_payments")
        .update({
          amount: amountVal,
          date: data.date,
          payment_method: data.payment_method,
          treasury_id: data.treasury_id,
          notes: data.notes || null,
        })
        .eq("id", editingClientPayment.id);

      if (error) throw error;

      // Update associated income
      await supabase
        .from("income")
        .update({
          amount: amountVal,
          date: data.date,
          payment_method: data.payment_method,
          notes: data.notes || null,
        })
        .eq("reference_id", editingClientPayment.id);

      // Update associated treasury_transaction
      if (data.treasury_id) {
        const { error: txErr } = await supabase
          .from("treasury_transactions")
          .update({
            treasury_id: data.treasury_id,
            amount: amountVal,
            date: data.date,
            notes: data.notes || null,
          })
          .eq("reference_id", editingClientPayment.id);
        if (txErr) console.error("Error updating treasury tx:", txErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-outstanding", selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ["projects-payments-total"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["client-payments-all-list"] });
      toast({ title: "تم تحديث التسديد بنجاح" });
      setEditClientPayDialogOpen(false);
      setEditingClientPayment(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ في التحديث", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenEditClientPayment = (payment: any) => {
    setEditingClientPayment(payment);
    setEditClientPayFormData({
      amount: (payment.amount || 0).toString(),
      date: payment.date ? payment.date.split("T")[0] : new Date().toISOString().split("T")[0],
      payment_method: payment.payment_method || "cash",
      treasury_id: payment.treasury_id || "",
      notes: payment.notes || "",
    });
    setEditClientPayDialogOpen(true);
  };

  // ── printing logic ───────────────────────────────────────────────────────
  const handlePrint = async (payment: any) => {
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

    const clientName = payment.clients?.name || selectedClient?.name || "بدون عميل";
    const companyName = companySettings?.company_name || "شركة الفارس الذهبي للدعاية";
    const dateStr = format(new Date(payment.date), "dd/MM/yyyy");
    const matchedProjectName = payment.projects?.name || clientSummary?.projects?.find(p => p.id === payment.project_id)?.name || "رصيد عام للزبون";

    const borderStyle = `border: ${companySettings?.print_border_width ?? 1}px solid ${companySettings?.print_table_border_color || "#ccc"};`;

    const contentHtml = `
      <div class="print-area" style="box-shadow: none; margin: 0; padding: 20px; direction: rtl;">
        <!-- Header -->
        <div class="print-report-header" style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 12px;">
          <div class="print-report-company" style="font-size: 20pt; font-weight: bold; color: ${companySettings?.print_section_title_color || '#7A5A10'}; font-family: 'Tajawal', sans-serif;">${companyName}</div>
          <div class="print-report-title" style="font-size: 14pt; font-weight: bold; margin-top: 5px; font-family: 'Tajawal', sans-serif;">إيصال قبض مالي (Payment Receipt)</div>
          <div class="print-report-meta" style="font-size: 10pt; color: #666; margin-top: 5px; font-family: 'Tajawal', sans-serif;">
            رقم الإيصال: ${payment.id.split('-')[0].toUpperCase()} &nbsp;|&nbsp; التاريخ: ${dateStr}
          </div>
        </div>

        <!-- Info Table -->
        <div class="print-section" style="margin-bottom: 20px; font-family: 'Tajawal', sans-serif;">
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
                <td class="info-value" style="padding: 8px; ${borderStyle} font-weight: bold; font-size: 13pt; color: #15803d; font-family: 'Manrope', sans-serif;">${formatCurrencyLYD(Number(payment.amount))}</td>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle} width: 15%;">طريقة الدفع</td>
                <td class="info-value" style="padding: 8px; ${borderStyle} width: 25%;">
                  ${payment.payment_method === 'cash' ? 'نقداً (كاش)' : payment.payment_method === 'check' ? 'شيك مصرفي' : 'تحويل بنكي'}
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
          <div class="print-section" style="margin-bottom: 25px; font-family: 'Tajawal', sans-serif;">
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
                    <td style="padding: 8px; ${borderStyle} text-align: left; font-weight: bold; font-family: 'Manrope', sans-serif;">${formatCurrencyLYD(r.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          `;
        })()}

        <!-- Signatures -->
        <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; font-family: 'Tajawal', sans-serif;">
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
    openPrintWindow(windowTitle, contentHtml, companySettings);
  };

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">إيصالات مقبوضات الزبائن</h1>
            <p className="text-sm text-muted-foreground">تسجيل المدفوعات المستلمة من الزبائن</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ── Left: Quick Receipt Form (3/5) ── */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-bold text-sm">إضافة تسديد جديد</h2>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Client selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    الزبون / العميل <span className="text-destructive">*</span>
                  </Label>
                  {selectedClientId && (
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-xs text-destructive"
                      onClick={() => { setSelectedClientId(""); setPaymentAmount(""); }}
                    >
                      إلغاء الفلترة لعرض سجل المقبوضات العام
                    </Button>
                  )}
                </div>
                <Select value={selectedClientId} onValueChange={v => { setSelectedClientId(v); setPaymentAmount(""); setSelectedProjectId(""); setPaymentProjectType("all"); }} dir="rtl">
                  <SelectTrigger className="h-11 rounded-xl border-primary/20 focus:border-primary text-base">
                    <SelectValue placeholder="اختر الزبون..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project selector + General Treasury selector بجانب بعضهما */}
              {selectedClientId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* المشروع المستهدف */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      المشروع المستهدف
                      {selectedProjectData && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 mr-1 ${
                            paymentProjectType === "contracting"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                              : "bg-purple-500/10 border-purple-500/20 text-purple-700"
                          }`}
                        >
                          {paymentProjectType === "contracting" ? "مقاولات" : "تشطيبات"}
                        </Badge>
                      )}
                    </Label>
                    <Select
                      value={selectedProjectId}
                      onValueChange={(val) => {
                        setSelectedProjectId(val);
                      }}
                      dir="rtl"
                      disabled={summaryLoading}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-primary/20 focus:border-primary">
                        <SelectValue placeholder={summaryLoading ? "جاري التحميل..." : "اختر المشروع (أو رصيد عام)"} />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="none">بدون مشروع محدد (رصيد عام للزبون)</SelectItem>
                        {contractingProjects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-amber-700 dark:text-amber-400 font-bold">مشاريع المقاولات</SelectLabel>
                            {contractingProjects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                                {(p as any).outstanding > 0 ? ` — متبقي: ${((p as any).outstanding as number).toLocaleString("ar-LY")} د.ل` : " — مسدد"}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {finishingProjects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-purple-700 dark:text-purple-400 font-bold">مشاريع التشطيبات</SelectLabel>
                            {finishingProjects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                                {(p as any).outstanding > 0 ? ` — متبقي: ${((p as any).outstanding as number).toLocaleString("ar-LY")} د.ل` : " — مسدد"}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* القسم / الخزينة العامة */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-primary" />
                      القسم / الخزينة العامة <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedParentTreasuryId}
                      onValueChange={val => {
                        setSelectedParentTreasuryId(val);
                        setSelectedTreasuryId("");
                      }}
                      dir="rtl"
                      disabled={!selectedClientId}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-primary/20 focus:border-primary">
                        <SelectValue placeholder="اختر القسم..." />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {suggestedParentTreasuries.map((parent: any) => {
                          const isMatched = (parent.project_category === paymentProjectType || 
                                            (paymentProjectType === "contracting" && parent.name.includes("مقاولات")) || 
                                            (paymentProjectType === "finishing" && parent.name.includes("تشطيب"))) && paymentProjectType !== "all";
                          return (
                            <SelectItem key={parent.id} value={parent.id}>
                              <span className="flex items-center gap-1.5">
                                {isMatched && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                                {parent.name}
                                {isMatched && <span className="text-[10px] text-primary">(مقترح)</span>}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Outstanding summary (shows after client is selected) */}
              {selectedClientId && !summaryLoading && clientSummary && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
                    <p className="text-[11px] text-muted-foreground mb-1">المستحق على الزبون</p>
                    <p className="font-bold text-base text-destructive">
                      {formatCurrencyLYD(totalOutstanding)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                    <p className="text-[11px] text-muted-foreground mb-1">إجمالي ما سدّده</p>
                    <p className="font-bold text-base text-primary">
                      {formatCurrencyLYD(totalPaid)}
                    </p>
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  المبلغ المدفوع (د.ل) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-14 text-2xl font-bold text-center rounded-xl border-primary/20 focus:border-primary"
                    dir="ltr"
                    disabled={!selectedClientId}
                  />
                  {amount > 0 && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ل</span>
                  )}
                </div>

                {/* Remaining indicator */}
                {amount > 0 && selectedClientId && (
                  <div className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-colors ${
                    isSurplus
                      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-700"
                      : remaining > 0
                        ? "bg-orange-500/8 border-orange-500/20 text-orange-700"
                        : "bg-green-500/10 border-green-500/30 text-green-700"
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {isSurplus
                        ? <><AlertTriangle className="h-4 w-4" /> رصيد فائض سيُضاف</>
                        : remaining > 0
                          ? <><Receipt className="h-4 w-4" /> متبقي على الزبون</>
                          : <><CheckCircle2 className="h-4 w-4" /> المبلغ يغطي المستحق تماماً</>
                      }
                    </span>
                    <span>
                      {isSurplus
                        ? formatCurrencyLYD(surplus)
                        : remaining > 0
                          ? formatCurrencyLYD(remaining)
                          : "مغطى بالكامل"
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Date + Method */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">التاريخ</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="h-10 rounded-xl border-primary/20 focus:border-primary"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">طريقة الدفع</Label>
                  <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} dir="rtl">
                    <SelectTrigger className="h-10 rounded-xl border-primary/20 focus:border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> كاش</div>
                      </SelectItem>
                      <SelectItem value="check">
                        <div className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5" /> شيك</div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5" /> تحويل بنكي</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sub Treasury selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  الخزينة أو الحساب المستلم الفرعي <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedTreasuryId}
                  onValueChange={setSelectedTreasuryId}
                  disabled={!selectedParentTreasuryId}
                  dir="rtl"
                >
                  <SelectTrigger className="h-10 rounded-xl border-primary/20 focus:border-primary">
                    <SelectValue placeholder={selectedParentTreasuryId ? "اختر الحساب الفرعي..." : "حدد القسم أولاً"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredChildTreasuries.map(child => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name} ({child.treasury_type === 'cash' ? 'نقدي' : 'بنك'}) - رصيد: {formatCurrencyLYD(child.balance ?? 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">ملاحظات (اختياري)</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="أي ملاحظات عن هذا التسديد..."
                  className="rounded-xl border-primary/20 focus:border-primary text-sm resize-none"
                  rows={2}
                />
              </div>

              {/* Save button */}
              <Button
                className="w-full h-12 text-base font-bold rounded-xl gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={!selectedClientId || amount <= 0 || !selectedTreasuryId || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ إيصال القبض"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: General Receipts Log OR Client specific payments (2/5) ── */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedClientId ? (
            /* General Audit Log of all Receipts */
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm">سجل المقبوضات العام</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {filteredAllPayments.length} إيصال
                  </Badge>
                </div>
                {/* Search input */}
                <div className="mt-3 relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="ابحث باسم الزبون، المشروع، القيمة..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-9 text-xs rounded-xl border-border/60 pr-9 focus-visible:ring-primary"
                  />
                </div>
                {/* Total sum for audit */}
                <div className="mt-2 p-2 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between text-xs font-semibold">
                  <span>إجمالي المقبوضات المفحوصة:</span>
                  <span className="text-primary font-bold text-sm">{formatCurrencyLYD(totalFilteredSum)}</span>
                </div>
              </CardHeader>
              <CardContent className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                {loadingAllPayments ? (
                  <div className="p-8 text-center">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">جاري تحميل السجل...</p>
                  </div>
                ) : filteredAllPayments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Receipt className="h-8 w-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs">لا توجد إيصالات مقبوضات مطابقة للبحث</p>
                  </div>
                ) : filteredAllPayments.map(p => {
                  const clientName = (p as any).clients?.name || "بدون عميل";
                  const projObj = (p as any).projects;
                  const projTypeStr = projObj?.project_type === "contracting" ? "مقاولات" : projObj?.project_type === "finishing" ? "تشطيب" : "";
                  const projectName = projObj?.name ? `${projObj.name}${projTypeStr ? ` (${projTypeStr})` : ''}` : "رصيد عام للزبون";
                  const subTreasury = treasuries?.find(t => t.id === p.treasury_id);
                  const parentTreasury = subTreasury?.parent_id ? treasuries?.find(t => t.id === subTreasury.parent_id) : null;
                  const isExpanded = expandedIds.has(p.id);

                  return (
                    <Collapsible key={p.id} open={isExpanded} onOpenChange={() => toggleExpand(p.id)}>
                      <div className="rounded-lg border border-border/40 bg-card overflow-hidden transition-all hover:border-primary/20">
                        <div className="flex items-center">
                          <CollapsibleTrigger asChild>
                            <div className="flex-1 p-3 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer text-right">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-primary">{formatCurrencyLYD(Number(p.amount))}</p>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium">
                                    {p.payment_method === "cash" ? "كاش" : p.payment_method === "check" ? "شيك" : "تحويل"}
                                  </Badge>
                                </div>
                                <p className="text-[11px] font-semibold text-foreground truncate mt-0.5">
                                  {clientName}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span>{format(new Date(p.date), "dd MMM yyyy", { locale: ar })}</span>
                                  <span>·</span>
                                  <span className="font-medium text-foreground">{projectName}</span>
                                </p>
                                {subTreasury && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                                      <Landmark className="h-3 w-3" />
                                      القسم: {parentTreasury ? parentTreasury.name : "عام"} ⬅ الفرع: {subTreasury.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                            </div>
                          </CollapsibleTrigger>
                          <div className="flex items-center gap-1 px-2 border-r border-border/30">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:bg-blue-50 rounded-lg"
                              onClick={() => handleOpenEditClientPayment(p)}
                              title="تعديل التسديد"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:bg-accent rounded-lg"
                              onClick={() => handlePrint(p)}
                              title="طباعة الإيصال"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => setDeleteId(p.id)}
                              title="حذف التسديد"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1.5 text-xs text-muted-foreground space-y-1.5 border-t border-border/30 bg-muted/20">
                            {treasury && (
                              <div className="flex items-center gap-1.5">
                                {treasury.treasury_type === "cash" ? <Wallet className="h-3.5 w-3.5 text-primary" /> : <Landmark className="h-3.5 w-3.5 text-primary" />}
                                <span>الخزينة المودع فيها: {treasury.name}</span>
                              </div>
                            )}
                            {p.notes && <p className="leading-relaxed"><strong className="text-foreground">ملاحظات:</strong> {p.notes}</p>}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </CardContent>
            </Card>
          ) : (summaryLoading || !clientSummary) ? (
            <Card className="p-8 text-center">
              <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">جاري التحميل...</p>
            </Card>
          ) : (
            <>
              {/* Projects breakdown separated by Contracting & Finishing */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/30 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm">مشاريع {selectedClient?.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {contractingProjects.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
                        {contractingProjects.length} مقاولات
                      </Badge>
                    )}
                    {finishingProjects.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400">
                        {finishingProjects.length} تشطيبات
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-4">
                  {clientSummary?.projects.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">لا توجد مشاريع للزبون حالياً</p>
                  ) : (
                    <>
                      {/* Section 1: Contracting Projects */}
                      {contractingProjects.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              مشاريع المقاولات ({contractingProjects.length})
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              متبقي: {formatCurrencyLYD(contractingProjects.reduce((s, p) => s + p.outstanding, 0))}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {contractingProjects.map(proj => {
                              const isSelected = selectedProjectId === proj.id;
                              const afterPayment = amount > 0 && isSelected ? proj.outstanding - amount : null;
                              return (
                                <div
                                  key={proj.id}
                                  onClick={() => {
                                    setSelectedProjectId(proj.id);
                                    setSelectedParentTreasuryId("");
                                    setSelectedTreasuryId("");
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-500/10 shadow-sm"
                                      : "border-border/40 bg-muted/30 hover:bg-accent/50 hover:border-amber-500/30"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold truncate text-foreground">{proj.name}</p>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                                        مقاولات
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      سدّد: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrencyLYD(proj.paid)}</span>
                                    </p>
                                    {afterPayment !== null && isSelected && (
                                      <p className={`text-[10px] font-semibold mt-0.5 ${
                                        afterPayment <= 0 ? "text-emerald-600" : "text-orange-600"
                                      }`}>
                                        {afterPayment <= 0 ? "المتبقي بعد الدفع: مسدد بالكامل" : `المتبقي بعد الدفع: ${formatCurrencyLYD(afterPayment)}`}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-left shrink-0 mr-2">
                                    {proj.outstanding > 0 ? (
                                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/5 font-semibold">
                                        متبقي: {formatCurrencyLYD(proj.outstanding)}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5 font-semibold">
                                        مسدّد بالكامل
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section 2: Finishing Projects */}
                      {finishingProjects.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5" />
                              مشاريع التشطيبات ({finishingProjects.length})
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              متبقي: {formatCurrencyLYD(finishingProjects.reduce((s, p) => s + p.outstanding, 0))}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {finishingProjects.map(proj => {
                              const isSelected = selectedProjectId === proj.id;
                              const afterPayment = amount > 0 && isSelected ? proj.outstanding - amount : null;
                              return (
                                <div
                                  key={proj.id}
                                  onClick={() => {
                                    setSelectedProjectId(proj.id);
                                    setSelectedParentTreasuryId("");
                                    setSelectedTreasuryId("");
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? "border-purple-500 bg-purple-500/10 shadow-sm"
                                      : "border-border/40 bg-muted/30 hover:bg-accent/50 hover:border-purple-500/30"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold truncate text-foreground">{proj.name}</p>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400 shrink-0">
                                        تشطيبات
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      سدّد: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrencyLYD(proj.paid)}</span>
                                    </p>
                                    {afterPayment !== null && isSelected && (
                                      <p className={`text-[10px] font-semibold mt-0.5 ${
                                        afterPayment <= 0 ? "text-emerald-600" : "text-orange-600"
                                      }`}>
                                        {afterPayment <= 0 ? "المتبقي بعد الدفع: مسدد بالكامل" : `المتبقي بعد الدفع: ${formatCurrencyLYD(afterPayment)}`}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-left shrink-0 mr-2">
                                    {proj.outstanding > 0 ? (
                                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/5 font-semibold">
                                        متبقي: {formatCurrencyLYD(proj.outstanding)}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5 font-semibold">
                                        مسدّد بالكامل
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* تلميح: كيفية دفع الموردين والفنيين */}
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-[10px] text-muted-foreground">
                        <p className="font-semibold text-foreground mb-0.5">ملاحظة هامة:</p>
                        <p>هذه المعلومات تساعدك في تحديد المبلغ المناسب فقط. لدفع الموردين والفنيين، ادخل لصفحة المورد أو الفني واختر المشروع لتسجيل الدفع من الخزينة.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Payment history for the specific client */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2 border-b border-border/30 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm">سجل المقبوضات الخاص بالزبون</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">{clientSummary?.payments.length || 0}</Badge>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                  {!clientSummary?.payments.length ? (
                    <p className="text-xs text-muted-foreground text-center py-4">لا توجد تسديدات مسجلة للزبون</p>
                  ) : clientSummary.payments.map(p => {
                    const projectName = clientSummary.projects.find(proj => proj.id === p.project_id)?.name;
                    const treasury = treasuries?.find(t => t.id === p.treasury_id);
                    const isExpanded = expandedIds.has(p.id);
                    return (
                      <Collapsible key={p.id} open={isExpanded} onOpenChange={() => toggleExpand(p.id)}>
                        <div className="rounded-lg border border-border/40 bg-card overflow-hidden transition-all hover:border-primary/20">
                          <div className="flex items-center">
                            <CollapsibleTrigger asChild>
                              <div className="flex-1 p-3 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer text-right">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm text-primary">{formatCurrencyLYD(Number(p.amount))}</p>
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                      {p.payment_method === "cash" ? "كاش" : p.payment_method === "check" ? "شيك" : "تحويل"}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {format(new Date(p.date), "dd MMM yyyy", { locale: ar })} · {projectName || "رصيد عام للزبون"}
                                  </p>
                                </div>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                              </div>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-1 px-2 border-r border-border/30">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:bg-blue-50 rounded-lg"
                                onClick={() => handleOpenEditClientPayment(p)}
                                title="تعديل التسديد"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:bg-accent rounded-lg"
                                onClick={() => handlePrint(p)}
                                title="طباعة الإيصال"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => setDeleteId(p.id)}
                                title="حذف التسديد"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1.5 text-xs text-muted-foreground space-y-1.5 border-t border-border/30 bg-muted/20">
                              {treasury && (
                                <div className="flex items-center gap-1.5">
                                  {treasury.treasury_type === "cash" ? <Wallet className="h-3.5 w-3.5 text-primary" /> : <Landmark className="h-3.5 w-3.5 text-primary" />}
                                  <span>الخزينة المودع فيها: {treasury.name}</span>
                                </div>
                              )}
                              {p.notes && <p className="leading-relaxed"><strong className="text-foreground">ملاحظات:</strong> {p.notes}</p>}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التسديد</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا التسديد؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Client Payment Dialog */}
      <Dialog open={editClientPayDialogOpen} onOpenChange={setEditClientPayDialogOpen}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات تسديد الزبون</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_cp_amount">مبلغ التسديد (د.ل) *</Label>
              <Input
                id="edit_cp_amount"
                type="number"
                step="0.001"
                placeholder="أدخل المبلغ"
                value={editClientPayFormData.amount}
                onChange={(e) => setEditClientPayFormData({ ...editClientPayFormData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_cp_date">تاريخ التسديد *</Label>
              <Input
                id="edit_cp_date"
                type="date"
                value={editClientPayFormData.date}
                onChange={(e) => setEditClientPayFormData({ ...editClientPayFormData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_cp_method">طريقة الدفع *</Label>
              <select
                id="edit_cp_method"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editClientPayFormData.payment_method}
                onChange={(e) => setEditClientPayFormData({ ...editClientPayFormData, payment_method: e.target.value })}
              >
                <option value="cash">نقداً (كاش)</option>
                <option value="check">صك بنكي (شيك)</option>
                <option value="transfer">تحويل بنكي</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_cp_treasury">الخزينة المودع فيها *</Label>
              <select
                id="edit_cp_treasury"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editClientPayFormData.treasury_id}
                onChange={(e) => setEditClientPayFormData({ ...editClientPayFormData, treasury_id: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {treasuries?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_cp_notes">ملاحظات</Label>
              <Textarea
                id="edit_cp_notes"
                placeholder="أدخل ملاحظات"
                value={editClientPayFormData.notes}
                onChange={(e) => setEditClientPayFormData({ ...editClientPayFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditClientPayDialogOpen(false)}
              disabled={updateClientPaymentMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => updateClientPaymentMutation.mutate(editClientPayFormData)}
              disabled={updateClientPaymentMutation.isPending || !editClientPayFormData.amount || !editClientPayFormData.treasury_id}
            >
              {updateClientPaymentMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPayments;
