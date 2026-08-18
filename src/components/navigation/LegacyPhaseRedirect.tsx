import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectSection, getProjectSectionPath } from '@/lib/navigation/projectNavigation';

interface LegacyPhaseRedirectProps {
  section: ProjectSection;
}

export function LegacyPhaseRedirect({ section }: LegacyPhaseRedirectProps) {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectId) {
      const targetPath = getProjectSectionPath(projectId, section, { phaseId });
      navigate(targetPath, { replace: true });
    }
  }, [projectId, phaseId, section, navigate]);

  return null;
}
