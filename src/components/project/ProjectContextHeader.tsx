import { useMemo } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Sparkles,
  User,
  ChevronRight,
  FolderKanban,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  ShoppingCart,
  Coins,
  TrendingUp,
  Wrench,
  Receipt,
  FileText,
  Settings,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import {
  extractProjectSectionFromPath,
  PROJECT_SECTION_METADATA,
  type ProjectType,
  type ProjectSection,
} from "@/lib/navigation/projectNavigation";

const SECTION_ICONS: Record<ProjectSection, React.ElementType> = {
  phases: Layers,
  overview: FolderKanban,
  items: Package,
  purchases: ShoppingCart,
  expenses: Coins,
  progress: TrendingUp,
  equipment: Wrench,
  payments: Receipt,
  contracts: FileText,
  report: FileText,
  settings: Settings,
};

interface ProjectContextHeaderProps {
  projectId?: string;
  /** Optional override for project data if already loaded in parent page */
  projectData?: {
    id: string;
    name: string;
    project_type?: string;
    client_id?: string;
    clients?: { id?: string; name?: string } | null;
    status?: string;
  } | null;
  /** Optional callback before project switcher executes */
  onBeforeSwitch?: (proceed: () => void) => void;
  disabledSwitcher?: boolean;
}

export function ProjectContextHeader({
  projectId: propProjectId,
  projectData: propProjectData,
  onBeforeSwitch,
  disabledSwitcher = false,
}: ProjectContextHeaderProps) {
  const { id: urlProjectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const activeProjectId = propProjectId || urlProjectId || propProjectData?.id;

  // Query project details if not provided via props
  const { data: fetchedProject } = useQuery({
    queryKey: ["project-context-header", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_type, client_id, status, clients:client_id(id, name)")
        .eq("id", activeProjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !propProjectData && !!activeProjectId,
    staleTime: 60000,
  });

  // Query Phase Name if inside a Phase route
  const { data: fetchedPhase } = useQuery({
    queryKey: ["phase-context-header", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, status, phase_number")
        .eq("id", phaseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId,
    staleTime: 60000,
  });

  const project = propProjectData || fetchedProject;
  const isFinishing = project?.project_type === "finishing";
  const client = (project as any)?.clients;
  const currentSection = extractProjectSectionFromPath(location.pathname);
  const SectionIcon = SECTION_ICONS[currentSection] || Layers;
  const sectionMeta = PROJECT_SECTION_METADATA[currentSection];

  const currentReturnTo = useMemo(() => {
    return location.pathname + location.search;
  }, [location.pathname, location.search]);

  if (!project && !activeProjectId) {
    return null;
  }

  const isAtProjectRoot = location.pathname === `/projects/${activeProjectId}` || location.pathname === `/projects/${activeProjectId}/`;
  const isAtPhaseRoot = phaseId && location.pathname === `/projects/${activeProjectId}/phases/${phaseId}`;

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-3 mb-4" dir="rtl">
      {/* Top Row: Pure Structural Breadcrumb Trail */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link
          to="/"
          className="hover:text-primary transition-colors flex items-center gap-1 shrink-0 cursor-pointer font-medium"
        >
          <span>الرئيسية</span>
        </Link>

        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        <Link
          to="/projects"
          className="hover:text-primary transition-colors flex items-center gap-1 shrink-0 cursor-pointer font-medium"
        >
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <span>المشاريع</span>
        </Link>

        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        {isAtProjectRoot ? (
          <span className="font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
            {project?.name || "المشروع"}
          </span>
        ) : (
          <Link
            to={`/projects/${activeProjectId}`}
            className="hover:text-primary transition-colors truncate max-w-[180px] sm:max-w-[260px] font-medium"
          >
            {project?.name || "المشروع"}
          </Link>
        )}

        {/* Phase Context in Breadcrumbs */}
        {phaseId && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            {isAtPhaseRoot ? (
              <span className="font-bold text-foreground truncate max-w-[160px] sm:max-w-[220px]">
                {fetchedPhase?.name || "المرحلة"}
              </span>
            ) : (
              <Link
                to={`/projects/${activeProjectId}/phases/${phaseId}`}
                className="hover:text-primary transition-colors truncate max-w-[160px] sm:max-w-[220px] font-medium"
              >
                {fetchedPhase?.name || "المرحلة"}
              </Link>
            )}
          </>
        )}

        {/* Section Context (when not on project root or phase root) */}
        {!isAtProjectRoot && !isAtPhaseRoot && currentSection !== "phases" && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-primary font-semibold flex items-center gap-1">
              <SectionIcon className="h-3.5 w-3.5" />
              <span>{sectionMeta?.label || currentSection}</span>
            </span>
          </>
        )}
      </nav>

      {/* Main Row: Identity & Quick Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border/40">
        {/* Project Title & Metadata Badges */}
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Building2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight truncate">
                {project?.name || "جاري التحميل..."}
              </h1>

              {/* Project Type Badge (Contracting vs Finishing) */}
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-bold flex items-center gap-1 ${
                  isFinishing
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                }`}
              >
                {isFinishing ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    <span>مشروع تشطيبات</span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>مشروع مقاولات</span>
                  </>
                )}
              </Badge>

              {/* Status Badge */}
              {project?.status && (
                <Badge
                  variant="secondary"
                  className="text-[11px] px-2 py-0.5 text-muted-foreground font-medium flex items-center gap-1"
                >
                  {project.status === "completed" ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>مكتمل</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 text-amber-600" />
                      <span>نشط / جاري</span>
                    </>
                  )}
                </Badge>
              )}
            </div>

            {/* Actionable Client Pill */}
            {client?.id && client?.name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>الزبون:</span>
                <Link
                  to={`/clients/${client.id}`}
                  state={{ returnTo: currentReturnTo }}
                  className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors underline-offset-2 hover:underline cursor-pointer"
                >
                  <User className="h-3 w-3 text-primary" />
                  <span>{client.name}</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Project Switcher & Quick Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {/* Subtle Project Management Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 rounded-xl border-border/80 hover:bg-muted/60 cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                title="خيارات وإدارة المشروع"
                aria-label="خيارات وإدارة المشروع"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${activeProjectId}/overview`)}
                className="gap-2 cursor-pointer text-xs font-medium"
              >
                <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                <span>ملخص المشروع واللوحة المالية</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${activeProjectId}/payments`)}
                className="gap-2 cursor-pointer text-xs font-medium"
              >
                <Receipt className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>تحصيلات ودفعات العميل</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${activeProjectId}/contracts`)}
                className="gap-2 cursor-pointer text-xs font-medium"
              >
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span>العقود والاتفاقيات</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${activeProjectId}/report`)}
                className="gap-2 cursor-pointer text-xs font-medium"
              >
                <Printer className="h-4 w-4 text-amber-600 shrink-0" />
                <span>التقرير المالي للطباعة</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
                className="gap-2 cursor-pointer text-xs font-medium"
              >
                <Settings className="h-4 w-4 text-slate-600 shrink-0" />
                <span>إعدادات وبيانات المشروع</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ProjectSwitcher
            currentProjectId={project?.id || activeProjectId}
            currentProjectName={project?.name}
            currentProjectType={project?.project_type as ProjectType}
            onBeforeSwitch={onBeforeSwitch}
            disabled={disabledSwitcher}
          />
        </div>
      </div>
    </div>
  );
}
