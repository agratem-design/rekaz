import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Layers,
  Package,
  ShoppingCart,
  TrendingUp,
  FileText,
  Wrench,
  Coins,
  Wallet,
  Receipt,
  FolderKanban,
  CalendarDays,
  AlertTriangle,
  ClipboardCheck,
  GitBranch,
  ArrowRight,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";

type NavTab = {
  name: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const getProjectTabs = (projectId: string, phaseId?: string, progressTrackingEnabled?: boolean): NavTab[] => {
  const base = `/projects/${projectId}`;
  const phaseBase = phaseId ? `${base}/phases/${phaseId}` : null;

  const tabs: NavTab[] = [
    { name: "المراحل", href: `${base}/phases`, icon: Layers },
    { name: "المدفوعات", href: `${base}/payments`, icon: Wallet, adminOnly: true },
  ];

  if (progressTrackingEnabled) {
    tabs.push({ name: "الإنجاز", href: `${base}/progress`, icon: TrendingUp, adminOnly: true });
  }

  tabs.push(
    { name: "المصروفات", href: phaseBase ? `${phaseBase}/expenses` : `${base}/expenses`, icon: Coins, adminOnly: true },
    { name: "المعدات", href: phaseBase ? `${phaseBase}/equipment` : `${base}/equipment`, icon: Wrench },
    { name: "العهد", href: `${base}/custody`, icon: Coins, adminOnly: true },
    { name: "التقرير", href: `${base}/report`, icon: FileText, adminOnly: true },
    { name: "الإعدادات", href: `${base}/edit`, icon: Settings, adminOnly: true },
  );

  return tabs;
};

export function ProjectNavBar() {
  const { id, phaseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isEngineer } = useAuth();

  const { data: project } = useQuery({
    queryKey: ["project-name", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from("projects")
        .select("name, client_id, clients(name), progress_tracking_enabled")
        .eq("id", id)
        .single();
      return data;
    },
    enabled: !!id,
    staleTime: 60000,
  });

  const { data: phase } = useQuery({
    queryKey: ["phase-name", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;
      const { data } = await supabase
        .from("project_phases")
        .select("name")
        .eq("id", phaseId)
        .single();
      return data;
    },
    enabled: !!phaseId,
    staleTime: 60000,
  });

  if (!id) return null;

  const allTabs = getProjectTabs(id, phaseId, !!(project as any)?.progress_tracking_enabled);
  const tabs = isEngineer ? allTabs.filter((t) => !t.adminOnly) : allTabs;

  const isTabActive = (tab: NavTab) => {
    const path = location.pathname;
    if (tab.href === `/projects/${id}/edit`) {
      return path === `/projects/${id}` || path === `/projects/${id}/edit`;
    }
    return path === tab.href || path.startsWith(tab.href + "/");
  };

  const clientName = (project as any)?.clients?.name;

  const getBackPath = () => {
    if (phaseId) return `/projects/${id}/phases`;
    if (clientName) return `/projects/client/${(project as any)?.client_id}`;
    return "/projects";
  };

  const getBackLabel = () => {
    if (phaseId) return "فواتير مراحل المشروع";
    if (clientName) return clientName;
    return "المشاريع";
  };

  return (
    <div className="mb-3 md:mb-4 space-y-2">
      {/* Top bar: Back button + Breadcrumb */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(getBackPath())}
          className="shrink-0 gap-1 md:gap-1.5 h-7 md:h-8 px-2 md:px-2.5"
        >
          <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="text-[11px] md:text-xs hidden sm:inline">{getBackLabel()}</span>
        </Button>

        <div className="flex items-center gap-1 md:gap-1.5 text-[11px] md:text-xs text-muted-foreground flex-wrap min-w-0">
          <Link to="/projects" className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0">
            <FolderKanban className="h-3 w-3" />
            <span className="hidden sm:inline">المشاريع</span>
          </Link>
          {clientName && (
            <>
              <ChevronLeft className="h-3 w-3 shrink-0" />
              <Link
                to={`/projects/client/${(project as any)?.client_id}`}
                className="hover:text-foreground transition-colors truncate max-w-[60px] md:max-w-[100px]"
              >
                {clientName}
              </Link>
            </>
          )}
          <ChevronLeft className="h-3 w-3 shrink-0" />
          <Link
            to={`/projects/${id}/phases`}
            className="hover:text-foreground transition-colors font-medium text-foreground truncate max-w-[80px] md:max-w-[140px]"
          >
            {project?.name || "..."}
          </Link>
          {phase && phaseId && (
            <>
              <ChevronLeft className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-medium truncate max-w-[60px] md:max-w-[120px]">{phase.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-1.5 md:gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab);
          return (
            <Link key={tab.href} to={tab.href}>
              <Button
                variant={active ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-1.5 md:gap-2 h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm rounded-lg transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border-border"
                )}
              >
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                {tab.name}
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
