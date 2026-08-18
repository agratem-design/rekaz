import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Phone, Tag, FileText, Loader2 } from "lucide-react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";

interface QuickAddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (supplier: { id: string; name: string }) => void;
}

export const QuickAddSupplierDialog: React.FC<QuickAddSupplierDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    category: "",
    notes: "",
  });

  const isDirty = Boolean(
    formData.name.trim() ||
    formData.phone.trim() ||
    formData.category.trim() ||
    formData.notes.trim()
  );

  const guard = useUnsavedChangesGuard({
    isDirty: open && isDirty,
  });

  const handleClose = () => {
    if (isDirty) {
      guard.requestAction(() => {
        resetForm();
        onOpenChange(false);
      });
    } else {
      resetForm();
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      category: "",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "حقل مطلوب",
        description: "يرجى إدخال اسم المورد.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        category: formData.category.trim() || null,
        notes: formData.notes.trim() || null,
      };

      const { data, error } = await supabase
        .from("suppliers")
        .insert([payload])
        .select("id, name")
        .single();

      if (error) throw error;
      if (!data) throw new Error("No supplier row returned");

      // Invalidate relevant queries without global refresh
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["quick-add-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["command-palette-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-list"] });

      toast({
        title: "تم إضافة المورد بنجاح",
        description: `تم تسجيل المورد: ${data.name}`,
      });

      resetForm();
      onSuccess(data);
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "خطأ أثناء حفظ المورد",
        description: err.message || "تعذر إضافة المورد، يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-md p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="h-5 w-5 text-primary" />
              إضافة مورد جديد
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                اسم المورد / الشركة <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="أدخل اسم المورد..."
                className="text-right"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  رقم الهاتف (اختياري)
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="09XXXXXXXX"
                  className="text-left"
                  dir="ltr"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  التصنيف (اختياري)
                </Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="مواد بناء، حديد، ..."
                  className="text-right"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                ملاحظات
              </Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="أي ملاحظات إضافية..."
                rows={2}
                className="text-right resize-none"
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ المورد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={guard.showConfirmDialog}
        onOpenChange={guard.setShowConfirmDialog}
        onConfirmDiscard={guard.confirmDiscard}
        onStay={guard.cancelDiscard}
      />
    </>
  );
};
