/**
 * ========================================================
 * CONTRACTING TECHNICIAN STAFFING DOMAIN ENGINE (staffingCore)
 * ========================================================
 * Authoritative evaluation of technician requirements vs assignments.
 * Strictly isolated from financial accounting and profit calculations.
 */

export interface StaffingRequirementItem {
  id?: string;
  project_item_id?: string;
  technician_type_id: string;
  required_count: number;
  notes?: string | null;
  technician_types?: {
    id: string;
    name: string;
    code?: string;
  } | null;
}

export interface StaffingAssignmentItem {
  id?: string;
  project_item_id?: string;
  technician_id: string;
  technicians?: {
    id: string;
    name: string;
    technician_type_id?: string | null;
    specialty?: string | null;
  } | null;
}

export interface StaffingRequirementBreakdown {
  requirementId?: string;
  technicianTypeId: string;
  technicianTypeName: string;
  requiredCount: number;
  assignedCount: number;
  missingCount: number;
  isSatisfied: boolean;
  isOverstaffed: boolean;
  assignedTechnicians: Array<{
    id: string;
    name: string;
  }>;
}

export interface ItemStaffingEvaluationResult {
  hasRequirements: boolean;
  totalRequiredCount: number;
  totalAssignedCount: number;
  totalMissingCount: number;
  status: "no_requirements" | "complete" | "incomplete";
  statusLabel: string;
  breakdown: StaffingRequirementBreakdown[];
}

/**
 * Evaluates staffing completeness for a single project item.
 * 
 * Rules:
 * 1. Matching uses technician_type_id exclusively (unmapped/null types do NOT satisfy requirements).
 * 2. Missing count is calculated PER TECHNICIAN TYPE (MAX(required - assigned, 0)).
 * 3. Extra technicians do not create negative missing counts or false warnings.
 * 4. Zero requirements yields status = "no_requirements" (neutral, no warning).
 * 5. Incomplete staffing yields status = "incomplete" (operational warning).
 */
export function evaluateItemStaffing(
  requirements: StaffingRequirementItem[] = [],
  assignments: StaffingAssignmentItem[] = []
): ItemStaffingEvaluationResult {
  if (!requirements || requirements.length === 0) {
    return {
      hasRequirements: false,
      totalRequiredCount: 0,
      totalAssignedCount: assignments ? assignments.length : 0,
      totalMissingCount: 0,
      status: "no_requirements",
      statusLabel: "بدون متطلبات تعيين",
      breakdown: [],
    };
  }

  const breakdown: StaffingRequirementBreakdown[] = [];
  let totalRequiredCount = 0;
  let totalAssignedCount = 0;
  let totalMissingCount = 0;
  let allSatisfied = true;

  for (const req of requirements) {
    const typeId = req.technician_type_id;
    const typeName = req.technician_types?.name || "تخصص فني";
    const requiredCount = Math.max(1, Number(req.required_count || 1));
    totalRequiredCount += requiredCount;

    // Filter assignments strictly by technician_type_id matching requirement
    const matchedAssignments = (assignments || []).filter(
      (a) => a.technicians && a.technicians.technician_type_id === typeId
    );

    const assignedCount = matchedAssignments.length;
    totalAssignedCount += assignedCount;

    const missingCount = Math.max(0, requiredCount - assignedCount);
    totalMissingCount += missingCount;

    const isSatisfied = assignedCount >= requiredCount;
    if (!isSatisfied) {
      allSatisfied = false;
    }

    breakdown.push({
      requirementId: req.id,
      technicianTypeId: typeId,
      technicianTypeName: typeName,
      requiredCount,
      assignedCount,
      missingCount,
      isSatisfied,
      isOverstaffed: assignedCount > requiredCount,
      assignedTechnicians: matchedAssignments.map((a) => ({
        id: a.technicians!.id,
        name: a.technicians!.name,
      })),
    });
  }

  const status: "complete" | "incomplete" = allSatisfied ? "complete" : "incomplete";
  const statusLabel = allSatisfied ? "مكتمل التعيين" : `يحتاج تعيين (ناقص ${totalMissingCount})`;

  return {
    hasRequirements: true,
    totalRequiredCount,
    totalAssignedCount,
    totalMissingCount,
    status,
    statusLabel,
    breakdown,
  };
}

/**
 * Evaluates total project-level incomplete BOQ items count for Attention Required metrics.
 */
export function countIncompleteStaffingProjectItems(
  items: Array<{
    id: string;
    requirements?: StaffingRequirementItem[];
    assignments?: StaffingAssignmentItem[];
  }> = []
): {
  totalItemsWithRequirements: number;
  incompleteItemsCount: number;
  completedItemsCount: number;
} {
  let totalItemsWithRequirements = 0;
  let incompleteItemsCount = 0;
  let completedItemsCount = 0;

  for (const item of items) {
    const evaluation = evaluateItemStaffing(item.requirements, item.assignments);
    if (evaluation.hasRequirements) {
      totalItemsWithRequirements++;
      if (evaluation.status === "incomplete") {
        incompleteItemsCount++;
      } else if (evaluation.status === "complete") {
        completedItemsCount++;
      }
    }
  }

  return {
    totalItemsWithRequirements,
    incompleteItemsCount,
    completedItemsCount,
  };
}
