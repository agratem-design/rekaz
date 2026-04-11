import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Ruler,
  X,
  Calculator,
  Variable,
  Tag,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface MeasurementComponent {
  name: string;
  symbol: string;
  label: string;
}

interface MeasurementConfig {
  id: string;
  name: string;
  unit_symbol: string;
  components: MeasurementComponent[];
  formula: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const emptyFormData = {
  name: "",
  unit_symbol: "",
  components: [] as MeasurementComponent[],
  formula: "",
  notes: "",
};

const emptyComponent: MeasurementComponent = {
  name: "",
  symbol: "",
  label: "",
};

const MeasurementTypes = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MeasurementConfig | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [newComponent, setNewComponent] = useState(emptyComponent);

  // Fetch measurement configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ["measurement-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_configs")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        components: (item.components || []) as unknown as MeasurementComponent[],
      })) as MeasurementConfig[];
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        unit_symbol: data.unit_symbol,
        components: JSON.parse(JSON.stringify(data.components)) as Json,
        formula: data.formula || null,
        notes: data.notes || null,
      };

      if (data.id) {
        const { error } = await supabase
          .from("measurement_configs")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("measurement_configs")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-configs"] });
      handleCloseDialog();
      toast({
        title: editingItem ? "تم تحديث نوع القياس" : "تم إضافة نوع القياس",
        description: "تم حفظ البيانات بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
      console.error("Error saving measurement config:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // SET NULL on referencing tables before deletion
      await supabase
        .from("project_items")
        .update({ measurement_config_id: null })
        .eq("measurement_config_id", id);
      
      await supabase
        .from("general_project_items")
        .update({ measurement_config_id: null })
        .eq("measurement_config_id", id);

      const { error } = await supabase
        .from("measurement_configs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-configs"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف نوع القياس بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "لا يمكن حذف نوع القياس لأنه مستخدم في بنود المشاريع",
        variant: "destructive",
      });
      console.error("Error deleting measurement config:", error);
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData(emptyFormData);
    setNewComponent(emptyComponent);
  };

  const handleEdit = (config: MeasurementConfig) => {
    setEditingItem(config);
    setFormData({
      name: config.name,
      unit_symbol: config.unit_symbol,
      components: config.components || [],
      formula: config.formula || "",
      notes: config.notes || "",
    });
    setDialogOpen(true);
  };

  const handleAddComponent = () => {
    if (!newComponent.name || !newComponent.symbol || !newComponent.label) {
      toast({
        title: "خطأ",
        description: "يجب ملء جميع حقول المكون",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate symbols
    if (formData.components.some(c => c.symbol === newComponent.symbol)) {
      toast({
        title: "خطأ",
        description: "الرمز مستخدم بالفعل",
        variant: "destructive",
      });
      return;
    }

    setFormData({
      ...formData,
      components: [...formData.components, { ...newComponent }],
    });
    setNewComponent(emptyComponent);
  };

  const handleRemoveComponent = (index: number) => {
    const newComponents = formData.components.filter((_, i) => i !== index);
    setFormData({ ...formData, components: newComponents });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال اسم نوع القياس",
        variant: "destructive",
      });
      return;
    }

    if (!formData.unit_symbol.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال رمز الوحدة",
        variant: "destructive",
      });
      return;
    }

    if (formData.components.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب إضافة مكون واحد على الأقل",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: editingItem?.id,
    });
  };

  const insertSymbolToFormula = (symbol: string) => {
    setFormData({
      ...formData,
      formula: formData.formula + symbol,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/general-items" className="hover:text-foreground">
          البنود العامة
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">أنواع القياس</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/general-items">
            <Button variant="outline" size="icon">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">أنواع القياس</h1>
            <p className="text-muted-foreground">
              إدارة أنواع القياس ومكوناتها ومعادلات الحساب
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة نوع قياس
        </Button>
      </div>

      {/* Configs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            أنواع القياس المتاحة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configs && configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم القياس</TableHead>
                  <TableHead className="text-right">رمز الوحدة</TableHead>
                  <TableHead className="text-right">المكونات</TableHead>
                  <TableHead className="text-right">المعادلة</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{config.unit_symbol}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {config.components?.map((comp, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1">
                            <span>{comp.label}</span>
                            <code className="text-xs bg-muted px-1 rounded">
                              {comp.symbol}
                            </code>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded" dir="ltr">
                        {config.formula || "-"}
                      </code>
                    </TableCell>
                    <TableCell>
                      {config.is_default ? (
                        <Badge variant="default">افتراضي</Badge>
                      ) : (
                        <Badge variant="outline">مخصص</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(config)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!config.is_default && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من حذف نوع القياس "{config.name}"؟</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(config.id)}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Ruler className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد أنواع قياس</p>
              <p className="text-sm">اضغط على "إضافة نوع قياس" لبدء الإضافة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "تعديل نوع القياس" : "إضافة نوع قياس جديد"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم نوع القياس *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: متر مكعب"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_symbol">رمز الوحدة *</Label>
                <Input
                  id="unit_symbol"
                  value={formData.unit_symbol}
                  onChange={(e) => setFormData({ ...formData, unit_symbol: e.target.value })}
                  placeholder="مثال: م³"
                />
              </div>
            </div>

            {/* Components Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Variable className="h-4 w-4" />
                  مكونات القياس
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing Components */}
                {formData.components.length > 0 && (
                  <div className="space-y-2">
                    {formData.components.map((comp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                      >
                        <Badge variant="secondary">{comp.label}</Badge>
                        <code className="text-sm bg-background px-2 py-1 rounded">
                          {comp.name}
                        </code>
                        <Badge variant="outline" className="font-mono">
                          {comp.symbol}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 mr-auto"
                          onClick={() => handleRemoveComponent(idx)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Component */}
                <div className="grid grid-cols-4 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم المكون (إنجليزي)</Label>
                    <Input
                      value={newComponent.name}
                      onChange={(e) =>
                        setNewComponent({ ...newComponent, name: e.target.value })
                      }
                      placeholder="length"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">التسمية (عربي)</Label>
                    <Input
                      value={newComponent.label}
                      onChange={(e) =>
                        setNewComponent({ ...newComponent, label: e.target.value })
                      }
                      placeholder="الطول"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">الرمز في المعادلة</Label>
                    <Input
                      value={newComponent.symbol}
                      onChange={(e) =>
                        setNewComponent({ ...newComponent, symbol: e.target.value.toUpperCase() })
                      }
                      placeholder="L"
                      className="font-mono"
                      maxLength={3}
                    />
                  </div>
                  <Button onClick={handleAddComponent} size="sm">
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Formula Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  معادلة الحساب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Available Symbols */}
                {formData.components.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">
                      الرموز المتاحة:
                    </span>
                    {formData.components.map((comp, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() => insertSymbolToFormula(comp.symbol)}
                      >
                        <Tag className="h-3 w-3" />
                        {comp.symbol} ({comp.label})
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => insertSymbolToFormula(" * ")}
                    >
                      ×
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => insertSymbolToFormula(" + ")}
                    >
                      +
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => insertSymbolToFormula(" - ")}
                    >
                      -
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => insertSymbolToFormula(" / ")}
                    >
                      ÷
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => insertSymbolToFormula("(")}
                    >
                      (
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={() => insertSymbolToFormula(")")}
                    >
                      )
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="formula">المعادلة</Label>
                  <Input
                    id="formula"
                    value={formData.formula}
                    onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                    placeholder="مثال: L * W * H"
                    className="font-mono text-left"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    استخدم الرموز المحددة للمكونات مع العمليات الحسابية (+، -، *، /)
                  </p>
                </div>

                {/* Formula Preview */}
                {formData.formula && formData.components.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">معاينة المعادلة:</p>
                    <code className="text-sm" dir="ltr">
                      {formData.components.reduce(
                        (formula, comp) =>
                          formula.replace(
                            new RegExp(comp.symbol, "g"),
                            `[${comp.label}]`
                          ),
                        formData.formula
                      )}
                    </code>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? "جاري الحفظ..."
                : editingItem
                ? "تحديث"
                : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeasurementTypes;
