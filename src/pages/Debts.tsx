import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  Users,
  Coins,
  Search,
  Printer,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
  Clock,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { openPrintWindow } from "@/lib/printStyles";
import { calculateProjectFinancials } from "@/lib/financialCore";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  project_type: string;
  client_id: string | null;
  reference_number?: string | null;
  code?: string | null;
  finishing_percentage?: number | null;
  budget?: number | null;
};

type Phase = {
  id: string;
  project_id: string;
  name: string;
  phase_number: number | null;
  reference_number: string | null;
  has_percentage: boolean;
  percentage_value: number;
  created_at: string;
};

type ProjectItem = {
  id: string;
  phase_id: string;
  total_price: number;
  created_at: string;
};

type Purchase = {
  id: string;
  project_id?: string | null;
  phase_id?: string | null;
  total_amount: number;
  rental_id?: string | null;
  created_at: string;
};

type ClientPayment = {
  id: string;
  client_id: string;
  amount: number;
  date: string;
  created_at: string;
};

const formatRelativeDays = (dateStr: string | null) => {
  if (!dateStr) return "---";
  const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return "اليوم";
  if (diffDays === 1) return "منذ يوم";
  if (diffDays === 2) return "منذ يومين";
  if (diffDays <= 10) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${diffDays} يوماً`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "منذ شهر";
  if (diffMonths === 2) return "منذ شهرين";
  if (diffMonths <= 10) return `منذ ${diffMonths} أشهر`;
  return `منذ ${diffMonths} شهراً`;
};

export default function Debts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDebtorsOnly, setFilterDebtorsOnly] = useState(true);

  // Fetch all required data
  const { data: clients, isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["all-clients-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["all-projects-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: phases } = useQuery<Phase[]>({
    queryKey: ["all-phases-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: projectItems } = useQuery<ProjectItem[]>({
    queryKey: ["all-items-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_items").select("id, project_id, phase_id, total_price, created_at");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: purchases } = useQuery<Purchase[]>({
    queryKey: ["all-purchases-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("id, project_id, phase_id, total_amount, paid_amount, purchase_type, supplier_id, technician_id, rental_id, created_at");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["all-expenses-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id, project_id, amount");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: techProgressRecords } = useQuery({
    queryKey: ["all-tech-progress-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technician_progress_records").select("id, earned_amount, project_id, phase_id, project_item_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientPayments } = useQuery<ClientPayment[]>({
    queryKey: ["all-payments-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_payments").select("id, client_id, project_id, amount, date, created_at").order("date", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["all-contracts-debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id, client_id, project_id, amount, status");
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Calculate debts per client using Central Financial Domain
  const clientsDebtsList = useMemo(() => {
    if (!clients || !projects || !phases || !projectItems || !purchases || !clientPayments) return [];

    return clients.map((client) => {
      const clientProjList = projects.filter((p) => p.client_id === client.id);
      const clientContracts = (contracts || []).filter(c => c.client_id === client.id && c.status !== "cancelled");

      let totalBilled = 0;

      clientProjList.forEach((proj) => {
        const projPurchases = purchases.filter((p) => p.project_id === proj.id);
        const projItems = projectItems.filter((item: any) => item.project_id === proj.id);
        const projContracts = clientContracts.filter(
          (c) => c.project_id === proj.id || (!c.project_id && proj.project_type === "contracting")
        );
        const projExpenses = (expenses || []).filter((e: any) => e.project_id === proj.id);
        const projTech = (techProgressRecords || []).filter((r: any) => (r.project_id || r.project_items?.project_id) === proj.id);
        const projPayments = clientPayments.filter((p: any) => p.project_id === proj.id);

        const projResult = calculateProjectFinancials({
          project: proj,
          contracts: projContracts,
          projectItems: projItems,
          purchases: projPurchases,
          techProgressRecords: projTech,
          expenses: projExpenses,
          clientPayments: projPayments,
        });

        totalBilled += projResult.clientObligation;
      });

      const clientPaymentsList = clientPayments.filter((cp) => cp.client_id === client.id);
      const totalPaid = clientPaymentsList.reduce((sum, cp) => sum + Number(cp.amount || 0), 0);

      const debt = totalBilled - totalPaid;

      // Latest payment date
      let lastPaymentDate: string | null = null;
      if (clientPaymentsList.length > 0) {
        lastPaymentDate = clientPaymentsList[0].date;
      }

      // Latest phase/invoice entry date
      let lastInvoiceDate: string | null = null;
      const clientPhases = (phases || []).filter(ph => clientProjList.some(p => p.id === ph.project_id));
      const phaseDates = clientPhases.map((ph) => ph.created_at).filter(Boolean);
      if (phaseDates.length > 0) {
        phaseDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        lastInvoiceDate = phaseDates[0];
      }

      return {
        client,
        projects: clientProjList,
        totalBilled,
        totalPaid,
        debt,
        lastPaymentDate,
        lastInvoiceDate,
      };
    });
  }, [clients, projects, phases, projectItems, purchases, clientPayments, contracts]);

  // Filter and sort
  const filteredAndSortedDebts = useMemo(() => {
    let result = [...clientsDebtsList];

    if (filterDebtorsOnly) {
      result = result.filter((d) => d.debt > 0);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.client.name.toLowerCase().includes(q) ||
          d.projects.some((p) => p.name.toLowerCase().includes(q))
      );
    }

    // Sort by highest debt descending
    return result.sort((a, b) => b.debt - a.debt);
  }, [clientsDebtsList, filterDebtorsOnly, searchQuery]);

  // Stats
  const totalDebtsSum = useMemo(() => {
    return clientsDebtsList.filter((d) => d.debt > 0).reduce((sum, d) => sum + d.debt, 0);
  }, [clientsDebtsList]);

  const debtorsCount = useMemo(() => {
    return clientsDebtsList.filter((d) => d.debt > 0).length;
  }, [clientsDebtsList]);

  // Print function
  const handlePrintDebts = () => {
    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });
    let rowsHTML = "";

    filteredAndSortedDebts.forEach((d, idx) => {
      const debtStatus = d.debt > 5000 ? "متأخر جداً" : "معلق";
      const delayColor = d.debt > 5000 ? "color: red; font-weight: bold;" : "";
      
      rowsHTML += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${d.client.name}</td>
          <td>${d.projects.map((p) => p.name).join(" - ") || "-"}</td>
          <td style="text-align: center; font-weight: bold;">${d.totalBilled.toLocaleString()} د.ل</td>
          <td style="text-align: center; color: green;">${d.totalPaid.toLocaleString()} د.ل</td>
          <td style="text-align: center; ${delayColor}">${d.debt.toLocaleString()} د.ل</td>
          <td style="text-align: center; font-size: 9.5pt;">${d.lastPaymentDate ? `${format(new Date(d.lastPaymentDate), "yyyy/MM/dd")} (${formatRelativeDays(d.lastPaymentDate)})` : "لم يسدد"}</td>
          <td style="text-align: center; font-size: 9.5pt;">${d.lastInvoiceDate ? `${format(new Date(d.lastInvoiceDate), "yyyy/MM/dd")} (${formatRelativeDays(d.lastInvoiceDate)})` : "لا توجد"}</td>
        </tr>
      `;
    });

    const printHTML = `
      <style>
        .debts-print-container {
          direction: rtl;
          font-family: 'Tajawal', sans-serif;
          color: #000;
        }
        .debts-print-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .debts-print-table th, .debts-print-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          font-size: 10pt;
        }
        .debts-print-table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
      </style>
      <div class="debts-print-container">
        <h2 style="text-align: center; margin-bottom: 20px; font-weight: bold;">تقرير ديون وذمم العملاء المستحقة</h2>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold;">
          <div>إجمالي الديون المعلقة: ${totalDebtsSum.toLocaleString()} د.ل</div>
          <div>عدد المدينين: ${debtorsCount}</div>
          <div>التاريخ: ${dateStr}</div>
        </div>
        <table class="debts-print-table">
          <thead>
            <tr>
              <th style="width: 5%;">ر.م</th>
              <th>العميل</th>
              <th>المشاريع</th>
              <th style="width: 13%;">المطالبات</th>
              <th style="width: 13%;">المسدد</th>
              <th style="width: 14%;">الدين المستحق</th>
              <th style="width: 17%;">آخر سداد</th>
              <th style="width: 17%;">آخر فاتورة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    `;

    openPrintWindow("تقرير ديون وذمم العملاء", printHTML, companySettings);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Page Title */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-[#d6ac40]" />
            ديون وذمم العملاء
          </h1>
          <p className="text-muted-foreground mt-1">
            متابعة المبالغ المستحقة المتأخرة والذمم على الزبائن مرتبة من الأعلى ديناً
          </p>
        </div>
        <Button onClick={handlePrintDebts} className="gap-2 shrink-0 cursor-pointer">
          <Printer className="h-4 w-4" />
          <span>طباعة تقرير الديون</span>
        </Button>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-[#d6ac40]/30 bg-gradient-to-br from-[#d6ac40]/5 via-background to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              إجمالي الديون المستحقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-red-600 dark:text-red-400">
                {totalDebtsSum.toLocaleString()} د.ل
              </span>
              <Coins className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              مجموع المطالبات والبنود المنجزة غير المسددة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              عدد العملاء المدينين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-foreground">
                {debtorsCount} زبون
              </span>
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              إجمالي العملاء المسجلين ولديهم ديون معلقة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              حالة التحصيل المالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-green-600">
                نشط
              </span>
              <TrendingDown className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              متابعة وجدولة السداد لضمان التدفق النقدي
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم الزبون أو المشروع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filterDebtorsOnly ? "default" : "outline"}
                onClick={() => setFilterDebtorsOnly(true)}
                className="text-xs h-9 cursor-pointer"
              >
                المدينين فقط
              </Button>
              <Button
                variant={!filterDebtorsOnly ? "default" : "outline"}
                onClick={() => setFilterDebtorsOnly(false)}
                className="text-xs h-9 cursor-pointer"
              >
                كل الزبائن
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[60px]">ر.م</TableHead>
                  <TableHead className="text-right">الزبون / العميل</TableHead>
                  <TableHead className="text-right">المشاريع</TableHead>
                  <TableHead className="text-center w-[130px]">المطالبات</TableHead>
                  <TableHead className="text-center w-[130px]">المسدد</TableHead>
                  <TableHead className="text-center w-[140px]">الدين المستحق</TableHead>
                  <TableHead className="text-center w-[200px]">آخر سداد (التأخير)</TableHead>
                  <TableHead className="text-center w-[200px]">آخر فاتورة (التراكم)</TableHead>
                  <TableHead className="text-left w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingClients ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      جاري تحميل بيانات الديون...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedDebts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      لا توجد ديون مستحقة مطابقة للبحث
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedDebts.map((d, index) => {
                    const isDebtHigh = d.debt > 5000;
                    
                    return (
                      <TableRow key={d.client.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-right">{index + 1}</TableCell>
                        <TableCell>
                          <Link
                            to={`/clients/${d.client.id}`}
                            className="font-bold text-foreground hover:text-primary hover:underline flex items-center gap-1 w-fit cursor-pointer"
                          >
                            {d.client.name}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </Link>
                          {d.client.phone && (
                            <span className="text-xs text-muted-foreground block">
                              {d.client.phone}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {d.projects.map((p) => (
                              <Badge key={p.id} variant="secondary" className="text-xs">
                                {p.name}
                              </Badge>
                            )) || "---"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {d.totalBilled.toLocaleString()} د.ل
                        </TableCell>
                        <TableCell className="text-center text-green-600 dark:text-green-400">
                          {d.totalPaid.toLocaleString()} د.ل
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-extrabold text-sm ${
                              d.debt > 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            }`}
                          >
                            {d.debt > 0 ? "+" : ""}
                            {d.debt.toLocaleString()} د.ل
                          </span>
                        </TableCell>
                        {/* Last Payment delay */}
                        <TableCell className="text-center">
                          {d.lastPaymentDate ? (
                            <div className="space-y-1">
                              <span className="text-xs font-semibold block">
                                {format(new Date(d.lastPaymentDate), "yyyy/MM/dd")}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0 flex items-center gap-1 w-fit mx-auto ${
                                  isDebtHigh
                                    ? "border-red-500/30 bg-red-500/5 text-red-600"
                                    : "border-[#d6ac40]/30 bg-[#d6ac40]/5 text-[#b8860b]"
                                }`}
                              >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>{formatRelativeDays(d.lastPaymentDate)}</span>
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic font-semibold">
                              لم يسدد مسبقاً
                            </span>
                          )}
                        </TableCell>
                        {/* Last Invoice delay */}
                        <TableCell className="text-center">
                          {d.lastInvoiceDate ? (
                            <div className="space-y-1">
                              <span className="text-xs font-semibold block">
                                {format(new Date(d.lastInvoiceDate), "yyyy/MM/dd")}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0 flex items-center gap-1 w-fit mx-auto border-muted bg-muted/20 text-muted-foreground"
                              >
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>{formatRelativeDays(d.lastInvoiceDate)}</span>
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              لا توجد فواتير
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              toast({
                                title: "تقرير ذمة",
                                description: `تم فتح تفاصيل حساب الزبون ${d.client.name}`,
                              });
                            }}
                            asChild
                            className="cursor-pointer"
                          >
                            <Link to={`/clients/${d.client.id}`}>
                              <ChevronLeft className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
