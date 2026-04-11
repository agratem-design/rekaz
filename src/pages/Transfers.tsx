import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { HandCoins, ShieldCheck, Plus, Edit, Trash2, CheckSquare, BarChart2, Download, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type TransferRow = Tables<"transfers">;
type TransferInsert = TablesInsert<"transfers">;
type TransferUpdate = TablesUpdate<"transfers">;

const AMOUNT_ALERT_THRESHOLD = 50000;

const Transfers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TransferRow | null>(null);
  const [filter, setFilter] = React.useState<"all" | "active" | "closed">("all");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Fetch transfers
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: TransferInsert) => {
      const { error } = await supabase.from("transfers").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast({ title: "تم الإضافة", description: "تم إضافة السلفة/العهدة بنجاح" });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransferUpdate }) => {
      const { error } = await supabase.from("transfers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast({ title: "تم التحديث", description: "تم تحديث السلفة/العهدة" });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transfers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast({ title: "تم الحذف", description: "تم حذف البند بنجاح" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const totals = React.useMemo(() => {
    const openLoans = items.filter((i) => i.type === "loan" && i.status === "active").reduce((s, v) => s + Number(v.amount), 0);
    const openAdvances = items.filter((i) => i.type === "advance" && i.status === "active").reduce((s, v) => s + Number(v.amount), 0);
    const totalOpen = openLoans + openAdvances;
    const totalAllAdvances = items.filter((i) => i.type === "advance").reduce((s, v) => s + Number(v.amount), 0);
    const repaid = items.filter((i) => i.status === "closed").reduce((s, v) => s + Number(v.amount), 0);
    const paybackRate = totalAllAdvances + totalOpen === 0 ? 100 : Math.round((repaid / (totalAllAdvances + totalOpen)) * 100);
    return { openLoans, openAdvances, totalOpen, totalAllAdvances, repaid, paybackRate };
  }, [items]);

  const chartData = React.useMemo(() => {
    const map = new Map<string, { month: string; loan: number; advance: number }>();
    items.forEach((it) => {
      const m = it.date.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, loan: 0, advance: 0 });
      const entry = map.get(m)!;
      if (it.type === "loan") entry.loan += Number(it.amount);
      else entry.advance += Number(it.amount);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [items]);

  function openAddDialog() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: TransferRow) {
    setEditing(item);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  function handleClose(id: string) {
    updateMutation.mutate({ id, data: { status: "closed" } });
  }

  function handleExportCSV() {
    const headers = ["id", "type", "subtype", "party_name", "amount", "date", "notes", "status"];
    const rows = items.map((it) => headers.map((h) => JSON.stringify((it as any)[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transfers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload: TransferInsert = {
      type: (fd.get("type") as "loan" | "advance") ?? "loan",
      subtype: (fd.get("subtype") as "partner" | "employee" | "other" | "permanent" | "one-time") ?? "partner",
      party_name: (fd.get("party_name") as string) ?? "",
      amount: Number(fd.get("amount") ?? 0),
      date: (fd.get("date") as string) ?? new Date().toISOString().slice(0, 10),
      notes: (fd.get("notes") as string) || null,
      status: editing?.status ?? "active",
    };

    if (payload.amount > AMOUNT_ALERT_THRESHOLD) {
      toast({ title: "تحذير: مبلغ كبير", description: `تم إضافة بند بمبلغ ${formatCurrencyLYD(payload.amount)}` });
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filteredItems = items.filter((i) => {
    if (filter === "all") return true;
    return i.status === filter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-primary">الدخول والخروج (حركات داخلية)</h1>
        <p className="text-muted-foreground">إدارة السلف والعهد — المدينة: زليتن، العملة: د.ل</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">إجمالي السلف المفتوحة</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totals.openLoans)}</p>
          </div>
          <HandCoins className="h-6 w-6 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">إجمالي العهد</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totals.openAdvances)}</p>
          </div>
          <ShieldCheck className="h-6 w-6 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">نسبة التسديد</p>
            <p className="text-2xl font-bold text-primary">{totals.paybackRate}%</p>
          </div>
          <BarChart2 className="h-6 w-6 text-primary" />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 col-span-2">
          <h3 className="text-lg font-semibold mb-4">حركة السلف والعهد</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAdvance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Area type="monotone" dataKey="loan" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorLoan)" name="سلف" />
                <Area type="monotone" dataKey="advance" stroke="#60a5fa" fillOpacity={1} fill="url(#colorAdvance)" name="عهد" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>تصفية الحالة</Label>
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر حالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="closed">مغلقة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={openAddDialog} variant="default" size="sm"><Plus className="ml-2 h-4 w-4" />أضف سلفة/عهدة</Button>
              <Button onClick={handleExportCSV} variant="outline" size="sm"><Download className="ml-2 h-4 w-4" />تصدير CSV</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الجهة</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الملاحظات</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.party_name}</TableCell>
                <TableCell>{it.type === "loan" ? "سلفة" : "عهدة"}</TableCell>
                <TableCell>
                  {it.subtype === "partner" ? "شركاء" :
                   it.subtype === "employee" ? "موظفين" :
                   it.subtype === "other" ? "للغير" :
                   it.subtype === "permanent" ? "دائمة" : "مرة واحدة"}
                </TableCell>
                <TableCell>{formatCurrencyLYD(Number(it.amount))}</TableCell>
                <TableCell>{it.date}</TableCell>
                <TableCell>{it.notes ?? "-"}</TableCell>
                <TableCell>{it.status === "active" ? "نشطة" : "مغلقة"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(it)}><Edit className="h-4 w-4" /></Button>
                    {it.status === "active" && (
                      <Button size="sm" variant="secondary" onClick={() => handleClose(it.id)}><CheckSquare className="h-4 w-4" /></Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => setDeleteId(it.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل السلفة/العهدة" : "إضافة سلفة/عهدة جديدة"}</DialogTitle>
            <DialogDescription>املأ الحقول التالية ثم اضغط حفظ</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-3">
              <div>
                <Label>النوع</Label>
                <select name="type" defaultValue={editing?.type ?? "loan"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="loan">سلفة</option>
                  <option value="advance">عهدة</option>
                </select>
              </div>

              <div>
                <Label>التصنيف</Label>
                <select name="subtype" defaultValue={editing?.subtype ?? "partner"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="partner">سلف الشركاء</option>
                  <option value="employee">سلف الموظفين</option>
                  <option value="other">سلف للغير</option>
                  <option value="permanent">العهد الدائمة</option>
                  <option value="one-time">العهد لمرة واحدة</option>
                </select>
              </div>

              <div>
                <Label>الجهة / المستفيد</Label>
                <Input name="party_name" defaultValue={editing?.party_name ?? ""} required />
              </div>

              <div>
                <Label>المبلغ (د.ل)</Label>
                <Input name="amount" type="number" defaultValue={editing?.amount ?? 0} required />
              </div>

              <div>
                <Label>التاريخ</Label>
                <Input name="date" type="date" defaultValue={editing?.date ?? new Date().toISOString().slice(0, 10)} required />
              </div>

              <div>
                <Label>ملاحظات</Label>
                <Textarea name="notes" defaultValue={editing?.notes ?? ""} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا البند؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { handleDelete(deleteId); setDeleteId(null); } }}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Transfers;
