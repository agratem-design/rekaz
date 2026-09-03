import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import { OperationTypeSelector, OperationType } from "./OperationTypeSelector";
import { MaterialPurchaseForm } from "./forms/MaterialPurchaseForm";
import { SupplierServiceForm } from "./forms/SupplierServiceForm";
import { DirectProjectExpenseForm } from "@/components/expenses/forms/DirectProjectExpenseForm";
import { TechnicianLaborForm } from "@/components/technicians/forms/TechnicianLaborForm";
import { ArrowRight, Package, Wrench, Receipt, Layers, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectOperationDrawerShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  projectType?: "contracting" | "finishing" | string;
  defaultTreasuryId?: string | null;
  initialOperationType?: OperationType | null;
  activePhaseId?: string | null;
  activePhaseName?: string | null;
  editingRecord?: {
    type: "material" | "service" | "expense" | "labor";
    data: any;
  } | null;
}

export const ProjectOperationDrawerShell: React.FC<ProjectOperationDrawerShellProps> = ({
  open,
  onOpenChange,
  projectId,
  projectName = "المشروع",
  projectType = "contracting",
  defaultTreasuryId,
  initialOperationType = null,
  activePhaseId: propPhaseId,
  activePhaseName: propPhaseName,
  editingRecord = null,
}) => {
  const routeParams = useParams<{ id?: string; projectId?: string; phaseId?: string }>();
  const effectiveActivePhaseId = propPhaseId || routeParams.phaseId || null;
  const effectiveActivePhaseName = propPhaseName || null;

  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(
    initialOperationType
  );
  const [formDirty, setFormDirty] = useState<boolean>(false);

  // Sync initial operation type when open changes
  useEffect(() => {
    if (open) {
      if (editingRecord) {
        setSelectedOperation(editingRecord.type);
      } else if (initialOperationType) {
        setSelectedOperation(initialOperationType);
      } else {
        setSelectedOperation(null);
      }
      setFormDirty(false);
    }
  }, [open, initialOperationType, editingRecord]);

  const guard = useUnsavedChangesGuard({
    isDirty: open && formDirty,
  });

  const handleClose = () => {
    if (formDirty) {
      guard.requestAction(() => {
        setFormDirty(false);
        setSelectedOperation(null);
        onOpenChange(false);
      });
    } else {
      setFormDirty(false);
      setSelectedOperation(null);
      onOpenChange(false);
    }
  };

  const handleBackToSelector = () => {
    if (formDirty) {
      guard.requestAction(() => {
        setFormDirty(false);
        setSelectedOperation(null);
      });
    } else {
      setFormDirty(false);
      setSelectedOperation(null);
    }
  };

  const handleSuccess = () => {
    setFormDirty(false);
    setSelectedOperation(null);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(val) => !val && handleClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 overflow-y-auto bg-background text-foreground flex flex-col"
          dir="rtl"
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-border/80 bg-muted/20 sticky top-0 z-20 backdrop-blur-md">
            <SheetHeader className="p-0 space-y-0 text-right">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedOperation && !editingRecord && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleBackToSelector}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                      title="العودة لاختيار نوع العملية"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <SheetTitle className="text-base font-bold truncate text-foreground">
                        {editingRecord
                          ? "تعديل بيانات العملية"
                          : selectedOperation === "material"
                          ? "إضافة شراء مواد ومستلزمات"
                          : selectedOperation === "service"
                          ? "إضافة خدمة مورد خارجية"
                          : selectedOperation === "labor"
                          ? "تسجيل عمل فني / عمالة يومية"
                          : selectedOperation === "expense"
                          ? "إضافة مصروف مباشر للمشروع"
                          : "إضافة عملية للمشروع"}
                      </SheetTitle>
                    </div>

                    <SheetDescription className="text-xs text-muted-foreground mt-0.5 text-right">
                      {editingRecord
                        ? "تعديل السجل المحاسبي والتشغيلي للعملية المحددة."
                        : selectedOperation === "labor"
                        ? "تسجيل أعمال وإنجاز الفنيين والعمالة اليومية للمشروع والمرحلة المحددة."
                        : selectedOperation === "material"
                        ? "تسجيل فواتير ومشتريات المواد والمستلزمات وتحديد طرق السداد."
                        : selectedOperation === "service"
                        ? "تسجيل خدمات الموردين الخارجيين ومتابعة المستحقات."
                        : selectedOperation === "expense"
                        ? "تسجيل المصاريف التشغيلية المباشرة المخصومة نقداً من الخزينة."
                        : "اختر نوع العملية وأدخل بياناتها للمشروع والمرحلة الحالية."}
                    </SheetDescription>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="truncate max-w-[200px]">{projectName}</span>
                      <span>•</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                        {projectType === "contracting" ? "مقاولات" : "تشطيبات"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>
          </div>

          {/* Drawer Body */}
          <div className="p-5 flex-1 space-y-6">
            {!selectedOperation && (
              <OperationTypeSelector
                selectedType={selectedOperation}
                onSelectType={(type) => {
                  setSelectedOperation(type);
                  setFormDirty(false);
                }}
              />
            )}

            {selectedOperation === "material" && (
              <MaterialPurchaseForm
                projectId={projectId}
                projectType={projectType}
                activePhaseId={effectiveActivePhaseId}
                activePhaseName={effectiveActivePhaseName}
                defaultTreasuryId={defaultTreasuryId}
                editingPurchase={editingRecord?.type === "material" ? editingRecord.data : null}
                onSuccess={handleSuccess}
                onCancel={handleClose}
                onDirtyChange={setFormDirty}
              />
            )}

            {selectedOperation === "service" && (
              <SupplierServiceForm
                projectId={projectId}
                projectType={projectType}
                activePhaseId={effectiveActivePhaseId}
                activePhaseName={effectiveActivePhaseName}
                defaultTreasuryId={defaultTreasuryId}
                editingPurchase={editingRecord?.type === "service" ? editingRecord.data : null}
                onSuccess={handleSuccess}
                onCancel={handleClose}
                onDirtyChange={setFormDirty}
              />
            )}

            {selectedOperation === "labor" && (
              <TechnicianLaborForm
                projectId={projectId}
                projectType={projectType}
                activePhaseId={effectiveActivePhaseId}
                activePhaseName={effectiveActivePhaseName}
                defaultTreasuryId={defaultTreasuryId}
                editingRecord={editingRecord?.type === "labor" ? editingRecord.data : null}
                onSuccess={handleSuccess}
                onCancel={handleClose}
                onDirtyChange={setFormDirty}
              />
            )}

            {selectedOperation === "expense" && (
              <DirectProjectExpenseForm
                projectId={projectId}
                projectType={projectType}
                activePhaseId={effectiveActivePhaseId}
                activePhaseName={effectiveActivePhaseName}
                defaultTreasuryId={defaultTreasuryId}
                editingExpense={editingRecord?.type === "expense" ? editingRecord.data : null}
                onSuccess={handleSuccess}
                onCancel={handleClose}
                onDirtyChange={setFormDirty}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog
        open={guard.showConfirmDialog}
        onOpenChange={guard.setShowConfirmDialog}
        onConfirmDiscard={guard.confirmDiscard}
        onStay={guard.cancelDiscard}
      />
    </>
  );
};
