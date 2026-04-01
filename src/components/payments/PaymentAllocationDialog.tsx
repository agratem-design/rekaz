import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
  Wallet,
  Landmark,
  CreditCard,
  Receipt,
  ShoppingCart,
  Wrench,
  Package,
  Zap,
  CheckCheck,
  ArrowDownToLine,
  Banknote,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";

export interface UnpaidInvoice {
  id: string;
  type: "purchase" | "rental" | "item";
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
  supplier_name?: string;
}

export interface AllocationInput {
  invoice: UnpaidInvoice;
  amount: number;
  selected: boolean;
}

interface PaymentFormData {
  date: string;
  payment_method: string;
  notes: string;
}

export interface PaymentSaveData {
  formData: PaymentFormData;
  allocations: AllocationInput[];
  useAdvanceCredit: boolean;
  advanceCreditAmount: number;
}

interface Phase {
  id: string;
  name: string;
  phase_number: number | null;
  treasury_id: string | null;
  has_percentage: boolean;
  percentage_value: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  invoices: UnpaidInvoice[];
  phases: Phase[];
  allTreasuries: any[];
  onSave: (data: PaymentSaveData) => void;
  isSaving: boolean;
  projectName?: string;
  advanceBalance?: number;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case "purchase": return <ShoppingCart className="h-3.5 w-3.5" />;
    case "rental": return <Wrench className="h-3.5 w-3.5" />;
    case "item": return <Package className="h-3.5 w-3.5" />;
    default: return <Receipt className="h-3.5 w-3.5" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "purchase": return "مشتريات";
    case "rental": return "إيجار";
    case "item": return "بند";
    default: return type;
  }
};

