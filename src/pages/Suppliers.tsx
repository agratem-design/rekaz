import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, Truck, Building, ShoppingCart, FolderOpen, Edit, Trash2, Settings, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { toast } from "sonner";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
  paid: { label: "مدفوع بالكامل", color: "bg-green-500/10 text-green-500" },
  partial: { label: "مدفوع جزئياً", color: "bg-yellow-500/10 text-yellow-500" },
  processing: { label: "قيد المعالجة", color: "bg-blue-500/10 text-blue-500" },
  due: { label: "مستحق", color: "bg-red-500/10 text-red-500" },
};

const translateCategory = (cat: string | null): string => {
  if (!cat) return "";
  const map: Record<string, string> = {
    supplier: "مورد",
    labor: "عمالة / مقاول",
  };
  return map[cat.toLowerCase()] || cat;
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

  const { data: suppliers, isLoading } = useQuery({
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

  // Fetch purchases and authoritative payments to calculate stats per supplier
  const { data: purchaseStats } = useQuery({
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

  const saveMutation = useMutation({
    mutationFn: async (data: SupplierForm) => {
      const supplierData = {
        name: data.name,
        category: data.category || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
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
      toast.success(editingSupplier ? "تم تحديث المورد بنجاح" : "تمت إضافة المورد بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ البيانات");
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
      name: supplier.name,
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

  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const categories = Array.from(new Set(suppliers?.map((s) => s.category).filter(Boolean) || []));

  const filtered = React.useMemo(() => {
    if (!suppliers) return [];
    const q = query.toLowerCase().trim();
    return suppliers.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (!q) return true;
      const nameMatch = s.name?.toLowerCase().includes(q) ?? false;
      const phoneMatch = s.phone?.toLowerCase().includes(q) ?? false;
      const categoryMatch = s.category?.toLowerCase().includes(q) ?? false;
      return nameMatch || phoneMatch || categoryMatch;
    });
  }, [suppliers, query, categoryFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <PageHeader
        title="الموردون"
        description="إدارة الموردين وحسابات المشتريات ومتابعة السداد"
        actions={
          <Button className="gap-2 cursor-pointer" onClick={() => { setEditingSupplier(null); setForm(initialForm); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            <span>مورد جديد</span>
          </Button>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم المورد *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="أدخل اسم المورد"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">النشاط / التصنيف</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="مثال: مواد بناء، حديد، كهرباء"
              />
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
              <Label htmlFor="address">العنوان</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="أدخل العنوان"
              />
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
                {saveMutation.isPending ? "جاري الحفظ..." : editingSupplier ? "تحديث" : "إضافة"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Summary */}
      {(() => {
        const overall = Object.values(purchaseStats || {}).reduce(
          (acc, s) => {
            acc.totalAmount += s.totalAmount;
            acc.paidAmount += s.paidAmount;
            return acc;
          },
          { totalAmount: 0, paidAmount: 0 }
        );
        const remaining = overall.totalAmount - overall.paidAmount;

        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الموردين</p>
                  <p className="text-2xl font-bold">{suppliers?.length || 0}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrencyLYD(overall.totalAmount)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المبالغ المسددة</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCurrencyLYD(overall.paidAmount)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المتبقي المستحق</p>
                  <p className={`text-lg font-bold ${remaining > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                    {formatCurrencyLYD(remaining)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-card p-3 rounded-lg border shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Input 
            placeholder="بحث باسم المورد، الهاتف أو النشاط..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="w-full"
          />
        </div>
        <select 
          className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
          value={categoryFilter} 
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">كل الأنشطة / التصنيفات</option>
          {categories.map((c) => (
            <option key={c} value={c}>{translateCategory(c)}</option>
          ))}
        </select>
      </div>

      {/* Suppliers Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={query || categoryFilter !== "all" ? "لا توجد نتائج مطابقة" : "لا يوجد موردين حتى الآن"}
          description={
            query
              ? `لم نتمكن من العثور على أي مورد يطابق "${query}".`
              : categoryFilter !== "all"
              ? "لا يوجد موردين في هذا النشاط/التصنيف."
              : "ابدأ بإضافة أول مورد لتسجيل ومتابعة فواتير ومشتريات المواد والخدمات."
          }
          action={
            !query && categoryFilter === "all" ? (
              <Button
                className="gap-2 cursor-pointer"
                onClick={() => {
                  setEditingSupplier(null);
                  setForm(initialForm);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span>إضافة مورد</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => { setQuery(""); setCategoryFilter("all"); }}
                className="cursor-pointer"
              >
                مسح البحث والفلاتر
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((supplier) => {
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
              clients: new Set<string>(), 
              projects: new Set<string>(), 
            };
            
            const dynamicStatus = stats.totalAmount === 0 
              ? paymentStatusLabels.paid 
              : stats.paidAmount >= stats.totalAmount 
                ? paymentStatusLabels.paid 
                : stats.paidAmount > 0 
                  ? paymentStatusLabels.partial 
                  : paymentStatusLabels.due;
            
            return (
              <Link key={supplier.id} to={`/suppliers/${supplier.id}`} state={{ returnTo: `${location.pathname}${location.search}` }}>
                <Card className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg h-full">
                  <div className="space-y-4">
                    {/* Supplier Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Truck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{supplier.name}</h3>
                          {supplier.category && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {translateCategory(supplier.category)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            handleEdit(supplier);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            setSupplierToDelete({ id: supplier.id, name: supplier.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 text-sm text-muted-foreground border-t border-border pt-3">
                      {supplier.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-primary" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Building className="h-3 w-3 text-blue-500" />
                          <span className="text-xl font-bold text-blue-500">{stats.clientCount}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">عميل</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FolderOpen className="h-3 w-3 text-orange-500" />
                          <span className="text-xl font-bold text-orange-500">{stats.projectCount}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">مشروع</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <ShoppingCart className="h-3 w-3 text-green-500" />
                          <span className="text-xl font-bold text-green-500">{stats.purchaseCount}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">فاتورة</p>
                      </div>
                    </div>

                    {/* Purchases Breakdown by Project Type */}
                    <div className="pt-2 text-xs space-y-1 bg-muted/40 p-2 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                          <Settings className="h-3 w-3 text-blue-600 inline" /> فواتير المقاولات:
                        </span>
                        <span className="font-semibold text-foreground text-[11px]">{formatCurrencyLYD(stats.contractingAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-purple-600 inline" /> فواتير التشطيبات:
                        </span>
                        <span className="font-semibold text-primary text-[11px]">{formatCurrencyLYD(stats.finishingAmount)}</span>
                      </div>
                    </div>

                    {/* Total Purchases and Balance Breakdown */}
                    <div className="pt-3 border-t border-border space-y-2">
                      <div className="grid grid-cols-3 gap-1 text-center text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">المشتريات</p>
                          <p className="font-bold text-foreground">{formatCurrencyLYD(stats.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">المدفوع</p>
                          <p className="font-bold text-emerald-600">{formatCurrencyLYD(stats.paidAmount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">المتبقي</p>
                          <p className={`font-bold ${stats.totalAmount - stats.paidAmount > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                            {formatCurrencyLYD(stats.totalAmount - stats.paidAmount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <span className="text-[10px] text-muted-foreground">حالة السداد:</span>
                        <Badge className={dynamicStatus.color}>{dynamicStatus.label}</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المورد "{supplierToDelete?.name}"؟
              <br />
              <span className="text-destructive font-semibold">
                سيتم حذف جميع المشتريات والمصروفات المرتبطة بهذا المورد نهائياً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => supplierToDelete && deleteMutation.mutate(supplierToDelete.id)}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف المورد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
