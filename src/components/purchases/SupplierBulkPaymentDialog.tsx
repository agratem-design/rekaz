import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { TreasurySelector, useTreasuryData } from "./TreasurySelector";

interface Purchase {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  paid_amount: number;
  date: string;
  status: string | null;
}

interface SupplierBulkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  purchases: Purchase[];
}

export function SupplierBulkPaymentDialog({ open, onOpenChange, supplierId, supplierName, purchases }: SupplierBulkPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [treasuryId, setTreasuryId] = useState("");
  const [parentTreasuryId, setParentTreasuryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [notes, setNotes] = useState("");

  const { allChildren } = useTreasuryData(open);

  const unpaidPurchases = purchases
    .filter(p => Number(p.total_amount) - Number(p.paid_amount) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalRemaining = unpaidPurchases.reduce((s, p) => s + (Number(p.total_amount) - Number(p.paid_amount)), 0);
  const amount = parseFloat(paymentAmount) || 0;

  const payMutation = useMutation({
    mutationFn: async () => {
      let remaining = amount;

      for (const purchase of unpaidPurchases) {
        if (remaining <= 0) break;
        const owed = Number(purchase.total_amount) - Number(purchase.paid_amount);
        const allocate = Math.min(remaining, owed);
        const newPaid = Number(purchase.paid_amount) + allocate;
        const newStatus = newPaid >= Number(purchase.total_amount) ? "paid" : "partial";

        const { error } = await supabase
          .from("purchases")
          .update({
            paid_amount: newPaid,
            status: newStatus,
            treasury_id: treasuryId,
          } as any)
          .eq("id", purchase.id);
        if (error) throw error;

        remaining -= allocate;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم التسديد المجمع", description: `تم تسديد ${formatCurrencyLYD(amount)} لـ ${supplierName}` });
      handleClose();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء التسديد", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTreasuryId("");
    setParentTreasuryId("");
    setPaymentMethod("cash");
    setNotes("");
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (amount <= 0) {
      toast({ title: "خطأ", description: "أدخل مبلغاً صحيحاً", variant: "destructive" });
      return;
    }
    if (amount > totalRemaining) {
      toast({ title: "خطأ", description: "المبلغ أكبر من إجمالي المتبقي", variant: "destructive" });
      return;
    }
    if (!treasuryId) {
      toast({ title: "خطأ", description: "اختر الخزينة", variant: "destructive" });
      return;
    }
    const selectedTreasury = allChildren.find(t => t.id === treasuryId);
    if (!selectedTreasury || amount > (selectedTreasury.balance || 0)) {
      toast({
        title: "خطأ",
        description: `رصيد الخزينة غير كافٍ. المتاح: ${formatCurrencyLYD(selectedTreasury?.balance || 0)}`,
        variant: "destructive",
      });
      return;
    }
    payMutation.mutate();
  };

  const previewAllocation = () => {
    const result: { invoice: string; amount: number }[] = [];
    let rem = amount;
    for (const p of unpaidPurchases) {
      if (rem <= 0) break;
      const owed = Number(p.total_amount) - Number(p.paid_amount);
      const alloc = Math.min(rem, owed);
      result.push({ invoice: p.invoice_number || p.id.slice(0, 8), amount: alloc });
      rem -= alloc;
    }
    return result;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسديد مجمع للمورد</DialogTitle>
          <DialogDescription>{supplierName} • {unpaidPurchases.length} فاتورة مستحقة</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">إجمالي المتبقي</p>
              <p className="font-bold text-destructive">{formatCurrencyLYD(totalRemaining)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">فواتير مستحقة</p>
              <p className="font-bold">{unpaidPurchases.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>المبلغ المراد تسديده</Label>
            <Input
              type="number" min="0" max={totalRemaining}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={`الحد الأقصى: ${formatCurrencyLYD(totalRemaining)}`}
            />
            <Button type="button" variant="link" size="sm" className="p-0 h-auto text-xs"
              onClick={() => setPaymentAmount(String(totalRemaining))}>
              تسديد الكل
            </Button>
          </div>

          <div className="space-y-2">
            <Label>تاريخ الدفع</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <TreasurySelector
            treasuryId={treasuryId}
            onTreasuryChange={setTreasuryId}
            parentTreasuryId={parentTreasuryId}
            onParentTreasuryChange={setParentTreasuryId}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            amountToCheck={amount}
            enabled={open}
          />

          {amount > 0 && (
            <div className="space-y-1 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs font-medium text-muted-foreground mb-2">معاينة التوزيع (من الأقدم):</p>
              {previewAllocation().map((a, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>فاتورة: {a.invoice}</span>
                  <span className="font-medium">{formatCurrencyLYD(a.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات اختيارية" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={payMutation.isPending}>
            {payMutation.isPending ? "جاري التسديد..." : "تأكيد الدفع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
