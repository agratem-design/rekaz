import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Wallet, Landmark } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";

interface SupplierPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: {
    id: string;
    invoice_number: string | null;
    total_amount: number;
    paid_amount: number;
    treasury_id: string | null;
    supplier_name?: string;
  } | null;
}

export function SupplierPaymentDialog({ open, onOpenChange, purchase }: SupplierPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [treasuryId, setTreasuryId] = useState("");
  const [parentTreasuryId, setParentTreasuryId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: allTreasuriesRaw = [] } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const treasuryParents = allTreasuriesRaw.filter(t => !(t as any).parent_id);
  const allTreasuries = allTreasuriesRaw.filter(t => (t as any).parent_id);

  const remaining = purchase ? purchase.total_amount - purchase.paid_amount : 0;
  const amount = parseFloat(paymentAmount) || 0;

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!purchase) return;
      const newPaidAmount = purchase.paid_amount + amount;
      const newStatus = newPaidAmount >= purchase.total_amount ? "paid" : "partial";

      const { error } = await supabase
        .from("purchases")
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          treasury_id: treasuryId,
          notes: purchase.supplier_name
            ? `${notes ? notes + " | " : ""}تسديد ${formatCurrencyLYD(amount)}`
            : undefined,
        } as any)
        .eq("id", purchase.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم التسديد", description: `تم تسديد ${formatCurrencyLYD(amount)} بنجاح` });
      handleClose();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء التسديد", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setPaymentAmount("");
    setTreasuryId("");
    setParentTreasuryId("");
    setNotes("");
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (amount <= 0) {
      toast({ title: "خطأ", description: "أدخل مبلغاً صحيحاً", variant: "destructive" });
      return;
    }
    if (amount > remaining) {
      toast({ title: "خطأ", description: "المبلغ أكبر من المتبقي", variant: "destructive" });
      return;
    }
    if (!treasuryId) {
      toast({ title: "خطأ", description: "اختر الخزينة", variant: "destructive" });
      return;
    }
    const selectedTreasury = allTreasuries.find(t => t.id === treasuryId);
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

  if (!purchase) return null;

  const childTreasuries = allTreasuries.filter(c => (c as any).parent_id === parentTreasuryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسديد فاتورة</DialogTitle>
          <DialogDescription>
            {purchase.supplier_name && `المورد: ${purchase.supplier_name} • `}
            فاتورة: {purchase.invoice_number || purchase.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">الإجمالي</p>
              <p className="font-bold">{formatCurrencyLYD(purchase.total_amount)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">المدفوع</p>
              <p className="font-bold text-green-600">{formatCurrencyLYD(purchase.paid_amount)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">المتبقي</p>
              <p className="font-bold text-destructive">{formatCurrencyLYD(remaining)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>المبلغ المراد تسديده</Label>
            <Input
              type="number"
              min="0"
              max={remaining}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder={`الحد الأقصى: ${formatCurrencyLYD(remaining)}`}
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => setPaymentAmount(String(remaining))}
            >
              تسديد المبلغ كاملاً
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الخزينة الرئيسية</Label>
              <Select value={parentTreasuryId} onValueChange={(v) => { setParentTreasuryId(v); setTreasuryId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {treasuryParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-1"><Wallet className="h-3 w-3" />{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={treasuryId} onValueChange={setTreasuryId} disabled={!parentTreasuryId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {childTreasuries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-1">
                        {(c as any).treasury_type === "bank" ? <Landmark className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                        {c.name} - {formatCurrencyLYD(c.balance || 0)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {treasuryId && (() => {
            const sel = allTreasuries.find(t => t.id === treasuryId);
            if (sel && amount > (sel.balance || 0)) {
              return (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>رصيد الخزينة غير كافٍ!</AlertDescription>
                </Alert>
              );
            }
            return null;
          })()}

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
