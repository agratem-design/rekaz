import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Phone, Wrench, Zap, Droplet, Hammer, Ruler, Edit, Trash2, Eye, Calendar } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyLYD } from "@/lib/currency";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TechnicianForm {
  name: string;
  technician_type_id: string;
  specialty: string;
  phone: string;
  email: string;
  hourly_rate: string;
  daily_rate: string;
  meter_rate: string;
  piece_rate: string;
  notes: string;
  work_type: "hourly" | "daily" | "meter" | "piece";
}

const initialForm: TechnicianForm = {
  name: "",
  technician_type_id: "",
  specialty: "",
  phone: "",
  email: "",
  hourly_rate: "",
  daily_rate: "",
  meter_rate: "",
  piece_rate: "",
  notes: "",
  work_type: "daily",
};

const Technicians = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<string | null>(null);
  const [form, setForm] = useState<TechnicianForm>(initialForm);

  // Inline Specialty Create State
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");

  const { data: technicians, isLoading, error: techniciansError } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*, technician_types(id, name, code)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: technicianTypes = [] } = useQuery<any[]>({
    queryKey: ["technician-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_types" as any)
        .select("id, name, code")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Fetch all technician rates (project_item_technicians - Canonical Work Authority)
  const { data: allTechnicianRates, error: ratesError } = useQuery({
    queryKey: ["all-technicians-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_item_technicians")
        .select(`
          *,
          project_items (
            id,
            name
          )
        `);
      if (error) throw error;
      return data;
    },
  });

  const { data: allLaborPurchases = [], isLoading: loadingLabor, error: laborError } = useQuery({
    queryKey: ["all-technician-labor-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("technician_id, total_amount")
        .not("technician_id", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all expenses for technicians
  const { data: allExpenses, error: expensesError } = useQuery({
    queryKey: ["all-technicians-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("type", "labor")
        .not("technician_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all on-account payments for technicians
  const { data: allDirectPayments = [], isLoading: loadingDirect, error: directError } = useQuery<Array<{ id: string; technician_id: string; amount: number; status: string }>>({
    queryKey: ["all-technicians-direct-payments"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("technician_payments" as any) as any)
        .select("id, technician_id, amount, status")
        .eq("status", "completed");
      if (error) throw error;
      return (data || []) as Array<{ id: string; technician_id: string; amount: number; status: string }>;
    },
  });

  const { data: laborInvoicePayments = [], isLoading: loadingInvoices, error: invoicesError } = useQuery({
    queryKey: ["all-technician-labor-invoice-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_payments")
        .select("amount, purchases!inner(technician_id)").not("purchases.technician_id", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["technicians-stats"],
    queryFn: async () => {
      const { data: allTechs } = await supabase
        .from("technicians")
        .select("specialty");

      const specialtyCounts: Record<string, number> = {};
      allTechs?.forEach((tech) => {
        const spec = tech.specialty || "أخرى";
        specialtyCounts[spec] = (specialtyCounts[spec] || 0) + 1;
      });

      return specialtyCounts;
    },
  });

  // Calculate technician stats (work value, paid, signed balance, last work)
  const technicianStats = useMemo(() => {
    const statsMap = new Map<string, {
      totalWorkValue: number;
      totalPaid: number;
      signedBalance: number;
      lastWorkItem: string | null;
      lastWorkDate: string | null;
      lastAddedDate: string | null;
    }>();

    technicians?.forEach((tech) => {
      // Get canonical assigned works for this technician
      const techRates = allTechnicianRates?.filter((r) => r.technician_id === tech.id) || [];
      const laborWorks = allLaborPurchases.filter(work => work.technician_id === tech.id);
      const totalWorkValue = techRates.reduce((sum, r) => {
        const rawCost = Number(r.total_cost);
        const wVal = rawCost > 0 ? rawCost : (Number(r.rate || 0) * Number(r.quantity ?? 1));
        return sum + wVal;
      }, 0) + laborWorks.reduce((sum, work) => sum + Number(work.total_amount || 0), 0);

      // Get expenses (legacy labor payments) for this technician
      const techExpenses = allExpenses?.filter((e) => e.technician_id === tech.id) || [];
      const totalExpensesPaid = techExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      // Get direct technician on-account payments
      const techDirectPayments = allDirectPayments?.filter((dp: any) => dp.technician_id === tech.id) || [];
      const totalDirectPaid = techDirectPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);

      const totalInvoicePaid = laborInvoicePayments.filter(payment => payment.purchases.technician_id === tech.id)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const totalPaid = totalExpensesPaid + totalDirectPaid + totalInvoicePaid;
      const signedBalance = totalWorkValue - totalPaid;

      // Get last added date (from technician rates - when they were assigned to items)
      const lastRate = techRates.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      statsMap.set(tech.id, {
        totalWorkValue,
        totalPaid,
        signedBalance,
        lastWorkItem: (lastRate as any)?.project_items?.name || null,
        lastWorkDate: lastRate?.created_at || null,
        lastAddedDate: lastRate?.created_at || null,
      });
    });

    return statsMap;
  }, [technicians, allTechnicianRates, allExpenses, allDirectPayments, allLaborPurchases, laborInvoicePayments]);

  const saveMutation = useMutation({
    mutationFn: async (data: TechnicianForm) => {
      const selectedType = technicianTypes.find((t: any) => t.id === data.technician_type_id);
      const techData = {
        name: data.name.trim(),
        technician_type_id: data.technician_type_id || null,
        specialty: selectedType?.name || null, // Synchronized legacy cache only
        phone: data.phone || null,
        email: data.email || null,
        hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
        daily_rate: data.daily_rate ? parseFloat(data.daily_rate) : null,
        meter_rate: data.meter_rate ? parseFloat(data.meter_rate) : null,
        piece_rate: data.piece_rate ? parseFloat(data.piece_rate) : null,
        notes: data.notes || null,
      };

      if (editingTechnician) {
        const { error } = await supabase
          .from("technicians")
          .update(techData)
          .eq("id", editingTechnician);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("technicians").insert(techData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-stats"] });
      toast.success(editingTechnician ? "تم تحديث الفني بنجاح" : "تمت إضافة الفني بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const code = `type_${Date.now()}`;
      const { data, error } = await (supabase
        .from("technician_types" as any)
        .insert({
          name,
          description: description || null,
          code,
          is_active: true,
        } as any)
        .select("id, name, code")
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (newType: any) => {
      queryClient.invalidateQueries({ queryKey: ["technician-types"] });
      setForm((prev) => ({
        ...prev,
        technician_type_id: newType.id,
        specialty: newType.name,
      }));
      setIsAddTypeDialogOpen(false);
      setNewTypeName("");
      setNewTypeDesc("");
      toast.success(`تمت إضافة التخصص "${newType.name}" بنجاح واختياره`);
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء إضافة التخصص");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("technicians").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-stats"] });
      toast.success("تم حذف الفني بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الحذف");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTechnician(null);
    setForm(initialForm);
  };

  const handleEdit = (tech: any) => {
    setEditingTechnician(tech.id);
    setForm({
      name: tech.name,
      technician_type_id: tech.technician_type_id || "",
      specialty: tech.specialty || "",
      phone: tech.phone || "",
      email: tech.email || "",
      hourly_rate: tech.hourly_rate?.toString() || "",
      daily_rate: tech.daily_rate?.toString() || "",
      meter_rate: tech.meter_rate?.toString() || "",
      piece_rate: tech.piece_rate?.toString() || "",
      notes: tech.notes || "",
      work_type: tech.meter_rate ? "meter" : tech.piece_rate ? "piece" : tech.hourly_rate ? "hourly" : "daily",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("يرجى إدخال اسم الفني");
      return;
    }
    saveMutation.mutate(form);
  };

  const getSpecialtyIcon = (specialty: string) => {
    const icons: Record<string, any> = {
      "نجار": Hammer,
      "كهربائي": Zap,
      "سباك": Droplet,
      "حداد": Wrench,
      "بنّاء": Ruler,
    };
    return icons[specialty] || Wrench;
  };

  if (techniciansError || ratesError || laborError || expensesError || directError || invoicesError) return (
    <Card className="p-6 space-y-3" dir="rtl" role="alert">
      <p>تعذر تحميل حسابات الفنيين كاملة. لم نعرض أرصدة جزئية.</p>
      <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>إعادة المحاولة</Button>
    </Card>
  );
  if (isLoading || loadingLabor || loadingDirect || loadingInvoices || !allExpenses || !allTechnicianRates) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  const specialtyColors: Record<string, string> = {
    "نجار": "bg-amber-500/20 text-amber-500",
    "كهربائي": "bg-yellow-500/20 text-yellow-500",
    "سباك": "bg-blue-500/20 text-blue-500",
    "حداد": "bg-gray-500/20 text-gray-400",
    "بنّاء": "bg-orange-500/20 text-orange-500"
  };

  const specialties = ["نجار", "كهربائي", "سباك", "حداد", "بنّاء", "دهّان", "بلّاط", "ألمنيوم", "أخرى"];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <PageHeader
        title="الفنيون"
        description="إدارة الفنيين والمقاولين في المشاريع ومتابعة نسب الإنجاز والمستحقات"
        actions={
          <Button className="gap-2 cursor-pointer" onClick={() => { setEditingTechnician(null); setForm(initialForm); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            <span>فني جديد</span>
          </Button>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingTechnician ? "تعديل بيانات الفني" : "إضافة فني جديد"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الفني *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="أدخل اسم الفني"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="technician_type_id" className="text-xs font-bold">التخصص الفني *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary hover:text-primary/90 font-bold px-1.5 gap-1 cursor-pointer"
                    onClick={() => setIsAddTypeDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    <span>إضافة تخصص جديد</span>
                  </Button>
                </div>
                <Select
                  value={form.technician_type_id}
                  onValueChange={(value) => {
                    const selectedType = technicianTypes.find((t: any) => t.id === value);
                    setForm({ ...form, technician_type_id: value, specialty: selectedType?.name || "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التخصص الفني" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="max-h-60">
                    {technicianTypes.map((type: any) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_type">نظام العمل</Label>
                <Select
                  value={form.work_type}
                  onValueChange={(value: "hourly" | "daily" | "meter" | "piece") =>
                    setForm({ ...form, work_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نظام العمل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">بالساعة</SelectItem>
                    <SelectItem value="daily">باليوم</SelectItem>
                    <SelectItem value="meter">بالمتر</SelectItem>
                    <SelectItem value="piece">بالقطعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">أجر الساعة (د.ل)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily_rate">الأجر اليومي (د.ل)</Label>
                  <Input
                    id="daily_rate"
                    type="number"
                    value={form.daily_rate}
                    onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meter_rate">سعر المتر (د.ل)</Label>
                  <Input
                    id="meter_rate"
                    type="number"
                    value={form.meter_rate}
                    onChange={(e) => setForm({ ...form, meter_rate: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="piece_rate">سعر القطعة (د.ل)</Label>
                  <Input
                    id="piece_rate"
                    type="number"
                    value={form.piece_rate}
                    onChange={(e) => setForm({ ...form, piece_rate: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09xxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="example@mail.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "جاري الحفظ..." : editingTechnician ? "تحديث" : "إضافة"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      {/* Stats Cards - Dynamic from technician_types */}
      {technicianTypes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {technicianTypes.map((type: any) => {
            const count = technicians?.filter((t) => t.technician_type_id === type.id || t.specialty === type.name).length || 0;
            const IconComponent = getSpecialtyIcon(type.name);
            return (
              <Card key={type.id} className="p-4 bg-primary/5 border-primary/20">
                <div className="text-center">
                  <IconComponent className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground mb-1">{type.name}</p>
                  <p className="text-2xl font-bold text-primary">{count}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Technicians Grid */}
      {(!technicians || technicians.length === 0) ? (
        <EmptyState
          icon={Wrench}
          title="لا يوجد فنيون حتى الآن"
          description="ابدأ بإضافة أول فني إلى المنظومة لمتابعة أعماله في المشاريع ونسب الإنجاز والمستحقات."
          action={
            <Button
              className="gap-2 cursor-pointer"
              onClick={() => {
                setEditingTechnician(null);
                setForm(initialForm);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>إضافة فني جديد</span>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {technicians.map((tech) => {
          const typeName = (tech.technician_types as any)?.name || tech.specialty || "غير محدد";
          const IconComponent = getSpecialtyIcon(typeName);
          return (
            <Card key={tech.id} className="p-6 card-hover">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{tech.name}</h3>
                    <Badge variant="outline" className={specialtyColors[typeName] || "bg-primary/10 text-primary border-primary/20"}>
                      {typeName}
                    </Badge>
                  </div>
                  <IconComponent className="h-8 w-8 text-primary/40" />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{tech.phone || "غير محدد"}</span>
                  </div>
                </div>

                {(() => {
                  const stats = technicianStats.get(tech.id);
                  return (
                    <div className="space-y-3 pt-4 border-t border-border">
                      {/* Financial Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">قيمة الأعمال</p>
                          <p className="text-sm font-bold text-foreground">
                            {formatCurrencyLYD(stats?.totalWorkValue || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {(stats?.signedBalance || 0) > 0
                              ? "المتبقي"
                              : (stats?.signedBalance || 0) < 0
                              ? "رصيد مقدم"
                              : "الرصيد"}
                          </p>
                          <p className={`text-sm font-bold ${(stats?.signedBalance || 0) > 0 ? 'text-green-500' : (stats?.signedBalance || 0) < 0 ? 'text-blue-500' : 'text-muted-foreground'}`}>
                            {(stats?.signedBalance || 0) !== 0 ? formatCurrencyLYD(Math.abs(stats?.signedBalance || 0)) : formatCurrencyLYD(0)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Last Work Info */}
                      <div className="space-y-1 text-xs">
                        {stats?.lastWorkDate && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>آخر عمل: {format(new Date(stats.lastWorkDate), "d MMM yyyy", { locale: ar })}</span>
                          </div>
                        )}
                        {stats?.lastWorkItem && (
                          <p className="text-muted-foreground truncate" title={stats.lastWorkItem}>
                            البند: {stats.lastWorkItem}
                          </p>
                        )}
                        {stats?.lastAddedDate && (
                          <p className="text-muted-foreground">
                            آخر إضافة: {format(new Date(stats.lastAddedDate), "d MMM yyyy", { locale: ar })}
                          </p>
                        )}
                        {!stats?.lastWorkDate && !stats?.lastAddedDate && (
                          <p className="text-muted-foreground text-center">لا يوجد سجل عمل</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2">
                  <Link to={`/technicians/${tech.id}`} state={{ returnTo: `${location.pathname}${location.search}` }} className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Eye className="h-4 w-4 ml-1" />
                      عرض
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(tech)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(tech.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      )}

      {/* INLINE ADD SPECIALTY DIALOG */}
      <Dialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span>إضافة تخصص فني جديد</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم التخصص *</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="مثال: فني كاميرات وشبكات"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الوصف (اختياري)</Label>
              <Input
                value={newTypeDesc}
                onChange={(e) => setNewTypeDesc(e.target.value)}
                placeholder="وصف مختصر لطبيعة العمل"
                className="text-xs h-9"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 text-xs h-8 font-bold"
                disabled={createTypeMutation.isPending || !newTypeName.trim()}
                onClick={() => createTypeMutation.mutate({ name: newTypeName.trim(), description: newTypeDesc.trim() })}
              >
                {createTypeMutation.isPending ? "جاري الحفظ..." : "حفظ التخصص"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-8"
                onClick={() => setIsAddTypeDialogOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Technicians;
