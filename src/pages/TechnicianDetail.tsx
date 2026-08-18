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
  Building2, User, Phone, Mail, MapPin, Wrench, Wallet, Printer, 
  Search, ArrowRight, ChevronDown, ChevronUp, Layers, CheckCircle2, 
  AlertCircle, FileText, Sparkles, Plus, Eye, DollarSign, Calendar, Receipt
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openReceiptPrintWindow, openPrintWindow } from "@/lib/printStyles";
import { TechnicianProjectSettlementDrawer } from "@/components/technicians/TechnicianProjectSettlementDrawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

interface TechnicianProjectGroup {
  projectId: string;
  projectName: string;
  projectType: "contracting" | "finishing";
  clientId: string;
  clientName: string;
  totalEarned: number;
  totalPaid: number;
  totalDue: number;
  progressRecords: any[];
  payments: any[];
}

interface TechnicianClientGroup {
  clientId: string;
  clientName: string;
  totalDue: number;
  projects: TechnicianProjectGroup[];
}

export default function TechnicianDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"projects" | "statement">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedProjectWork, setExpandedProjectWork] = useState<Record<string, boolean>>({});

  // Drawer state
  const [selectedDrawerProject, setSelectedDrawerProject] = useState<TechnicianProjectGroup | null>(null);

  // Fetch technician base data
  const { data: technician, isLoading: loadingTechnician, error: technicianError } = useQuery({
    queryKey: ["technician", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*, technician_types(id, name, code)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch technician progress records with project & client info
  const { data: progressRecords = [], isLoading: loadingProgress } = useQuery({
    queryKey: ["technician-progress-records", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_progress_records")
        .select(`
          id,
          date,
          quantity_completed,
          rate,
          earned_amount,
          notes,
          project_id,
          phase_id,
          project_item_id,
          projects (
            id,
            name,
            project_type,
            client_id,
            clients (
              id,
              name
            )
          ),
          project_phases (
            id,
            name
          ),
          project_items (
            id,
            name,
            unit_price,
            measurement_type
          )
        `)
        .eq("technician_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch technician payments (expenses where type='labor' and technician_id=id)
  const { data: laborPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["technician-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          id,
          amount,
          date,
          payment_method,
          description,
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
          ),
          treasuries (
            id,
            name,
            treasury_type,
            project_category
          )
        `)
        .eq("technician_id", id!)
        .eq("type", "labor")
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
  const { clientGroups, globalEarned, globalPaid, globalDue } = useMemo(() => {
    let gEarned = 0;
    let gPaid = 0;

    const projectMap = new Map<string, TechnicianProjectGroup>();

    // 1. Group Progress Records by Project
    progressRecords.forEach((r: any) => {
      const eAmt = Number(r.earned_amount || 0);
      gEarned += eAmt;

      const projId = r.project_id || "unassigned";
      const projName = r.projects?.name || "أعمال عامة بدون مشروع";
      const projType = (r.projects?.project_type || "contracting") as "contracting" | "finishing";
      const cliId = r.projects?.clients?.id || "unassigned";
      const cliName = r.projects?.clients?.name || "بدون زبون محدد";

      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          projectId: projId,
          projectName: projName,
          projectType: projType,
          clientId: cliId,
          clientName: cliName,
          totalEarned: 0,
          totalPaid: 0,
          totalDue: 0,
          progressRecords: [],
          payments: [],
        });
      }

      const group = projectMap.get(projId)!;
      group.totalEarned += eAmt;
      group.progressRecords.push(r);
    });

    // 2. Attach Labor Payments to Projects
    laborPayments.forEach((pay: any) => {
      const payAmt = Number(pay.amount || 0);
      gPaid += payAmt;

      const projId = pay.project_id || "unassigned";
      if (projectMap.has(projId)) {
        const group = projectMap.get(projId)!;
        group.totalPaid += payAmt;
        group.payments.push(pay);
      } else {
        // In case a payment was made before progress record
        const projName = pay.projects?.name || "أعمال بدون مشروع";
        const projType = (pay.projects?.project_type || "contracting") as "contracting" | "finishing";
        const cliId = pay.projects?.clients?.id || "unassigned";
        const cliName = pay.projects?.clients?.name || "بدون زبون محدد";

        projectMap.set(projId, {
          projectId: projId,
          projectName: projName,
          projectType: projType,
          clientId: cliId,
          clientName: cliName,
          totalEarned: 0,
          totalPaid: payAmt,
          totalDue: 0,
          progressRecords: [],
          payments: [pay],
        });
      }
    });

    // 3. Finalize Project Dues
    projectMap.forEach((grp) => {
      grp.totalDue = Math.max(0, grp.totalEarned - grp.totalPaid);
    });

    // 4. Group Projects into Clients
    const clientMap = new Map<string, TechnicianClientGroup>();
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
    const gDue = Math.max(0, gEarned - gPaid);

    return {
      clientGroups: cList,
      globalEarned: gEarned,
      globalPaid: gPaid,
      globalDue: gDue,
    };
  }, [progressRecords, laborPayments]);

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
            p.progressRecords.some((r) =>
              (r.project_items?.name && r.project_items.name.toLowerCase().includes(q)) ||
              (r.notes && r.notes.toLowerCase().includes(q))
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
      .filter(Boolean) as TechnicianClientGroup[];
  }, [clientGroups, searchQuery]);

  const toggleClientExpand = (clientId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === undefined ? false : !prev[clientId],
    }));
  };

  const toggleProjectWork = (projectId: string) => {
    setExpandedProjectWork((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const handlePrintStatement = () => {
    const htmlContent = `
      <div class="print-area">
        <div class="print-report-header">
          <div class="print-report-title">كشف حساب الفني: ${technician?.name || ""}</div>
          <div class="print-report-subtitle">التخصص: ${technician?.specialty || (technician as any)?.technician_types?.name || "فني"}</div>
          <div class="print-report-meta">التاريخ: ${new Date().toLocaleDateString("ar-LY")}</div>
        </div>
        <div class="print-content">
          <table class="print-info-table">
            <tr>
              <td class="info-label">إجمالي المستحق (المنجز)</td>
              <td class="info-value">${formatCurrencyLYD(globalEarned)}</td>
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
    openPrintWindow(`كشف حساب الفني: ${technician?.name || ""}`, htmlContent, companySettings);
  };

  if (loadingTechnician) {
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

  if (technicianError || !technician) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-bold text-foreground">تعذر العثور على الفني</h3>
        <p className="text-sm text-muted-foreground mt-1">الفني المطلوب غير موجود أو تم حذفه.</p>
        <Button className="mt-4" onClick={() => navigate("/technicians")}>
          العودة لقائمة الفنيين
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6" dir="rtl">
      {/* Breadcrumb Navigation */}
      <DeterministicBreadcrumb
        items={[
          { label: "الفنيون", href: "/technicians" },
          { label: technician?.name || "تفاصيل الفني", isCurrent: true },
        ]}
        fallbackBackHref="/technicians"
      />

      {/* Header Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-blue-600" />
            <span>{technician.name}</span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {(technician.specialty || (technician as any).technician_types?.name) && (
              <Badge variant="secondary">
                {technician.specialty || (technician as any).technician_types?.name}
              </Badge>
            )}
            {technician.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">{technician.phone}</span>
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
            <span className="text-xs text-muted-foreground font-medium">إجمالي المنجز (الأجر)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-foreground mt-2" dir="ltr">
            {formatCurrencyLYD(globalEarned)}
          </p>
          <span className="text-[11px] text-muted-foreground">استحقاقات الإنجاز بكافة المشاريع</span>
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
          <span className="text-[11px] text-muted-foreground">سندات الصرف والدفعات النقدية</span>
        </Card>

        <Card className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-700 dark:text-blue-300 font-bold">صافي المتبقي للفني</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-700">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-blue-700 dark:text-blue-400 mt-2" dir="ltr">
            {formatCurrencyLYD(globalDue)}
          </p>
          <span className="text-[11px] text-blue-700/80">المستحق واجب الصرف</span>
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
                {progressRecords.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="statement" className="rounded-lg text-xs font-semibold gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>سجل السندات والعمليات</span>
              <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                {laborPayments.length}
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
          {loadingProgress ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : filteredClientGroups.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-dashed">
              <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-foreground">لا توجد أعمال أو مشاريع مسجلة</h4>
              <p className="text-xs text-muted-foreground mt-1">لم يتم تسجيل أي سجلات إنجاز لهذا الفني حتى الآن.</p>
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
                        <span className="text-[10px] text-muted-foreground block">مستحق الزبون للفني</span>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400" dir="ltr">
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
                        const isWorkExpanded = !!expandedProjectWork[proj.projectId];

                        return (
                          <div
                            key={proj.projectId}
                            className="p-4 rounded-xl border border-border/60 bg-card hover:border-blue-500/30 transition-all flex flex-col justify-between"
                          >
                            <div>
                              {/* Project Title & Badge */}
                              <div className="flex items-start justify-between gap-2 mb-2.5">
                                <div>
                                  <Link
                                    to={`/projects/${proj.projectId}`}
                                    className="font-bold text-sm text-foreground hover:text-blue-600 transition-colors flex items-center gap-1.5"
                                  >
                                    <Layers className="h-3.5 w-3.5 text-blue-600" />
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
                                  <span className="text-[10px] text-muted-foreground block">المنجز</span>
                                  <span className="text-xs font-bold text-foreground" dir="ltr">
                                    {formatCurrencyLYD(proj.totalEarned)}
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
                                  <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400" dir="ltr">
                                    {formatCurrencyLYD(proj.totalDue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions & Work Records Accordion */}
                            <div>
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                                  onClick={() => toggleProjectWork(proj.projectId)}
                                >
                                  {isWorkExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  <span>سجلات العمل ({proj.progressRecords.length})</span>
                                </Button>

                                <Button
                                  size="sm"
                                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1 text-xs px-3 shadow-sm"
                                  onClick={() => setSelectedDrawerProject(proj)}
                                  disabled={proj.totalDue <= 0}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>صرف ({formatCurrencyLYD(proj.totalDue)})</span>
                                </Button>
                              </div>

                              {/* Collapsible Work Records List */}
                              {isWorkExpanded && (
                                <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                                  {proj.progressRecords.map((rec: any) => (
                                    <div
                                      key={rec.id}
                                      className="p-2 rounded-lg bg-card border border-border/40 text-xs flex items-center justify-between gap-2"
                                    >
                                      <div>
                                        <div className="font-semibold text-foreground">
                                          {rec.project_items?.name || (rec.notes ? rec.notes : "عمل منجز")}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                          <span>{rec.date}</span>
                                          <span>•</span>
                                          <span>
                                            الكمية: {rec.quantity_completed} {rec.project_items?.measurement_type ? `(${rec.project_items.measurement_type})` : ""} @ {formatCurrencyLYD(rec.rate || 0)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="text-left shrink-0 font-bold text-foreground" dir="ltr">
                                        {formatCurrencyLYD(rec.earned_amount)}
                                      </div>
                                    </div>
                                  ))}
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
                <Receipt className="h-4 w-4 text-blue-600" />
                <span>سجل سندات الصرف والدفعات النقدية المسددة</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {laborPayments.length} سندات صرف
              </Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">البيان / الوصف</TableHead>
                    <TableHead className="text-right">الخزينة المخصوم منها</TableHead>
                    <TableHead className="text-right">طريقة الدفع</TableHead>
                    <TableHead className="text-right">المبلغ المصروف</TableHead>
                    <TableHead className="text-center">إيصال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laborPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        لا توجد سندات صرف مسجلة لهذا الفني.
                      </TableCell>
                    </TableRow>
                  ) : (
                    laborPayments.map((pay: any) => (
                      <TableRow key={pay.id}>
                        <TableCell className="font-medium">{pay.date}</TableCell>
                        <TableCell>{pay.projects?.name || "—"}</TableCell>
                        <TableCell>{pay.description || "صرف مستحقات فني"}</TableCell>
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
                                  type: "salary",
                                  amount: Number(pay.amount || 0),
                                  paidToOrBy: technician.name,
                                  description: pay.description || `صرف مستحقات فني لدفعة عمل`,
                                  projectName: pay.projects?.name,
                                  notes: pay.notes,
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
        <TechnicianProjectSettlementDrawer
          isOpen={!!selectedDrawerProject}
          onClose={() => setSelectedDrawerProject(null)}
          technicianId={technician.id}
          technicianName={technician.name}
          technicianSpecialty={technician.specialty || (technician as any).technician_types?.name}
          projectId={selectedDrawerProject.projectId}
          projectName={selectedDrawerProject.projectName}
          projectType={selectedDrawerProject.projectType}
          clientName={selectedDrawerProject.clientName}
          totalEarned={selectedDrawerProject.totalEarned}
          totalPaid={selectedDrawerProject.totalPaid}
          totalDue={selectedDrawerProject.totalDue}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["technician-progress-records", id] });
            queryClient.invalidateQueries({ queryKey: ["technician-expenses", id] });
          }}
        />
      )}
    </div>
  );
}
