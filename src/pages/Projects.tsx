import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Building,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart,
  Coins,
  TrendingUp,
  Pencil,
  Printer,
  Wrench,
  Layers,
  MapPin,
  HardHat,
  FileText,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  AlertTriangle,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  GitBranch,
  CreditCard,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrencyLYD } from "@/lib/currency";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

const statusLabels: Record<string, string> = {
  active: "نشط",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusDot: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-yellow-500",
  completed: "bg-blue-500",
  cancelled: "bg-red-500",
};

const statusBadgeClass: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

interface ProjectsProps {
  type?: "contracting" | "finishing";
}

const Projects = ({ type }: ProjectsProps = {}) => {
  const { isEngineer, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // URL-synchronized filters
  const searchQuery = searchParams.get("search") || "";
  const statusFilter = searchParams.get("status") || "all";
  const projectTypeFilter = searchParams.get("type") || type || "all";

  const setSearchQuery = (newSearch: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newSearch) {
        next.set("search", newSearch);
      } else {
        next.delete("search");
      }
      return next;
    }, { replace: true });
  };

  const setStatusFilter = (newStatus: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newStatus && newStatus !== "all") {
        next.set("status", newStatus);
      } else {
        next.delete("status");
      }
      return next;
    }, { replace: true });
  };

  const setProjectTypeFilter = (newType: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newType && newType !== "all") {
        next.set("type", newType);
      } else {
        next.delete("type");
      }
      return next;
    }, { replace: true });
  };

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("projects-view-mode") as "grid" | "list") || "grid";
  });

  useEffect(() => {
    if (type) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("type", type);
        return next;
      }, { replace: true });
    }
  }, [type, setSearchParams]);

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("projects-view-mode", mode);
  };

  // Fetch all projects with client info
  const { data: projects, isLoading } = useQuery({
    queryKey: ["all-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name), supervising_engineer:engineers!projects_supervising_engineer_id_fkey(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch phases for expanded projects
  const { data: phasesMap } = useQuery({
    queryKey: ["projects-phases", Array.from(expandedProjects)],
    queryFn: async () => {
      if (expandedProjects.size === 0) return {};
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .in("project_id", Array.from(expandedProjects))
        .order("order_index", { ascending: true });
      if (error) throw error;

      const map: Record<string, typeof data> = {};
      data?.forEach((phase) => {
        if (!map[phase.project_id]) map[phase.project_id] = [];
        map[phase.project_id].push(phase);
      });
      return map;
    },
    enabled: expandedProjects.size > 0,
  });

  // Fetch total payments per project
  const { data: projectPaymentsMap } = useQuery({
    queryKey: ["projects-payments-total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("project_id, amount").is("reversed_at", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach((p) => {
        if (!p.project_id) return;
        map[p.project_id] = (map[p.project_id] || 0) + Number(p.amount);
      });
      return map;
    },
  });

  // Fetch total contracting items value per project
  const { data: projectItemsTotalMap } = useQuery({
    queryKey: ["projects-items-total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select("project_id, total_price");
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach((item) => {
        if (!item.project_id) return;
        map[item.project_id] = (map[item.project_id] || 0) + Number(item.total_price || 0);
      });
      return map;
    },
  });

  // Fetch total active contracts value per project
  const { data: projectContractsMap } = useQuery({
    queryKey: ["projects-contracts-total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("project_id, amount, status");
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach((c) => {
        if (!c.project_id || c.status === "cancelled") return;
        map[c.project_id] = (map[c.project_id] || 0) + Number(c.amount || 0);
      });
      return map;
    },
  });

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  // Filter projects
  const filteredProjects = projects?.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesType = projectTypeFilter === "all" || (p as any).project_type === projectTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Stats - filtered by project type when a type is active
  const typeFilteredProjects = type
    ? projects?.filter((p) => (p as any).project_type === type)
    : projects;
  const totalProjects = typeFilteredProjects?.length || 0;
  const activeCount = typeFilteredProjects?.filter((p) => p.status === "active").length || 0;
  const pendingCount = typeFilteredProjects?.filter((p) => p.status === "pending").length || 0;
  const completedCount = typeFilteredProjects?.filter((p) => p.status === "completed").length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جاري تحميل المشاريع...</p>
        </div>
      </div>
    );
  }

  const renderQuickNavMenu = (projectId: string) => (
    <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}`)} className="gap-2 cursor-pointer font-bold">
          <FolderKanban className="h-4 w-4 text-primary" />
          <span>لوحة المشروع (نظرة عامة)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/phases`)} className="gap-2 cursor-pointer">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span>مراحل المشروع</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/report`)} className="gap-2 cursor-pointer">
          <Printer className="h-4 w-4 text-muted-foreground" />
          <span>طباعة التقرير</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      {isAdmin && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/settings`)} className="gap-2 text-primary cursor-pointer">
            <Pencil className="h-4 w-4" />
            <span>إعدادات المشروع</span>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );

  const effectiveSector = type || (projectTypeFilter !== "all" ? (projectTypeFilter as "contracting" | "finishing") : undefined);
  const isFilterActive = searchQuery !== "" || statusFilter !== "all" || (!type && projectTypeFilter !== "all");

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <PageHeader
        title={type === "contracting" ? "مشاريع المقاولات" : type === "finishing" ? "مشاريع التشطيبات" : "كل المشاريع"}
        description="شاشة التحكم وإدارة كافة المشاريع والعمليات المرتبطة بها"
        actions={
          isAdmin ? (
            <Button 
              onClick={() => navigate(effectiveSector ? `/projects/new?type=${effectiveSector}` : "/projects/new")} 
              className="gap-2 bg-primary hover:bg-primary/90 cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>{effectiveSector === "contracting" ? "مشروع مقاولات جديد" : effectiveSector === "finishing" ? "مشروع تشطيبات جديد" : "مشروع جديد"}</span>
            </Button>
          ) : null
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-r-4 border-r-primary overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-primary">{totalProjects}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">إجمالي المشاريع</p>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-green-500 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-green-500">{activeCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">مشاريع نشطة</p>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-yellow-500 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">قيد الانتظار</p>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-blue-500 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-blue-500">{completedCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">مشاريع مكتملة</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-card p-3 rounded-lg border shadow-sm">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم المشروع، العميل، أو الموقع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 focus-visible:ring-primary"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] focus:ring-primary" dir="rtl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
          {!type && (
            <Select value={projectTypeFilter} onValueChange={setProjectTypeFilter}>
              <SelectTrigger className="w-[150px] focus:ring-primary" dir="rtl">
                <SelectValue placeholder="نوع الفواتير" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="contracting">فواتير مقاولات</SelectItem>
                <SelectItem value="finishing">فواتير تشطيبات</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted self-end sm:self-auto">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("grid")}
            className="h-8 w-8 cursor-pointer rounded-md"
            title="عرض شبكي"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("list")}
            className="h-8 w-8 cursor-pointer rounded-md"
            title="عرض قائمة"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredProjects?.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={isFilterActive ? "لا توجد نتائج مطابقة" : effectiveSector === "contracting" ? "لا توجد مشاريع مقاولات حتى الآن" : effectiveSector === "finishing" ? "لا توجد مشاريع تشطيبات حتى الآن" : "لا توجد مشاريع حتى الآن"}
          description={
            searchQuery
              ? `لم نتمكن من العثور على أي مشروع يطابق "${searchQuery}".`
              : isFilterActive
              ? "لا توجد مشاريع تطابق الفلاتر المحددة."
              : effectiveSector === "contracting"
              ? "ابدأ بإنشاء أول مشروع مقاولات لمتابعة المراحل، المقايسات والتكاليف."
              : effectiveSector === "finishing"
              ? "ابدأ بإنشاء أول مشروع تشطيبات بنسبة إشراف لمتابعة الأعمال والمدفوعات."
              : "ابدأ بإنشاء أول مشروع جديد (مقاولات أو تشطيبات) لمتابعة المراحل، المقايسات والتكاليف."
          }
          action={
            isAdmin && !isFilterActive ? (
              <Button
                onClick={() => navigate(effectiveSector ? `/projects/new?type=${effectiveSector}` : "/projects/new")}
                className="gap-2 bg-primary hover:bg-primary/90 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{effectiveSector === "contracting" ? "إضافة أول مشروع مقاولات" : effectiveSector === "finishing" ? "إضافة أول مشروع تشطيبات" : "إضافة أول مشروع"}</span>
              </Button>
            ) : isFilterActive ? (
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); if (!type) setProjectTypeFilter("all"); }}
                className="cursor-pointer"
              >
                مسح الفلاتر
              </Button>
            ) : null
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => {
            const isExpanded = expandedProjects.has(project.id);
            const phases = phasesMap?.[project.id] || [];
            const isOverBudget = !isEngineer && project.budget > 0 && (project.spent || 0) > project.budget;

            const contractsVal = projectContractsMap?.[project.id] || 0;
            const itemsVal = projectItemsTotalMap?.[project.id] || 0;
            const contractingObligation = contractsVal > 0 ? contractsVal : (itemsVal > 0 ? itemsVal : Number(project.budget || 0));
            const receivedAmount = projectPaymentsMap?.[project.id] || 0;
            const contractingRemaining = Math.max(0, contractingObligation - receivedAmount);
            const paymentRatio = contractingObligation > 0 ? Math.round((receivedAmount / contractingObligation) * 100) : 0;

            const spentBeforeCommission = project.spent || 0;
            const finishingPercentage = Number((project as any).finishing_percentage || 0);
            const commissionValue = (spentBeforeCommission * finishingPercentage) / 100;
            const totalFinishingDue = spentBeforeCommission + commissionValue;
            const receivedFromClient = projectPaymentsMap?.[project.id] || 0;
            const remainingFromClient = Math.max(0, totalFinishingDue - receivedFromClient);

            return (
              <Card
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="overflow-hidden transition-all hover:shadow-md cursor-pointer group flex flex-col border hover:border-primary/30 relative"
              >
                {/* Project Image Header */}
                <div className="relative h-44 bg-muted overflow-hidden shrink-0">
                  {project.image_url ? (
                    <img
                      src={project.image_url}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <FolderKanban className="h-14 w-14 text-primary/20" />
                    </div>
                  )}
                  {/* Status Overlay */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                    <Badge
                      variant="outline"
                      className={`text-xs px-2.5 py-0.5 backdrop-blur-md shadow-sm border ${statusBadgeClass[project.status] || ""}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[project.status]} ml-1.5 inline-block`} />
                      {statusLabels[project.status] || project.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 backdrop-blur-md shadow-sm border font-medium ${
                        project.project_type === 'finishing'
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      }`}
                    >
                      {project.project_type === 'finishing' ? "تشطيبات" : "مقاولات"}
                    </Badge>
                  </div>

                  {/* Overbudget Badge */}
                  {isOverBudget && (
                    <Badge
                      variant="destructive"
                      className="absolute top-3 left-3 text-[10px] px-2 py-0.5 animate-pulse flex items-center gap-1 shadow"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>تجاوز الميزانية</span>
                    </Badge>
                  )}
                </div>

                {/* Card Content */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  {/* Title & Metadata */}
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-lg text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
                      {project.name}
                    </h3>
                    <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground mt-1">
                      {project.clients?.name && (
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                          <span className="truncate">{project.clients.name}</span>
                        </div>
                      )}
                      {project.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                          <span className="truncate">{project.location}</span>
                        </div>
                      )}
                      {project.supervising_engineer?.name && (
                        <div className="flex items-center gap-1.5">
                          <HardHat className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                          <span className="truncate">{project.supervising_engineer.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">نسبة الإنجاز</span>
                      <span className="font-semibold text-primary">{project.progress || 0}%</span>
                    </div>
                    <Progress value={project.progress || 0} className="h-2 bg-muted" />
                  </div>

                  {/* Financial Summary */}
                  {!isEngineer && (
                    project.project_type === "contracting" ? (
                      <div className="space-y-2.5 pt-3 border-t border-border/60">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground mb-0.5">قيمة المشروع</p>
                            <p className="font-bold text-foreground">
                              {formatCurrencyLYD(contractingObligation)}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground mb-0.5">المسدد</p>
                            <p className="font-bold text-green-600">
                              {formatCurrencyLYD(receivedAmount)}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-muted-foreground mb-0.5">المتبقي على العميل</p>
                            <p className={`font-bold ${contractingRemaining > 0 ? "text-amber-600 font-black" : "text-foreground"}`}>
                              {formatCurrencyLYD(contractingRemaining)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">نسبة السداد</span>
                            <span className="font-semibold text-green-600">{paymentRatio}%</span>
                          </div>
                          <Progress value={paymentRatio} className="h-1.5 bg-muted" />
                        </div>
                      </div>
                    ) : (
                      project.project_type === "finishing" ? (
                        <div className="space-y-2.5 pt-3 border-t border-border/60">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">التكلفة المباشرة</p>
                              <p className="font-bold text-foreground">
                                {formatCurrencyLYD(spentBeforeCommission)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-muted-foreground mb-0.5">أتعاب الشركة ({finishingPercentage}%)</p>
                              <p className="font-bold text-primary">
                                {formatCurrencyLYD(commissionValue)}
                              </p>
                            </div>
                            <div className="text-left">
                              <p className="text-muted-foreground mb-0.5">إجمالي المستحق</p>
                              <p className="font-bold text-foreground">
                                {formatCurrencyLYD(totalFinishingDue)}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-border/40">
                            <div>
                              <span className="text-muted-foreground">المسدد: </span>
                              <span className="font-bold text-green-600">{formatCurrencyLYD(receivedFromClient)}</span>
                            </div>
                            <div className="text-left">
                              <span className="text-muted-foreground">المتبقي على العميل: </span>
                              <span className={`font-bold ${remainingFromClient > 0 ? "text-amber-600 font-black" : "text-foreground"}`}>
                                {formatCurrencyLYD(remainingFromClient)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-xs pt-3 border-t border-border/60">
                          <div>
                            <p className="text-muted-foreground mb-0.5">الميزانية</p>
                            <p className="font-bold text-foreground">
                              {Number(project.budget) > 0 ? formatCurrencyLYD(project.budget) : "بلا ميزانية"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground mb-0.5">المصروفات</p>
                            <p className={`font-bold ${isOverBudget ? "text-destructive" : "text-foreground"}`}>
                              {formatCurrencyLYD(project.spent || 0)}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-muted-foreground mb-0.5 flex items-center gap-1 justify-end">
                              <CreditCard className="h-3 w-3" /> المقبوض
                            </p>
                            <p className="font-bold text-primary">
                              {formatCurrencyLYD(projectPaymentsMap?.[project.id] || 0)}
                            </p>
                          </div>
                        </div>
                      )
                    )
                  )}

                  {/* Quick Access Icons Toolbar */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60 gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/projects/${project.id}/phases`)}
                      className="h-8 gap-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-all cursor-pointer text-muted-foreground text-xs px-3"
                      title="المراحل"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      المراحل
                    </Button>
                    {!isEngineer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/projects/${project.id}/report`)}
                        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-all cursor-pointer text-muted-foreground"
                        title="طباعة التقرير"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent transition-all cursor-pointer text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      {renderQuickNavMenu(project.id)}
                    </DropdownMenu>
                  </div>

                  {/* Collapsible Phases for Contracting Projects */}
                  {project.project_type !== "finishing" && (
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleProject(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="pt-1 animate-in fade-in duration-200"
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-md hover:bg-accent/40 cursor-pointer">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          <span>مراحل المشروع</span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          {phases.length > 0 ? (
                            phases.map((phase) => (
                              <div
                                key={phase.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 hover:bg-accent/50 cursor-pointer transition-colors"
                                onClick={() => navigate(`/projects/${project.id}/phases/${phase.id}/items`)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot[phase.status] || statusDot.pending}`} />
                                  <span className="text-xs font-medium truncate">{phase.name}</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1.5 py-0 shrink-0 border-0 ${statusBadgeClass[phase.status] || ""}`}
                                >
                                  {statusLabels[phase.status] || phase.status}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4 bg-muted/20 rounded-md">
                              <p className="text-xs text-muted-foreground">لا توجد مراحل مسجلة</p>
                              {isAdmin && (
                                <Link to={`/projects/${project.id}/phases`} onClick={(e) => e.stopPropagation()}>
                                  <span className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1 justify-center cursor-pointer">
                                    <Plus className="h-3 w-3" />
                                    إضافة أول مرحلة
                                  </span>
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Structured List/Table View */
        <Card className="shadow-sm overflow-hidden border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-right font-bold w-[300px]">المشروع / العميل</TableHead>
                  <TableHead className="text-right font-bold">الموقع</TableHead>
                  <TableHead className="text-right font-bold">المهندس المشرف</TableHead>
                  <TableHead className="text-right font-bold w-[180px]">نسبة الإنجاز</TableHead>
                  {!isEngineer && (
                    <>
                      <TableHead className="text-right font-bold">الميزانية</TableHead>
                      <TableHead className="text-right font-bold">المصروفات</TableHead>
                    </>
                  )}
                  <TableHead className="text-right font-bold">الحالة</TableHead>
                  <TableHead className="text-left font-bold w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects?.map((project) => {
                  const isOverBudget = !isEngineer && project.budget > 0 && (project.spent || 0) > project.budget;
                  const contractsVal = projectContractsMap?.[project.id] || 0;
                  const itemsVal = projectItemsTotalMap?.[project.id] || 0;
                  const contractingObligation = contractsVal > 0 ? contractsVal : (itemsVal > 0 ? itemsVal : Number(project.budget || 0));
                  const receivedAmount = projectPaymentsMap?.[project.id] || 0;
                  const contractingRemaining = Math.max(0, contractingObligation - receivedAmount);
                  const paymentRatio = contractingObligation > 0 ? Math.round((receivedAmount / contractingObligation) * 100) : 0;

                  const spentBeforeCommission = project.spent || 0;
                  const finishingPercentage = Number((project as any).finishing_percentage || 0);
                  const commissionValue = (spentBeforeCommission * finishingPercentage) / 100;
                  const totalFinishingDue = spentBeforeCommission + commissionValue;
                  const receivedFromClient = projectPaymentsMap?.[project.id] || 0;
                  const remainingFromClient = Math.max(0, totalFinishingDue - receivedFromClient);

                  return (
                    <TableRow
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="cursor-pointer hover:bg-muted/30 transition-colors group"
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                            {project.name}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building className="h-3 w-3 shrink-0" />
                              {project.clients?.name || "عميل غير محدد"}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 border font-medium ${
                                project.project_type === 'finishing'
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              }`}
                            >
                              {project.project_type === 'finishing' ? "تشطيبات" : "مقاولات"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {project.location ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{project.location}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {project.supervising_engineer?.name ? (
                          <div className="flex items-center gap-1">
                            <HardHat className="h-3.5 w-3.5 shrink-0" />
                            <span>{project.supervising_engineer.name}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[160px]">
                          <Progress value={project.progress || 0} className="h-2 flex-1 bg-muted" />
                          <span className="text-xs font-bold text-primary">{project.progress || 0}%</span>
                        </div>
                      </TableCell>
                      {!isEngineer && (
                        project.project_type === "contracting" ? (
                          <>
                            <TableCell className="text-xs font-semibold">
                              {formatCurrencyLYD(contractingObligation)}
                              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">قيمة المشروع</span>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              <span className={contractingRemaining > 0 ? "text-amber-600 font-bold" : "text-foreground font-semibold"}>
                                {formatCurrencyLYD(contractingRemaining)}
                              </span>
                              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">المتبقي على العميل (سداد: {paymentRatio}%)</span>
                            </TableCell>
                          </>
                        ) : project.project_type === "finishing" ? (
                          <>
                            <TableCell className="text-xs font-semibold">
                              {formatCurrencyLYD(spentBeforeCommission)}
                              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">التكلفة المباشرة</span>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              <span className="text-primary font-bold">
                                {formatCurrencyLYD(totalFinishingDue)}
                              </span>
                              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5" title={`المقبوض: ${formatCurrencyLYD(receivedFromClient)}`}>المستحق (المتبقي على العميل: {formatCurrencyLYD(remainingFromClient)})</span>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-xs font-semibold">
                              {Number(project.budget) > 0 ? formatCurrencyLYD(project.budget) : "بلا ميزانية"}
                              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">الميزانية</span>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              <span className={isOverBudget ? "text-destructive font-bold flex items-center gap-1" : "text-foreground"}>
                                {formatCurrencyLYD(project.spent || 0)}
                                {isOverBudget && <span title="تجاوز الميزانية!"><AlertTriangle className="h-3.5 w-3.5 shrink-0 animate-bounce" /></span>}
                              </span>
                              <span className="text-[10px] text-muted-foreground block font-normal mt-0.5">المصروفات</span>
                            </TableCell>
                          </>
                        )
                      )}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 border ${statusBadgeClass[project.status] || ""}`}
                        >
                          <span className={`h-1 w-1 rounded-full ${statusDot[project.status]} ml-1`} />
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer gap-1">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                                <span className="text-xs">انتقال</span>
                              </Button>
                            </DropdownMenuTrigger>
                            {renderQuickNavMenu(project.id)}
                          </DropdownMenu>

                          {!isEngineer && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/projects/${project.id}/report`)}
                              className="h-8 w-8 cursor-pointer"
                              title="طباعة التقرير"
                            >
                              <Printer className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Projects;
