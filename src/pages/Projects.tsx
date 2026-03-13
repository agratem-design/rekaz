import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  Building,
  FolderKanban,
  ShoppingCart,
  Coins,
  TrendingUp,
  Pencil,
  Wrench,
  Layers,
  MapPin,
  HardHat,
  FileText,
  LogIn,
  Wallet,
  Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  active: "bg-green-500/15 text-green-600 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  completed: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  cancelled: "bg-red-500/15 text-red-600 border-red-500/30",
};

const Projects = () => {
  const { isEngineer, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const projectIds = projects?.map(p => p.id) || [];

  const { data: phasesMap } = useQuery({
    queryKey: ["projects-phases", projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return {};
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .in("project_id", projectIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      data?.forEach((phase) => {
        if (!map[phase.project_id]) map[phase.project_id] = [];
        map[phase.project_id].push(phase);
      });
      return map;
    },
    enabled: projectIds.length > 0,
  });

  const filteredProjects = projects?.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalProjects = projects?.length || 0;
  const activeCount = projects?.filter((p) => p.status === "active").length || 0;
  const pendingCount = projects?.filter((p) => p.status === "pending").length || 0;
  const completedCount = projects?.filter((p) => p.status === "completed").length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const quickLinks = (projectId: string) => {
    const links = [
      { icon: Layers, label: "المراحل", href: `/projects/${projectId}/phases` },
      { icon: TrendingUp, label: "التقدم", href: `/projects/${projectId}/progress` },
      { icon: FileText, label: "العقود", href: `/projects/${projectId}/contracts` },
    ];
    if (!isEngineer) {
      links.push(
        { icon: ShoppingCart, label: "المشتريات", href: `/projects/${projectId}/purchases` },
        { icon: Coins, label: "المصروفات", href: `/projects/${projectId}/expenses` },
        { icon: Wallet, label: "المدفوعات", href: `/projects/${projectId}/payments` },
      );
    }
    links.push(
      { icon: Wrench, label: "المعدات", href: `/projects/${projectId}/equipment` },
    );
    if (isAdmin) {
      links.push({ icon: Settings, label: "الإعدادات", href: `/projects/${projectId}/edit` });
    }
    return links;
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">المشاريع</h1>
          <p className="text-sm text-muted-foreground">جميع المشاريع في مكان واحد</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate("/projects/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            مشروع جديد
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalProjects}</p>
          <p className="text-xs text-muted-foreground">إجمالي المشاريع</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{activeCount}</p>
          <p className="text-xs text-muted-foreground">نشط</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">معلق</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-500">{completedCount}</p>
          <p className="text-xs text-muted-foreground">مكتمل</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، العميل، أو الموقع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="pending">معلق</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      {filteredProjects?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد مشاريع مطابقة</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => {
            
            const phases = phasesMap?.[project.id] || [];
            const links = quickLinks(project.id);

            return (
              <Card key={project.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                {/* Project Image */}
                {project.image_url && (
                  <div className="h-24 sm:h-32 w-full overflow-hidden bg-muted">
                    <img
                      src={project.image_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                {/* Header: Icon + Name + Status */}
                <div className="p-4 pb-3 space-y-3">
                  <div className="flex items-start gap-3">
                    {!project.image_url && (
                      <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderKanban className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate flex-1">{project.name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 shrink-0 ${statusBadgeClass[project.status] || ""}`}
                        >
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        {project.clients?.name && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {project.clients.name}
                          </span>
                        )}
                        {project.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {project.location}
                          </span>
                        )}
                        {project.supervising_engineer?.name && (
                          <span className="flex items-center gap-1">
                            <HardHat className="h-3 w-3" />
                            {project.supervising_engineer.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">التقدم</span>
                      <span className="font-semibold text-primary">{project.progress || 0}%</span>
                    </div>
                    <Progress value={project.progress || 0} className="h-1.5" />
                  </div>

                  {/* Budget */}
                  {!isEngineer && (
                    <div className="flex justify-between text-xs pt-2 border-t border-border">
                      <div>
                        <p className="text-muted-foreground">الميزانية</p>
                        <p className="font-semibold">{formatCurrencyLYD(project.budget || 0)}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Icons - Compact Row */}
                  <div className="flex items-center gap-1 pt-2 border-t border-border flex-wrap">
                    {links.map((link) => {
                      const LinkIcon = link.icon;
                      return (
                        <Link key={link.href} to={link.href} title={link.label}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Enter Project Button */}
                  <Button
                    className="w-full gap-2"
                    onClick={() => navigate(`/projects/${project.id}/phases`)}
                  >
                    <LogIn className="h-4 w-4" />
                    دخول المشروع
                  </Button>

                  {/* Phases List (always visible) */}
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                      <Layers className="h-3.5 w-3.5" />
                      <span>فواتير المراحل</span>
                    </div>
                    {phases.length > 0 ? (
                      phases.map((phase) => (
                        <div
                          key={phase.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/projects/${project.id}/phases/${phase.id}/items`)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot[phase.status] || statusDot.pending}`} />
                            <span className="text-sm font-medium truncate">{phase.name}</span>
                          </div>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${statusBadgeClass[phase.status] || ""}`}>
                            {statusLabels[phase.status] || phase.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-xs text-muted-foreground">لا توجد فواتير مراحل</p>
                        <Link to={`/projects/${project.id}/phases`}>
                          <span className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-1 justify-center">
                            <Plus className="h-3 w-3" />
                            إضافة فاتورة مرحلة
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
