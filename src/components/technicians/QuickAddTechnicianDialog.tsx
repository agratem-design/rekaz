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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Plus, Wrench } from "lucide-react";

interface QuickAddTechnicianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTypeId?: string;
  onSuccess?: (newTechnician: { id: string; name: string; technician_type_id: string | null }) => void;
  onTechnicianAdded?: (newId: any) => void;
}

export const QuickAddTechnicianDialog: React.FC<QuickAddTechnicianDialogProps> = ({
  open,
  onOpenChange,
  defaultTypeId,
  onSuccess,
  onTechnicianAdded,
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [technicianTypeId, setTechnicianTypeId] = useState(defaultTypeId || "");
  const [phone, setPhone] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [notes, setNotes] = useState("");

  // Inline Specialty Create
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");

  React.useEffect(() => {
    if (defaultTypeId) {
      setTechnicianTypeId(defaultTypeId);
    }
  }, [defaultTypeId]);

  const { data: technicianTypes = [] } = useQuery<any[]>({
    queryKey: ["technician-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_types" as any)
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const code = `type_${Date.now()}`;
      const { data, error } = await (supabase
        .from("technician_types" as any)
        .insert({
          name,
          description: description || null,
          code,
          is_active: true,
        } as any)
        .select("id, name, code")
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (newType: any) => {
      queryClient.invalidateQueries({ queryKey: ["technician-types"] });
      setTechnicianTypeId(newType.id);
      setIsAddTypeOpen(false);
      setNewTypeName("");
      setNewTypeDesc("");
      toast.success(`تمت إضافة التخصص "${newType.name}" بنجاح واختياره`);
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء إضافة التخصص");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error("اسم الفني مطلوب");
      }

      const { data, error } = await (supabase
        .from("technicians" as any)
        .insert({
          name: name.trim(),
          technician_type_id: technicianTypeId || null,
          phone: phone.trim() || null,
          daily_rate: parseFloat(dailyRate) || null,
          notes: notes.trim() || null,
        } as any)
        .select("id, name, technician_type_id, specialty")
        .single() as any);

      if (error) throw error;
      return data;
    },
    onSuccess: (newTech: any) => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      toast.success(`تمت إضافة الفني ${newTech.name} بنجاح`);
      if (onSuccess) {
        onSuccess({
          id: newTech.id,
          name: newTech.name,
          technician_type_id: newTech.technician_type_id,
        });
      }
      if (onTechnicianAdded) {
        onTechnicianAdded(newTech.id);
      }
      setName("");
      setPhone("");
      setDailyRate("");
      setNotes("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء إضافة الفني");
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>إضافة فني جديد سريع</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">اسم الفني *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: أحمد عبد الله"
                className="text-right h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">التخصص الفني *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[11px] text-primary hover:text-primary/90 font-bold px-1 gap-1 cursor-pointer"
                  onClick={() => setIsAddTypeOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  <span>إضافة تخصص</span>
                </Button>
              </div>
              <Select
                value={technicianTypeId}
                onValueChange={setTechnicianTypeId}
                dir="rtl"
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="اختر التخصص الفني" />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-60">
                  {technicianTypes.map((t: any) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">رقم الهاتف</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XXXXXXXX"
                  className="text-left h-8 text-xs"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">اليومية المقدرة (د.ل)</Label>
                <Input
                  type="number"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  placeholder="0"
                  className="text-left h-8 text-xs"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !name.trim()}
              className="cursor-pointer text-xs"
            >
              {createMutation.isPending ? "جارٍ الحفظ..." : "حفظ الفني"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INLINE ADD SPECIALTY DIALOG */}
      <Dialog open={isAddTypeOpen} onOpenChange={setIsAddTypeOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span>إضافة تخصص فني جديد</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم التخصص *</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="مثال: فني كاميرات وشبكات"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الوصف (اختياري)</Label>
              <Input
                value={newTypeDesc}
                onChange={(e) => setNewTypeDesc(e.target.value)}
                placeholder="وصف مختصر لطبيعة العمل"
                className="text-xs h-9"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 text-xs h-8 font-bold"
                disabled={createTypeMutation.isPending || !newTypeName.trim()}
                onClick={() => createTypeMutation.mutate({ name: newTypeName.trim(), description: newTypeDesc.trim() })}
              >
                {createTypeMutation.isPending ? "جاري الحفظ..." : "حفظ التخصص"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-xs h-8"
                onClick={() => setIsAddTypeOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
