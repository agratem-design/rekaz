import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ProjectSection,
  ProjectType,
  isSectionSupportedForProjectType,
  getSafeFallbackSection,
  getProjectSectionPath,
} from '@/lib/navigation/projectNavigation';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectRouteGuardProps {
  section: ProjectSection;
  children: React.ReactNode;
}

export function ProjectRouteGuard({ section, children }: ProjectRouteGuardProps) {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: project, isLoading, isError } = useQuery({
    queryKey: ['project-route-guard', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_type, client_id, status')
        .eq('id', projectId)
        .maybeSingle();

      if (error) {
        console.error('Error loading project for guard:', error);
        return null;
      }
      return data;
    },
    enabled: Boolean(projectId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const projectType: ProjectType = (project?.project_type as ProjectType) || 'contracting';
  const isSupported = isSectionSupportedForProjectType(section, projectType);

  useEffect(() => {
    if (!isLoading && project && !isSupported) {
      const fallbackSection = getSafeFallbackSection(section, projectType);
      const targetPath = getProjectSectionPath(project.id, fallbackSection);
      navigate(targetPath, { replace: true });
    }
  }, [isLoading, project, isSupported, section, projectType, navigate]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" dir="rtl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4" dir="rtl">
        <div className="p-3 rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">المشروع غير موجود</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          تعذر العثور على المشروع المطلوب أو قد يكون تم حذفه.
        </p>
        <Button onClick={() => navigate('/projects')} className="cursor-pointer">
          العودة إلى قائمة المشاريع
        </Button>
      </div>
    );
  }

  if (!isSupported) {
    // While redirect is in flight, render nothing to avoid flash of forbidden UI
    return null;
  }

  return <>{children}</>;
}
