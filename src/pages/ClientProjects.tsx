import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { Plus, Hammer, Paintbrush, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams, Link } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DeterministicBreadcrumb } from "@/components/navigation/DeterministicBreadcrumb";

const ClientProjects = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();

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

  // Fetch financial summaries for all projects
  const { data: projectSummaries = {} } = useQuery({
    queryKey: ["client-projects-summaries", clientId],
    queryFn: async () => {
      if (!projects || projects.length === 0) return {};
      
      const projectIds = projects.map(p => p.id);
      const summaries: Record<string, { purchases: number; expenses: number; rentals: number; custody: number }> = {};
      
      // Initialize summaries
      projectIds.forEach(id => {
        summaries[id] = { purchases: 0, expenses: 0, rentals: 0, custody: 0 };
      });
      
      // Get purchases
      const { data: purchases } = await supabase
        .from("purchases")
        .select("project_id, total_amount")
        .in("project_id", projectIds);
      
      purchases?.forEach(p => {
        if (p.project_id && summaries[p.project_id]) {
          summaries[p.project_id].purchases += Number(p.total_amount || 0);
        }
      });
      
      // Get expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("project_id, amount")
        .in("project_id", projectIds);
      
      expenses?.forEach(e => {
        if (e.project_id && summaries[e.project_id]) {
          summaries[e.project_id].expenses += Number(e.amount || 0);
        }
      });
      
      // Get rentals
      const { data: rentals } = await supabase
        .from("equipment_rentals")
        .select("project_id, total_amount")
        .in("project_id", projectIds);
      
      rentals?.forEach(r => {
        if (r.project_id && summaries[r.project_id]) {
          summaries[r.project_id].rentals += Number(r.total_amount || 0);
        }
      });
      
      // Get custody
      const { data: custody } = await supabase
        .from("project_custody")
        .select("project_id, amount")
        .in("project_id", projectIds);
      
      custody?.forEach(c => {
        if (c.project_id && summaries[c.project_id]) {
          summaries[c.project_id].custody += Number(c.amount || 0);
        }
      });
      
      return summaries;
    },
    enabled: !!projects && projects.length > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  const contractingCount = (projects || []).filter((p) => p.project_type === "contracting").length;
  const finishingCount = (projects || []).filter((p) => p.project_type === "finishing").length;

  const renderProjectGrid = (projectList: typeof projects) => {
    if (!projectList || projectList.length === 0) {
      return (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground mb-4">لا توجد مشاريع في هذا القسم</p>
          <Button onClick={() => navigate(`/projects/new?client_id=${clientId}&returnTo=/projects/client/${clientId}`)}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة مشروع جديد
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projectList.map((project) => {
          const summary = projectSummaries[project.id] || { purchases: 0, expenses: 0, rentals: 0, custody: 0 };
          return (
            <ProjectCard 
              key={project.id}
              id={project.id}
              name={project.name}
              progress={project.progress}
              status={project.status as "active" | "pending" | "completed" | "cancelled"}
              budget={formatCurrencyLYD(project.budget)}
              spent={formatCurrencyLYD(project.spent)}
              supervisingEngineerName={project.supervising_engineer?.name}
              imageUrl={(project as any).image_url}
              purchasesTotal={summary.purchases}
              expensesTotal={summary.expenses}
              rentalsTotal={summary.rentals}
              custodyTotal={summary.custody}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <DeterministicBreadcrumb
        items={[
          { label: "المشاريع", href: "/projects" },
          { label: `مشاريع ${client?.name || "العميل"}`, isCurrent: true },
        ]}
        fallbackBackHref="/projects"
      />

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">مشاريع {client?.name}</h1>
          <p className="text-muted-foreground">إدارة مشاريع العميل مفرزة حسب نوع المشروع</p>
        </div>
        <Button className="gap-2 cursor-pointer font-bold" onClick={() => navigate(`/projects/new?client_id=${clientId}&returnTo=/projects/client/${clientId}`)}>
          <Plus className="h-5 w-5" />
          مشروع جديد
        </Button>
      </div>

      {/* Tabs Filter */}
      <Tabs defaultValue="all" dir="rtl" className="w-full space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="all" className="gap-1.5 cursor-pointer text-sm font-semibold">
            <FolderOpen className="h-4 w-4" />
            <span>جميع المشاريع ({projects?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="contracting" className="gap-1.5 cursor-pointer text-sm font-semibold">
            <Hammer className="h-4 w-4 text-amber-500" />
            <span>مشاريع المقاولات ({contractingCount})</span>
          </TabsTrigger>
          <TabsTrigger value="finishing" className="gap-1.5 cursor-pointer text-sm font-semibold">
            <Paintbrush className="h-4 w-4 text-blue-500" />
            <span>مشاريع التشطيب ({finishingCount})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {renderProjectGrid(projects)}
        </TabsContent>
        <TabsContent value="contracting">
          {renderProjectGrid((projects || []).filter((p) => p.project_type === "contracting"))}
        </TabsContent>
        <TabsContent value="finishing">
          {renderProjectGrid((projects || []).filter((p) => p.project_type === "finishing"))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientProjects;
