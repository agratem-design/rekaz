import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Phone, Mail, MapPin, Building, FolderOpen, FileText, DollarSign, Wallet, CreditCard } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  active: "bg-green-500/10 text-green-500",
  completed: "bg-blue-500/10 text-blue-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();

  // Fetch client details
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["client-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client contracts
  const { data: contracts } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client payments across all projects
  const { data: payments } = useQuery({
    queryKey: ["client-payments-all", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*, projects:project_id(name), treasuries:treasury_id(name)")
        .eq("client_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Calculate statistics
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const advanceBalance = payments
    ?.filter((p: any) => p.payment_type === 'advance')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) - Number(p.used_amount || 0)), 0) || 0;
  const stats = {
    totalProjects: projects?.length || 0,
    activeProjects: projects?.filter((p) => p.status === "active").length || 0,
    totalBudget: projects?.reduce((sum, p) => sum + Number(p.budget), 0) || 0,
    totalSpent: projects?.reduce((sum, p) => sum + Number(p.spent), 0) || 0,
    totalContracts: contracts?.length || 0,
    contractsValue: contracts?.reduce((sum, c) => sum + Number(c.amount), 0) || 0,
    totalPaid,
    totalPayments: payments?.length || 0,
    advanceBalance,
  };

  if (clientLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">العميل غير موجود</p>
        <Link to="/clients">
          <Button variant="link">العودة للعملاء</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/clients" className="hover:text-foreground">
          العملاء
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{client.name}</span>
      </div>

      {/* Client Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
              {client.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.city && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{client.city}</span>
                </div>
              )}
            </div>
            {client.address && (
              <p className="text-sm text-muted-foreground mt-1">{client.address}</p>
            )}
          </div>
        </div>
        <Link to={`/projects/new?client_id=${client.id}`}>
          <Button>مشروع جديد</Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المشاريع</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العقود</p>
                <p className="text-2xl font-bold">{stats.totalContracts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الميزانية</p>
                <p className="text-xl font-bold">{formatCurrencyLYD(stats.totalBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المصروف</p>
                <p className="text-xl font-bold">{formatCurrencyLYD(stats.totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المدفوع</p>
                <p className="text-xl font-bold">{formatCurrencyLYD(stats.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المتبقي</p>
                <p className="text-xl font-bold">{formatCurrencyLYD(stats.contractsValue - stats.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.advanceBalance > 0 ? "border-emerald-500/30" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">رصيد على الحساب</p>
                <p className={`text-xl font-bold ${stats.advanceBalance > 0 ? 'text-emerald-600' : ''}`}>{formatCurrencyLYD(stats.advanceBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>مشاريع العميل</CardTitle>
        </CardHeader>
        <CardContent>
          {projects && projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التقدم</TableHead>
                  <TableHead className="text-right">الميزانية</TableHead>
                  <TableHead className="text-right">المصروف</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.name}</p>
                        {project.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[project.status] || ""}>
                        {statusLabels[project.status] || project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-sm">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrencyLYD(project.budget)}</TableCell>
                    <TableCell>{formatCurrencyLYD(project.spent)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link to={`/projects/${project.id}/items`}>
                          <Button variant="outline" size="sm">
                            بنود المشروع
                          </Button>
                        </Link>
                        <Link to={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm">
                            تعديل
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مشاريع لهذا العميل</p>
              <Link to={`/projects/new?client_id=${client.id}`}>
                <Button variant="link">إنشاء مشروع جديد</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contracts Table */}
      {contracts && contracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>عقود العميل</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العقد</TableHead>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">القيمة</TableHead>
                  <TableHead className="text-right">تاريخ البداية</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.title}</TableCell>
                    <TableCell>{contract.contract_number}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[contract.status] || ""}>
                        {statusLabels[contract.status] || contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrencyLYD(contract.amount)}</TableCell>
                    <TableCell>{contract.start_date}</TableCell>
                    <TableCell>
                      <Link to={`/contracts/${contract.id}`}>
                        <Button variant="ghost" size="sm">
                          عرض
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>تسديدات العميل</span>
              <Badge variant="outline">{stats.totalPayments} دفعة</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الخزينة</TableHead>
                    <TableHead className="text-right">طريقة الدفع</TableHead>
                    <TableHead className="text-right">من الرصيد</TableHead>
                    <TableHead className="text-right">الرصيد المتبقي</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => {
                    const isAdvance = (payment as any).payment_type === 'advance';
                    const usedAmount = Number((payment as any).used_amount || 0);
                    const creditUsedFromBalance = Number((payment as any).credit_used || 0);
                    const remainingCredit = isAdvance ? Number(payment.amount) - usedAmount : null;
                    const isFullyUsed = isAdvance && remainingCredit !== null && remainingCredit <= 0;
                    const isPartiallyUsed = isAdvance && usedAmount > 0 && !isFullyUsed;

                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {(payment as any).projects?.name || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isAdvance ? (
                            <Badge
                              variant="outline"
                              className={
                                isFullyUsed
                                  ? "text-muted-foreground border-muted text-[10px] py-0"
                                  : isPartiallyUsed
                                  ? "text-amber-600 border-amber-300 text-[10px] py-0"
                                  : "text-emerald-600 border-emerald-300 text-[10px] py-0"
                              }
                            >
                              {isFullyUsed ? "مستخدم بالكامل" : isPartiallyUsed ? "مستخدم جزئياً" : "على الحساب"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0">مخصصة</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-emerald-600 font-bold">
                          {formatCurrencyLYD(payment.amount)}
                        </TableCell>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell>{(payment as any).treasuries?.name || "-"}</TableCell>
                        <TableCell>
                          {payment.payment_method === "cash" ? "نقدي" :
                           payment.payment_method === "bank" ? "تحويل بنكي" :
                           payment.payment_method === "check" ? "شيك" : payment.payment_method || "-"}
                        </TableCell>
                        <TableCell>
                          {creditUsedFromBalance > 0 ? (
                            <span className="text-emerald-600 font-medium text-sm">{formatCurrencyLYD(creditUsedFromBalance)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdvance && remainingCredit !== null ? (
                            <span className={remainingCredit > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                              {formatCurrencyLYD(remainingCredit)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={`/projects/${payment.project_id}/payments`}>
                            <Button variant="ghost" size="sm">
                              عرض
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientDetail;
