import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOperationKey } from "@/hooks/useOperationKey";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { financialRpc, invalidateFinancialQueries } from "@/lib/financialMutations";
import { formatCurrencyLYD } from "@/lib/currency";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function SupplierAdvancePanel({ supplierId }: { supplierId: string }) {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const operation = useOperationKey();
  const [open, setOpen] = useState(false);
  const [purchaseId, setPurchaseId] = useState("");
  const [amount, setAmount] = useState("");
  const account = useQuery({ queryKey: ["supplier-advance-account", supplierId], queryFn: async () => {
    const results = await Promise.all([
      supabase.from("purchases").select("id, title, total_amount, projects(name)").eq("supplier_id", supplierId).order("date"),
      supabase.from("supplier_payments").select("id, amount").eq("supplier_id", supplierId),
      supabase.from("supplier_payment_allocations").select("payment_id, purchase_id, amount, supplier_payments!inner(supplier_id)").eq("supplier_payments.supplier_id", supplierId),
      supabase.from("purchase_payments").select("purchase_id, amount, purchases!inner(supplier_id)").eq("purchases.supplier_id", supplierId),
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [{ data: invoices }, { data: payments }, { data: allocations }, { data: direct }] = results;
    const available = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)
      - (allocations || []).reduce((sum, p) => sum + Number(p.amount), 0);
    return { available: Math.max(0, available), invoices: (invoices || []).map(invoice => ({
      ...invoice, remaining: Math.max(0, Number(invoice.total_amount)
        - (allocations || []).filter(p => p.purchase_id === invoice.id).reduce((sum, p) => sum + Number(p.amount), 0)
        - (direct || []).filter(p => p.purchase_id === invoice.id).reduce((sum, p) => sum + Number(p.amount), 0)),
    })).filter(invoice => invoice.remaining > 0) };
  } });
  const available = account.data?.available || 0;
  const invoices = account.data?.invoices || [];
  const remaining = invoices.find(invoice => invoice.id === purchaseId)?.remaining || 0;
  const clear = () => { setOpen(false); setPurchaseId(""); setAmount(""); };
  const save = useMutation({ mutationFn: async () => {
    const value = Number(amount);
    if (!purchaseId || !Number.isFinite(value) || value <= 0 || value > available || value > remaining) {
      throw new Error("اختر فاتورة ومبلغاً لا يتجاوز الرصيد المقدم والمتبقي عليها.");
    }
    const payload = { p_supplier_id: supplierId, p_purchase_id: purchaseId, p_amount: value };
    return financialRpc("apply_supplier_advance_v2", { ...payload, p_request_key: operation.getKey(payload) });
  }, onSuccess: () => {
    operation.reset(); clear(); invalidateFinancialQueries(queryClient);
    toast.success("تمت تسوية الفاتورة من الرصيد المقدم، دون خصم جديد من الخزينة.");
  }, onError: (error: Error) => toast.error(error.message) });
  const guard = useUnsavedChangesGuard({ isDirty: open && !!(purchaseId || amount), isSubmitting: save.isPending, onDiscard: clear });
  return <Card className="p-4 sm:p-5 space-y-3" dir="rtl">
    <div className="flex flex-wrap justify-between items-center gap-4">
      <div><h2 className="font-bold">دفعات مقدمة لم تُوزع على فواتير</h2>
        <p className="mt-1 text-sm text-muted-foreground">استخدم الرصيد المسجل سابقاً عند وصول فاتورة المورد؛ لا يلزم دفع المال مرة ثانية.</p>
        <p className="mt-2 text-lg font-bold">{account.isPending ? "جاري التحميل..." : account.error ? "الرصيد غير متاح" : formatCurrencyLYD(available)}</p>
      </div>
      {(role === "admin" || role === "accountant") && <Button onClick={() => setOpen(true)} disabled={account.isPending || !!account.error || available <= 0 || !invoices.length}>تسوية فاتورة من الرصيد</Button>}
    </div>
    {account.error && <div role="alert" className="text-sm text-destructive">تعذر تحميل الرصيد والفواتير.<Button variant="link" onClick={() => account.refetch()}>إعادة المحاولة</Button></div>}
    {!account.isPending && !account.error && available > 0 && !invoices.length && <p className="text-sm text-muted-foreground">لا توجد فواتير مستحقة حالياً؛ يبقى الرصيد محفوظاً.</p>}
    <Dialog open={open} onOpenChange={value => { if (!value) guard.requestAction(clear); }}><DialogContent dir="rtl">
      <DialogHeader><DialogTitle>تسوية فاتورة من دفعة مقدمة</DialogTitle><DialogDescription>يستخدم النظام الدفعات السابقة من خزائن قطاع المشروع نفسه، دون حركة نقدية جديدة.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
        <Select value={purchaseId} onValueChange={setPurchaseId} disabled={save.isPending}><SelectTrigger aria-label="الفاتورة المراد تسويتها"><SelectValue placeholder="اختر الفاتورة" /></SelectTrigger><SelectContent>
          {invoices.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.title || "فاتورة"} · {invoice.projects?.name || "عامة"} · متبقي {formatCurrencyLYD(invoice.remaining)}</SelectItem>)}
        </SelectContent></Select>
        <div><Label htmlFor="supplier-advance-amount">مبلغ التسوية (د.ل)</Label><Input id="supplier-advance-amount" type="number" dir="ltr" min="0.01" max={Math.min(available, remaining)} step="0.01" required value={amount} disabled={save.isPending} onChange={event => setAmount(event.target.value)} /></div>
        <div className="flex gap-2"><Button type="submit" disabled={save.isPending || !purchaseId}>{save.isPending ? "جاري الحفظ..." : "تأكيد التسوية من الرصيد"}</Button>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => guard.requestAction(clear)}>إلغاء</Button></div>
      </form>
    </DialogContent></Dialog>
    <UnsavedChangesDialog open={guard.showConfirmDialog} onOpenChange={guard.setShowConfirmDialog} onStay={guard.cancelDiscard} onConfirmDiscard={guard.confirmDiscard} />
  </Card>;
}
