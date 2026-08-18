import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TreasurySelector } from "@/components/treasury/TreasurySelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  FileText,
  Receipt,
  Layers,
  Lock,
  Loader2,
  Tag,
} from "lucide-react";

interface DirectProjectExpenseFormProps {
  projectId: string;
  projectType?: "contracting" | "finishing" | string;
  activePhaseId?: string | null;
  activePhaseName?: string | null;
  defaultTreasuryId?: string | null;
  editingExpense?: any | null;
  onSuccess: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const EXPENSE_CATEGORIES = [
  "نثريات موقعية",
  "ضيافة واستقبال",
  "وقود ونقليات",
  "رسوم بلدية وتراخيص",
  "صيانة أدوات ومعدات",
  "استشارات هندسية وفنية",
  "مستلزمات مكتبية وسلامة",
  "مصاريف أخرى",
];

export const DirectProjectExpenseForm: React.FC<DirectProjectExpenseFormProps> = ({
  projectId,
  projectType,
  activePhaseId,
  activePhaseName,
  defaultTreasuryId,
  editingExpense,
  onSuccess,
  onCancel,
  onDirtyChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    queryKey: ["project-items-for-expense-form", projectId],
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
  const [description, setDescription] = useState<string>(editingExpense?.description || "");
  const [category, setCategory] = useState<string>(
    editingExpense?.subtype || EXPENSE_CATEGORIES[0]
  );
  const [amount, setAmount] = useState<string>(
    editingExpense ? String(editingExpense.amount || "") : ""
  );
  const [date, setDate] = useState<string>(
    editingExpense?.date || new Date().toISOString().split("T")[0]
  );
  const [phaseId, setPhaseId] = useState<string>(
    editingExpense?.phase_id || activePhaseId || ""
  );
  const [projectItemId, setProjectItemId] = useState<string>(editingExpense?.project_item_id || "");

  const effectivePhaseId = activePhaseId || (phaseId && phaseId !== "none" ? phaseId : null);

  // Filtered Project Items based on effective phase
  const filteredProjectItems = useMemo(() => {
    if (projectType === "finishing") return [];
    if (!effectivePhaseId) return projectItems;
    return projectItems.filter((item) => item.phase_id === effectivePhaseId);
  }, [projectItems, effectivePhaseId, projectType]);
  const [treasuryId, setTreasuryId] = useState<string>(
    editingExpense?.treasury_id || defaultTreasuryId || ""
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    editingExpense?.payment_method || "cash"
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>(editingExpense?.invoice_number || "");
  const [notes, setNotes] = useState<string>(editingExpense?.notes || "");

  const numAmount = Number(amount) || 0;

  // Dirty State
  const isDirty = useMemo(() => {
    return Boolean(
      description.trim() ||
      amount ||
      notes ||
      invoiceNumber
    );
  }, [description, amount, notes, invoiceNumber]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) {
        throw new Error("يرجى إدخال وصف المصروف.");
      }
      if (numAmount <= 0) {
        throw new Error("يرجى إدخال مبلغ صحيح للمصروف.");
      }
      if (!treasuryId) {
        throw new Error("يرجى اختيار الخزينة المخصوم منها (المصروف المباشر نقدي حتماً).");
      }

      const payload: any = {
        project_id: projectId, // Strictly scoped to current project
        phase_id: effectivePhaseId || null,
        project_item_id: projectType === "contracting" ? (projectItemId === "__none__" || !projectItemId ? null : projectItemId) : null,
        type: "project",
        subtype: category,
        description: description.trim(),
        amount: numAmount,
        date,
        treasury_id: treasuryId,
        payment_method: paymentMethod,
        invoice_number: invoiceNumber.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["project-financial-summary", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["project-financial-summary-authoritative-v4", projectId],
      });

      toast({
        title: editingExpense ? "تم تحديث المصروف بنجاح" : "تم حفظ المصروف بنجاح",
        description: `تم قيد المصروف وخصم مبلغ ${formatCurrencyLYD(numAmount)} من الخزينة.`,
      });

      onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: "خطأ أثناء حفظ المصروف",
        description: err.message || "تعذر حفظ المصروف، يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-5 text-right" dir="rtl">
      {/* SECTION 1: DESCRIPTION & CATEGORY */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-primary" />
          بيانات المصروف المباشر
        </Label>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            بيان / وصف المصروف <span className="text-destructive">*</span>
          </Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: وقود للمولدات، ضيافة مهندسي الموقع، رسوم ترخيص..."
            className="text-right"
            disabled={saveMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              تصنيف المصروف
            </Label>
            <Select value={category} onValueChange={setCategory} disabled={saveMutation.isPending}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              تاريخ الصرف <span className="text-destructive">*</span>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">رقم الإيصال / الفاتورة (اختياري)</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="مثال: REC-009"
              className="text-right"
              disabled={saveMutation.isPending}
            />
          </div>

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

          {projectType === "contracting" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                بند المقايسة المرتبط (اختياري)
              </Label>
              <Select value={projectItemId} onValueChange={setProjectItemId} disabled={saveMutation.isPending}>
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="اختر بند المقايسة المرتبط..." />
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
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: AMOUNT & TREASURY (MANDATORY CASH PAYMENT) */}
      <div className="space-y-3 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-sm font-bold flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" />
          المبلغ وطريقة الصرف
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              قيمة المصروف (د.ل) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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

        {/* Mandatory Treasury Selector */}
        <TreasurySelector
          value={treasuryId}
          onValueChange={setTreasuryId}
          projectType={projectType}
          projectDefaultTreasuryId={defaultTreasuryId}
          requiredAmount={numAmount}
          label="الخزينة المخصوم منها المصروف"
          disabled={saveMutation.isPending}
        />
      </div>

      {/* SECTION 3: NOTES */}
      <div className="space-y-1.5 p-3.5 rounded-xl border border-border/80 bg-card">
        <Label className="text-xs text-muted-foreground">ملاحظات إضافية</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أي تفاصيل أو ملاحظات حول هذا المصروف..."
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
          disabled={saveMutation.isPending || numAmount <= 0 || !description.trim() || !treasuryId}
          className="gap-2 font-bold px-6"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {editingExpense ? "تحديث المصروف" : "حفظ وخصم المصروف"}
        </Button>
      </div>
    </div>
  );
};
