import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { ArrowRight } from "lucide-react";

type Item = { id: string; name: string; unit: string; qty: number; price: number; notes?: string };

export default function CreateContract() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState("");
  const [contractNumber, setContractNumber] = useState(() => `C-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<"pending" | "active" | "completed" | "cancelled">("pending");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch existing contract if editing
  const { data: existingContract } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isEditing
  });

  // Populate form when editing
  useEffect(() => {
    if (existingContract) {
      setTitle(existingContract.title);
      setContractNumber(existingContract.contract_number);
      setDescription(existingContract.description || "");
      setStartDate(existingContract.start_date);
      setEndDate(existingContract.end_date || "");
      setAmount(Number(existingContract.amount));
      setStatus(existingContract.status as "pending" | "active" | "completed" | "cancelled");
      setPaymentTerms(existingContract.payment_terms || "");
      setNotes(existingContract.notes || "");
      setClientId(existingContract.client_id || "");
      setProjectId(existingContract.project_id || "");
      if (existingContract.attachments && Array.isArray(existingContract.attachments)) {
        setItems(existingContract.attachments as Item[]);
      }
    }
  }, [existingContract]);

  const itemsTotal = useMemo(() => items.reduce((sum, it) => sum + (it.qty || 0) * (it.price || 0), 0), [items]);

  function addItem() {
    setItems((s) => [...s, { id: String(Date.now()) + Math.random().toString(16).slice(2, 6), name: "", unit: "", qty: 1, price: 0, notes: "" }]);
  }

  function updateItem(itemId: string, patch: Partial<Item>) {
    setItems((s) => s.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  }

  function removeItem(itemId: string) {
    setItems((s) => s.filter((it) => it.id !== itemId));
  }

  function validate() {
    if (!title.trim()) return "أدخل عنوان العقد";
    if (!contractNumber.trim()) return "أدخل رقم العقد";
    if (!startDate) return "أدخل تاريخ البدء";
    if (amount <= 0 && items.length === 0) return "أدخل قيمة العقد أو أضف أصنافًا";
    if (endDate && new Date(startDate) > new Date(endDate)) return "تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء";
    return null;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const contractData = {
        title,
        contract_number: contractNumber,
        description: description || null,
        start_date: startDate,
        end_date: endDate || null,
        amount: amount || itemsTotal,
        status,
        payment_terms: paymentTerms || null,
        notes: notes || null,
        client_id: clientId || null,
        project_id: projectId || null,
        attachments: items
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from('contracts')
          .update(contractData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contracts')
          // @ts-ignore - attachments type mismatch
          .insert(contractData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: isEditing ? "تم تحديث العقد بنجاح" : "تم حفظ العقد بنجاح" });
      navigate('/contracts');
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "خطأ", description: "فشل في حفظ العقد", variant: "destructive" });
    }
  });

  function handleSave() {
    const err = validate();
    if (err) {
      toast({ title: "خطأ في البيانات", description: err, variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">
              {isEditing ? "تعديل العقد" : "إنشاء عقد جديد"}
            </h1>
            <p className="text-muted-foreground">املأ بيانات العقد والأصناف المرتبطة به</p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>عنوان العقد *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان العقد" />
          </div>

          <div>
            <Label>رقم العقد *</Label>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
          </div>

          <div>
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as "pending" | "active" | "completed" | "cancelled")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>العميل</Label>
            <Select value={clientId || "__none__"} onValueChange={(val) => setClientId(val === "__none__" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون عميل</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>المشروع</Label>
            <Select value={projectId || "__none__"} onValueChange={(val) => setProjectId(val === "__none__" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المشروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون مشروع</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>تاريخ البدء *</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <Label>تاريخ الانتهاء</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div>
            <Label>قيمة العقد (د.ل)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>

          <div>
            <Label>شروط الدفع</Label>
            <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="مثال: دفعة مقدمة 30%" />
          </div>

          <div className="md:col-span-2">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف العقد" />
          </div>

          <div className="md:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">أصناف العقد</h3>
          <Button variant="outline" onClick={addItem}>أضف صنف جديد</Button>
        </div>

        {items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <Input value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} placeholder="اسم الصنف" />
                  </TableCell>
                  <TableCell>
                    <Input value={it.unit} onChange={(e) => updateItem(it.id, { unit: e.target.value })} placeholder="الوحدة" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={it.qty} onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={it.price} onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })} />
                  </TableCell>
                  <TableCell className="font-semibold">{formatCurrencyLYD((it.qty || 0) * (it.price || 0))}</TableCell>
                  <TableCell>
                    <Input value={it.notes || ""} onChange={(e) => updateItem(it.id, { notes: e.target.value })} placeholder="ملاحظات" />
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" size="sm" onClick={() => removeItem(it.id)}>حذف</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-end gap-4 mt-4 pt-4 border-t">
            <span className="text-muted-foreground">إجمالي الأصناف:</span>
            <span className="text-primary font-bold text-lg">{formatCurrencyLYD(itemsTotal)}</span>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" onClick={() => navigate('/contracts')}>إلغاء</Button>
        <Button onClick={() => setPreviewOpen(true)} variant="outline">معاينة</Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "جاري الحفظ..." : (isEditing ? "تحديث العقد" : "حفظ العقد")}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>معاينة العقد</DialogTitle>
            <DialogDescription>راجع بيانات العقد قبل الحفظ</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">العنوان:</span>
                  <span className="font-semibold">{title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم العقد:</span>
                  <span>{contractNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الفترة:</span>
                  <span>{startDate} → {endDate || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">القيمة:</span>
                  <span className="font-bold text-primary">{formatCurrencyLYD(amount || itemsTotal)}</span>
                </div>
              </div>
            </Card>

            {items.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold mb-2">الأصناف ({items.length})</h4>
                <div className="space-y-1">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm">
                      <span>{it.name} ({it.qty} {it.unit})</span>
                      <span>{formatCurrencyLYD(it.qty * it.price)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>إغلاق</Button>
            <Button onClick={() => { setPreviewOpen(false); handleSave(); }}>حفظ نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