export default function PaymentAllocationDialog({
  open,
  onClose,
  invoices,
  phases,
  allTreasuries,
  onSave,
  isSaving,
  projectName,
  advanceBalance = 0,
}: Props) {
  const [formData, setFormData] = useState<PaymentFormData>({
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    notes: "",
  });
  const [allocations, setAllocations] = useState<AllocationInput[]>([]);
  const [bulkAmount, setBulkAmount] = useState("");
  const [useAdvanceCredit, setUseAdvanceCredit] = useState(false);
  const [advanceCreditAmount, setAdvanceCreditAmount] = useState(0);

  // Initialize allocations when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && invoices.length > 0) {
      setAllocations(invoices.map(inv => ({ invoice: inv, amount: 0, selected: false })));
      setBulkAmount("");
      setUseAdvanceCredit(false);
      setAdvanceCreditAmount(0);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        notes: "",
      });
    }
    if (!isOpen) onClose();
  }, [invoices, onClose]);

  // Computed values
  const stats = useMemo(() => {
    const selected = allocations.filter(a => a.selected && a.amount > 0);
    const totalBase = selected.reduce((s, a) => s + a.amount, 0);
    const totalFee = selected.reduce((s, a) => {
      return s + (a.invoice.service_fee_percentage > 0 ? a.amount * a.invoice.service_fee_percentage / 100 : 0);
    }, 0);
    const totalRemaining = allocations.reduce((s, a) => s + a.invoice.remaining, 0);
    const totalRemainingWithFee = allocations.reduce((s, a) => {
      const pct = a.invoice.service_fee_percentage || 0;
      return s + a.invoice.remaining * (1 + pct / 100);
    }, 0);
    const selectedCount = selected.length;
    const totalCount = allocations.length;
    const coveragePercent = totalRemaining > 0 ? Math.min(100, (totalBase / totalRemaining) * 100) : 0;

    const creditUsed = useAdvanceCredit ? Math.min(advanceCreditAmount, totalBase + totalFee, advanceBalance) : 0;
    const cashRequired = totalBase + totalFee - creditUsed;

    return { totalBase, totalFee, totalWithFee: totalBase + totalFee, totalRemaining, totalRemainingWithFee, selectedCount, totalCount, coveragePercent, creditUsed, cashRequired };
  }, [allocations, useAdvanceCredit, advanceCreditAmount, advanceBalance]);

  // Group by phase
  const phaseGroups = useMemo(() => {
    const groups: Record<string, {
      phase: Phase | null;
      phaseName: string;
      indices: number[];
      totalRemaining: number;
      totalRemainingWithFee: number;
    }> = {};

    allocations.forEach((alloc, idx) => {
      const key = alloc.invoice.phase_id || "__none__";
      if (!groups[key]) {
        const phase = phases.find(p => p.id === alloc.invoice.phase_id) || null;
        groups[key] = {
          phase,
          phaseName: alloc.invoice.phase_name || "بدون مرحلة",
          indices: [],
          totalRemaining: 0,
          totalRemainingWithFee: 0,
        };
      }
      groups[key].indices.push(idx);
      groups[key].totalRemaining += alloc.invoice.remaining;
      const pct = alloc.invoice.service_fee_percentage || 0;
      groups[key].totalRemainingWithFee += alloc.invoice.remaining * (1 + pct / 100);
    });

    return groups;
  }, [allocations, phases]);

  // Actions
  const toggleInvoice = (index: number) => {
    setAllocations(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selected: !updated[index].selected,
        amount: !updated[index].selected ? updated[index].invoice.remaining : 0,
      };
      return updated;
    });
  };

  const updateAmount = (index: number, value: number, isTotal = false) => {
    setAllocations(prev => {
      const updated = [...prev];
      const inv = updated[index].invoice;
      const pct = inv.service_fee_percentage || 0;
      const baseValue = isTotal && pct > 0 ? value / (1 + pct / 100) : value;
      updated[index] = {
        ...updated[index],
        amount: Math.min(Math.max(0, baseValue), inv.remaining),
        selected: baseValue > 0,
      };
      return updated;
    });
  };

  const selectAll = () => {
    const allSelected = allocations.every(a => a.selected);
    setAllocations(prev => prev.map(a => ({
      ...a,
      selected: !allSelected,
      amount: !allSelected ? a.invoice.remaining : 0,
    })));
  };

  const selectPhase = (phaseId: string) => {
    const group = phaseGroups[phaseId];
    if (!group) return;
    const allPhaseSelected = group.indices.every(i => allocations[i].selected);
    setAllocations(prev => {
      const updated = [...prev];
      group.indices.forEach(i => {
        updated[i] = {
          ...updated[i],
          selected: !allPhaseSelected,
          amount: !allPhaseSelected ? updated[i].invoice.remaining : 0,
        };
      });
      return updated;
    });
  };

  const distributeAmount = (total: number) => {
    setBulkAmount(total ? String(total) : "");
    if (total <= 0) {
      setAllocations(prev => prev.map(a => ({ ...a, amount: 0, selected: false })));
      return;
    }
    let remaining = total;
    setAllocations(prev =>
      prev.map(alloc => {
        if (remaining <= 0) return { ...alloc, selected: false, amount: 0 };
        const pct = alloc.invoice.service_fee_percentage || 0;
        const invoiceTotalDue = alloc.invoice.remaining * (1 + pct / 100);
        if (remaining >= invoiceTotalDue) {
          remaining -= invoiceTotalDue;
          return { ...alloc, selected: true, amount: alloc.invoice.remaining };
        } else {
          const baseAmount = pct > 0 ? remaining / (1 + pct / 100) : remaining;
          remaining = 0;
          return { ...alloc, selected: true, amount: Math.min(baseAmount, alloc.invoice.remaining) };
        }
      })
    );
  };

  const handleToggleCredit = (checked: boolean) => {
    setUseAdvanceCredit(checked);
    if (checked) {
      // Auto-fill with the lesser of balance or total
      setAdvanceCreditAmount(Math.min(advanceBalance, stats.totalWithFee));
    } else {
      setAdvanceCreditAmount(0);
    }
  };

  const handleSave = () => {
    onSave({
      formData,
      allocations,
      useAdvanceCredit,
      advanceCreditAmount: stats.creditUsed,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            تسديد جديد
            {projectName && <span className="text-sm font-normal text-muted-foreground">— {projectName}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Settings Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">التاريخ</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">كاش</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ملاحظات</Label>
              <Input
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="اختياري..."
                className="h-9"
              />
            </div>
          </div>

          {/* Advance Credit Section */}
          {advanceBalance > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">رصيد على الحساب</span>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                    {formatCurrencyLYD(advanceBalance)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="use-credit" className="text-xs text-emerald-700 cursor-pointer">خصم من الرصيد</Label>
                  <Switch
                    id="use-credit"
                    checked={useAdvanceCredit}
                    onCheckedChange={handleToggleCredit}
                  />
                </div>
              </div>
              {useAdvanceCredit && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        type="number"
                        value={advanceCreditAmount || ""}
                        onChange={e => setAdvanceCreditAmount(Math.min(parseFloat(e.target.value) || 0, advanceBalance, stats.totalWithFee))}
                        placeholder="مبلغ الخصم من الرصيد..."
                        className="h-9 border-emerald-300"
                        max={Math.min(advanceBalance, stats.totalWithFee)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => setAdvanceCreditAmount(Math.min(advanceBalance, stats.totalWithFee))}
                    >
                      الحد الأقصى
                    </Button>
                  </div>
                  {/* Balance after deduction */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-muted-foreground">الرصيد بعد الخصم:</span>
                    <span className={`font-semibold ${advanceBalance - stats.creditUsed < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {formatCurrencyLYD(advanceBalance - stats.creditUsed)}
                    </span>
                  </div>
                  {advanceCreditAmount > advanceBalance && (
                    <p className="text-xs text-destructive font-medium px-1">⚠️ المبلغ يتجاوز الرصيد المتاح</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Smart Distribution Bar */}
          <div className="bg-muted/40 border rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Banknote className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="number"
                  value={bulkAmount}
                  onChange={e => distributeAmount(parseFloat(e.target.value) || 0)}
                  placeholder="أدخل المبلغ الإجمالي للتوزيع التلقائي..."
                  className="pr-10 h-10 text-base font-semibold"
                />
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={selectAll}
                className="gap-1.5 h-10"
              >
                <CheckCheck className="h-4 w-4" />
                {allocations.every(a => a.selected) ? "إلغاء الكل" : "تسديد الكل"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => distributeAmount(stats.totalRemainingWithFee)}
                className="gap-1.5 h-10"
              >
                <ArrowDownToLine className="h-4 w-4" />
                الكل: {formatCurrencyLYD(stats.totalRemainingWithFee)}
              </Button>
            </div>
            {/* Coverage progress */}
            <div className="flex items-center gap-3">
              <Progress value={stats.coveragePercent} className="flex-1 h-2" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {Math.round(stats.coveragePercent)}% تغطية ({stats.selectedCount}/{stats.totalCount})
              </span>
            </div>
          </div>

          {/* Invoice Groups by Phase */}
          <div className="space-y-3">
            {Object.entries(phaseGroups).map(([phaseId, group]) => {
              const phaseSelected = group.indices.every(i => allocations[i].selected);
              const phasePartial = group.indices.some(i => allocations[i].selected) && !phaseSelected;
              const phaseTotal = group.indices.reduce((s, i) => {
                const a = allocations[i];
                if (!a.selected) return s;
                const pct = a.invoice.service_fee_percentage || 0;
                return s + a.amount * (1 + pct / 100);
              }, 0);
              const treasury = group.phase?.treasury_id
                ? allTreasuries.find(t => t.id === group.phase!.treasury_id)
                : null;
              const parentTreasury = treasury?.parent_id
                ? allTreasuries.find(t => t.id === treasury.parent_id)
                : null;
              const treasuryName = treasury
                ? (parentTreasury ? `${parentTreasury.name} / ${treasury.name}` : treasury.name)
                : null;

              return (
                <div key={phaseId} className="border rounded-xl overflow-hidden">
                  {/* Phase Header */}
                  <div
                    className="bg-muted/50 px-4 py-2.5 flex items-center gap-3 border-b cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => selectPhase(phaseId)}
                  >
                    <Checkbox
                      checked={phaseSelected}
                      className={phasePartial ? "data-[state=unchecked]:bg-primary/30" : ""}
                      onCheckedChange={() => selectPhase(phaseId)}
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {group.phase?.phase_number ? `م${group.phase.phase_number}` : ""} {group.phaseName}
                      </span>
                      {group.phase?.has_percentage && group.phase.percentage_value > 0 && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          +{group.phase.percentage_value}%
                        </Badge>
                      )}
                      {treasuryName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mr-auto">
                          {treasury?.treasury_type === "cash"
                            ? <Wallet className="h-3 w-3" />
                            : <Landmark className="h-3 w-3" />
                          }
                          {treasuryName}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <span className="text-xs text-muted-foreground">{group.indices.length} بند</span>
                      {phaseTotal > 0 && (
                        <p className="text-xs font-bold text-primary">{formatCurrencyLYD(phaseTotal)}</p>
                      )}
                    </div>
                  </div>

                  {/* Invoice Cards */}
                  <div className="divide-y divide-border/50">
                    {group.indices.map(idx => {
                      const alloc = allocations[idx];
                      const inv = alloc.invoice;
                      const pct = inv.service_fee_percentage || 0;
                      const fee = pct > 0 && alloc.amount > 0 ? alloc.amount * pct / 100 : 0;
                      const totalWithFee = inv.remaining * (1 + pct / 100);
                      const displayAmount = pct > 0 && alloc.amount > 0
                        ? Math.round(alloc.amount * (1 + pct / 100))
                        : alloc.amount;

                      return (
                        <div
                          key={inv.id}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer hover:bg-muted/30 ${
                            alloc.selected ? "bg-primary/5" : ""
                          }`}
                          onClick={() => toggleInvoice(idx)}
                        >
                          <Checkbox
                            checked={alloc.selected}
                            onCheckedChange={() => toggleInvoice(idx)}
                          />

                          {/* Icon + Type */}
                          <div className={`p-1.5 rounded-md ${alloc.selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {getTypeIcon(inv.type)}
                          </div>

                          {/* Description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{inv.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{getTypeLabel(inv.type)}</span>
                              {inv.supplier_name && (
                                <>
                                  <span>•</span>
                                  <span>{inv.supplier_name}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Remaining */}
                          <div className="text-left shrink-0 w-24">
                            <p className="text-xs text-muted-foreground">المتبقي</p>
                            <p className="text-sm font-semibold text-destructive">
                              {formatCurrencyLYD(inv.remaining)}
                            </p>
                            {pct > 0 && (
                              <p className="text-[10px] text-primary">
                                شامل: {formatCurrencyLYD(totalWithFee)}
                              </p>
                            )}
                          </div>

                          {/* Amount Input */}
                          <div className="shrink-0 w-32" onClick={e => e.stopPropagation()}>
                            {alloc.selected ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={displayAmount || ""}
                                    onChange={e => updateAmount(idx, parseFloat(e.target.value) || 0, pct > 0)}
                                    className="h-8 text-sm font-semibold"
                                    min={0}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-1.5 text-[10px] shrink-0"
                                    onClick={() => updateAmount(idx, totalWithFee, true)}
                                  >
                                    الكل
                                  </Button>
                                </div>
                                {pct > 0 && alloc.amount > 0 && (
                                  <p className="text-[10px] text-muted-foreground text-center">
                                    {formatCurrencyLYD(alloc.amount)} + {pct}%
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-center text-muted-foreground">—</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Footer Summary */}
        <div className="border-t bg-card p-4 shrink-0 space-y-3">
          {(stats.totalFee > 0 || stats.creditUsed > 0) && (
            <div className="space-y-1">
              {stats.totalFee > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>الفواتير: {formatCurrencyLYD(stats.totalBase)}</span>
                  <span>رسوم الخدمات: {formatCurrencyLYD(stats.totalFee)}</span>
                </div>
              )}
              {stats.creditUsed > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Wallet className="h-3 w-3" />
                    خصم من الرصيد: {formatCurrencyLYD(stats.creditUsed)}
                  </span>
                  <span className="text-muted-foreground">
                    المطلوب من الخزينة: {formatCurrencyLYD(stats.cashRequired)}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || stats.totalBase <= 0}
              className="flex-1 gap-2 text-base h-11"
            >
              {isSaving ? (
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isSaving ? "جاري الحفظ..." : `تسديد ${formatCurrencyLYD(stats.totalWithFee)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
