import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import {
  Search,
  FolderKanban,
  FileText,
  DollarSign,
  ShoppingCart,
  Receipt,
  Wrench,
  ArrowRight,
  Users,
  TrendingUp,
  Activity,
  Plus,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import QuickAddSection from "@/components/client-activities/QuickAddSection";
import { useIsMobile } from "@/hooks/use-mobile";

interface ActivityRecord {
  id: string;
  type: "project" | "contract" | "payment" | "purchase" | "expense" | "rental";
  title: string;
  description: string;
  amount: number | null;
  date: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  status: string | null;
}

const typeLabels: Record<string, string> = {
  project: "مشروع",
  contract: "عقد",
  payment: "دفعة",
  purchase: "مشتريات",
  expense: "مصروف",
  rental: "إيجار",
};

const typeIcons: Record<string, any> = {
  project: FolderKanban,
  contract: FileText,
  payment: DollarSign,
  purchase: ShoppingCart,
  expense: Receipt,
  rental: Wrench,
};

const typeColors: Record<string, string> = {
  project: "bg-blue-500/10 text-blue-600 border-blue-200",
  contract: "bg-purple-500/10 text-purple-600 border-purple-200",
  payment: "bg-green-500/10 text-green-600 border-green-200",
  purchase: "bg-orange-500/10 text-orange-600 border-orange-200",
  expense: "bg-red-500/10 text-red-600 border-red-200",
  rental: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
};

const statusColors: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-700 border-blue-200",
  completed: "bg-green-500/10 text-green-700 border-green-200",
  paid: "bg-green-500/10 text-green-700 border-green-200",
  partial: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  pending: "bg-muted text-muted-foreground",
  due: "bg-red-500/10 text-red-700 border-red-200",
  advance: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
};

const statusLabels: Record<string, string> = {
  active: "نشط",
  completed: "مكتمل",
  paid: "مدفوع",
  partial: "جزئي",
  pending: "قيد الانتظار",
  due: "مستحق",
  advance: "على الحساب",
};

const ITEMS_PER_PAGE = 25;

