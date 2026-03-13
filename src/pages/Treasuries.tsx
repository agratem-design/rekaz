import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Wallet, Save, X, Landmark, FolderOpen, ArrowLeftRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { useNavigate } from "react-router-dom";

interface Treasury {
  id: string;
  name: string;
  description: string | null;
  balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  treasury_type: string;
  bank_name: string | null;
  account_number: string | null;
  parent_id: string | null;
}

const Treasuries = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Treasury | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"parent" | "child">("parent");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromTreasuryId: "",
    toTreasuryId: "",
    amount: 0,
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    notes: "",
    treasury_type: "cash",
    bank_name: "",
    account_number: "",
  });

  const { data: treasuries, isLoading } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as Treasury[];
    },
  });

  // Group: parents and children
  const parentTreasuries = treasuries?.filter(t => !t.parent_id) || [];
  const childTreasuries = treasuries?.filter(t => t.parent_id) || [];
  const getChildren = (parentId: string) => treasuries?.filter(t => t.parent_id === parentId) || [];

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { parent_id?: string | null }) => {
      const payload: any = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
        notes: data.notes || null,
        treasury_type: data.treasury_type,
        bank_name: data.treasury_type === "bank" ? (data.bank_name || null) : null,
        account_number: data.treasury_type === "bank" ? (data.account_number || null) : null,
        parent_id: data.parent_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("treasuries").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treasuries").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: editing ? "تم تحديث البيانات" : "تمت الإضافة بنجاح" });
      handleClose();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("treasuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم الحذف بنجاح" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "خطأ", description: "لا يمكن الحذف - قد تكون مرتبطة بعمليات", variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (form: typeof transferForm) => {
      const fromTreasury = treasuries?.find(t => t.id === form.fromTreasuryId);
      const toTreasury = treasuries?.find(t => t.id === form.toTreasuryId);
      if (!fromTreasury || !toTreasury) throw new Error("خزينة غير موجودة");
      if (fromTreasury.balance < form.amount) throw new Error("الرصيد غير كافٍ");

      const newFromBalance = fromTreasury.balance - form.amount;
      const newToBalance = toTreasury.balance + form.amount;
      const description = `نقل إلى ${toTreasury.name}`;
      const descriptionTo = `نقل من ${fromTreasury.name}`;

      // Withdrawal from source
      const { error: e1 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: form.fromTreasuryId,
        type: "withdrawal",
        amount: form.amount,
        balance_after: newFromBalance,
        source: "transfer",
        source_details: form.reason || null,
        description,
        date: form.date,
        notes: form.reason || null,
        reference_type: "transfer",
        reference_id: form.toTreasuryId,
      }]);
      if (e1) throw e1;

      // Deposit to destination
      const { error: e2 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: form.toTreasuryId,
        type: "deposit",
        amount: form.amount,
        balance_after: newToBalance,
        source: "transfer",
        source_details: form.reason || null,
        description: descriptionTo,
        date: form.date,
        notes: form.reason || null,
        reference_type: "transfer",
        reference_id: form.fromTreasuryId,
      }]);
      if (e2) throw e2;

      // Update balances
      const { error: e3 } = await supabase.from("treasuries").update({ balance: newFromBalance }).eq("id", form.fromTreasuryId);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("treasuries").update({ balance: newToBalance }).eq("id", form.toTreasuryId);
      if (e4) throw e4;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم نقل المبلغ بنجاح" });
      setTransferDialogOpen(false);
      setTransferForm({ fromTreasuryId: "", toTreasuryId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء النقل", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    setDialogMode("parent");
    setSelectedParentId(null);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
  };

  const handleAddParent = () => {
    setDialogMode("parent");
    setSelectedParentId(null);
    setFormData({ ...formData, treasury_type: "cash" });
    setDialogOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setDialogMode("child");
    setSelectedParentId(parentId);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
    setDialogOpen(true);
  };

  const handleEdit = (t: Treasury) => {
    setEditing(t);
    setDialogMode(t.parent_id ? "child" : "parent");
    setSelectedParentId(t.parent_id);
    setFormData({
      name: t.name,
      description: t.description || "",
      is_active: t.is_active,
      notes: t.notes || "",
      treasury_type: t.treasury_type || "cash",
      bank_name: t.bank_name || "",
      account_number: t.account_number || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال الاسم", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...formData,
      parent_id: dialogMode === "child" ? selectedParentId : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">خزائن الشركة</h1>
            <p className="text-sm text-muted-foreground">إدارة الخزائن والحسابات المصرفية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)} disabled={childTreasuries.length < 2}>
            <ArrowLeftRight className="h-4 w-4 ml-2" />
            نقل بين الفروع
          </Button>
          <Button onClick={handleAddParent}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة خزينة
          </Button>
        </div>
      </div>

      {parentTreasuries.length === 0 && (
        <Card className="p-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد خزائن</h3>
          <Button onClick={handleAddParent}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة خزينة
          </Button>
        </Card>
      )}

      {parentTreasuries.map((parent) => {
        const children = getChildren(parent.id);
        const totalBalance = children.reduce((sum, c) => sum + c.balance, 0);

        return (
          <Card key={parent.id} className={`${!parent.is_active ? "opacity-60" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg">{parent.name}</CardTitle>
                  {parent.description && (
                    <p className="text-sm text-muted-foreground">{parent.description}</p>
                  )}
                </div>
                {!parent.is_active && <Badge variant="secondary">معطلة</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary">{formatCurrencyLYD(totalBalance)}</span>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(parent)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(parent.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mb-3">
                {children.map((child) => (
                  <Card
                    key={child.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow border ${!child.is_active ? "opacity-60" : ""}`}
                    onClick={() => navigate(`/treasuries/${child.id}`)}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {child.treasury_type === "bank" ? (
                            <Landmark className="h-4 w-4 text-primary" />
                          ) : (
                            <Wallet className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium text-sm">{child.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(child); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteId(child.id); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {child.treasury_type === "bank" && child.bank_name && (
                        <p className="text-xs text-muted-foreground mb-1">{child.bank_name}{child.account_number ? ` - ${child.account_number}` : ""}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-primary">{formatCurrencyLYD(child.balance)}</p>
                        <Badge variant="outline" className="text-xs">
                          {child.treasury_type === "bank" ? "حساب مصرفي" : "نقدي"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => handleAddChild(parent.id)}>
                <Plus className="h-3 w-3 ml-1" />
                إضافة فرع
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "تعديل"
                : dialogMode === "parent"
                  ? "إضافة خزينة جديدة"
                  : "إضافة فرع جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {dialogMode === "child" && (
              <div className="space-y-2">
                <Label>نوع الفرع *</Label>
                <Select value={formData.treasury_type} onValueChange={(v) => setFormData({ ...formData, treasury_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي (كاش)</SelectItem>
                    <SelectItem value="bank">حساب مصرفي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{dialogMode === "parent" ? "اسم الخزينة *" : "اسم الفرع *"}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={
                  dialogMode === "parent"
                    ? "مثال: خزينة الشركة الرئيسية"
                    : formData.treasury_type === "bank"
                      ? "مثال: حساب مصرف الجمهورية"
                      : "مثال: كاش الشركة"
                }
              />
            </div>
            {dialogMode === "child" && formData.treasury_type === "bank" && (
              <div className="space-y-2">
                <Label>رقم الحساب</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="أدخل رقم الحساب المصرفي"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>نشطة</Label>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 ml-1" />
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 ml-1" />
              {saveMutation.isPending ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف هذا العنصر وجميع الفروع المرتبطة به نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { if (!open) { setTransferDialogOpen(false); setTransferForm({ fromTreasuryId: "", toTreasuryId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>نقل أموال بين الفروع</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>من خزينة *</Label>
              <Select value={transferForm.fromTreasuryId} onValueChange={(v) => setTransferForm({ ...transferForm, fromTreasuryId: v, toTreasuryId: transferForm.toTreasuryId === v ? "" : transferForm.toTreasuryId })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخزينة المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {childTreasuries.filter(t => t.is_active).map(t => {
                    const parent = parentTreasuries.find(p => p.id === t.parent_id);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {parent ? `${parent.name} / ` : ""}{t.name} ({formatCurrencyLYD(t.balance)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>إلى خزينة *</Label>
              <Select value={transferForm.toTreasuryId} onValueChange={(v) => setTransferForm({ ...transferForm, toTreasuryId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخزينة الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {childTreasuries.filter(t => t.is_active && t.id !== transferForm.fromTreasuryId && (!transferForm.fromTreasuryId || t.parent_id === childTreasuries.find(s => s.id === transferForm.fromTreasuryId)?.parent_id)).map(t => {
                    const parent = parentTreasuries.find(p => p.id === t.parent_id);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {parent ? `${parent.name} / ` : ""}{t.name} ({formatCurrencyLYD(t.balance)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (د.ل) *</Label>
              <Input
                type="number"
                step="0.01"
                value={transferForm.amount || ""}
                onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
                max={treasuries?.find(t => t.id === transferForm.fromTreasuryId)?.balance || undefined}
              />
              {transferForm.fromTreasuryId && (
                <p className="text-xs text-muted-foreground">
                  الرصيد المتاح: {formatCurrencyLYD(treasuries?.find(t => t.id === transferForm.fromTreasuryId)?.balance || 0)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>سبب النقل *</Label>
              <Textarea
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                placeholder="اكتب سبب نقل المبلغ..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={transferForm.date}
                onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              <X className="h-4 w-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!transferForm.fromTreasuryId || !transferForm.toTreasuryId) {
                  toast({ title: "خطأ", description: "يرجى اختيار الخزينتين", variant: "destructive" });
                  return;
                }
                if (transferForm.amount <= 0) {
                  toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
                  return;
                }
                if (!transferForm.reason.trim()) {
                  toast({ title: "خطأ", description: "يرجى كتابة سبب النقل", variant: "destructive" });
                  return;
                }
                const fromBalance = treasuries?.find(t => t.id === transferForm.fromTreasuryId)?.balance || 0;
                if (transferForm.amount > fromBalance) {
                  toast({ title: "خطأ", description: "الرصيد غير كافٍ في الخزينة المصدر", variant: "destructive" });
                  return;
                }
                transferMutation.mutate(transferForm);
              }}
              disabled={transferMutation.isPending}
            >
              <ArrowLeftRight className="h-4 w-4 ml-1" />
              {transferMutation.isPending ? "جاري النقل..." : "نقل المبلغ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Treasuries;
