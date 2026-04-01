import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Download, PieChart as PieIcon, BarChart2, Loader2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type IncomeRow = Tables<"income">;
type IncomeInsert = TablesInsert<"income">;
type IncomeUpdate = TablesUpdate<"income">;

const COLORS = ["hsl(var(--primary))", "#60a5fa", "#a78bfa"];

export default function Income() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [filterType, setFilterType] = React.useState<"all" | "service" | "indirect" | "treasury" | "received" | "expected">("all");
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<IncomeRow | null>(null);

  // Fetch income with projects and clients
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*, projects(name), clients(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects and clients for dropdowns
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: IncomeInsert) => {
      const { error } = await supabase.from("income").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      toast({ title: "تم الإضافة", description: "تم إضافة الإيراد بنجاح" });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: IncomeUpdate }) => {
      const { error } = await supabase.from("income").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      toast({ title: "تم التحديث", description: "تم تحديث الإيراد" });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      toast({ title: "تم الحذف", description: "تم حذف الإيراد" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const totals = React.useMemo(() => {
    const services = items.filter((i) => i.type === "service").reduce((s, v) => s + Number(v.amount), 0);
    const indirect = items.filter((i) => i.type === "indirect").reduce((s, v) => s + Number(v.amount), 0);
    const treasury = items.filter((i) => i.type === "treasury").reduce((s, v) => s + Number(v.amount), 0);
    const total = services + indirect + treasury;
    return { services, indirect, treasury, total };
  }, [items]);

  const pieData = React.useMemo(() => {
    return [
      { name: "الخدمات المقدمة للعملاء", value: totals.services },
      { name: "الإيرادات غير المباشرة", value: totals.indirect },
      { name: "تعزيز الخزينة", value: totals.treasury },
    ];
  }, [totals]);

  const lineData = React.useMemo(() => {
    const map = new Map<string, { month: string; total: number }>();
    items.forEach((it) => {
      const m = it.date.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, total: 0 });
      map.get(m)!.total += Number(it.amount);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((it) => {
      if (query) {
        const q = query.trim();
        const clientName = (it as any).clients?.name || "";
        const projectName = (it as any).projects?.name || "";
        if (!(clientName.includes(q) || projectName.includes(q) || it.notes?.includes(q) || String(it.amount).includes(q))) {
          return false;
        }
      }
      if (filterType === "all") return true;
      if (filterType === "received") return it.status === "received";
      if (filterType === "expected") return it.status === "expected";
      return it.type === filterType;
    });
  }, [items, query, filterType]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: IncomeRow) {
    setEditing(item);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.reference_id) {
      toast({ title: "لا يمكن الحذف", description: "هذا الإيراد مرتبط بتسديد زبون. يرجى حذف التسديد من صفحة المدفوعات.", variant: "destructive" });
      return;
    }
    deleteMutation.mutate(id);
  }

  function exportCSV() {
    const headers = ["id", "type", "subtype", "project", "client", "amount", "date", "payment_method", "status", "notes"];
    const rows = items.map((r) => {
      const row = {
        ...r,
        project: (r as any).projects?.name || "",
        client: (r as any).clients?.name || "",
      };
      return headers.map((h) => JSON.stringify((row as any)[h] ?? "")).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const payload: IncomeInsert = {
      type: (fd.get("type") as "service" | "indirect" | "treasury") ?? "service",
      subtype: (fd.get("subtype") as string) || null,
      project_id: (fd.get("project_id") as string) || null,
      client_id: (fd.get("client_id") as string) || null,
      amount: Number(fd.get("amount") ?? 0),
      date: (fd.get("date") as string) ?? new Date().toISOString().slice(0, 10),
      payment_method: (fd.get("payment_method") as "cash" | "transfer" | "installments" | "check") ?? "cash",
      status: (fd.get("status") as "received" | "expected") ?? "received",
      notes: (fd.get("notes") as string) || null,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

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
        <h1 className="text-3xl font-bold mb-2 text-primary">الدخول (الإيرادات)</h1>
        <p className="text-muted-foreground">إدارة الإيرادات المباشرة وغير المباشرة وتعزيزات الخزينة — زليتن، ليبيا — العملة: د.ل</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">الخدمات المقدمة للعملاء</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totals.services)}</p>
          </div>
          <PieIcon className="h-6 w-6 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">الإيرادات غير المباشرة</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totals.indirect)}</p>
          </div>
          <BarChart2 className="h-6 w-6 text-yellow-300" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">تعزيز الخزينة</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totals.treasury)}</p>
          </div>
          <PieIcon className="h-6 w-6 text-primary" />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 col-span-2">
          <h3 className="text-lg font-semibold mb-4">توزيع الإيرادات</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieData} cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">التغير الشهري</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Input placeholder="بحث (الجهة، المشروع، الملاحظات، المبلغ)" value={query} onChange={(e) => setQuery(e.target.value)} className="w-64" />
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="service">الخدمات</option>
              <option value="indirect">غير مباشرة</option>
              <option value="treasury">تعزيز الخزينة</option>
              <option value="received">مستلمة</option>
              <option value="expected">متوقعة</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button onClick={openAdd} variant="default" size="sm"><Plus className="ml-2 h-4 w-4" />إضافة إيراد</Button>
            <Button onClick={exportCSV} variant="outline" size="sm"><Download className="ml-2 h-4 w-4" />تصدير CSV</Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الجهة / العميل</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>البند</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{(it as any).clients?.name ?? "-"}</TableCell>
                <TableCell>{(it as any).projects?.name ?? "-"}</TableCell>
                <TableCell>{it.subtype ?? "-"}</TableCell>
                <TableCell>{formatCurrencyLYD(Number(it.amount))}</TableCell>
                <TableCell>{it.date}</TableCell>
                <TableCell>
                  {it.payment_method === "cash" ? "نقدي" : 
                   it.payment_method === "transfer" ? "تحويل" : 
                   it.payment_method === "installments" ? "أقساط" : "شيك"}
                </TableCell>
                <TableCell>{it.status === "received" ? "مستلمة" : "متوقعة"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(it)}><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(it.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTitle>{editing ? "تعديل الإيراد" : "إضافة إيراد جديد"}</DialogTitle>
            <DialogDescription>املأ الحقول ثم اضغط حفظ</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-3">
              <div>
                <Label>النوع</Label>
                <select name="type" defaultValue={editing?.type ?? "service"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="service">الخدمات المقدمة للعملاء</option>
                  <option value="indirect">الإيرادات غير المباشرة</option>
                  <option value="treasury">تعزيز الخزينة</option>
                </select>
              </div>

              <div>
                <Label>البند / التصنيف</Label>
                <Input name="subtype" defaultValue={editing?.subtype ?? ""} />
              </div>

              <div>
                <Label>المشروع</Label>
                <select name="project_id" defaultValue={editing?.project_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- بدون مشروع --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>العميل / الجهة</Label>
                <select name="client_id" defaultValue={editing?.client_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- بدون عميل --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                <Label>طريقة الدفع</Label>
                <select name="payment_method" defaultValue={editing?.payment_method ?? "cash"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل</option>
                  <option value="installments">أقساط</option>
                  <option value="check">شيك</option>
                </select>
              </div>

              <div>
                <Label>الحالة</Label>
                <select name="status" defaultValue={editing?.status ?? "received"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="received">مستلمة</option>
                  <option value="expected">متوقعة</option>
                </select>
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
    </div>
  );
}
