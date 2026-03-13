import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Wallet, Landmark, AlertTriangle, HardHat, Plus, Trash2 } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { toast } from "@/hooks/use-toast";

interface ServiceItem {
  name: string;
  qty: number;
  price: number;
  unit: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phaseId?: string;
  purchaseSection?: "contracting" | "finishing";
}

export function TechnicianServiceDialog({ open, onOpenChange, projectId, phaseId, purchaseSection = "contracting" }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    technician_id: "",
    paid_amount: "",
    commission: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    treasury_id: "",
    invoice_image_url: "",
    items: [{ name: "", qty: 1, price: 0, unit: "" }] as ServiceItem[],
  });
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState("");

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data } = await supabase.from("technicians").select("id, name, specialty").order("name");
      return data || [];
    },
  });

  const { data: allTreasuriesRaw = [] } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const treasuryParents = allTreasuriesRaw.filter(t => !(t as any).parent_id);
  const allTreasuries = allTreasuriesRaw.filter(t => (t as any).parent_id);

  const totalAmount = form.items.reduce((sum, item) => sum + (item.qty * item.price), 0);

  const handleItemChange = (index: number, field: keyof ServiceItem, value: string | number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleAddItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { name: "", qty: 1, price: 0, unit: "" }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const paidAmount = parseFloat(form.paid_amount) || 0;
      const commission = parseFloat(form.commission) || 0;

      let status: "due" | "paid" | "partial" = "due";
      if (paidAmount >= totalAmount && totalAmount > 0) status = "paid";
      else if (paidAmount > 0) status = "partial";

      const payload = {
        project_id: projectId,
        phase_id: phaseId || null,
        technician_id: form.technician_id || null,
        supplier_id: null,
        date: form.date,
        invoice_number: null,
        status,
        notes: `[خدمات فنيين] ${form.notes || ""}`.trim(),
        total_amount: totalAmount,
        paid_amount: paidAmount,
        commission,
        fund_source: "treasury",
        treasury_id: form.treasury_id || null,
        purchase_source: "technician_service",
        purchase_section: purchaseSection,
        invoice_image_url: form.invoice_image_url || null,
        items: form.items.filter(item => item.name.trim()),
      };

      const { error } = await supabase.from("purchases").insert([payload as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم إضافة فاتورة خدمات الفني بنجاح" });
      resetAndClose();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ الفاتورة", variant: "destructive" });
    },
  });

  const resetAndClose = () => {
    setForm({
      technician_id: "", paid_amount: "", commission: "",
      date: new Date().toISOString().split("T")[0],
      notes: "", treasury_id: "", invoice_image_url: "",
      items: [{ name: "", qty: 1, price: 0, unit: "" }],
    });
    setSelectedParentTreasuryId("");
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!form.technician_id) {
      toast({ title: "خطأ", description: "يرجى اختيار الفني", variant: "destructive" });
      return;
    }
    const validItems = form.items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      toast({ title: "خطأ", description: "يرجى إضافة بند واحد على الأقل", variant: "destructive" });
      return;
    }
    if (totalAmount <= 0) {
      toast({ title: "خطأ", description: "إجمالي البنود يجب أن يكون أكبر من صفر", variant: "destructive" });
      return;
    }
    if (!form.treasury_id) {
      toast({ title: "خطأ", description: "يرجى اختيار الخزينة", variant: "destructive" });
      return;
    }

    const paidAmount = parseFloat(form.paid_amount) || 0;
    const commissionAmt = parseFloat(form.commission) || 0;
    const totalDeduction = paidAmount + commissionAmt;

    if (totalDeduction > 0) {
      const selectedTreasury = allTreasuries.find(t => t.id === form.treasury_id);
      if (!selectedTreasury || totalDeduction > (selectedTreasury.balance || 0)) {
        toast({
          title: "خطأ",
          description: `رصيد الخزينة غير كافٍ. المطلوب: ${formatCurrencyLYD(totalDeduction)} - المتاح: ${formatCurrencyLYD(selectedTreasury?.balance || 0)}`,
          variant: "destructive",
        });
        return;
      }
    }

    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            فاتورة خدمات فنيين
          </DialogTitle>
          <DialogDescription>
            إنشاء فاتورة مشتريات لخدمات الفنيين (تنظيف، ترتيب، خدمات أخرى)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Technician + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الفني *</Label>
              <Select value={form.technician_id} onValueChange={(v) => setForm(f => ({ ...f, technician_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفني" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.specialty && <span className="text-muted-foreground">({t.specialty})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">البنود *</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 ml-1" /> إضافة بند
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-right font-medium">الصنف</th>
                    <th className="p-2 text-center font-medium w-20">الكمية</th>
                    <th className="p-2 text-center font-medium w-24">الوحدة</th>
                    <th className="p-2 text-center font-medium w-28">السعر</th>
                    <th className="p-2 text-center font-medium w-28">الإجمالي</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-1.5">
                        <Input
                          value={item.name}
                          onChange={(e) => handleItemChange(index, "name", e.target.value)}
                          placeholder="اسم الخدمة / البند"
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number" min="1"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, "qty", parseInt(e.target.value) || 1)}
                          className="h-8 text-sm text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          placeholder="وحدة"
                          className="h-8 text-sm text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number" min="0" step="0.01"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-center"
                        />
                      </td>
                      <td className="p-1.5 text-center font-medium text-muted-foreground">
                        {formatCurrencyLYD(item.qty * item.price)}
                      </td>
                      <td className="p-1.5">
                        {form.items.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td colSpan={4} className="p-2 text-left font-semibold">الإجمالي</td>
                    <td className="p-2 text-center font-bold">{formatCurrencyLYD(totalAmount)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Paid Amount */}
          <div className="space-y-2">
            <Label>المبلغ المسدد</Label>
            <Input
              type="number" min="0" step="0.01"
              value={form.paid_amount}
              onChange={(e) => setForm(f => ({ ...f, paid_amount: e.target.value }))}
              placeholder="المبلغ المدفوع"
            />
          </div>

          {/* Treasury Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">الخزينة *</Label>
            <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الخزينة الرئيسية</Label>
                  <Select value={selectedParentTreasuryId} onValueChange={(v) => { setSelectedParentTreasuryId(v); setForm(f => ({ ...f, treasury_id: "" })); }}>
                    <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                    <SelectContent>
                      {treasuryParents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" />{p.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select value={form.treasury_id} onValueChange={(v) => setForm(f => ({ ...f, treasury_id: v }))} disabled={!selectedParentTreasuryId}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      {allTreasuries.filter(c => (c as any).parent_id === selectedParentTreasuryId).map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          <span className="flex items-center gap-2">
                            {(child as any).treasury_type === "bank" ? <Landmark className="h-4 w-4 text-muted-foreground" /> : <Wallet className="h-4 w-4 text-muted-foreground" />}
                            {child.name} - {formatCurrencyLYD(child.balance || 0)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.treasury_id && (() => {
                const sel = allTreasuries.find(t => t.id === form.treasury_id);
                const totalDeduction = (parseFloat(form.paid_amount) || 0) + (parseFloat(form.commission) || 0);
                if (sel && totalDeduction > (sel.balance || 0)) {
                  return (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        رصيد الخزينة غير كافٍ! المطلوب: {formatCurrencyLYD(totalDeduction)} - المتاح: {formatCurrencyLYD(sel.balance || 0)}
                      </AlertDescription>
                    </Alert>
                  );
                }
                if (sel) {
                  return <p className="text-xs text-muted-foreground">الرصيد المتاح: <span className="font-bold">{formatCurrencyLYD(sel.balance || 0)}</span></p>;
                }
                return null;
              })()}

              {form.treasury_id && (() => {
                const sel = allTreasuries.find(t => t.id === form.treasury_id);
                if (sel && (sel as any).treasury_type === "bank") {
                  return (
                    <div className="space-y-2">
                      <Label>عمولة التحويل</Label>
                      <Input type="number" min="0" step="0.01" value={form.commission} onChange={(e) => setForm(f => ({ ...f, commission: e.target.value }))} placeholder="عمولة التحويل البنكي" />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="وصف الخدمة المطلوبة..." rows={2} />
          </div>

          <ImageUploader
            value={form.invoice_image_url}
            onChange={(url) => setForm(f => ({ ...f, invoice_image_url: url }))}
            folder="invoices"
            label="صورة الفاتورة"
          />

          {/* Summary */}
          {totalAmount > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
              <p className="font-semibold text-muted-foreground mb-1">ملخص:</p>
              <div className="flex justify-between"><span>إجمالي البنود:</span><span className="font-semibold">{formatCurrencyLYD(totalAmount)}</span></div>
              <div className="flex justify-between"><span>المدفوع:</span><span>{formatCurrencyLYD(parseFloat(form.paid_amount) || 0)}</span></div>
              {(parseFloat(form.commission) || 0) > 0 && (
                <div className="flex justify-between"><span>العمولة:</span><span>{formatCurrencyLYD(parseFloat(form.commission) || 0)}</span></div>
              )}
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>المتبقي:</span>
                <span className={totalAmount - (parseFloat(form.paid_amount) || 0) > 0 ? "text-destructive" : ""}>
                  {formatCurrencyLYD(totalAmount - (parseFloat(form.paid_amount) || 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
