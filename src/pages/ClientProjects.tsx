import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus, ArrowRight, Search, FolderKanban, Layers, ShoppingCart,
  Coins, TrendingUp, Wrench, Wallet, FileText, LogIn, MapPin, HardHat, Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams, Link } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";

const statusLabels: Record<string, string> = {
  active: "نشط",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusBadgeClass: Record<string, string> = {
  active: "bg-green-500/15 text-green-600 border-green-500/30",
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  completed: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  cancelled: "bg-red-500/15 text-red-600 border-red-500/30",
};

const ClientProjects = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const { isEngineer, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, supervising_engineer:engineers!projects_supervising_engineer_id_fkey(id, name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
    links.push({ icon: Wrench, label: "المعدات", href: `/projects/${projectId}/equipment` });
    if (isAdmin) {
      links.push({ icon: Settings, label: "الإعدادات", href: `/projects/${projectId}/edit` });
    }
    return links;
  };

  const filteredProjects = projects?.filter((p) =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-primary">المشاريع</Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{client?.name || "العميل"}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">مشاريع {client?.name}</h1>
          <p className="text-sm text-muted-foreground">إدارة مشاريع العميل</p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={() => navigate(`/projects/new?client_id=${clientId}&returnTo=/projects/client/${clientId}`)}>
            <Plus className="h-4 w-4" />
            مشروع جديد
          </Button>
        )}
      </div>

      {/* Search */}
      {(projects?.length || 0) > 3 && (
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const links = quickLinks(project.id);
            return (
              <Card key={project.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                {project.image_url && (
                  <div className="h-32 w-full overflow-hidden bg-muted">
                    <img
                      src={project.image_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
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
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 ${statusBadgeClass[project.status] || ""}`}>
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
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
                      <div className="text-left">
                        <p className="text-muted-foreground">المصروف</p>
                        <p className="font-semibold">{formatCurrencyLYD(project.spent || 0)}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Icons */}
                  <div className="flex items-center gap-1 pt-2 border-t border-border flex-wrap">
                    {links.map((link) => {
                      const LinkIcon = link.icon;
                      return (
                        <Link key={link.href} to={link.href} title={link.label}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent">
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Enter Project */}
                  <Button className="w-full gap-2" onClick={() => navigate(`/projects/${project.id}/phases`)}>
                    <LogIn className="h-4 w-4" />
                    دخول المشروع
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">لا توجد مشاريع لهذا العميل</p>
          {isAdmin && (
            <Button onClick={() => navigate(`/projects/new?client_id=${clientId}&returnTo=/projects/client/${clientId}`)}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة مشروع جديد
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default ClientProjects;