const ClientActivities = () => {
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const isMobile = useIsMobile();

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects with clients
  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["all-projects-with-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, created_at, budget, client_id, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch contracts
  const { data: contracts, isLoading: loadingContracts } = useQuery({
    queryKey: ["all-contracts-with-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, title, status, start_date, amount, client_id, clients(name), project_id, projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch payments
  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["all-client-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, amount, date, notes, payment_method, payment_type, client_id, clients(name), project_id, projects(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchases linked to client projects
  const { data: purchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ["all-purchases-client-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, date, invoice_number, status, project_id, projects(name, client_id, clients(name))")
        .not("project_id", "is", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch expenses linked to client projects
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["all-expenses-client-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, date, description, type, project_id, projects(name, client_id, clients(name))")
        .not("project_id", "is", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch rentals linked to client projects
  const { data: rentals, isLoading: loadingRentals } = useQuery({
    queryKey: ["all-rentals-client-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select("id, total_amount, start_date, status, equipment_id, equipment(name), project_id, projects(name, client_id, clients(name))")
        .not("project_id", "is", null)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingProjects || loadingContracts || loadingPayments || loadingPurchases || loadingExpenses || loadingRentals;

  // Combine all activities
  const activities: ActivityRecord[] = useMemo(() => {
    const result: ActivityRecord[] = [];

    projects?.forEach((p: any) => {
      result.push({
        id: p.id,
        type: "project",
        title: p.name,
        description: `مشروع - ${p.status === 'active' ? 'نشط' : p.status === 'completed' ? 'مكتمل' : 'قيد الانتظار'}`,
        amount: p.budget,
        date: p.created_at,
        clientId: p.client_id || null,
        clientName: p.clients?.name || null,
        projectId: p.id,
        projectName: p.name,
        status: p.status,
      });
    });

    contracts?.forEach((c: any) => {
      result.push({
        id: c.id,
        type: "contract",
        title: c.title,
        description: `عقد ${c.contract_number || ""}`,
        amount: c.amount,
        date: c.start_date,
        clientId: c.client_id || null,
        clientName: c.clients?.name || null,
        projectId: c.project_id,
        projectName: c.projects?.name || null,
        status: c.status,
      });
    });

    payments?.forEach((p: any) => {
      const isAdvance = p.payment_type === 'advance';
      result.push({
        id: p.id,
        type: "payment",
        title: isAdvance
          ? `دفعة على الحساب - ${p.payment_method === 'cash' ? 'نقدي' : p.payment_method === 'bank_transfer' ? 'تحويل بنكي' : p.payment_method || 'نقدي'}`
          : `دفعة - ${p.payment_method === 'cash' ? 'نقدي' : p.payment_method === 'bank_transfer' ? 'تحويل بنكي' : p.payment_method || 'نقدي'}`,
        description: isAdvance ? "دفعة على الحساب" : (p.notes || "دفعة من العميل"),
        amount: p.amount,
        date: p.date,
        clientId: p.client_id || null,
        clientName: p.clients?.name || null,
        projectId: p.project_id,
        projectName: p.projects?.name || null,
        status: isAdvance ? "advance" : null,
      });
    });

    purchases?.forEach((p: any) => {
      result.push({
        id: p.id,
        type: "purchase",
        title: `فاتورة ${p.invoice_number || ""}`,
        description: `إجمالي: ${formatCurrencyLYD(p.total_amount)}`,
        amount: p.paid_amount,
        date: p.date,
        clientId: p.projects?.client_id || null,
        clientName: p.projects?.clients?.name || null,
        projectId: p.project_id,
        projectName: p.projects?.name || null,
        status: p.status,
      });
    });

    expenses?.forEach((e: any) => {
      result.push({
        id: e.id,
        type: "expense",
        title: e.description,
        description: e.type,
        amount: e.amount,
        date: e.date,
        clientId: e.projects?.client_id || null,
        clientName: e.projects?.clients?.name || null,
        projectId: e.project_id,
        projectName: e.projects?.name || null,
        status: null,
      });
    });

    rentals?.forEach((r: any) => {
      result.push({
        id: r.id,
        type: "rental",
        title: `إيجار ${(r.equipment as any)?.name || "معدات"}`,
        description: r.status === 'active' ? 'نشط' : 'منتهي',
        amount: r.total_amount,
        date: r.start_date,
        clientId: r.projects?.client_id || null,
        clientName: r.projects?.clients?.name || null,
        projectId: r.project_id,
        projectName: r.projects?.name || null,
        status: r.status,
      });
    });

    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [projects, contracts, payments, purchases, expenses, rentals]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (filterClient !== "all" && a.clientId !== filterClient) return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          a.title?.toLowerCase().includes(s) ||
          (a.clientName || "").toLowerCase().includes(s) ||
          (a.projectName || "").toLowerCase().includes(s) ||
          (a.description || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [activities, filterClient, filterType, search]);

  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / ITEMS_PER_PAGE);
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredActivities, currentPage]);

  // Reset page on filter change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Type counts for chips
  const typeCounts = useMemo(() => {
    const base = activities.filter(a => {
      if (filterClient !== "all" && a.clientId !== filterClient) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          a.title?.toLowerCase().includes(s) ||
          (a.clientName || "").toLowerCase().includes(s) ||
          (a.projectName || "").toLowerCase().includes(s) ||
          (a.description || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
    return {
      all: base.length,
      project: base.filter(a => a.type === "project").length,
      contract: base.filter(a => a.type === "contract").length,
      payment: base.filter(a => a.type === "payment").length,
      purchase: base.filter(a => a.type === "purchase").length,
      expense: base.filter(a => a.type === "expense").length,
      rental: base.filter(a => a.type === "rental").length,
    };
  }, [activities, filterClient, search]);

  // Dynamic stats based on filtered data
  const stats = useMemo(() => {
    const clientCount = new Set(filteredActivities.map(a => a.clientId).filter(Boolean)).size;
    const projectCount = filteredActivities.filter(a => a.type === "project").length;
    const totalPayments = filteredActivities.filter(a => a.type === "payment").reduce((s, a) => s + (a.amount || 0), 0);
    const totalExpenses = filteredActivities.filter(a => a.type === "expense").reduce((s, a) => s + (a.amount || 0), 0);
    const totalPurchases = filteredActivities.filter(a => a.type === "purchase").reduce((s, a) => s + (a.amount || 0), 0);
    const totalRentals = filteredActivities.filter(a => a.type === "rental").reduce((s, a) => s + (a.amount || 0), 0);
    return { clientCount, projectCount, totalPayments, totalExpenses, totalPurchases, totalRentals };
  }, [filteredActivities]);

  const getLinkForActivity = (a: ActivityRecord) => {
    switch (a.type) {
      case "project": return `/projects/${a.projectId}`;
      case "contract": return a.projectId ? `/projects/${a.projectId}/contracts` : `/contracts`;
      case "payment": return a.projectId ? `/projects/${a.projectId}/payments` : `/clients/${a.clientId}`;
      case "purchase": return a.projectId ? `/projects/${a.projectId}/purchases` : "#";
      case "expense": return a.projectId ? `/projects/${a.projectId}/expenses` : "#";
      case "rental": return a.projectId ? `/projects/${a.projectId}/equipment` : "#";
      default: return "#";
    }
  };

  const hasActiveFilters = filterClient !== "all" || filterType !== "all" || search !== "";

  const clearFilters = () => {
    setFilterClient("all");
    setFilterType("all");
    setSearch("");
    setCurrentPage(1);
  };

  const typeFilterOptions = [
    { key: "all", label: "الكل", icon: Activity },
    { key: "project", label: "مشاريع", icon: FolderKanban },
    { key: "contract", label: "عقود", icon: FileText },
    { key: "payment", label: "دفعات", icon: DollarSign },
    { key: "purchase", label: "مشتريات", icon: ShoppingCart },
    { key: "expense", label: "مصروفات", icon: Receipt },
    { key: "rental", label: "إيجارات", icon: Wrench },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            سجل حركات الزبائن
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">جميع الحركات والإضافات لجميع المشاريع والزبائن</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild size="sm">
            <Link to="/projects/new"><Plus className="h-4 w-4 ml-1" />مشروع جديد</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/contracts/new"><FileText className="h-4 w-4 ml-1" />عقد جديد</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/clients"><Users className="h-4 w-4 ml-1" />إضافة زبون</Link>
          </Button>
        </div>
      </div>

      {/* Stats - compact */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { icon: Users, color: "text-blue-600 bg-blue-500/10", label: "زبائن", value: stats.clientCount },
          { icon: FolderKanban, color: "text-purple-600 bg-purple-500/10", label: "مشاريع", value: stats.projectCount },
          { icon: TrendingUp, color: "text-green-600 bg-green-500/10", label: "الدفعات", value: formatCurrencyLYD(stats.totalPayments) },
          { icon: ShoppingCart, color: "text-orange-600 bg-orange-500/10", label: "المشتريات", value: formatCurrencyLYD(stats.totalPurchases) },
          { icon: Receipt, color: "text-red-600 bg-red-500/10", label: "المصروفات", value: formatCurrencyLYD(stats.totalExpenses) },
          { icon: Wrench, color: "text-yellow-600 bg-yellow-500/10", label: "الإيجارات", value: formatCurrencyLYD(stats.totalRentals) },
        ].map((s, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-3 flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${s.color.split(" ")[1]}`}>
                <s.icon className={`h-4 w-4 ${s.color.split(" ")[0]}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-bold truncate">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Add Section */}
      <QuickAddSection />

      {/* Filters */}
      <Card>
        <CardContent className="p-3 space-y-3">
          {/* Search + Client filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الحركات..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                className="pr-10 h-9"
              />
            </div>
            <Select value={filterClient} onValueChange={(v) => handleFilterChange(setFilterClient, v)}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="جميع الزبائن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الزبائن</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1">
                <X className="h-3.5 w-3.5" />
                مسح الفلاتر
              </Button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {typeFilterOptions.map((opt) => {
              const count = typeCounts[opt.key as keyof typeof typeCounts];
              const isActive = filterType === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleFilterChange(setFilterType, opt.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border"
                  }`}
                >
                  <opt.icon className="h-3 w-3" />
                  {opt.label}
                  <span className={`mr-0.5 px-1 py-0 rounded-full text-[10px] ${
                    isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/10"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions by Client */}
      {filterClient !== "all" && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">إضافة سريعة لـ {clients?.find(c => c.id === filterClient)?.name}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" variant="outline">
                <Link to={`/projects/client/${filterClient}`}><FolderKanban className="h-3.5 w-3.5 ml-1" />مشاريع الزبون</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/clients/${filterClient}`}><ExternalLink className="h-3.5 w-3.5 ml-1" />تفاصيل الزبون</Link>
              </Button>
              {projects?.filter(p => p.client_id === filterClient).map(p => (
                <Button key={p.id} asChild size="sm" variant="secondary">
                  <Link to={`/projects/${p.id}/payments`}><DollarSign className="h-3 w-3 ml-1" />{p.name}</Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activities */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              الحركات ({filteredActivities.length})
            </CardTitle>
            {totalPages > 1 && (
              <span className="text-xs text-muted-foreground">
                صفحة {currentPage} من {totalPages}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="divide-y">
              {paginatedActivities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  لا توجد حركات مطابقة للفلترة
                </div>
              ) : (
                paginatedActivities.map((a) => {
                  const Icon = typeIcons[a.type];
                  return (
                    <Link
                      key={`${a.type}-${a.id}`}
                      to={getLinkForActivity(a)}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className={`p-1.5 rounded-md mt-0.5 ${typeColors[a.type].split(" ").slice(0, 2).join(" ")}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          {a.amount !== null && (
                            <span className="text-sm font-semibold whitespace-nowrap">{formatCurrencyLYD(a.amount)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`${typeColors[a.type]} border-0 text-[10px] px-1.5 py-0`}>
                            {typeLabels[a.type]}
                          </Badge>
                          {a.clientName && (
                            <span className="text-[11px] text-muted-foreground">{a.clientName}</span>
                          )}
                          {a.projectName && a.type !== "project" && (
                            <span className="text-[11px] text-primary/70">• {a.projectName}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.date).toLocaleDateString("ar-LY")}
                          </span>
                          {a.status && (
                            <Badge variant="outline" className={`${statusColors[a.status] || ""} text-[10px] px-1.5 py-0`}>
                              {statusLabels[a.status] || a.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    </Link>
                  );
                })
              )}
            </div>
          ) : (
            /* Desktop: Table layout */
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">المشروع</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-center w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedActivities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          لا توجد حركات مطابقة للفلترة
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedActivities.map((a) => {
                        const Icon = typeIcons[a.type];
                        return (
                          <TableRow key={`${a.type}-${a.id}`} className="hover:bg-muted/50 transition-colors">
                            <TableCell>
                              <Badge variant="outline" className={`${typeColors[a.type]} border-0 text-xs`}>
                                <Icon className="h-3 w-3 ml-1" />
                                {typeLabels[a.type]}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-medium truncate block">{a.title}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>{a.title}</p>
                                  {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {a.clientId ? (
                                <Link to={`/clients/${a.clientId}`} className="text-primary hover:underline text-sm">
                                  {a.clientName}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {a.projectId ? (
                                <Link to={`/projects/${a.projectId}`} className="text-primary hover:underline text-sm">
                                  {a.projectName}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {a.amount !== null ? formatCurrencyLYD(a.amount) : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {new Date(a.date).toLocaleDateString("ar-LY")}
                            </TableCell>
                            <TableCell>
                              {a.status ? (
                                <Badge variant="outline" className={`text-xs ${statusColors[a.status] || ""}`}>
                                  {statusLabels[a.status] || a.status}
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                                <Link to={getLinkForActivity(a)}>
                                  <ArrowRight className="h-4 w-4" />
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
            </TooltipProvider>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                عرض {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredActivities.length)} من {filteredActivities.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientActivities;
