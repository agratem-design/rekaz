import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Wrench, FolderOpen, ArrowLeft, Calendar, Package } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const ProjectsWithRentals = () => {
  const navigate = useNavigate();

  // Fetch projects that have rentals
  const { data: projectsWithRentals, isLoading } = useQuery({
    queryKey: ["projects-with-rentals"],
    queryFn: async () => {
      // Get all rentals with project info
      const { data: rentals, error: rentalsError } = await supabase
        .from("equipment_rentals")
        .select(`
          id,
          status,
          daily_rate,
          total_amount,
          start_date,
          end_date,
          project_id,
          equipment:equipment_id (
            id,
            name,
            image_url
          )
        `)
        .not("project_id", "is", null);

      if (rentalsError) throw rentalsError;

      // Get unique project IDs
      const projectIds = [...new Set(rentals?.map(r => r.project_id).filter(Boolean))];

      if (projectIds.length === 0) return [];

      // Fetch projects
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          status,
          location,
          client:client_id (
            id,
            name
          )
        `)
        .in("id", projectIds);

      if (projectsError) throw projectsError;

      // Group rentals by project
      return projects?.map(project => {
        const projectRentals = rentals?.filter(r => r.project_id === project.id) || [];
        const activeRentals = projectRentals.filter(r => r.status === "active").length;
        const totalRentals = projectRentals.length;
        const totalAmount = projectRentals.reduce((sum, r) => sum + (r.total_amount || 0), 0);

        return {
          ...project,
          rentals: projectRentals,
          activeRentals,
          totalRentals,
          totalAmount,
        };
      }) || [];
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "نشط", variant: "default" },
      pending: { label: "معلق", variant: "secondary" },
      completed: { label: "مكتمل", variant: "outline" },
      cancelled: { label: "ملغي", variant: "destructive" },
    };
    const s = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مشاريع الإيجارات</h1>
            <p className="text-sm text-muted-foreground">
              جميع المشاريع التي تحتوي على إيجارات معدات
            </p>
          </div>
        </div>
      </div>

      {projectsWithRentals?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد مشاريع بها إيجارات</h3>
          <p className="text-muted-foreground mb-4">
            ابدأ بإضافة إيجارات للمشاريع من صفحة المشروع
          </p>
          <Button onClick={() => navigate("/projects")}>
            عرض المشاريع
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectsWithRentals?.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(`/projects/${project.id}/equipment`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {project.name}
                    </CardTitle>
                    {project.client && (
                      <p className="text-sm text-muted-foreground">{project.client.name}</p>
                    )}
                  </div>
                  {getStatusBadge(project.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.location && (
                  <p className="text-sm text-muted-foreground">{project.location}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Package className="h-4 w-4" />
                      <span>إجمالي الإيجارات</span>
                    </div>
                    <p className="text-lg font-semibold">{project.totalRentals}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Wrench className="h-4 w-4" />
                      <span>نشطة</span>
                    </div>
                    <p className="text-lg font-semibold text-primary">{project.activeRentals}</p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">إجمالي المبلغ</span>
                    <span className="font-semibold text-primary">
                      {formatCurrencyLYD(project.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Equipment thumbnails */}
                {project.rentals.length > 0 && (
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {project.rentals.slice(0, 4).map((rental: any, idx: number) => (
                      <div
                        key={rental.id}
                        className="w-8 h-8 rounded-full border-2 border-background bg-muted overflow-hidden"
                        title={rental.equipment?.name}
                      >
                        {rental.equipment?.image_url ? (
                          <img
                            src={rental.equipment.image_url}
                            alt={rental.equipment.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Wrench className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {project.rentals.length > 4 && (
                      <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                        +{project.rentals.length - 4}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects/${project.id}/equipment`);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  عرض الإيجارات
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsWithRentals;
