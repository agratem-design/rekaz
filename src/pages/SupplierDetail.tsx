import { useParams, Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowRight, Phone, Mail, MapPin, Truck, FolderOpen, Building, ShoppingCart,
  ChevronLeft, CreditCard, RotateCcw, Printer,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { useState } from "react";
import { SupplierPaymentDialog } from "@/components/purchases/SupplierPaymentDialog";
import { SupplierBulkPaymentDialog } from "@/components/purchases/SupplierBulkPaymentDialog";
import { SupplierReturnDialog } from "@/components/purchases/SupplierReturnDialog";
import { StandaloneReturnDialog } from "@/components/purchases/StandaloneReturnDialog";
import PrintDateRangeDialog from "@/components/print/PrintDateRangeDialog";
import { generatePrintStyles, getPrintValues, openPrintWindow } from "@/lib/printStyles";
import { format } from "date-fns";

const statusLabels: Record<string, string> = {
  paid: "مدفوع", due: "مستحق", partial: "مدفوع جزئياً", processing: "قيد المعالجة",
};
const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-500", due: "bg-red-500/10 text-red-500",
  partial: "bg-yellow-500/10 text-yellow-500", processing: "bg-blue-500/10 text-blue-500",
};

interface Purchase {
  id: string;
  project_id: string | null;
  phase_id?: string | null;
  supplier_id: string | null;
  date: string;
  invoice_number: string | null;
  total_amount: number;
  paid_amount: number;
  status: string;
  items: any[];
  notes: string | null;
  treasury_id: string | null;
  is_return: boolean;
  return_for_purchase_id: string | null;
  projects?: {
    id: string;
    name: string;
    client_id: string | null;
    clients?: { id: string; name: string; phone?: string } | null;
  } | null;
}

const SupplierDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);
  const [standaloneReturnOpen, setStandaloneReturnOpen] = useState(false);
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printContext, setPrintContext] = useState<"all" | "project" | "payments">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: supplier, isLoading: supplierLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["supplier-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`*, projects ( id, name, client_id, clients ( id, name, phone ) )`)
        .eq("supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!id,
  });

  // Group purchases by client
  const clientsData = purchases?.reduce((acc, purchase) => {
    const client = purchase.projects?.clients;
    if (!client) return acc;
    if (!acc[client.id]) {
      acc[client.id] = { client, projects: {}, totalAmount: 0, paidAmount: 0, purchaseCount: 0 };
    }
    const project = purchase.projects;
    if (project) {
      if (!acc[client.id].projects[project.id]) {
        acc[client.id].projects[project.id] = { project, purchases: [], totalAmount: 0, paidAmount: 0 };
      }
      acc[client.id].projects[project.id].purchases.push(purchase);
      if (!purchase.is_return) {
        acc[client.id].projects[project.id].totalAmount += Number(purchase.total_amount);
        acc[client.id].projects[project.id].paidAmount += Number(purchase.paid_amount || 0);
      }
    }
    if (!purchase.is_return) {
      acc[client.id].totalAmount += Number(purchase.total_amount);
      acc[client.id].paidAmount += Number(purchase.paid_amount || 0);
    }
    acc[client.id].purchaseCount++;
    return acc;
  }, {} as Record<string, any>) || {};

  const selectedClientData = selectedClientId ? clientsData[selectedClientId] : null;
  const selectedProjectData = selectedClientData && selectedProjectId
    ? selectedClientData.projects[selectedProjectId] : null;

  const normalPurchases = purchases?.filter(p => !p.is_return) || [];
  const returnPurchases = purchases?.filter(p => p.is_return) || [];
  const stats = {
    totalPurchases: normalPurchases.length,
    totalAmount: normalPurchases.reduce((sum, p) => sum + Number(p.total_amount), 0),
    totalReturns: returnPurchases.reduce((sum, p) => sum + Number(p.total_amount), 0),
    totalClients: Object.keys(clientsData).length,
    totalProjects: Object.values(clientsData).reduce((sum: number, c: any) => sum + Object.keys(c.projects).length, 0),
    paidAmount: normalPurchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0),
    remainingAmount: normalPurchases.reduce((sum, p) => sum + (Number(p.total_amount) - Number(p.paid_amount || 0)), 0),
  };
  const netTotal = stats.totalAmount - stats.totalReturns;

  // Print functions
  const printFullStatement = (dateFrom: string, dateTo: string) => {
    if (!purchases?.length || !supplier) return;
    const filtered = purchases.filter(p => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
    if (!filtered.length) return;

    const v = getPrintValues(companySettings);
    const dateRange = dateFrom || dateTo ? `الفترة: ${dateFrom || "البداية"} إلى ${dateTo || "الآن"}` : "جميع السجلات";
    const totalAmt = filtered.filter(p => !p.is_return).reduce((s, p) => s + Number(p.total_amount), 0);
    const paidAmt = filtered.filter(p => !p.is_return).reduce((s, p) => s + Number(p.paid_amount || 0), 0);

    const rows = filtered.map((p, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${p.date}</td>
        <td>${p.invoice_number || '-'}</td>
        <td>${p.projects?.name || '-'}</td>
        <td>${p.projects?.clients?.name || '-'}</td>
        <td style="text-align:center">${p.is_return ? '<span style="color:orange">مرتجع</span>' : formatCurrencyLYD(p.total_amount)}</td>
        <td style="text-align:center">${p.is_return ? '-' : formatCurrencyLYD(p.paid_amount || 0)}</td>
        <td style="text-align:center">${p.is_return ? formatCurrencyLYD(p.total_amount) : formatCurrencyLYD(Number(p.total_amount) - Number(p.paid_amount || 0))}</td>
        <td>${statusLabels[p.status] || p.status}</td>
      </tr>
    `).join("");

    const content = `
      <div class="print-area"><div class="print-content">
        <h2 style="text-align:center;margin-bottom:5px;">كشف حساب المورد</h2>
        <p style="text-align:center;color:#666;margin-bottom:15px;">${dateRange}</p>
        <table class="print-info-table">
          <tr><td class="info-label">المورد</td><td class="info-value">${supplier.name}</td>
              <td class="info-label">النشاط</td><td class="info-value">${supplier.category || '-'}</td></tr>
          <tr><td class="info-label">الهاتف</td><td class="info-value">${supplier.phone || '-'}</td>
              <td class="info-label">تاريخ الطباعة</td><td class="info-value">${format(new Date(), "yyyy/MM/dd")}</td></tr>
        </table>
        <div class="print-section">
          <table class="print-table"><thead><tr>
            <th>#</th><th>التاريخ</th><th>رقم الفاتورة</th><th>المشروع</th><th>العميل</th>
            <th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th>
          </tr></thead><tbody>${rows}</tbody></table>
        </div>
        <table class="print-summary-table">
          <tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(totalAmt)}</td></tr>
          <tr><td>المدفوع</td><td>${formatCurrencyLYD(paidAmt)}</td></tr>
          <tr><td><strong>المتبقي</strong></td><td><strong>${formatCurrencyLYD(totalAmt - paidAmt)}</strong></td></tr>
        </table>
        <div class="print-footer"><span>تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd")}</span><span>${v.companyName}</span></div>
      </div></div>
    `;
    openPrintWindow(`كشف حساب - ${supplier.name}`, content, companySettings);
  };

  const printProjectStatement = (dateFrom: string, dateTo: string) => {
    if (!selectedProjectData || !supplier) return;
    const filtered = selectedProjectData.purchases.filter((p: Purchase) => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
    if (!filtered.length) return;

    const v = getPrintValues(companySettings);
    const dateRange = dateFrom || dateTo ? `الفترة: ${dateFrom || "البداية"} إلى ${dateTo || "الآن"}` : "جميع السجلات";
    const totalAmt = filtered.filter((p: Purchase) => !p.is_return).reduce((s: number, p: Purchase) => s + Number(p.total_amount), 0);
    const paidAmt = filtered.filter((p: Purchase) => !p.is_return).reduce((s: number, p: Purchase) => s + Number(p.paid_amount || 0), 0);

    const rows = filtered.map((p: Purchase, i: number) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${p.date}</td>
        <td>${p.invoice_number || '-'}</td>
        <td style="text-align:center">${p.is_return ? '<span style="color:orange">مرتجع</span>' : formatCurrencyLYD(p.total_amount)}</td>
        <td style="text-align:center">${p.is_return ? '-' : formatCurrencyLYD(p.paid_amount || 0)}</td>
        <td style="text-align:center">${p.is_return ? formatCurrencyLYD(p.total_amount) : formatCurrencyLYD(Number(p.total_amount) - Number(p.paid_amount || 0))}</td>
        <td>${statusLabels[p.status] || p.status}</td>
      </tr>
    `).join("");

    const content = `
      <div class="print-area"><div class="print-content">
        <h2 style="text-align:center;margin-bottom:5px;">كشف مشتريات المورد - مشروع</h2>
        <p style="text-align:center;color:#666;margin-bottom:15px;">${dateRange}</p>
        <table class="print-info-table">
          <tr><td class="info-label">المورد</td><td class="info-value">${supplier.name}</td>
              <td class="info-label">المشروع</td><td class="info-value">${selectedProjectData.project.name}</td></tr>
          <tr><td class="info-label">العميل</td><td class="info-value">${selectedClientData?.client?.name || '-'}</td>
              <td class="info-label">تاريخ الطباعة</td><td class="info-value">${format(new Date(), "yyyy/MM/dd")}</td></tr>
        </table>
        <div class="print-section">
          <table class="print-table"><thead><tr>
            <th>#</th><th>التاريخ</th><th>رقم الفاتورة</th>
            <th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th>
          </tr></thead><tbody>${rows}</tbody></table>
        </div>
        <table class="print-summary-table">
          <tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(totalAmt)}</td></tr>
          <tr><td>المدفوع</td><td>${formatCurrencyLYD(paidAmt)}</td></tr>
          <tr><td><strong>المتبقي</strong></td><td><strong>${formatCurrencyLYD(totalAmt - paidAmt)}</strong></td></tr>
        </table>
        <div class="print-footer"><span>تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd")}</span><span>${v.companyName}</span></div>
      </div></div>
    `;
    openPrintWindow(`كشف مشروع - ${supplier.name}`, content, companySettings);
  };

  const printPaymentsStatement = (dateFrom: string, dateTo: string) => {
    if (!purchases?.length || !supplier) return;
    const paidPurchases = purchases.filter(p => !p.is_return && Number(p.paid_amount) > 0).filter(p => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
    if (!paidPurchases.length) return;

    const v = getPrintValues(companySettings);
    const dateRange = dateFrom || dateTo ? `الفترة: ${dateFrom || "البداية"} إلى ${dateTo || "الآن"}` : "جميع المدفوعات";
    const totalPaid = paidPurchases.reduce((s, p) => s + Number(p.paid_amount), 0);

    const rows = paidPurchases.map((p, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${p.date}</td>
        <td>${p.invoice_number || '-'}</td>
        <td>${p.projects?.name || '-'}</td>
        <td style="text-align:center">${formatCurrencyLYD(p.total_amount)}</td>
        <td style="text-align:center">${formatCurrencyLYD(p.paid_amount)}</td>
      </tr>
    `).join("");

    const content = `
      <div class="print-area"><div class="print-content">
        <h2 style="text-align:center;margin-bottom:5px;">كشف مدفوعات المورد</h2>
        <p style="text-align:center;color:#666;margin-bottom:15px;">${dateRange}</p>
        <table class="print-info-table">
          <tr><td class="info-label">المورد</td><td class="info-value">${supplier.name}</td>
              <td class="info-label">تاريخ الطباعة</td><td class="info-value">${format(new Date(), "yyyy/MM/dd")}</td></tr>
        </table>
        <div class="print-section">
          <table class="print-table"><thead><tr>
            <th>#</th><th>التاريخ</th><th>رقم الفاتورة</th><th>المشروع</th><th>المبلغ الكلي</th><th>المدفوع</th>
          </tr></thead><tbody>${rows}</tbody></table>
        </div>
        <div class="total-box"><div class="label">إجمالي المدفوعات</div><div class="value">${formatCurrencyLYD(totalPaid)}</div></div>
        <table class="print-summary-table">
          <tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(stats.totalAmount)}</td></tr>
          <tr><td>إجمالي المدفوعات</td><td>${formatCurrencyLYD(stats.paidAmount)}</td></tr>
          <tr><td><strong>المتبقي</strong></td><td><strong>${formatCurrencyLYD(stats.remainingAmount)}</strong></td></tr>
        </table>
        <div class="print-footer"><span>تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd")}</span><span>${v.companyName}</span></div>
      </div></div>
    `;
    openPrintWindow(`كشف مدفوعات - ${supplier.name}`, content, companySettings);
  };

  const handlePrintByRange = (dateFrom: string, dateTo: string) => {
    if (printContext === "project") printProjectStatement(dateFrom, dateTo);
    else if (printContext === "payments") printPaymentsStatement(dateFrom, dateTo);
    else printFullStatement(dateFrom, dateTo);
  };

  if (supplierLoading || purchasesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">المورد غير موجود</p>
        <Link to="/suppliers"><Button variant="link">العودة للموردين</Button></Link>
      </div>
    );
  }

  const handleBack = () => {
    if (selectedProjectId) setSelectedProjectId(null);
    else if (selectedClientId) setSelectedClientId(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/suppliers" className="hover:text-primary">الموردين</Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className={selectedClientId ? "hover:text-primary cursor-pointer" : "text-foreground"}
          onClick={() => { setSelectedClientId(null); setSelectedProjectId(null); }}>
          {supplier.name}
        </span>
        {selectedClientId && (
          <>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span className={selectedProjectId ? "hover:text-primary cursor-pointer" : "text-foreground"}
              onClick={() => setSelectedProjectId(null)}>
              {selectedClientData?.client.name}
            </span>
          </>
        )}
        {selectedProjectId && (
          <>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span className="text-foreground">{selectedProjectData?.project.name}</span>
          </>
        )}
      </div>

      {/* Supplier Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
              {supplier.category && <Badge variant="outline">{supplier.category}</Badge>}
              {supplier.phone && <div className="flex items-center gap-1"><Phone className="h-4 w-4" /><span>{supplier.phone}</span></div>}
              {supplier.email && <div className="flex items-center gap-1"><Mail className="h-4 w-4" /><span>{supplier.email}</span></div>}
            </div>
            {supplier.address && (
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" /><span>{supplier.address}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => printFullStatement("", "")}>
            <Printer className="h-4 w-4" /> طباعة الكل
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPrintContext("all"); setIsPrintDialogOpen(true); }}>
            <Printer className="h-4 w-4" /> طباعة بفترة
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPrintContext("payments"); setIsPrintDialogOpen(true); }}>
            <Printer className="h-4 w-4" /> كشف مدفوعات
          </Button>
          {stats.remainingAmount > 0 && (
            <Button size="sm" className="gap-1" onClick={() => setBulkPaymentOpen(true)}>
              <CreditCard className="h-4 w-4" /> تسديد مجمع
            </Button>
          )}
          <Badge className={statusColors[supplier.payment_status || "paid"]}>
            {statusLabels[supplier.payment_status || "paid"]}
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><ShoppingCart className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">المشتريات</p><p className="text-2xl font-bold">{stats.totalPurchases}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><ShoppingCart className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-sm text-muted-foreground">الإجمالي</p><p className="text-lg font-bold">{formatCurrencyLYD(stats.totalAmount)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><CreditCard className="h-5 w-5 text-green-500" /></div>
            <div><p className="text-sm text-muted-foreground">المدفوع</p><p className="text-lg font-bold text-green-600">{formatCurrencyLYD(stats.paidAmount)}</p></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg"><CreditCard className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-sm text-muted-foreground">المتبقي</p><p className="text-lg font-bold text-destructive">{formatCurrencyLYD(stats.remainingAmount)}</p></div>
          </div>
        </CardContent></Card>
        {stats.totalReturns > 0 && (
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg"><RotateCcw className="h-5 w-5 text-orange-500" /></div>
              <div><p className="text-sm text-muted-foreground">المرتجعات</p><p className="text-lg font-bold text-orange-600">{formatCurrencyLYD(stats.totalReturns)}</p></div>
            </div>
          </CardContent></Card>
        )}
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><FolderOpen className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">الصافي</p><p className="text-lg font-bold">{formatCurrencyLYD(netTotal)}</p></div>
          </div>
        </CardContent></Card>
      </div>

      {/* Back Button */}
      {(selectedClientId || selectedProjectId) && (
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> رجوع
        </Button>
      )}

      {/* Search Bar */}
      {!selectedProjectId && (
        <Input
          placeholder={selectedClientId ? "بحث بالمشروع..." : "بحث بالعميل..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      )}

      {/* Level 1: Clients List */}
      {!selectedClientId && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(clientsData).filter((clientData: any) => {
            if (!searchQuery) return true;
            return clientData.client.name.toLowerCase().includes(searchQuery.toLowerCase());
          }).map((clientData: any) => {
            const remaining = clientData.totalAmount - clientData.paidAmount;
            return (
              <Card key={clientData.client.id} className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg"
                onClick={() => setSelectedClientId(clientData.client.id)}>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{clientData.client.name}</h3>
                      {clientData.client.phone && <p className="text-sm text-muted-foreground">{clientData.client.phone}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <FolderOpen className="h-3 w-3 text-orange-500" />
                        <span className="text-xl font-bold text-orange-500">{Object.keys(clientData.projects).length}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">مشروع</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ShoppingCart className="h-3 w-3 text-green-500" />
                        <span className="text-xl font-bold text-green-500">{clientData.purchaseCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">فاتورة</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">الإجمالي</span>
                      <span className="font-bold text-primary">{formatCurrencyLYD(clientData.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">المدفوع</span>
                      <span className="font-bold text-green-600">{formatCurrencyLYD(clientData.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">المتبقي</span>
                      <span className={`font-bold ${remaining > 0 ? "text-destructive" : "text-green-600"}`}>{formatCurrencyLYD(remaining)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {Object.keys(clientsData).length === 0 && (
            <div className="col-span-full text-center py-12 bg-muted/30 rounded-lg">
              <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">لا توجد مشتريات لهذا المورد</p>
            </div>
          )}
        </div>
      )}

      {/* Level 2: Projects for Selected Client */}
      {selectedClientId && !selectedProjectId && selectedClientData && (
        <div className="space-y-4">
          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-bold">{selectedClientData.client.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(selectedClientData.projects).length} مشروع • {selectedClientData.purchaseCount} فاتورة • إجمالي: {formatCurrencyLYD(selectedClientData.totalAmount)} • متبقي: {formatCurrencyLYD(selectedClientData.totalAmount - selectedClientData.paidAmount)}
                </p>
              </div>
            </div>
          </Card>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(selectedClientData.projects).filter((projectData: any) => {
              if (!searchQuery) return true;
              return projectData.project.name.toLowerCase().includes(searchQuery.toLowerCase());
            }).map((projectData: any) => {
              const remaining = projectData.totalAmount - projectData.paidAmount;
              return (
                <Card key={projectData.project.id} className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg"
                  onClick={() => setSelectedProjectId(projectData.project.id)}>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{projectData.project.name}</h3>
                        <p className="text-sm text-muted-foreground">{projectData.purchases.length} فاتورة</p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-border space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">الإجمالي</span>
                        <span className="font-bold text-primary">{formatCurrencyLYD(projectData.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">المدفوع</span>
                        <span className="font-bold text-green-600">{formatCurrencyLYD(projectData.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">المتبقي</span>
                        <span className={`font-bold ${remaining > 0 ? "text-destructive" : "text-green-600"}`}>{formatCurrencyLYD(remaining)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Level 3: Purchases for Selected Project */}
      {selectedProjectId && selectedProjectData && (
        <div className="space-y-4">
          <Card className="p-4 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-6 w-6 text-orange-500" />
                <div>
                  <h2 className="text-xl font-bold">{selectedProjectData.project.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedProjectData.purchases.length} فاتورة • إجمالي: {formatCurrencyLYD(selectedProjectData.totalAmount)} • متبقي: {formatCurrencyLYD(selectedProjectData.totalAmount - selectedProjectData.paidAmount)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => printProjectStatement("", "")}>
                  <Printer className="h-4 w-4" /> طباعة الكل
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPrintContext("project"); setIsPrintDialogOpen(true); }}>
                  <Printer className="h-4 w-4" /> طباعة بفترة
                </Button>
                <Button size="sm" className="gap-1" onClick={() => {
                  window.open(`/projects/${selectedProjectData.project.id}/purchases`, '_blank');
                }}>
                  <ShoppingCart className="h-4 w-4" /> إضافة مشترى
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10" onClick={() => setStandaloneReturnOpen(true)}>
                  <RotateCcw className="h-4 w-4" /> فاتورة ترجيع
                </Button>
              </div>
            </div>
          </Card>

          <Tabs defaultValue="purchases" className="space-y-4">
            <TabsList>
              <TabsTrigger value="purchases" className="gap-1">
                <ShoppingCart className="h-4 w-4" /> المشتريات ({selectedProjectData.purchases.filter((p: Purchase) => !p.is_return).length})
              </TabsTrigger>
              <TabsTrigger value="returns" className="gap-1">
                <RotateCcw className="h-4 w-4" /> المرتجعات ({selectedProjectData.purchases.filter((p: Purchase) => p.is_return).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>المشتريات</CardTitle>
                <Input
                  placeholder="بحث بالفاتورة أو البنود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                />
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">كل الحالات</option>
                  <option value="paid">مدفوع</option>
                  <option value="due">مستحق</option>
                  <option value="partial">مدفوع جزئياً</option>
                  <option value="processing">قيد المعالجة</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الفاتورة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">البنود</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProjectData.purchases
                    .filter((p: Purchase) => !p.is_return)
                    .filter((p: Purchase) => statusFilter === "all" || p.status === statusFilter)
                    .filter((p: Purchase) => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      const inv = (p.invoice_number || "").toLowerCase();
                      const notes = (p.notes || "").toLowerCase();
                      const items = Array.isArray(p.items) ? p.items.map((i: any) => i.name || "").join(" ").toLowerCase() : "";
                      return inv.includes(q) || notes.includes(q) || items.includes(q);
                    })
                    .map((purchase: Purchase) => {
                      const remaining = Number(purchase.total_amount) - Number(purchase.paid_amount || 0);
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">
                            {purchase.invoice_number || "-"}
                          </TableCell>
                          <TableCell>{purchase.date}</TableCell>
                          <TableCell>
                            {Array.isArray(purchase.items) && purchase.items.length > 0 ? (
                              <div className="space-y-1">
                                {purchase.items.slice(0, 3).map((item: any, idx: number) => (
                                  <div key={idx} className="text-sm">{item.name} ({item.qty} × {formatCurrencyLYD(item.price)})</div>
                                ))}
                                {purchase.items.length > 3 && <div className="text-xs text-muted-foreground">+{purchase.items.length - 3} بنود أخرى</div>}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="font-bold text-primary">{formatCurrencyLYD(purchase.total_amount)}</TableCell>
                          <TableCell className="text-green-600 font-medium">{formatCurrencyLYD(purchase.paid_amount || 0)}</TableCell>
                          <TableCell className={remaining > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {remaining > 0 ? formatCurrencyLYD(remaining) : "-"}
                          </TableCell>
                          <TableCell><Badge className={statusColors[purchase.status]}>{statusLabels[purchase.status]}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {remaining > 0 && (
                                <Button variant="outline" size="sm" onClick={() => setPaymentPurchase(purchase)} className="text-xs">
                                  <CreditCard className="h-3 w-3 ml-1" /> تسديد
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => setReturnPurchase(purchase)}
                                className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50">
                                <RotateCcw className="h-3 w-3 ml-1" /> مرتجع
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              {selectedProjectData.purchases.filter((p: Purchase) => !p.is_return && (statusFilter === "all" || p.status === statusFilter)).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">لا توجد مشتريات بهذه الحالة</div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="returns">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-orange-500" />
                    فواتير المرتجعات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProjectData.purchases.filter((p: Purchase) => p.is_return).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الفاتورة</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">البنود المرتجعة</TableHead>
                          <TableHead className="text-right">قيمة المرتجع</TableHead>
                          <TableHead className="text-right">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProjectData.purchases
                          .filter((p: Purchase) => p.is_return)
                          .map((purchase: Purchase) => (
                            <TableRow key={purchase.id} className="bg-orange-500/5">
                              <TableCell className="font-medium">{purchase.invoice_number || "-"}</TableCell>
                              <TableCell>{purchase.date}</TableCell>
                              <TableCell>
                                {Array.isArray(purchase.items) && purchase.items.slice(0, 3).map((item: any, idx: number) => (
                                  <div key={idx} className="text-sm">{item.name} ({item.qty})</div>
                                ))}
                              </TableCell>
                              <TableCell className="font-bold text-orange-600">{formatCurrencyLYD(purchase.total_amount)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{purchase.notes || "-"}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>لا توجد فواتير مرتجعات</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Payment Dialog */}
      <SupplierPaymentDialog
        open={!!paymentPurchase}
        onOpenChange={(open) => !open && setPaymentPurchase(null)}
        purchase={paymentPurchase ? {
          id: paymentPurchase.id, invoice_number: paymentPurchase.invoice_number,
          total_amount: paymentPurchase.total_amount, paid_amount: paymentPurchase.paid_amount || 0,
          treasury_id: paymentPurchase.treasury_id, supplier_name: supplier?.name,
        } : null}
      />

      {/* Return Dialog */}
      <SupplierReturnDialog
        open={!!returnPurchase}
        onOpenChange={(open) => !open && setReturnPurchase(null)}
        purchase={returnPurchase ? {
          id: returnPurchase.id, project_id: returnPurchase.project_id,
          phase_id: returnPurchase.phase_id, supplier_id: returnPurchase.supplier_id,
          invoice_number: returnPurchase.invoice_number, total_amount: returnPurchase.total_amount,
          items: returnPurchase.items, treasury_id: returnPurchase.treasury_id,
          supplier_name: supplier?.name,
        } : null}
      />

      {/* Print Date Range Dialog */}
      <PrintDateRangeDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        title={printContext === "payments" ? "طباعة كشف مدفوعات" : printContext === "project" ? "طباعة كشف مشروع" : "طباعة كشف حساب"}
        onPrint={handlePrintByRange}
      />

      {/* Standalone Return Dialog */}
      {selectedProjectId && (
        <StandaloneReturnDialog
          open={standaloneReturnOpen}
          onOpenChange={setStandaloneReturnOpen}
          projectId={selectedProjectId}
          defaultSupplierId={id}
        />
      )}
      {/* Bulk Payment Dialog */}
      {supplier && (
        <SupplierBulkPaymentDialog
          open={bulkPaymentOpen}
          onOpenChange={setBulkPaymentOpen}
          supplierId={supplier.id}
          supplierName={supplier.name}
          purchases={(purchases || []).filter(p => !p.is_return).map(p => ({
            id: p.id,
            invoice_number: p.invoice_number,
            total_amount: p.total_amount,
            paid_amount: p.paid_amount,
            date: p.date,
            status: p.status,
          }))}
        />
      )}
    </div>
  );
};

export default SupplierDetail;
