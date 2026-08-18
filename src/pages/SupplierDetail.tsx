import React, { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeterministicBreadcrumb } from "@/components/navigation/DeterministicBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Building2, User, Phone, Mail, MapPin, Truck, ShoppingCart, 
  Receipt, Wallet, Printer, Search, ArrowRight, ChevronDown, ChevronUp,
  Layers, CheckCircle2, AlertCircle, FileText, Sparkles, Plus, Eye
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openReceiptPrintWindow, openPrintWindow } from "@/lib/printStyles";
import { SupplierProjectSettlementDrawer } from "@/components/suppliers/SupplierProjectSettlementDrawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectGroup {
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientId: string;
  clientName: string;
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  purchases: any[];
  payments: any[];
}

interface ClientGroup {
  clientId: string;
  clientName: string;
  totalDue: number;
  projects: ProjectGroup[];
}

export default function SupplierDetail() {
  const { id, projectId } = useParams<{ id: string; projectId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"projects" | "statement">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedProjectInvoices, setExpandedProjectInvoices] = useState<Record<string, boolean>>({});

  // Auto expand project if projectId route param is present
  useEffect(() => {
    if (projectId) {
      setExpandedProjectInvoices((prev) => ({ ...prev, [projectId]: true }));
    }
  }, [projectId]);

  // Drawer state
  const [selectedDrawerProject, setSelectedDrawerProject] = useState<ProjectGroup | null>(null);

  // Fetch supplier base data
  const { data: supplier, isLoading: loadingSupplier, error: supplierError } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all purchases for this supplier with project & client data
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["supplier-purchases-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          id,
          invoice_number,
          title,
          date,
          total_amount,
          paid_amount,
          status,
          notes,
          project_id,
          projects (
            id,
            name,
            project_type,
            client_id,
            clients (
              id,
              name
            )
          )
        `)
        .eq("supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch all payments for this supplier's purchases
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["supplier-payments-list", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_payments")
        .select(`
          id,
          purchase_id,
          amount,
          date,
          payment_method,
          notes,
          treasuries (
            id,
            name,
            treasury_type,
            project_category
          ),
          purchases!inner (
            id,
            supplier_id,
            invoice_number,
            title,
            project_id,
            projects (
              id,
              name,
              project_type,
              client_id,
              clients (
                id,
                name
              )
            )
          )
        `)
        .eq("purchases.supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Company settings for receipt printing
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

  // Compute Client -> Project Hierarchy
  const { clientGroups, globalPurchases, globalPaid, globalDue } = useMemo(() => {
    let gPurchases = 0;
    let gPaid = 0;

    const projectMap = new Map<string, ProjectGroup>();

    // 1. Group Purchases by Project
    purchases.forEach((p: any) => {
      const pAmt = Number(p.total_amount || 0);
      gPurchases += pAmt;

      const projId = p.project_id || "unassigned";
      const projName = p.projects?.name || "مشتريات عامة بدون مشروع";
      const projType = (p.projects?.project_type || "contracting") as "contracting" | "finishing";
      const cliId = p.projects?.clients?.id || "unassigned";
      const cliName = p.projects?.clients?.name || "بدون زبون محدد";

      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          projectId: projId,
          projectName: projName,
          projectType: projType,
          clientId: cliId,
          clientName: cliName,
          totalPurchases: 0,
          totalPaid: 0,
          totalDue: 0,
          purchases: [],
          payments: [],
        });
      }

      const group = projectMap.get(projId)!;
      group.totalPurchases += pAmt;
      group.purchases.push(p);
    });

    // 2. Attach Payments to Projects
    payments.forEach((pay: any) => {
      const payAmt = Number(pay.amount || 0);
      gPaid += payAmt;

      const projId = pay.purchases?.project_id || "unassigned";
      if (projectMap.has(projId)) {
        const group = projectMap.get(projId)!;
        group.totalPaid += payAmt;
        group.payments.push(pay);
      }
    });

    // 3. Finalize Project Dues
    projectMap.forEach((grp) => {
      grp.totalDue = Math.max(0, grp.totalPurchases - grp.totalPaid);
    });

    // 4. Group Projects into Clients
    const clientMap = new Map<string, ClientGroup>();
    projectMap.forEach((projGrp) => {
      const cId = projGrp.clientId;
      if (!clientMap.has(cId)) {
        clientMap.set(cId, {
          clientId: cId,
          clientName: projGrp.clientName,
          totalDue: 0,
          projects: [],
        });
      }
      const cGrp = clientMap.get(cId)!;
      cGrp.projects.push(projGrp);
      cGrp.totalDue += projGrp.totalDue;
    });

    const cList = Array.from(clientMap.values());
    const gDue = Math.max(0, gPurchases - gPaid);

    return {
      clientGroups: cList,
      globalPurchases: gPurchases,
      globalPaid: gPaid,
      globalDue: gDue,
    };
  }, [purchases, payments]);

  // Filter Client/Project by Search Query
  const filteredClientGroups = useMemo(() => {
    if (!searchQuery.trim()) return clientGroups;
    const q = searchQuery.trim().toLowerCase();

    return clientGroups
      .map((c) => {
        const matchingProjects = c.projects.filter(
          (p) =>
            p.projectName.toLowerCase().includes(q) ||
            p.clientName.toLowerCase().includes(q) ||
            p.purchases.some((item) =>
              (item.invoice_number && item.invoice_number.toLowerCase().includes(q)) ||
              (item.title && item.title.toLowerCase().includes(q))
            )
        );

        if (c.clientName.toLowerCase().includes(q)) {
          return c;
        }

        if (matchingProjects.length > 0) {
          return {
            ...c,
            projects: matchingProjects,
          };
        }

        return null;
      })
      .filter(Boolean) as ClientGroup[];
  }, [clientGroups, searchQuery]);

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === undefined ? false : !prev[clientId],
    }));
  };

  const toggleProjectInvoices = (projectId: string) => {
    setExpandedProjectInvoices((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handlePrintStatement = () => {
    const htmlContent = `
      <div class="print-area">
        <div class="print-report-header">
          <div class="print-report-title">كشف حساب المورد: ${supplier?.name || ""}</div>
          <div class="print-report-meta">التاريخ: ${new Date().toLocaleDateString("ar-LY")}</div>
        </div>
        <div class="print-content">
          <table class="print-info-table">
            <tr>
              <td class="info-label">إجمالي المشتريات</td>
              <td class="info-value">${formatCurrencyLYD(globalPurchases)}</td>
              <td class="info-label">إجمالي المسدد</td>
              <td class="info-value">${formatCurrencyLYD(globalPaid)}</td>
            </tr>
            <tr>
              <td class="info-label">المتبقي المستحق</td>
              <td class="info-value" colspan="3">${formatCurrencyLYD(globalDue)}</td>
            </tr>
          </table>
        </div>
      </div>
    `;
    openPrintWindow(`كشف حساب المورد: ${supplier?.name || ""}`, htmlContent, companySettings);
  };

  if (loadingSupplier) {
    return (
      <div className="space-y-4 p-6" dir="rtl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (supplierError || !supplier) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-bold text-foreground">تعذر العثور على المورد</h3>
        <p className="text-sm text-muted-foreground mt-1">المورد المطلوب غير موجود أو تم حذفه.</p>
        <Button className="mt-4" onClick={() => navigate("/suppliers")}>
          العودة لقائمة الموردين
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6" dir="rtl">
      {/* Breadcrumb Navigation */}
      <DeterministicBreadcrumb
        items={[
          { label: "الموردون", href: "/suppliers" },
          { label: supplier?.name || "تفاصيل المورد", isCurrent: true },
        ]}
        fallbackBackHref="/suppliers"
      />

      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-amber-600" />
            <span>{supplier.name}</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {supplier.category && <Badge variant="secondary">{supplier.category}</Badge>}
            {supplier.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">{supplier.phone}</span>
              </span>
            )}
            {supplier.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{supplier.address}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintStatement} className="gap-1.5 text-xs">
            <Printer className="h-4 w-4" />
            <span>طباعة كشف الحساب</span>
          </Button>
        </div>
      </div>

      {/* Top Reconciled Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">إجمالي المشتريات</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(globalPurchases)}
          </p>
          <span className="text-[11px] text-muted-foreground">مجموع الفواتير بكافة المشاريع</span>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">إجمالي المسدد</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2" dir="ltr">
            {formatCurrencyLYD(globalPaid)}
          </p>
          <span className="text-[11px] text-muted-foreground">سندات الصرف المسجلة</span>
        </Card>

        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-bold">صافي المتبقي للمورد</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400 mt-2" dir="ltr">
            {formatCurrencyLYD(globalDue)}
          </p>
          <span className="text-[11px] text-amber-700/80">المستحق واجب التسوية</span>
        </Card>
      </div>

      {/* Tabs Layout: Projects & Clients (Default) vs Statement */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="projects" className="rounded-lg text-xs font-semibold gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span>المشاريع والزبائن</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                {purchases.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="statement" className="rounded-lg text-xs font-semibold gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>سجل السندات والعمليات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                {payments.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Instant Search Bar */}
          {activeTab === "projects" && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الزبون أو المشروع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-9 text-xs rounded-xl"
              />
            </div>
          )}
        </div>

        {/* TAB 1: CLIENTS -> PROJECTS HIERARCHY */}
        <TabsContent value="projects" className="space-y-4 mt-2">
          {loadingPurchases ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : filteredClientGroups.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-dashed">
              <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-foreground">لا توجد مشتريات أو مشاريع مسجلة</h4>
              <p className="text-xs text-muted-foreground mt-1">لم يتم تسجيل أي فواتير مواد لهذا المورد حتى الآن.</p>
            </Card>
          ) : (
            filteredClientGroups.map((client) => {
              const isClientExpanded = expandedClients[client.clientId] !== false; // expanded by default

              return (
                <Card
                  key={client.clientId}
                  className="rounded-2xl border border-border/60 shadow-sm overflow-hidden bg-card/60"
                >
                  {/* Client Group Header */}
                  <div
                    className="p-3.5 bg-muted/20 border-b border-border/40 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleClientExpand(client.clientId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>{client.clientName}</span>
                          <Badge variant="outline" className="text-[10px] font-normal py-0">
                            {client.projects.length} مشاريع
                          </Badge>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-[10px] text-muted-foreground block">مستحق الزبون للمورد</span>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400" dir="ltr">
                          {formatCurrencyLYD(client.totalDue)}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        {isClientExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Projects under this Client */}
                  {isClientExpanded && (
                    <div className="p-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                      {client.projects.map((proj) => {
                        const isInvoicesExpanded = !!expandedProjectInvoices[proj.projectId];

                        return (
                          <div
                            key={proj.projectId}
                            className="p-4 rounded-xl border border-border/60 bg-card hover:border-amber-500/30 transition-all flex flex-col justify-between"
                          >
                            <div>
                              {/* Project Title & Badge */}
                              <div className="flex items-start justify-between gap-2 mb-2.5">
                                <div>
                                  <Link
                                    to={`/projects/${proj.projectId}`}
                                    className="font-bold text-sm text-foreground hover:text-amber-600 transition-colors flex items-center gap-1.5"
                                  >
                                    <Layers className="h-3.5 w-3.5 text-amber-600" />
                                    <span>{proj.projectName}</span>
                                  </Link>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 shrink-0 ${
                                    proj.projectType === "contracting"
                                      ? "border-amber-500/30 text-amber-700 bg-amber-500/10 font-bold"
                                      : "border-purple-500/30 text-purple-700 bg-purple-500/10 font-bold"
                                  }`}
                                >
                                  {proj.projectType === "contracting" ? "مقاولات" : "تشطيبات"}
                                </Badge>
                              </div>

                              {/* Project Metrics Box */}
                              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center mb-3">
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">المشتريات</span>
                                  <span className="text-xs font-bold text-foreground" dir="ltr">
                                    {formatCurrencyLYD(proj.totalPurchases)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">المسدد</span>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                                    {formatCurrencyLYD(proj.totalPaid)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">المتبقي</span>
                                  <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400" dir="ltr">
                                    {formatCurrencyLYD(proj.totalDue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Invoices Accordion */}
                            <div>
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                                  onClick={() => toggleProjectInvoices(proj.projectId)}
                                >
                                  {isInvoicesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  <span>فواتير المشروع ({proj.purchases.length})</span>
                                </Button>

                                <Button
                                  size="sm"
                                  className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 text-xs px-3 shadow-sm"
                                  onClick={() => setSelectedDrawerProject(proj)}
                                  disabled={proj.totalDue <= 0}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>سداد ({formatCurrencyLYD(proj.totalDue)})</span>
                                </Button>
                              </div>

                              {/* Collapsible Invoices List */}
                              {isInvoicesExpanded && (
                                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                                  {proj.purchases.map((pur: any) => {
                                    const remaining = Number(pur.total_amount || 0) - Number(pur.paid_amount || 0);
                                    return (
                                      <div
                                        key={pur.id}
                                        className="p-2 rounded-lg bg-card border border-border/40 text-xs flex items-center justify-between gap-2"
                                      >
                                        <div>
                                          <div className="font-semibold text-foreground">
                                            {pur.title || (pur.invoice_number ? `فاتورة رقم: ${pur.invoice_number}` : "فاتورة توريد")}
                                          </div>
                                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                            <span>{pur.date}</span>
                                            <span>•</span>
                                            <span>المبلغ: {formatCurrencyLYD(pur.total_amount)}</span>
                                          </div>
                                        </div>

                                        <div className="text-left shrink-0">
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] ${
                                              remaining <= 0
                                                ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                                : "border-amber-500/30 text-amber-700 bg-amber-500/10 font-bold"
                                            }`}
                                          >
                                            {remaining <= 0 ? "مدفوعة بالكامل" : `متبقي: ${formatCurrencyLYD(remaining)}`}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* TAB 2: FULL CHRONOLOGICAL STATEMENT */}
        <TabsContent value="statement" className="mt-2">
          <Card className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">
            <CardHeader className="p-4 bg-muted/20 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-600" />
                <span>سجل سندات الصرف والدفعات المباشرة</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {payments.length} سندات سداد
              </Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">الفاتورة / المرجع</TableHead>
                    <TableHead className="text-right">الخزينة المخصوم منها</TableHead>
                    <TableHead className="text-right">طريقة الدفع</TableHead>
                    <TableHead className="text-right">المبلغ المسدد</TableHead>
                    <TableHead className="text-center">إيصال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        لا توجد سندات سداد مسجلة لهذا المورد.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((pay: any) => (
                      <TableRow key={pay.id}>
                        <TableCell className="font-medium">{pay.date}</TableCell>
                        <TableCell>{pay.purchases?.projects?.name || "—"}</TableCell>
                        <TableCell>
                          {pay.purchases?.title || (pay.purchases?.invoice_number ? `فاتورة: ${pay.purchases.invoice_number}` : "فاتورة شراء")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {pay.treasuries?.name || "خزينة المشروع"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pay.payment_method === "cash" ? "نقدي" : pay.payment_method === "transfer" ? "تحويل مصرفي" : "شيك"}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                          {formatCurrencyLYD(pay.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              openReceiptPrintWindow(
                                {
                                  receiptNumber: `PAY-${pay.id.slice(0, 8)}`,
                                  date: pay.date,
                                  type: "payment",
                                  amount: Number(pay.amount || 0),
                                  paidToOrBy: supplier.name,
                                  description: pay.notes || `سداد مستحقات توريد مواد`,
                                  projectName: pay.purchases?.projects?.name,
                                },
                                companySettings
                              )
                            }
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FAST PROJECT SETTLEMENT DRAWER */}
      {selectedDrawerProject && (
        <SupplierProjectSettlementDrawer
          isOpen={!!selectedDrawerProject}
          onClose={() => setSelectedDrawerProject(null)}
          supplierId={supplier.id}
          supplierName={supplier.name}
          projectId={selectedDrawerProject.projectId}
          projectName={selectedDrawerProject.projectName}
          projectType={selectedDrawerProject.projectType}
          clientName={selectedDrawerProject.clientName}
          totalPurchases={selectedDrawerProject.totalPurchases}
          totalPaid={selectedDrawerProject.totalPaid}
          totalDue={selectedDrawerProject.totalDue}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["supplier-purchases-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", id] });
          }}
        />
      )}
    </div>
  );
}
