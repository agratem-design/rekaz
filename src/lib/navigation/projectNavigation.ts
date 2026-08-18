/**
 * Project Navigation Contract & Central Route Authority (UX Phase 1 & IA Refactor)
 * Enforces URL-first project context, two-level navigation hierarchy (Project -> Phase -> Section),
 * semantic section mapping, project type route guards, legacy route redirects,
 * and validated internal returnTo state.
 */

export type ProjectSection =
  | 'overview'
  | 'items'
  | 'phases'
  | 'purchases'
  | 'expenses'
  | 'progress'
  | 'equipment'
  | 'payments'
  | 'contracts'
  | 'report'
  | 'settings';

export type ProjectType = 'contracting' | 'finishing';

/**
 * Route support matrix per project type
 */
export const PROJECT_TYPE_ROUTES_MAP: Record<ProjectSection, { contracting: boolean; finishing: boolean; fallbackSection?: ProjectSection }> = {
  overview: { contracting: true, finishing: true },
  phases: { contracting: true, finishing: true },
  items: { contracting: true, finishing: false, fallbackSection: 'overview' }, // BOQ items are Contracting-only -> fallback Overview Hub
  purchases: { contracting: true, finishing: true },
  expenses: { contracting: true, finishing: true },
  progress: { contracting: true, finishing: false, fallbackSection: 'overview' }, // BOQ item progress is Contracting-only -> fallback Overview Hub
  equipment: { contracting: true, finishing: true },
  payments: { contracting: true, finishing: true },
  contracts: { contracting: true, finishing: true },
  report: { contracting: true, finishing: true },
  settings: { contracting: true, finishing: true },
};

/**
 * Builds canonical project section URL
 */
export function getProjectSectionPath(
  projectId: string,
  section: ProjectSection = 'phases',
  options?: { phaseId?: string | null; searchParams?: Record<string, string | number | boolean | undefined> }
): string {
  if (!projectId) return '/projects';

  let basePath = `/projects/${projectId}`;
  if (section !== 'phases') {
    basePath = `/projects/${projectId}/${section}`;
  }

  const params = new URLSearchParams();
  if (options?.phaseId) {
    params.set('phase', options.phaseId);
  }

  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    });
  }

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/**
 * Builds canonical nested phase section URL
 */
export function getPhaseSectionPath(
  projectId: string,
  phaseId: string,
  section?: 'items' | 'purchases' | 'expenses' | 'equipment' | 'progress' | 'labor'
): string {
  if (!section) {
    return `/projects/${projectId}/phases/${phaseId}`;
  }
  return `/projects/${projectId}/phases/${phaseId}/${section}`;
}

/**
 * Validates whether a project section is supported for the given project type
 */
export function isSectionSupportedForProjectType(section: ProjectSection, projectType: ProjectType): boolean {
  const rule = PROJECT_TYPE_ROUTES_MAP[section];
  if (!rule) return true;
  return rule[projectType] ?? true;
}

/**
 * Resolves safe fallback section if requested section is unsupported for project type
 */
export function getSafeFallbackSection(section: ProjectSection, projectType: ProjectType): ProjectSection {
  if (isSectionSupportedForProjectType(section, projectType)) {
    return section;
  }
  return PROJECT_TYPE_ROUTES_MAP[section]?.fallbackSection || 'overview';
}

/**
 * Resolves legacy deep-routes to canonical routes with query params
 * e.g. /projects/:id/phases/:phaseId/items -> /projects/:id/items?phase=:phaseId
 * /projects/:id/edit -> /projects/:id/settings
 */
export function resolveLegacyProjectRoute(pathname: string): { canonicalPath: string; isLegacy: boolean } {
  // Pattern 1: /projects/:id/phases/:phaseId/:section
  const legacyPhaseSectionMatch = pathname.match(/^\/projects\/([^/]+)\/phases\/([^/]+)\/(items|purchases|expenses|equipment)$/);
  if (legacyPhaseSectionMatch) {
    const [, projectId, phaseId, section] = legacyPhaseSectionMatch;
    return {
      canonicalPath: `/projects/${projectId}/${section}?phase=${encodeURIComponent(phaseId)}`,
      isLegacy: true,
    };
  }

  // Pattern 2: /projects/:id/edit -> /projects/:id/settings
  const legacyEditMatch = pathname.match(/^\/projects\/([^/]+)\/edit$/);
  if (legacyEditMatch) {
    const [, projectId] = legacyEditMatch;
    return {
      canonicalPath: `/projects/${projectId}/settings`,
      isLegacy: true,
    };
  }

  return {
    canonicalPath: pathname,
    isLegacy: false,
  };
}

/**
 * Validates that an internal returnTo path is safe (relative path, starts with /, not protocol-relative //)
 */
