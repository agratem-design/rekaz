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
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Wrench,
  Layers,
  Lock,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierServiceFormProps {
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

export const SupplierServiceForm: React.FC<SupplierServiceFormProps> = ({
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

  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
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

  // Fetch Project Items for BOQ attribution (Contracting only)
  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items-for-service-form", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_items")
        .select("id, name, phase_id")
        .eq("project_id", projectId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId && projectType === "contracting",
  });

  // Form State
  const [supplierId, setSupplierId] = useState<string>(editingPurchase?.supplier_id || "");
  const [serviceTitle, setServiceTitle] = useState<string>(editingPurchase?.title || "");
  const [invoiceNumber, setInvoiceNumber] = useState<string>(editingPurchase?.invoice_number || "");
  const [date, setDate] = useState<string>(
    editingPurchase?.date || new Date().toISOString().split("T")[0]
  );
  const [phaseId, setPhaseId] = useState<string>(
    editingPurchase?.phase_id || activePhaseId || ""
  );
  const [projectItemId, setProjectItemId] = useState<string>(editingPurchase?.project_item_id || "");
  const [totalAmount, setTotalAmount] = useState<string>(
    editingPurchase ? String(editingPurchase.total_amount || "") : ""
  );
  const [notes, setNotes] = useState<string>(editingPurchase?.notes || "");

  const effectivePhaseId = activePhaseId || (phaseId && phaseId !== "none" ? phaseId : null);

  // Filtered Project Items based on effective phase
  const filteredProjectItems = useMemo(() => {
    if (projectType === "finishing") return [];
    if (!effectivePhaseId) return projectItems;
    return projectItems.filter((item) => item.phase_id === effectivePhaseId);
  }, [projectItems, effectivePhaseId, projectType]);

  // Payment Section
  const [hasPaidNow, setHasPaidNow] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [treasuryId, setTreasuryId] = useState<string>(defaultTreasuryId || "");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const existingPaidSum = Number(editingPurchase?.paid_amount || 0);
  const numTotal = Number(totalAmount) || 0;
  const numPaidNow = Number(paidAmount) || 0;
  const supplierRemaining = Math.max(0, numTotal - numPaidNow);

  // Dirty State
  const isDirty = useMemo(() => {
    return Boolean(
      supplierId ||
      serviceTitle ||
      invoiceNumber ||
      totalAmount ||
      notes ||
      hasPaidNow
    );
  }, [supplierId, serviceTitle, invoiceNumber, totalAmount, notes, hasPaidNow]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliers.map((s) => ({
      value: s.id,
      label: s.name,
      phone: s.phone || undefined,
      badge: s.category || undefined,
    }));
  }, [suppliers]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) {
        throw new Error("يرجى اختيار مقدم الخدمة / المورد.");
      }
      if (!serviceTitle.trim()) {
        throw new Error("يرجى إدخال وصف أو اسم الخدمة.");
      }
      if (numTotal <= 0) {
        throw new Error("يرجى إدخال قيمة صحيحة للخدمة.");
      }
      if (editingPurchase && numTotal < existingPaidSum) {
        throw new Error(
          `لا يمكن تقليل إجمالي الخدمة (${numTotal} د.ل) عن إجمالي المسدد سابقاً (${existingPaidSum} د.ل).`
        );
      }
      if (hasPaidNow) {
        if (numPaidNow <= 0) {
          throw new Error("يرجى إدخال مبلغ دفع صالح.");
        }
        if (numPaidNow > numTotal) {
          throw new Error("مبلغ الدفع لا يمكن أن يتجاوز قيمة الخدمة.");
        }
        if (!treasuryId) {
          throw new Error("يرجى اختيار الخزينة المخصوم منها.");
        }
        if (!paymentMethod) {
          throw new Error("يرجى تحديد طريقة الدفع للسداد الفوري.");
        }
      }

      const purchasePayload: any = {
        project_id: projectId,
        phase_id: effectivePhaseId || null,
        project_item_id: projectType === "contracting" ? (projectItemId === "__none__" || !projectItemId ? null : projectItemId) : null,
        supplier_id: supplierId,
        date,
        title: serviceTitle.trim(),
        invoice_number: invoiceNumber.trim() || null,
        purchase_type: "service",
        items: null,
        total_amount: numTotal,
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
          notes: `سداد أولي لخدمة: ${serviceTitle}`,
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
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({
        queryKey: ["project-financial-summary-authoritative-v4", projectId],
      });

      toast({
        title: editingPurchase ? "تم تحديث الخدمة بنجاح" : "تم حفظ الخدمة بنجاح",
        description: hasPaidNow
          ? `تم قيد الخدمة وسداد دفعة نقدية بقيمة ${formatCurrencyLYD(numPaidNow)}.`
          : `تم قيد الخدمة كالتزام ذممي مستحق.`,
      });

      onSuccess();
    },
    onError: (err: any) => {
      if (err.message?.includes("PURCHASE_SAVED_PAYMENT_FAILED")) {
        toast({
          title: "تنبيه: تم حفظ الخدمة وفشل قيد الدفعة",
          description: "تم قيد الخدمة كالتزام غير مسدد، يمكنك سدادها من قائمة المدفوعات.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ أثناء الحفظ",
          description: err.message || "حدث خطأ أثناء حفظ الخدمة.",
          variant: "destructive",
        });
      }
    },
  });

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
          notes: `إعادة محاولة سداد دفعة أولية لخدمة: ${serviceTitle}`,
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
      {paymentFailedState.failed && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-bold">
              تم حفظ الخدمة كالتزام غير مسدد، ولكن تعذر تسجيل الدفعة النقدية:
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

      {/* SECTION 1: WHO (Service Provider / Supplier) */}
      <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-primary" />
          مقدم الخدمة / المورد <span className="text-destructive">*</span>
        </Label>
        <EntityCombobox
          options={supplierOptions}
          value={supplierId}
          onValueChange={setSupplierId}
          placeholder="ابحث عن المورد أو مقدم الخدمة..."
          searchPlaceholder="ابحث بالاسم أو الهاتف..."
          onCreateNew={() => setQuickSupplierOpen(true)}
          createButtonText="+ إضافة مورد جديد"
          showCreateButton={true}
          icon="building"
          disabled={saveMutation.isPending || (Boolean(editingPurchase) && existingPaidSum > 0)}
        />
        {editingPurchase && existingPaidSum > 0 && (
          <p className="text-[11px] text-muted-foreground">
            لا يمكن تغيير مقدم الخدمة نظراً لوجود مدفوعات تاريخية مسجلة على هذه الفاتورة.
          </p>
        )}
      </div>

      {/* SECTION 2: SERVICE DETAILS */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <Wrench className="h-4 w-4 text-primary" />
          تفاصيل الخدمة
        </Label>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            وصف الخدمة / العمل المنفذ <span className="text-destructive">*</span>
          </Label>
          <Input
            value={serviceTitle}
            onChange={(e) => setServiceTitle(e.target.value)}
            placeholder="مثال: أعمال صب خرسانة، تركيب واجهات، نقل ركام..."
            className="text-right"
            disabled={saveMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">رقم المستند / العقد (اختياري)</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="مثال: SRV-2026-001"
              className="text-right"
              disabled={saveMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              تاريخ التنفيذ <span className="text-destructive">*</span>
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

        {activePhaseId ? (
          <div className="space-y-1.5 pt-1">
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
          <div className="space-y-1.5 pt-1">
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

        {projectType === "contracting" && (
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              بند المشروع المرتبط (اختياري)
            </Label>
            <Select value={projectItemId} onValueChange={setProjectItemId} disabled={saveMutation.isPending}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="اختر بند المشروع المرتبط بالخدمة..." />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__">غير مرتبط ببند محدد (عام للمشروع)</SelectItem>
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

      {/* SECTION 3: VALUE */}
      <div className="space-y-2 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" />
          قيمة الخدمة المتكبدة (د.ل) <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="0.00"
          className="text-left font-bold text-base text-foreground"
          dir="ltr"
          disabled={saveMutation.isPending}
        />
      </div>

      {/* SECTION 4: PAYMENT SECTION */}
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
                غير مسدد (ذمة)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasPaidNow(true);
                  if (!paidAmount && numTotal > 0) {
                    setPaidAmount(String(numTotal));
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
                    max={numTotal}
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
              سيتم تسجيل الخدمة كالتزام مالي متكبد على المشروع وذمة مستحقة لمقدم الخدمة دون خصم من الخزينة.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 p-2.5 bg-muted/40 rounded-lg border border-border/60 text-center text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">قيمة الخدمة</span>
              <span className="font-bold text-foreground text-sm">{formatCurrencyLYD(numTotal)}</span>
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
          placeholder="أي ملاحظات حول تنفيذ الخدمة..."
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
          disabled={saveMutation.isPending || numTotal <= 0 || !supplierId || !serviceTitle.trim()}
          className="gap-2 font-bold px-6"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editingPurchase ? "تحديث الخدمة" : "حفظ الخدمة"}
        </Button>
      </div>

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
