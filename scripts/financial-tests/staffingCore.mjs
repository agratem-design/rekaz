/**
 * ========================================================
 * CONTRACTING TECHNICIAN STAFFING DOMAIN ENGINE (MIRROR FOR TESTS)
 * ========================================================
 */

export function evaluateItemStaffing(requirements = [], assignments = []) {
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

  const breakdown = [];
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
        id: a.technicians.id,
        name: a.technicians.name,
      })),
    });
  }

  const status = allSatisfied ? "complete" : "incomplete";
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

export function countIncompleteStaffingProjectItems(items = []) {
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
