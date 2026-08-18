import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Layers,
  Package,
  ShoppingCart,
  TrendingUp,
  FileText,
  Wrench,
  Coins,
  FolderKanban,
  CalendarDays,
  AlertTriangle,
  ClipboardCheck,
  GitBranch,
  ArrowRight,
  Settings,
  Printer,
  MoreHorizontal,
  Receipt,
  Sparkles,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectSwitcher } from "@/components/project/ProjectSwitcher";

type NavTab = {
  name: string;
  href: string;
  icon: React.ElementType;
  group: "main" | "finance" | "management";
  isContractingOnly?: boolean;
};

const getProjectTabs = (projectId: string, isFinishing: boolean): NavTab[] => {
  const tabs: NavTab[] = [
    { name: "لوحة المشروع", href: `/projects/${projectId}`, icon: FolderKanban, group: "main" },
  ];

  if (!isFinishing) {
    tabs.push({ name: "بنود المقايسة", href: `/projects/${projectId}/items`, icon: Package, group: "main", isContractingOnly: true });
  }

  tabs.push(
    { name: "المراحل", href: `/projects/${projectId}/phases`, icon: Layers, group: "main" },
    { name: isFinishing ? "المشتريات والخدمات" : "المشتريات", href: `/projects/${projectId}/purchases`, icon: ShoppingCart, group: "finance" },
    { name: "المصروفات", href: `/projects/${projectId}/expenses`, icon: Coins, group: "finance" },
    { name: "إيصالات القبض", href: `/projects/${projectId}/payments`, icon: Receipt, group: "finance" }
  );

  if (!isFinishing) {
    tabs.push({ name: "نسب الإنجاز", href: `/projects/${projectId}/progress`, icon: TrendingUp, group: "main", isContractingOnly: true });
  }

  tabs.push(
    { name: "العقود", href: `/projects/${projectId}/contracts`, icon: Receipt, group: "finance" },
    { name: "المعدات", href: `/projects/${projectId}/equipment`, icon: Wrench, group: "finance" }
  );

  return tabs;
};

export function ProjectNavBar() {
  const { id, phaseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isEngineer, isAdmin, isAccountant } = useAuth();

  const { data: project } = useQuery({
    queryKey: ["project-name", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("projects")
        .select("name, project_type, client_id, clients(name)")
        .eq("id", id)
        .single();
      return data;
    },
    enabled: !!id,
    staleTime: 60000,
  });
  const { data: currentPhase } = useQuery({
    queryKey: ["project-phase-name", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;
      const { data, error } = await supabase
        .from("project_phases")
        .select("name")
        .eq("id", phaseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId,
    staleTime: 60000,
  });

  if (!id) return null;

  const isFinishing = (project as any)?.project_type === "finishing";
  const allTabs = getProjectTabs(id, isFinishing);

  // Filter tabs by role and project type
  const visibleTabs = allTabs.filter((tab) => {
    if (isFinishing && tab.isContractingOnly) {
      return false;
    }
    if (isEngineer) {
      // Engineers can see main tabs and equipment
      return tab.group === "main" || tab.name === "المعدات" || tab.group === "management";
    }
    return true;
  });

  const primaryTabs = visibleTabs;
  const managementTabs: NavTab[] = [];

  const isTabActive = (tab: NavTab) => {
    const path = location.pathname;
    return path === tab.href || path.startsWith(tab.href + "/");
  };

  const clientName = (project as any)?.clients?.name;

  const getBackPath = () => {
    if (isFinishing) return "/projects/finishing";
    return "/projects/contracting";
  };

  const getBackLabel = () => {
    if (isFinishing) return "مشاريع التشطيبات";
    return "مشاريع المقاولات";
  };

  const isManagementTabActive = managementTabs.some((t) => isTabActive(t));
  const activeManagementTab = managementTabs.find((t) => isTabActive(t));

  return (
    <div className="mb-5 space-y-2" dir="rtl">
      {/* ─── Row 1: Breadcrumb + Actions ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Back + Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(getBackPath())}
            className="shrink-0 gap-1.5 h-8 px-3 cursor-pointer"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="text-xs">{getBackLabel()}</span>
          </Button>

          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            <Link
              to="/projects"
              className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <FolderKanban className="h-3 w-3" />
              <span>المشاريع</span>
            </Link>

            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link
              to={`/projects/${id}/phases`}
              className="hover:text-primary transition-colors font-semibold text-foreground truncate max-w-[180px] cursor-pointer"
            >
              {project?.name || "..."}
            </Link>

            {phaseId && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="text-foreground font-semibold truncate max-w-[120px]">
                  {currentPhase?.name || "..."}
                </span>
              </>
            )}
          </div>
        </div>

          {/* Right: Project Switcher & Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Project Type Badge */}
          <Badge
            variant="outline"
            className={`text-[11px] px-2 py-0.5 font-bold flex items-center gap-1 ${
              isFinishing
                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
            }`}
          >
            {isFinishing ? (
              <>
                <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                <span>تشطيبات</span>
              </>
            ) : (
              <>
                <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span>مقاولات</span>
              </>
            )}
          </Badge>

          {/* Project Switcher */}
          <ProjectSwitcher
            currentProjectId={id}
            currentProjectName={project?.name}
            currentProjectType={project?.project_type as any}
          />

          {/* Print Report — visible for non-engineers */}
          {!isEngineer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/projects/${id}/report`)}
              className="gap-1.5 h-8 px-3 cursor-pointer text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">طباعة التقرير</span>
            </Button>
          )}

          {/* Settings — visible for admin */}
          {isAdmin && (
            <Button
              variant={location.pathname.includes("/settings") || location.pathname.includes("/edit") ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate(`/projects/${id}/settings`)}
              className="gap-1.5 h-8 px-3 cursor-pointer text-xs"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">إعدادات</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Row 2: Tab Navigation Bar ─── */}
      <div className="border-b border-border">
        <ScrollArea dir="rtl">
          <div className="flex items-center justify-start gap-0.5 pb-0 w-full">
            {/* Primary Tabs */}
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab);
              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all duration-150 whitespace-nowrap cursor-pointer shrink-0",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.name}</span>
                </Link>
              );
            })}

            {/* Management Overflow Dropdown */}
            {managementTabs.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all duration-150 whitespace-nowrap cursor-pointer shrink-0",
                      isManagementTabActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {isManagementTabActive && activeManagementTab
                        ? activeManagementTab.name
                        : "التخطيط والمخاطر"}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    التخطيط والمتابعة
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {managementTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = isTabActive(tab);
                    return (
                      <DropdownMenuItem
                        key={tab.href}
                        onClick={() => navigate(tab.href)}
                        className={cn(
                          "gap-2 cursor-pointer text-sm",
                          active && "text-primary bg-primary/5 font-medium"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{tab.name}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {phaseId && currentPhase && (
        <div className="flex items-center justify-between gap-3 p-3 bg-[#d6ac40]/10 border border-[#d6ac40]/20 rounded-lg text-sm mb-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-[#d6ac40]/20 rounded-md shrink-0">
              <Layers className="h-4 w-4 text-[#b8860b] dark:text-[#d6ac40]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#b8860b] dark:text-[#d6ac40] font-bold">أنت تتصفح حالياً مرحلة:</p>
              <h4 className="font-bold text-foreground truncate">{currentPhase.name}</h4>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projects/${id}/phases`)}
            className="h-8 shrink-0 text-xs gap-1 border-[#d6ac40]/30 hover:bg-[#d6ac40]/10 hover:text-[#b8860b] cursor-pointer"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            العودة لصفحة المراحل
          </Button>
        </div>
      )}
    </div>
  );
}
