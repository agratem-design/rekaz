import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOperationKey } from "@/hooks/useOperationKey";
import { invalidateFinancialQueries } from "@/lib/financialMutations";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox, ComboboxOption } from "@/components/common/EntityCombobox";
import { QuickAddSupplierDialog } from "@/components/suppliers/QuickAddSupplierDialog";
import { TreasurySelector } from "@/components/treasury/TreasurySelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Package,
  Layers,
  Lock,
  Loader2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemRow {
  name: string;
  qty: number;
  price: number;
  unit: string;
}

interface MaterialPurchaseFormProps {
  projectId: string;
  projectType?: "contracting" | "finishing" | string;
  activePhaseId?: string | null;
  activePhaseName?: string | null;
  defaultTreasuryId?: string | null;
  editingPurchase?: any | null;
  onSuccess: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const MaterialPurchaseForm: React.FC<MaterialPurchaseFormProps> = ({
  projectId,
  projectType,
  activePhaseId,
  activePhaseName,
  defaultTreasuryId,
  editingPurchase,
  onSuccess,
  onCancel,
  onDirtyChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const paymentOperation = useOperationKey();

  // Dialog state for nested supplier quick create
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);

  // Partial failure state tracking
  const [createdPurchaseId, setCreatedPurchaseId] = useState<string | null>(null);
  const [paymentFailedState, setPaymentFailedState] = useState<{
    failed: boolean;
    errorMsg: string;
    amount: number;
    treasuryId: string;
    method: string;
  }>({ failed: false, errorMsg: "", amount: 0, treasuryId: "", method: "cash" });

  // Fetch Suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, phone, category")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Project Phases
  const { data: phases = [] } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, order_index")
        .eq("project_id", projectId)
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Project Items (Contracting Only)
  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items", projectId],
    queryFn: async () => {
      if (projectType === "finishing") return [];
      const { data, error } = await supabase
        .from("project_items")
        .select("id, name, phase_id")
        .eq("project_id", projectId);
      if (error) throw error;
      return data || [];
    },
    enabled: projectType === "contracting",
  });

  // Form State
  const [supplierId, setSupplierId] = useState<string>(editingPurchase?.supplier_id || "");
  const [invoiceNumber, setInvoiceNumber] = useState<string>(editingPurchase?.invoice_number || "");
  const [date, setDate] = useState<string>(
    editingPurchase?.date || new Date().toISOString().split("T")[0]
  );
  const [phaseId, setPhaseId] = useState<string>(
    editingPurchase?.phase_id || activePhaseId || ""
  );
  const [projectItemId, setProjectItemId] = useState<string>(editingPurchase?.project_item_id || "");
  const [notes, setNotes] = useState<string>(editingPurchase?.notes || "");

  const effectivePhaseId = activePhaseId || (phaseId && phaseId !== "none" ? phaseId : null);

  // Filtered Project Items based on effective phase
  const filteredProjectItems = useMemo(() => {
    if (projectType === "finishing") return [];
    if (!effectivePhaseId) return projectItems;
    return projectItems.filter((item) => item.phase_id === effectivePhaseId);
  }, [projectItems, effectivePhaseId, projectType]);

  // Items or Direct Total
  const [isItemized, setIsItemized] = useState<boolean>(
    editingPurchase?.items && Array.isArray(editingPurchase.items) && editingPurchase.items.length > 0
  );
  const [directTotal, setDirectTotal] = useState<string>(
    editingPurchase && (!editingPurchase.items || editingPurchase.items.length === 0)
      ? String(editingPurchase.total_amount || "")
      : ""
  );
  const [items, setItems] = useState<ItemRow[]>(
    editingPurchase?.items && Array.isArray(editingPurchase.items) && editingPurchase.items.length > 0
      ? editingPurchase.items
      : [{ name: "", qty: 1, price: 0, unit: "قطعة" }]
  );

  // Payment section state
  const [hasPaidNow, setHasPaidNow] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [treasuryId, setTreasuryId] = useState<string>(defaultTreasuryId || "");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Existing payments on edit
  const existingPaidSum = Number(editingPurchase?.paid_amount || 0);

  // Calculation of Total Incurred
  const calculatedTotal = useMemo(() => {
    if (isItemized) {
      return items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
    }
    return Number(directTotal) || 0;
  }, [isItemized, items, directTotal]);

  const numPaidNow = Number(paidAmount) || 0;
  const supplierRemaining = Math.max(0, calculatedTotal - numPaidNow);

  // Track Dirty State
  const isDirty = useMemo(() => {
    return Boolean(
      supplierId ||
      invoiceNumber ||
      directTotal ||
      items.some((i) => i.name.trim() || i.price > 0) ||
      notes ||
      hasPaidNow
    );
  }, [supplierId, invoiceNumber, directTotal, items, notes, hasPaidNow]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Supplier Combobox Options
  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliers.map((s) => ({
      value: s.id,
      label: s.name,
      phone: s.phone || undefined,
      badge: s.category || undefined,
    }));
  }, [suppliers]);

  // Item helpers
  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: "", qty: 1, price: 0, unit: "قطعة" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Validations
      if (!supplierId) {
        throw new Error("يرجى اختيار المورد.");
      }
      if (calculatedTotal <= 0) {
        throw new Error("يرجى إدخال قيمة صحيحة للفاتورة.");
      }
      if (editingPurchase && calculatedTotal < existingPaidSum) {
        throw new Error(
          `لا يمكن تقليل إجمالي الفاتورة (${calculatedTotal} د.ل) عن إجمالي المسدد سابقاً (${existingPaidSum} د.ل).`
        );
      }
      if (hasPaidNow) {
        if (numPaidNow <= 0) {
          throw new Error("يرجى إدخال مبلغ دفع صالح.");
        }
        if (numPaidNow > calculatedTotal) {
          throw new Error("مبلغ الدفع لا يمكن أن يتجاوز إجمالي الفاتورة.");
        }
        if (!treasuryId) {
          throw new Error("يرجى اختيار الخزينة التي سيتم الدفع منها.");
        }
        if (!paymentMethod) {
          throw new Error("يرجى تحديد طريقة الدفع للسداد الفوري.");
        }
      }

      // 2. Prepare Purchase Payload
      const validItems = isItemized
        ? items.filter((i) => i.name.trim())
        : [];

      const purchasePayload: any = {
        project_id: projectId,
        phase_id: effectivePhaseId || null,
        project_item_id: projectType === "contracting" ? (projectItemId && projectItemId !== "none" ? projectItemId : null) : null,
        supplier_id: supplierId,
        date,
        invoice_number: invoiceNumber.trim() || null,
        purchase_type: "material",
        items: validItems.length > 0 ? JSON.parse(JSON.stringify(validItems)) : null,
        total_amount: calculatedTotal,
        notes: notes.trim() || null,
      };

      let activePurchaseId = editingPurchase?.id;

      if (editingPurchase) {
        const { error: updateErr } = await supabase
          .from("purchases")
          .update(purchasePayload)
          .eq("id", editingPurchase.id);
        if (updateErr) throw updateErr;
      } else if (hasPaidNow && numPaidNow > 0) {
        // Immediate Payment: Atomic DB RPC
        const paymentPayload = {
          treasury_id: treasuryId,
          amount: numPaidNow,
          payment_method: paymentMethod,
          date: paymentDate,
          notes: `دفعة أولية عند إنشاء الفاتورة رقم ${invoiceNumber || "بدون رقم"}`,
          idempotency_key: paymentOperation.getKey({ purchasePayload, treasuryId, numPaidNow, paymentMethod, paymentDate }),
        };

        const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
          "create_purchase_with_immediate_payment",
          {
            p_purchase: purchasePayload,
            p_payment: paymentPayload,
          }
        );

        if (rpcErr) throw rpcErr;
        activePurchaseId = rpcRes?.purchase_id;
        setCreatedPurchaseId(activePurchaseId);
      } else {
        // Unpaid / Credit Purchase: Standard Purchase Insert under RLS
        purchasePayload.paid_amount = 0;
        purchasePayload.status = "due";
        const { data: newPurchase, error: insertErr } = await supabase
          .from("purchases")
          .insert([purchasePayload])
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        activePurchaseId = newPurchase.id;
        setCreatedPurchaseId(activePurchaseId);
      }

      return activePurchaseId;
    },
    onSuccess: () => {
      paymentOperation.reset();
      invalidateFinancialQueries(queryClient);
      // Invalidate relevant queries without global reload
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["project-financial-summary-authoritative-v4", projectId],
      });

      toast({
        title: editingPurchase ? "تم تحديث الفاتورة بنجاح" : "تم حفظ الفاتورة بنجاح",
        description: hasPaidNow
          ? `تم قيد الفاتورة وسداد دفعة نقدية بقيمة ${formatCurrencyLYD(numPaidNow)}.`
          : `تم قيد الفاتورة كالتزام ذممي مستحق.`,
      });

      onSuccess();
    },
    onError: (err: any) => {
      if (err.message?.includes("PURCHASE_SAVED_PAYMENT_FAILED")) {
        toast({
          title: "تنبيه: تم حفظ الفاتورة وفشل قيد الدفعة",
          description: "تم قيد الفاتورة كالتزام غير مسدد، تعذر تسجيل حركة الخزينة. يمكنك المحاولة مجدداً.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ أثناء الحفظ",
          description: err.message || "حدث خطأ غير متوقع أثناء حفظ الفاتورة.",
          variant: "destructive",
        });
      }
    },
  });

  // Dedicated Payment Retry Action (Idempotent: Only inserts payment for existing purchase)
  const handleRetryPayment = async () => {
    if (!createdPurchaseId || !paymentFailedState.amount || !paymentFailedState.treasuryId) return;
    const idempotencyKey = `initial_payment_${createdPurchaseId}`;
    try {
      const { error } = await supabase.from("purchase_payments").insert([
        {
          purchase_id: createdPurchaseId,
          treasury_id: paymentFailedState.treasuryId,
          amount: paymentFailedState.amount,
          payment_method: paymentFailedState.method,
          date: paymentDate,
          notes: `إعادة محاولة سداد دفعة أولية للفاتورة ${invoiceNumber || createdPurchaseId.slice(0, 8)}`,
          idempotency_key: idempotencyKey,
        },
      ]);
      // If error is unique violation on idempotency_key, payment already exists on server
      if (error && !error.message?.includes("idx_purchase_payments_idempotency") && !error.message?.includes("duplicate key")) {
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["project-financial-summary-authoritative-v4", projectId],
      });

      toast({
        title: "تم سداد الدفعة بنجاح",
        description: `تم تسجيل الدفعة النقدية بقيمة ${formatCurrencyLYD(paymentFailedState.amount)}.`,
      });

      setPaymentFailedState({ failed: false, errorMsg: "", amount: 0, treasuryId: "", method: "cash" });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "فشلت إعادة المحاولة",
        description: err.message || "تعذر قيد الدفعة، يمكنك إغلاق النموذج وسدادها لاحقاً.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5 text-right" dir="rtl">
      {/* Partial Payment Failure State Alert */}
      {paymentFailedState.failed && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-bold">
              تم حفظ الفاتورة برقم ({createdPurchaseId?.slice(0, 8)}) كالتزام ذممي غير مسدد، ولكن تعذر تسجيل الدفعة النقدية:
            </p>
            <p className="text-xs">{paymentFailedState.errorMsg}</p>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleRetryPayment}
                className="gap-1 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                إعادة محاولة تسجيل الدفعة فقط
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onSuccess}
                className="text-xs"
              >
                إغلاق ومتابعة السداد لاحقاً
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* SECTION 1: WHO (Supplier Selector) */}
      <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-primary" />
          المورد <span className="text-destructive">*</span>
        </Label>
        <EntityCombobox
          options={supplierOptions}
          value={supplierId}
          onValueChange={setSupplierId}
          placeholder="ابحث عن المورد أو أضف مورداً جديداً..."
          searchPlaceholder="ابحث باسم المورد أو الهاتف..."
          onCreateNew={() => setQuickSupplierOpen(true)}
          createButtonText="+ إضافة مورد جديد"
          showCreateButton={true}
          icon="building"
          disabled={saveMutation.isPending || (Boolean(editingPurchase) && existingPaidSum > 0)}
        />
        {editingPurchase && existingPaidSum > 0 && (
          <p className="text-[11px] text-muted-foreground">
            لا يمكن تغيير المورد نظراً لوجود مدفوعات تاريخية مسجلة على هذه الفاتورة.
          </p>
        )}
      </div>

      {/* SECTION 2: INVOICE DETAILS & CONTEXT */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" />
          بيانات الفاتورة
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">رقم الفاتورة (اختياري)</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="مثال: INV-2026-001"
              className="text-right"
              disabled={saveMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              تاريخ الفاتورة <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-right"
              disabled={saveMutation.isPending}
            />
          </div>
        </div>

        {/* Phase and Project Item Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {activePhaseId ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                المرحلة التابعة
              </Label>
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  {activePhaseName || phases.find((p) => p.id === activePhaseId)?.name || "المرحلة الحالية"}
                </span>
                <Badge variant="outline" className="text-[10px] bg-background gap-1 font-normal">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  محددة من مساحة العمل
                </Badge>
              </div>
            </div>
          ) : phases.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                المرحلة التابعة (اختياري)
              </Label>
              <Select value={phaseId} onValueChange={setPhaseId} disabled={saveMutation.isPending}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="اختر مرحلة..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">بدون مرحلة محددة</SelectItem>
                  {phases.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {projectType === "contracting" && filteredProjectItems.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                بند المشروع المرتبط (اختياري)
              </Label>
              <Select value={projectItemId} onValueChange={setProjectItemId} disabled={saveMutation.isPending}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="اختر بند المشروع..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">بدون ارتباط ببند</SelectItem>
                  {filteredProjectItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                اختياري — اختر البند الذي ترتبط به هذه العملية داخل المشروع.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: VALUE & ITEMS */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold flex items-center gap-1.5">
            <Package className="h-4 w-4 text-primary" />
            قيمة المواد والمشتريات <span className="text-destructive">*</span>
          </Label>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setIsItemized(false)}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                !isItemized ? "bg-background text-foreground font-bold shadow-sm" : "text-muted-foreground"
              )}
            >
              إجمالي مباشر
            </button>
            <button
              type="button"
              onClick={() => setIsItemized(true)}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                isItemized ? "bg-background text-foreground font-bold shadow-sm" : "text-muted-foreground"
              )}
            >
              تفصيل بنود الفاتورة
            </button>
          </div>
        </div>

        {!isItemized ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">إجمالي قيمة الفاتورة (د.ل)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={directTotal}
              onChange={(e) => setDirectTotal(e.target.value)}
              placeholder="0.00"
              className="text-left font-bold text-base"
              dir="ltr"
              disabled={saveMutation.isPending}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                <Input
                  value={item.name}
                  onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                  placeholder="اسم المادة..."
                  className="flex-1 text-right text-xs"
                  disabled={saveMutation.isPending}
                />
                <Input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(e) => handleItemChange(idx, "qty", Number(e.target.value))}
                  placeholder="الكمية"
                  className="w-16 text-center text-xs"
                  disabled={saveMutation.isPending}
                />
                <Input
                  value={item.unit}
                  onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                  placeholder="الوحدة"
                  className="w-16 text-center text-xs"
                  disabled={saveMutation.isPending}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => handleItemChange(idx, "price", Number(e.target.value))}
                  placeholder="السعر"
                  className="w-24 text-left text-xs font-semibold"
                  dir="ltr"
                  disabled={saveMutation.isPending}
                />
                <span className="text-xs font-bold w-20 text-left shrink-0">
                  {formatCurrencyLYD((item.qty || 0) * (item.price || 0))}
                </span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                    disabled={saveMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="text-xs gap-1 h-8"
                disabled={saveMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة مادة أخرى
              </Button>
              <div className="text-sm font-bold text-primary">
                الإجمالي المحسوب: {formatCurrencyLYD(calculatedTotal)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: INCURRED VS PAID NOW (OPTIONAL INITIAL PAYMENT) */}
      {!editingPurchase && (
        <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" />
              حالة السداد النقدي
            </Label>
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => {
                  setHasPaidNow(false);
                  setPaidAmount("");
                }}
                className={cn(
                  "px-3 py-1 rounded-md transition-colors",
                  !hasPaidNow ? "bg-background text-foreground font-bold shadow-sm" : "text-muted-foreground"
                )}
              >
                غير مسدد (ذمة مورد)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasPaidNow(true);
                  if (!paidAmount && calculatedTotal > 0) {
                    setPaidAmount(String(calculatedTotal));
                  }
                }}
                className={cn(
                  "px-3 py-1 rounded-md transition-colors",
                  hasPaidNow ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground"
                )}
              >
                دفع مبلغ الآن
              </button>
            </div>
          </div>

          {hasPaidNow ? (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    المبلغ المدفوع الآن (د.ل) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={calculatedTotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-left font-bold text-base text-primary"
                    dir="ltr"
                    disabled={saveMutation.isPending}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={saveMutation.isPending}>
                    <SelectTrigger className="text-right" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="cash">نقداً (كاش)</SelectItem>
                      <SelectItem value="bank_transfer">تحويل مصرفي</SelectItem>
                      <SelectItem value="cheque">صك مصرفي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Context-aware Treasury Selector */}
              <TreasurySelector
                value={treasuryId}
                onValueChange={setTreasuryId}
                projectType={projectType}
                projectDefaultTreasuryId={defaultTreasuryId}
                requiredAmount={numPaidNow}
                disabled={saveMutation.isPending}
              />
            </div>
          ) : (
            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              سيتم تسجيل الفاتورة كالتزام مالي متكبد على المشروع وذمة مستحقة للمورد دون أي خصم من الخزينة.
            </div>
          )}

          {/* Live Financial Preview Matrix */}
          <div className="grid grid-cols-3 gap-2 p-2.5 bg-muted/40 rounded-lg border border-border/60 text-center text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">قيمة الفاتورة</span>
              <span className="font-bold text-foreground text-sm">{formatCurrencyLYD(calculatedTotal)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">المدفوع كاش</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formatCurrencyLYD(numPaidNow)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">المتبقي للمورد</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                {formatCurrencyLYD(supplierRemaining)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: NOTES */}
      <div className="space-y-1.5 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-xs text-muted-foreground">ملاحظات إضافية</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أي تفاصيل أو ملاحظات حول هذه الفاتورة..."
          rows={2}
          className="text-right resize-none"
          disabled={saveMutation.isPending}
        />
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saveMutation.isPending}
        >
          إلغاء
        </Button>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || calculatedTotal <= 0 || !supplierId}
          className="gap-2 font-bold px-6"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editingPurchase ? "تحديث الفاتورة" : "حفظ الفاتورة"}
        </Button>
      </div>

      {/* Nested Supplier Quick Add Dialog */}
      <QuickAddSupplierDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSuccess={(newSupplier) => {
          setSupplierId(newSupplier.id);
        }}
      />
    </div>
  );
};
