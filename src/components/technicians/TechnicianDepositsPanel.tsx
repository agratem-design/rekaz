import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { financialRpc, invalidateFinancialQueries } from "@/lib/financialMutations";
import { useOperationKey } from "@/hooks/useOperationKey";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyLYD } from "@/lib/currency";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Deposit = { id: string; entry_type: "receipt" | "refund"; amount: number; date: string; notes: string | null };
export function TechnicianDepositsPanel({ technicianId }: { technicianId: string }) {
  const { role } = useAuth();
  const allowed = role === "admin" || role === "accountant";
  const queryClient = useQueryClient();
  const operation = useOperationKey();
  const [mode, setMode] = useState<"receipt" | "refund" | null>(null);
  const [amount, setAmount] = useState("");
  const [treasury, setTreasury] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const entries = useQuery({ queryKey: ["technician-deposits", technicianId], enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("technician_deposits" as any).select("id, entry_type, amount, date, notes")
        .eq("technician_id", technicianId).order("date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Deposit[];
    } });
  const treasuries = useQuery({ queryKey: ["treasuries-active"], enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("treasuries").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    } });
  const available = (entries.data || []).reduce((sum, e) => sum + (e.entry_type === "receipt" ? 1 : -1) * Number(e.amount), 0);
  const clear = () => { setMode(null); setAmount(""); setNotes(""); setTreasury(""); };
  const save = useMutation({ mutationFn: async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !treasury || !mode) throw new Error("أدخل مبلغاً موجباً واختر الخزينة.");
    if (mode === "refund" && value > available) throw new Error("المبلغ يتجاوز رصيد الوديعة المتاح.");
    const payload = { technician_id: technicianId, treasury_id: treasury, entry_type: mode, amount: value, date, payment_method: method, notes: notes || null };
    return financialRpc("record_technician_deposit_v2", { p_payload: payload, p_request_key: operation.getKey(payload) });
  }, onSuccess: () => { operation.reset(); clear(); invalidateFinancialQueries(queryClient); toast.success("تم تسجيل حركة الوديعة والخزينة معاً."); },
    onError: (error: Error) => toast.error(error.message) });
  const guard = useUnsavedChangesGuard({ isDirty: !!mode && !!(amount || notes || treasury), isSubmitting: save.isPending, onDiscard: clear });
  if (!allowed) return null;
  return <Card className="space-y-4 p-4 sm:p-5" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-bold">وديعة الفني المحفوظة لدى الشركة</h2>
        <p className="mt-1 text-sm text-muted-foreground">أموال استلمناها من الفني ونلتزم بردها؛ مستقلة عن أجره والدفعات المصروفة له.</p>
        <p className="mt-2 text-lg font-bold">{entries.isPending ? "جاري التحميل..." : entries.error ? "الرصيد غير متاح" : formatCurrencyLYD(available)}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMode("receipt")} disabled={entries.isPending || !!entries.error}>استلام وديعة</Button>
        <Button variant="outline" onClick={() => setMode("refund")} disabled={available <= 0 || !!entries.error}>رد وديعة</Button>
      </div>
    </div>
    {entries.error && <div role="alert" className="text-sm text-destructive">تعذر تحميل الودائع. تحقق من الاتصال وتطبيق تحديث قاعدة البيانات.
      <Button variant="link" onClick={() => entries.refetch()}>إعادة المحاولة</Button></div>}
    {!!entries.data?.length && <details><summary className="cursor-pointer py-2 text-sm text-primary">سجل حركات الوديعة ({entries.data.length})</summary>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{entries.data.map(e => <div key={e.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm">
        <span>{e.date} · {e.entry_type === "receipt" ? "استلام وديعة" : "رد وديعة"}{e.notes && ` · ${e.notes}`}</span><strong>{formatCurrencyLYD(e.amount)}</strong>
      </div>)}</div></details>}
    <Dialog open={!!mode} onOpenChange={open => { if (!open) guard.requestAction(clear); }}>
      <DialogContent dir="rtl"><DialogHeader><DialogTitle>{mode === "receipt" ? "استلام وديعة من الفني" : "رد وديعة للفني"}</DialogTitle>
        <DialogDescription>{mode === "receipt" ? "تزيد الخزينة والوديعة المستحقة للفني، ولا تسجل إيراداً." : "تنقص الخزينة والوديعة المستحقة للفني، ولا تسجل مصروف عمل."}</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
          <fieldset disabled={save.isPending} className="space-y-4">
            <div><Label htmlFor="deposit-amount">المبلغ (د.ل)</Label><Input id="deposit-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><Label>الخزينة</Label><Select value={treasury} onValueChange={setTreasury} disabled={save.isPending}><SelectTrigger aria-label="خزينة الوديعة"><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
              <SelectContent>{(treasuries.data || []).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            {treasuries.error && <p role="alert" className="text-sm text-destructive">تعذر تحميل الخزائن.</p>}
            <div><Label htmlFor="deposit-date">التاريخ</Label><Input id="deposit-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
            <Select value={method} onValueChange={setMethod} disabled={save.isPending}><SelectTrigger aria-label="طريقة دفع الوديعة"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="cash">نقداً</SelectItem><SelectItem value="transfer">تحويل مصرفي</SelectItem><SelectItem value="check">صك</SelectItem>
            </SelectContent></Select>
            <div><Label htmlFor="deposit-notes">ملاحظات</Label><Input id="deposit-notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div className="flex gap-2"><Button type="submit" disabled={save.isPending || !!treasuries.error}>{save.isPending ? "جاري الحفظ..." : "حفظ الحركة"}</Button>
              <Button type="button" variant="outline" onClick={() => guard.requestAction(clear)}>إلغاء</Button></div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog open={guard.showConfirmDialog} onOpenChange={guard.setShowConfirmDialog} onStay={guard.cancelDiscard} onConfirmDiscard={guard.confirmDiscard} />
  </Card>;
}
