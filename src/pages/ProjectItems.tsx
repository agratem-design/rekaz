import { useState, useEffect, useMemo, useRef } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { InvoiceItemForm } from "@/components/project-items/InvoiceItemForm";
import { safeEvaluate } from "@/lib/safeFormula";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
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
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Plus, Pencil, Trash2, Ruler, Square, Box, Download, Package, Search, Filter, User, Calculator, Users, X, Copy, ArrowRightLeft, CheckSquare, Layers, Info, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

type MeasurementType = "linear" | "square" | "cubic";

interface ProjectItem {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  measurement_type: MeasurementType;
  quantity: number;
  unit_price: number;
  total_price: number;
  engineer_id: string | null;
  formula: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  notes: string | null;
  measurement_config_id: string | null;
  component_values: Record<string, number> | null;
  measurement_factor: number | null;
  created_at: string;
  updated_at: string;
  engineers?: {
    id: string;
    name: string;
    engineer_type: string;
  } | null;
  measurement_configs?: {
    id: string;
    name: string;
    unit_symbol: string;
  } | null;
}

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
}

interface Engineer {
  id: string;
  name: string;
  engineer_type: string;
}

interface Technician {
  id: string;
  name: string;
  specialty: string | null;
  daily_rate: number | null;
  hourly_rate: number | null;
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

interface ItemTechnician {
  technician_id: string;
  rate_type: 'meter' | 'piece' | 'fixed';
  rate: number;
  quantity: number;
  linked_quantity: boolean;
}

const rateTypeLabels: Record<string, string> = {
  meter: "بالمتر",
  piece: "بالقطعة",
  fixed: "مبلغ ثابت",
};

const measurementLabels: Record<MeasurementType, string> = {
  linear: "متر طولي",
  square: "متر مربع",
  cubic: "متر مكعب",
};

const measurementIcons: Record<MeasurementType, React.ReactNode> = {
  linear: <Ruler className="h-4 w-4" />,
  square: <Square className="h-4 w-4" />,
  cubic: <Box className="h-4 w-4" />,
};

const measurementUnits: Record<MeasurementType, string> = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const detectMeasurementType = (config: MeasurementConfig | null): MeasurementType => {
  if (!config) return "linear";
  const symbol = config.unit_symbol || "";
  if (symbol.includes("²") || symbol.includes("2") || config.name.includes("مربع")) return "square";
  if (symbol.includes("³") || symbol.includes("3") || config.name.includes("مكعب")) return "cubic";
  return "linear";
};

const ProjectItems = () => {
  const { id: projectId, phaseId: routePhaseId } = useParams<{ id: string; phaseId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryPhaseId = searchParams.get("phase");
  const effectivePhaseId = routePhaseId || queryPhaseId || undefined;
  const queryClient = useQueryClient();
  const inlineDropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [calculationMethod, setCalculationMethod] = useState<"manual" | "config">("manual");
  const [dialogOpen, setDialogOpen] = useState(false); // kept for import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [techniciansDialogOpen, setTechniciansDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState<ProjectItem | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [targetPhaseId, setTargetPhaseId] = useState<string>("");
  const [selectedItemForTechnicians, setSelectedItemForTechnicians] = useState<ProjectItem | null>(null);
  const [copyFromItemId, setCopyFromItemId] = useState<string>("");
  const [editingItem, setEditingItem] = useState<ProjectItem | null>(null);
  const [selectedGeneralItems, setSelectedGeneralItems] = useState<string[]>([]);
  const [importItemsData, setImportItemsData] = useState<Record<string, { quantity: string; unit_price: string }>>({});
  const [importSearchQuery, setImportSearchQuery] = useState("");
  const [importCategoryFilter, setImportCategoryFilter] = useState<string>("all");
  const [itemTechnicians, setItemTechnicians] = useState<ItemTechnician[]>([]);
  const [itemToDelete, setItemToDelete] = useState<(ProjectItem & { technician_cost: number }) | null>(null);
  const [inlineSearch, setInlineSearch] = useState("");
  const [inlineDropdownOpen, setInlineDropdownOpen] = useState(false);
  const [editingItemTechnicians, setEditingItemTechnicians] = useState<any[]>([]);
  const [inlineItem, setInlineItem] = useState({
    generalItemId: "",
    name: "",
    description: "",
    measurement_type: "linear" as MeasurementType,
    quantity: "",
    unit_price: "",
    notes: "",
    engineer_id: "",
    technician_id: "",
    technician_rate_type: "unit" as "unit" | "piece" | "fixed",
    technician_rate: "",
    technician_piece_qty: "1",
    measurement_config_id: "",
    component_values: {} as Record<string, string>,
    measurement_factor: "1",
    item_count: "1",
    formula: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    measurement_type: "linear" as MeasurementType,
    quantity: "",
    unit_price: "",
    engineer_id: "",
    formula: "",
    length: "",
    width: "",
    height: "",
    notes: "",
    measurement_factor: "1",
    measurement_config_id: "",
    component_values: {} as Record<string, string>,
  });

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch current phase details if in phase context (validating project ownership)
  const { data: currentPhase } = useQuery({
    queryKey: ["phase-meta-for-items", effectivePhaseId, projectId],
    queryFn: async () => {
      if (!effectivePhaseId || !projectId) return null;
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, phase_number, status, project_id")
        .eq("id", effectivePhaseId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!effectivePhaseId && !!projectId,
  });

  // Canonical redirect for legacy ?phase= parameter when routePhaseId is not set
  useEffect(() => {
    if (queryPhaseId && !routePhaseId && projectId && currentPhase) {
      navigate(`/projects/${projectId}/phases/${queryPhaseId}/items`, { replace: true });
    }
  }, [queryPhaseId, routePhaseId, projectId, currentPhase, navigate]);

  // Fetch project items with engineer info and technician costs
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["project-items", projectId, effectivePhaseId],
    queryFn: async () => {
      let query = supabase
        .from("project_items")
        .select(`
          *,
          engineers (id, name, engineer_type),
          measurement_configs (id, name, unit_symbol),
          project_item_technicians (total_cost),
          purchases (id, total_amount),
          technician_progress_records (id, quantity_completed, rate, earned_amount)
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      
      if (effectivePhaseId) {
        query = query.eq("phase_id", effectivePhaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((item: any) => {
        const rawTotal = item.total_price;
        const effectiveTotal = rawTotal || (item.quantity * item.unit_price);
        const assignedTechCost = item.project_item_technicians?.reduce((sum: number, t: any) => sum + Number(t.total_cost || 0), 0) || 0;
        const progressTechCost = item.technician_progress_records?.reduce((sum: number, r: any) => {
          const earned = Number(r.earned_amount || 0);
          return sum + (earned > 0 ? earned : (Number(r.quantity_completed || 0) * Number(r.rate || 0)));
        }, 0) || 0;

        const technicianCost = Math.max(assignedTechCost, progressTechCost);
        const purchasesCost = item.purchases?.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0) || 0;

        return {
          ...item,
          total_price: effectiveTotal,
          _raw_total_price: rawTotal,
          technician_cost: technicianCost,
          purchases_cost: purchasesCost,
        };
      }) as (ProjectItem & { technician_cost: number; purchases_cost: number; _raw_total_price: number })[];
    },
    enabled: !!projectId,
  });

  // Fetch engineers
  const { data: engineers } = useQuery({
    queryKey: ["engineers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("id, name, engineer_type")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Engineer[];
    },
  });

  // Fetch technicians
  const { data: technicians } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, specialty, daily_rate, hourly_rate")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Technician[];
    },
  });

  // Fetch project phases for move dialog
  const { data: projectPhases } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, order_index")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch general items for import
  const { data: generalItems } = useQuery({
    queryKey: ["general-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_project_items")
        .select("*")
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

  // Fetch item technicians for selected item
  const { data: currentItemTechnicians, refetch: refetchItemTechnicians } = useQuery({
    queryKey: ["item-technicians", selectedItemForTechnicians?.id],
    queryFn: async () => {
      if (!selectedItemForTechnicians?.id) return [];
      const { data, error } = await supabase
        .from("project_item_technicians")
        .select(`
          *,
          technicians (id, name, specialty)
        `)
        .eq("project_item_id", selectedItemForTechnicians.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedItemForTechnicians?.id,
  });

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
      
      // Replace component symbols with their values
      selectedMeasurementConfig.components.forEach(comp => {
        const value = parseFloat(formData.component_values[comp.symbol]) || 0;
        const regex = new RegExp(comp.symbol, 'g');
        formula = formula.replace(regex, value.toString());
      });
      
      // Evaluate the formula
      const result = safeEvaluate(formula);
      if (result === null) return null;
      
      return result * factor;
    } catch {
      return null;
    }
  }, [selectedMeasurementConfig, formData.component_values, formData.measurement_factor]);

  // Auto-update quantity when calculated
  useEffect(() => {
    if (calculatedQuantity !== null && calculatedQuantity > 0) {
      setFormData(prev => ({
        ...prev,
        quantity: calculatedQuantity.toFixed(4).replace(/\.?0+$/, ''),
      }));
    }
  }, [calculatedQuantity]);

  // Close inline dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inlineDropdownRef.current && !inlineDropdownRef.current.contains(e.target as Node)) {
        setInlineDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recalculate quantity dynamically for the inline add form
  useEffect(() => {
    if (calculationMethod === "config" && inlineItem.measurement_config_id) {
      const inlineMC = measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id);
      if (inlineMC && inlineMC.formula) {
        try {
          let formula = inlineItem.formula || inlineMC.formula;
          const factor = parseFloat(inlineItem.measurement_factor) || 1;
          const itemCount = parseFloat(inlineItem.item_count) || 1;
          
          inlineMC.components.forEach(comp => {
            const val = parseFloat(inlineItem.component_values[comp.symbol]) || 0;
            formula = formula.replace(new RegExp(comp.symbol, 'g'), val.toString());
          });
          
          const result = safeEvaluate(formula);
          if (result !== null) {
            const finalQty = (result * factor * itemCount).toFixed(4).replace(/\.?0+$/, '');
            setInlineItem(prev => {
              if (prev.quantity !== finalQty) {
                return { ...prev, quantity: finalQty };
              }
              return prev;
            });
          }
        } catch (e) {
          console.error("Error evaluating inline formula:", e);
        }
      }
    }
  }, [
    calculationMethod,
    inlineItem.measurement_config_id,
    inlineItem.formula,
    inlineItem.component_values,
    inlineItem.measurement_factor,
    inlineItem.item_count,
    measurementConfigs
  ]);

  // Add/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Calculate total based on formula or simple multiplication
      let calculatedTotal = 0;
      const qty = parseFloat(data.quantity) || 0;
      const price = parseFloat(data.unit_price) || 0;
      const len = parseFloat(data.length) || 0;
      const wid = parseFloat(data.width) || 0;
      const hei = parseFloat(data.height) || 0;

      if (data.formula) {
        try {
          // Safe evaluation of formula
          const formula = data.formula
            .replace(/السعر|price/gi, price.toString())
            .replace(/الكمية|qty/gi, qty.toString())
            .replace(/الطول|length/gi, len.toString())
            .replace(/العرض|width/gi, wid.toString())
            .replace(/الارتفاع|height/gi, hei.toString());
          // Simple math evaluation (only supports basic operations)
          calculatedTotal = safeEvaluate(formula) ?? (qty * price);
        } catch {
          calculatedTotal = qty * price;
        }
      } else {
        calculatedTotal = qty * price;
      }

      const payload = {
        project_id: projectId!,
        phase_id: effectivePhaseId || null,
        name: data.name,
        description: data.description || null,
        measurement_type: data.measurement_type,
        quantity: qty,
        unit_price: price,
        total_price: calculatedTotal,
        engineer_id: data.engineer_id || null,
        formula: data.formula || null,
        length: len,
        width: wid,
        height: hei,
        notes: data.notes || null,
        measurement_factor: parseFloat(data.measurement_factor) || 1,
        measurement_config_id: data.measurement_config_id || null,
        component_values: Object.keys(data.component_values).length > 0 
          ? Object.fromEntries(
              Object.entries(data.component_values).map(([k, v]) => [k, parseFloat(v) || 0])
            ) as Json
          : null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("project_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { data: insertedItem, error } = await supabase.from("project_items").insert(payload).select("id").single();
        if (error) throw error;
        return insertedItem;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      toast({
        title: editingItem ? "تم تحديث العنصر" : "تم إضافة العنصر",
        description: editingItem
          ? "تم تحديث بيانات العنصر بنجاح"
          : "تم إضافة العنصر بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ العنصر",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("project_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;

      // Check remaining items and update project progress
      const { data: remainingItems, error: itemsError } = await supabase
        .from("project_items")
        .select("progress, quantity")
        .eq("project_id", projectId!);
      
      if (itemsError) throw itemsError;

      let projectProgress = 0;
      if (remainingItems && remainingItems.length > 0) {
        const totalQuantity = remainingItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (totalQuantity > 0) {
          const weightedProgress = remainingItems.reduce((sum, item) => {
            const weight = Number(item.quantity || 0) / totalQuantity;
            return sum + (Number(item.progress || 0) * weight);
          }, 0);
          projectProgress = Math.round(weightedProgress);
        } else {
          projectProgress = Math.round(
            remainingItems.reduce((sum, item) => sum + Number(item.progress || 0), 0) / remainingItems.length
          );
        }
      }
      // If no items remain, projectProgress stays 0

      const { error: updateError } = await supabase
        .from("projects")
        .update({ progress: projectProgress })
        .eq("id", projectId!);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "تم حذف العنصر",
        description: "تم حذف العنصر بنجاح",
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

  // Import general items mutation
  const importMutation = useMutation({
    mutationFn: async (selectedIds: string[]) => {
      const itemsToImport = generalItems?.filter((item) => selectedIds.includes(item.id));
      if (!itemsToImport || itemsToImport.length === 0) return;

      const payloads = itemsToImport.map((item) => {
        const customData = importItemsData[item.id];
        return {
          project_id: projectId!,
          phase_id: effectivePhaseId || null,
          name: item.name,
          description: item.description,
          measurement_type: item.measurement_type,
          quantity: customData ? parseFloat(customData.quantity) || 0 : 0,
          unit_price: customData ? parseFloat(customData.unit_price) || item.default_unit_price : item.default_unit_price,
          notes: item.notes,
          measurement_factor: (item as any).measurement_factor !== null && (item as any).measurement_factor !== undefined ? Number((item as any).measurement_factor) : 1,
          formula: item.formula,
          measurement_config_id: item.measurement_config_id,
        };
      });

      const { error } = await supabase.from("project_items").insert(payloads);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      toast({
        title: "تم استيراد العناصر",
        description: "تم استيراد العناصر العامة بنجاح",
      });
      setImportDialogOpen(false);
      setSelectedGeneralItems([]);
      setImportItemsData({});
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء استيراد العناصر",
        variant: "destructive",
      });
    },
  });

  // Move item to another phase mutation
  const moveItemMutation = useMutation({
    mutationFn: async ({ itemId, newPhaseId }: { itemId: string; newPhaseId: string | null }) => {
      const { error } = await supabase
        .from("project_items")
        .update({ phase_id: newPhaseId })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم نقل البند",
        description: "تم نقل البند إلى المرحلة الجديدة بنجاح",
      });
      setMoveDialogOpen(false);
      setItemToMove(null);
      setTargetPhaseId("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نقل البند",
        variant: "destructive",
      });
    },
  });

  // Bulk move items mutation
  const bulkMoveItemsMutation = useMutation({
    mutationFn: async ({ itemIds, newPhaseId }: { itemIds: string[]; newPhaseId: string | null }) => {
      const { error } = await supabase
        .from("project_items")
        .update({ phase_id: newPhaseId })
        .in("id", itemIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم نقل البنود",
        description: `تم نقل ${selectedItemIds.length} بند إلى المرحلة الجديدة بنجاح`,
      });
      setBulkMoveDialogOpen(false);
      setSelectedItemIds([]);
      setTargetPhaseId("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نقل البنود",
        variant: "destructive",
      });
    },
  });

  // Bulk delete items mutation
  const bulkDeleteItemsMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      // First delete technician assignments
      const { error: techError } = await supabase
        .from("project_item_technicians")
        .delete()
        .in("project_item_id", itemIds);
      if (techError) throw techError;

      // Then delete items
      const { error } = await supabase
        .from("project_items")
        .delete()
        .in("id", itemIds);
      if (error) throw error;

      // Update project progress
      const { data: remainingItems } = await supabase
        .from("project_items")
        .select("progress, quantity")
        .eq("project_id", projectId!);

      let projectProgress = 0;
      if (remainingItems && remainingItems.length > 0) {
        const totalQuantity = remainingItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (totalQuantity > 0) {
          const weightedProgress = remainingItems.reduce((sum, item) => {
            const weight = Number(item.quantity || 0) / totalQuantity;
            return sum + (Number(item.progress || 0) * weight);
          }, 0);
          projectProgress = Math.round(weightedProgress);
        }
      }

      await supabase
        .from("projects")
        .update({ progress: projectProgress })
        .eq("id", projectId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم حذف البنود",
        description: `تم حذف ${selectedItemIds.length} بند بنجاح`,
      });
      setBulkDeleteDialogOpen(false);
      setSelectedItemIds([]);
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف البنود",
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
      measurement_type: "linear",
      quantity: "",
      unit_price: "",
      engineer_id: "",
      formula: "",
      length: "",
      width: "",
      height: "",
      notes: "",
      measurement_factor: "1",
      measurement_config_id: "",
      component_values: {},
    });
  };

  const handleEdit = async (item: ProjectItem) => {
    setEditingItem(item);
    // Convert component_values from Record<string, number> to Record<string, string> for form
    const componentValuesAsStrings: Record<string, string> = {};
    if (item.component_values) {
      Object.entries(item.component_values).forEach(([key, value]) => {
        componentValuesAsStrings[key] = value?.toString() || "";
      });
    }
    setInlineItem({
      generalItemId: "",
      name: item.name,
      description: item.description || "",
      measurement_type: item.measurement_type,
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      notes: item.notes || "",
      engineer_id: item.engineer_id || "",
      technician_id: "",
      technician_rate_type: "unit",
      technician_rate: "",
      technician_piece_qty: "1",
      measurement_config_id: item.measurement_config_id || "",
      component_values: componentValuesAsStrings,
      measurement_factor: item.measurement_factor?.toString() || "1",
      item_count: "1",
      formula: item.formula || "",
    });
    setCalculationMethod(item.measurement_config_id ? "config" : "manual");
    setInlineSearch("");

    // Fetch existing technicians for this item
    const { data: existingTechs } = await supabase
      .from("project_item_technicians")
      .select("*, technicians(id, name, specialty)")
      .eq("project_item_id", item.id);
    setEditingItemTechnicians(existingTechs || []);

    // Smooth scroll to the form and focus
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameInputRef.current?.focus();
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditingItemTechnicians([]);
    setInlineItem({
      generalItemId: "",
      name: "",
      description: "",
      measurement_type: "linear",
      quantity: "",
      unit_price: "",
      notes: "",
      engineer_id: "",
      technician_id: "",
      technician_rate_type: "unit",
      technician_rate: "",
      technician_piece_qty: "1",
      measurement_config_id: "",
      component_values: {},
      measurement_factor: "1",
      item_count: "1",
      formula: "",
    });
    setCalculationMethod("manual");
    setInlineSearch("");
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

  const totalAmount = items?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
  const totalTechnicianCost = items?.reduce((sum, item) => sum + (item.technician_cost || 0), 0) || 0;
  const totalPurchasesCost = items?.reduce((sum, item) => sum + ((item as any).purchases_cost || 0), 0) || 0;
  const totalNet = totalAmount - (totalTechnicianCost + totalPurchasesCost);

  if (projectLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">المشروع غير موجود</p>
        <Link to="/projects">
          <Button variant="link">العودة للمشاريع</Button>
        </Link>
      </div>
    );
  }

  return (
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        {/* Phase Context Banner (if inside a Phase) */}
        {effectivePhaseId && currentPhase && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">أنت تتصفح حالياً بنود مرحلة:</span>
                <span className="font-bold text-foreground mr-1.5">{currentPhase.name}</span>
                <Badge variant="outline" className="text-[10px] mr-2">
                  #{currentPhase.phase_number || 1}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer"
                onClick={() => navigate(`/projects/${projectId}/phases/${effectivePhaseId}`)}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>مساحة عمل المرحلة</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => navigate(`/projects/${projectId}/items`)}
              >
                <span>عرض جميع بنود المشروع</span>
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {effectivePhaseId && currentPhase
                ? `بنود مقايسة ${currentPhase.name}`
                : "فاتورة بنود المقاولات"}
            </h1>
            <p className="text-muted-foreground">
              {effectivePhaseId && currentPhase
                ? `إدارة وتكاليف بنود هذه المرحلة للمشروع: ${project.name}`
                : project.name}
              {project?.clients?.name && (
                <>
                  {" - "}
                  <Link 
                    to={`/projects/client/${project.client_id}`}
                    className="text-primary hover:underline"
                  >
                    {project.clients.name}
                  </Link>
                </>
              )}
            </p>
          </div>
        <div className="flex gap-2">
          {items && items.some((item: any) => item._raw_total_price === 0 && item.quantity > 0 && item.unit_price > 0) && (
            <Button
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={async () => {
                const brokenItems = items.filter((item: any) => item._raw_total_price === 0 && item.quantity > 0 && item.unit_price > 0);
                let fixed = 0;
                for (const item of brokenItems) {
                  const total = item.quantity * item.unit_price;
                  const { error } = await supabase
                    .from("project_items")
                    .update({ total_price: total })
                    .eq("id", item.id);
                  if (!error) fixed++;
                }
                queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                toast({ title: "تم", description: `تم إعادة حساب ${fixed} بند` });
              }}
            >
              <Calculator className="h-4 w-4 ml-2" />
              إعادة حساب ({items.filter((item: any) => item._raw_total_price === 0 && item.quantity > 0 && item.unit_price > 0).length})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد البنود</p>
                <p className="text-2xl font-bold">{items?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Ruler className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قيمة البنود</p>
                <p className="text-2xl font-bold">{totalAmount.toLocaleString()} د.ل</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">تكلفة الفنيين</p>
                <p className="text-2xl font-bold">{totalTechnicianCost.toLocaleString()} د.ل</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Calculator className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الصافي</p>
                <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {totalNet.toLocaleString()} د.ل
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Square className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ميزانية المشروع</p>
                <p className="text-2xl font-bold">{project.budget?.toLocaleString() || 0} د.ل</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>قائمة البنود</CardTitle>
          {selectedItemIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                تم تحديد {selectedItemIds.length} بند
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkMoveDialogOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4 ml-1" />
                نقل المحدد
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 ml-1" />
                حذف المحدد
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedItemIds([])}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-x-auto" style={{ overflowY: 'visible' }}>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    {items && items.length > 0 && (
                    <Checkbox
                      checked={items.length > 0 && selectedItemIds.length === items.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedItemIds(items!.map(item => item.id));
                        } else {
                          setSelectedItemIds([]);
                        }
                      }}
                    />
                    )}
                  </TableHead>
                  <TableHead className="text-right">البند</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">سعر الوحدة</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                  <TableHead className="text-right">المشتريات</TableHead>
                  <TableHead className="text-right">تكلفة الفنيين</TableHead>
                  <TableHead className="text-right">الصافي</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items && items.map((item) => {
                  const pCost = (item as any).purchases_cost || 0;
                  const itemNet = (item.total_price || 0) - ((item.technician_cost || 0) + pCost);
                  const isSelected = selectedItemIds.includes(item.id);
                  return (
                  <TableRow key={item.id} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItemIds(prev => [...prev, item.id]);
                          } else {
                            setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            {measurementIcons[item.measurement_type]}
                            {item.measurement_configs?.unit_symbol || measurementUnits[item.measurement_type]}
                          </Badge>
                          {item.engineers && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <User className="h-3 w-3" />
                              {item.engineers.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span>{item.quantity}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.measurement_configs?.unit_symbol || measurementUnits[item.measurement_type]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{item.unit_price.toLocaleString()} د.ل</TableCell>
                    <TableCell className="font-bold">
                      {item.total_price.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className="text-blue-600 font-medium">
                      {pCost.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className="text-orange-600">
                      {item.technician_cost.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className={`font-bold ${itemNet >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {itemNet.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedItemForTechnicians(item);
                            setTechniciansDialogOpen(true);
                          }}
                          title="الفنيين"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setItemToMove(item);
                            setTargetPhaseId("");
                            setMoveDialogOpen(true);
                          }}
                          title="نقل إلى مرحلة أخرى"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setItemToDelete(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}


              </TableBody>
            </Table>
          </div>
          {/* Redesigned Inline Add/Edit Section - Golden Theme & 2-Column Responsive Layout */}
          <InvoiceItemForm
            projectId={projectId!}
            editingItem={editingItem}
            setEditingItem={setEditingItem}
            inlineItem={inlineItem}
            setInlineItem={setInlineItem}
            calculationMethod={calculationMethod}
            setCalculationMethod={setCalculationMethod}
            inlineSearch={inlineSearch}
            setInlineSearch={setInlineSearch}
            inlineDropdownOpen={inlineDropdownOpen}
            setInlineDropdownOpen={setInlineDropdownOpen}
            editingItemTechnicians={editingItemTechnicians}
            setEditingItemTechnicians={setEditingItemTechnicians}
            generalItems={generalItems}
            engineers={engineers}
            technicians={technicians}
            measurementConfigs={measurementConfigs}
            saveMutation={saveMutation}
            formRef={formRef}
            nameInputRef={nameInputRef}
            handleCancelEdit={handleCancelEdit}
            inlineDropdownRef={inlineDropdownRef}
          />

            {/* Total row */}
            {items && items.length > 0 && (
              <div className="flex items-center justify-end gap-4 mt-4 pt-4 border-t">
                <span className="text-muted-foreground">إجمالي البنود:</span>
                <span className="text-primary font-bold text-lg">{totalAmount.toLocaleString()} د.ل</span>
              </div>
            )}
        </CardContent>
      </Card>




      {/* Import from General Items Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              استيراد من البنود العامة
            </DialogTitle>
          </DialogHeader>
          
          {/* Search and Category Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في البنود العامة..."
                value={importSearchQuery}
                onChange={(e) => setImportSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={importCategoryFilter} onValueChange={setImportCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 ml-1" />
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {[...new Set(generalItems?.map(item => item.category).filter(Boolean) || [])].map((cat) => (
                  <SelectItem key={cat} value={cat as string}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 max-h-[350px] overflow-y-auto">
            {generalItems && generalItems.length > 0 ? (
              generalItems
                .filter((item) => {
                  const matchesSearch = 
                    item.name.toLowerCase().includes(importSearchQuery.toLowerCase()) ||
                    item.description?.toLowerCase().includes(importSearchQuery.toLowerCase());
                  const matchesCategory = 
                    importCategoryFilter === "all" || item.category === importCategoryFilter;
                  return matchesSearch && matchesCategory;
                })
                .map((item) => {
                const isSelected = selectedGeneralItems.includes(item.id);
                const itemData = importItemsData[item.id] || { 
                  quantity: "", 
                  unit_price: item.default_unit_price.toString() 
                };
                
                return (
                  <div
                    key={item.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedGeneralItems((prev) => prev.filter((id) => id !== item.id));
                          setImportItemsData((prev) => {
                            const newData = { ...prev };
                            delete newData[item.id];
                            return newData;
                          });
                        } else {
                          setSelectedGeneralItems((prev) => [...prev, item.id]);
                          setImportItemsData((prev) => ({
                            ...prev,
                            [item.id]: { quantity: "", unit_price: item.default_unit_price.toString() }
                          }));
                        }
                      }}
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        {item.category && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {item.category}
                          </Badge>
                        )}
                        {(item as any).measurement_factor !== undefined && (item as any).measurement_factor !== null && Number((item as any).measurement_factor) !== 1 && (
                          <Badge variant="outline" className="mt-1 mr-1 text-xs border-orange-500/30 text-orange-500 bg-orange-500/5 font-semibold">
                            معامل التكعيب: {(item as any).measurement_factor}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {measurementIcons[item.measurement_type]}
                        {measurementLabels[item.measurement_type]}
                      </Badge>
                    </div>
                    
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">الكمية ({measurementUnits[item.measurement_type]})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={itemData.quantity}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setImportItemsData((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], quantity: e.target.value }
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">سعر الوحدة (د.ل)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={item.default_unit_price.toString()}
                            value={itemData.unit_price}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              setImportItemsData((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], unit_price: e.target.value }
                              }));
                            }}
                          />
                        </div>
                        {itemData.quantity && itemData.unit_price && (
                          <div className="col-span-2 text-sm text-muted-foreground">
                            الإجمالي: <span className="font-bold text-foreground">
                              {(parseFloat(itemData.quantity) * parseFloat(itemData.unit_price)).toLocaleString()} د.ل
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد عناصر عامة</p>
                <Link to="/general-items">
                  <Button variant="link">إضافة عناصر عامة</Button>
                </Link>
              </div>
            )}
          </div>
          {selectedGeneralItems.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                تم اختيار {selectedGeneralItems.length} عنصر
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setSelectedGeneralItems([]);
                setImportItemsData({});
                setImportSearchQuery("");
                setImportCategoryFilter("all");
              }}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => importMutation.mutate(selectedGeneralItems)}
              disabled={selectedGeneralItems.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending
                ? "جاري الاستيراد..."
                : `استيراد (${selectedGeneralItems.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Technicians Management Dialog */}
      <Dialog open={techniciansDialogOpen} onOpenChange={setTechniciansDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              الفنيين - {selectedItemForTechnicians?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Copy technicians from another item */}
            <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
              <Label className="flex items-center gap-2 text-sm">
                <Copy className="h-4 w-4" />
                نسخ الفنيين من عنصر آخر
              </Label>
              <div className="flex gap-2">
                <Select
                  value={copyFromItemId}
                  onValueChange={setCopyFromItemId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="اختر العنصر المصدر" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.filter(item => item.id !== selectedItemForTechnicians?.id).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!copyFromItemId}
                  onClick={async () => {
                    if (!selectedItemForTechnicians?.id || !copyFromItemId) return;
                    
                    // Fetch technicians from source item
                    const { data: sourceTechnicians, error: fetchError } = await supabase
                      .from("project_item_technicians")
                      .select("technician_id, rate_type, rate, quantity, notes")
                      .eq("project_item_id", copyFromItemId);
                    
                    if (fetchError || !sourceTechnicians?.length) {
                      toast({ 
                        title: "خطأ", 
                        description: sourceTechnicians?.length === 0 ? "العنصر المصدر لا يحتوي على فنيين" : "حدث خطأ أثناء جلب الفنيين", 
                        variant: "destructive" 
                      });
                      return;
                    }
                    
                    // Filter out technicians that already exist in target item
                    const existingTechIds = currentItemTechnicians?.map((t: any) => t.technician_id) || [];
                    const newTechnicians = sourceTechnicians.filter(t => !existingTechIds.includes(t.technician_id));
                    
                    if (newTechnicians.length === 0) {
                      toast({ title: "تنبيه", description: "جميع الفنيين موجودين بالفعل في هذا العنصر" });
                      return;
                    }
                    
                    // Insert copied technicians
                    const { error: insertError } = await supabase
                      .from("project_item_technicians")
                      .insert(newTechnicians.map(t => ({
                        project_item_id: selectedItemForTechnicians.id,
                        technician_id: t.technician_id,
                        rate_type: t.rate_type,
                        rate: t.rate,
                        quantity: t.quantity,
                        notes: t.notes,
                      })));
                    
                    if (insertError) {
                      toast({ title: "خطأ", description: "حدث خطأ أثناء نسخ الفنيين", variant: "destructive" });
                    } else {
                      toast({ title: "تم", description: `تم نسخ ${newTechnicians.length} فني بنجاح` });
                      refetchItemTechnicians();
                      setCopyFromItemId("");
                    }
                  }}
                >
                  <Copy className="h-4 w-4 ml-1" />
                  نسخ
                </Button>
              </div>
            </div>

            {/* Add technician form */}
            <div className="p-4 border rounded-lg space-y-3">
              <Label>إضافة فني للعنصر</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={itemTechnicians[0]?.technician_id || ""}
                  onValueChange={(value) => {
                    if (value) {
                      setItemTechnicians([{
                        technician_id: value,
                        rate_type: 'meter',
                        rate: 0,
                        quantity: selectedItemForTechnicians?.quantity || 0,
                        linked_quantity: true,
                      }]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفني" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.filter(t => 
                      !currentItemTechnicians?.some((it: any) => it.technician_id === t.id)
                    ).map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name} {tech.specialty && `(${tech.specialty})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={itemTechnicians[0]?.rate_type || 'meter'}
                  onValueChange={(value: 'meter' | 'piece' | 'fixed') => {
                    setItemTechnicians(prev => prev.map(t => ({ ...t, rate_type: value })));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meter">بالمتر</SelectItem>
                    <SelectItem value="piece">بالقطعة</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">السعر</Label>
                  <Input
                    type="number"
                    placeholder="السعر"
                    value={itemTechnicians[0]?.rate || ''}
                    onChange={(e) => {
                      setItemTechnicians(prev => prev.map(t => ({ ...t, rate: parseFloat(e.target.value) || 0 })));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">الكمية</Label>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={itemTechnicians[0]?.linked_quantity ?? true}
                        onChange={(e) => {
                          const linked = e.target.checked;
                          setItemTechnicians(prev => prev.map(t => ({ 
                            ...t, 
                            linked_quantity: linked,
                            quantity: linked ? (selectedItemForTechnicians?.quantity || 0) : t.quantity
                          })));
                        }}
                        className="rounded border-input"
                      />
                      مرتبطة بالعنصر
                    </label>
                  </div>
                  <Input
                    type="number"
                    placeholder="الكمية"
                    value={itemTechnicians[0]?.quantity || ''}
                    disabled={itemTechnicians[0]?.linked_quantity ?? true}
                    onChange={(e) => {
                      setItemTechnicians(prev => prev.map(t => ({ ...t, quantity: parseFloat(e.target.value) || 0 })));
                    }}
                  />
                </div>
              </div>
              
              {itemTechnicians[0]?.technician_id && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    الإجمالي: <strong>{((itemTechnicians[0]?.rate || 0) * (itemTechnicians[0]?.quantity || 1)).toLocaleString()} د.ل</strong>
                  </span>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!selectedItemForTechnicians?.id || !itemTechnicians[0]?.technician_id) return;
                      
                      const { error } = await supabase
                        .from("project_item_technicians")
                        .insert({
                          project_item_id: selectedItemForTechnicians.id,
                          technician_id: itemTechnicians[0].technician_id,
                          rate_type: itemTechnicians[0].rate_type,
                          rate: itemTechnicians[0].rate,
                          quantity: itemTechnicians[0].quantity,
                          linked_quantity: itemTechnicians[0].linked_quantity ?? true,
                        });
                      
                      if (error) {
                        toast({ title: "خطأ", description: "حدث خطأ أثناء إضافة الفني", variant: "destructive" });
                      } else {
                        toast({ title: "تم", description: "تم إضافة الفني بنجاح" });
                        refetchItemTechnicians();
                        setItemTechnicians([]);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                </div>
              )}
            </div>

            {/* List of assigned technicians */}
            <div className="space-y-2">
              <Label>الفنيين المعينين</Label>
              {currentItemTechnicians && currentItemTechnicians.length > 0 ? (
                <div className="space-y-2">
                  {currentItemTechnicians.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{it.technicians?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rateTypeLabels[it.rate_type]} - {it.rate.toLocaleString()} د.ل × {it.quantity}
                            {it.linked_quantity && (
                              <Badge variant="outline" className="mr-2 text-[10px] px-1">مرتبط</Badge>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-primary">{it.total_cost.toLocaleString()} د.ل</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const { error } = await supabase
                              .from("project_item_technicians")
                              .delete()
                              .eq("id", it.id);
                            
                            if (error) {
                              toast({ title: "خطأ", description: "حدث خطأ أثناء حذف الفني", variant: "destructive" });
                            } else {
                              toast({ title: "تم", description: "تم حذف الفني بنجاح" });
                              refetchItemTechnicians();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      إجمالي تكلفة الفنيين: <strong className="text-foreground">
                        {currentItemTechnicians.reduce((sum: number, it: any) => sum + Number(it.total_cost), 0).toLocaleString()} د.ل
                      </strong>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground border rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لم يتم تعيين فنيين لهذا العنصر</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setTechniciansDialogOpen(false);
              setSelectedItemForTechnicians(null);
              setItemTechnicians([]);
              setCopyFromItemId("");
            }}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف البند</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                هل أنت متأكد من حذف البند <strong>"{itemToDelete?.name}"</strong>؟
              </p>
              {itemToDelete && (
                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                  <p className="font-medium text-foreground">تأثير الحذف على المشروع:</p>
                  {items && items.length === 1 ? (
                    <p className="text-orange-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 inline text-amber-500" />
                      <span>هذا هو البند الأخير - سيصبح تقدم المشروع <strong>0%</strong></span>
                    </p>
                  ) : items && items.length > 1 ? (
                    <p>
                      سيتم إعادة حساب تقدم المشروع بناءً على البنود المتبقية ({items.length - 1} بند)
                    </p>
                  ) : null}
                  {(itemToDelete.technician_cost || 0) > 0 && (
                    <p className="text-orange-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 inline text-amber-500" />
                      <span>يوجد فنيين معينين على هذا البند بتكلفة إجمالية</span>
                    </p>
                  )}
                </div>
              )}
              <p className="text-destructive text-sm">
                هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (itemToDelete) {
                  deleteMutation.mutate(itemToDelete.id);
                  setItemToDelete(null);
                }
              }}
            >
              حذف البند
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Item to Phase Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              نقل البند إلى مرحلة أخرى
            </DialogTitle>
            <DialogDescription>
              {itemToMove && `نقل "${itemToMove.name}" إلى مرحلة أخرى`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اختر المرحلة الهدف</Label>
              <Select
                value={targetPhaseId}
                onValueChange={setTargetPhaseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مرحلة (المشروع الرئيسي)</SelectItem>
                  {projectPhases?.filter(p => p.id !== ((itemToMove as any)?.phase_id || effectivePhaseId)).map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (itemToMove) {
                  moveItemMutation.mutate({
                    itemId: itemToMove.id,
                    newPhaseId: targetPhaseId === "none" ? null : targetPhaseId,
                  });
                }
              }}
              disabled={!targetPhaseId || moveItemMutation.isPending}
            >
              {moveItemMutation.isPending ? "جاري النقل..." : "نقل البند"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Items Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              نقل {selectedItemIds.length} بند
            </DialogTitle>
            <DialogDescription>
              نقل البنود المحددة إلى مرحلة أخرى
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اختر المرحلة الهدف</Label>
              <Select
                value={targetPhaseId}
                onValueChange={setTargetPhaseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مرحلة (المشروع الرئيسي)</SelectItem>
                  {projectPhases?.filter(p => p.id !== effectivePhaseId).map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                bulkMoveItemsMutation.mutate({
                  itemIds: selectedItemIds,
                  newPhaseId: targetPhaseId === "none" ? null : targetPhaseId,
                });
              }}
              disabled={!targetPhaseId || bulkMoveItemsMutation.isPending}
            >
              {bulkMoveItemsMutation.isPending ? "جاري النقل..." : `نقل ${selectedItemIds.length} بند`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Items Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              حذف {selectedItemIds.length} بند
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>هل أنت متأكد من حذف البنود المحددة؟</p>
                <p className="text-destructive text-sm">
                  سيتم حذف جميع الفنيين المعينين على هذه البنود. هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteItemsMutation.mutate(selectedItemIds)}
              disabled={bulkDeleteItemsMutation.isPending}
            >
              {bulkDeleteItemsMutation.isPending ? "جاري الحذف..." : `حذف ${selectedItemIds.length} بند`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </ProjectWorkspaceLayout>
  );
};

export default ProjectItems;
