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
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Pencil, Trash2, Ruler, Square, Box, Package,
  Calculator, Settings, Search, X, ChevronDown, ChevronUp,
  Layers, Tag, Hash, FileText, Users
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ContractClauseTemplates from "./ContractClauseTemplates";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ─── Types ──────────────────────────────────────────────────── */
type MeasurementType = "linear" | "square" | "cubic";

interface GeneralItem {
  id: string;
  name: string;
  description: string | null;
  measurement_type: MeasurementType;
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

/* ─── Constants ──────────────────────────────────────────────── */
const measurementLabels: Record<MeasurementType, string> = {
  linear: "متر طولي",
  square: "متر مربع",
  cubic: "متر مكعب",
};

const measurementIcons: Record<MeasurementType, React.ReactNode> = {
  linear: <Ruler className="h-3.5 w-3.5" />,
  square: <Square className="h-3.5 w-3.5" />,
  cubic:  <Box  className="h-3.5 w-3.5" />,
};

const measurementColors: Record<MeasurementType, string> = {
  linear: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  square: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  cubic:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const defaultCategories = [
  "أعمدة", "جدران", "أسقف", "أرضيات", "أساسات",
  "سلالم", "أعمال تشطيب", "أعمال كهربائية", "أعمال صحية", "أخرى",
];

const emptyForm = {
  name: "",
  description: "",
  measurement_type: "linear" as MeasurementType,
  default_unit_price: "",
  category: "",
  formula: "",
  notes: "",
  measurement_config_id: "",
  component_values: {} as Record<string, string>,
  measurement_factor: "1",
};

/* ─── Component ──────────────────────────────────────────────── */
const GeneralItems = () => {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GeneralItem | null>(null);
  const [editingItem, setEditingItem]   = useState<GeneralItem | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [formData, setFormData]         = useState(emptyForm);

  /* ── Data ──────────────────────────────────────────────────── */
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["general-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_project_items")
        .select(`
          *,
          general_item_technician_requirements (
            id,
            technician_type_id,
            required_count,
            notes,
            technician_types (id, name, code)
          )
        `)
        .order("category", { ascending: true })
        .order("name",     { ascending: true });
      if (error) throw error;
      return (data as unknown) as (GeneralItem & { general_item_technician_requirements?: any[] })[];
    },
  });

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

  const [techRequirements, setTechRequirements] = useState<Array<{
    id?: string;
    technician_type_id: string;
    required_count: number;
    notes?: string;
  }>>([]);

  const { data: measurementConfigs = [] } = useQuery({
    queryKey: ["measurement-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_configs")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name",       { ascending: true });
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        components: (item.components || []) as unknown as MeasurementComponent[],
      })) as MeasurementConfig[];
    },
  });

  /* ── Derived ───────────────────────────────────────────────── */
  const existingCategories = [...new Set(items.map((i) => i.category).filter(Boolean) as string[])];
  const allCategories      = [...new Set([...defaultCategories, ...existingCategories])];

  const selectedMeasurementConfig = useMemo(() => {
    if (!formData.measurement_config_id) return null;
    return measurementConfigs.find((c) => c.id === formData.measurement_config_id) || null;
  }, [formData.measurement_config_id, measurementConfigs]);

  const calculatedQuantity = useMemo(() => {
    if (!selectedMeasurementConfig?.formula) return null;
    try {
      let formula = selectedMeasurementConfig.formula;
      const factor = parseFloat(formData.measurement_factor) || 1;
      let hasAll = true;
      selectedMeasurementConfig.components.forEach((comp) => {
        const val = parseFloat(formData.component_values[comp.symbol]);
        if (isNaN(val) || val === 0) hasAll = false;
        formula = formula.replace(new RegExp(comp.symbol, "g"), (val || 0).toString());
      });
      if (!hasAll) return null;
      const result = safeEvaluate(formula);
      return result === null ? null : result * factor;
    } catch { return null; }
  }, [selectedMeasurementConfig, formData.component_values, formData.measurement_factor]);

  const formulaExample = useMemo(() => {
    if (!formData.formula) return null;
    try {
      const ex    = 10;
      const price = parseFloat(formData.default_unit_price) || ex;
      let formula = formData.formula;
      const vals: Record<string, number> = {};
      if (selectedMeasurementConfig?.components.length) {
        selectedMeasurementConfig.components.forEach((c) => {
          formula = formula.replace(new RegExp(c.symbol, "g"), ex.toString());
          vals[c.symbol] = ex;
        });
      }
      formula = formula
        .replace(/السعر|price/gi, price.toString())
        .replace(/الكمية|qty/gi, ex.toString())
        .replace(/الطول|length/gi, ex.toString())
        .replace(/العرض|width/gi, ex.toString())
        .replace(/الارتفاع|height/gi, ex.toString());
      vals["السعر"] = price;
      const result = safeEvaluate(formula);
      if (result === null) return null;
      return { result, vals };
    } catch { return null; }
  }, [formData.formula, formData.default_unit_price, selectedMeasurementConfig]);

  const filteredItems = useMemo(() =>
    items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q);
      const matchCat = categoryFilter === "all" || item.category === categoryFilter;
      return matchSearch && matchCat;
    }), [items, searchQuery, categoryFilter]);

  const groupedItems = useMemo(() =>
    filteredItems.reduce((acc, item) => {
      const cat = item.category || "بدون تصنيف";
      (acc[cat] = acc[cat] || []).push(item);
      return acc;
    }, {} as Record<string, GeneralItem[]>),
  [filteredItems]);

  /* ── Stats ─────────────────────────────────────────────────── */
  const categoriesCount = Object.keys(groupedItems).length;

  /* ── Mutations ─────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let measurementType: MeasurementType = "linear";
      if (selectedMeasurementConfig) {
        const sym = selectedMeasurementConfig.unit_symbol.toLowerCase();
        if (sym.includes("³") || sym.includes("مكعب")) measurementType = "cubic";
        else if (sym.includes("²") || sym.includes("مربع")) measurementType = "square";
      }
      const payload = {
        name:               data.name,
        description:        data.description || null,
        measurement_type:   measurementType,
        default_unit_price: parseFloat(data.default_unit_price) || 0,
        category:           data.category || null,
        formula:            data.formula || null,
        notes:              data.notes || null,
        measurement_config_id: data.measurement_config_id || null,
      };
      let generalItemId = editingItem?.id;

      if (editingItem) {
        const { error } = await supabase.from("general_project_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("general_project_items").insert(payload).select("id").single();
        if (error) throw error;
        generalItemId = inserted.id;
      }

      // Persist technician requirements template
      if (generalItemId) {
        // Delete previous requirements for this general item
        await (supabase
          .from("general_item_technician_requirements" as any)
          .delete() as any)
          .eq("general_item_id", generalItemId);

        // Insert valid requirements
        const validReqs = techRequirements.filter(r => r.technician_type_id && r.required_count > 0);
        if (validReqs.length > 0) {
          const { error: reqErr } = await (supabase
            .from("general_item_technician_requirements" as any)
            .insert(validReqs.map(r => ({
              general_item_id: generalItemId,
              technician_type_id: r.technician_type_id,
              required_count: Number(r.required_count),
              notes: r.notes || null,
            }))) as any);
          if (reqErr) throw reqErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-items"] });
      toast({ title: editingItem ? "تم تحديث البند" : "تم إضافة البند", description: editingItem ? "تم تحديث البند العام بنجاح" : "تم إضافة البند العام بنجاح" });
      closeDialog();
    },
    onError: () => toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ البند", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("general_project_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-items"] });
      toast({ title: "تم حذف البند" });
      setDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "خطأ", description: "حدث خطأ أثناء الحذف", variant: "destructive" }),
  });

  /* ── Handlers ──────────────────────────────────────────────── */
  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData(emptyForm);
    setTechRequirements([]);
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setTechRequirements([]);
    setDialogOpen(true);
  };

  const openEdit = (item: GeneralItem & { general_item_technician_requirements?: any[] }) => {
    setEditingItem(item);
    setFormData({
      name:               item.name,
      description:        item.description || "",
      measurement_type:   item.measurement_type,
      default_unit_price: item.default_unit_price.toString(),
      category:           item.category || "",
      formula:            item.formula || "",
      notes:              item.notes || "",
      measurement_config_id: item.measurement_config_id || "",
      component_values:   {},
      measurement_factor: "1",
    });
    setTechRequirements(
      (item.general_item_technician_requirements || []).map(r => ({
        id: r.id,
        technician_type_id: r.technician_type_id,
        required_count: r.required_count,
        notes: r.notes || "",
      }))
    );
    setDialogOpen(true);
  };

  const confirmDelete = (item: GeneralItem) => {
    setDeleteTarget(item);
    setDeleteOpen(true);
  };

  const toggleGroup = (cat: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم البند", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  /* ── Loading ───────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">جارٍ تحميل البنود...</span>
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">إعدادات وقوالب العقود</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              إدارة بنود الأعمال المسعرة وقوالب الشروط والأحكام التلقائية للعقود
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="work-items" className="space-y-6" dir="rtl">
        <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto bg-muted/60 p-1 rounded-xl border border-border/40 shadow-inner">
          <TabsTrigger value="work-items" className="font-bold text-sm">
            بنود الأعمال والأسعار (التسعير)
          </TabsTrigger>
          <TabsTrigger value="contract-clauses" className="font-bold text-sm">
            شروط وأحكام العقود (القوالب)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work-items" className="space-y-6 outline-none">
          {/* Work items toolbar with buttons */}
          <div className="flex justify-between items-center gap-4 flex-wrap bg-card border border-border/60 p-4 rounded-2xl shadow-sm">
            <span className="text-sm font-semibold text-muted-foreground">قائمة البنود والأسعار الافتراضية</span>
            <div className="flex items-center gap-2">
              <Link to="/measurement-types">
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                  <Settings className="h-3.5 w-3.5" />
                  أنواع القياس
                </Button>
              </Link>
              <Button onClick={openNew} size="sm" className="gap-1.5 cursor-pointer">
                <Plus className="h-3.5 w-3.5" />
                إضافة بند عام
              </Button>
            </div>
          </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Hash,   label: "إجمالي البنود",  value: items.length,      color: "bg-primary/10 text-primary" },
          { icon: Tag,    label: "التصنيفات",       value: categoriesCount,   color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
          { icon: Ruler,  label: "طولية",           value: items.filter(i => i.measurement_type === "linear").length, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
          { icon: Square, label: "مساحية/حجمية",   value: items.filter(i => i.measurement_type !== "linear").length, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="p-4 border-border/60">
            <div className="flex items-center gap-2.5">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Search + Filter ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="البحث في البنود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter} dir="rtl">
          <SelectTrigger className="w-full sm:w-52">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="جميع التصنيفات" />
            </div>
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="all">جميع التصنيفات</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
                <span className="mr-auto text-xs text-muted-foreground">
                  ({items.filter((i) => i.category === cat).length})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {(searchQuery || categoryFilter !== "all") && (
        <p className="text-xs text-muted-foreground -mt-2">
          عرض <span className="font-semibold text-foreground">{filteredItems.length}</span> بند
          {filteredItems.length !== items.length && ` من أصل ${items.length}`}
        </p>
      )}

      {/* ── Groups ───────────────────────────────────────────── */}
      {Object.keys(groupedItems).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(groupedItems).map(([category, catItems]) => {
            const collapsed = collapsedGroups.has(category);
            return (
              <Card key={category} className="overflow-hidden border-border/70">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(category)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer border-b border-border/50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-semibold text-foreground">{category}</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {catItems.length}
                    </span>
                  </div>
                  {collapsed
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronUp   className="h-4 w-4 text-muted-foreground" />
                  }
                </button>

                {/* Group rows */}
                {!collapsed && (
                  <div className="divide-y divide-border/40">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors group"
                      >
                        {/* Icon */}
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${measurementColors[item.measurement_type]}`}>
                          {measurementIcons[item.measurement_type]}
                        </div>

                        {/* Name + description */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                          )}
                        </div>

                        {/* Measurement badge */}
                        <div className="hidden sm:flex shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${measurementColors[item.measurement_type]}`}>
                            {measurementIcons[item.measurement_type]}
                            {measurementLabels[item.measurement_type]}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="hidden md:block shrink-0 text-left" dir="ltr">
                          <p className="text-sm font-semibold text-foreground">
                            {item.default_unit_price.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">د.ل</p>
                        </div>

                        {/* Formula indicator */}
                        {item.formula && (
                          <div className="hidden lg:flex shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <Calculator className="h-2.5 w-2.5" />
                              معادلة
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(item)}
                            title="تعديل"
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(item)}
                            title="حذف"
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <Card className="p-16 text-center border-dashed">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {searchQuery || categoryFilter !== "all" ? "لا توجد نتائج" : "لا توجد بنود بعد"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? `لم يُعثر على بنود تطابق "${searchQuery}"`
              : categoryFilter !== "all"
              ? "لا توجد بنود في هذا التصنيف"
              : "أضف أول بند عام لاستخدامه في المشاريع"}
          </p>
          {!searchQuery && categoryFilter === "all" ? (
            <Button onClick={openNew} className="gap-2 cursor-pointer">
              <Plus className="h-4 w-4" />
              إضافة بند عام
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); }} className="gap-2 cursor-pointer">
              مسح الفلاتر
            </Button>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════
          Add / Edit Dialog
      ══════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="text-right">
                <DialogTitle>{editingItem ? "تعديل البند العام" : "إضافة بند عام جديد"}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {editingItem ? "عدّل بيانات البند العام" : "أضف بندًا جديدًا للاستخدام في المشاريع"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                اسم البند <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: عمود خرسانة مسلحة"
                className="text-right"
              />
            </div>

            {/* Category + Measurement config row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">التصنيف</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                  dir="rtl"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر تصنيفًا" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">نوع القياس</Label>
                <Select
                  value={formData.measurement_config_id || "none"}
                  onValueChange={(v) => {
                    const config = measurementConfigs.find((c) => c.id === v);
                    setFormData({
                      ...formData,
                      measurement_config_id: v === "none" ? "" : v,
                      component_values: {},
                      formula: config?.formula || formData.formula,
                    });
                  }}
                  dir="rtl"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع القياس" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="none">بدون نوع مخصص</SelectItem>
                    {measurementConfigs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.unit_symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">الوصف</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف مختصر للبند (اختياري)"
                className="text-right"
              />
            </div>

            {/* Component values (when config selected) */}
            {selectedMeasurementConfig && selectedMeasurementConfig.components.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Calculator className="h-4 w-4" />
                  مكونات القياس — {selectedMeasurementConfig.name}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {selectedMeasurementConfig.components.map((comp) => (
                    <div key={comp.symbol} className="space-y-1">
                      <Label className="text-xs flex items-center gap-1.5">
                        {comp.label}
                        <Badge variant="outline" className="text-[10px] px-1.5">{comp.symbol}</Badge>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.component_values[comp.symbol] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            component_values: { ...formData.component_values, [comp.symbol]: e.target.value },
                          })
                        }
                        placeholder="0"
                        className="text-left h-8 text-sm"
                        dir="ltr"
                      />
                    </div>
                  ))}
                </div>

                {/* Factor */}
                <div className="space-y-1">
                  <Label className="text-xs">معامل القياس</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.measurement_factor}
                    onChange={(e) => setFormData({ ...formData, measurement_factor: e.target.value })}
                    className="text-left h-8 text-sm"
                    dir="ltr"
                  />
                </div>

                {/* Formula display */}
                {selectedMeasurementConfig.formula && (
                  <div className="rounded-lg bg-background p-3 border border-border/50 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>المعادلة:</span>
                      <code className="bg-muted px-2 py-0.5 rounded text-xs" dir="ltr">
                        {selectedMeasurementConfig.formula}
                      </code>
                    </div>
                    {calculatedQuantity !== null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">الكمية المحسوبة:</span>
                        <span className="font-bold text-primary">
                          {calculatedQuantity.toFixed(4).replace(/\.?0+$/, "")} {selectedMeasurementConfig.unit_symbol}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">السعر الافتراضي للوحدة (د.ل)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.default_unit_price}
                onChange={(e) => setFormData({ ...formData, default_unit_price: e.target.value })}
                placeholder="0"
                className="text-left"
                dir="ltr"
              />
            </div>

            {/* Total preview */}
            {formData.default_unit_price && calculatedQuantity !== null && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700 dark:text-emerald-400">الإجمالي التقديري:</span>
                <span className="font-bold text-lg text-emerald-700 dark:text-emerald-300" dir="ltr">
                  {(calculatedQuantity * (parseFloat(formData.default_unit_price) || 0)).toLocaleString()} د.ل
                </span>
              </div>
            )}

            {/* Formula */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                معادلة الحساب
                <span className="text-xs text-muted-foreground font-normal">(اختياري)</span>
              </Label>
              <Input
                value={formData.formula}
                onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                placeholder={
                  selectedMeasurementConfig?.components.length
                    ? `مثال: ${selectedMeasurementConfig.components.map((c) => c.symbol).join(" * ")} * السعر`
                    : "مثال: السعر * الطول * العرض"
                }
                className="text-sm"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {selectedMeasurementConfig?.components.length ? (
                  <>
                    الرموز المتاحة:{" "}
                    {selectedMeasurementConfig.components.map((c) => (
                      <Badge key={c.symbol} variant="outline" className="mx-0.5 text-[10px]">{c.symbol}</Badge>
                    ))}
                    <span className="mx-1">+ السعر</span>
                  </>
                ) : (
                  "المتغيرات: السعر، الكمية، الطول، العرض، الارتفاع"
                )}
              </p>

              {formulaExample && (
                <div className="rounded-lg bg-primary/8 border border-primary/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <Calculator className="h-3.5 w-3.5" />
                    مثال على المعادلة (بقيمة 10 لكل متغير)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(formulaExample.vals).map(([key, val]) => (
                      <span key={key} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">{key}</Badge>
                        = {val}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-primary/15">
                    <span className="text-sm text-muted-foreground">النتيجة:</span>
                    <span className="font-bold text-primary">
                      {formulaExample.result.toLocaleString()} د.ل
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={3}
                className="resize-none text-right"
              />
            </div>

            {/* Technician Requirements Template */}
            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  احتياج الفنيين النمطي (قالب التعيينات)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTechRequirements(prev => [
                      ...prev,
                      { technician_type_id: technicianTypes[0]?.id || "", required_count: 1, notes: "" }
                    ]);
                  }}
                  className="h-7 text-xs gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة تخصص فني
                </Button>
              </div>

              {techRequirements.length === 0 ? (
                <div className="p-3 border border-dashed rounded-xl text-center text-xs text-muted-foreground bg-muted/10">
                  لا توجد تخصصات فنية محددة كمتطلب لهذا البند النمطي (اختياري).
                </div>
              ) : (
                <div className="space-y-2.5">
                  {techRequirements.map((req, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <Label className="text-[11px] text-muted-foreground">تخصص الفني</Label>
                          <Select
                            value={req.technician_type_id}
                            onValueChange={(val) => {
                              setTechRequirements(prev => prev.map((r, i) => i === idx ? { ...r, technician_type_id: val } : r));
                            }}
                            dir="rtl"
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="اختر التخصص" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              {technicianTypes.map((t: any) => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-[11px] text-muted-foreground">العدد المطلوب</Label>
                          <Input
                            type="number"
                            min="1"
                            value={req.required_count || 1}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setTechRequirements(prev => prev.map((r, i) => i === idx ? { ...r, required_count: val } : r));
                            }}
                            className="h-8 text-xs text-center"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end pt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTechRequirements(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Input
                          placeholder="ملاحظات المتطلب (اختياري)..."
                          value={req.notes || ""}
                          onChange={(e) => {
                            setTechRequirements(prev => prev.map((r, i) => i === idx ? { ...r, notes: e.target.value } : r));
                          }}
                          className="h-7 text-xs text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog} className="cursor-pointer">إلغاء</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="gap-2 cursor-pointer">
              {saveMutation.isPending ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : editingItem ? (
                <><Pencil className="h-4 w-4" /> تحديث</>
              ) : (
                <><Plus className="h-4 w-4" /> إضافة</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          Delete Confirmation Dialog
      ══════════════════════════════════════════════════════════ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-right">
                <DialogTitle>تأكيد الحذف</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  هذا الإجراء لا يمكن التراجع عنه
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg bg-muted/50 border border-border/50 px-4 py-3 my-1">
              <p className="font-medium text-foreground">{deleteTarget.name}</p>
              {deleteTarget.category && (
                <p className="text-xs text-muted-foreground mt-0.5">{deleteTarget.category}</p>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف هذا البند؟ سيتم إزالته نهائيًا ولن يكون متاحًا في المشاريع.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="cursor-pointer">
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="gap-2 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <div className="h-4 w-4 rounded-full border-2 border-destructive-foreground/40 border-t-destructive-foreground animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف البند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="contract-clauses" className="outline-none">
          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
            <ContractClauseTemplates hideHeader />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GeneralItems;
