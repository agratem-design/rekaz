import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow } from "@/lib/printStyles";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Plus,
  Phone,
  Mail,
  Truck,
  Building,
  ShoppingCart,
  FolderOpen,
  Edit,
  Trash2,
  Settings,
  Sparkles,
  Printer,
  LayoutGrid,
  List,
  Search,
  MapPin,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  Coins,
  Wallet,
  Hammer,
  Zap,
  Droplets,
  Paintbrush,
  Layers,
  HardHat,
  Package,
  ChevronLeft,
  X,
  ExternalLink,
} from "lucide-react";

const paymentStatusLabels: Record<string, { label: string; color: string; border: string }> = {
  paid: { 
    label: "مسدد بالكامل", 
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", 
    border: "border-emerald-500/30" 
  },
  partial: { 
    label: "مدفوع جزئياً", 
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", 
    border: "border-amber-500/30" 
  },
  processing: { 
    label: "قيد المعالجة", 
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", 
    border: "border-blue-500/30" 
  },
  due: { 
    label: "مستحق بذمة الشركة", 
    color: "bg-destructive/10 text-destructive border-destructive/20", 
    border: "border-destructive/30" 
  },
  zero: { 
    label: "لا توجد مطالبات", 
    color: "bg-muted text-muted-foreground border-border", 
    border: "border-border" 
  },
};

const translateCategory = (cat: string | null): string => {
  if (!cat) return "";
  const map: Record<string, string> = {
    supplier: "مورد مواد",
    labor: "عمالة / مقاول",
  };
  return map[cat.toLowerCase()] || cat;
};

const getCategoryIcon = (category: string | null) => {
  if (!category) return Package;
  const cat = category.toLowerCase();
  if (cat.includes("بناء") || cat.includes("اسمنت") || cat.includes("طوب")) return Building;
  if (cat.includes("حديد") || cat.includes("معدن")) return Hammer;
  if (cat.includes("كهرباء") || cat.includes("انارة")) return Zap;
  if (cat.includes("صحية") || cat.includes("سباكة") || cat.includes("مياه")) return Droplets;
  if (cat.includes("دهان") || cat.includes("بويات")) return Paintbrush;
  if (cat.includes("خشب") || cat.includes("نجارة")) return Layers;
  if (cat.includes("عمال") || cat.includes("مقاول") || cat.includes("labor")) return HardHat;
  if (cat.includes("نقل") || cat.includes("شحن")) return Truck;
  return Package;
};

interface SupplierForm {
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const initialForm: SupplierForm = {
  name: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function Suppliers() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(initialForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

  // Search, Filter & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "has_dues" | "settled" | "credit">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    return (localStorage.getItem("suppliers_view_mode") as "grid" | "table") || "grid";
  });

