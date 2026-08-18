import { useState, useMemo } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  ArrowRight,
  Plus,
  Wallet,
  Landmark,
  CreditCard,
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart,
  Wrench,
  Printer,
  Download,
  Users,
  Building2,
  CheckCircle2,
  Coins,
  Sparkles,
} from "lucide-react";
import { TreasurySelector } from "@/components/treasury/TreasurySelector";
import { openPrintWindow, getPrintValues, generatePrintStyles } from "@/lib/printStyles";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";

interface UnpaidInvoice {
  id: string;
  type: string;
  description: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  service_fee: number;
  service_fee_percentage: number;
  phase_id: string | null;
  phase_name: string | null;
  phase_treasury_id: string | null;
  source_treasury_id: string | null;
  source_treasury_name: string | null;
  date: string;
  supplier_name?: string | null;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "purchase": return <ShoppingCart className="h-4 w-4 text-primary" />;
    case "rental": return <Wrench className="h-4 w-4 text-primary" />;
    case "item": return <Package className="h-4 w-4 text-primary" />;
    default: return <Receipt className="h-4 w-4 text-primary" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "purchase": return "مشتريات";
    case "rental": return "إيجار معدات";
    case "item": return "بند مقاولات";
    default: return type;
  }
};

const ProjectPayments = () => {
  const { id: urlProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [printDialogPayment, setPrintDialogPayment] = useState<any | null>(null);
  const [includeAllocationDetails, setIncludeAllocationDetails] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

  // General selectors state
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const activeProjectId = urlProjectId || selectedProjectId;

  // Fetch all clients
  const { data: allClients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !urlProjectId,
  });

  // Fetch client projects
  const { data: clientProjects } = useQuery({
    queryKey: ["client-projects-all", selectedClientId],
    queryFn: async () => {
      let query = supabase.from("projects").select("id, name, client_id");
      if (selectedClientId && selectedClientId !== "__all__") {
        query = query.eq("client_id", selectedClientId);
      }
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !urlProjectId,
  });

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ["project", activeProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name)")
        .eq("id", activeProjectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeProjectId,
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

  // Fetch treasuries
  const { data: allTreasuries } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, parent_id, treasury_type, is_active, balance")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch phases
  const { data: phases } = useQuery({
    queryKey: ["project-phases", activeProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, phase_number, treasury_id, has_percentage, percentage_value")
        .eq("project_id", activeProjectId!)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!activeProjectId,
  });

  // Fetch existing payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ["client-payments", activeProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*")
        .eq("project_id", activeProjectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeProjectId,
  });

  // Fetch payment allocations for all payments
  const { data: allAllocations } = useQuery({
    queryKey: ["payment-allocations", activeProjectId],
    queryFn: async () => {
      if (!payments?.length) return [];
      const paymentIds = payments.map(p => p.id);
      const { data, error } = await supabase
        .from("client_payment_allocations")
        .select("*")
        .in("payment_id", paymentIds);
      if (error) throw error;
      return data;
    },
    enabled: !!payments && payments.length > 0,
  });

  // Fetch purchases referenced by allocations
  const allocationRefIds = allAllocations?.map(a => a.reference_id) || [];
  const { data: allocPurchases } = useQuery({
    queryKey: ["alloc-purchases", allocationRefIds],
    queryFn: async () => {
      if (!allocationRefIds.length) return [];
      const { data, error } = await supabase
        .from("purchases")
        .select("id, date, invoice_number, supplier_id, suppliers:supplier_id(name)")
        .in("id", allocationRefIds);
      if (error) throw error;
      return data;
    },
    enabled: allocationRefIds.length > 0,
  });

  // Fetch unpaid invoices
  const { data: unpaidInvoices } = useQuery({
    queryKey: ["unpaid-invoices", activeProjectId],
    queryFn: async () => {
      const invoices: UnpaidInvoice[] = [];

      // 1. Purchases (non-rental)
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, date, phase_id, invoice_number, supplier_id, rental_id, treasury_id, suppliers:supplier_id(name)")
        .eq("project_id", activeProjectId!)
        .is("rental_id", null);

      const { data: existingAllocations } = await supabase
        .from("client_payment_allocations")
        .select("reference_id, amount")
        .in("reference_id", [...(purchases?.map(p => p.id) || [])]);

      const allocatedMap: Record<string, number> = {};
      existingAllocations?.forEach(a => {
        allocatedMap[a.reference_id] = (allocatedMap[a.reference_id] || 0) + Number(a.amount);
      });

      purchases?.forEach(p => {
        const totalAllocated = allocatedMap[p.id] || 0;
        const remaining = Number(p.total_amount) - totalAllocated;
        if (remaining > 0) {
          const srcTreasury = allTreasuries?.find(t => t.id === (p as any).treasury_id);
          const srcParent = srcTreasury?.parent_id ? allTreasuries?.find(t => t.id === srcTreasury.parent_id) : null;
          const phase = phases?.find(ph => ph.id === p.phase_id);
          const pct = phase?.has_percentage 
            ? Number(phase.percentage_value) 
            : (project?.project_type === "finishing" ? Number(project.finishing_percentage || 0) : 0);
          invoices.push({
            id: p.id, type: "purchase",
            description: `فاتورة مشتريات ${p.invoice_number || ''}`.trim(),
            total_amount: Number(p.total_amount), paid_amount: totalAllocated, remaining,
            service_fee: pct > 0 ? remaining * pct / 100 : 0, service_fee_percentage: pct,
            phase_id: p.phase_id, phase_name: phase?.name || null,
            phase_treasury_id: phase?.treasury_id || null,
            source_treasury_id: (p as any).treasury_id || null,
            source_treasury_name: srcTreasury ? (srcParent ? `${srcParent.name} / ${srcTreasury.name}` : srcTreasury.name) : null,
            date: p.date, supplier_name: (p.suppliers as any)?.name,
          });
        }
      });

      // 2. Rental purchases
      const { data: rentalPurchases } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, date, phase_id, rental_id, treasury_id, suppliers:supplier_id(name)")
        .eq("project_id", activeProjectId!)
        .not("rental_id", "is", null);

      const rentalIds = rentalPurchases?.map(r => r.id) || [];
      if (rentalIds.length > 0) {
        const { data: rentalAllocs } = await supabase
          .from("client_payment_allocations")
          .select("reference_id, amount")
          .in("reference_id", rentalIds);
        rentalAllocs?.forEach(a => {
          allocatedMap[a.reference_id] = (allocatedMap[a.reference_id] || 0) + Number(a.amount);
        });
      }

      rentalPurchases?.forEach(p => {
        const totalAllocated = allocatedMap[p.id] || 0;
        const remaining = Number(p.total_amount) - totalAllocated;
        if (remaining > 0) {
          const srcTreasury = allTreasuries?.find(t => t.id === (p as any).treasury_id);
          const srcParent = srcTreasury?.parent_id ? allTreasuries?.find(t => t.id === srcTreasury.parent_id) : null;
          const phase = phases?.find(ph => ph.id === p.phase_id);
          const pct = phase?.has_percentage 
            ? Number(phase.percentage_value) 
            : (project?.project_type === "finishing" ? Number(project.finishing_percentage || 0) : 0);
          invoices.push({
            id: p.id, type: "rental",
            description: `فاتورة إيجار معدات`,
            total_amount: Number(p.total_amount), paid_amount: totalAllocated, remaining,
            service_fee: pct > 0 ? remaining * pct / 100 : 0, service_fee_percentage: pct,
            phase_id: p.phase_id, phase_name: phase?.name || null,
            phase_treasury_id: phase?.treasury_id || null,
            source_treasury_id: (p as any).treasury_id || null,
            source_treasury_name: srcTreasury ? (srcParent ? `${srcParent.name} / ${srcTreasury.name}` : srcTreasury.name) : null,
            date: p.date, supplier_name: (p.suppliers as any)?.name,
          });
        }
      });

      // 3. Project items
      const { data: items } = await supabase
        .from("project_items")
        .select("id, name, total_price, phase_id")
        .eq("project_id", activeProjectId!);

      const itemIds = items?.map(i => i.id) || [];
      if (itemIds.length > 0) {
        const { data: itemAllocs } = await supabase
          .from("client_payment_allocations")
          .select("reference_id, amount")
          .in("reference_id", itemIds);
        itemAllocs?.forEach(a => {
          allocatedMap[a.reference_id] = (allocatedMap[a.reference_id] || 0) + Number(a.amount);
        });
      }

      items?.forEach(item => {
        const totalAllocated = allocatedMap[item.id] || 0;
        const remaining = Number(item.total_price) - totalAllocated;
        if (remaining > 0) {
          const phase = phases?.find(ph => ph.id === item.phase_id);
          const pct = phase?.has_percentage ? Number(phase.percentage_value) : 0;
          invoices.push({
            id: item.id, type: "item",
            description: `بند: ${item.name}`,
            total_amount: Number(item.total_price), paid_amount: totalAllocated, remaining,
            service_fee: pct > 0 ? remaining * pct / 100 : 0,
            service_fee_percentage: pct,
            phase_id: item.phase_id, phase_name: phase?.name || null,
            phase_treasury_id: phase?.treasury_id || null,
            source_treasury_id: phase?.treasury_id || null,
            source_treasury_name: (() => {
              const phaseTid = phase?.treasury_id;
              if (!phaseTid) return null;
              const t = allTreasuries?.find(tr => tr.id === phaseTid);
              const p = t?.parent_id ? allTreasuries?.find(tr => tr.id === t.parent_id) : null;
              return t ? (p ? `${p.name} / ${t.name}` : t.name) : null;
            })(),
            date: "",
          });
        }
      });

      return invoices;
    },
    enabled: !!activeProjectId && !!phases,
  });

  // Pure Project-Level Receipt Form State
  const initialReceiptForm = {
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    receipt_number: "",
    notes: "",
  };

  const [receiptForm, setReceiptForm] = useState(initialReceiptForm);
  const resetReceiptForm = () => setReceiptForm(initialReceiptForm);

  // Group treasuries by parent
  const groupedTreasuries = useMemo(() => {
    if (!allTreasuries) return [];
    const parents = allTreasuries.filter(t => !t.parent_id);
    return parents.map(p => ({
      parent: p,
      children: allTreasuries.filter(t => t.parent_id === p.id),
    }));
  }, [allTreasuries]);

  // Project financials summary
  const totalPaidSoFar = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const projectTotalObligation = useMemo(() => {
    if (!project) return 0;
    if (project.project_type === "contracting") {
      return Number((project as any).total_agreed_price || project.budget || 0);
    }
    const totalPurchasesCost = (unpaidInvoices || []).reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const serviceFeePct = Number(project.finishing_percentage || 0);
    return totalPurchasesCost * (1 + serviceFeePct / 100);
  }, [project, unpaidInvoices]);

  const projectRemainingBefore = Math.max(0, projectTotalObligation - totalPaidSoFar);
  const enteredAmountNum = parseFloat(receiptForm.amount) || 0;
  const projectRemainingAfter = Math.max(0, projectRemainingBefore - enteredAmountNum);
  const creditCreatedPreview = enteredAmountNum > projectRemainingBefore ? enteredAmountNum - projectRemainingBefore : 0;

  // Pure Project-Level Client Receipt Mutation
  const saveReceiptMutation = useMutation({
    mutationFn: async (formData: typeof receiptForm) => {
      const amountNum = parseFloat(formData.amount);
      if (!amountNum || amountNum <= 0) {
        throw new Error("يرجى إدخال قيمة دفعة صالحة أكبر من الصفر");
      }
      if (!formData.treasury_id) {
        throw new Error("يرجى اختيار الخزينة المودع بها المبلغ");
      }

      // Insert payment into client_payments (single authoritative record)
      const { data: payment, error: paymentError } = await supabase
        .from("client_payments")
        .insert({
          project_id: activeProjectId!,
          client_id: project?.client_id || null,
          amount: amountNum,
          date: formData.date,
          payment_method: formData.payment_method,
          treasury_id: formData.treasury_id,
          receipt_number: formData.receipt_number || null,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Add to income table for reporting
      await supabase.from("income").insert({
        project_id: activeProjectId!,
        client_id: project?.client_id || null,
        amount: amountNum,
        date: formData.date,
        type: "service",
        subtype: "client_payment",
        payment_method: formData.payment_method,
        notes: formData.notes || `تسديد دفعة للمشروع: ${project?.name || ""}`,
        status: "received",
      });

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["client-credit-balance"] });
      toast({ title: "تم تسجيل الدفعة بنجاح" });
      resetReceiptForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تسجيل الدفعة",
        variant: "destructive",
      });
    },
  });

  const isReceiptFormDirty = useMemo(() => {
    if (!dialogOpen) return false;
    return (
      (parseFloat(receiptForm.amount) || 0) > 0 ||
      receiptForm.notes.trim().length > 0 ||
      receiptForm.receipt_number.trim().length > 0
    );
  }, [dialogOpen, receiptForm]);

  const isSubmittingReceipt = saveReceiptMutation.isPending;

  const {
    showConfirmDialog: showUnsavedDialog,
    setShowConfirmDialog,
    requestAction,
    confirmDiscard: handleConfirmDiscard,
    cancelDiscard: handleCancelDiscard,
  } = useUnsavedChangesGuard({
    isDirty: isReceiptFormDirty,
    isSubmitting: isSubmittingReceipt,
    onDiscard: () => {
      resetReceiptForm();
      setDialogOpen(false);
    },
  });

  const handleReceiptDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (isSubmittingReceipt) return; // Block closing while mutation in-flight
      if (isReceiptFormDirty) {
        requestAction(() => {
          resetReceiptForm();
          setDialogOpen(false);
        });
      } else {
        resetReceiptForm();
        setDialogOpen(false);
      }
    } else {
      setDialogOpen(true);
    }
  };

  const handleReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveReceiptMutation.mutate(receiptForm);
  };

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // 1. Fetch payment details first
      const { data: payment } = await supabase
        .from("client_payments")
        .select("amount, date")
        .eq("id", paymentId)
        .maybeSingle();

      // 2. Delete from income table
      if (payment) {
        await supabase
          .from("income")
          .delete()
          .eq("project_id", activeProjectId!)
          .eq("amount", payment.amount)
          .eq("date", payment.date)
          .eq("subtype", "client_payment");
      }

      const { error } = await supabase.from("client_payments").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-invoices", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["payment-allocations", activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم حذف التسديد بنجاح" });
      setDeletePaymentId(null);
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const togglePaymentExpand = (id: string) => {
    setExpandedPayments(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handlePrintReceipt = async (payment: any, includeAlloc: boolean, action: 'print' | 'pdf') => {
    const paymentAllocs = includeAlloc ? (allAllocations?.filter(a => a.payment_id === payment.id) || []) : [];
    const clientName = (project?.clients as any)?.name || "بدون عميل";
    const companyName = companySettings?.company_name || "شركة الفارس الذهبي للدعاية";
    const dateStr = format(new Date(payment.date), "dd/MM/yyyy");

    const borderStyle = `border: 1px solid ${companySettings?.print_table_border_color || "#ccc"};`;

    const contentHtml = `
      <div class="print-area" style="box-shadow: none; margin: 0; padding: 20px;">
        <!-- Header -->
        <div class="print-report-header" style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 12px;">
          <div class="print-report-company" style="font-size: 20pt; font-weight: bold; color: ${companySettings?.print_section_title_color || '#7A5A10'};">${companyName}</div>
          <div class="print-report-title" style="font-size: 14pt; font-weight: bold; margin-top: 5px;">إيصال قبض مالي (Payment Receipt)</div>
          <div class="print-report-meta" style="font-size: 10pt; color: #666; margin-top: 5px;">
            رقم الإيصال: ${payment.id.split('-')[0].toUpperCase()} &nbsp;|&nbsp; التاريخ: ${dateStr}
          </div>
        </div>

        <!-- Info Table -->
        <div class="print-section" style="margin-bottom: 20px;">
          <table class="print-info-table" style="width: 100%; border-collapse: collapse; margin-top: 10px; ${borderStyle}">
            <tbody>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle} width: 25%;">استلمنا من السيد / السادة</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${clientName}</td>
              </tr>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">وذلك عن مشروع</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${project?.name || "بدون مشروع"}</td>
              </tr>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">مبلـغ وقدره</td>
                <td class="info-value" style="padding: 8px; ${borderStyle} font-weight: bold; font-size: 13pt; color: #15803d;">${formatCurrencyLYD(Number(payment.amount))}</td>
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

        <!-- Allocations list if available -->
        ${(() => {
          if (!paymentAllocs || paymentAllocs.length === 0) return '';
          
          const processedAllocs = paymentAllocs.map(alloc => {
            const purchase = allocPurchases?.find(p => p.id === alloc.reference_id);
            const phase = phases?.find(p => p.id === alloc.phase_id);
            const desc = alloc.reference_type === 'purchase' ? 'مشتريات' : alloc.reference_type === 'rental' ? 'إيجار معدات' : 'بند مقاولات';
            
            const cleanRefNum = purchase?.invoice_number ? `فاتورة رقم ${purchase.invoice_number}` : '';
            const displayRefNum = (cleanRefNum === "" || cleanRefNum === "-") ? "" : cleanRefNum;

            const cleanPhaseName = (phase?.name || "").trim();
            const displayPhaseName = (cleanPhaseName === "" || cleanPhaseName === "-") ? "" : cleanPhaseName;

            return {
              desc,
              refNum: displayRefNum,
              phaseName: displayPhaseName,
              amount: Number(alloc.amount)
            };
          });

          const hasRefNum = processedAllocs.some(r => r.refNum !== "");
          const hasPhase = processedAllocs.some(r => r.phaseName !== "");

          // Distribute remaining width dynamically (Fixed: Amount = 20%, Type = 30%. Remaining = 50%)
          const varCols = [
            { key: 'refNum', header: "رقم المرجع / التفاصيل", defaultWidth: 25, align: "center", active: hasRefNum },
            { key: 'phaseName', header: "المرحلة", defaultWidth: 25, align: "right", active: hasPhase }
          ];
          const activeVar = varCols.filter(c => c.active);
          const totalVarDefault = activeVar.reduce((sum, c) => sum + c.defaultWidth, 0);

          const cols = [
            { header: "نوع الفاتورة / البند", width: activeVar.length > 0 ? "30%" : "80%", align: "right", render: (r: any) => `${r.desc}` },
            ...activeVar.map(c => {
              const w = totalVarDefault > 0 ? Math.round((c.defaultWidth / totalVarDefault) * 50) : 50;
              return {
                header: c.header,
                width: `${w}%`,
                align: c.align,
                render: (r: any) => `${r[c.key] || "-"}`
              };
            }),
            { header: "المبلغ المستقطع", width: "20%", align: "left", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.amount)}</span>` }
          ];

          return `
          <div class="print-section" style="margin-bottom: 25px;">
            <div class="print-section-title" style="font-weight: bold; font-size: 12pt; color: ${companySettings?.print_section_title_color || '#7A5A10'}; border-bottom: 1.5px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 4px; margin-bottom: 8px;">تفاصيل تسوية وتوزيع الدفعة</div>
            <table class="print-table" style="width: 100%; border-collapse: collapse; text-align: right; ${borderStyle}">
              <thead>
                <tr style="background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'};">
                  ${cols.map(c => `<th style="width: ${c.width}; padding: 8px; ${borderStyle} text-align: ${c.align === 'left' ? 'left' : c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${processedAllocs.map(r => `
                  <tr>
                    ${cols.map(c => `<td style="padding: 8px; ${borderStyle} text-align: ${c.align === 'left' ? 'left' : c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          `;
        })()}

        <!-- Signatures -->
        <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px;">
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

    const title = `إيصال_قبض_${payment.id.split('-')[0].toUpperCase()}`;
    const filename = `${title}.pdf`;

    if (action === 'print') {
      const windowTitle = `إيصال ${payment.id.split('-')[0].toUpperCase()} - ${clientName} - ${project?.name || "بدون مشروع"}`;
      openPrintWindow(windowTitle, contentHtml, companySettings);
    } else {
      setIsPdfLoading(true);
      try {
        const v = getPrintValues(companySettings);
        const headHeight = v.padTop;
        const footHeight = v.padBottom;

        const printHeaderHtml = v.printHeaderEnabled ? `
          <div class="unified-print-header" style="display: flex; justify-content: space-between; align-items: center; direction: rtl; width: 100%; font-family: '${v.printFontFamily}', 'Tajawal', 'Segoe UI', sans-serif;">
            <div style="display: flex; align-items: center; gap: 4mm;">
              ${v.companyLogo ? `<img src="${v.companyLogo}" style="height: 15mm; max-height: 18mm; object-fit: contain; vertical-align: middle;" />` : ''}
              <div style="text-align: right; vertical-align: middle;">
                <div style="font-size: 16pt; font-weight: 800; color: ${v.sectionTitleColor}; line-height: 1.2;">${v.companyName}</div>
                <div style="font-size: 8.5pt; color: #666; margin-top: 0.5mm;">منظومة إدارة المقاولات</div>
              </div>
            </div>
            
            <div style="text-align: left; font-size: 9.5pt; color: #333; line-height: 1.4; direction: ltr;">
              <div style="font-weight: bold; font-size: 11pt; color: ${v.sectionTitleColor}; direction: rtl;">إيصال قبض مالي (Payment Receipt)</div>
              <div style="font-size: 9pt; color: #444; direction: rtl; margin-top: 0.5mm;">${project?.name || "بدون مشروع"}</div>
              <div style="font-size: 8.5pt; color: #666; direction: rtl; margin-top: 0.5mm;">رقم الإيصال: ${payment.id.split('-')[0].toUpperCase()} | التاريخ: ${dateStr}</div>
            </div>
          </div>
        ` : '';

        const printWrapper = document.createElement("div");
        printWrapper.innerHTML = `
          <style>
            ${generatePrintStyles(companySettings)}
            .print-layout-table {
              width: 100%;
              border-collapse: collapse;
            }
            .print-layout-table thead {
              display: table-header-group !important;
            }
            .print-layout-table tfoot {
              display: table-footer-group !important;
            }
            .print-area {
              width: 100% !important;
              margin: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
              background-image: none !important;
              background-color: transparent !important;
            }
            .print-area::before {
              display: none !important;
            }
            .print-area .print-footer,
            .print-area .print-date {
              display: none !important;
            }
            .print-page-number {
              display: none !important;
            }
          </style>
          
          <table class="print-layout-table">
            <thead>
              <tr>
                <td>
                  <div style="height: ${v.printHeaderEnabled ? 'auto' : `${headHeight}mm`}; ${v.printHeaderEnabled ? `padding: 10mm ${v.padRight}mm 4mm ${v.padLeft}mm; border-bottom: 2px solid ${v.sectionTitleColor}; margin-bottom: 5mm;` : ''}">
                    ${printHeaderHtml}
                  </div>
                </td>
              </tr>
            </thead>
             <tbody>
               <tr>
                 <td style="padding: 0 ${v.padRight}mm 0 ${v.padLeft}mm;">
                   ${contentHtml}
                 </td>
               </tr>
             </tbody>
            <tfoot>
              <tr>
                <td>
                  <div style="height: ${footHeight}mm;"></div>
                </td>
              </tr>
            </tfoot>
          </table>
        `;
        document.body.appendChild(printWrapper);
        
        const opt = {
          margin: 0,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css'] }
        };

        const html2pdf = (await import("html2pdf.js")).default;
        await html2pdf().set(opt).from(printWrapper).toPdf().get('pdf').then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(v.padLeft, 297 - v.footerBottom - 4.5, 32, 7, 'F');
            pdf.setFontSize(9);
            pdf.setTextColor(85, 85, 85);
            pdf.text(i + " / " + totalPages, v.padLeft + 1, 297 - v.footerBottom);
          }
        }).save();
        document.body.removeChild(printWrapper);
        toast({ title: "تم حفظ الملف بنجاح" });
      } catch (error) {
        console.error("PDF export error:", error);
        toast({ title: "فشل حفظ الملف", variant: "destructive" });
      } finally {
        setIsPdfLoading(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const content = (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تحصيلات العميل</h1>
            <p className="text-xs text-muted-foreground">
              {project ? "إيصالات مقبوضات ودفعات الزبون على حساب المشروع" : "اختر الزبون والمشروع لعرض التسديدات"}
            </p>
          </div>
        </div>
        {activeProjectId && (
          <Button onClick={handleOpenDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            تسديد جديد
          </Button>
        )}
      </div>

      {/* Client / Project Selector (general mode - no URL project) */}
      {!urlProjectId && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-bold text-sm text-primary">اختر الزبون والمشروع</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Users className="h-3 w-3 text-primary" />
                  الزبون / العميل
                </Label>
                <Select
                  value={selectedClientId}
                  onValueChange={(v) => {
                    setSelectedClientId(v);
                    setSelectedProjectId("");
                  }}
                  dir="rtl"
                >
                  <SelectTrigger className="h-10 rounded-xl border-primary/20 focus:border-primary">
                    <SelectValue placeholder="اختر الزبون..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">جميع الزبائن</SelectItem>
                    {allClients?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  المشروع
                </Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  dir="rtl"
                  disabled={!clientProjects?.length}
                >
                  <SelectTrigger className="h-10 rounded-xl border-primary/20 focus:border-primary">
                    <SelectValue placeholder={clientProjects?.length ? "اختر المشروع..." : "اختر الزبون أولاً..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientProjects?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedProjectId && project && (
              <div className="mt-3 p-2.5 bg-primary/5 border border-primary/15 rounded-lg flex items-center justify-between">
                <span className="text-xs text-primary font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-600" /> تم تحديد: {project.name}
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground px-2" onClick={() => setSelectedProjectId("")}>
                  تغيير
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - only when project selected */}
      {activeProjectId && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التسديدات</p>
                <p className="text-xl font-bold">{formatCurrencyLYD(payments?.reduce((s, p) => s + Number(p.amount), 0) || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Receipt className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الفواتير الغير مسددة</p>
                <p className="text-xl font-bold">{unpaidInvoices?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المستحق</p>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrencyLYD(unpaidInvoices?.reduce((s, i) => s + i.remaining, 0) || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Payments List */}
      {!activeProjectId ? (
        <Card className="p-12 text-center border-dashed border-2 border-muted-foreground/20">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2 text-muted-foreground">اختر زبوناً ومشروعاً</h3>
          <p className="text-sm text-muted-foreground/70">حدد الزبون والمشروع من القائمة أعلاه لعرض التسديدات والفواتير المستحقة</p>
        </Card>
      ) : payments?.length === 0 ? (
        <Card className="p-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد تسديدات</h3>
          <p className="text-muted-foreground mb-4">ابدأ بإضافة تسديد جديد من الزبون</p>
          <Button onClick={handleOpenDialog}>
            <Plus className="h-4 w-4 ml-2" />
            تسديد جديد
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments?.map(payment => {
            const paymentAllocs = allAllocations?.filter(a => a.payment_id === payment.id) || [];
            const isExpanded = expandedPayments.has(payment.id);
            const treasury = allTreasuries?.find(t => t.id === payment.treasury_id);
            const totalAllocated = paymentAllocs.reduce((s, a) => s + Number(a.amount), 0);
            const surplusAmount = Math.max(0, Number(payment.amount) - totalAllocated);

            return (
              <Collapsible key={payment.id} open={isExpanded} onOpenChange={() => togglePaymentExpand(payment.id)}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between p-4">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 flex-1 cursor-pointer">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{formatCurrencyLYD(Number(payment.amount))}</p>
                            {surplusAmount > 0 && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 bg-yellow-500/10 text-[10px] px-1.5 py-0">
                                رصيد فائض: {formatCurrencyLYD(surplusAmount)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(new Date(payment.date), "dd MMM yyyy", { locale: ar })}</span>
                            <span>•</span>
                            <span>{paymentAllocs.length} فاتورة</span>
                            {treasury && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  {treasury.treasury_type === 'cash' ? <Wallet className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                                  {treasury.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <Badge variant={payment.payment_method === 'cash' ? 'default' : 'secondary'}>
                        {payment.payment_method === 'cash' ? 'كاش' : payment.payment_method === 'check' ? 'شيك' : 'تحويل بنكي'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintDialogPayment(payment);
                          setIncludeAllocationDetails(false);
                        }}
                        title="طباعة إيصال القبض"
                        className="cursor-pointer"
                      >
                        <Printer className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletePaymentId(payment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-3">
                      {(() => {
                        const phaseGroups: Record<string, { phase: any; treasuryName: string; treasuryType: string; allocs: typeof paymentAllocs }> = {};
                        const noPhaseAllocs: typeof paymentAllocs = [];

                        paymentAllocs.forEach(alloc => {
                          const phase = phases?.find(p => p.id === alloc.phase_id);
                          if (!phase) { noPhaseAllocs.push(alloc); return; }
                          const key = phase.id;
                          if (!phaseGroups[key]) {
                            const t = allTreasuries?.find(tr => tr.id === phase.treasury_id);
                            const parent = t?.parent_id ? allTreasuries?.find(tr => tr.id === t.parent_id) : null;
                            phaseGroups[key] = {
                              phase,
                              treasuryName: t ? (parent ? `${parent.name} / ${t.name}` : t.name) : "غير محددة",
                              treasuryType: t?.treasury_type || "cash",
                              allocs: [],
                            };
                          }
                          phaseGroups[key].allocs.push(alloc);
                        });

                        const renderAllocRow = (alloc: typeof paymentAllocs[0]) => {
                          const purchase = allocPurchases?.find(p => p.id === alloc.reference_id);
                          const supplierName = (purchase?.suppliers as any)?.name;
                          const invoiceNum = purchase?.invoice_number;
                          const phase = phases?.find(p => p.id === alloc.phase_id);
                          const pct = phase?.has_percentage ? Number(phase.percentage_value) : 0;
                          const feeAmount = pct > 0 ? Number(alloc.amount) * pct / 100 : 0;
                          const desc = alloc.reference_type === 'purchase'
                            ? `فاتورة مشتريات${invoiceNum ? ` #${invoiceNum}` : ''}${supplierName ? ` - ${supplierName}` : ''}`
                            : alloc.reference_type === 'rental'
                            ? `فاتورة إيجار معدات${supplierName ? ` - ${supplierName}` : ''}`
                            : getTypeLabel(alloc.reference_type);

                          return (
                            <div key={alloc.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(alloc.reference_type)}
                                <span className="text-sm">{desc}</span>
                                {purchase?.date && (
                                  <span className="text-xs text-muted-foreground">{format(new Date(purchase.date), "dd/MM/yyyy")}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-sm">{formatCurrencyLYD(Number(alloc.amount))}</span>
                                {pct > 0 && (
                                  <span className="text-xs text-primary">+ {formatCurrencyLYD(feeAmount)} ({pct}%)</span>
                                )}
                              </div>
                            </div>
                          );
                        };

                        let totalFee = 0;
                        paymentAllocs.forEach(alloc => {
                          const phase = phases?.find(p => p.id === alloc.phase_id);
                          const pct = phase?.has_percentage ? Number(phase.percentage_value) : 0;
                          totalFee += pct > 0 ? Number(alloc.amount) * pct / 100 : 0;
                        });

                        return (
                          <>
                            {Object.entries(phaseGroups).map(([key, group]) => {
                              const groupTotal = group.allocs.reduce((s, a) => s + Number(a.amount), 0);
                              const groupFee = group.allocs.reduce((s, a) => {
                                const pct = group.phase?.has_percentage ? Number(group.phase.percentage_value) : 0;
                                return s + (pct > 0 ? Number(a.amount) * pct / 100 : 0);
                              }, 0);
                              return (
                                <div key={key} className="border rounded-lg overflow-hidden">
                                  <div className="bg-muted/40 px-3 py-2 flex items-center justify-between border-b">
                                    <div className="flex items-center gap-2">
                                      {group.treasuryType === 'cash' ? <Wallet className="h-3.5 w-3.5 text-primary" /> : <Landmark className="h-3.5 w-3.5 text-primary" />}
                                      <span className="text-xs font-medium">{group.treasuryName}</span>
                                      <span className="text-xs text-muted-foreground">• {group.phase.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold">{formatCurrencyLYD(groupTotal)}</span>
                                      {groupFee > 0 && <span className="text-xs text-primary">+ {formatCurrencyLYD(groupFee)}</span>}
                                    </div>
                                  </div>
                                  <div className="divide-y divide-border/50">{group.allocs.map(renderAllocRow)}</div>
                                </div>
                              );
                            })}
                            {noPhaseAllocs.length > 0 && (
                              <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/40 px-3 py-2 flex items-center gap-2 border-b">
                                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium">بدون مرحلة</span>
                                </div>
                                <div className="divide-y divide-border/50">{noPhaseAllocs.map(renderAllocRow)}</div>
                              </div>
                            )}
                            {totalFee > 0 && (
                              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <span className="text-sm font-medium">إجمالي النسب المحصلة</span>
                                <span className="font-bold text-primary">{formatCurrencyLYD(totalFee)}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/50 rounded">{payment.notes}</p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Canonical Project-Level Client Receipt Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleReceiptDialogOpenChange}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-extrabold text-lg">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <span>تسجيل دفعة سداد للمشروع</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تسجيل إيصال استلام نقدية من الزبون على مستوى المشروع مباشرة مع احتساب المتبقي تلقائياً.
            </DialogDescription>
          </DialogHeader>

          {/* Project Summary Box */}
          <div className="grid grid-cols-2 gap-3 my-2">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
              <p className="text-xs text-muted-foreground">إجمالي مطالبات المشروع</p>
              <p className="text-lg font-bold text-primary font-mono">
                {formatCurrencyLYD(projectTotalObligation)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">المتبقي قبل الدفعة</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400 font-mono">
                {formatCurrencyLYD(projectRemainingBefore)}
              </p>
            </div>
          </div>

          <form onSubmit={handleReceiptSubmit} className="space-y-4 pt-1">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="receipt-amount" className="text-xs font-bold flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span>قيمة الدفعة المستلمة (د.ل) *</span>
              </Label>
              <Input
                id="receipt-amount"
                type="number"
                step="0.01"
                min="0"
                required
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                placeholder="أدخل المبلغ..."
                className="font-mono text-base h-11"
              />
              {/* Real-time calculated remaining and credit preview */}
              {enteredAmountNum > 0 && (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs flex justify-between items-center">
                  <span>المتبقي بعد الدفعة: <strong className="font-mono text-foreground">{formatCurrencyLYD(projectRemainingAfter)}</strong></span>
                  {creditCreatedPreview > 0 && (
                    <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                      رصيد زبون فائض: {formatCurrencyLYD(creditCreatedPreview)}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Treasury Selector */}
            <TreasurySelector
              value={receiptForm.treasury_id}
              onValueChange={(val) => setReceiptForm({ ...receiptForm, treasury_id: val })}
              projectType={project?.project_type || "contracting"}
              projectDefaultTreasuryId={project?.default_treasury_id}
              label="الخزينة المودع بها المبلغ"
            />

            {/* Payment Method & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="receipt-method" className="text-xs font-semibold">طريقة الدفع</Label>
                <Select
                  value={receiptForm.payment_method}
                  onValueChange={(val) => setReceiptForm({ ...receiptForm, payment_method: val })}
                >
                  <SelectTrigger id="receipt-method" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل مصرفي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt-date" className="text-xs font-semibold">تاريخ الاستلام</Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={receiptForm.date}
                  onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>

            {/* Receipt Number */}
            <div className="space-y-2">
              <Label htmlFor="receipt-number" className="text-xs font-semibold">رقم الإيصال / السند (اختياري)</Label>
              <Input
                id="receipt-number"
                type="text"
                placeholder="مثال: REC-2026-001"
                value={receiptForm.receipt_number}
                onChange={(e) => setReceiptForm({ ...receiptForm, receipt_number: e.target.value })}
                className="h-10"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="receipt-notes" className="text-xs font-semibold">ملاحظات</Label>
              <Textarea
                id="receipt-notes"
                placeholder="أي ملاحظات إضافية على الدفعة..."
                rows={2}
                value={receiptForm.notes}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="submit"
                disabled={isSubmittingReceipt || enteredAmountNum <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
              >
                {isSubmittingReceipt ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                ) : null}
                <span>تسجيل واستلام {enteredAmountNum > 0 ? formatCurrencyLYD(enteredAmountNum) : ""}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingReceipt}
                onClick={() => handleReceiptDialogOpenChange(false)}
                className="h-11 px-5"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirmDiscard={handleConfirmDiscard}
        onStay={handleCancelDiscard}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التسديد</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا التسديد؟ سيتم إلغاء توزيع المبالغ على الفواتير.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePaymentId && deleteMutation.mutate(deletePaymentId)}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Options Dialog */}
      <Dialog open={!!printDialogPayment} onOpenChange={(open) => !open && setPrintDialogPayment(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-lg">
              <Printer className="h-5 w-5 text-primary" />
              خيارات طباعة / تحميل الإيصال
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              اختر الإعدادات المناسبة لطباعة أو تحميل إيصال القبض المالي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
              <Checkbox 
                id="include-alloc" 
                checked={includeAllocationDetails} 
                onCheckedChange={(checked) => setIncludeAllocationDetails(!!checked)}
                className="cursor-pointer"
              />
              <Label htmlFor="include-alloc" className="text-sm font-medium cursor-pointer select-none">
                تضمين تفاصيل تسوية وتوزيع الدفعة على الفواتير
              </Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                if (printDialogPayment) {
                  handlePrintReceipt(printDialogPayment, includeAllocationDetails, 'print');
                  setPrintDialogPayment(null);
                }
              }}
              className="flex-1 gap-1 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              طباعة الواصل
            </Button>
            <Button 
              onClick={async () => {
                if (printDialogPayment) {
                  await handlePrintReceipt(printDialogPayment, includeAllocationDetails, 'pdf');
                  setPrintDialogPayment(null);
                }
              }}
              disabled={isPdfLoading}
              className="flex-1 gap-1 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              {isPdfLoading ? "جاري التحميل..." : "تحميل الواصل (PDF)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (urlProjectId) {
    return <ProjectWorkspaceLayout>{content}</ProjectWorkspaceLayout>;
  }

  return content;
};

export default ProjectPayments;
