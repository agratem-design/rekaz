import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  Search,
  Check,
  ArrowLeftRight,
  User,
  Layers,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { resolveProjectSwitchDestination, type ProjectType } from "@/lib/navigation/projectNavigation";
import { toast } from "@/hooks/use-toast";

interface ProjectSwitcherProps {
  currentProjectId?: string;
  currentProjectName?: string;
  currentProjectType?: ProjectType;
  /** Optional custom trigger button style/className */
  className?: string;
  /** Callback before executing navigation (allows dirty guards to intercept) */
  onBeforeSwitch?: (proceed: () => void) => void;
  disabled?: boolean;
}

export function ProjectSwitcher({
  currentProjectId,
  currentProjectName,
  currentProjectType,
  className,
  onBeforeSwitch,
  disabled = false,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch all authorized projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ["project-switcher-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_type, client_id, status, clients:client_id(id, name)")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;

    const query = searchQuery.toLowerCase().trim();
    return projects.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(query);
      const clientMatch = (p.clients as any)?.name?.toLowerCase().includes(query);
      const typeMatch =
        (p.project_type === "contracting" && ("مقاولات".includes(query) || "contracting".includes(query))) ||
        (p.project_type === "finishing" && ("تشطيبات".includes(query) || "finishing".includes(query)));
      const idMatch = p.id?.toLowerCase().includes(query);

      return nameMatch || clientMatch || typeMatch || idMatch;
    });
  }, [projects, searchQuery]);

  const handleSelectProject = (targetProject: any) => {
    // 1. If user selected the current active project -> idempotent, close dialog
    if (targetProject.id === currentProjectId) {
      setOpen(false);
      return;
    }

    const executeSwitch = () => {
      setOpen(false);
      setSearchQuery("");

      const { targetPath, isFallback, fallbackReason } = resolveProjectSwitchDestination({
        sourcePathname: location.pathname,
        targetProjectId: targetProject.id,
        targetProjectType: targetProject.project_type as ProjectType,
      });

      if (isFallback && fallbackReason) {
        toast({
          title: "تنبيه تغيير القسم",
          description: fallbackReason,
        });
      }

      // Navigate using normal push history so browser back returns to previous project
      navigate(targetPath);
    };

    // 2. If parent has an interceptor (e.g. dirty guard / pending mutation check)
    if (onBeforeSwitch) {
      onBeforeSwitch(executeSwitch);
    } else {
      executeSwitch();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`h-8 gap-2 px-2.5 rounded-lg border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-semibold shrink-0 cursor-pointer ${className || ""}`}
        title="تبديل المشروع السريع"
        aria-label="تبديل المشروع السريع"
      >
        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[140px] sm:max-w-[180px]">
          {currentProjectName || "تبديل المشروع"}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden bg-background" dir="rtl">
          <DialogHeader className="p-4 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="h-5 w-5 text-primary" />
              <span>التبديل السريع بين المشاريع</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              الانتقال الفوري إلى مشروع آخر مع الحفاظ على نفس القسم والبيانات الحالية.
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="p-3 border-b border-border bg-muted/20">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="ابحث باسم المشروع، العميل، أو نوع المشروع (مقاولات / تشطيبات)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-10 text-sm bg-background"
              />
            </div>
          </div>

          {/* Results List */}
          <ScrollArea className="max-h-[340px] p-2">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <span className="animate-spin inline-block h-4 w-4 border-2 border-primary border-t-transparent rounded-full mb-2" />
                <p>جاري تحميل المشاريع...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                <p className="font-semibold text-foreground">لا توجد مشاريع مطابقة</p>
                {searchQuery && (
                  <p className="text-[11px] mt-1">لم نجد نتائج مطابقة لـ "{searchQuery}"</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProjects.map((p) => {
                  const isCurrent = p.id === currentProjectId;
                  const isFinishing = p.project_type === "finishing";
                  const clientName = (p.clients as any)?.name;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProject(p)}
                      className={`w-full text-right p-2.5 rounded-lg flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-primary/10 border border-primary/30 text-primary font-bold"
                          : "hover:bg-muted/60 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {p.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 font-medium ${
                                isFinishing
                                  ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                                  : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                              }`}
                            >
                              {isFinishing ? "تشطيبات" : "مقاولات"}
                            </Badge>
                            {isCurrent && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground font-semibold">
                                المشروع الحالي
                              </Badge>
                            )}
                          </div>
                          {clientName && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">{clientName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isCurrent ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
