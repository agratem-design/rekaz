import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Edit, Trash2, GripVertical, Shield, Banknote,
  Wrench, Scale, AlertTriangle, BookOpen,
} from "lucide-react";

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  general: { label: "عام", icon: BookOpen, color: "bg-blue-500/15 text-blue-600" },
  financial: { label: "مالي", icon: Banknote, color: "bg-emerald-500/15 text-emerald-600" },
  technical: { label: "فني", icon: Wrench, color: "bg-purple-500/15 text-purple-600" },
  warranty: { label: "ضمان", icon: Shield, color: "bg-amber-500/15 text-amber-600" },
  safety: { label: "سلامة", icon: AlertTriangle, color: "bg-red-500/15 text-red-600" },
  legal: { label: "قانوني", icon: Scale, color: "bg-slate-500/15 text-slate-600" },
};

type ClauseTemplate = {
  id: string;
  title: string;
  content: string;
  category: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function ContractClauseTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-clause-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_clause_templates")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data as ClauseTemplate[];
    },
  });

  const filtered = filterCategory === "all"
    ? templates
    : templates.filter((t) => t.category === filterCategory);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory("general");
    setOrderIndex(templates.length + 1);
    setIsActive(true);
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setOrderIndex(templates.length + 1);
    setFormOpen(true);
  };

  const openEditForm = (t: ClauseTemplate) => {
    setEditingId(t.id);
    setTitle(t.title);
    setContent(t.content);
    setCategory(t.category);
    setOrderIndex(t.order_index);
    setIsActive(t.is_active);
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { title, content, category, order_index: orderIndex, is_active: isActive };
      if (editingId) {
        const { error } = await supabase
          .from("contract_clause_templates")
          .update(data)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_clause_templates")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clause-templates"] });
      toast({ title: editingId ? "تم تحديث البند" : "تم إضافة البند بنجاح" });
      setFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_clause_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clause-templates"] });
      toast({ title: "تم حذف البند" });
      setDeleteOpen(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("contract_clause_templates")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clause-templates"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            قوالب بنود العقود
          </h1>
          <p className="text-sm text-muted-foreground">
            إدارة البنود الافتراضية التي تُضاف تلقائياً عند إنشاء عقد جديد
          </p>
        </div>
        <Button className="gap-2" onClick={openNewForm}>
          <Plus className="h-4 w-4" />
          بند جديد
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterCategory("all")}
        >
          الكل ({templates.length})
        </Button>
        {Object.entries(categoryConfig).map(([key, cfg]) => {
          const count = templates.filter((t) => t.category === key).length;
          if (count === 0) return null;
          const Icon = cfg.icon;
          return (
            <Button
              key={key}
              variant={filterCategory === key ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setFilterCategory(key)}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Templates List */}
      <div className="space-y-3">
        {filtered.map((tmpl, idx) => {
          const cfg = categoryConfig[tmpl.category] || categoryConfig.general;
          const Icon = cfg.icon;
          return (
            <Card
              key={tmpl.id}
              className={`p-4 transition-all ${!tmpl.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 mt-1 shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono w-5">
                    {tmpl.order_index}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold">{tmpl.title}</h3>
                    <Badge variant="outline" className={cfg.color}>
                      <Icon className="h-3 w-3 ml-1" />
                      {cfg.label}
                    </Badge>
                    {!tmpl.is_active && (
                      <Badge variant="outline" className="text-muted-foreground">
                        معطل
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {tmpl.content}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={tmpl.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: tmpl.id, active: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditForm(tmpl)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setSelectedId(tmpl.id);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد بنود</h3>
          <Button onClick={openNewForm}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة بند
          </Button>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل البند" : "إضافة بند جديد"}</DialogTitle>
            <DialogDescription>
              {editingId ? "عدّل محتوى البند" : "أضف بند جديد لقوالب العقود"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 space-y-1.5">
                <Label>عنوان البند *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: نطاق الأعمال"
                />
              </div>

              <div className="space-y-1.5">
                <Label>التصنيف</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>الترتيب</Label>
                <Input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label>محتوى البند *</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب نص البند هنا..."
                  rows={6}
                  className="leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>مفعّل</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim() || !content.trim()}
            >
              {saveMutation.isPending ? "جاري الحفظ..." : editingId ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا البند؟</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedId && deleteMutation.mutate(selectedId)}
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