export function validateInternalReturnTo(returnTo: string | null | undefined, fallbackPath: string): string {
  if (!returnTo || typeof returnTo !== 'string') return fallbackPath;
  const trimmed = returnTo.trim();
  // Must start with exactly one '/' and not contain protocol or domain
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('://')) {
    return trimmed;
  }
  return fallbackPath;
}

/**
 * Validates that a phase belongs to the current project from loaded project phases
 */
export function validatePhaseBelongsToProject(
  phaseId: string | null | undefined,
  projectPhases: Array<{ id: string; project_id?: string }> | undefined
): boolean {
  if (!phaseId) return true; // No phase specified is always valid (All Phases)
  if (!projectPhases || projectPhases.length === 0) return false;
  return projectPhases.some(p => p.id === phaseId);
}

/**
 * Section metadata with Arabic titles
 */
export const PROJECT_SECTION_METADATA: Record<ProjectSection, { label: string; description: string }> = {
  overview: { label: "لوحة المشروع", description: "نظرة عامة على المشروع ومؤشراته" },
  phases: { label: "المراحل", description: "مراحل التنفيذ ومستحقاتها" },
  items: { label: "بنود المقايسة", description: "بنود وجداول الكميات والأسعار" },
  purchases: { label: "المشتريات", description: "فواتير ومشتريات المواد والعمالة" },
  expenses: { label: "المصروفات", description: "المصروفات النثرية والمباشرة" },
  progress: { label: "نسب الإنجاز", description: "متابعة إنجاز واستحقاقات الفنيين" },
  equipment: { label: "إيجار المعدات", description: "معدات المشروع وإيجاراتها" },
  payments: { label: "تحصيلات العميل", description: "مقبوضات ودفعات الزبون على العقد" },
  contracts: { label: "العقود والاتفاقيات", description: "عقود المشروع والدفعات التعاقدية" },
  report: { label: "التقرير المالي", description: "التقرير المالي والحسابي للمشروع" },
  settings: { label: "إعدادات المشروع", description: "بيانات وإعدادات المشروع" },
};

/**
 * Extracts semantic project section from URL pathname
 */
export function extractProjectSectionFromPath(pathname: string): ProjectSection {
  // Check nested phase section first: /projects/:id/phases/:phaseId/:section
  const phaseSectionMatch = pathname.match(/^\/projects\/[^/]+\/phases\/[^/]+\/([^/?#]+)/);
  if (phaseSectionMatch) {
    const rawPhaseSection = phaseSectionMatch[1] as ProjectSection;
    if (PROJECT_TYPE_ROUTES_MAP[rawPhaseSection]) return rawPhaseSection;
  }

  // Check direct project section: /projects/:id/:section
  const sectionMatch = pathname.match(/^\/projects\/[^/]+\/([^/?#]+)/);
  if (!sectionMatch) return 'phases'; // Project root defaults to 'phases' directory
  const raw = sectionMatch[1] as ProjectSection;
  return PROJECT_TYPE_ROUTES_MAP[raw] ? raw : 'phases';
}

/**
 * Resolves safe destination when switching from one project to another.
 * 1. Preserves semantic section when supported by target project type.
 * 2. Drops all source project-specific entity parameters (?phase=..., ?item=...).
 * 3. Falls back to safe fallback section ('overview') if section unsupported (e.g. BOQ items -> Finishing).
 */
export function resolveProjectSwitchDestination({
  sourcePathname,
  targetProjectId,
  targetProjectType,
}: {
  sourcePathname: string;
  targetProjectId: string;
  targetProjectType: ProjectType;
}): {
  targetPath: string;
  preservedSection: ProjectSection;
  isFallback: boolean;
  fallbackReason?: string;
} {
  const sourceSection = extractProjectSectionFromPath(sourcePathname);

  if (isSectionSupportedForProjectType(sourceSection, targetProjectType)) {
    return {
      targetPath: getProjectSectionPath(targetProjectId, sourceSection),
      preservedSection: sourceSection,
      isFallback: false,
    };
  }

  // Unsupported section for target project type -> fallback to overview
  const fallback = getSafeFallbackSection(sourceSection, targetProjectType);
  return {
    targetPath: getProjectSectionPath(targetProjectId, fallback),
    preservedSection: fallback,
    isFallback: true,
    fallbackReason: `القسم [${PROJECT_SECTION_METADATA[sourceSection]?.label || sourceSection}] غير متاح في مشاريع ${targetProjectType === 'finishing' ? 'التشطيبات' : 'المقاولات'}. تم التحويل تلقائياً إلى [${PROJECT_SECTION_METADATA[fallback]?.label || fallback}].`,
  };
}
