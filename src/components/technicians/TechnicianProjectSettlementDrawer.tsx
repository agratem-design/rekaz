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
  AlertCircle, ArrowRight, Loader2, Sparkles, Wrench, Layers
} from "lucide-react";

interface TechnicianProjectSettlementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  technicianId: string;
  technicianName: string;
  technicianSpecialty?: string;
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientName: string;
  totalEarned: number;
  totalPaid: number;
  totalDue: number;
  onSuccess?: () => void;
}

export const TechnicianProjectSettlementDrawer: React.FC<TechnicianProjectSettlementDrawerProps> = ({
  isOpen,
  onClose,
  technicianId,
  technicianName,
  technicianSpecialty,
  projectId,
  projectName,
  projectType,
  clientName,
  totalEarned,
  totalPaid,
  totalDue,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Form states
  const [treasuryId, setTreasuryId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setTreasuryId("");
      setPaymentMethod("cash");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setPayAmount(totalDue > 0 ? totalDue.toString() : "");
    }
  }, [isOpen, technicianId, projectId]);

  const numPayAmount = parseFloat(payAmount) || 0;
  const remainingAfterPayment = Math.max(0, totalDue - numPayAmount);

  // Shortcut to pay full due
  const handleFullDueShortcut = () => {
    setPayAmount(totalDue.toString());
  };

  // Settlement mutation
  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!treasuryId) {
        throw new Error("يرجى تحديد الخزينة أو الحساب المصرفي المخصوم منه");
      }
      if (numPayAmount <= 0) {
        throw new Error("يرجى إدخال مبلغ صحيح للصرف");
      }
      if (numPayAmount > totalDue + 0.001) {
        throw new Error("المبلغ المراد صرفه يتجاوز إجمالي المستحق للفني على هذا المشروع");
      }

      const { error } = await supabase.from("expenses").insert({
        technician_id: technicianId,
        project_id: projectId,
        treasury_id: treasuryId,
        type: "labor",
        amount: numPayAmount,
        date: paymentDate,
        description: `صرف مستحقات فني - ${technicianName} عن مشروع ${projectName}`,
        notes: notes || null,
        payment_method: paymentMethod,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-expenses", technicianId] });
      queryClient.invalidateQueries({ queryKey: ["technician-progress-records", technicianId] });
      queryClient.invalidateQueries({ queryKey: ["all-technicians-progress"] });
      queryClient.invalidateQueries({ queryKey: ["all-technicians-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-stats"] });
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["project-financial-summary"] });

      toast.success(`تم صرف ${formatCurrencyLYD(numPayAmount)} بنجاح وحفظ سند الصرف.`);
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء معالجة الصرف");
    },
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background" dir="rtl">
        <SheetHeader className="p-5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <span>صرف مستحقات الفني بالمشروع</span>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  تسوية استحقاقات إنجاز الفني للمشروع المختار
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
              <span className="text-muted-foreground">الفني:</span>
              <span className="font-semibold text-foreground truncate">{technicianName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">الزبون:</span>
              <span className="font-semibold text-foreground truncate">{clientName || "—"}</span>
            </div>
            {technicianSpecialty && (
              <div className="col-span-2 text-muted-foreground flex items-center gap-1 text-[11px]">
                <span>التخصص:</span>
                <span className="text-foreground font-medium">{technicianSpecialty}</span>
              </div>
            )}
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
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
            <div>
              <span className="text-[10px] text-muted-foreground block">إجمالي المنجز (الأجر)</span>
              <span className="text-xs font-bold text-foreground" dir="ltr">
                {formatCurrencyLYD(totalEarned)}
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
              <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400" dir="ltr">
                {formatCurrencyLYD(totalDue)}
              </span>
            </div>
          </div>

          {/* Amount to Pay & Shortcut */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">المبلغ المراد صرفه (د.ل) *</Label>
              {totalDue > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 px-2 font-medium"
                  onClick={handleFullDueShortcut}
                >
                  <Sparkles className="h-3 w-3 ml-1" />
                  صرف كامل المستحق ({formatCurrencyLYD(totalDue)})
                </Button>
              )}
            </div>
            <Input
              type="number"
              min="0"
              max={totalDue}
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="أدخل المبلغ..."
              className="text-base font-bold text-blue-700 dark:text-blue-400 h-10"
              dir="ltr"
            />
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
              <Label className="text-xs font-bold">تاريخ الصرف</Label>
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
              placeholder="أي ملاحظات إضافية على عملية الصرف..."
              rows={2}
              className="text-xs"
            />
          </div>

          {/* Impact Preview */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>المستحق قبل الصرف:</span>
              <span className="font-semibold text-foreground" dir="ltr">{formatCurrencyLYD(totalDue)}</span>
            </div>
            <div className="flex justify-between items-center text-blue-700 dark:text-blue-400 font-bold">
              <span>المبلغ المراد صرفه الآن:</span>
              <span dir="ltr">{formatCurrencyLYD(numPayAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground pt-1 border-t border-border/40">
              <span>المتبقي بعد الصرف:</span>
              <span className="font-bold text-foreground" dir="ltr">{formatCurrencyLYD(remainingAfterPayment)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/30">
              * ملاحظة محاسبية: السداد يخفض رصيد الفني المستحق ولا يغيّر تكلفة العمل المعتمدة المسجلة مسبقاً.
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            onClick={() => settleMutation.mutate()}
            disabled={settleMutation.isPending || numPayAmount <= 0}
          >
            {settleMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            تأكيد صرف ({formatCurrencyLYD(numPayAmount)})
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
