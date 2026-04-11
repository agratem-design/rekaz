import { useState, useMemo } from "react";
import { safeEvaluate } from "@/lib/safeFormula";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Ruler, Package, Filter, Calculator, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface GeneralItem {
  id: string;
  name: string;
  description: string | null;
  measurement_type: string;
  default_unit_price: number;
  category: string | null;
  formula: string | null;
  notes: string | null;
  measurement_config_id: string | null;
  created_at: string;
  updated_at: string;
}

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
}


const defaultCategories = [
  "أعمدة",
  "جدران",
  "أسقف",
  "أرضيات",
  "أساسات",
  "سلالم",
  "أعمال تشطيب",
  "أعمال كهربائية",
  "أعمال صحية",
  "أخرى",
];

const GeneralItems = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GeneralItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_unit_price: "",
    category: "",
    formula: "",
    notes: "",
    measurement_config_id: "",
    component_values: {} as Record<string, string>,
    measurement_factor: "1",
  });

  // Fetch general items
  const { data: items, isLoading } = useQuery({
    queryKey: ["general-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_project_items")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as GeneralItem[];
    },
  });

  // Fetch measurement configs
  const { data: measurementConfigs } = useQuery({
    queryKey: ["measurement-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_configs")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        components: (item.components || []) as unknown as MeasurementComponent[],
      })) as MeasurementConfig[];
    },
  });

  // Get unique categories from items
  const existingCategories = [...new Set(items?.map(item => item.category).filter(Boolean) || [])];
  const allCategories = [...new Set([...defaultCategories, ...existingCategories])];

  // Get selected measurement config
  const selectedMeasurementConfig = useMemo(() => {
    if (!formData.measurement_config_id || !measurementConfigs) return null;
    return measurementConfigs.find(c => c.id === formData.measurement_config_id) || null;
  }, [formData.measurement_config_id, measurementConfigs]);

  // Calculate quantity based on formula and component values
  const calculatedQuantity = useMemo(() => {
    if (!selectedMeasurementConfig?.formula) return null;
    
    try {
      let formula = selectedMeasurementConfig.formula;
      const factor = parseFloat(formData.measurement_factor) || 1;
      
      // Check if all components have values
      let hasAllValues = true;
      selectedMeasurementConfig.components.forEach(comp => {
        const value = parseFloat(formData.component_values[comp.symbol]);
        if (isNaN(value) || value === 0) hasAllValues = false;
        const regex = new RegExp(comp.symbol, 'g');
        formula = formula.replace(regex, (value || 0).toString());
      });
      
      if (!hasAllValues) return null;
      
      // Evaluate the formula
      const result = safeEvaluate(formula);
      if (result === null) return null;
      
      return result * factor;
    } catch {
      return null;
    }
  }, [selectedMeasurementConfig, formData.component_values, formData.measurement_factor]);

  // Calculate formula example with fixed value of 10 - uses measurement config symbols
  const formulaExample = useMemo(() => {
    if (!formData.formula) return null;
    
    try {
      const exampleValue = 10;
      const price = parseFloat(formData.default_unit_price) || exampleValue;
      
      let formula = formData.formula;
      const values: Record<string, number> = {};
      
      // First, replace measurement config component symbols if available
      if (selectedMeasurementConfig && selectedMeasurementConfig.components.length > 0) {
        selectedMeasurementConfig.components.forEach(comp => {
          const regex = new RegExp(comp.symbol, 'g');
          formula = formula.replace(regex, exampleValue.toString());
          values[comp.symbol] = exampleValue;
        });
      }
      
      // Also replace common Arabic/English variables
      formula = formula
        .replace(/السعر|price/gi, price.toString())
        .replace(/الكمية|qty/gi, exampleValue.toString())
        .replace(/الطول|length/gi, exampleValue.toString())
        .replace(/العرض|width/gi, exampleValue.toString())
        .replace(/الارتفاع|height/gi, exampleValue.toString());
      
      // Add common variables to values display
      values['السعر'] = price;
      
      const result = safeEvaluate(formula);
      if (result === null) return null;
      
      return {
        result,
        values,
        hasConfigSymbols: selectedMeasurementConfig && selectedMeasurementConfig.components.length > 0,
      };
    } catch {
      return null;
    }
  }, [formData.formula, formData.default_unit_price, selectedMeasurementConfig]);

  // Add/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        measurement_type: "linear",
        default_unit_price: parseFloat(data.default_unit_price) || 0,
        category: data.category || null,
        formula: data.formula || null,
        notes: data.notes || null,
        measurement_config_id: data.measurement_config_id || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("general_project_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("general_project_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-items"] });
      toast({
        title: editingItem ? "تم تحديث العنصر" : "تم إضافة العنصر",
        description: editingItem
          ? "تم تحديث بيانات العنصر العام بنجاح"
          : "تم إضافة العنصر العام بنجاح",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ العنصر",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("general_project_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-items"] });
      toast({
        title: "تم حذف العنصر",
        description: "تم حذف العنصر العام بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف العنصر",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({
      name: "",
      description: "",
      default_unit_price: "",
      category: "",
      formula: "",
      notes: "",
      measurement_config_id: "",
      component_values: {},
      measurement_factor: "1",
    });
  };

  const handleEdit = (item: GeneralItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      default_unit_price: item.default_unit_price.toString(),
      category: item.category || "",
      formula: item.formula || "",
      notes: item.notes || "",
      measurement_config_id: item.measurement_config_id || "",
      component_values: {},
      measurement_factor: "1",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم العنصر",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredItems = items?.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group items by category
  const groupedItems = filteredItems?.reduce((acc, item) => {
    const category = item.category || "بدون تصنيف";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, GeneralItem[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">البنود العامة</h1>
          <p className="text-muted-foreground">البنود المتكررة التي يمكن استخدامها في المشاريع</p>
        </div>
        <div className="flex gap-2">
          <Link to="/measurement-types">
            <Button variant="outline">
              <Settings className="h-4 w-4 ml-2" />
              أنواع القياس
            </Button>
          </Link>
          <Button onClick={() => { setEditingItem(null); setFormData({ name: "", description: "", default_unit_price: "", category: "", formula: "", notes: "", measurement_config_id: "", component_values: {}, measurement_factor: "1" }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة بند عام
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 flex-wrap">
        <Input
          placeholder="بحث في البنود..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue placeholder="جميع التصنيفات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع التصنيفات</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat as string}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items by Category */}
      {groupedItems && Object.keys(groupedItems).length > 0 ? (
        Object.entries(groupedItems).map(([category, categoryItems]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {category} ({categoryItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">البند</TableHead>
                    <TableHead className="text-right">نوع القياس</TableHead>
                    <TableHead className="text-right">السعر الافتراضي</TableHead>
                    <TableHead className="text-right">المعادلة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Ruler className="h-4 w-4" />
                          {(() => {
                            const mc = item.measurement_config_id ? measurementConfigs?.find(c => c.id === item.measurement_config_id) : null;
                            return mc ? `${mc.name} (${mc.unit_symbol})` : "غير محدد";
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.default_unit_price.toLocaleString()} د.ل</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs" dir="ltr">
                        {item.formula || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من حذف البند "{item.name}"؟</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(item.id)}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد بنود عامة</p>
              <p className="text-sm">اضغط على "إضافة بند عام" لبدء إضافة البنود</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "تعديل البند العام" : "إضافة بند عام جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم البند *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: عمود خرسانة"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">التصنيف</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat as string}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف مختصر للبند"
              />
            </div>

            {/* Measurement Config Selection */}
            <div className="space-y-2">
              <Label>نوع القياس</Label>
              <Select
                value={formData.measurement_config_id || ""}
                onValueChange={(value) => {
                  const config = measurementConfigs?.find(c => c.id === value);
                  setFormData({ 
                    ...formData, 
                    measurement_config_id: value,
                    component_values: {},
                    formula: config?.formula || formData.formula,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع القياس" />
                </SelectTrigger>
                <SelectContent>
                  {measurementConfigs?.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        {config.name} ({config.unit_symbol})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Component Values Input - Show when measurement config is selected */}
            {selectedMeasurementConfig && selectedMeasurementConfig.components.length > 0 && (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    معاينة مكونات القياس - {selectedMeasurementConfig.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {selectedMeasurementConfig.components.map((comp) => (
                      <div key={comp.symbol} className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          {comp.label}
                          <Badge variant="outline" className="text-xs font-mono">{comp.symbol}</Badge>
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.component_values[comp.symbol] || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            component_values: {
                              ...formData.component_values,
                              [comp.symbol]: e.target.value,
                            }
                          })}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* Show formula and calculated quantity */}
                  {selectedMeasurementConfig.formula && (
                    <div className="p-2 bg-muted/50 rounded-lg space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>المعادلة:</span>
                        <code className="bg-background px-2 py-0.5 rounded" dir="ltr">
                          {selectedMeasurementConfig.formula}
                        </code>
                      </div>
                      {calculatedQuantity !== null && (
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>الكمية المحسوبة:</span>
                          <Badge variant="secondary" className="font-mono">
                            {calculatedQuantity.toFixed(4).replace(/\.?0+$/, '')} {selectedMeasurementConfig.unit_symbol}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_unit_price">السعر الافتراضي للوحدة (د.ل)</Label>
                <Input
                  id="default_unit_price"
                  type="number"
                  step="0.01"
                  value={formData.default_unit_price}
                  onChange={(e) => setFormData({ ...formData, default_unit_price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="measurement_factor">معامل القياس</Label>
                <Input
                  id="measurement_factor"
                  type="number"
                  step="0.01"
                  value={formData.measurement_factor}
                  onChange={(e) => setFormData({ ...formData, measurement_factor: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            {/* Calculated Total Preview for measurement config */}
            {formData.default_unit_price && calculatedQuantity !== null && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">الإجمالي المتوقع (للمعاينة)</p>
                <p className="text-xl font-bold">
                  {(calculatedQuantity * (parseFloat(formData.default_unit_price) || 0)).toLocaleString()} د.ل
                </p>
              </div>
            )}

            {/* Formula Section */}
            <div className="space-y-2">
              <Label htmlFor="formula" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                معادلة الحساب (اختياري)
              </Label>
              <Input
                id="formula"
                value={formData.formula}
                onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                placeholder={selectedMeasurementConfig?.components.length 
                  ? `مثال: ${selectedMeasurementConfig.components.map(c => c.symbol).join(' * ')} * السعر`
                  : "مثال: السعر * الطول * العرض"
                }
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {selectedMeasurementConfig?.components.length ? (
                  <>
                    الرموز المتاحة من نوع القياس: {selectedMeasurementConfig.components.map(c => (
                      <Badge key={c.symbol} variant="outline" className="mx-1 font-mono text-xs">{c.symbol}</Badge>
                    ))}
                    <span className="mx-1">+ السعر</span>
                  </>
                ) : (
                  "المتغيرات المتاحة: السعر، الكمية، الطول، العرض، الارتفاع (أو بالإنجليزية: price, qty, length, width, height)"
                )}
              </p>
              
              {/* Formula Example - Shows automatically with value 10 */}
              {formulaExample && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Calculator className="h-4 w-4" />
                    مثال على المعادلة (بقيمة 10 لكل متغير)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(formulaExample.values).map(([key, value], index) => (
                        <span key={key}>
                          {index > 0 && <span className="mx-1">•</span>}
                          <Badge variant="outline" className="font-mono text-xs">{key}</Badge> = {value}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-primary/20">
                    <span className="text-sm">النتيجة:</span>
                    <Badge variant="default" className="font-mono text-base">
                      {formulaExample.result.toLocaleString()} د.ل
                    </Badge>
                  </div>
                </div>
              )}
            </div>

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
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جاري الحفظ..." : editingItem ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GeneralItems;
