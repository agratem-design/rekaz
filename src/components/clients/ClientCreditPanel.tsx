import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { availableClientCredit } from "@/lib/financialCore";
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

export function ClientCreditPanel({ clientId, projects }: { clientId: string; projects: { id: string; name: string; remaining: number }[] }) {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const operation = useOperationKey();
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(""), [projectId, setProjectId] = useState("");
  const [reverseId, setReverseId] = useState<string | null>(null);
  const entries = useQuery({ queryKey: ["client-credit-panel", clientId], queryFn: async () => {
    const { data, error } = await supabase.from("client_credit_ledger").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } });
  const available = availableClientCredit(entries.data || []);
  const applications = (entries.data || []).filter(e => e.entry_type === "CREDIT_APPLIED" && !entries.data?.some(r => r.entry_type === "CREDIT_APPLICATION_REVERSED" && r.reference_entry_id === e.id));
  const remaining = projects.find(p => p.id === projectId)?.remaining || 0;
  const clear = () => { setOpen(false); setAmount(""); setProjectId(""); };
  const save = useMutation({ mutationFn: async () => {
    const value = Number(amount);
    if (!projectId || !Number.isFinite(value) || value <= 0 || value > available || value > remaining) throw new Error("اختر مشروعاً ومبلغاً لا يتجاوز رصيد الزبون والمتبقي على المشروع.");
    const payload = { client_id: clientId, project_id: projectId, amount: value };
    return financialRpc("apply_client_credit_v2", { p_payload: payload, p_request_key: operation.getKey(payload) });
  }, onSuccess: () => { operation.reset(); clear(); invalidateFinancialQueries(queryClient); toast.success("تم استخدام الرصيد في المشروع دون حركة نقدية جديدة."); },
    onError: (error: Error) => toast.error(error.message) });
  const reverse = useMutation({ mutationFn: () => financialRpc("reverse_client_credit_application", { p_entry_id: reverseId, p_notes: "إلغاء تطبيق الرصيد من حساب الزبون" }),
    onSuccess: () => { setReverseId(null); invalidateFinancialQueries(queryClient); toast.success("أُعيد المبلغ إلى رصيد الزبون المتاح."); }, onError: (error: Error) => toast.error(error.message) });
  const guard = useUnsavedChangesGuard({ isDirty: open && !!(amount || projectId), isSubmitting: save.isPending, onDiscard: clear });
  const allowed = role === "admin" || role === "accountant";
  return <Card className="space-y-3 p-4 sm:p-5" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold">رصيد الزبون المتاح على الحساب</h2>
      <p className="mt-1 text-sm text-muted-foreground">الدفعات العامة والفائض لا تسدد مشروعاً آخر تلقائياً. اختر المشروع عند استخدام الرصيد.</p>
      <p className="mt-2 text-lg font-bold">{entries.isPending ? "جاري التحميل..." : entries.error ? "الرصيد غير متاح" : formatCurrencyLYD(available)}</p></div>
      {allowed && <Button onClick={() => setOpen(true)} disabled={entries.isPending || !!entries.error || available <= 0}>استخدام الرصيد لمشروع</Button>}</div>
    {entries.error && <div role="alert" className="text-sm text-destructive">تعذر تحميل الرصيد.<Button variant="link" onClick={() => entries.refetch()}>إعادة المحاولة</Button></div>}
    {applications.length > 0 && <details><summary className="cursor-pointer py-2 text-sm text-primary">الرصيد المستخدم في المشاريع ({applications.length})</summary>
      {applications.map(e => <div key={e.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span>{projects.find(p => p.id === e.target_project_id)?.name || "المشروع"} · {formatCurrencyLYD(e.amount)}</span>
        {allowed && <Button variant="outline" size="sm" onClick={() => setReverseId(e.id)}>إلغاء التطبيق</Button>}
      </div>)}</details>}
    <Dialog open={open} onOpenChange={value => { if (!value) guard.requestAction(clear); }}><DialogContent dir="rtl">
      <DialogHeader><DialogTitle>استخدام رصيد الزبون</DialogTitle><DialogDescription>تسوية مستحق مشروع من رصيد موجود؛ لا يدخل مبلغ جديد للخزينة.</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); if (!save.isPending) save.mutate(); }} className="space-y-4">
        <Select value={projectId} onValueChange={setProjectId} disabled={save.isPending}><SelectTrigger aria-label="المشروع المستفيد من الرصيد"><SelectValue placeholder="اختر المشروع" /></SelectTrigger><SelectContent>
          {projects.filter(p => p.remaining > 0).map(p => <SelectItem key={p.id} value={p.id}>{p.name} · متبقي {formatCurrencyLYD(p.remaining)}</SelectItem>)}
        </SelectContent></Select>
        {projects.every(p => p.remaining <= 0) && <p className="text-sm text-muted-foreground">لا توجد مستحقات حالية على مشاريع هذا الزبون. يبقى الرصيد محفوظاً لحين وجود مستحقات.</p>}
        <div><Label htmlFor="credit-amount">المبلغ (د.ل)</Label><Input id="credit-amount" type="number" min="0.01" max={Math.min(available, remaining)} step="0.01" required value={amount} disabled={save.isPending} onChange={e => setAmount(e.target.value)} /></div>
        <div className="flex gap-2"><Button type="submit" disabled={save.isPending || !projectId}>{save.isPending ? "جاري الحفظ..." : "تطبيق الرصيد"}</Button>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => guard.requestAction(clear)}>إلغاء</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!reverseId} onOpenChange={value => { if (!value && !reverse.isPending) setReverseId(null); }}><DialogContent dir="rtl">
      <DialogHeader><DialogTitle>إلغاء استخدام الرصيد؟</DialogTitle><DialogDescription>سيعود المبلغ إلى الرصيد المتاح، وتعود قيمته إلى المتبقي على المشروع. لا تتغير الخزينة.</DialogDescription></DialogHeader>
      <div className="flex gap-2"><Button variant="destructive" disabled={reverse.isPending} onClick={() => reverse.mutate()}>تأكيد إلغاء التطبيق</Button>
        <Button variant="outline" disabled={reverse.isPending} onClick={() => setReverseId(null)}>رجوع</Button></div>
    </DialogContent></Dialog>
    <UnsavedChangesDialog open={guard.showConfirmDialog} onOpenChange={guard.setShowConfirmDialog} onStay={guard.cancelDiscard} onConfirmDiscard={guard.confirmDiscard} />
  </Card>;
}
