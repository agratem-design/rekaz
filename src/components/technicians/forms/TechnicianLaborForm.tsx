import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Calendar,
  Layers,
  DollarSign,
  FileText,
  Lock,
  Plus,
  Loader2,
  CheckCircle2,
  Trash2,
  Link2,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyLYD } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { QuickAddTechnicianDialog } from "@/components/technicians/QuickAddTechnicianDialog";
import { TreasurySelector } from "@/components/treasury/TreasurySelector";
import { useOperationKey } from "@/hooks/useOperationKey";
import { financialRpc, invalidateFinancialQueries } from "@/lib/financialMutations";
import { invalidateProjectFinancialSummary } from "@/hooks/useProjectFinancialSummary";

interface TechnicianLaborFormProps {
  projectId: string;
  projectType?: "contracting" | "finishing" | string;
  activePhaseId?: string | null;
  activePhaseName?: string | null;
  defaultTreasuryId?: string | null;
  editingRecord?: any | null;
  onSuccess: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface LaborRow {
  key: string;
  technicianId: string;
  quantity: string;
  rate: string;
}

const newRowKey = () => Math.random().toString(36).slice(2, 10);

/**
 * Older records stored notes as "<title> - <notes>". Strip that prefix so editing
 * does not keep duplicating the title inside the notes.
 */
const extractPlainNotes = (record: any): string => {
  const raw: string = record?.notes || "";
  const title: string = (record?.title || "").trim();
  if (!raw) return "";
  if (title && raw.trim() === title) return "";
  if (title && raw.startsWith(`${title} - `)) return raw.slice(title.length + 3);
  return raw;
};

export const TechnicianLaborForm: React.FC<TechnicianLaborFormProps> = ({
  projectId,
  projectType = "contracting",
  activePhaseId,
  activePhaseName,
  defaultTreasuryId,
  editingRecord,
  onSuccess,
  onCancel,
  onDirtyChange,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(editingRecord?.id);
  const isContracting = projectType === "contracting";

  // Queries
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

  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items-for-labor-link", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select("id, name, phase_id")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isContracting,
  });

