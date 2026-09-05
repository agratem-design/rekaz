import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Phone,
  Mail,
  Wrench,
  Zap,
  Droplet,
  Hammer,
  Ruler,
  Paintbrush,
  Layers,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Search,
  Printer,
  LayoutGrid,
  List,
  Coins,
  CheckCircle2,
  AlertCircle,
  Wallet,
  HardHat,
  Filter,
  UserCog,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow } from "@/lib/printStyles";
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

const workTypeLabels: Record<string, string> = {
  daily: "يومي",
  meter: "بالمتر",
  piece: "بالقطعة",
  hourly: "بالساعة",
};

const getTechWorkType = (tech: any): "meter" | "piece" | "hourly" | "daily" => {
  if (tech?.meter_rate != null && Number(tech.meter_rate) > 0) return "meter";
  if (tech?.piece_rate != null && Number(tech.piece_rate) > 0) return "piece";
  if (tech?.hourly_rate != null && Number(tech.hourly_rate) > 0) return "hourly";
  return "daily";
};

export default function Technicians() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<string | null>(null);
  const [form, setForm] = useState<TechnicianForm>(initialForm);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [technicianToDelete, setTechnicianToDelete] = useState<{ id: string; name: string } | null>(null);

  // Inline Specialty Create State
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "has_dues" | "settled" | "credit">("all");
  const [workTypeFilter, setWorkTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    return (localStorage.getItem("technicians_view_mode") as "grid" | "table") || "grid";
  });

  const handleSetViewMode = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("technicians_view_mode", mode);
  };

  // Queries
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

  const { data: allTechnicianRates, error: ratesError } = useQuery({
    queryKey: ["all-technicians-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_item_technicians")
        .select(`*, project_items (id, name)`);
      if (error) throw error;
      return data;
    },
  });

  const { data: allLaborPurchases = [], isLoading: loadingLabor, error: laborError } = useQuery({
    queryKey: ["all-technician-labor-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("technician_id, total_amount")
        .not("technician_id", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

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

  const { data: allDirectPayments = [], isLoading: loadingDirect, error: directError } = useQuery<
    Array<{ id: string; technician_id: string; amount: number; status: string }>
  >({
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
      const { data, error } = await supabase
        .from("purchase_payments")
        .select("amount, purchases!inner(technician_id)")
        .not("purchases.technician_id", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Calculate technician stats (work value, paid, signed balance, last work)
  const technicianStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        totalWorkValue: number;
        totalPaid: number;
        signedBalance: number;
        lastWorkItem: string | null;
        lastWorkDate: string | null;
        lastAddedDate: string | null;
      }
    >();

    technicians?.forEach((tech) => {
      const techRates = allTechnicianRates?.filter((r) => r.technician_id === tech.id) || [];
      const laborWorks = allLaborPurchases.filter((work) => work.technician_id === tech.id);
      const totalWorkValue =
        techRates.reduce((sum, r) => {
          const rawCost = Number(r.total_cost);
          const wVal = rawCost > 0 ? rawCost : Number(r.rate || 0) * Number(r.quantity ?? 1);
          return sum + wVal;
        }, 0) + laborWorks.reduce((sum, work) => sum + Number(work.total_amount || 0), 0);

      const techExpenses = allExpenses?.filter((e) => e.technician_id === tech.id) || [];
      const totalExpensesPaid = techExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      const techDirectPayments = allDirectPayments?.filter((dp: any) => dp.technician_id === tech.id) || [];
      const totalDirectPaid = techDirectPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);

      const totalInvoicePaid = laborInvoicePayments
        .filter((payment) => payment.purchases.technician_id === tech.id)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const totalPaid = totalExpensesPaid + totalDirectPaid + totalInvoicePaid;
      const signedBalance = totalWorkValue - totalPaid;

      const lastRate = techRates.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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

  // Global KPIs
  const globalKPIs = useMemo(() => {
    let totalWork = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let withOutstandingCount = 0;

    technicians?.forEach((tech) => {
      const s = technicianStats.get(tech.id);
      if (s) {
        totalWork += s.totalWorkValue;
        totalPaid += s.totalPaid;
        if (s.signedBalance > 0.01) {
          totalRemaining += s.signedBalance;
          withOutstandingCount++;
        }
      }
    });

    return {
      totalCount: technicians?.length || 0,
      totalWork,
      totalPaid,
      totalRemaining,
      withOutstandingCount,
    };
  }, [technicians, technicianStats]);

  // Filtered Technicians
  const filteredTechnicians = useMemo(() => {
    if (!technicians) return [];
    const q = searchQuery.toLowerCase().trim();

    return technicians.filter((tech) => {
      // Specialty filter
      const typeName = (tech.technician_types as any)?.name || tech.specialty || "";
      if (selectedSpecialty !== "all" && typeName !== selectedSpecialty) {
        return false;
      }

      // Work type filter
      const techWorkType = getTechWorkType(tech);
      if (workTypeFilter !== "all" && techWorkType !== workTypeFilter) {
        return false;
      }

      // Status filter
      const stats = technicianStats.get(tech.id);
      const balance = stats?.signedBalance || 0;
      if (statusFilter === "has_dues" && balance <= 0.01) return false;
      if (statusFilter === "settled" && Math.abs(balance) > 0.01) return false;
      if (statusFilter === "credit" && balance >= -0.01) return false;

      // Search query
      if (!q) return true;
      const matchName = tech.name?.toLowerCase().includes(q);
      const matchPhone = tech.phone?.toLowerCase().includes(q);
      const matchSpecialty = typeName.toLowerCase().includes(q);
      const matchNotes = tech.notes?.toLowerCase().includes(q);
      return matchName || matchPhone || matchSpecialty || matchNotes;
    });
  }, [technicians, searchQuery, selectedSpecialty, statusFilter, workTypeFilter, technicianStats]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: TechnicianForm) => {
      const selectedType = technicianTypes.find((t: any) => t.id === data.technician_type_id);
      const techData = {
        name: data.name.trim(),
        technician_type_id: data.technician_type_id || null,
        specialty: selectedType?.name || null,
        phone: data.phone || null,
        email: data.email || null,
        hourly_rate: data.work_type === "hourly" && data.hourly_rate ? parseFloat(data.hourly_rate) : null,
        daily_rate: data.work_type === "daily" && data.daily_rate ? parseFloat(data.daily_rate) : null,
        meter_rate: data.work_type === "meter" && data.meter_rate ? parseFloat(data.meter_rate) : null,
        piece_rate: data.work_type === "piece" && data.piece_rate ? parseFloat(data.piece_rate) : null,
        notes: data.notes || null,
      };

      if (editingTechnician) {
        const { error } = await supabase.from("technicians").update(techData).eq("id", editingTechnician);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("technicians").insert(techData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-stats"] });
      toast.success(editingTechnician ? "تم تحديث بيانات الفني بنجاح" : "تمت إضافة الفني بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ بيانات الفني");
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
      setDeleteDialogOpen(false);
      setTechnicianToDelete(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الفني");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTechnician(null);
    setForm(initialForm);
  };

  const handleEdit = (tech: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
      work_type: tech.work_type || (tech.meter_rate ? "meter" : tech.piece_rate ? "piece" : tech.hourly_rate ? "hourly" : "daily"),
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (tech: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTechnicianToDelete({ id: tech.id, name: tech.name });
    setDeleteDialogOpen(true);
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
      نجار: Hammer,
      كهربائي: Zap,
      سباك: Droplet,
      حداد: Wrench,
      بنّاء: Ruler,
      دهّان: Paintbrush,
      بلّاط: Layers,
    };
    return icons[specialty] || HardHat;
  };

  // Overall Print handler
  const handlePrintReport = () => {
    if (!filteredTechnicians.length) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }

    const rowsHtml = filteredTechnicians
      .map((tech, idx) => {
        const stats = technicianStats.get(tech.id);
        const typeName = (tech.technician_types as any)?.name || tech.specialty || "عام";
        const workValue = stats?.totalWorkValue || 0;
        const paid = stats?.totalPaid || 0;
        const balance = stats?.signedBalance || 0;
        const workType = getTechWorkType(tech);
        const workTypeLabel = workTypeLabels[workType] || "يومي";

        return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-weight: bold;">${tech.name}</td>
            <td style="text-align: center;">${typeName}</td>
            <td style="text-align: center; direction: ltr;">${tech.phone || "-"}</td>
            <td style="text-align: center;">${workTypeLabel}</td>
            <td style="text-align: left; font-family: monospace;">${formatCurrencyLYD(workValue)}</td>
            <td style="text-align: left; font-family: monospace; color: #16a34a;">${formatCurrencyLYD(paid)}</td>
            <td style="text-align: left; font-family: monospace; font-weight: bold; color: ${
              balance > 0 ? "#dc2626" : balance < 0 ? "#2563eb" : "#4b5563"
            };">
              ${
                balance > 0
                  ? formatCurrencyLYD(balance)
                  : balance < 0
                  ? `(${formatCurrencyLYD(Math.abs(balance))}) رصيد مقدم`
                  : "0.000 د.ل"
              }
            </td>
          </tr>
        `;
      })
      .join("");

    const totalsWork = filteredTechnicians.reduce(
      (sum, t) => sum + (technicianStats.get(t.id)?.totalWorkValue || 0),
      0
    );
    const totalsPaid = filteredTechnicians.reduce(
      (sum, t) => sum + (technicianStats.get(t.id)?.totalPaid || 0),
      0
    );
    const totalsRemaining = filteredTechnicians.reduce(
      (sum, t) => sum + (technicianStats.get(t.id)?.signedBalance || 0),
      0
    );

    const printHTML = `
      <div style="margin-bottom: 16px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 6px; text-align: center;">كشف الفنيين والعمال والمستحقات المالية</h2>
        <p style="text-align: center; color: #666; font-size: 12px; margin: 0;">تاريخ التقرير: ${format(
          new Date(),
          "dd MMMM yyyy",
          { locale: ar }
        )} - إجمالي الكادر: ${filteredTechnicians.length} فني</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 8px; border: 1px solid #e5e7eb; width: 40px; text-align: center;">#</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">اسم الفني / المقاول</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">التخصص</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">رقم الهاتف</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">نظام العمل</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">قيمة الأعمال</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">المسدد</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">الرصيد المتبقي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9fafb; font-weight: bold; border-top: 2px solid #d1d5db;">
            <td colspan="5" style="padding: 10px; text-align: center; font-size: 12px;">الإجمالي العام</td>
            <td style="padding: 10px; text-align: left; font-family: monospace;">${formatCurrencyLYD(totalsWork)}</td>
            <td style="padding: 10px; text-align: left; font-family: monospace; color: #16a34a;">${formatCurrencyLYD(
              totalsPaid
            )}</td>
            <td style="padding: 10px; text-align: left; font-family: monospace; color: #dc2626;">${formatCurrencyLYD(
              totalsRemaining
            )}</td>
          </tr>
        </tfoot>
      </table>
    `;

    openPrintWindow("كشف الفنيين والعمال الإجمالي", printHTML, companySettings);
  };

  if (techniciansError || ratesError || laborError || expensesError || directError || invoicesError) {
    return (
      <Card className="p-6 space-y-3" dir="rtl" role="alert">
        <p className="font-bold text-destructive">تعذر تحميل بيانات الفنيين وحساباتهم المالية كاملة.</p>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
          إعادة المحاولة
        </Button>
      </Card>
    );
  }

  if (isLoading || loadingLabor || loadingDirect || loadingInvoices || !allExpenses || !allTechnicianRates) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm font-medium">جاري تحميل سجلات الفنيين والمستحقات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <PageHeader
        title="الفنيون والعمالة"
        description="إدارة طاقم الفنيين والمقاولين ومتابعة تكاليف الإنجاز والمسدد والمستحقات المالية"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="gap-2 cursor-pointer border-border hover:bg-accent"
            >
              <Printer className="h-4 w-4 text-primary" />
              <span>طباعة الكشف العام</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddTypeDialogOpen(true)}
              className="gap-2 cursor-pointer border-primary/30 hover:bg-primary/10 text-foreground"
            >
              <Wrench className="h-4 w-4 text-primary" />
              <span>إدارة التخصصات</span>
            </Button>
            <Button
              size="sm"
              className="gap-2 cursor-pointer font-bold shadow-xs"
              onClick={() => {
                setEditingTechnician(null);
                setForm(initialForm);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>فني / عامل جديد</span>
            </Button>
          </div>
        }
      />

      {/* 1. Global KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card
          onClick={() => setStatusFilter("all")}
          className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-xs p-4 bg-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الفنيين والعمال</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HardHat className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">{globalKPIs.totalCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">طاقم العمل المسجل في المنظومة</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">قيمة الأعمال المنفذة</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Coins className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">
            {formatCurrencyLYD(globalKPIs.totalWork)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">إجمالي العقود والبنود المنجزة</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي المستحقات المسددة</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrencyLYD(globalKPIs.totalPaid)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">المبالغ المدفوعة نقدياً ومصرفياً</p>
        </Card>

        <Card
          onClick={() => setStatusFilter("has_dues")}
          className={`cursor-pointer transition-all hover:shadow-xs p-4 border-2 ${
            globalKPIs.totalRemaining > 0
              ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
              : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">الذمم المستحقة (المتبقية)</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {formatCurrencyLYD(globalKPIs.totalRemaining)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {globalKPIs.withOutstandingCount > 0
              ? `${globalKPIs.withOutstandingCount} فني بانتظار استلام مستحقاتهم (انقر للتصفية)`
              : "كافة الحسابات مسواة بالكامل"}
          </p>
        </Card>
      </div>

      {/* 2. Specialty Quick Filter Pills */}
      {technicianTypes.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          <Button
            type="button"
            variant={selectedSpecialty === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSpecialty("all")}
            className="h-8 text-xs font-bold gap-1.5 shrink-0 rounded-full px-3.5 cursor-pointer"
          >
            <HardHat className="h-3.5 w-3.5" />
            <span>الكل</span>
            <Badge
              variant={selectedSpecialty === "all" ? "secondary" : "outline"}
              className="mr-1 px-1.5 py-0 text-[10px] h-4 min-w-4 flex items-center justify-center font-bold"
            >
              {technicians?.length || 0}
            </Badge>
          </Button>

          {technicianTypes.map((type: any) => {
            const count =
              technicians?.filter(
                (t) => t.technician_type_id === type.id || t.specialty === type.name
              ).length || 0;
            const IconComp = getSpecialtyIcon(type.name);
            const isSelected = selectedSpecialty === type.name;

            return (
              <Button
                key={type.id}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSpecialty(isSelected ? "all" : type.name)}
                className="h-8 text-xs font-medium gap-1.5 shrink-0 rounded-full px-3.5 cursor-pointer"
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>{type.name}</span>
                <span
                  className={`mr-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {/* 3. Search, Filter Controls & View Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border shadow-xs">
        {/* Search Input with right icon */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الفني، رقم الهاتف، أو التخصص..."
            className="pr-9 h-10 text-xs bg-background"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val: any) => setStatusFilter(val)}
          >
            <SelectTrigger className="h-10 text-xs font-semibold w-[150px] bg-background">
              <SelectValue placeholder="حالة الرصيد" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كل الحالات المالية</SelectItem>
              <SelectItem value="has_dues">مستحقات قائمة</SelectItem>
              <SelectItem value="settled">رصيد مسوّى (0)</SelectItem>
              <SelectItem value="credit">رصيد مقدم (فائض)</SelectItem>
            </SelectContent>
          </Select>

          {/* Work Type Filter */}
          <Select
            value={workTypeFilter}
            onValueChange={(val) => setWorkTypeFilter(val)}
          >
            <SelectTrigger className="h-10 text-xs font-semibold w-[140px] bg-background">
              <SelectValue placeholder="نظام العمل" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كل أنظمة العمل</SelectItem>
              <SelectItem value="daily">باليوم</SelectItem>
              <SelectItem value="meter">بالمتر</SelectItem>
              <SelectItem value="piece">بالقطعة</SelectItem>
              <SelectItem value="hourly">بالساعة</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40 shrink-0">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md cursor-pointer"
              onClick={() => handleSetViewMode("grid")}
              title="عرض البطاقات"
              aria-label="عرض البطاقات"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-md cursor-pointer"
              onClick={() => handleSetViewMode("table")}
              title="عرض الجدول التفصيلي"
              aria-label="عرض الجدول التفصيلي"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Content Area: Grid View vs Table View */}
      {filteredTechnicians.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title={
            searchQuery || selectedSpecialty !== "all" || statusFilter !== "all"
              ? "لا يوجد فنيون يطابقون شروط البحث"
              : "لا يوجد فنيون حتى الآن"
          }
          description={
            searchQuery || selectedSpecialty !== "all" || statusFilter !== "all"
              ? "جرب تعديل كلمات البحث أو تصفية التخصصات لعرض النتائج."
              : "ابدأ بإضافة أول فني إلى المنظومة لمتابعة أعماله في المشاريع ونسب الإنجاز والمستحقات."
          }
          action={
            searchQuery || selectedSpecialty !== "all" || statusFilter !== "all" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSpecialty("all");
                  setStatusFilter("all");
                  setWorkTypeFilter("all");
                }}
                className="cursor-pointer gap-2"
              >
                <span>مسح كل الفلاتر</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2 cursor-pointer font-bold"
                onClick={() => {
                  setEditingTechnician(null);
                  setForm(initialForm);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span>إضافة فني جديد</span>
              </Button>
            )
          }
        />
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <Card className="overflow-hidden border-border shadow-xs">
          <div className="overflow-x-auto">
            <Table dir="rtl">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="min-w-[200px]">الفني / المقاول</TableHead>
                  <TableHead className="min-w-[120px]">التخصص</TableHead>
                  <TableHead className="min-w-[130px]">رقم الهاتف</TableHead>
                  <TableHead className="min-w-[120px]">نظام العمل والأجر</TableHead>
                  <TableHead className="text-left min-w-[120px]">قيمة الأعمال</TableHead>
                  <TableHead className="text-left min-w-[120px]">المسدد</TableHead>
                  <TableHead className="text-left min-w-[130px]">الرصيد المتبقي</TableHead>
                  <TableHead className="min-w-[150px]">آخر عمل مسجل</TableHead>
                  <TableHead className="w-[120px] text-center">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTechnicians.map((tech, idx) => {
                  const stats = technicianStats.get(tech.id);
                  const typeName = (tech.technician_types as any)?.name || tech.specialty || "عام";
                  const workValue = stats?.totalWorkValue || 0;
                  const paid = stats?.totalPaid || 0;
                  const balance = stats?.signedBalance || 0;
                  const workType = getTechWorkType(tech);
                  const rateValue =
                    workType === "meter"
                      ? tech.meter_rate
                      : workType === "piece"
                      ? tech.piece_rate
                      : workType === "hourly"
                      ? tech.hourly_rate
                      : tech.daily_rate;

                  return (
                    <TableRow key={tech.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-medium text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/technicians/${tech.id}`}
                          state={{ returnTo: `${location.pathname}${location.search}` }}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <span>{tech.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                          {typeName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tech.phone ? (
                          <a
                            href={`tel:${tech.phone}`}
                            className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center gap-1"
                            dir="ltr"
                          >
                            <Phone className="h-3 w-3 text-primary shrink-0" />
                            <span>{tech.phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-foreground">{workTypeLabels[workType] || "يومي"}</span>
                        {rateValue ? (
                          <span className="text-muted-foreground mr-1">({formatCurrencyLYD(Number(rateValue))})</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-left font-mono text-xs font-bold text-foreground">
                        {formatCurrencyLYD(workValue)}
                      </TableCell>
                      <TableCell className="text-left font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyLYD(paid)}
                      </TableCell>
                      <TableCell className="text-left">
                        {balance > 0.01 ? (
                          <Badge variant="destructive" className="font-mono text-xs font-bold">
                            {formatCurrencyLYD(balance)}
                          </Badge>
                        ) : balance < -0.01 ? (
                          <Badge variant="secondary" className="font-mono text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400">
                            {formatCurrencyLYD(Math.abs(balance))} (مقدم)
                          </Badge>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">مسوّى (0.000)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {stats?.lastWorkDate ? (
                          <div className="space-y-0.5">
                            <span className="block truncate max-w-[130px]" title={stats.lastWorkItem || ""}>
                              {stats.lastWorkItem || "عمل فني"}
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">
                              {format(new Date(stats.lastWorkDate), "dd MMM yyyy", { locale: ar })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/technicians/${tech.id}`}
                            state={{ returnTo: `${location.pathname}${location.search}` }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors"
                            title="عرض كشف الحساب"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer hover:bg-muted"
                            onClick={(e) => handleEdit(tech, e)}
                            title="تعديل البيانات"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDeleteClick(tech, e)}
                            title="حذف الفني"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* GRID VIEW (CARDS) */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTechnicians.map((tech) => {
            const typeName = (tech.technician_types as any)?.name || tech.specialty || "عام";
            const IconComp = getSpecialtyIcon(typeName);
            const stats = technicianStats.get(tech.id);
            const workValue = stats?.totalWorkValue || 0;
            const paid = stats?.totalPaid || 0;
            const balance = stats?.signedBalance || 0;
            const workType = getTechWorkType(tech);
            const rateValue =
              workType === "meter"
                ? tech.meter_rate
                : workType === "piece"
                ? tech.piece_rate
                : workType === "hourly"
                ? tech.hourly_rate
                : tech.daily_rate;

            return (
              <Card
                key={tech.id}
                className="p-5 flex flex-col justify-between transition-all duration-200 hover:border-primary/50 hover:shadow-md bg-card"
              >
                <div className="space-y-3.5">
                  {/* Card Header: Specialty & Action Icons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-foreground truncate">{tech.name}</h3>
                        <Badge
                          variant="outline"
                          className="mt-0.5 text-[10px] px-2 py-0 border-primary/20 bg-primary/5 text-primary font-bold"
                        >
                          {typeName}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={(e) => handleEdit(tech, e)}
                        title="تعديل"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={(e) => handleDeleteClick(tech, e)}
                        title="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-1">
                    {tech.phone ? (
                      <a
                        href={`tel:${tech.phone}`}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors font-mono"
                        dir="ltr"
                      >
                        <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{tech.phone}</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground/60">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>لا يوجد هاتف مسجل</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground font-medium">نظام العمل:</span>
                      <span className="font-semibold text-foreground">
                        {workTypeLabels[workType] || "يومي"}
                        {rateValue ? ` (${formatCurrencyLYD(Number(rateValue))})` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Financial KPI Summary Box */}
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">قيمة الأعمال:</span>
                      <span className="font-mono font-bold text-foreground">{formatCurrencyLYD(workValue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">المسدد له:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyLYD(paid)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-foreground">الرصيد:</span>
                      {balance > 0.01 ? (
                        <Badge variant="destructive" className="font-mono text-xs font-bold px-2 py-0.5">
                          {formatCurrencyLYD(balance)} متبقي
                        </Badge>
                      ) : balance < -0.01 ? (
                        <Badge variant="secondary" className="font-mono text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5">
                          {formatCurrencyLYD(Math.abs(balance))} (مقدم)
                        </Badge>
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">مسوّى بالكامل</span>
                      )}
                    </div>
                  </div>

                  {/* Last Activity Stamp */}
                  <div className="text-[11px] text-muted-foreground/80 flex items-center justify-between">
                    <span className="truncate max-w-[150px]" title={stats?.lastWorkItem || ""}>
                      {stats?.lastWorkItem ? `البند: ${stats.lastWorkItem}` : "لا يوجد سجل أعمال"}
                    </span>
                    {stats?.lastWorkDate && (
                      <span className="shrink-0 text-[10px]">
                        {format(new Date(stats.lastWorkDate), "dd MMM yyyy", { locale: ar })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Link */}
                <div className="mt-4 pt-3 border-t border-border">
                  <Button asChild variant="outline" size="sm" className="w-full text-xs font-bold gap-1.5 h-9 cursor-pointer">
                    <Link
                      to={`/technicians/${tech.id}`}
                      state={{ returnTo: `${location.pathname}${location.search}` }}
                    >
                      <Eye className="h-4 w-4 text-primary" />
                      <span>عرض كشف الحساب والملف المالي</span>
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT TECHNICIAN DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              <span>{editingTechnician ? "تعديل بيانات الفني" : "إضافة فني / عامل جديد"}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold">اسم الفني / العامل *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="أدخل الاسم الكامل"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
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
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="اختر التخصص الفني" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="max-h-60">
                    {technicianTypes.map((type: any) => (
                      <SelectItem key={type.id} value={type.id} className="text-xs">
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09xxxxxxxx"
                    className="h-9 text-xs font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">البريد الإلكتروني (اختياري)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@example.com"
                    className="h-9 text-xs"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Work Type & Rates Section */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="work_type" className="text-xs font-bold">نظام العمل الأساسي</Label>
                <Select
                  value={form.work_type}
                  onValueChange={(value: "hourly" | "daily" | "meter" | "piece") =>
                    setForm({ ...form, work_type: value })
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="اختر نظام العمل" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="daily">باليوم (يومية)</SelectItem>
                    <SelectItem value="meter">بالمتر (متر طولي / مربع / مكعب)</SelectItem>
                    <SelectItem value="piece">بالقطعة (إنتاجية)</SelectItem>
                    <SelectItem value="hourly">بالساعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="daily_rate" className="text-[11px] font-semibold">الأجر اليومي (د.ل)</Label>
                  <Input
                    id="daily_rate"
                    type="number"
                    value={form.daily_rate}
                    onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                    placeholder="0.00"
                    className={`h-8 text-xs font-mono ${form.work_type === "daily" ? "border-primary ring-1 ring-primary/30" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="meter_rate" className="text-[11px] font-semibold">سعر المتر (د.ل)</Label>
                  <Input
                    id="meter_rate"
                    type="number"
                    value={form.meter_rate}
                    onChange={(e) => setForm({ ...form, meter_rate: e.target.value })}
                    placeholder="0.00"
                    className={`h-8 text-xs font-mono ${form.work_type === "meter" ? "border-primary ring-1 ring-primary/30" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="piece_rate" className="text-[11px] font-semibold">سعر القطعة (د.ل)</Label>
                  <Input
                    id="piece_rate"
                    type="number"
                    value={form.piece_rate}
                    onChange={(e) => setForm({ ...form, piece_rate: e.target.value })}
                    placeholder="0.00"
                    className={`h-8 text-xs font-mono ${form.work_type === "piece" ? "border-primary ring-1 ring-primary/30" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hourly_rate" className="text-[11px] font-semibold">أجر الساعة (د.ل)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    value={form.hourly_rate}
                    onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                    placeholder="0.00"
                    className={`h-8 text-xs font-mono ${form.work_type === "hourly" ? "border-primary ring-1 ring-primary/30" : ""}`}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">ملاحظات إضافية</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات حول المهارات، الخبرات السابقة..."
                rows={2}
                className="text-xs"
              />
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button type="submit" className="flex-1 font-bold text-xs h-9 cursor-pointer" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "جاري الحفظ..." : editingTechnician ? "حفظ التعديلات" : "إضافة الفني"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="text-xs h-9 cursor-pointer">
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                className="flex-1 text-xs h-8 font-bold cursor-pointer"
                disabled={createTypeMutation.isPending || !newTypeName.trim()}
                onClick={() =>
                  createTypeMutation.mutate({ name: newTypeName.trim(), description: newTypeDesc.trim() })
                }
              >
                {createTypeMutation.isPending ? "جاري الحفظ..." : "حفظ التخصص"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-8 cursor-pointer"
                onClick={() => setIsAddTypeDialogOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>تأكيد حذف الفني</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground pt-1">
              هل أنت متأكد من رغبتك في حذف بيانات الفني{" "}
              <strong className="text-foreground">{technicianToDelete?.name}</strong> نهائياً من المنظومة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs cursor-pointer">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold cursor-pointer"
              onClick={() => technicianToDelete && deleteMutation.mutate(technicianToDelete.id)}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "نعم، حذف الفني"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
