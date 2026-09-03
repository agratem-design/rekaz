import React from "react";
import { 
  Plus, Pencil, X, Search, Tag, User, Users, Ruler, Layers, Calculator, Info, Coins, TrendingUp, Percent, ChevronDown, CheckCircle2, AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { safeEvaluate } from "@/lib/safeFormula";
import { QuickAddTechnicianDialog } from "@/components/technicians/QuickAddTechnicianDialog";
import { QuickAddMeasurementDialog } from "@/components/project-items/QuickAddMeasurementDialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";

// Local labels and units
const rateTypeLabels: Record<string, string> = {
  meter: "بالمتر",
  piece: "بالقطعة",
  fixed: "مبلغ ثابت",
};

const measurementUnits = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const detectMeasurementType = (config: any): "linear" | "square" | "cubic" => {
  if (!config) return "linear";
  const symbol = config.unit_symbol || "";
  if (symbol.includes("²") || symbol.includes("2") || config.name.includes("مربع")) return "square";
  if (symbol.includes("³") || symbol.includes("3") || config.name.includes("مكعب")) return "cubic";
  return "linear";
};

interface InvoiceItemFormProps {
  projectId: string;
  editingItem: any;
  setEditingItem: (item: any) => void;
  inlineItem: any;
  setInlineItem: React.Dispatch<React.SetStateAction<any>>;
  calculationMethod: "manual" | "config";
  setCalculationMethod: (method: "manual" | "config") => void;
  inlineSearch: string;
  setInlineSearch: (search: string) => void;
  inlineDropdownOpen: boolean;
  setInlineDropdownOpen: (open: boolean) => void;
  editingItemTechnicians: any[];
  setEditingItemTechnicians: React.Dispatch<React.SetStateAction<any[]>>;
  generalItems?: any[];
  engineers?: any[];
  technicians?: any[];
  measurementConfigs?: any[];
  saveMutation: any;
  formRef: React.RefObject<HTMLDivElement | null>;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  handleCancelEdit: () => void;
  inlineDropdownRef: React.RefObject<HTMLDivElement | null>;
}

export const InvoiceItemForm: React.FC<InvoiceItemFormProps> = ({
  projectId,
  editingItem,
  setEditingItem,
  inlineItem,
  setInlineItem,
  calculationMethod,
  setCalculationMethod,
  inlineSearch,
  setInlineSearch,
  inlineDropdownOpen,
  setInlineDropdownOpen,
  editingItemTechnicians,
  setEditingItemTechnicians,
  generalItems,
  engineers,
  technicians,
  measurementConfigs,
  saveMutation,
  formRef,
  nameInputRef,
  handleCancelEdit,
  inlineDropdownRef,
}) => {
  const queryClient = useQueryClient();
  const [addTechnicianOpen, setAddTechnicianOpen] = React.useState(false);
  const [addUnitOpen, setAddUnitOpen] = React.useState(false);
  const guard = useUnsavedChangesGuard({ isDirty: Boolean(inlineItem.name || inlineItem.description || inlineItem.quantity || inlineItem.unit_price || inlineItem.technician_id), isSubmitting: saveMutation.isPending });

  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [contractItems, setContractItems] = React.useState<{ name: string; unit_price: number }[]>([]);
  const [contractLoading, setContractLoading] = React.useState(false);

  React.useEffect(() => {
    if (!projectId) return;
    const fetchContractItems = async () => {
      setContractLoading(true);
      try {
        const { data: contractsData, error: contractsError } = await supabase
          .from("contracts")
          .select("id")
          .eq("project_id", projectId)
          .eq("status", "active");

        if (contractsError) throw contractsError;

        if (contractsData && contractsData.length > 0) {
          const contractIds = contractsData.map(c => c.id);
          const { data: itemsData, error: itemsError } = await supabase
            .from("contract_items")
            .select("name, unit_price")
            .in("contract_id", contractIds);

          if (itemsError) throw itemsError;
          setContractItems((itemsData || []).map(it => ({
            name: it.name,
            unit_price: Number(it.unit_price || 0)
          })));
        } else {
          setContractItems([]);
        }
      } catch (err) {
        console.error("Failed to fetch contract items:", err);
      } finally {
        setContractLoading(false);
      }
    };
    fetchContractItems();
  }, [projectId]);

  // Auto-fill price if name matches
  React.useEffect(() => {
    if (!inlineItem.name || contractItems.length === 0) return;
    const match = contractItems.find(it => it.name.trim().toLowerCase() === inlineItem.name.trim().toLowerCase());
    if (match) {
      const currentPrice = parseFloat(inlineItem.unit_price) || 0;
      if (currentPrice === 0) {
        setInlineItem(prev => ({ ...prev, unit_price: match.unit_price.toString() }));
      }
    }
  }, [inlineItem.name, contractItems]);
  const [showFormulaEditor, setShowFormulaEditor] = React.useState(false);
  const [showTechAssignment, setShowTechAssignment] = React.useState(false);

  // Automatically show sections if they already contain data
  React.useEffect(() => {
    if (inlineItem.engineer_id || inlineItem.description) {
      setShowAdvanced(true);
    }
  }, [inlineItem.engineer_id, inlineItem.description]);

  React.useEffect(() => {
    if (inlineItem.technician_id || (editingItem && editingItemTechnicians.length > 0)) {
      setShowTechAssignment(true);
    }
  }, [inlineItem.technician_id, editingItem, editingItemTechnicians]);

  // Calculate final quantities
  const qty = calculationMethod === "config" 
    ? (parseFloat(inlineItem.quantity) || 0) 
    : (parseFloat(inlineItem.quantity) || 0) * (parseFloat(inlineItem.item_count) || 1);
  const price = parseFloat(inlineItem.unit_price) || 0;
  const saleTotal = qty * price;
  
  // Technician Cost
  let inlineTechCost = 0;
  if (inlineItem.technician_id) {
    const techRate = parseFloat(inlineItem.technician_rate) || 0;
    const techRateType = inlineItem.technician_rate_type;
    if (techRateType === "fixed") {
      inlineTechCost = techRate;
    } else if (techRateType === "piece") {
      const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
      inlineTechCost = techRate * pieceQty;
    } else {
      inlineTechCost = techRate * qty;
    }
  }
  
  const existingTechsCost = editingItem 
    ? editingItemTechnicians.reduce((sum, t) => sum + (parseFloat(t.total_cost) || 0), 0)
    : 0;
  
  const totalCost = inlineTechCost + existingTechsCost;
  const netProfit = saleTotal - totalCost;
  const profitMargin = saleTotal > 0 ? (netProfit / saleTotal) * 100 : 0;

  return (
    <div 
      ref={formRef}
      className={`border-2 ${
        editingItem 
          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-[0_0_20px_rgba(214,172,64,0.2)]' 
          : 'border-border/80 bg-card/75 backdrop-blur-md shadow-lg'
      } rounded-2xl p-6 transition-all duration-300 mt-6`}
      dir="rtl"
    >
      <fieldset disabled={saveMutation.isPending} className="min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${editingItem ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'} transition-colors`}>
            {editingItem ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">
              {editingItem ? `تعديل البند: ${editingItem.name}` : "إدخال بند جديد للمقاولات"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {editingItem ? "قم بتعديل مواصفات وأبعاد البند ثم انقر على تحديث البند" : "أدخل بيانات البند يدويًا أو ابحث في قائمة البنود العامة للاستيراد السريع"}
            </p>
          </div>
        </div>
        {editingItem && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => guard.requestAction(handleCancelEdit)}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors border-dashed text-xs cursor-pointer rounded-lg"
          >
            <X className="h-4 w-4 ml-1" />
            إلغاء التعديل
          </Button>
        )}
      </div>

      {/* Grid Layout: Column 1 (2/3) and Column 2 (1/3) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setAddUnitOpen(true)} className="gap-2"><Ruler className="h-4 w-4" />إضافة وحدة قياس</Button>
        <Button type="button" variant="outline" onClick={() => setAddTechnicianOpen(true)} className="gap-2"><Users className="h-4 w-4" />إضافة فني واختياره</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Basic Info & Quantity calculations (ColSpan 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Block 1: Basic Information */}
          <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 space-y-4 relative">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <Tag className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-primary">
                البيانات الأساسية للبند
              </h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Name with Autocomplete */}
              <div className="relative" ref={inlineDropdownRef}>
                <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">اسم البند <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    ref={nameInputRef}
                    value={inlineSearch || inlineItem.name}
                    onChange={(e) => {
                      setInlineSearch(e.target.value);
                      setInlineItem(prev => ({ ...prev, name: e.target.value, generalItemId: "" }));
                      setInlineDropdownOpen(true);
                    }}
                    onFocus={(e) => {
                      setInlineSearch("");
                      setInlineDropdownOpen(true);
                      e.target.select();
                    }}
                    onClick={(e) => {
                      setInlineSearch("");
                      setInlineDropdownOpen(true);
                      (e.target as HTMLInputElement).select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setInlineDropdownOpen(false);
                      }
                    }}
                    placeholder="مثال: حفر القواعد، صب خرسانة، بناء طوب..."
                    className="h-12 pr-10 text-base border-border/80 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200"
                  />
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                {/* Styled Autocomplete Dropdown */}
                {inlineDropdownOpen && (
                  <div className="absolute z-[9999] top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-md text-popover-foreground border border-primary/20 rounded-xl shadow-2xl max-h-[320px] overflow-y-auto divide-y divide-border/40 animate-in fade-in slide-in-from-top-2 duration-200">
                    {(() => {
                      const filteredItems = generalItems
                        ?.filter(gi => 
                          !inlineSearch ||
                          gi.name.toLowerCase().includes(inlineSearch.toLowerCase()) ||
                          (gi.category && gi.category.toLowerCase().includes(inlineSearch.toLowerCase()))
                        )
                        .slice(0, 50);

                      if (!filteredItems || filteredItems.length === 0) {
                        if (inlineSearch) {
                          return (
                            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                              <Info className="h-4 w-4 text-primary animate-pulse" />
                              <span>سيتم إنشاء بند مخصص باسم: "{inlineSearch}"</span>
                            </div>
                          );
                        }
                        return (
                          <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <span>لا توجد بنود عامة متوفرة حالياً.</span>
                          </div>
                        );
                      }

                      return filteredItems.map((gi) => {
                        const mc = gi.measurement_config_id ? measurementConfigs?.find(c => c.id === gi.measurement_config_id) : null;
                        const unitSymbol = mc ? mc.unit_symbol : measurementUnits[gi.measurement_type as "linear" | "square" | "cubic"];
                        return (
                          <button
                            key={gi.id}
                            type="button"
                            className="w-full text-right px-4 py-3 hover:bg-primary/5 hover:text-primary flex items-center justify-between gap-3 text-sm transition-all duration-150 cursor-pointer border-none bg-transparent active:bg-primary/10"
                            onClick={() => {
                              setInlineItem(prev => ({
                                ...prev,
                                generalItemId: gi.id,
                                name: gi.name,
                                measurement_type: gi.measurement_type,
                                quantity: "",
                                unit_price: gi.default_unit_price.toString(),
                                measurement_config_id: gi.measurement_config_id || "",
                                component_values: {},
                                measurement_factor: (gi as any).measurement_factor?.toString() || "1",
                              }));
                              setCalculationMethod(gi.measurement_config_id ? "config" : "manual");
                              setInlineSearch("");
                              setInlineDropdownOpen(false);
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">{gi.name}</p>
                              {gi.description && (
                                <p className="text-xs text-muted-foreground truncate">{gi.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(gi as any).measurement_factor !== undefined && (gi as any).measurement_factor !== null && Number((gi as any).measurement_factor) !== 1 && (
                                <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-500 bg-orange-500/5 font-semibold rounded-md">
                                  معامل: {(gi as any).measurement_factor}
                                </Badge>
                              )}
                              {gi.category && (
                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground font-medium rounded-md">
                                  {gi.category}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs border-primary/30 text-primary font-bold bg-primary/5 rounded-md">
                                {unitSymbol} · {gi.default_unit_price.toLocaleString()} د.ل
                              </Badge>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Unit Price */}
              <div>
                <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">سعر الوحدة للزبون (د.ل) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={inlineItem.unit_price}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, unit_price: e.target.value }))}
                    placeholder="0.00"
                    className="h-12 pl-16 text-base font-semibold border-border/80 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200"
                  />
                  <span className="absolute left-2 top-2 bottom-2 px-3 bg-muted border border-border/60 text-xs font-bold text-muted-foreground flex items-center justify-center rounded-lg select-none">
                    د.ل
                  </span>
                </div>
              </div>
            </div>

            {/* Contract Matching Alerts */}
            {inlineItem.name && contractItems.length > 0 && (
              <div className="space-y-2">
                {(() => {
                  const match = contractItems.find(it => it.name.trim().toLowerCase() === inlineItem.name.trim().toLowerCase());
                  if (match) {
                    const priceDiff = Math.abs((parseFloat(inlineItem.unit_price) || 0) - match.unit_price) > 0.01;
                    if (priceDiff) {
                      return (
                        <div className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                          <Info className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
                          <span>
                            تنبيه: السعر المدخل يختلف عن السعر المتفق عليه في العقد (السعر المتفق عليه: <strong>{match.unit_price.toLocaleString()} د.ل</strong>)
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                        <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                        <span>
                          بند مطابق للعقد: السعر المعتمد في العقد هو <strong>{match.unit_price.toLocaleString()} د.ل</strong>
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                        <Info className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-500" />
                        <span>
                          تنبيه: هذا البند غير متوفر في بنود العقد المتفق عليه للمشروع.
                        </span>
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {/* Toggle button for custom description and engineer */}
            <div className="flex justify-start pt-1">
              <button
                type="button"
                className="text-xs text-primary font-bold hover:bg-primary/10 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer bg-transparent border border-dashed border-primary/20 transition-all"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? "إخفاء الخيارات الإضافية" : "خيارات إضافية (الوصف، المهندس)..."}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
              </button>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/40 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Custom Description */}
                <div>
                  <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">تسمية / وصف البند المخصص</Label>
                  <Input
                    value={inlineItem.description}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="أدخل أي ملاحظات أو مواصفات خاصة بالبند..."
                    className="h-12 border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                  />
                </div>

                {/* Engineer Select */}
                <div>
                  <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">المهندس المشرف</Label>
                  <Select
                    dir="rtl"
                    value={inlineItem.engineer_id || "none"}
                    onValueChange={(value) => setInlineItem(prev => ({ ...prev, engineer_id: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger className="h-12 border-border/80 focus:ring-primary focus:border-primary rounded-xl">
                      <SelectValue placeholder="اختر المهندس المسؤول عن الاستلام" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="none">بدون مهندس (استلام مباشر)</SelectItem>
                      {engineers?.map((eng) => (
                        <SelectItem key={eng.id} value={eng.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-primary" />
                            <span className="font-semibold">{eng.name}</span>
                            <span className="text-xs text-muted-foreground">({eng.engineer_type})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Block 2: Quantity Calculation Section */}
          <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 pb-2 border-b border-primary/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/15 rounded-lg text-primary">
                  <Calculator className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-primary">
                  طريقة احتساب كمية البند
                </h4>
              </div>
              
              {/* Mode Toggle Tabs */}
              <div className="flex border border-border/80 rounded-xl overflow-hidden p-1 bg-background text-xs font-bold shrink-0 shadow-inner">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border-none ${
                    calculationMethod === "manual" 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setCalculationMethod("manual");
                    setInlineItem(prev => ({ ...prev, measurement_config_id: "" }));
                  }}
                >
                  <Ruler className="h-4 w-4" />
                  كمية مباشرة
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer border-none ${
                    calculationMethod === "config" 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setCalculationMethod("config");
                    if (!inlineItem.measurement_config_id && measurementConfigs && measurementConfigs.length > 0) {
                      setInlineItem(prev => ({ ...prev, measurement_config_id: measurementConfigs[0].id }));
                    }
                  }}
                >
                  <Layers className="h-4 w-4" />
                  حساب تفصيلي بالأبعاد
                </button>
              </div>
            </div>

            {calculationMethod === "manual" ? (
              /* Manual quantity entry */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">الكمية للقطعة / البند</Label>
                  <Input
                    type="number"
                    value={inlineItem.quantity}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="مثال: 5، 12.5"
                    className="h-12 text-base font-semibold border-border/80 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">عدد العناصر (مضاعف التكرار)</Label>
                  <Input
                    type="number"
                    value={inlineItem.item_count}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, item_count: e.target.value }))}
                    placeholder="1"
                    className="h-12 text-base border-border/80 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-muted-foreground mb-1.5 block">الكمية الإجمالية النهائية</Label>
                  <div className="h-12 bg-muted/65 border border-border/80 rounded-xl flex items-center justify-between px-4 text-base font-bold text-foreground shadow-sm">
                    <span>
                      {((parseFloat(inlineItem.quantity) || 0) * (parseFloat(inlineItem.item_count) || 1)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                    <span className="text-xs text-muted-foreground font-bold">وحدة</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Config-based dimension calculations */
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Config Selector */}
                  <div>
                    <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">نوع القياس / المعادلة</Label>
                    <Select
                      dir="rtl"
                      value={inlineItem.measurement_config_id}
                      onValueChange={(val) => {
                        const mc = measurementConfigs?.find(c => c.id === val);
                        setInlineItem(prev => ({
                          ...prev,
                          measurement_config_id: val,
                          measurement_type: detectMeasurementType(mc || null),
                          formula: mc?.formula || "",
                          component_values: {},
                        }));
                      }}
                    >
                      <SelectTrigger className="h-12 border-border/80 focus:ring-primary focus:border-primary rounded-xl">
                        <SelectValue placeholder="اختر معادلة القياس" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] select-content-custom">
                        {measurementConfigs?.map((cfg) => (
                          <SelectItem key={cfg.id} value={cfg.id}>
                            {cfg.name} ({cfg.unit_symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dimension Fields Grid */}
                {(() => {
                  const inlineMC = measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id);
                  if (!inlineMC || inlineMC.components.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground py-2 text-center font-medium">لا توجد أبعاد معرفة لهذه المعادلة.</p>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      <div className="bg-background/80 p-5 rounded-2xl border border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-4 shadow-inner">
                        {inlineMC.components.map((comp: any) => (
                          <div key={comp.symbol}>
                            <Label className="text-xs font-bold text-foreground/80 mb-1 block">
                              {comp.label} ({comp.symbol})
                            </Label>
                            <Input
                              type="number"
                              value={inlineItem.component_values[comp.symbol] || ""}
                              onChange={(e) => {
                                const newValues = { ...inlineItem.component_values, [comp.symbol]: e.target.value };
                                setInlineItem(prev => ({ 
                                  ...prev, 
                                  component_values: newValues
                                }));
                              }}
                              placeholder="0.00"
                              className="h-11 text-base font-semibold border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                            />
                          </div>
                        ))}
                        
                        {/* Factor Multiplier */}
                        <div>
                          <Label className="text-xs font-bold text-foreground/80 mb-1 block">معامل الضرب</Label>
                          <Input
                            type="number"
                            value={inlineItem.measurement_factor}
                            onChange={(e) => setInlineItem(prev => ({ ...prev, measurement_factor: e.target.value }))}
                            placeholder="1"
                            className="h-11 text-base border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                          />
                        </div>

                        {/* Count Multiplier */}
                        <div>
                          <Label className="text-xs font-bold text-foreground/80 mb-1 block">عدد العناصر</Label>
                          <Input
                            type="number"
                            value={inlineItem.item_count}
                            onChange={(e) => setInlineItem(prev => ({ ...prev, item_count: e.target.value }))}
                            placeholder="1"
                            className="h-11 text-base border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                          />
                        </div>

                        {/* Result Display */}
                        <div className="col-span-2 sm:col-span-2">
                          <Label className="text-xs font-bold text-primary mb-1 block">
                            الكمية الكلية المحسوبة ({inlineMC.unit_symbol})
                          </Label>
                          <div className="h-11 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between px-4 text-base font-bold text-primary shadow-sm">
                            <span className="animate-pulse-slow">
                              {parseFloat(inlineItem.quantity) ? (parseFloat(inlineItem.quantity)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}
                            </span>
                            <span className="text-xs font-bold text-primary/80">{inlineMC.unit_symbol}</span>
                          </div>
                        </div>
                      </div>

                      {/* Custom Formula Editor Toggle */}
                      <div className="flex justify-start">
                        <button
                          type="button"
                          className="text-xs text-primary font-bold hover:bg-primary/10 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer bg-transparent border border-dashed border-primary/20 transition-all"
                          onClick={() => setShowFormulaEditor(!showFormulaEditor)}
                        >
                          {showFormulaEditor ? "إخفاء تعديل المعادلة" : "تعديل صيغة المعادلة الرياضية..."}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showFormulaEditor ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      {/* Formula Editor Block (Collapsible) */}
                      {showFormulaEditor && (
                        <div className="bg-muted/30 border border-border/60 p-4 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <Label className="text-xs font-bold text-foreground/80 mb-1 block">صيغة المعادلة الحسابية</Label>
                          {(() => {
                            const currentFormula = inlineItem.formula || inlineMC.formula || "";
                            let testFormula = currentFormula;
                            inlineMC.components.forEach((comp: any) => {
                              const val = parseFloat(inlineItem.component_values[comp.symbol]) || 0;
                              testFormula = testFormula.replace(new RegExp(comp.symbol, 'g'), val.toString());
                            });
                            
                            let formulaIsValid = false;
                            let formulaError = "";
                            try {
                              const sanitized = testFormula.trim();
                              if (!sanitized) {
                                formulaError = "صيغة المعادلة فارغة";
                              } else if (/[;{}[\]\\`'"=!<>?&|~^@#$%]/.test(sanitized)) {
                                formulaError = "المعادلة تحتوي على رموز غير صالحة";
                              } else {
                                const evaluated = safeEvaluate(sanitized);
                                if (evaluated === null || isNaN(evaluated) || !isFinite(evaluated)) {
                                  formulaError = "المعادلة غير صالحة حسابياً";
                                } else {
                                  formulaIsValid = true;
                                }
                              }
                            } catch {
                              formulaError = "خطأ في الصيغة الحسابية";
                            }
                            
                            return (
                              <div className="space-y-2">
                                <Input
                                  value={currentFormula}
                                  onChange={(e) => setInlineItem((prev: any) => ({ ...prev, formula: e.target.value }))}
                                  placeholder="مثال: L * W * H"
                                  className="h-12 text-base font-bold dir-ltr text-left border-border/80 focus-visible:ring-primary focus-visible:border-primary"
                                />
                                
                                {/* Symbol/Operator Keyboard */}
                                <div className="flex flex-wrap gap-1 bg-background p-2 rounded-lg border border-border/60 justify-start" dir="ltr">
                                  <span className="text-[10px] text-muted-foreground self-center mr-2 ml-1 font-semibold select-none">الأبعاد:</span>
                                  {inlineMC.components.map((comp: any) => (
                                    <Button
                                      key={comp.symbol}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2.5 text-xs font-bold bg-background text-primary hover:bg-primary/10 border-border/85 cursor-pointer rounded-md"
                                      onClick={() => {
                                        const updated = currentFormula + comp.symbol;
                                        setInlineItem((prev: any) => ({ ...prev, formula: updated }));
                                      }}
                                    >
                                      {comp.symbol}
                                    </Button>
                                  ))}
                                  <span className="text-[10px] text-muted-foreground self-center mx-2 font-semibold select-none">العمليات:</span>
                                  {["+", "-", "*", "/", "(", ")"].map((symbol) => (
                                    <Button
                                      key={symbol}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-xs font-bold bg-background hover:bg-primary/10 border-border/85 cursor-pointer rounded-md"
                                      onClick={() => {
                                        const updated = currentFormula + symbol;
                                        setInlineItem((prev: any) => ({ ...prev, formula: updated }));
                                      }}
                                    >
                                      {symbol}
                                    </Button>
                                  ))}
                                </div>
                                
                                {/* Status and Help */}
                                <div className="flex items-center gap-1.5 text-xs">
                                  {formulaIsValid ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                       <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-600" /> صيغة المعادلة صالحة
                                    </span>
                                  ) : (
                                    <span className="text-destructive font-bold flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5 inline text-destructive" /> {formulaError || "تنبيه: صيغة المعادلة غير صالحة."}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Technician Assignment (ColSpan 1) */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-bold text-primary">
                  تعيينات الفنيين المباشرة
                </h4>
              </div>
              <button
                type="button"
                className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                  showTechAssignment 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-transparent text-muted-foreground border-border/80 hover:text-foreground hover:bg-muted/30"
                }`}
                onClick={() => setShowTechAssignment(!showTechAssignment)}
              >
                {showTechAssignment ? "مفعّل" : "تفعيل التعيين"}
              </button>
            </div>
            
            {showTechAssignment ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Select Technician */}
                <div>
                  <Label className="text-xs font-bold text-foreground/80 mb-1.5 block">
                    {editingItem && editingItemTechnicians.length > 0 ? "تعيين فني إضافي" : "الفني المعين للبند"}
                  </Label>
                  <Select
                    dir="rtl"
                    value={inlineItem.technician_id || "none"}
                    onValueChange={(value) => setInlineItem(prev => ({ 
                      ...prev, 
                      technician_id: value === "none" ? "" : value,
                      technician_rate_type: "unit",
                      technician_rate: "",
                    }))}
                  >
                    <SelectTrigger className="h-12 border-border/80 focus:ring-primary focus:border-primary rounded-xl">
                      <SelectValue placeholder="اختر الفني لتحديد مستحقاته" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="none">بدون فني حالياً (إدخال لاحق)</SelectItem>
                      {technicians?.filter(t => !editingItem || !editingItemTechnicians.some((et: any) => et.technician_id === t.id)).map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-semibold">{tech.name}</span>
                            {tech.specialty && <span className="text-xs text-muted-foreground">({tech.specialty})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {inlineItem.technician_id && (
                  <div className="bg-background/80 p-4 rounded-xl border border-border/80 space-y-3 animate-in fade-in slide-in-from-left-2 shadow-inner">
                    {/* Rate Type */}
                    <div>
                      <Label className="text-xs font-bold text-foreground/80 mb-1 block">طريقة التسعير للفني</Label>
                      <Select
                        dir="rtl"
                        value={inlineItem.technician_rate_type}
                        onValueChange={(value: "unit" | "piece" | "fixed") => setInlineItem(prev => ({ 
                          ...prev, 
                          technician_rate_type: value, 
                          technician_rate: "", 
                          technician_piece_qty: "1" 
                        }))}
                      >
                        <SelectTrigger className="h-10 border-border/80 focus:ring-primary focus:border-primary rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          <SelectItem value="unit">بالوحدة (حسب كمية البند)</SelectItem>
                          <SelectItem value="piece">بالقطعة / تكرار مخصص</SelectItem>
                          <SelectItem value="fixed">مبلغ مقطوع (ثابت)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Piece Qty if applicable */}
                      {inlineItem.technician_rate_type === "piece" && (
                        <div>
                          <Label className="text-xs font-bold text-foreground/80 mb-1 block">العدد (قطعة)</Label>
                          <Input
                            type="number"
                            value={inlineItem.technician_piece_qty}
                            onChange={(e) => setInlineItem(prev => ({ ...prev, technician_piece_qty: e.target.value }))}
                            placeholder="1"
                            className="h-10 text-sm border-border/80 focus-visible:ring-primary focus-visible:border-primary rounded-lg"
                          />
                        </div>
                      )}
                      
                      {/* Rate Input */}
                      <div className={inlineItem.technician_rate_type === "piece" ? "" : "col-span-2"}>
                        <Label className="text-xs font-bold text-foreground/80 mb-1 block">
                          {inlineItem.technician_rate_type === "fixed" ? "المبلغ المقطوع" : inlineItem.technician_rate_type === "piece" ? "سعر القطعة" : "السعر لكل وحدة"}
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={inlineItem.technician_rate}
                            onChange={(e) => setInlineItem(prev => ({ ...prev, technician_rate: e.target.value }))}
                            placeholder="0.00"
                            className="h-10 text-base font-semibold pl-12 border-border/80 focus-visible:ring-primary focus-visible:border-primary rounded-lg"
                          />
                          <span className="absolute left-2 top-1.5 bottom-1.5 px-2 bg-muted border border-border/60 text-xs font-bold text-muted-foreground flex items-center justify-center rounded-md select-none">
                            د.ل
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live Technician Cost Preview */}
                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-bold">استحقاق الفني:</span>
                      {(() => {
                        const techRate = parseFloat(inlineItem.technician_rate) || 0;
                        const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
                        
                        let total = 0;
                        let formulaText = "";
                        if (inlineItem.technician_rate_type === "fixed") {
                          total = techRate;
                          formulaText = `${techRate.toLocaleString()} د.ل مقطوع`;
                        } else if (inlineItem.technician_rate_type === "piece") {
                          total = techRate * pieceQty;
                          formulaText = `${techRate.toLocaleString()} د.ل × ${pieceQty}`;
                        } else {
                          total = techRate * qty;
                          formulaText = `${techRate.toLocaleString()} د.ل × ${qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
                        }
                        
                        return (
                          <span className="font-bold text-amber-700 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/15">
                            {formulaText} = {total.toLocaleString()} د.ل
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* List of currently assigned technicians for Edit Mode */}
                {editingItem && editingItemTechnicians.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/80 space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    <Label className="text-xs font-bold text-muted-foreground block mb-2">الفنيين المعينين حالياً ({editingItemTechnicians.length})</Label>
                    <div className="space-y-1.5">
                      {editingItemTechnicians.map((et: any) => (
                        <div key={et.id} className="flex items-center justify-between bg-background border border-border rounded-xl p-2.5 text-xs shadow-sm">
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{et.technicians?.name}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                              {rateTypeLabels[et.rate_type || 'meter']} · {et.rate.toLocaleString()} د.ل
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-amber-700">{(et.total_cost || 0).toLocaleString()} د.ل</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full cursor-pointer transition-colors"
                              onClick={async () => {
                                const { error } = await supabase.from("project_item_technicians").delete().eq("id", et.id);
                                if (error) {
                                  toast({ title: "خطأ", description: "حدث خطأ أثناء حذف الفني", variant: "destructive" });
                                } else {
                                  setEditingItemTechnicians(prev => prev.filter((t: any) => t.id !== et.id));
                                  queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                                  queryClient.invalidateQueries({ queryKey: ["technician-assignments"] });
                                  queryClient.invalidateQueries({ queryKey: ["all-technicians-rates"] });
                                  queryClient.invalidateQueries({ queryKey: ["technicians"] });
                                  toast({ title: "تم الحذف", description: "تم إلغاء تعيين الفني بنجاح" });
                                }
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground font-semibold bg-muted/20 border border-dashed border-border/80 rounded-xl">
                اضغط على "تفعيل التعيين" لتحديد فني للبند واحتساب التكاليف.
              </div>
            )}
          </div>

          {showTechAssignment && !inlineItem.technician_id && (!editingItem || editingItemTechnicians.length === 0) && (
            <div className="bg-muted/40 p-4 rounded-xl border border-border/60 text-xs text-muted-foreground text-center flex items-center justify-center gap-2 font-semibold shadow-inner mt-4">
              <Info className="h-4.5 w-4.5 text-primary animate-pulse" />
              <span>لم يتم تعيين أي فني لهذا البند حتى الآن.</span>
            </div>
          )}
        </div>
      </div>

      {/* Zone 4: Real-time profitability preview (Margin calculation) */}
      <div className="mt-6 pt-5 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Financial Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto md:flex-1 md:max-w-3xl">
          {/* سعر البيع الإجمالي */}
          <div className="bg-card border border-border/80 px-4 py-3 rounded-xl text-right flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground font-bold block mb-0.5">سعر البيع الإجمالي</span>
              <span className="text-base font-extrabold text-foreground">{saleTotal.toLocaleString()} د.ل</span>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
              <Coins className="h-4.5 w-4.5" />
            </div>
          </div>
          
          {/* تكلفة الفنيين الإجمالية */}
          <div className="bg-amber-500/5 border border-amber-500/20 px-4 py-3 rounded-xl text-right flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground font-bold block mb-0.5">تكلفة الفنيين الإجمالية</span>
              <span className="text-base font-extrabold text-amber-700 dark:text-amber-500">{totalCost.toLocaleString()} د.ل</span>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-500 shrink-0">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* صافي الربح المتوقع */}
          <div className={`border px-4 py-3 rounded-xl text-right flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow duration-200 ${
            netProfit >= 0 
              ? 'bg-emerald-500/5 border-emerald-500/25 text-emerald-700 dark:text-emerald-500' 
              : 'bg-destructive/5 border-destructive/25 text-destructive'
          }`}>
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground font-bold block mb-0.5">صافي الربح المتوقع</span>
              <span className="text-base font-extrabold">{netProfit.toLocaleString()} د.ل</span>
            </div>
            <div className={`p-2 rounded-lg shrink-0 ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>

          {/* هامش الربح */}
          <div className={`border px-4 py-3 rounded-xl text-right flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow duration-200 ${
            profitMargin >= 20 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-500'
              : profitMargin >= 0 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            <div className="min-w-0">
              <span className="text-[10px] text-muted-foreground font-bold block mb-0.5">هامش الربح (%)</span>
              <span className="text-base font-extrabold">{profitMargin.toFixed(1)}%</span>
            </div>
            <div className={`p-2 rounded-lg shrink-0 ${
              profitMargin >= 20 
                ? 'bg-emerald-500/20 text-emerald-600'
                : profitMargin >= 0 
                  ? 'bg-amber-500/20 text-amber-600'
                  : 'bg-destructive/20 text-destructive'
            }`}>
              <Percent className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        {/* Actions buttons */}
        <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
          {editingItem && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => guard.requestAction(handleCancelEdit)}
              className="h-12 px-5 border-dashed cursor-pointer rounded-xl transition-all"
            >
              إلغاء التعديل
            </Button>
          )}
          <Button
            type="button"
            disabled={!inlineItem.name.trim() || saveMutation.isPending}
            onClick={async () => {
              if (!inlineItem.name.trim()) return;
              
              const finalQty = qty;
              const techId = inlineItem.technician_id;
              
              let detectedType: any = inlineItem.measurement_type;
              if (calculationMethod === "config" && inlineItem.measurement_config_id) {
                const mc = measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id);
                detectedType = detectMeasurementType(mc || null);
              }

              saveMutation.mutate({
                general_item_id: inlineItem.generalItemId || null,
                name: inlineItem.name,
                description: inlineItem.description || null,
                measurement_type: detectedType,
                quantity: finalQty.toString(),
                unit_price: inlineItem.unit_price || "0",
                engineer_id: inlineItem.engineer_id || null,
                formula: inlineItem.formula || "",
                length: "",
                width: "",
                height: "",
                notes: inlineItem.notes || null,
                measurement_factor: inlineItem.measurement_factor,
                measurement_config_id: inlineItem.measurement_config_id || null,
                component_values: inlineItem.component_values,
                technician: techId ? { technician_id: techId,
                  rate_type: inlineItem.technician_rate_type === "unit" ? "meter" : inlineItem.technician_rate_type,
                  rate: parseFloat(inlineItem.technician_rate) || 0,
                  quantity: inlineItem.technician_rate_type === "fixed" ? 1 : inlineItem.technician_rate_type === "piece"
                    ? (parseFloat(inlineItem.technician_piece_qty) || 1) : finalQty } : null,
              }, {
                onSuccess: () => {
                  setEditingItem(null);
                  setEditingItemTechnicians([]);
                  setInlineItem({ generalItemId: "", name: "", description: "", measurement_type: "linear",
                    quantity: "", unit_price: "", notes: "", engineer_id: "", technician_id: "",
                    technician_rate_type: "unit", technician_rate: "", technician_piece_qty: "1",
                    measurement_config_id: "", component_values: {}, measurement_factor: "1", item_count: "1", formula: "" });
                  setInlineSearch("");
                  setCalculationMethod("manual");
                  setTimeout(() => nameInputRef.current?.focus(), 0);
                }
              });
            }}
            className="h-12 px-6 gap-2 bg-primary hover:bg-primary/95 hover:scale-[1.01] active:scale-[0.99] text-primary-foreground font-bold shadow-lg shadow-primary/25 transition-all duration-200 cursor-pointer border-none rounded-xl"
          >
            {editingItem ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saveMutation.isPending ? "جاري الحفظ..." : editingItem ? "تحديث البند الحالي" : "إضافة البند للفاتورة"}
          </Button>
        </div>
      </div>
      </fieldset>
      <QuickAddTechnicianDialog open={addTechnicianOpen} onOpenChange={setAddTechnicianOpen} onSuccess={technician => {
        setInlineItem(prev => ({ ...prev, technician_id: technician.id }));
        setShowTechAssignment(true);
        queryClient.invalidateQueries({ queryKey: ["technicians"] });
      }} />
      <QuickAddMeasurementDialog open={addUnitOpen} onOpenChange={setAddUnitOpen} onCreated={unit => {
        setInlineItem(prev => ({ ...prev, measurement_config_id: unit.id, formula: "Q", component_values: { Q: prev.quantity || "1" } }));
        setCalculationMethod("config");
      }} />
      <UnsavedChangesDialog open={guard.showConfirmDialog} onOpenChange={guard.setShowConfirmDialog} onStay={guard.cancelDiscard} onConfirmDiscard={guard.confirmDiscard} />
    </div>
  );
};
