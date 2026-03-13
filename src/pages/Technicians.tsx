import { useState, useMemo } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Phone, Wrench, Zap, Droplet, Hammer, Ruler, Edit, Trash2, Eye, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyLYD } from "@/lib/currency";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface TechnicianForm {
  name: string;
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
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<string | null>(null);
  const [form, setForm] = useState<TechnicianForm>(initialForm);

  const { data: technicians, isLoading } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all progress records for technicians
  const { data: allProgressRecords } = useQuery({
    queryKey: ["all-technicians-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_progress_records")
        .select(`
          *,
          project_item:project_items(
            id,
            name,
            project_id
          )
        `)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all technician rates (project_item_technicians)
  const { data: allTechnicianRates } = useQuery({
    queryKey: ["all-technicians-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_item_technicians")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all expenses for technicians
  const { data: allExpenses } = useQuery({
    queryKey: ["all-technicians-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .not("technician_id", "is", null);
      if (error) throw error;
      return data;
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

  // Calculate technician stats (dues, debt, last work)
  const technicianStats = useMemo(() => {
    const statsMap = new Map<string, {
      totalDeserved: number;
      totalWithdrawn: number;
      balance: number;
      lastWorkDate: string | null;
      lastWorkItem: string | null;
      lastAddedDate: string | null;
    }>();

    technicians?.forEach((tech) => {
      // Get rates for this technician
      const techRates = allTechnicianRates?.filter((r) => r.technician_id === tech.id) || [];
      const ratesMap = new Map<string, number>();
      techRates.forEach((r) => {
        ratesMap.set(r.project_item_id, r.rate || 0);
      });

      // Get progress records for this technician
      const techProgress = allProgressRecords?.filter((p) => p.technician_id === tech.id) || [];
      
      // Calculate total deserved
      let totalDeserved = 0;
      techProgress.forEach((record) => {
        const rate = ratesMap.get(record.project_item_id) || 0;
        totalDeserved += record.quantity_completed * rate;
      });

      // Get expenses (withdrawn) for this technician
      const techExpenses = allExpenses?.filter((e) => e.technician_id === tech.id) || [];
      const totalWithdrawn = techExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      // Get last work (most recent progress record)
      const lastWork = techProgress[0];
      
      // Get last added date (from technician rates - when they were assigned to items)
      const lastRate = techRates.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      statsMap.set(tech.id, {
        totalDeserved,
        totalWithdrawn,
        balance: totalDeserved - totalWithdrawn,
        lastWorkDate: lastWork?.date || null,
        lastWorkItem: lastWork?.project_item?.name || null,
        lastAddedDate: lastRate?.created_at || null,
      });
    });

    return statsMap;
  }, [technicians, allProgressRecords, allTechnicianRates, allExpenses]);

  const saveMutation = useMutation({
    mutationFn: async (data: TechnicianForm) => {
      const techData = {
        name: data.name,
        specialty: data.specialty,
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // SET NULL on expenses referencing this technician before delete
      await supabase.from("expenses").update({ technician_id: null }).eq("technician_id", id);

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

  if (isLoading) {
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">الفنيون</h1>
          <p className="text-muted-foreground">إدارة الفنيين والمقاولين في المشاريع</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-5 w-5" />
              فني جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
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
                <Label htmlFor="specialty">التخصص</Label>
                <Select
                  value={form.specialty}
                  onValueChange={(value) => setForm({ ...form, specialty: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التخصص" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
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
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-5">
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="text-center">
            <Hammer className="h-6 w-6 mx-auto mb-2 text-amber-500" />
            <p className="text-sm text-muted-foreground mb-1">نجارون</p>
            <p className="text-2xl font-bold text-amber-500">{stats?.["نجار"] || 0}</p>
          </div>
        </Card>
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/30">
          <div className="text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
            <p className="text-sm text-muted-foreground mb-1">كهربائيون</p>
            <p className="text-2xl font-bold text-yellow-500">{stats?.["كهربائي"] || 0}</p>
          </div>
        </Card>
        <Card className="p-4 bg-blue-500/10 border-blue-500/30">
          <div className="text-center">
            <Droplet className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-sm text-muted-foreground mb-1">سباكون</p>
            <p className="text-2xl font-bold text-blue-500">{stats?.["سباك"] || 0}</p>
          </div>
        </Card>
        <Card className="p-4 bg-gray-500/10 border-gray-500/30">
          <div className="text-center">
            <Wrench className="h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground mb-1">حدادون</p>
            <p className="text-2xl font-bold text-gray-400">{stats?.["حداد"] || 0}</p>
          </div>
        </Card>
        <Card className="p-4 bg-orange-500/10 border-orange-500/30">
          <div className="text-center">
            <Ruler className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <p className="text-sm text-muted-foreground mb-1">بنّاؤون</p>
            <p className="text-2xl font-bold text-orange-500">{stats?.["بنّاء"] || 0}</p>
          </div>
        </Card>
      </div>

      {/* Technicians Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {technicians?.map((tech) => {
          const IconComponent = getSpecialtyIcon(tech.specialty || "");
          return (
            <Card key={tech.id} className="p-6 card-hover">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{tech.name}</h3>
                    <Badge variant="outline" className={specialtyColors[tech.specialty || ""]}>
                      {tech.specialty || "غير محدد"}
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
                          <p className="text-xs text-muted-foreground mb-1">المستحقات</p>
                          <p className="text-sm font-bold text-green-500">
                            {formatCurrencyLYD(stats?.totalDeserved || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">الدين</p>
                          <p className={`text-sm font-bold ${(stats?.balance || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrencyLYD(stats?.balance || 0)}
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
                  <Link to={`/technicians/${tech.id}`} className="flex-1">
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف هذا الفني؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(tech.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Technicians;
