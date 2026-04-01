import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";

interface ReturnItem {
  name: string;
  qty: number;
  price: number;
  unit: string;
}

interface StandaloneReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId?: string;
  purchaseSection?: string;
  defaultSupplierId?: string;
}

export const StandaloneReturnDialog = ({
  open, onOpenChange, projectId, phaseId, purchaseSection, defaultSupplierId,
}: StandaloneReturnDialogProps) => {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState(defaultSupplierId || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([{ name: "", qty: 1, price: 0, unit: "" }]);
  const [treasuryId, setTreasuryId] = useState("");
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [deductFromSupplier, setDeductFromSupplier] = useState(true);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);

  // Reset supplier when dialog opens with default
  const effectiveSupplierId = supplierId || defaultSupplierId || "";

  // Fetch suppliers linked to project
  const { data: projectSuppliers } = useQuery({
    queryKey: ["project-suppliers-list", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_suppliers")
        .select("supplier_id, suppliers(id, name)")
        .eq("project_id", projectId);
      if (error) throw error;
      return data?.map((ps: any) => ps.suppliers).filter(Boolean) || [];
    },
    enabled: open && !!projectId,
  });

  // Also fetch all suppliers as fallback
  const { data: allSuppliers } = useQuery({
    queryKey: ["all-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const suppliers = useMemo(() => {
    if (projectSuppliers && projectSuppliers.length > 0) return projectSuppliers;
    return allSuppliers || [];
  }, [projectSuppliers, allSuppliers]);

  // Fetch supplier's purchase items for suggestions
  const { data: supplierPurchaseItems } = useQuery({
    queryKey: ["supplier-purchase-items", projectId, effectiveSupplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("items")
        .eq("project_id", projectId)
        .eq("supplier_id", effectiveSupplierId)
        .eq("is_return", false);
      if (error) throw error;
      const allItems: { name: string; unit: string; price: number }[] = [];
      const seen = new Set<string>();
      data?.forEach((p: any) => {
        if (Array.isArray(p.items)) {
          p.items.forEach((item: any) => {
            if (item.name && !seen.has(item.name)) {
              seen.add(item.name);
              allItems.push({ name: item.name, unit: item.unit || "", price: item.price || 0 });
            }
          });
        }
      });
      return allItems;
    },
    enabled: open && !!effectiveSupplierId && !!projectId,
  });

  // Fetch all due/partial purchases for automatic deduction
  const { data: duePurchases } = useQuery({
    queryKey: ["supplier-due-purchases", effectiveSupplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, invoice_number, total_amount, paid_amount, status, date")
        .eq("supplier_id", effectiveSupplierId)
        .eq("is_return", false)
        .in("status", ["due", "partial"])
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!effectiveSupplierId,
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

  const treasuryParents = allTreasuriesRaw.filter((t: any) => !t.parent_id);
  const childTreasuries = allTreasuriesRaw.filter((t: any) => t.parent_id);
  const filteredChildren = childTreasuries.filter((t: any) => t.parent_id === selectedParentTreasuryId);

  const totalAmount = items.reduce((sum, item) => sum + item.qty * item.price, 0);

  const handleItemChange = (index: number, field: keyof ReturnItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSelectSuggestion = (index: number, suggestion: { name: string; unit: string; price: number }) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, name: suggestion.name, unit: suggestion.unit, price: suggestion.price } : item
    ));
    setFocusedItemIndex(null);
  };

  // Show all suggestions when focused (even without typing), filter when typing
  const getFilteredSuggestions = (query: string) => {
    if (!supplierPurchaseItems) return [];
    if (!query.trim()) return supplierPurchaseItems.slice(0, 8);
    return supplierPurchaseItems.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter(i => i.name.trim());
      if (validItems.length === 0) throw new Error("أضف بند واحد على الأقل");
      if (!effectiveSupplierId) throw new Error("اختر المورد");

      const payload = {
        project_id: projectId,
        phase_id: phaseId || null,
        supplier_id: effectiveSupplierId,
        date,
        invoice_number: invoiceNumber || null,
        total_amount: totalAmount,
        paid_amount: totalAmount,
        status: "paid",
        notes: notes || null,
        items: JSON.parse(JSON.stringify(validItems)),
        is_return: true,
        return_for_purchase_id: null,
        fund_source: "treasury" as const,
        treasury_id: treasuryId || null,
        commission: 0,
        purchase_source: "supplier",
        purchase_section: purchaseSection || "contracting",
      };

      const { error } = await supabase.from("purchases").insert([payload as any]);
      if (error) throw error;

      // Auto-distribute deduction across all due invoices for this supplier
      if (deductFromSupplier && totalAmount > 0 && duePurchases && duePurchases.length > 0) {
        let remaining = totalAmount;
        for (const dp of duePurchases) {
          if (remaining <= 0) break;
          const due = Number(dp.total_amount) - Number(dp.paid_amount || 0);
          if (due <= 0) continue;
          const deduct = Math.min(remaining, due);
          const newPaid = Number(dp.paid_amount || 0) + deduct;
          const newStatus = newPaid >= Number(dp.total_amount) ? "paid" : "partial";
          await supabase.from("purchases")
            .update({ paid_amount: newPaid, status: newStatus } as any)
            .eq("id", dp.id);
          remaining -= deduct;
        }
      }

      // If treasury selected, create deposit transaction for the return
      if (treasuryId && totalAmount > 0) {
        const supplierName = (suppliers as any[])?.find((s: any) => s.id === effectiveSupplierId)?.name || 'مورد';
        const { error: txError } = await supabase.from("treasury_transactions").insert([{
          treasury_id: treasuryId,
          type: "deposit",
          amount: totalAmount,
          balance_after: 0,
          description: `مرتجع مشتريات - ${supplierName}`,
          reference_type: "purchase_return",
          date,
          source: "purchase_return",
        }]);
        if (txError) throw txError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم إضافة فاتورة المرتجع بنجاح" });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "حدث خطأ", variant: "destructive" });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setSupplierId(defaultSupplierId || "");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setItems([{ name: "", qty: 1, price: 0, unit: "" }]);
    setTreasuryId("");
    setSelectedParentTreasuryId("");
    setInvoiceNumber("");
    setDeductFromSupplier(true);
    setFocusedItemIndex(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            فاتورة ترجيع مشتريات
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>المورد *</Label>
              {defaultSupplierId ? (
                <Input value={(suppliers as any[])?.find((s: any) => s.id === defaultSupplierId)?.name || ""} disabled />
              ) : (
                <Select value={effectiveSupplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers as any[])?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رقم فاتورة المرتجع</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="اختياري" />
            </div>
            <div className="space-y-2">
              <Label>الخزينة (إيداع المرتجع)</Label>
              <Select value={selectedParentTreasuryId} onValueChange={(v) => { setSelectedParentTreasuryId(v); setTreasuryId(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                <SelectContent>
                  {treasuryParents.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedParentTreasuryId && filteredChildren.length > 0 && (
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={treasuryId} onValueChange={setTreasuryId}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {filteredChildren.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Auto deduct from supplier account */}
          {duePurchases && duePurchases.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <input
                type="checkbox"
                id="deductFromSupplier"
                checked={deductFromSupplier}
                onChange={e => setDeductFromSupplier(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="deductFromSupplier" className="text-sm">
                خصم تلقائي من مستحقات المورد (إجمالي المستحق: {formatCurrencyLYD(
                  duePurchases.reduce((sum, p) => sum + (Number(p.total_amount) - Number(p.paid_amount || 0)), 0)
                )})
              </label>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <Label>بنود المرتجع</Label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="relative">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="اسم البند"
                        value={item.name}
                        onChange={e => handleItemChange(index, "name", e.target.value)}
                        onFocus={() => setFocusedItemIndex(index)}
                        onBlur={() => setTimeout(() => setFocusedItemIndex(null), 200)}
                      />
                      {focusedItemIndex === index && getFilteredSuggestions(item.name).length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {getFilteredSuggestions(item.name).map((s, si) => (
                            <button
                              key={si}
                              type="button"
                              className="w-full text-right px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                              onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(index, s); }}
                            >
                              <span className="font-medium">{s.name}</span>
                              <span className="text-muted-foreground mr-2">— {s.unit} — {formatCurrencyLYD(s.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      className="w-20"
                      placeholder="الوحدة"
                      value={item.unit}
                      onChange={e => handleItemChange(index, "unit", e.target.value)}
                    />
                    <Input
                      className="w-24"
                      type="number"
                      placeholder="الكمية"
                      value={item.qty || ""}
                      onChange={e => handleItemChange(index, "qty", Number(e.target.value))}
                    />
                    <Input
                      className="w-28"
                      type="number"
                      placeholder="السعر"
                      value={item.price || ""}
                      onChange={e => handleItemChange(index, "price", Number(e.target.value))}
                    />
                    <span className="text-sm font-medium min-w-[80px] pt-2 text-center">
                      {formatCurrencyLYD(item.qty * item.price)}
                    </span>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                        onClick={() => setItems(prev => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setItems(prev => [...prev, { name: "", qty: 1, price: 0, unit: "" }])}>
              <Plus className="h-3 w-3 ml-1" />
              إضافة بند
            </Button>
          </div>

          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <span className="font-medium">إجمالي المرتجع:</span>
            <span className="text-lg font-bold text-primary">{formatCurrencyLYD(totalAmount)}</span>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !effectiveSupplierId || totalAmount <= 0}>
            {saveMutation.isPending ? "جاري الحفظ..." : "حفظ فاتورة المرتجع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
