import React, { useState, useMemo, useCallback } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Settings,
  Printer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PaymentAllocationDialog, { type UnpaidInvoice, type AllocationInput, type PaymentSaveData } from "@/components/payments/PaymentAllocationDialog";
import PrintDateRangeDialog from "@/components/print/PrintDateRangeDialog";
import { openPrintWindow } from "@/lib/printStyles";

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
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [directDialogOpen, setDirectDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [advanceForm, setAdvanceForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0], treasury_id: "", payment_method: "cash", notes: "" });
  const [directForm, setDirectForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0], treasury_id: "", payment_method: "cash", notes: "" });
  const [allocationEnabled, setAllocationEnabled] = useState(() => localStorage.getItem("payment_allocation_enabled") === "true");
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
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
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, phase_number, treasury_id, has_percentage, percentage_value")
        .eq("project_id", projectId!)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch existing payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ["client-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch payment allocations for all payments
  const { data: allAllocations } = useQuery({
    queryKey: ["payment-allocations", projectId],
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

  // Fetch unpaid invoices - removed dependency on phases being loaded
  const { data: unpaidInvoices } = useQuery({
    queryKey: ["unpaid-invoices", projectId],
    queryFn: async () => {
      const invoices: UnpaidInvoice[] = [];

      // Fetch phases inline if needed
      const { data: phasesData } = await supabase
        .from("project_phases")
        .select("id, name, phase_number, treasury_id, has_percentage, percentage_value")
        .eq("project_id", projectId!)
        .order("order_index");

      // Fetch all active treasuries inline
      const { data: treasuriesData } = await supabase
        .from("treasuries")
        .select("id, name, parent_id, treasury_type, is_active, balance")
        .eq("is_active", true);

      const localPhases = phasesData || [];
      const localTreasuries = treasuriesData || [];

      // 1. Purchases (non-rental)
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, date, phase_id, invoice_number, supplier_id, rental_id, treasury_id, suppliers:supplier_id(name)")
        .eq("project_id", projectId!)
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
          const srcTreasury = localTreasuries.find(t => t.id === (p as any).treasury_id);
          const srcParent = srcTreasury?.parent_id ? localTreasuries.find(t => t.id === srcTreasury.parent_id) : null;
          const phase = localPhases.find(ph => ph.id === p.phase_id);
          const pct = phase?.has_percentage ? Number(phase.percentage_value) : 0;
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
        .eq("project_id", projectId!)
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
          const srcTreasury = localTreasuries.find(t => t.id === (p as any).treasury_id);
          const srcParent = srcTreasury?.parent_id ? localTreasuries.find(t => t.id === srcTreasury.parent_id) : null;
          const phase = localPhases.find(ph => ph.id === p.phase_id);
          const pct = phase?.has_percentage ? Number(phase.percentage_value) : 0;
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
        .eq("project_id", projectId!);

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
          const phase = localPhases.find(ph => ph.id === item.phase_id);
          const pct = phase?.has_percentage ? Number(phase.percentage_value) : 0;
          invoices.push({
            id: item.id, type: "item",
            description: `بند: ${item.name}`,
            total_amount: Number(item.total_price), paid_amount: totalAllocated, remaining,
            service_fee: pct > 0 ? remaining * pct / 100 : 0, service_fee_percentage: pct,
            phase_id: item.phase_id, phase_name: phase?.name || null,
            phase_treasury_id: phase?.treasury_id || null,
            source_treasury_id: phase?.treasury_id || null,
            source_treasury_name: (() => {
              const phaseTid = phase?.treasury_id;
              if (!phaseTid) return null;
              const t = localTreasuries.find(tr => tr.id === phaseTid);
              const p = t?.parent_id ? localTreasuries.find(tr => tr.id === t.parent_id) : null;
              return t ? (p ? `${p.name} / ${t.name}` : t.name) : null;
            })(),
            date: "",
          });
        }
      });

      return invoices;
    },
    enabled: !!projectId,
  });

  // Fetch ALL invoices (paid + unpaid) for correct total dues
  const { data: allInvoices } = useQuery({
    queryKey: ["all-invoices", projectId],
    queryFn: async () => {
      const invoices: { id: string; type: string; description: string; total_amount: number; paid_amount: number; remaining: number; phase_name: string | null }[] = [];

      // Purchases (non-rental)
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, total_amount, date, phase_id, invoice_number, supplier_id, rental_id, suppliers:supplier_id(name)")
        .eq("project_id", projectId!)
        .is("rental_id", null);

      // Rental purchases
      const { data: rentalPurchases } = await supabase
        .from("purchases")
        .select("id, total_amount, date, phase_id, rental_id, suppliers:supplier_id(name)")
        .eq("project_id", projectId!)
        .not("rental_id", "is", null);

      // Project items
      const { data: items } = await supabase
        .from("project_items")
        .select("id, name, total_price, phase_id")
        .eq("project_id", projectId!);

      // All allocations for this project
      const allIds = [
        ...(purchases?.map(p => p.id) || []),
        ...(rentalPurchases?.map(p => p.id) || []),
        ...(items?.map(i => i.id) || []),
      ];
      
      let allocatedMap: Record<string, number> = {};
      if (allIds.length > 0) {
        const { data: allocs } = await supabase
          .from("client_payment_allocations")
          .select("reference_id, amount")
          .in("reference_id", allIds);
        allocs?.forEach(a => {
          allocatedMap[a.reference_id] = (allocatedMap[a.reference_id] || 0) + Number(a.amount);
        });
      }

      // Phases for names
      const { data: phasesData } = await supabase
        .from("project_phases")
        .select("id, name")
        .eq("project_id", projectId!);
      const phaseMap = Object.fromEntries((phasesData || []).map(p => [p.id, p.name]));

      purchases?.forEach(p => {
        const allocated = allocatedMap[p.id] || 0;
        invoices.push({
          id: p.id, type: "purchase",
          description: `فاتورة مشتريات ${p.invoice_number || ''}${(p.suppliers as any)?.name ? ' - ' + (p.suppliers as any).name : ''}`.trim(),
          total_amount: Number(p.total_amount), paid_amount: allocated,
          remaining: Number(p.total_amount) - allocated,
          phase_name: p.phase_id ? phaseMap[p.phase_id] || null : null,
        });
      });

      rentalPurchases?.forEach(p => {
        const allocated = allocatedMap[p.id] || 0;
        invoices.push({
          id: p.id, type: "rental",
          description: `فاتورة إيجار معدات${(p.suppliers as any)?.name ? ' - ' + (p.suppliers as any).name : ''}`,
          total_amount: Number(p.total_amount), paid_amount: allocated,
          remaining: Number(p.total_amount) - allocated,
          phase_name: p.phase_id ? phaseMap[p.phase_id] || null : null,
        });
      });

      items?.forEach(item => {
        const allocated = allocatedMap[item.id] || 0;
        invoices.push({
          id: item.id, type: "item",
          description: `بند: ${item.name}`,
          total_amount: Number(item.total_price), paid_amount: allocated,
          remaining: Number(item.total_price) - allocated,
          phase_name: item.phase_id ? phaseMap[item.phase_id] || null : null,
        });
      });

      return invoices;
    },
  });

  // Save allocated payment mutation (existing - for allocation dialog)
  const saveMutation = useMutation({
    mutationFn: async ({ formData, allocations, useAdvanceCredit, advanceCreditAmount }: PaymentSaveData) => {
      const selectedAllocations = allocations.filter(a => a.selected && a.amount > 0);
      if (selectedAllocations.length === 0) throw new Error("يرجى اختيار فاتورة واحدة على الأقل");

      const totalInvoiceAmount = selectedAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalFee = selectedAllocations.reduce((sum, a) => {
        return sum + (a.invoice.service_fee_percentage > 0 ? a.amount * a.invoice.service_fee_percentage / 100 : 0);
      }, 0);
      const totalAmount = totalInvoiceAmount + totalFee;
      const creditUsed = useAdvanceCredit ? Math.min(advanceCreditAmount, totalAmount, advanceBalance) : 0;
      const cashAmount = totalAmount - creditUsed;

      // Group by source treasury
      const treasuryGroupsForSave: Record<string, { treasuryId: string; amount: number }> = {};
      for (const alloc of selectedAllocations) {
        const tid = alloc.invoice.source_treasury_id;
        const allocFee = alloc.invoice.service_fee_percentage > 0 ? alloc.amount * alloc.invoice.service_fee_percentage / 100 : 0;
        if (tid) {
          if (!treasuryGroupsForSave[tid]) {
            treasuryGroupsForSave[tid] = { treasuryId: tid, amount: 0 };
          }
          treasuryGroupsForSave[tid].amount += alloc.amount + allocFee;
        }
      }

      const firstTreasuryId = Object.keys(treasuryGroupsForSave)[0] || null;

      // Insert payment
      const { data: payment, error: paymentError } = await supabase
        .from("client_payments")
        .insert({
          project_id: projectId!,
          client_id: project?.client_id || null,
          amount: totalAmount,
          date: formData.date,
          payment_method: formData.payment_method,
          treasury_id: firstTreasuryId!,
          credit_used: creditUsed,
          payment_type: "allocated",
          notes: creditUsed > 0
            ? `${formData.notes || ''} [خصم من رصيد على الحساب: ${formatCurrencyLYD(creditUsed)}]`.trim()
            : formData.notes || null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Insert allocations
      const allocationRows = selectedAllocations.map(a => {
        const allocFee = a.invoice.service_fee_percentage > 0 ? a.amount * a.invoice.service_fee_percentage / 100 : 0;
        return {
          payment_id: payment.id,
          reference_type: a.invoice.type,
          reference_id: a.invoice.id,
          phase_id: a.invoice.phase_id,
          amount: a.amount + allocFee,
        };
      });

      const { error: allocError } = await supabase
        .from("client_payment_allocations")
        .insert(allocationRows);

      if (allocError) throw allocError;

      // Update purchases paid_amount
      for (const alloc of selectedAllocations) {
        if (alloc.invoice.type === "purchase" || alloc.invoice.type === "rental") {
          const newPaid = alloc.invoice.paid_amount + alloc.amount;
          const newStatus = newPaid >= alloc.invoice.total_amount ? "paid" : newPaid > 0 ? "partial" : "due";
          await supabase
            .from("purchases")
            .update({ paid_amount: newPaid, status: newStatus })
            .eq("id", alloc.invoice.id);
        }
      }

      // FIFO: Update used_amount on advance payments
      if (creditUsed > 0 && payments) {
        const advancePayments = payments
          .filter((p: any) => p.payment_type === 'advance')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let remainingCredit = creditUsed;
        for (const ap of advancePayments) {
          if (remainingCredit <= 0) break;
          const available = Number(ap.amount) - Number((ap as any).used_amount || 0);
          if (available <= 0) continue;
          const deduct = Math.min(available, remainingCredit);
          remainingCredit -= deduct;
          await supabase
            .from("client_payments")
            .update({ used_amount: Number((ap as any).used_amount || 0) + deduct })
            .eq("id", ap.id);
        }
      }

      // Add treasury transactions (only for cash portion)
      if (cashAmount > 0) {
        const totalTreasuryAmount = Object.values(treasuryGroupsForSave).reduce((s, g) => s + g.amount, 0);
        const cashRatio = totalTreasuryAmount > 0 ? cashAmount / totalTreasuryAmount : 1;

        for (const group of Object.values(treasuryGroupsForSave)) {
          const depositAmount = group.amount * cashRatio;
          if (depositAmount > 0) {
            await supabase.from("treasury_transactions").insert({
              treasury_id: group.treasuryId,
              type: "deposit",
              amount: depositAmount,
              balance_after: 0,
              description: `تسديد من الزبون - ${project?.name || ""}${creditUsed > 0 ? ` (${formatCurrencyLYD(creditUsed)} من رصيد الحساب)` : ""}${totalFee > 0 ? ` (شامل نسبة خدمات)` : ""}`,
              date: formData.date,
              reference_type: "client_payment",
              reference_id: payment.id,
              source: "client_payment",
            });
          }
        }
      }

      // Add to income table
      await supabase.from("income").insert({
        project_id: projectId!,
        client_id: project?.client_id || null,
        amount: totalAmount,
        date: formData.date,
        type: "service",
        subtype: "client_payment",
        payment_method: formData.payment_method,
        notes: `تسديد مجمع للمشروع: ${project?.name || ""} - ${selectedAllocations.length} فاتورة${creditUsed > 0 ? ` (${formatCurrencyLYD(creditUsed)} من رصيد الحساب)` : ''}`,
        status: "received",
        reference_id: payment.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-invoices", projectId] });
      queryClient.invalidateQueries({ queryKey: ["payment-allocations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم تسجيل التسديد بنجاح" });
      setAllocationDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تسجيل التسديد",
        variant: "destructive",
      });
    },
  });

  // Save direct payment mutation - with FIFO auto-allocation
  const directPaymentMutation = useMutation({
    mutationFn: async (form: typeof directForm) => {
      const amount = parseFloat(form.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ صحيح");
      if (!form.treasury_id) throw new Error("يرجى اختيار الخزينة");

      const { data: payment, error: paymentError } = await supabase
        .from("client_payments")
        .insert({
          project_id: projectId!,
          client_id: project?.client_id || null,
          amount,
          date: form.date,
          payment_method: form.payment_method,
          treasury_id: form.treasury_id,
          notes: form.notes || null,
          payment_type: "direct",
          used_amount: 0,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Treasury deposit
      await supabase.from("treasury_transactions").insert({
        treasury_id: form.treasury_id,
        type: "deposit",
        amount,
        balance_after: 0,
        description: `دفعة مباشرة من الزبون - ${project?.name || ""}`,
        date: form.date,
        reference_type: "client_payment",
        reference_id: payment.id,
        source: "client_payment",
      });

      // Income record
      await supabase.from("income").insert({
        project_id: projectId!,
        client_id: project?.client_id || null,
        amount,
        date: form.date,
        type: "service",
        subtype: "direct_payment",
        payment_method: form.payment_method,
        notes: `دفعة مباشرة - ${project?.name || ""}`,
        status: "received",
        reference_id: payment.id,
      });

      // Auto-allocate FIFO: oldest unpaid purchases first
      const { data: unpaidPurchases } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, phase_id")
        .eq("project_id", projectId!)
        .in("status", ["due", "partial"])
        .order("date", { ascending: true });

      // Also get unpaid project items
      const { data: allItems } = await supabase
        .from("project_items")
        .select("id, total_price, phase_id, created_at")
        .eq("project_id", projectId!);

      // Get existing allocations for items
      const itemIds = allItems?.map(i => i.id) || [];
      let itemAllocMap: Record<string, number> = {};
      if (itemIds.length > 0) {
        const { data: itemAllocs } = await supabase
          .from("client_payment_allocations")
          .select("reference_id, amount")
          .in("reference_id", itemIds);
        itemAllocs?.forEach(a => {
          itemAllocMap[a.reference_id] = (itemAllocMap[a.reference_id] || 0) + Number(a.amount);
        });
      }

      // Build combined list (purchases first by date, then items)
      type AllocTarget = { id: string; type: string; owed: number; phase_id: string | null };
      const targets: AllocTarget[] = [];

      unpaidPurchases?.forEach(p => {
        const owed = Number(p.total_amount) - Number(p.paid_amount || 0);
        if (owed > 0) targets.push({ id: p.id, type: "purchase", owed, phase_id: p.phase_id });
      });

      allItems?.forEach(item => {
        const allocated = itemAllocMap[item.id] || 0;
        const owed = Number(item.total_price) - allocated;
        if (owed > 0) targets.push({ id: item.id, type: "item", owed, phase_id: item.phase_id });
      });

      let remaining = amount;

      for (const target of targets) {
        if (remaining <= 0) break;
        const allocate = Math.min(remaining, target.owed);

        await supabase.from("client_payment_allocations").insert({
          payment_id: payment.id,
          reference_id: target.id,
          reference_type: target.type,
          phase_id: target.phase_id,
          amount: allocate,
        });

        if (target.type === "purchase" || target.type === "rental") {
          const { data: purchase } = await supabase
            .from("purchases")
            .select("paid_amount, total_amount")
            .eq("id", target.id)
            .maybeSingle();
          if (purchase) {
            const newPaid = Number(purchase.paid_amount || 0) + allocate;
            const newStatus = newPaid >= Number(purchase.total_amount) ? "paid" : "partial";
            await supabase.from("purchases").update({
              paid_amount: newPaid,
              status: newStatus,
            }).eq("id", target.id);
          }
        }

        remaining -= allocate;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-invoices", projectId] });
      queryClient.invalidateQueries({ queryKey: ["all-invoices", projectId] });
      queryClient.invalidateQueries({ queryKey: ["payment-allocations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      toast({ title: "تم تسجيل الدفعة المباشرة بنجاح" });
      setDirectDialogOpen(false);
      setDirectForm({ amount: "", date: new Date().toISOString().split("T")[0], treasury_id: "", payment_method: "cash", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data: paymentToDelete } = await supabase
        .from("client_payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

      if (!paymentToDelete) throw new Error("التسديد غير موجود");

      if ((paymentToDelete as any).payment_type === 'advance' && Number((paymentToDelete as any).used_amount || 0) > 0) {
        throw new Error(`لا يمكن حذف هذه الدفعة المقدمة لأنه تم استخدام ${formatCurrencyLYD(Number((paymentToDelete as any).used_amount))} منها في تسديدات أخرى`);
      }

      // Reverse allocations on purchases (only for allocated payments)
      if ((paymentToDelete as any).payment_type === 'allocated') {
        const { data: paymentAllocs } = await supabase
          .from("client_payment_allocations")
          .select("reference_id, reference_type, amount")
          .eq("payment_id", paymentId);

        if (paymentAllocs && paymentAllocs.length > 0) {
          for (const alloc of paymentAllocs) {
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
      }

      // Reverse credit_used
      const creditUsed = Number((paymentToDelete as any).credit_used || 0);
      if (creditUsed > 0 && payments) {
        const advancePayments = payments
          .filter((p: any) => p.payment_type === 'advance' && Number(p.used_amount || 0) > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let remainingToRestore = creditUsed;
        for (const ap of advancePayments) {
          if (remainingToRestore <= 0) break;
          const currentUsed = Number((ap as any).used_amount || 0);
          const restore = Math.min(currentUsed, remainingToRestore);
          remainingToRestore -= restore;
          await supabase
            .from("client_payments")
            .update({ used_amount: currentUsed - restore })
            .eq("id", ap.id);
        }
      }

      // Delete related income record
      await supabase.from("income").delete().eq("reference_id", paymentId);

      // Delete the payment (DB trigger handles treasury_transactions + allocations)
      const { error } = await supabase.from("client_payments").delete().eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-invoices", projectId] });
      queryClient.invalidateQueries({ queryKey: ["payment-allocations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم حذف التسديد بنجاح" });
      setDeletePaymentId(null);
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Advance payment credit balance
  const advanceBalance = useMemo(() => {
    if (!payments) return 0;
    return payments
      .filter((p: any) => p.payment_type === 'advance')
      .reduce((sum: number, p: any) => sum + (Number(p.amount) - Number(p.used_amount || 0)), 0);
  }, [payments]);

  // Total project value from ALL invoices (paid + unpaid)
  const totalProjectValue = useMemo(() => {
    if (!allInvoices) return 0;
    return allInvoices.reduce((s, i) => s + i.total_amount, 0);
  }, [allInvoices]);

  const totalAllocated = useMemo(() => {
    if (!allInvoices) return 0;
    return allInvoices.reduce((s, i) => s + i.paid_amount, 0);
  }, [allInvoices]);

  const totalPaid = useMemo(() => {
    if (!payments) return 0;
    return payments.reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);

  const totalRemainingDebt = useMemo(() => {
    if (allocationEnabled) {
      return totalProjectValue - totalAllocated;
    }
    return totalProjectValue - totalPaid;
  }, [totalProjectValue, totalAllocated, totalPaid, allocationEnabled]);

  const hasSurplus = totalRemainingDebt < 0;
  const surplusAmount = Math.abs(Math.min(0, totalRemainingDebt));
  const debtDisplay = Math.max(0, totalRemainingDebt);

  const paymentPercentage = useMemo(() => {
    if (totalProjectValue <= 0) return 0;
    const paidRef = allocationEnabled ? totalAllocated : totalPaid;
    return Math.min(100, Math.round((paidRef / totalProjectValue) * 100));
  }, [totalAllocated, totalPaid, totalProjectValue, allocationEnabled]);

  // Fetch company settings for print
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      return data;
    },
  });

  const handlePrintStatement = useCallback((dateFrom: string, dateTo: string) => {
    if (!payments || !project) return;

    let filtered = [...payments];
    if (dateFrom) filtered = filtered.filter(p => p.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(p => p.date <= dateTo);
    filtered.sort((a, b) => a.date.localeCompare(b.date));

    const clientName = (project?.clients as any)?.name || "بدون عميل";
    const dateRange = dateFrom || dateTo
      ? `الفترة: ${dateFrom || "البداية"} إلى ${dateTo || "الآن"}`
      : "جميع المدفوعات";

    const filteredTotal = filtered.reduce((s, p) => s + Number(p.amount), 0);

    const rows = filtered.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.date}</td>
        <td>${formatCurrencyLYD(Number(p.amount))}</td>
        <td>${p.payment_method === 'cash' ? 'كاش' : p.payment_method === 'bank_transfer' ? 'تحويل بنكي' : p.payment_method || '-'}</td>
        <td>${p.payment_type === 'advance' ? 'على الحساب' : p.payment_type === 'allocated' ? 'موزع' : 'مباشر'}</td>
        <td>${p.notes || '-'}</td>
      </tr>
    `).join("");

    const content = `
      <div class="print-area">
        <div class="print-content">
          <h2 style="text-align:center;margin-bottom:5px;">كشف مدفوعات العميل</h2>
          <p style="text-align:center;color:#666;margin-bottom:15px;">${dateRange}</p>

          <table class="print-info-table">
            <tr><td><strong>المشروع:</strong></td><td>${project.name}</td></tr>
            <tr><td><strong>العميل:</strong></td><td>${clientName}</td></tr>
          </table>

          <table class="print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>طريقة الدفع</th>
                <th>النوع</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <table class="print-summary-table">
            <tr><td>إجمالي المستحقات</td><td>${formatCurrencyLYD(totalProjectValue)}</td></tr>
            <tr><td>إجمالي المدفوع (الفترة)</td><td>${formatCurrencyLYD(filteredTotal)}</td></tr>
            <tr><td>إجمالي المدفوع (الكلي)</td><td>${formatCurrencyLYD(totalPaid)}</td></tr>
            <tr><td>المتبقي</td><td>${formatCurrencyLYD(Math.max(0, totalProjectValue - totalPaid))}</td></tr>
          </table>

          <div class="print-footer">
            <p>${companySettings?.company_name || ''}</p>
          </div>
        </div>
      </div>
    `;

    const docTitle = `كشف مدفوعات - ${project.name} - ${clientName}`;
    openPrintWindow(docTitle, content, companySettings);
  }, [payments, project, companySettings, totalProjectValue, totalPaid]);

  const toggleAllocationMode = (enabled: boolean) => {
    setAllocationEnabled(enabled);
    localStorage.setItem("payment_allocation_enabled", enabled ? "true" : "false");
  };

  // Save advance payment mutation
  const advanceMutation = useMutation({
    mutationFn: async (form: typeof advanceForm) => {
      const amount = parseFloat(form.amount);
      if (!amount || amount <= 0) throw new Error("يرجى إدخال مبلغ صحيح");
      if (!form.treasury_id) throw new Error("يرجى اختيار الخزينة");

      const { data: payment, error: paymentError } = await supabase
        .from("client_payments")
        .insert({
          project_id: projectId!,
          client_id: project?.client_id || null,
          amount,
          date: form.date,
          payment_method: form.payment_method,
          treasury_id: form.treasury_id,
          notes: form.notes || null,
          payment_type: "advance",
          used_amount: 0,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Treasury deposit
      await supabase.from("treasury_transactions").insert({
        treasury_id: form.treasury_id,
        type: "deposit",
        amount,
        balance_after: 0,
        description: `دفعة على الحساب - ${project?.name || ""}`,
        date: form.date,
        reference_type: "client_payment",
        reference_id: payment.id,
        source: "client_payment",
      });

      // Income record
      await supabase.from("income").insert({
        project_id: projectId!,
        client_id: project?.client_id || null,
        amount,
        date: form.date,
        type: "service",
        subtype: "advance_payment",
        payment_method: form.payment_method,
        notes: `دفعة على الحساب - ${project?.name || ""}`,
        status: "received",
        reference_id: payment.id,
      });

      // Auto-allocate to outstanding invoices (FIFO)
      const { data: unpaid } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, commission")
        .eq("project_id", projectId!)
        .in("status", ["due", "partial"])
        .order("date", { ascending: true });

      let remaining = amount;
      let totalUsed = 0;

      if (unpaid && unpaid.length > 0) {
        for (const inv of unpaid) {
          if (remaining <= 0) break;
          const owed = Number(inv.total_amount) - Number(inv.paid_amount || 0);
          if (owed <= 0) continue;
          const allocate = Math.min(remaining, owed);

          await supabase.from("client_payment_allocations").insert({
            payment_id: payment.id,
            reference_id: inv.id,
            reference_type: "purchase",
            amount: allocate,
          });

          const newPaid = Number(inv.paid_amount || 0) + allocate;
          const newStatus = newPaid >= Number(inv.total_amount) ? "paid" : "partial";
          await supabase.from("purchases").update({
            paid_amount: newPaid,
            status: newStatus,
          }).eq("id", inv.id);

          remaining -= allocate;
          totalUsed += allocate;
        }

        if (totalUsed > 0) {
          await supabase.from("client_payments").update({
            used_amount: totalUsed,
          }).eq("id", payment.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      toast({ title: "تم تسجيل الدفعة على الحساب بنجاح" });
      setAdvanceDialogOpen(false);
      setAdvanceForm({ amount: "", date: new Date().toISOString().split("T")[0], treasury_id: "", payment_method: "cash", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenAllocationDialog = () => {
    if (!unpaidInvoices?.length) {
      toast({ title: "لا توجد فواتير مستحقة", description: "جميع الفواتير مسددة بالكامل" });
      return;
    }
    setAllocationDialogOpen(true);
  };

  const togglePaymentExpand = (id: string) => {
    setExpandedPayments(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تسديدات الزبون</h1>
            <p className="text-sm text-muted-foreground">
              {project?.name} - {(project?.clients as any)?.name || "بدون عميل"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setPrintDialogOpen(true)}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة كشف
          </Button>
          {allocationEnabled && (
            <Button variant="outline" onClick={() => setAdvanceDialogOpen(true)}>
              <Wallet className="h-4 w-4 ml-2" />
              دفعة على الحساب
            </Button>
          )}
          <Button onClick={() => setDirectDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            تسديد جديد
          </Button>
          {allocationEnabled && (
            <Button variant="secondary" onClick={handleOpenAllocationDialog}>
              <Receipt className="h-4 w-4 ml-2" />
              تسديد مع توزيع
            </Button>
          )}
        </div>
      </div>

      {/* Debt Summary Card */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-background">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">ملخص الديون</h2>
            <div className="flex items-center gap-2">
              <Label htmlFor="alloc-toggle" className="text-xs text-muted-foreground cursor-pointer">
                <Settings className="h-3.5 w-3.5 inline ml-1" />
                تفعيل التوزيع على الفواتير
              </Label>
              <Switch id="alloc-toggle" checked={allocationEnabled} onCheckedChange={toggleAllocationMode} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">إجمالي المستحقات</p>
              <p className="text-xl font-bold">{formatCurrencyLYD(totalProjectValue)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-xs text-muted-foreground mb-1">إجمالي المدفوع</p>
              <p className="text-xl font-bold text-primary">{formatCurrencyLYD(totalPaid)}</p>
              {allocationEnabled && totalPaid !== totalAllocated && (
                <p className="text-xs text-muted-foreground">موزع: {formatCurrencyLYD(totalAllocated)}</p>
              )}
            </div>
            {hasSurplus ? (
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-muted-foreground mb-1">رصيد فائض (دفع أكثر)</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrencyLYD(surplusAmount)}</p>
              </div>
            ) : (
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground mb-1">المتبقي من الديون</p>
                <p className="text-xl font-bold text-destructive">{formatCurrencyLYD(debtDisplay)}</p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">نسبة السداد</span>
              <span className="font-bold">{paymentPercentage}%</span>
            </div>
            <Progress value={paymentPercentage} className="h-3" />
          </div>
          {hasSurplus && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span className="text-sm">الزبون دفع أكثر من المستحق بمبلغ <strong>{formatCurrencyLYD(surplusAmount)}</strong></span>
            </div>
          )}
          {advanceBalance > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-accent/50">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-sm">رصيد على الحساب: <strong>{formatCurrencyLYD(advanceBalance)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Table */}
      {allInvoices && allInvoices.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              تفاصيل الفواتير والبنود
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-2 font-medium text-muted-foreground">النوع</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">الوصف</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">المرحلة</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">القيمة</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">المدفوع</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {allInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-2">
                        <Badge variant="outline" className="text-[10px]">
                          {getTypeLabel(inv.type)}
                        </Badge>
                      </td>
                      <td className="p-2">{inv.description}</td>
                      <td className="p-2 text-muted-foreground">{inv.phase_name || '-'}</td>
                      <td className="p-2 font-medium">{formatCurrencyLYD(inv.total_amount)}</td>
                      <td className="p-2 text-primary">{formatCurrencyLYD(inv.paid_amount)}</td>
                      <td className={`p-2 font-medium ${inv.remaining > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {inv.remaining > 0 ? formatCurrencyLYD(inv.remaining) : '✓ مسدد'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={3} className="p-2">الإجمالي</td>
                    <td className="p-2">{formatCurrencyLYD(totalProjectValue)}</td>
                    <td className="p-2 text-primary">{formatCurrencyLYD(totalAllocated)}</td>
                    <td className={`p-2 ${hasSurplus ? 'text-emerald-600' : 'text-destructive'}`}>
                      {hasSurplus ? `+ ${formatCurrencyLYD(surplusAmount)} فائض` : formatCurrencyLYD(debtDisplay)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments List */}
      {payments?.length === 0 ? (
        <Card className="p-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد تسديدات</h3>
          <p className="text-muted-foreground mb-4">ابدأ بإضافة تسديد جديد من الزبون</p>
          <Button onClick={() => setDirectDialogOpen(true)}>
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
            const paymentType = (payment as any).payment_type;

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
                            {paymentType === 'advance' && (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px] py-0">
                                على الحساب
                                {Number((payment as any).used_amount || 0) > 0 && ` (مستخدم: ${formatCurrencyLYD(Number((payment as any).used_amount))})`}
                              </Badge>
                            )}
                            {paymentType === 'direct' && (
                              <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] py-0">
                                دفعة مباشرة
                              </Badge>
                            )}
                            {paymentType === 'allocated' && (
                              <Badge variant="outline" className="text-primary border-primary/30 text-[10px] py-0">
                                موزعة
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(new Date(payment.date), "dd MMM yyyy", { locale: ar })}</span>
                            <span>•</span>
                            <span>
                              {paymentType === 'advance' ? 'دفعة مقدمة' : paymentType === 'direct' ? 'دفعة مباشرة' : `${paymentAllocs.length} فاتورة`}
                            </span>
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
                      <Button variant="ghost" size="icon" onClick={() => setDeletePaymentId(payment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-3">
                      {paymentType === 'direct' ? (
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <p className="text-sm text-blue-700">دفعة مباشرة — تم خصمها من إجمالي الديون مباشرة بدون توزيع على فواتير محددة</p>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
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

      {/* Payment Allocation Dialog (optional) */}
      <PaymentAllocationDialog
        open={allocationDialogOpen}
        onClose={() => setAllocationDialogOpen(false)}
        invoices={unpaidInvoices || []}
        phases={phases || []}
        allTreasuries={allTreasuries || []}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
        projectName={project?.name}
        advanceBalance={advanceBalance}
      />

      {/* Direct Payment Dialog */}
      <Dialog open={directDialogOpen} onOpenChange={setDirectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              تسديد جديد
            </DialogTitle>
          </DialogHeader>

          {/* Debt info in dialog */}
          <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">إجمالي الديون المستحقة</span>
              <span className="font-bold text-destructive">{formatCurrencyLYD(totalRemainingDebt)}</span>
            </div>
            {directForm.amount && parseFloat(directForm.amount) > 0 && (
              <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                <span className="text-muted-foreground">المتبقي بعد الدفع</span>
                <span className="font-bold text-primary">
                  {formatCurrencyLYD(Math.max(0, totalRemainingDebt - parseFloat(directForm.amount)))}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm">المبلغ *</Label>
              <Input type="number" value={directForm.amount} onChange={e => setDirectForm(f => ({ ...f, amount: e.target.value }))} placeholder="أدخل المبلغ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">التاريخ</Label>
                <Input type="date" value={directForm.date} onChange={e => setDirectForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">طريقة الدفع</Label>
                <Select value={directForm.payment_method} onValueChange={v => setDirectForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">كاش</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">الخزينة *</Label>
              <Select value={directForm.treasury_id} onValueChange={v => setDirectForm(f => ({ ...f, treasury_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الخزينة..." /></SelectTrigger>
                <SelectContent>
                  {allTreasuries?.filter(t => !t.parent_id).map(parent => (
                    <React.Fragment key={parent.id}>
                      <SelectItem value={parent.id} className="font-bold">{parent.name}</SelectItem>
                      {allTreasuries?.filter(c => c.parent_id === parent.id).map(child => (
                        <SelectItem key={child.id} value={child.id} className="pr-6">{child.name}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">ملاحظات</Label>
              <Input value={directForm.notes} onChange={e => setDirectForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري..." />
            </div>
            <Button className="w-full" onClick={() => directPaymentMutation.mutate(directForm)} disabled={directPaymentMutation.isPending}>
              {directPaymentMutation.isPending ? "جاري الحفظ..." : "تسجيل الدفعة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance Payment Dialog */}
      <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              دفعة على الحساب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm">المبلغ</Label>
              <Input type="number" value={advanceForm.amount} onChange={e => setAdvanceForm(f => ({ ...f, amount: e.target.value }))} placeholder="أدخل المبلغ..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">التاريخ</Label>
                <Input type="date" value={advanceForm.date} onChange={e => setAdvanceForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">طريقة الدفع</Label>
                <Select value={advanceForm.payment_method} onValueChange={v => setAdvanceForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">كاش</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">الخزينة</Label>
              <Select value={advanceForm.treasury_id} onValueChange={v => setAdvanceForm(f => ({ ...f, treasury_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الخزينة..." /></SelectTrigger>
                <SelectContent>
                  {allTreasuries?.filter(t => !t.parent_id).map(parent => (
                    <React.Fragment key={parent.id}>
                      <SelectItem value={parent.id} className="font-bold">{parent.name}</SelectItem>
                      {allTreasuries?.filter(c => c.parent_id === parent.id).map(child => (
                        <SelectItem key={child.id} value={child.id} className="pr-6">{child.name}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">ملاحظات</Label>
              <Input value={advanceForm.notes} onChange={e => setAdvanceForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري..." />
            </div>
            <Button className="w-full" onClick={() => advanceMutation.mutate(advanceForm)} disabled={advanceMutation.isPending}>
              {advanceMutation.isPending ? "جاري الحفظ..." : "تسجيل الدفعة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التسديد</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const p = payments?.find(p => p.id === deletePaymentId);
                if (!p) return "هل أنت متأكد من حذف هذا التسديد؟";
                if ((p as any).payment_type === 'advance' && Number((p as any).used_amount || 0) > 0) {
                  return `⚠️ لا يمكن حذف هذه الدفعة المقدمة لأنه تم استخدام ${formatCurrencyLYD(Number((p as any).used_amount))} منها في تسديدات أخرى. يجب حذف التسديدات المرتبطة أولاً.`;
                }
                const creditUsed = Number((p as any).credit_used || 0);
                if (creditUsed > 0) {
                  return `هل أنت متأكد من حذف هذا التسديد؟ سيتم إعادة ${formatCurrencyLYD(creditUsed)} إلى رصيد الحساب وإلغاء توزيع المبالغ على الفواتير.`;
                }
                return "هل أنت متأكد من حذف هذا التسديد؟";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            {(() => {
              const p = payments?.find(p => p.id === deletePaymentId);
              const blocked = p && (p as any).payment_type === 'advance' && Number((p as any).used_amount || 0) > 0;
              return blocked ? null : (
                <AlertDialogAction onClick={() => deletePaymentId && deleteMutation.mutate(deletePaymentId)}>
                  حذف
                </AlertDialogAction>
              );
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrintDateRangeDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        title="طباعة كشف المدفوعات"
        onPrint={handlePrintStatement}
      />
    </div>
  );
};

export default ProjectPayments;
