import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Wallet, Landmark, FileText, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";

interface ReturnItem {
  name: string;
  qty: number;
  price: number;
  unit?: string;
  returnQty: number;
  selected: boolean;
  invoiceNumber: string | null;
  purchaseId: string;
}

interface SupplierReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: {
    id: string;
    project_id: string | null;
    phase_id?: string | null;
    supplier_id: string | null;
    invoice_number: string | null;
    total_amount: number;
    items: any;
    treasury_id: string | null;
    supplier_name?: string;
  } | null;
}

export function SupplierReturnDialog({ open, onOpenChange, purchase }: SupplierReturnDialogProps) {
  const queryClient = useQueryClient();
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [notes, setNotes] = useState("");
  const [treasuryId, setTreasuryId] = useState("");
  const [parentTreasuryId, setParentTreasuryId] = useState("");
  const [deductFromPurchaseId, setDeductFromPurchaseId] = useState("");

  // Fetch all supplier invoices for this project
  const { data: supplierInvoices = [] } = useQuery({
    queryKey: ["supplier-invoices-for-return", purchase?.supplier_id, purchase?.project_id],
    queryFn: async () => {
      if (!purchase?.supplier_id || !purchase?.project_id) return [];
      const { data, error } = await supabase
        .from("purchases")
        .select("id, invoice_number, total_amount, paid_amount, items, date, treasury_id, status")
        .eq("supplier_id", purchase.supplier_id)
        .eq("project_id", purchase.project_id)
        .neq("is_return", true)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!purchase?.supplier_id && !!purchase?.project_id,
  });

  // Fetch treasuries
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

  // Unpaid/due invoices for deduction
  const dueInvoices = useMemo(() =>
    supplierInvoices.filter(inv => {
      const due = Number(inv.total_amount) - Number(inv.paid_amount || 0);
      return due > 0;
    }),
  [supplierInvoices]);

  // Supplier totals
  const supplierSummary = useMemo(() => {
    const totalPurchases = supplierInvoices.reduce((s, inv) => s + Number(inv.total_amount), 0);
    const totalPaid = supplierInvoices.reduce((s, inv) => s + Number(inv.paid_amount || 0), 0);
    const totalDue = totalPurchases - totalPaid;
    return { totalPurchases, totalPaid, totalDue };
  }, [supplierInvoices]);

  // Build return items from all supplier invoices
  useEffect(() => {
    if (!open || !purchase) return;
    const allItems: ReturnItem[] = [];
    
    // First, add items from the selected purchase
    const mainItems = Array.isArray(purchase.items) ? purchase.items : [];
    mainItems.forEach((item: any) => {
      allItems.push({
        name: item.name || "",
        qty: item.qty || 0,
        price: item.price || 0,
        unit: item.unit || "",
        returnQty: 0,
        selected: false,
        invoiceNumber: purchase.invoice_number,
        purchaseId: purchase.id,
      });
    });

    // Then add items from other invoices
    supplierInvoices.forEach(inv => {
      if (inv.id === purchase.id) return;
      const items = Array.isArray(inv.items) ? inv.items : [];
      items.forEach((item: any) => {
        allItems.push({
          name: item.name || "",
          qty: item.qty || 0,
          price: item.price || 0,
          unit: item.unit || "",
          returnQty: 0,
          selected: false,
          invoiceNumber: inv.invoice_number,
          purchaseId: inv.id,
        });
      });
    });

    setReturnItems(allItems);
    setNotes("");
    setDeductFromPurchaseId("");

    // Pre-select treasury from original purchase
    if (purchase.treasury_id) {
      const child = allTreasuriesRaw.find(t => t.id === purchase.treasury_id);
      if (child && (child as any).parent_id) {
        setParentTreasuryId((child as any).parent_id);
        setTreasuryId(purchase.treasury_id);
      }
    }
  }, [open, purchase, supplierInvoices, allTreasuriesRaw]);

  const returnTotal = returnItems
    .filter(i => i.selected && i.returnQty > 0)
    .reduce((sum, i) => sum + i.returnQty * i.price, 0);

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!purchase) return;
      const selectedItems = returnItems
        .filter(i => i.selected && i.returnQty > 0)
        .map(i => ({ name: i.name, qty: i.returnQty, price: i.price, unit: i.unit }));

      const targetTreasury = treasuryId || purchase.treasury_id;

      // Create return purchase record
      const { error: insertError } = await supabase.from("purchases").insert([{
        project_id: purchase.project_id,
        phase_id: (purchase as any).phase_id || null,
        supplier_id: purchase.supplier_id,
        date: new Date().toISOString().split("T")[0],
        invoice_number: purchase.invoice_number ? `RET-${purchase.invoice_number}` : null,
        status: "paid",
        notes: `[مرتجع] ${notes}`.trim(),
        items: JSON.parse(JSON.stringify(selectedItems)),
        total_amount: returnTotal,
        paid_amount: returnTotal,
        fund_source: "treasury",
        treasury_id: targetTreasury,
        is_return: true,
        return_for_purchase_id: purchase.id,
      } as any]);
      if (insertError) throw insertError;

      // Create deposit transaction in treasury
      if (targetTreasury) {
        const { error: txError } = await supabase.from("treasury_transactions").insert([{
          treasury_id: targetTreasury,
          type: "deposit",
          amount: returnTotal,
          balance_after: 0,
          description: `مرتجع فاتورة ${purchase.invoice_number || purchase.id.slice(0, 8)}`,
          reference_id: purchase.id,
          reference_type: "purchase_return",
          date: new Date().toISOString().split("T")[0],
          source: "purchases",
        }]);
        if (txError) throw txError;
      }

      // Deduct from a due invoice if selected
      if (deductFromPurchaseId) {
        const dueInv = dueInvoices.find(i => i.id === deductFromPurchaseId);
        if (dueInv) {
          const currentPaid = Number(dueInv.paid_amount || 0);
          const newPaid = Math.min(currentPaid + returnTotal, Number(dueInv.total_amount));
          const newStatus = newPaid >= Number(dueInv.total_amount) ? "paid" : "due";
          await supabase.from("purchases")
            .update({ paid_amount: newPaid, status: newStatus } as any)
            .eq("id", deductFromPurchaseId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم إنشاء الفاتورة الراجعة", description: `مرتجع بقيمة ${formatCurrencyLYD(returnTotal)}` });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إنشاء المرتجع", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (returnTotal <= 0) {
      toast({ title: "خطأ", description: "اختر بنوداً للإرجاع", variant: "destructive" });
      return;
    }
    if (!treasuryId && !purchase?.treasury_id) {
      toast({ title: "خطأ", description: "اختر الخزينة", variant: "destructive" });
      return;
    }
    returnMutation.mutate();
  };

  const childTreasuries = allTreasuries.filter(c => (c as any).parent_id === parentTreasuryId);

  // Group items by invoice
  const groupedByInvoice = useMemo(() => {
    const groups: Record<string, { invoiceNumber: string | null; items: (ReturnItem & { idx: number })[] }> = {};
    returnItems.forEach((item, idx) => {
      const key = item.purchaseId;
      if (!groups[key]) groups[key] = { invoiceNumber: item.invoiceNumber, items: [] };
      groups[key].items.push({ ...item, idx });
    });
    return groups;
  }, [returnItems]);

  if (!purchase) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>فاتورة راجعة (مرتجع)</DialogTitle>
          <DialogDescription>
            {purchase.supplier_name && `المورد: ${purchase.supplier_name} • `}
            فاتورة: {purchase.invoice_number || purchase.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Supplier summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
              <p className="font-bold text-sm">{formatCurrencyLYD(supplierSummary.totalPurchases)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">المدفوع</p>
              <p className="font-bold text-sm text-primary">{formatCurrencyLYD(supplierSummary.totalPaid)}</p>
            </div>
            <div className="p-2 rounded-lg bg-destructive/10">
              <p className="text-xs text-muted-foreground">المستحق</p>
              <p className="font-bold text-sm text-destructive">{formatCurrencyLYD(supplierSummary.totalDue)}</p>
            </div>
          </div>

          {/* Items grouped by invoice */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1"><Package className="h-4 w-4" /> اختر البنود المرتجعة</Label>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {Object.entries(groupedByInvoice).map(([purchaseId, group]) => (
                <div key={purchaseId} className="border rounded-lg p-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    فاتورة: {group.invoiceNumber || purchaseId.slice(0, 8)}
                    {purchaseId === purchase.id && <span className="text-primary">(الحالية)</span>}
                  </p>
                  {group.items.map(({ idx, ...item }) => (
                    <div key={idx} className="flex items-center gap-3 p-1.5 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={(checked) => {
                          setReturnItems(prev => prev.map((it, i) =>
                            i === idx ? { ...it, selected: !!checked, returnQty: checked ? it.qty : 0 } : it
                          ));
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} {item.unit} × {formatCurrencyLYD(item.price)}
                        </p>
                      </div>
                      {item.selected && (
                        <div className="w-20">
                          <Input
                            type="number"
                            min="1"
                            max={item.qty}
                            value={returnItems[idx].returnQty}
                            onChange={(e) => {
                              const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), item.qty);
                              setReturnItems(prev => prev.map((it, i) =>
                                i === idx ? { ...it, returnQty: val } : it
                              ));
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {returnTotal > 0 && (
            <div className="p-3 bg-orange-500/10 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">قيمة المرتجع</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrencyLYD(returnTotal)}</p>
            </div>
          )}

          {/* Deduct from due invoice */}
          {dueInvoices.length > 0 && returnTotal > 0 && (
            <div className="space-y-2">
              <Label>خصم من فاتورة مستحقة (اختياري)</Label>
              <Select value={deductFromPurchaseId} onValueChange={(v) => setDeductFromPurchaseId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="لا خصم - إيداع في الخزينة فقط" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">لا خصم</SelectItem>
                  {dueInvoices.map(inv => {
                    const due = Number(inv.total_amount) - Number(inv.paid_amount || 0);
                    return (
                      <SelectItem key={inv.id} value={inv.id}>
                        فاتورة {inv.invoice_number || inv.id.slice(0, 8)} — مستحق: {formatCurrencyLYD(due)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Treasury selection */}
          {purchase.treasury_id ? (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">الخزينة (تلقائي من الفاتورة الأصلية)</p>
              <p className="font-medium flex items-center gap-1">
                {(() => {
                  const t = allTreasuriesRaw.find(t => t.id === purchase.treasury_id);
                  return t ? (
                    <>
                      {(t as any).treasury_type === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                      {t.name}
                    </>
                  ) : purchase.treasury_id?.slice(0, 8);
                })()}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الخزينة الرئيسية</Label>
                <Select value={parentTreasuryId} onValueChange={(v) => { setParentTreasuryId(v); setTreasuryId(""); }}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {childTreasuries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1">
                          {(c as any).treasury_type === "bank" ? <Landmark className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="سبب الإرجاع" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={returnMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
            {returnMutation.isPending ? "جاري الإنشاء..." : "تأكيد المرتجع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