  const { data: technicians = [], refetch: refetchTechnicians } = useQuery({
    queryKey: ["technicians-list-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, specialty, phone, daily_rate, meter_rate, piece_rate")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // State
  const [phaseId, setPhaseId] = useState<string>(
    editingRecord?.phase_id || activePhaseId || "none"
  );
  const [projectItemId, setProjectItemId] = useState<string>(
    editingRecord?.project_item_id || "none"
  );
  const [workDescription, setWorkDescription] = useState<string>(
    editingRecord?.title || ""
  );
  const [date, setDate] = useState<string>(
    editingRecord?.date || new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState<string>(extractPlainNotes(editingRecord));
  const [rows, setRows] = useState<LaborRow[]>([
    {
      key: newRowKey(),
      technicianId: editingRecord?.technician_id || "",
      quantity: String(
        editingRecord?.quantity_completed ?? editingRecord?.quantity ?? editingRecord?.items?.[0]?.qty ?? 1
      ),
      rate: String(editingRecord?.rate ?? editingRecord?.items?.[0]?.price ?? ""),
    },
  ]);
  const [quickAddForRow, setQuickAddForRow] = useState<string | null>(null);

  // Immediate payment
  const [payNow, setPayNow] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [treasuryId, setTreasuryId] = useState<string>(defaultTreasuryId || "");

  const workOperation = useOperationKey();

  const effectivePhaseId = activePhaseId || (phaseId && phaseId !== "none" ? phaseId : null);

  const filteredProjectItems = useMemo(() => {
    if (!isContracting) return [];
    if (!effectivePhaseId) return projectItems;
    return projectItems.filter((item: any) => !item.phase_id || item.phase_id === effectivePhaseId);
  }, [projectItems, effectivePhaseId, isContracting]);

  // Drop an item link that no longer belongs to the selected phase
  useEffect(() => {
    if (projectItemId !== "none" && projectItems.length > 0 && !filteredProjectItems.some((i: any) => i.id === projectItemId)) {
      setProjectItemId("none");
    }
  }, [filteredProjectItems, projectItemId, projectItems.length]);

  const rowTotal = (row: LaborRow) => (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
  const grandTotal = useMemo(() => rows.reduce((sum, r) => sum + rowTotal(r), 0), [rows]);
  const isSingleRow = rows.length === 1;
  const numPaidNow = payNow ? (isSingleRow ? parseFloat(paidAmount) || 0 : grandTotal) : 0;

  const updateRow = (key: string, patch: Partial<LaborRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleTechnicianChange = (key: string, technicianId: string) => {
    const tech: any = technicians.find((t: any) => t.id === technicianId);
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const defaultRate = tech ? tech.daily_rate || tech.meter_rate || tech.piece_rate || 0 : 0;
        const keepRate = r.rate && r.rate !== "0";
        return { ...r, technicianId, rate: keepRate ? r.rate : defaultRate > 0 ? String(defaultRate) : r.rate };
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, { key: newRowKey(), technicianId: "", quantity: "1", rate: "" }]);
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  // Track Dirty State
  useEffect(() => {
    const isDirty = Boolean(
      rows.some((r) => r.technicianId || (r.rate && r.rate !== "0")) || workDescription || notes || payNow
    );
    onDirtyChange?.(isDirty);
  }, [rows, workDescription, notes, payNow, onDirtyChange]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workDescription.trim()) {
        throw new Error("يرجى كتابة عنوان / وصف العمل المنفذ (مثل: يوميات عمالة، أعمال حدادة، نظافة موقع...)");
      }
      for (const [idx, row] of rows.entries()) {
        const label = rows.length > 1 ? ` (السطر ${idx + 1})` : "";
        if (!row.technicianId) throw new Error(`يرجى اختيار الفني أو العامل${label}`);
        const q = parseFloat(row.quantity);
        if (isNaN(q) || q <= 0) throw new Error(`يرجى إدخال كمية / عدد أيام صحيح أكبر من الصفر${label}`);
        const r = parseFloat(row.rate);
        if (isNaN(r) || r <= 0) throw new Error(`يرجى إدخال فئة سعر / أجر صحيح أكبر من الصفر${label}`);
      }
      const techIds = rows.map((r) => r.technicianId);
      if (new Set(techIds).size !== techIds.length) {
        throw new Error("تم اختيار نفس الفني أكثر من مرة؛ ادمج السطرين أو اختر فنياً مختلفاً.");
      }

      if (payNow) {
        if (!treasuryId) throw new Error("يرجى اختيار الخزينة التي سيتم الصرف منها.");
        if (numPaidNow <= 0) throw new Error("يرجى إدخال مبلغ سداد صحيح.");
        if (numPaidNow > grandTotal + 0.0001) throw new Error("مبلغ السداد لا يمكن أن يتجاوز إجمالي الاستحقاق.");
        const { data: treasury, error: tErr } = await supabase
          .from("treasuries")
          .select("balance, name")
          .eq("id", treasuryId)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!treasury || Number(treasury.balance || 0) < numPaidNow) {
          throw new Error(
            `رصيد الخزينة غير كافٍ. المطلوب: ${formatCurrencyLYD(numPaidNow)} - المتاح: ${formatCurrencyLYD(Number(treasury?.balance || 0))}`
          );
        }
      }

      const linkedItemId = isContracting && projectItemId !== "none" ? projectItemId : null;
      const savedIds: string[] = [];
      // One stable key for the whole submission so a retry never duplicates rows or payments.
      const baseKey = workOperation.getKey({
        rows: rows.map(({ technicianId, quantity, rate }) => ({ technicianId, quantity, rate })),
        workDescription, date, notes, effectivePhaseId, linkedItemId, payNow, numPaidNow, paymentMethod, treasuryId,
        recordId: editingRecord?.id || null,
      });

      for (const [rowIndex, row] of rows.entries()) {
        const qtyNum = parseFloat(row.quantity);
        const rateNum = parseFloat(row.rate);
        const payload = {
          project_id: projectId,
          phase_id: effectivePhaseId || null,
          // Keep the record as a labor invoice; item linking is applied below on the invoice itself.
          project_item_id: null,
          technician_id: row.technicianId,
          quantity: qtyNum,
          title: workDescription.trim(),
          rate: rateNum,
          earned_amount: qtyNum * rateNum,
          date,
          notes: notes.trim() || null,
        };
        const args = { p_record_id: isEditing ? editingRecord.id : null, p_payload: payload };
        const res: any = await financialRpc("save_technician_work_v2", {
          ...args,
          p_request_key: `${baseKey}-${rowIndex}`,
        });
        const savedId = res?.id || (isEditing ? editingRecord.id : null);
        if (!savedId) throw new Error("تعذر قراءة رقم السجل المحفوظ.");
        savedIds.push(savedId);

        // Link / unlink the labor invoice to a BOQ item
        const { error: linkErr } = await supabase
          .from("purchases")
          .update({ project_item_id: linkedItemId })
          .eq("id", savedId)
          .eq("purchase_type", "labor");
        if (linkErr) throw new Error(`تم حفظ العمل لكن تعذر ربطه بالبند: ${linkErr.message}`);

        // Immediate payment to the technician (recorded against this labor invoice)
        if (payNow) {
          const amount = isSingleRow ? numPaidNow : qtyNum * rateNum;
          if (amount > 0) {
            const { error: payErr } = await supabase.from("purchase_payments").insert({
              purchase_id: savedId,
              amount,
              date,
              payment_method: paymentMethod,
              treasury_id: treasuryId,
              notes: `سداد فوري للفني عند تسجيل العمل: ${workDescription.trim()}`,
              idempotency_key: `${baseKey}-${rowIndex}-pay`,
            } as any);
            const isDuplicate = payErr && (payErr.message?.includes("idempotency") || payErr.message?.includes("duplicate key"));
            if (payErr && !isDuplicate) throw new Error(`تم حفظ العمل لكن تعذر تسجيل السداد: ${payErr.message}`);
          }
        }
      }
      return savedIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ["technician-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all-technicians-rates"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-stats"] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      invalidateProjectFinancialSummary(queryClient, projectId);
      queryClient.invalidateQueries({ queryKey: ["phase-workspace-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });

      const count = ids?.length || 1;
      toast.success(
        payNow
          ? `تم تسجيل عمل ${count > 1 ? `${count} فنيين` : "الفني"} وسداد ${formatCurrencyLYD(numPaidNow)}`
          : `تم تسجيل عمل ${count > 1 ? `${count} فنيين` : "الفني"} وزيادة رصيد حسابه بنجاح`
      );
      workOperation.reset();
      invalidateFinancialQueries(queryClient);
      onSuccess();
    },
    onError: (err: any) => {
      // Rows saved before the failure are idempotent on retry (same request keys).
      toast.error(err.message || "حدث خطأ أثناء حفظ عمل الفني");
    },
  });

  const selectedTechIds = rows.map((r) => r.technicianId).filter(Boolean);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
      className="space-y-5"
      dir="rtl"
    >
      {/* SECTION 1: TECHNICIANS */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            الفنيون / العمال <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickAddForRow(rows[rows.length - 1].key)}
            className="h-7 text-xs gap-1 border-dashed text-primary hover:text-primary hover:bg-primary/5"
          >
            <Plus className="h-3 w-3" />
            فني جديد
          </Button>
        </div>

        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row.key} className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-muted-foreground shrink-0">{idx + 1}.</span>
                <Select
                  value={row.technicianId}
                  onValueChange={(v) => handleTechnicianChange(row.key, v)}
                  disabled={saveMutation.isPending}
                >
                  <SelectTrigger className="text-right flex-1" dir="rtl">
                    <SelectValue placeholder="اختر الفني أو العامل..." />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="max-h-60">
                    {technicians
                      .filter((t: any) => t.id === row.technicianId || !selectedTechIds.includes(t.id))
                      .map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span className="font-semibold">{t.name}</span>
                            {t.specialty && <span className="text-xs text-muted-foreground">({t.specialty})</span>}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => removeRow(row.key)}
                    title="حذف السطر"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">الكمية / الأيام</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                    className="text-right h-9"
                    disabled={saveMutation.isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">الأجر / الفئة (د.ل)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={row.rate}
                    onChange={(e) => updateRow(row.key, { rate: e.target.value })}
                    placeholder="0.00"
                    className="text-right h-9 font-semibold"
                    disabled={saveMutation.isPending}
                  />
                </div>
                <div className="text-left pb-2">
                  <span className="text-[11px] text-muted-foreground block">الاستحقاق</span>
                  <span className="text-sm font-bold text-primary">{formatCurrencyLYD(rowTotal(row))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={saveMutation.isPending}
            className="w-full h-8 text-xs gap-1 border-dashed"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة فني آخر لنفس العمل
          </Button>
        )}
        {rows.length > 1 && (
          <p className="text-[11px] text-muted-foreground">
            سيتم إنشاء فاتورة عمالة مستقلة لكل فني بنفس العنوان والتاريخ والملاحظات.
          </p>
        )}
      </div>

      {/* SECTION 2: WORK CONTEXT */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" />
          سياق وتفاصيل العمل
        </Label>

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
                <SelectValue placeholder="اختر مرحلة المشروع..." />
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

        {isContracting && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              بند المشروع المرتبط (اختياري)
            </Label>
            <Select value={projectItemId} onValueChange={setProjectItemId} disabled={saveMutation.isPending}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="بدون ربط ببند" />
              </SelectTrigger>
              <SelectContent dir="rtl" className="max-h-60">
                <SelectItem value="none">بدون ربط ببند</SelectItem>
                {filteredProjectItems.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-primary" />
            عنوان الفاتورة / وصف العمل <span className="text-destructive">*</span>
          </Label>
          <Input
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            placeholder="مثال: يوميات عمالة، أعمال حدادة، مصنعية تركيب، نظافة وتشوين موقع..."
            className="text-right"
            disabled={saveMutation.isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            تاريخ الإنجاز / العمل <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-right"
            disabled={saveMutation.isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ملاحظات (تظهر في الفاتورة المطبوعة)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي تفاصيل أو ملاحظات إضافية..."
            className="text-right"
            disabled={saveMutation.isPending}
          />
        </div>
      </div>

      {/* SECTION 3: TOTAL + PAYMENT */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-bold flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary" />
            الاستحقاق وطريقة السداد
          </Label>
          {!isEditing && (
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => {
                  setPayNow(false);
                  setPaidAmount("");
                }}
                className={cn(
                  "px-3 py-1 rounded-md transition-colors",
                  !payNow ? "bg-background text-foreground font-bold shadow-sm" : "text-muted-foreground"
                )}
              >
                آجل (على حساب الفني)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayNow(true);
                  if (!paidAmount && grandTotal > 0) setPaidAmount(String(grandTotal));
                }}
                className={cn(
                  "px-3 py-1 rounded-md transition-colors",
                  payNow ? "bg-primary text-primary-foreground font-bold shadow-sm" : "text-muted-foreground"
                )}
              >
                سداد الآن
              </button>
            </div>
          )}
        </div>

        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-muted-foreground">إجمالي الاستحقاق{rows.length > 1 ? ` (${rows.length} فنيين)` : ""}:</span>
            <div className="text-base font-bold text-primary">{formatCurrencyLYD(grandTotal)}</div>
          </div>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            تكلفة مباشرة على المشروع
          </Badge>
        </div>

        {isEditing && (
          <p className="text-[11px] text-muted-foreground">
            لتسجيل دفعة على هذه الفاتورة استخدم زر السداد (أيقونة العملات) في قائمة الفواتير.
          </p>
        )}

        {payNow && !isEditing && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  المبلغ المسدد الآن (د.ل)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={isSingleRow ? paidAmount : String(grandTotal)}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  disabled={!isSingleRow || saveMutation.isPending}
                  className="text-left font-bold text-primary"
                  dir="ltr"
                />
                {!isSingleRow && (
                  <p className="text-[10px] text-muted-foreground">مع أكثر من فني يُسدَّد كامل استحقاق كل فني.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={saveMutation.isPending}>
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل مصرفي</SelectItem>
                    <SelectItem value="check">صك مصرفي</SelectItem>
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
            <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/40 rounded-lg border border-border/60 text-center text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">المسدد الآن</span>
                <span className="font-bold text-emerald-600 text-sm">{formatCurrencyLYD(numPaidNow)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">المتبقي على حساب الفني</span>
                <span className="font-bold text-amber-600 text-sm">{formatCurrencyLYD(Math.max(0, grandTotal - numPaidNow))}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saveMutation.isPending}>
          إلغاء
        </Button>
        <Button
          type="submit"
          className="min-w-[140px] gap-2"
          disabled={saveMutation.isPending || grandTotal <= 0}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {isEditing ? "حفظ التعديلات" : payNow ? "تسجيل العمل والسداد" : "تسجيل استحقاق العمل"}
            </>
          )}
        </Button>
      </div>

      <QuickAddTechnicianDialog
        open={quickAddForRow !== null}
        onOpenChange={(open) => !open && setQuickAddForRow(null)}
        onTechnicianAdded={(newId) => {
          refetchTechnicians();
          if (quickAddForRow) updateRow(quickAddForRow, { technicianId: newId });
          setQuickAddForRow(null);
        }}
      />
    </form>
  );
};
