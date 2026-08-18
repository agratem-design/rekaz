import { useMemo } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectContextHeader } from "@/components/project/ProjectContextHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban,
  Package,
  Layers,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Coins,
  Wrench,
  FileText,
  Printer,
  Settings,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  extractProjectSectionFromPath,
  PROJECT_SECTION_METADATA,
  type ProjectSection,
  type ProjectType,
} from "@/lib/navigation/projectNavigation";

export interface WorkspaceTabItem {
  id: ProjectSection | string;
  label: string;
  path: string;
  icon: React.ElementType;
  isPrimary: boolean;
  allowed: boolean;
}

interface ProjectWorkspaceLayoutProps {
  children?: React.ReactNode;
  activeSectionOverride?: ProjectSection;
  hideProjectHeader?: boolean;
}

export function ProjectWorkspaceLayout({
  children,
  activeSectionOverride,
  hideProjectHeader = false,
}: ProjectWorkspaceLayoutProps) {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAccountant, isEngineer, isSupervisor } = useAuth();

  // Load project basic data for type-aware workspace
  const { data: project, isLoading } = useQuery({
    queryKey: ["project-workspace-meta", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_type, client_id, status, finishing_percentage, budget, clients:client_id(id, name)")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 60000,
  });

  const projectType: ProjectType = project?.project_type === "finishing" ? "finishing" : "contracting";
  const isFinishing = projectType === "finishing";
  const currentSection = activeSectionOverride || extractProjectSectionFromPath(location.pathname);

  // Check if we are at the clean Project Root (Phase Directory)
  const isProjectRoot =
    location.pathname === `/projects/${projectId}` ||
    location.pathname === `/projects/${projectId}/` ||
    location.pathname === `/projects/${projectId}/phases`;

  // Check if we are inside a Phase context
  const isInPhaseContext = Boolean(phaseId);

  // Type-Aware & Role-Aware Navigation Tabs
  const workspaceTabs = useMemo<WorkspaceTabItem[]>(() => {
    if (!projectId) return [];

    // 1. Contextual Navigation INSIDE a Phase
    if (isInPhaseContext && phaseId) {
      if (isFinishing) {
        // Finishing Phase Tabs (Zero BOQ / Progress)
        return [
          {
            id: "purchases",
            label: "المشتريات والخدمات",
            path: `/projects/${projectId}/phases/${phaseId}/purchases`,
            icon: ShoppingCart,
            isPrimary: true,
            allowed: true,
          },
          {
            id: "expenses",
            label: "المصروفات",
            path: `/projects/${projectId}/phases/${phaseId}/expenses`,
            icon: Coins,
            isPrimary: true,
            allowed: true,
          },
          {
            id: "equipment",
            label: "إيجار المعدات",
            path: `/projects/${projectId}/phases/${phaseId}/equipment`,
            icon: Wrench,
            isPrimary: true,
            allowed: true,
          },
          // Secondary Project-Level access under المزيد
          {
            id: "payments",
            label: "تحصيلات العميل — للمشروع بالكامل",
            path: `/projects/${projectId}/payments`,
            icon: Receipt,
            isPrimary: false,
            allowed: !isSupervisor,
          },
          {
            id: "overview",
            label: "ملخص المشروع العام",
            path: `/projects/${projectId}/overview`,
            icon: FolderKanban,
            isPrimary: false,
            allowed: true,
          },
          {
            id: "contracts",
            label: "العقود والاتفاقيات",
            path: `/projects/${projectId}/contracts`,
            icon: FileText,
            isPrimary: false,
            allowed: !isSupervisor,
          },
          {
            id: "report",
            label: "التقرير المالي للمشروع",
            path: `/projects/${projectId}/report`,
            icon: Printer,
            isPrimary: false,
            allowed: !isEngineer && !isSupervisor,
          },
          {
            id: "settings",
            label: "إعدادات المشروع",
            path: `/projects/${projectId}/settings`,
            icon: Settings,
            isPrimary: false,
            allowed: isAdmin,
          },
        ].filter((tab) => tab.allowed);
      }

      // Contracting Phase Contextual Tabs (Right to Left: BOQ -> Purchases -> Expenses -> Labor -> Equipment -> More)
      return [
        {
          id: "items",
          label: "بنود المقاولات",
          path: `/projects/${projectId}/phases/${phaseId}/items`,
          icon: Package,
          isPrimary: true,
          allowed: true,
        },
        {
          id: "purchases",
          label: "المشتريات",
          path: `/projects/${projectId}/phases/${phaseId}/purchases`,
          icon: ShoppingCart,
          isPrimary: true,
          allowed: true,
        },
        {
          id: "expenses",
          label: "المصروفات",
          path: `/projects/${projectId}/phases/${phaseId}/expenses`,
          icon: Coins,
          isPrimary: true,
          allowed: true,
        },
        {
          id: "progress",
          label: "الفنيون / الإنجاز",
          path: `/projects/${projectId}/phases/${phaseId}/progress`,
          icon: TrendingUp,
          isPrimary: true,
          allowed: true,
        },
        {
          id: "equipment",
          label: "المعدات",
          path: `/projects/${projectId}/phases/${phaseId}/equipment`,
          icon: Wrench,
          isPrimary: true,
          allowed: true,
        },
        // Secondary Project-Level access under المزيد
        {
          id: "payments",
          label: "تحصيلات العميل — للمشروع بالكامل",
          path: `/projects/${projectId}/payments`,
          icon: Receipt,
          isPrimary: false,
          allowed: !isSupervisor,
        },
        {
          id: "overview",
          label: "ملخص المشروع العام",
          path: `/projects/${projectId}/overview`,
          icon: FolderKanban,
          isPrimary: false,
          allowed: true,
        },
        {
          id: "contracts",
          label: "العقود والاتفاقيات",
          path: `/projects/${projectId}/contracts`,
          icon: FileText,
          isPrimary: false,
          allowed: !isSupervisor,
        },
        {
          id: "report",
          label: "التقرير المالي للمشروع",
          path: `/projects/${projectId}/report`,
          icon: Printer,
          isPrimary: false,
          allowed: !isEngineer && !isSupervisor,
        },
        {
          id: "settings",
          label: "إعدادات المشروع",
          path: `/projects/${projectId}/settings`,
          icon: Settings,
          isPrimary: false,
          allowed: isAdmin,
        },
      ].filter((tab) => tab.allowed);
    }

    // 2. Standalone Project Management Views (when outside phase context)
    return [
      {
        id: "phases",
        label: "مراحل المشروع",
        path: `/projects/${projectId}`,
        icon: Layers,
        isPrimary: true,
        allowed: true,
      },
      {
        id: "overview",
        label: "ملخص المشروع",
        path: `/projects/${projectId}/overview`,
        icon: FolderKanban,
        isPrimary: true,
        allowed: true,
      },
      {
        id: "payments",
        label: "تحصيلات العميل",
        path: `/projects/${projectId}/payments`,
        icon: Receipt,
        isPrimary: true,
        allowed: !isSupervisor,
      },
      {
        id: "contracts",
        label: "العقود",
        path: `/projects/${projectId}/contracts`,
        icon: FileText,
        isPrimary: true,
        allowed: !isSupervisor,
      },
      {
        id: "report",
        label: "التقرير المالي",
        path: `/projects/${projectId}/report`,
        icon: Printer,
        isPrimary: false,
        allowed: !isEngineer && !isSupervisor,
      },
      {
        id: "settings",
        label: "إعدادات المشروع",
        path: `/projects/${projectId}/settings`,
        icon: Settings,
        isPrimary: false,
        allowed: isAdmin,
      },
    ].filter((tab) => tab.allowed);
  }, [projectId, phaseId, isInPhaseContext, isFinishing, isAdmin, isAccountant, isEngineer, isSupervisor]);

  const primaryTabs = useMemo(() => workspaceTabs.filter((t) => t.isPrimary), [workspaceTabs]);
  const secondaryTabs = useMemo(() => workspaceTabs.filter((t) => !t.isPrimary), [workspaceTabs]);

  const isSecondaryActive = useMemo(
    () => secondaryTabs.some((t) => t.id === currentSection),
    [secondaryTabs, currentSection]
  );
  const activeSecondaryTab = useMemo(
    () => secondaryTabs.find((t) => t.id === currentSection),
    [secondaryTabs, currentSection]
  );

  return (
    <div className="space-y-4" dir="rtl">
      {/* 1. Standardized Project Context Header */}
      {!hideProjectHeader && (
        <ProjectContextHeader
          projectId={projectId}
          projectData={project as any}
        />
      )}

      {/* 2. Contextual Navigation Bar (HIDDEN AT PROJECT ROOT / PHASE DIRECTORY) */}
      {!isProjectRoot && (
        <nav aria-label="أقسام مساحة العمل" className="border-b border-border bg-card/40 rounded-xl p-1 shadow-xs">
          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            {/* Primary Contextual Tabs (Right to Left) */}
            <div className="flex items-center gap-1 min-w-0">
              {primaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentSection === tab.id;

                return (
                  <Link
                    key={tab.id}
                    to={tab.path}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Secondary "المزيد" Dropdown */}
            {secondaryTabs.length > 0 && (
              <div className="shrink-0 mr-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={isSecondaryActive ? "default" : "outline"}
                      size="sm"
                      className={`h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        isSecondaryActive
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      aria-label="أقسام إضافية في مساحة العمل"
                    >
                      {isSecondaryActive && activeSecondaryTab ? (
                        <>
                          <activeSecondaryTab.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{activeSecondaryTab.label}</span>
                        </>
                      ) : (
                        <>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                          <span>المزيد</span>
                        </>
                      )}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {secondaryTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = currentSection === tab.id;

                      return (
                        <DropdownMenuItem
                          key={tab.id}
                          onClick={() => navigate(tab.path)}
                          className={`gap-2 cursor-pointer text-xs font-medium ${
                            isActive ? "bg-primary/10 text-primary font-bold" : ""
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{tab.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* 3. Workspace Body Content */}
      <main className="w-full">{children}</main>
    </div>
  );
}
