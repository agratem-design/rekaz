import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyLYD } from "@/lib/currency";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  BarChart3,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const AccountantDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["accountant-dashboard"],
    queryFn: async () => {
      const [rpcRes, treasuryRes, transfersRes, recentPurchasesRes, monthlyIncomeRes] =
        await Promise.all([
          supabase.rpc("get_dashboard_financial_summary"),
          supabase.from("treasuries").select("id, name, balance, treasury_type").eq("is_active", true),
          supabase.from("transfers").select("amount, type, date, party_name, status").order("date", { ascending: false }).limit(5),
          supabase.from("purchases").select("id, total_amount, paid_amount, status, date, invoice_number, suppliers(name), notes").eq("status", "due").order("date", { ascending: true }).limit(10),
          supabase.from("income").select("amount").gte("date", `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`).lte("date", `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-31`),
        ]);

      const summary = rpcRes.data as any || {};
      const totalIncome = Number(summary.total_income || 0);
      const totalExpenses = Number(summary.total_expenses || 0);
      const totalPurchases = Number(summary.total_purchases || 0);
      const totalPaid = Number(summary.total_purchases_paid || 0);
      const totalRentals = Number(summary.total_rentals || 0);
      const totalCustody = Number(summary.total_custody || 0);
      const totalRemaining = totalPurchases - totalPaid;
      const totalTreasury = Number(summary.total_treasury || 0);
      const netProfit = totalIncome - totalExpenses - totalPurchases - totalRentals - totalCustody;

      const monthlyIncome = (monthlyIncomeRes.data || []).reduce((s, r) => s + Number(r.amount), 0);

      return {
        totalIncome,
        totalExpenses,
        totalPurchases,
        totalPaid,
        totalRemaining,
        totalTreasury,
        netProfit,
        monthlyIncome,
        treasuries: treasuryRes.data || [],
        overduePurchases: recentPurchasesRes.data || [],
        recentTransfers: transfersRes.data || [],
      };
    },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("purchases").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountant-dashboard"] });
      toast.success("تم تحديث الفاتورة بنجاح");
      setEditDialogOpen(false);
      setEditingPurchase(null);
    },
    onError: () => toast.error("حدث خطأ أثناء تحديث الفاتورة"),
  });

  const handleSavePurchase = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPurchase) return;
    const fd = new FormData(e.currentTarget);
    updatePurchaseMutation.mutate({
      id: editingPurchase.id,
      data: {
        paid_amount: Number(fd.get("paid_amount")),
        status: fd.get("status") as string,
        invoice_number: (fd.get("invoice_number") as string) || null,
        notes: (fd.get("notes") as string) || null,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">لوحة التحكم المالية</h1>
            <p className="text-muted-foreground text-sm">نظرة شاملة على الوضع المالي</p>
          </div>
          {(data?.overduePurchases?.length || 0) > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1.5 flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="h-4 w-4" />
              {data?.overduePurchases?.length} فاتورة مستحقة
            </Badge>
          )}
        </div>

        {/* Key Financial Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-500/30">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrencyLYD(data?.totalIncome || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">هذا الشهر: {formatCurrencyLYD(data?.monthlyIncome || 0)}</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المصروفات</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrencyLYD(data?.totalExpenses || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">+ مشتريات: {formatCurrencyLYD(data?.totalPurchases || 0)}</p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-${(data?.netProfit || 0) >= 0 ? "primary" : "destructive"}/30`}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">صافي الربح</p>
                  <p className={`text-xl font-bold ${(data?.netProfit || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrencyLYD(data?.netProfit || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(data?.netProfit || 0) >= 0 ? "✅ وضع إيجابي" : "⚠️ يحتاج مراجعة"}
                  </p>
                </div>
                <div className="bg-primary/10 rounded-lg p-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">رصيد الخزائن</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrencyLYD(data?.totalTreasury || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{data?.treasuries?.length || 0} خزينة نشطة</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Purchases Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2">
                  <ShoppingCart className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                  <p className="text-lg font-bold">{formatCurrencyLYD(data?.totalPurchases || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المبلغ المدفوع</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrencyLYD(data?.totalPaid || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المبلغ المتبقي</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrencyLYD(data?.totalRemaining || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Overdue Purchases Alert */}
          <Card className={(data?.overduePurchases?.length || 0) > 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  الفواتير المستحقة
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate("/project-expenses")}>
                  عرض الكل
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.overduePurchases?.length || 0) === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">لا توجد فواتير مستحقة 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.overduePurchases?.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div>
                        <p className="text-sm font-medium">{p.suppliers?.name || "مورد غير محدد"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.invoice_number ? `#${p.invoice_number}` : ""} — {p.date ? format(new Date(p.date), "dd MMM yyyy", { locale: ar }) : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-bold text-destructive">{formatCurrencyLYD(Number(p.total_amount) - Number(p.paid_amount))}</p>
                          <Badge variant="destructive" className="text-[10px]">مستحق</Badge>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { setEditingPurchase(p); setEditDialogOpen(true); }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Treasury Balances */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  أرصدة الخزائن
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate("/treasuries")}>
                  إدارة الخزائن
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data?.treasuries || []).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/treasuries/${t.id}`)}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t.treasury_type === "bank" ? "🏦 بنك" : "💵 نقدي"}
                    </Badge>
                    <span className="text-sm">{t.name}</span>
                  </div>
                  <span className={`font-bold text-sm ${Number(t.balance) >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrencyLYD(Number(t.balance))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-primary/10 border border-primary/20 mt-2">
                <span className="text-sm font-bold">الإجمالي</span>
                <span className="font-bold text-primary">{formatCurrencyLYD(data?.totalTreasury || 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transfers */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                  آخر التحويلات
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate("/transfers")}>
                  عرض الكل
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.recentTransfers?.length || 0) === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">لا توجد تحويلات مسجلة</p>
              ) : (
                <div className="space-y-2">
                  {data?.recentTransfers?.map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${t.type === "in" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                          {t.type === "in" ? (
                            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.party_name || "غير محدد"}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.date ? format(new Date(t.date), "dd MMM yyyy", { locale: ar }) : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold text-sm ${t.type === "in" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "in" ? "+" : "-"}{formatCurrencyLYD(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">إجراءات سريعة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate("/income")}>
                <TrendingUp className="h-4 w-4 text-green-600" />
                تسجيل إيراد
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate("/expenses")}>
                <TrendingDown className="h-4 w-4 text-red-600" />
                تسجيل مصروف
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate("/transfers")}>
                <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                تحويل مالي
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate("/treasuries")}>
                <Wallet className="h-4 w-4 text-primary" />
                إدارة الخزائن
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Purchase Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الفاتورة المستحقة</DialogTitle>
          </DialogHeader>
          {editingPurchase && (
            <form onSubmit={handleSavePurchase} className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">المورد</p>
                <p className="font-semibold">{editingPurchase.suppliers?.name || "غير محدد"}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي الفاتورة: <span className="font-bold text-destructive">{formatCurrencyLYD(Number(editingPurchase.total_amount))}</span></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid_amount">المبلغ المدفوع</Label>
                <Input
                  id="paid_amount"
                  name="paid_amount"
                  type="number"
                  defaultValue={editingPurchase.paid_amount}
                  min={0}
                  max={editingPurchase.total_amount}
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>حالة الفاتورة</Label>
                <Select name="status" defaultValue={editingPurchase.status || "due"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">مستحقة</SelectItem>
                    <SelectItem value="partial">مدفوعة جزئياً</SelectItem>
                    <SelectItem value="paid">مدفوعة بالكامل</SelectItem>
                    <SelectItem value="processing">قيد المعالجة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_number">رقم الفاتورة</Label>
                <Input
                  id="invoice_number"
                  name="invoice_number"
                  defaultValue={editingPurchase.invoice_number || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input
                  id="notes"
                  name="notes"
                  defaultValue={editingPurchase.notes || ""}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={updatePurchaseMutation.isPending}>
                  {updatePurchaseMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountantDashboard;
