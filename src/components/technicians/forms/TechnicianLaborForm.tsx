import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Package,
  DollarSign,
  FileText,
  Lock,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrencyLYD } from "@/lib/currency";
import { QuickAddTechnicianDialog } from "@/components/technicians/QuickAddTechnicianDialog";
import { generateIdempotencyKey } from "@/lib/uuid";

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

export const TechnicianLaborForm: React.FC<TechnicianLaborFormProps> = ({
  projectId,
  projectType = "contracting",
  activePhaseId,
  activePhaseName,
  editingRecord,
  onSuccess,
  onCancel,
  onDirtyChange,
}) => {
  const queryClient = useQueryClient();

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
    queryKey: ["project-items", projectId],
    queryFn: async () => {
      if (projectType === "finishing") return [];
      const { data, error } = await supabase
        .from("project_items")
        .select("id, name, phase_id, quantity, unit_price")
        .eq("project_id", projectId);
      if (error) throw error;
      return data || [];
    },
    enabled: projectType === "contracting",
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
    editingRecord?.project_item_id || ""
  );
  const [technicianId, setTechnicianId] = useState<string>(
    editingRecord?.technician_id || ""
  );
  const [workDescription, setWorkDescription] = useState<string>(
    editingRecord?.notes || ""
  );
  const [date, setDate] = useState<string>(
    editingRecord?.date || new Date().toISOString().split("T")[0]
  );
  const [quantity, setQuantity] = useState<string>(
    editingRecord?.quantity_completed ? String(editingRecord.quantity_completed) : "1"
  );
  const [rate, setRate] = useState<string>(
    editingRecord?.rate ? String(editingRecord.rate) : ""
  );
  const [notes, setNotes] = useState<string>("");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey("tpr"));

  // Effective Phase ID
  const effectivePhaseId = activePhaseId || (phaseId && phaseId !== "none" ? phaseId : null);

  // Filtered Project Items (Contracting)
  const filteredProjectItems = useMemo(() => {
    if (projectType === "finishing") return [];
    if (!effectivePhaseId) return projectItems;
    return projectItems.filter((item) => item.phase_id === effectivePhaseId);
  }, [projectItems, effectivePhaseId, projectType]);

  // Selected technician object
  const selectedTechnician = useMemo(() => {
    return technicians.find((t) => t.id === technicianId);
  }, [technicians, technicianId]);

  // Auto-fill rate from technician rates or project item
  useEffect(() => {
    if (!rate || rate === "0") {
      if (selectedTechnician) {
        const defaultRate =
          selectedTechnician.daily_rate ||
          selectedTechnician.meter_rate ||
          selectedTechnician.piece_rate ||
          0;
        if (defaultRate > 0) {
          setRate(String(defaultRate));
        }
      }
    }
  }, [selectedTechnician]);

  // Auto-fill rate from project item if contracting and still empty
  useEffect(() => {
    if (projectType === "contracting" && projectItemId && (!rate || rate === "0")) {
      const item = projectItems.find((i) => i.id === projectItemId);
      if (item && item.unit_price) {
        setRate(String(item.unit_price));
      }
    }
  }, [projectItemId, projectItems, projectType]);

  // Track Dirty State
  useEffect(() => {
    const isDirty = Boolean(
      technicianId ||
      workDescription ||
      (rate && rate !== "0") ||
      (projectType === "contracting" && projectItemId)
    );
    onDirtyChange?.(isDirty);
  }, [technicianId, workDescription, rate, projectItemId, onDirtyChange, projectType]);

  // Calculate Earned Total
  const calculatedEarnedAmount = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return q * r;
  }, [quantity, rate]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!technicianId) {
        throw new Error("يرجى اختيار الفني أو العامل");
      }
      if (projectType === "contracting" && !projectItemId) {
        throw new Error("يرجى اختيار بند المقايسة المرتبط في مشاريع المقاولات");
      }
      if (projectType === "finishing" && !workDescription.trim()) {
        throw new Error("يرجى كتابة بيان / وصف العمل المنفذ لمشروع التشطيبات");
      }
      const qtyNum = parseFloat(quantity);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        throw new Error("يرجى إدخال كمية / عدد أيام صحيح أكبر من الصفر");
      }
      const rateNum = parseFloat(rate);
      if (isNaN(rateNum) || rateNum <= 0) {
        throw new Error("يرجى إدخال فئة سعر / أجر صحيح أكبر من الصفر");
      }

      const fullNotes = workDescription.trim()
        ? notes.trim()
          ? `${workDescription.trim()} - ${notes.trim()}`
          : workDescription.trim()
        : notes.trim() || null;

      const payload = {
        project_id: projectId,
        phase_id: effectivePhaseId || null,
        project_item_id: projectType === "contracting" ? projectItemId : null,
        technician_id: technicianId,
        quantity_completed: qtyNum,
        rate: rateNum,
        earned_amount: calculatedEarnedAmount,
        date: date,
        notes: fullNotes,
        idempotency_key: idempotencyKey,
      };

      if (editingRecord?.id) {
        const { error } = await supabase
          .from("technician_progress_records")
          .update({
            project_id: payload.project_id,
            phase_id: payload.phase_id,
            project_item_id: payload.project_item_id,
            technician_id: payload.technician_id,
            quantity_completed: payload.quantity_completed,
            rate: payload.rate,
            earned_amount: payload.earned_amount,
            date: payload.date,
            notes: payload.notes,
          })
          .eq("id", editingRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("technician_progress_records")
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all relevant React Query keys
      queryClient.invalidateQueries({ queryKey: ["technician-progress-records"] });
      queryClient.invalidateQueries({ queryKey: ["all-technicians-progress"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-stats"] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["project-financial-summary", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-workspace-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["technician-rates"] });

      toast.success(
        editingRecord?.id
          ? "تم تحديث استحقاق العمل الفني بنجاح"
          : "تم تسجيل استحقاق العمل الفني وزيادة رصيد الفني فوراً"
      );
      setIdempotencyKey(generateIdempotencyKey("tpr"));
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ استحقاق العمل الفني");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
      className="space-y-5"
      dir="rtl"
    >
      {/* SECTION 1: TECHNICIAN SELECTION */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" />
            بيانات الفني / العامل <span className="text-destructive">*</span>
          </Label>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsQuickAddOpen(true)}
            className="h-7 text-xs gap-1 border-dashed text-primary hover:text-primary hover:bg-primary/5"
          >
            <Plus className="h-3 w-3" />
            إضافة فني / عامل جديد
          </Button>
        </div>

        <div className="space-y-1.5">
          <Select
            value={technicianId}
            onValueChange={setTechnicianId}
            disabled={saveMutation.isPending}
          >
            <SelectTrigger className="text-right" dir="rtl">
              <SelectValue placeholder="اختر الفني أو العامل المسند إليه العمل..." />
            </SelectTrigger>
            <SelectContent dir="rtl" className="max-h-60">
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="font-semibold">{t.name}</span>
                    {t.specialty && (
                      <span className="text-xs text-muted-foreground">({t.specialty})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SECTION 2: WORK CONTEXT & ATTRIBUTION */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" />
          سياق وتفاصيل العمل
        </Label>

        {/* Phase Context (Locked vs Optional) */}
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

        {/* Contracting: Mandatory BOQ Item */}
        {projectType === "contracting" && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              بند المقايسة المرتبط <span className="text-destructive">*</span>
            </Label>
            {filteredProjectItems.length > 0 ? (
              <Select
                value={projectItemId}
                onValueChange={setProjectItemId}
                disabled={saveMutation.isPending}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="اختر بند المقايسة التابع للمرحلة..." />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {filteredProjectItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-600 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>لا توجد بنود مقايسة متاحة في هذه المرحلة. يرجى إضافة بنود مقايسة أولاً.</span>
              </div>
            )}
          </div>
        )}

        {/* Finishing: Work Description */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {projectType === "finishing" ? (
              <>
                وصف / بيان العمل المنفذ <span className="text-destructive">*</span>
              </>
            ) : (
              "تفاصيل / ملاحظات إضافية على الإنجاز (اختياري)"
            )}
          </Label>
          <Input
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            placeholder={
              projectType === "finishing"
                ? "مثال: دهان صالون الاستقبال، تركيب جبس الأسقف، تمديد كابلات الإضاءة..."
                : "مثال: صب الأعمدة، تسليح السقف..."
            }
            className="text-right"
            disabled={saveMutation.isPending}
          />
        </div>

        {/* Work Date */}
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
      </div>

      {/* SECTION 3: FINANCIAL VALUES & EARNED CALCULATION */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-primary" />
          الكمية والقيمة المستحقة (تضاف لحساب الفني فوراً)
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              الكمية / عدد الأيام أو الوحدات <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="text-right"
              disabled={saveMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              فئة السعر / اليومية (د.ل) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              className="text-right font-semibold"
              disabled={saveMutation.isPending}
            />
          </div>
        </div>

        {/* Calculated Summary Badge */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-muted-foreground">إجمالي الاستحقاق المستحق للفني:</span>
            <div className="text-base font-bold text-primary">
              {formatCurrencyLYD(calculatedEarnedAmount)}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            استحقاق فعلي (تكلفة مباشرة)
          </Badge>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saveMutation.isPending}
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          className="min-w-[140px] gap-2"
          disabled={saveMutation.isPending || calculatedEarnedAmount <= 0}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {editingRecord?.id ? "حفظ التعديلات" : "تسجيل استحقاق العمل"}
            </>
          )}
        </Button>
      </div>

      {/* Quick Add Technician Modal */}
      <QuickAddTechnicianDialog
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        onTechnicianAdded={(newId) => {
          refetchTechnicians();
          setTechnicianId(newId);
          setIsQuickAddOpen(false);
        }}
      />
    </form>
  );
};
