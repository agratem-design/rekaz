import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TreasurySelector } from "@/components/treasury/TreasurySelector";
import { formatCurrencyLYD } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Building2, User, Wallet, Calendar, FileText, CheckCircle2, 
  AlertCircle, ArrowRight, Loader2, Sparkles, Receipt, Layers
} from "lucide-react";

interface SupplierProjectSettlementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientName: string;
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  onSuccess?: () => void;
}

export const SupplierProjectSettlementDrawer: React.FC<SupplierProjectSettlementDrawerProps> = ({
  isOpen,
  onClose,
  supplierId,
  supplierName,
  projectId,
  projectName,
  projectType,
  clientName,
  totalPurchases,
  totalPaid,
  totalDue,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Fetch unpaid or partially paid purchases for this supplier on this project
  const { data: unpaidPurchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["supplier-unpaid-purchases", supplierId, projectId],
    queryFn: async () => {
      if (!supplierId || !projectId) return [];
      const { data, error } = await supabase
        .from("purchases")
        .select("id, invoice_number, title, date, total_amount, paid_amount, status, notes")
        .eq("supplier_id", supplierId)
        .eq("project_id", projectId)
        .order("date", { ascending: true });
      if (error) throw error;

      return (data || [])
        .map((p) => ({
          ...p,
          remaining: Number(p.total_amount || 0) - Number(p.paid_amount || 0),
        }))
        .filter((p) => p.remaining > 0);
    },
    enabled: isOpen && !!supplierId && !!projectId,
  });

  // Form states
  const [treasuryId, setTreasuryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");
  const [totalPayAmount, setTotalPayAmount] = useState<string>("");
  const [allocations, setAllocations] = useState<{ [purchaseId: string]: number }>({});

  // Reset form when drawer opens or context changes (supplier/project switch)
  useEffect(() => {
    if (isOpen) {
      setTreasuryId("");
      setPaymentMethod("cash");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setTotalPayAmount(totalDue > 0 ? totalDue.toString() : "");
    }
  }, [isOpen, supplierId, projectId]);

  // Sync default allocations across unpaid purchases when they load
  useEffect(() => {
    if (isOpen && unpaidPurchases.length > 0) {
      const initialAllocs: { [id: string]: number } = {};
      let remainingToDistribute = Math.max(0, totalDue);
      unpaidPurchases.forEach((p) => {
        const canTake = Math.min(p.remaining, remainingToDistribute);
        initialAllocs[p.id] = canTake;
        remainingToDistribute -= canTake;
      });
      setAllocations(initialAllocs);
    }
  }, [isOpen, unpaidPurchases, totalDue]);

  // Handle total amount change with oldest-first deterministic preview
  const handleTotalAmountChange = (valStr: string) => {
    setTotalPayAmount(valStr);
    const num = parseFloat(valStr) || 0;
    let remainingToDistribute = Math.min(num, totalDue);
    const newAllocs: { [id: string]: number } = {};

    unpaidPurchases.forEach((p) => {
      const take = Math.min(p.remaining, Math.max(0, remainingToDistribute));
      newAllocs[p.id] = take;
      remainingToDistribute -= take;
    });
    setAllocations(newAllocs);
  };

  // Handle manual individual invoice allocation edit
  const handleInvoiceAllocChange = (purchaseId: string, valStr: string) => {
    const p = unpaidPurchases.find((item) => item.id === purchaseId);
    if (!p) return;
    const maxVal = p.remaining;
    let num = parseFloat(valStr) || 0;
    if (num > maxVal) num = maxVal;
    if (num < 0) num = 0;

    const newAllocs = { ...allocations, [purchaseId]: num };
    setAllocations(newAllocs);

    const sum = Object.values(newAllocs).reduce((acc, curr) => acc + (curr || 0), 0);
    setTotalPayAmount(sum > 0 ? sum.toString() : "");
  };

  // Shortcut to pay full due
  const handleFullDueShortcut = () => {
    setTotalPayAmount(totalDue.toString());
    const fullAllocs: { [id: string]: number } = {};
    unpaidPurchases.forEach((p) => {
      fullAllocs[p.id] = p.remaining;
    });
    setAllocations(fullAllocs);
  };

  const calculatedTotalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((acc, curr) => acc + (curr || 0), 0);
  }, [allocations]);

  const remainingAfterPayment = Math.max(0, totalDue - calculatedTotalAllocated);

  // Settlement mutation
  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!treasuryId) {
        throw new Error("يرجى تحديد الخزينة أو الحساب المصرفي المخصوم منه");
      }
      if (calculatedTotalAllocated <= 0) {
        throw new Error("يرجى إدخال مبلغ صحيح للسداد");
      }
      if (calculatedTotalAllocated > totalDue + 0.001) {
        throw new Error("المبلغ المراد سداده يتجاوز إجمالي المستحق للمورد على هذا المشروع");
      }

      // Build payload for atomic RPC
      const allocList = Object.entries(allocations)
        .filter(([_, amt]) => amt > 0)
        .map(([purchaseId, amt]) => ({
          purchase_id: purchaseId,
          amount: amt,
          idempotency_key: `SUP-PAY-${supplierId}-${purchaseId}-${Date.now()}`,
        }));

      if (allocList.length === 0) {
        throw new Error("لم يتم تحديد مبالغ سداد لأي فاتورة");
      }

      const { data, error } = await (supabase.rpc as any)("settle_supplier_project_invoices_atomic", {
        p_supplier_id: supplierId,
        p_project_id: projectId,
        p_treasury_id: treasuryId,
        p_payment_method: paymentMethod,
        p_date: paymentDate,
        p_notes: notes || `سداد مستحقات مورد عن مشروع ${projectName}`,
        p_allocations: allocList,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-stats"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["project-financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-unpaid-purchases", supplierId, projectId] });

      toast.success(`تم سداد ${formatCurrencyLYD(calculatedTotalAllocated)} بنجاح وحفظ السندات.`);
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء معالجة السداد");
    },
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background" dir="rtl">
        <SheetHeader className="p-5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <span>سداد مستحقات المورد بالمشروع</span>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  تسوية فواتير المورد المنسوبة للمشروع المختار حصراً
                </SheetDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 ${
                projectType === "contracting"
                  ? "border-amber-500/30 text-amber-700 bg-amber-500/10 font-bold"
                  : "border-purple-500/30 text-purple-700 bg-purple-500/10 font-bold"
              }`}
            >
              {projectType === "contracting" ? "قطاع المقاولات" : "قطاع التشطيبات"}
            </Badge>
          </div>

          {/* Context Card (Read-Only) */}
          <div className="mt-3 p-3 rounded-xl bg-card border border-border/60 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">المورد:</span>
              <span className="font-semibold text-foreground truncate">{supplierName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">الزبون:</span>
              <span className="font-semibold text-foreground truncate">{clientName || "—"}</span>
            </div>
            <div className="col-span-2 flex items-center gap-1.5 pt-1 border-t border-border/40">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">المشروع:</span>
              <span className="font-bold text-foreground truncate">{projectName}</span>
            </div>
          </div>
        </SheetHeader>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Position Stats Summary */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
            <div>
              <span className="text-[10px] text-muted-foreground block">إجمالي المشتريات</span>
              <span className="text-xs font-bold text-foreground" dir="ltr">
                {formatCurrencyLYD(totalPurchases)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">المسدد سابقاً</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                {formatCurrencyLYD(totalPaid)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block">المتبقي حالياً</span>
              <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400" dir="ltr">
                {formatCurrencyLYD(totalDue)}
              </span>
            </div>
          </div>

          {/* Amount to Pay & Shortcut */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">المبلغ المراد سداده (د.ل) *</Label>
              {totalDue > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2 font-medium"
                  onClick={handleFullDueShortcut}
                >
                  <Sparkles className="h-3 w-3 ml-1" />
                  سداد كامل المستحق ({formatCurrencyLYD(totalDue)})
                </Button>
              )}
            </div>
            <Input
              type="number"
              min="0"
              max={totalDue}
              step="0.01"
              value={totalPayAmount}
              onChange={(e) => handleTotalAmountChange(e.target.value)}
              placeholder="أدخل المبلغ..."
              className="text-base font-bold text-amber-700 dark:text-amber-400 h-10"
              dir="ltr"
            />
          </div>

          {/* Invoice Allocation Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">توزيع السداد على فواتير المشروع</Label>
              <span className="text-[11px] text-muted-foreground">
                ({unpaidPurchases.length} فواتير متبقية)
              </span>
            </div>

            {loadingPurchases ? (
              <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل فواتير المشروع...
              </div>
            ) : unpaidPurchases.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground bg-muted/10">
                لا توجد فواتير مستحقة الدفع لهذا المورد على هذا المشروع.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {unpaidPurchases.map((p) => {
                  const alloc = allocations[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl border border-border/60 bg-card/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">
                          {p.title || (p.invoice_number ? `فاتورة رقم: ${p.invoice_number}` : "فاتورة توريد مواد")}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{p.date}</span>
                          <span>•</span>
                          <span>المتبقي: {formatCurrencyLYD(p.remaining)}</span>
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <Input
                          type="number"
                          min="0"
                          max={p.remaining}
                          step="0.01"
                          value={alloc > 0 ? alloc : ""}
                          onChange={(e) => handleInvoiceAllocChange(p.id, e.target.value)}
                          placeholder="0.00"
                          className="h-8 text-xs font-bold text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Treasury Selection (Project Domain Bound) */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <Label className="text-xs font-bold">الخزينة المخصوم منها (قطاع {projectType === "contracting" ? "المقاولات" : "التشطيبات"}) *</Label>
            <TreasurySelector
              projectType={projectType}
              value={treasuryId}
              onValueChange={setTreasuryId}
            />
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">طريقة الدفع</Label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                <option value="cash">نقدي (Cash)</option>
                <option value="transfer">تحويل مصرفي (Bank Transfer)</option>
                <option value="check">صك / شيك (Check)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">تاريخ السداد</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">ملاحظات السند</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية على عملية السداد..."
              rows={2}
              className="text-xs"
            />
          </div>

          {/* Impact Preview */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>المستحق قبل السداد:</span>
              <span className="font-semibold text-foreground" dir="ltr">{formatCurrencyLYD(totalDue)}</span>
            </div>
            <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 font-bold">
              <span>المبلغ المراد سداده الآن:</span>
              <span dir="ltr">{formatCurrencyLYD(calculatedTotalAllocated)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground pt-1 border-t border-border/40">
              <span>المتبقي بعد السداد:</span>
              <span className="font-bold text-foreground" dir="ltr">{formatCurrencyLYD(remainingAfterPayment)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/30">
              * ملاحظة محاسبية: السداد يسوي التزام الفواتير ويخصم من الخزينة دون زيادة تكلفة المشروع المعتمدة.
            </p>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-5 border-t border-border/40 bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={settleMutation.isPending}>
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            onClick={() => settleMutation.mutate()}
            disabled={settleMutation.isPending || calculatedTotalAllocated <= 0}
          >
            {settleMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تأكيد سداد ({formatCurrencyLYD(calculatedTotalAllocated)})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