  const handleSetViewMode = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("suppliers_view_mode", mode);
  };

  // 1. Fetch Suppliers
  const { data: suppliers, isLoading: loadingSuppliers, error: suppliersError } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch purchases and authoritative payments to calculate stats per supplier
  const { data: purchaseStats, isLoading: loadingStats, error: statsError } = useQuery({
    queryKey: ["supplier-purchase-stats"],
    queryFn: async () => {
      const [purchasesRes, paymentsRes, allocationsRes] = await Promise.all([
        supabase
          .from("purchases")
          .select(`
            id,
            supplier_id,
            total_amount,
            project_id,
            projects (
              client_id,
              project_type
            )
          `),
        supabase.from("purchase_payments").select("purchase_id, amount"),
        supabase.from("supplier_payment_allocations").select("purchase_id, amount"),
      ]);
      
      if (purchasesRes.error) throw purchasesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (allocationsRes.error) throw allocationsRes.error;

      // Build payment map by purchase_id from authoritative payment & allocation tables
      const paidByPurchase = new Map<string, number>();
      paymentsRes.data?.forEach((pp) => {
        if (pp.purchase_id) {
          paidByPurchase.set(pp.purchase_id, (paidByPurchase.get(pp.purchase_id) || 0) + Number(pp.amount || 0));
        }
      });
      allocationsRes.data?.forEach((spa) => {
        if (spa.purchase_id) {
          paidByPurchase.set(spa.purchase_id, (paidByPurchase.get(spa.purchase_id) || 0) + Number(spa.amount || 0));
        }
      });
      
      // Group by supplier
      const stats: Record<string, { 
        purchaseCount: number; 
        clientCount: number; 
        projectCount: number;
        totalAmount: number;
        paidAmount: number;
        contractingAmount: number;
        contractingPaid: number;
        finishingAmount: number;
        finishingPaid: number;
        clients: Set<string>;
        projects: Set<string>;
      }> = {};
      
      purchasesRes.data?.forEach((purchase) => {
        if (purchase.supplier_id) {
          if (!stats[purchase.supplier_id]) {
            stats[purchase.supplier_id] = {
              purchaseCount: 0,
              clientCount: 0,
              projectCount: 0,
              totalAmount: 0,
              paidAmount: 0,
              contractingAmount: 0,
              contractingPaid: 0,
              finishingAmount: 0,
              finishingPaid: 0,
              clients: new Set(),
              projects: new Set(),
            };
          }
          const amt = Number(purchase.total_amount) || 0;
          const paid = paidByPurchase.get(purchase.id) || 0;
          stats[purchase.supplier_id].purchaseCount++;
          stats[purchase.supplier_id].totalAmount += amt;
          stats[purchase.supplier_id].paidAmount += paid;
          
          const isFinishing = purchase.projects?.project_type === 'finishing';
          if (isFinishing) {
            stats[purchase.supplier_id].finishingAmount += amt;
            stats[purchase.supplier_id].finishingPaid += paid;
          } else {
            stats[purchase.supplier_id].contractingAmount += amt;
            stats[purchase.supplier_id].contractingPaid += paid;
          }
          
          if (purchase.project_id) {
            stats[purchase.supplier_id].projects.add(purchase.project_id);
          }
          if (purchase.projects?.client_id) {
            stats[purchase.supplier_id].clients.add(purchase.projects.client_id);
          }
        }
      });
      
      // Convert Sets to counts
      Object.keys(stats).forEach((key) => {
        stats[key].clientCount = stats[key].clients.size;
        stats[key].projectCount = stats[key].projects.size;
      });
      
      return stats;
    },
  });

  // 3. Company Settings for Print Header
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

  // Overall Financial Totals
  const overallTotals = useMemo(() => {
    const res = { totalAmount: 0, paidAmount: 0, remainingAmount: 0, supplierCount: suppliers?.length || 0 };
    if (!purchaseStats) return res;
    Object.values(purchaseStats).forEach((s) => {
      res.totalAmount += s.totalAmount;
      res.paidAmount += s.paidAmount;
    });
    res.remainingAmount = res.totalAmount - res.paidAmount;
    return res;
  }, [purchaseStats, suppliers]);

  // Unique Categories with Counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    suppliers?.forEach((s) => {
      const cat = s.category?.trim() || "غير مصنف";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [suppliers]);

  const uniqueCategories = useMemo(() => {
    return Object.keys(categoryCounts).sort();
  }, [categoryCounts]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    const q = searchQuery.toLowerCase().trim();

    return suppliers.filter((supplier) => {
      const cat = supplier.category?.trim() || "غير مصنف";

      // Category filter
      if (selectedCategory !== "all" && cat !== selectedCategory && supplier.category !== selectedCategory) {
        return false;
      }

      // Financial status filter
      const stats = purchaseStats?.[supplier.id];
      const total = stats?.totalAmount || 0;
      const paid = stats?.paidAmount || 0;
      const balance = total - paid;

      if (statusFilter === "has_dues" && balance <= 0.01) return false;
      if (statusFilter === "settled" && (balance > 0.01 || total === 0)) return false;
      if (statusFilter === "credit" && balance >= -0.01) return false;

      // Text query
      if (!q) return true;
      const nameMatch = supplier.name?.toLowerCase().includes(q) ?? false;
      const phoneMatch = supplier.phone?.toLowerCase().includes(q) ?? false;
      const categoryMatch = supplier.category?.toLowerCase().includes(q) ?? false;
      const addressMatch = supplier.address?.toLowerCase().includes(q) ?? false;
      const notesMatch = supplier.notes?.toLowerCase().includes(q) ?? false;

      return nameMatch || phoneMatch || categoryMatch || addressMatch || notesMatch;
    });
  }, [suppliers, searchQuery, selectedCategory, statusFilter, purchaseStats]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: SupplierForm) => {
      const supplierData = {
        name: data.name.trim(),
        category: data.category.trim() || null,
        phone: data.phone.trim() || null,
        email: data.email.trim() || null,
        address: data.address.trim() || null,
        notes: data.notes.trim() || null,
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(supplierData)
          .eq("id", editingSupplier);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(supplierData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editingSupplier ? "تم تحديث بيانات المورد بنجاح" : "تمت إضافة المورد بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ بيانات المورد");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      // First delete all related purchases
      const { error: purchasesError } = await supabase
        .from("purchases")
        .delete()
        .eq("supplier_id", supplierId);
      if (purchasesError) throw purchasesError;

      // Delete related project_suppliers entries
      const { error: projectSuppliersError } = await supabase
        .from("project_suppliers")
        .delete()
        .eq("supplier_id", supplierId);
      if (projectSuppliersError) throw projectSuppliersError;

      // Delete related expenses
      const { error: expensesError } = await supabase
        .from("expenses")
        .delete()
        .eq("supplier_id", supplierId);
      if (expensesError) throw expensesError;

      // Finally delete the supplier
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-stats"] });
      toast.success("تم حذف المورد وجميع المشتريات المرتبطة بنجاح");
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف المورد");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setForm(initialForm);
  };

  const handleEdit = (supplier: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingSupplier(supplier.id);
    setForm({
      name: supplier.name || "",
      category: supplier.category || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (supplier: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSupplierToDelete({ id: supplier.id, name: supplier.name });
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("يرجى إدخال اسم المورد");
      return;
    }
    saveMutation.mutate(form);
  };

  // Overall Print Report Handler
  const handlePrintReport = () => {
    if (!filteredSuppliers.length) {
      toast.error("لا توجد بيانات للطباعة");
      return;
    }

    const rowsHtml = filteredSuppliers
      .map((supplier, idx) => {
        const stats = purchaseStats?.[supplier.id];
        const total = stats?.totalAmount || 0;
        const paid = stats?.paidAmount || 0;
        const balance = total - paid;
        const categoryLabel = translateCategory(supplier.category) || "عام";

        return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-weight: bold;">${supplier.name}</td>
            <td style="text-align: center;">${categoryLabel}</td>
            <td style="text-align: center; direction: ltr;">${supplier.phone || "-"}</td>
            <td style="text-align: center;">${stats?.purchaseCount || 0}</td>
            <td style="text-align: left; font-family: monospace;">${formatCurrencyLYD(total)}</td>
            <td style="text-align: left; font-family: monospace; color: #16a34a;">${formatCurrencyLYD(paid)}</td>
            <td style="text-align: left; font-family: monospace; font-weight: bold; color: ${
              balance > 0.01 ? "#dc2626" : balance < -0.01 ? "#2563eb" : "#4b5563"
            };">
              ${
                balance > 0.01
                  ? formatCurrencyLYD(balance)
                  : balance < -0.01
                  ? `(${formatCurrencyLYD(Math.abs(balance))}) رصيد دائن`
                  : "0.000 د.ل"
              }
            </td>
          </tr>
        `;
      })
      .join("");

    const totalsTotal = filteredSuppliers.reduce(
      (sum, s) => sum + (purchaseStats?.[s.id]?.totalAmount || 0),
      0
    );
    const totalsPaid = filteredSuppliers.reduce(
      (sum, s) => sum + (purchaseStats?.[s.id]?.paidAmount || 0),
      0
    );
    const totalsBalance = totalsTotal - totalsPaid;

    const printHTML = `
      <div style="margin-bottom: 16px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 6px; text-align: center;">كشف الموردين وحسابات المشتريات والمديونيات</h2>
        <p style="text-align: center; color: #666; font-size: 12px; margin: 0;">تاريخ التقرير: ${format(
          new Date(),
          "dd MMMM yyyy",
          { locale: ar }
        )} - إجمالي الموردين: ${filteredSuppliers.length} مورد</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 8px; border: 1px solid #e5e7eb; width: 40px; text-align: center;">#</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">اسم المورد</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">النشاط / التصنيف</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">رقم الهاتف</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">عدد الفواتير</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">إجمالي المشتريات</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">المبالغ المسددة</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">المتبقي المستحق</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9fafb; font-weight: bold; border-top: 2px solid #d1d5db;">
            <td colspan="5" style="padding: 10px; text-align: center; font-size: 12px;">الإجمالي العام</td>
            <td style="padding: 10px; text-align: left; font-family: monospace;">${formatCurrencyLYD(totalsTotal)}</td>
            <td style="padding: 10px; text-align: left; font-family: monospace; color: #16a34a;">${formatCurrencyLYD(
              totalsPaid
            )}</td>
            <td style="padding: 10px; text-align: left; font-family: monospace; color: #dc2626;">${formatCurrencyLYD(
              totalsBalance
            )}</td>
          </tr>
        </tfoot>
      </table>
    `;

    openPrintWindow("كشف الموردين وحسابات المشتريات", printHTML, companySettings);
  };

  if (suppliersError || statsError) {
    return (
      <Card className="p-6 space-y-3" dir="rtl" role="alert">
        <p className="font-bold text-destructive">تعذر تحميل بيانات الموردين وحساباتهم المالية كاملة.</p>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
          إعادة المحاولة
        </Button>
      </Card>
    );
  }

  if (loadingSuppliers || loadingStats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3" dir="rtl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm font-medium">جاري تحميل سجلات الموردين والحسابات المالية...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Page Header */}
      <PageHeader
        title="الموردون"
        description="إدارة الموردين وحسابات المشتريات ومتابعة السداد والمديونيات"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="gap-2 cursor-pointer border-border hover:bg-muted"
            >
              <Printer className="h-4 w-4 text-primary" />
              <span>طباعة كشف الموردين</span>
            </Button>
            <Button
              size="sm"
              className="gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setEditingSupplier(null);
                setForm(initialForm);
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>مورد جديد</span>
            </Button>
          </div>
        }
      />

      {/* 2. Interactive KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Suppliers */}
        <Card
          className={`p-4 transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-xs bg-card ${
            statusFilter === "all" ? "ring-2 ring-primary border-primary bg-primary/5" : "border-border"
          }`}
          onClick={() => {
            setStatusFilter("all");
            setSelectedCategory("all");
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الموردين</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Truck className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">{overallTotals.supplierCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">مورد مسجل بالمنظومة</p>
        </Card>

        {/* KPI 2: Total Purchases */}
        <Card className="p-4 bg-card border-border hover:border-blue-500/50 transition-all duration-200 hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي المشتريات</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrencyLYD(overallTotals.totalAmount)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">كافة فواتير التوريد والخدمات</p>
        </Card>

        {/* KPI 3: Total Paid */}
        <Card
          className={`p-4 transition-all duration-200 cursor-pointer hover:border-emerald-500/50 hover:shadow-xs bg-card ${
            statusFilter === "settled" ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5" : "border-border"
          }`}
          onClick={() => setStatusFilter(statusFilter === "settled" ? "all" : "settled")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">المبالغ المسددة</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Coins className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrencyLYD(overallTotals.paidAmount)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            نسبة السداد: {overallTotals.totalAmount > 0 ? ((overallTotals.paidAmount / overallTotals.totalAmount) * 100).toFixed(1) : 100}%
          </p>
        </Card>

        {/* KPI 4: Remaining Due */}
        <Card
          className={`p-4 transition-all duration-200 cursor-pointer hover:shadow-xs bg-card border-2 ${
            statusFilter === "has_dues"
              ? "ring-2 ring-destructive border-destructive bg-destructive/5"
              : overallTotals.remainingAmount > 0.01
              ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
              : "border-border"
          }`}
          onClick={() => setStatusFilter(statusFilter === "has_dues" ? "all" : "has_dues")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">المتبقي المستحق (الذمم)</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Wallet className="h-5 w-5" />
            </span>
          </div>
          <p
            className={`mt-3 text-2xl sm:text-3xl font-black ${
              overallTotals.remainingAmount > 0.01 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            }`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatCurrencyLYD(overallTotals.remainingAmount)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {overallTotals.remainingAmount > 0.01 ? "انقر لعرض المطالبات المستحقة" : "كافة الحسابات مسواة بالكامل"}
          </p>
        </Card>
      </div>

      {/* 3. Category Filter Pills Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border" dir="rtl">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory("all")}
          className={`h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card hover:bg-muted text-foreground border-border"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>كل الأنشطة</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] rounded-full mr-1">
            {suppliers?.length || 0}
          </Badge>
        </Button>

        {uniqueCategories.map((cat) => {
          const IconComp = getCategoryIcon(cat);
          const isSelected = selectedCategory === cat;
          const count = categoryCounts[cat] || 0;

          return (
            <Button
              key={cat}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(isSelected ? "all" : cat)}
              className={`h-9 px-3 rounded-full text-xs font-semibold gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card hover:bg-muted text-foreground border-border"
              }`}
            >
              <IconComp className="h-3.5 w-3.5" />
              <span>{translateCategory(cat)}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] rounded-full mr-1">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* 4. Search and Controls Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-xl border border-border shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث باسم المورد، الهاتف، النشاط، العنوان أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 pl-8 w-full bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters and View Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val: any) => setStatusFilter(val)}
            dir="rtl"
          >
            <SelectTrigger className="w-[170px] h-9 text-xs font-medium cursor-pointer">
              <SelectValue placeholder="حالة السداد" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كل حالات السداد</SelectItem>
              <SelectItem value="has_dues">مستحق بذمة الشركة</SelectItem>
              <SelectItem value="settled">مسدد بالكامل</SelectItem>
              <SelectItem value="credit">رصيد دائن / مقدم</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters button if any filter active */}
          {(searchQuery || selectedCategory !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setStatusFilter("all");
              }}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>إعادة ضبط</span>
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetViewMode("grid")}
              className={`h-8 px-2.5 rounded-md text-xs cursor-pointer gap-1 transition-all ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="عرض كبطاقات"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">بطاقات</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetViewMode("table")}
              className={`h-8 px-2.5 rounded-md text-xs cursor-pointer gap-1 transition-all ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="عرض كجدول بيانات"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">جدول</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 5. Main Content: Table or Grid View */}
      {filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={
            searchQuery || selectedCategory !== "all" || statusFilter !== "all"
              ? "لا توجد نتائج مطابقة لخيارات البحث"
              : "لا يوجد موردين مسجلين حتى الآن"
          }
          description={
            searchQuery
              ? `لم يتم العثور على أي مورد يطابق استعلامك: "${searchQuery}".`
              : selectedCategory !== "all"
              ? "لا يوجد موردين مسجلين في هذا النشاط حالياً."
              : statusFilter !== "all"
              ? "لا يوجد موردين يطابقون حالة السداد المحددة."
              : "ابدأ بإضافة أول مورد لتسجيل فواتير ومشتريات المواد وإدارة مدفوعات المشاريع بكل احترافية."
          }
          action={
            searchQuery || selectedCategory !== "all" || statusFilter !== "all" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setStatusFilter("all");
                }}
                className="cursor-pointer gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                <span>إلغاء الفلاتر والبحث</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setEditingSupplier(null);
                  setForm(initialForm);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span>إضافة مورد جديد</span>
              </Button>
            )
          }
        />
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <Card className="border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table dir="rtl">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[45px] text-center">#</TableHead>
                  <TableHead className="min-w-[200px]">المورد والنشاط</TableHead>
                  <TableHead className="min-w-[180px]">بيانات الاتصال والعنوان</TableHead>
                  <TableHead className="min-w-[160px] text-center">النشاط والعمليات</TableHead>
                  <TableHead className="min-w-[130px] text-left">إجمالي المشتريات</TableHead>
                  <TableHead className="min-w-[120px] text-left">المسدد</TableHead>
                  <TableHead className="min-w-[140px] text-left">المتبقي المستحق</TableHead>
                  <TableHead className="w-[120px] text-center">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier, idx) => {
                  const stats = purchaseStats?.[supplier.id] || {
                    purchaseCount: 0,
                    clientCount: 0,
                    projectCount: 0,
                    totalAmount: 0,
                    paidAmount: 0,
                    contractingAmount: 0,
                    contractingPaid: 0,
                    finishingAmount: 0,
                    finishingPaid: 0,
                  };

                  const remaining = stats.totalAmount - stats.paidAmount;
                  const IconComp = getCategoryIcon(supplier.category);
                  const statusInfo =
                    stats.totalAmount === 0
                      ? paymentStatusLabels.zero
                      : remaining <= 0.01
                      ? paymentStatusLabels.paid
                      : stats.paidAmount > 0
                      ? paymentStatusLabels.partial
                      : paymentStatusLabels.due;

                  return (
                    <TableRow key={supplier.id} className="hover:bg-muted/30 transition-colors">
                      {/* Index */}
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      {/* Name & Category */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <IconComp className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <Link
                              to={`/suppliers/${supplier.id}`}
                              state={{ returnTo: `${location.pathname}${location.search}` }}
                              className="font-bold text-sm text-foreground hover:text-primary transition-colors hover:underline"
                            >
                              {supplier.name}
                            </Link>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 border-border">
                                {translateCategory(supplier.category) || "عام"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {supplier.phone ? (
                            <a
                              href={`tel:${supplier.phone}`}
                              className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                              dir="ltr"
                            >
                              <Phone className="h-3 w-3 text-primary shrink-0" />
                              <span>{supplier.phone}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">- لا يوجد هاتف -</span>
                          )}
                          {supplier.address && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[160px]">{supplier.address}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Operations / Stats Badges */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" title="عدد الفواتير">
                            <ShoppingCart className="h-3 w-3" />
                            <span>{stats.purchaseCount} فاتورة</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold" title="عدد المشاريع">
                            <FolderOpen className="h-3 w-3" />
                            <span>{stats.projectCount} مشاريع</span>
                          </span>
                        </div>
                      </TableCell>

                      {/* Total Purchases */}
                      <TableCell className="text-left font-mono font-semibold text-xs">
                        {formatCurrencyLYD(stats.totalAmount)}
                      </TableCell>

                      {/* Paid */}
                      <TableCell className="text-left font-mono font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyLYD(stats.paidAmount)}
                      </TableCell>

                      {/* Remaining Balance */}
                      <TableCell className="text-left">
                        <div className="space-y-1 text-left">
                          <p
                            className={`font-mono font-bold text-xs ${
                              remaining > 0.01
                                ? "text-destructive"
                                : remaining < -0.01
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {formatCurrencyLYD(remaining)}
                          </p>
                          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                            title="عرض كشف الحساب والملف المالي"
                          >
                            <Link
                              to={`/suppliers/${supplier.id}`}
                              state={{ returnTo: `${location.pathname}${location.search}` }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={(e) => handleEdit(supplier, e)}
                            title="تعديل بيانات المورد"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={(e) => handleDelete(supplier, e)}
                            title="حذف المورد"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.map((supplier) => {
            const stats = purchaseStats?.[supplier.id] || {
              purchaseCount: 0,
              clientCount: 0,
              projectCount: 0,
              totalAmount: 0,
              paidAmount: 0,
              contractingAmount: 0,
              contractingPaid: 0,
              finishingAmount: 0,
              finishingPaid: 0,
            };

            const remaining = stats.totalAmount - stats.paidAmount;
            const IconComp = getCategoryIcon(supplier.category);
            const statusInfo =
              stats.totalAmount === 0
                ? paymentStatusLabels.zero
                : remaining <= 0.01
                ? paymentStatusLabels.paid
                : stats.paidAmount > 0
                ? paymentStatusLabels.partial
                : paymentStatusLabels.due;

            return (
              <Card
                key={supplier.id}
                className="group border border-border hover:border-primary/50 transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden bg-card"
              >
                <div className="p-5 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors shrink-0">
                        <IconComp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Link
                          to={`/suppliers/${supplier.id}`}
                          state={{ returnTo: `${location.pathname}${location.search}` }}
                          className="font-bold text-base text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {supplier.name}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 border-border">
                            {translateCategory(supplier.category) || "عام"}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Quick Edit/Delete Actions */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={(e) => handleEdit(supplier, e)}
                        title="تعديل المورد"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        onClick={(e) => handleDelete(supplier, e)}
                        title="حذف المورد"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact Info Strip */}
                  <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60">
                    {supplier.phone ? (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="flex items-center gap-2 hover:text-primary transition-colors"
                        dir="ltr"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{supplier.phone}</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground/60">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>لا يوجد هاتف مسجل</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Activity Mini Stats */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-muted/40 rounded-xl border border-border/60 text-center">
                    <div>
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400">{stats.clientCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">عميل</p>
                    </div>
                    <div className="border-r border-border/60">
                      <p className="text-xs font-black text-amber-600 dark:text-amber-400">{stats.projectCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">مشروع</p>
                    </div>
                    <div className="border-r border-border/60">
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{stats.purchaseCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">فاتورة</p>
                    </div>
                  </div>

                  {/* Contracting vs Finishing Breakdown if applicable */}
                  {(stats.contractingAmount > 0 || stats.finishingAmount > 0) && (
                    <div className="pt-2 text-xs space-y-1 bg-muted/20 p-2.5 rounded-lg border border-border/40">
                      {stats.contractingAmount > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Settings className="h-3 w-3 text-blue-600 shrink-0" /> فواتير المقاولات:
                          </span>
                          <span className="font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrencyLYD(stats.contractingAmount)}
                          </span>
                        </div>
                      )}
                      {stats.finishingAmount > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-600 shrink-0" /> فواتير التشطيبات:
                          </span>
                          <span className="font-semibold text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrencyLYD(stats.finishingAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Financial Breakdown Panel */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">المشتريات</p>
                        <p className="font-bold text-foreground font-mono">{formatCurrencyLYD(stats.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">المدفوع</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrencyLYD(stats.paidAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">المتبقي</p>
                        <p
                          className={`font-bold font-mono ${
                            remaining > 0.01
                              ? "text-destructive font-black"
                              : remaining < -0.01
                              ? "text-blue-600 dark:text-blue-400 font-black"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatCurrencyLYD(remaining)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-muted/20 border-t border-border/80">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full justify-between h-9 text-xs font-semibold cursor-pointer border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all group-hover:border-primary/40"
                  >
                    <Link
                      to={`/suppliers/${supplier.id}`}
                      state={{ returnTo: `${location.pathname}${location.search}` }}
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        <span>عرض كشف الحساب والملف المالي</span>
                      </span>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 6. Add/Edit Supplier Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span>{editingSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد"}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold">اسم المورد *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="أدخل اسم المورد أو الشركة"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-bold">النشاط / نوع المواد</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="مثال: مواد بناء، حديد، كهرباء، صحية، أخشاب"
                />
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-bold">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="09xxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@mail.com"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs font-bold">العنوان أو المقر</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="أدخل عنوان المورد أو الفرع"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-bold">ملاحظات إضافية</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="شروط الدفع، الخصومات المتفق عليها، أو أي بيانات إضافية..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-3">
              <Button
                type="submit"
                className="flex-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "جاري الحفظ..." : editingSupplier ? "تحديث المورد" : "إضافة المورد"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="cursor-pointer"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 7. Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>تأكيد حذف المورد</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                هل أنت متأكد من رغبتك في حذف المورد <strong>"{supplierToDelete?.name}"</strong>؟
              </p>
              <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-xs space-y-1">
                <p className="font-bold">تنبيه هام لا يمكن التراجع عنه:</p>
                <p>سيتم حذف كافة فواتير المشتريات والمصروفات المرتبطة بهذا المورد من المشاريع نهائياً.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="cursor-pointer">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              onClick={() => supplierToDelete && deleteMutation.mutate(supplierToDelete.id)}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف نهائي"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
