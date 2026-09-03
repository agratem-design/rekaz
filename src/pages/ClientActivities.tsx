import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import QuickAddSection from "@/components/client-activities/QuickAddSection";

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
  purchase: "فاتورة مشتريات",
  expense: "مصروف",
  rental: "إيجار معدات",
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
  project: "bg-blue-500/10 text-blue-600",
  contract: "bg-purple-500/10 text-purple-600",
  payment: "bg-green-500/10 text-green-600",
  purchase: "bg-orange-500/10 text-orange-600",
  expense: "bg-red-500/10 text-red-600",
  rental: "bg-yellow-500/10 text-yellow-600",
};

const ClientActivities = () => {
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");

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
  const { data: projects } = useQuery({
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
  const { data: contracts } = useQuery({
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
  const { data: payments } = useQuery({
    queryKey: ["all-client-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, amount, date, notes, payment_method, client_id, clients(name), project_id, projects(name)").is("reversed_at", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchases linked to client projects
  const { data: purchases } = useQuery({
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
  const { data: expenses } = useQuery({
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
  const { data: rentals } = useQuery({
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
      result.push({
        id: p.id,
        type: "payment",
        title: `دفعة - ${p.payment_method === 'cash' ? 'نقدي' : p.payment_method === 'bank_transfer' ? 'تحويل بنكي' : p.payment_method || 'نقدي'}`,
        description: p.notes || "دفعة من العميل",
        amount: p.amount,
        date: p.date,
        clientId: p.client_id || null,
        clientName: p.clients?.name || null,
        projectId: p.project_id,
        projectName: p.projects?.name || null,
        status: null,
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

    // Sort by date descending
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
          a.title.toLowerCase().includes(s) ||
          a.clientName.toLowerCase().includes(s) ||
          a.projectName?.toLowerCase().includes(s) ||
          a.description.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [activities, filterClient, filterType, search]);

  // Stats
  const stats = useMemo(() => {
    const clientCount = new Set(activities.map(a => a.clientId)).size;
    const projectCount = activities.filter(a => a.type === "project").length;
    const totalPayments = activities.filter(a => a.type === "payment").reduce((s, a) => s + (a.amount || 0), 0);
    const totalPurchases = activities.filter(a => a.type === "purchase").reduce((s, a) => s + (a.amount || 0), 0);
    return { clientCount, projectCount, totalPayments, totalPurchases };
  }, [activities]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            سجل حركات الزبائن
          </h1>
          <p className="text-muted-foreground mt-1">جميع الحركات والإضافات لجميع المشاريع والزبائن</p>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{stats.clientCount}</p><p className="text-xs text-muted-foreground">زبائن نشطين</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><FolderKanban className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-2xl font-bold">{stats.projectCount}</p><p className="text-xs text-muted-foreground">مشاريع</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{formatCurrencyLYD(stats.totalPayments)}</p><p className="text-xs text-muted-foreground">إجمالي الدفعات</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><ShoppingCart className="h-5 w-5 text-orange-600" /></div>
            <div><p className="text-2xl font-bold">{formatCurrencyLYD(stats.totalPurchases)}</p><p className="text-xs text-muted-foreground">إجمالي المشتريات</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Section */}
      <QuickAddSection />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الحركات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="جميع الزبائن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الزبائن</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="جميع الأنواع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="project">مشاريع</SelectItem>
                <SelectItem value="contract">عقود</SelectItem>
                <SelectItem value="payment">دفعات</SelectItem>
                <SelectItem value="purchase">مشتريات</SelectItem>
                <SelectItem value="expense">مصروفات</SelectItem>
                <SelectItem value="rental">إيجارات</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions by Client */}
      {filterClient !== "all" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">إضافة سريعة لـ {clients?.find(c => c.id === filterClient)?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" variant="outline">
                <Link to={`/projects/client/${filterClient}`}><FolderKanban className="h-4 w-4 ml-1" />مشاريع الزبون</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/clients/${filterClient}`}><ExternalLink className="h-4 w-4 ml-1" />تفاصيل الزبون</Link>
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

      {/* Activities Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              الحركات ({filteredActivities.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableHead className="text-center w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      لا توجد حركات مطابقة للفلترة
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivities.slice(0, 200).map((a) => {
                    const Icon = typeIcons[a.type];
                    return (
                      <TableRow key={`${a.type}-${a.id}`} className="hover:bg-muted/50">
                        <TableCell>
                          <Badge variant="outline" className={`${typeColors[a.type]} border-0 text-xs`}>
                            <Icon className="h-3 w-3 ml-1" />
                            {typeLabels[a.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{a.title}</TableCell>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.date).toLocaleDateString("ar-LY")}
                        </TableCell>
                        <TableCell>
                          {a.status ? (
                            <Badge variant="outline" className="text-xs">
                              {a.status === "active" ? "نشط" :
                               a.status === "completed" ? "مكتمل" :
                               a.status === "paid" ? "مدفوع" :
                               a.status === "partial" ? "جزئي" :
                               a.status === "pending" ? "قيد الانتظار" :
                               a.status === "due" ? "مستحق" :
                               a.status}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientActivities;
