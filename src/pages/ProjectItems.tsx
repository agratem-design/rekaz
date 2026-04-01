import { useState, useEffect, useMemo, useRef } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { safeEvaluate } from "@/lib/safeFormula";
import { useParams, Link } from "react-router-dom";
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
import { ArrowRight, ArrowLeft, Plus, Pencil, Trash2, Ruler, Square, Box, Download, Package, Search, Filter, User, Calculator, Users, X, Copy, ArrowRightLeft, CheckSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

type MeasurementType = string;

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

const measurementUnits: Record<string, string> = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const ProjectItems = () => {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const queryClient = useQueryClient();
  const inlineDropdownRef = useRef<HTMLDivElement>(null);
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
  const [pendingTechnicians, setPendingTechnicians] = useState<Array<{
    technician_id: string;
    technician_name: string;
    specialty: string | null;
    rate_type: "unit" | "piece" | "fixed";
    rate: number;
    quantity: number;
    piece_qty: number;
    total_cost: number;
  }>>([]);
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

  // Fetch project items with engineer info and technician costs
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["project-items", projectId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("project_items")
        .select(`
          *,
          engineers (id, name, engineer_type),
          measurement_configs (id, name, unit_symbol),
          project_item_technicians (total_cost)
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Calculate technician costs for each item, fix total_price if 0
      return data.map((item: any) => {
        const rawTotal = item.total_price;
        const effectiveTotal = rawTotal || (item.quantity * item.unit_price);
        return {
          ...item,
          total_price: effectiveTotal,
          _raw_total_price: rawTotal,
          technician_cost: item.project_item_technicians?.reduce((sum: number, t: any) => sum + Number(t.total_cost || 0), 0) || 0,
        };
      }) as (ProjectItem & { technician_cost: number; _raw_total_price: number })[];
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
        phase_id: phaseId || null,
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
          name: item.name,
          description: item.description,
          measurement_type: item.measurement_type,
          quantity: customData ? parseFloat(customData.quantity) || 0 : 0,
          unit_price: customData ? parseFloat(customData.unit_price) || item.default_unit_price : item.default_unit_price,
          notes: item.notes,
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
    });
    setInlineSearch("");

    // Fetch existing technicians for this item
    const { data: existingTechs } = await supabase
      .from("project_item_technicians")
      .select("*, technicians(id, name, specialty)")
      .eq("project_item_id", item.id);
    setEditingItemTechnicians(existingTechs || []);
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
    });
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
  const totalNet = totalAmount - totalTechnicianCost;

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
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">فاتورة بنود المقاولات</h1>
          <p className="text-muted-foreground">
            {project.name}
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
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Download className="h-4 w-4 ml-2" />
            استيراد من البنود العامة
          </Button>
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
                  <TableHead className="text-right">تكلفة الفنيين</TableHead>
                  <TableHead className="text-right">الصافي</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items && items.map((item) => {
                  const itemNet = (item.total_price || 0) - (item.technician_cost || 0);
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
                            <Ruler className="h-3 w-3" />
                            {item.measurement_configs?.unit_symbol || measurementUnits[item.measurement_type] || "وحدة"}
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

          {/* Inline Add Section - Outside table to avoid overflow clipping */}
          <div className={`border-t-2 ${editingItem ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-primary/20 bg-muted/30'} rounded-b-lg p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {editingItem ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                <span className="text-sm font-medium text-muted-foreground">
                  {editingItem ? `تعديل البند: ${editingItem.name}` : "إضافة بند جديد"}
                </span>
              </div>
              {editingItem && (
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 ml-1" />
                  إلغاء التعديل
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" style={{ gridAutoFlow: 'row' }}>
              {/* Item Name Search */}
              <div className="lg:col-span-2 relative" ref={inlineDropdownRef}>
                <Label className="text-xs text-muted-foreground mb-1 block">البند</Label>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={inlineSearch || inlineItem.name}
                    onChange={(e) => {
                      setInlineSearch(e.target.value);
                      setInlineItem(prev => ({ ...prev, name: e.target.value, generalItemId: "" }));
                      setInlineDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (inlineSearch) setInlineDropdownOpen(true);
                    }}
                    placeholder="ابحث في البنود العامة أو اكتب اسم بند جديد..."
                    className="border-dashed h-11 text-base"
                  />
                </div>
                {inlineDropdownOpen && inlineSearch && (
                  <div 
                    className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-xl max-h-[300px] overflow-y-auto"
                  >
                    {generalItems
                      ?.filter(gi => 
                        gi.name.toLowerCase().includes(inlineSearch.toLowerCase()) ||
                        gi.category?.toLowerCase().includes(inlineSearch.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((gi) => (
                        <button
                          key={gi.id}
                          className="w-full text-right px-3 py-2.5 hover:bg-accent flex items-center justify-between gap-2 text-sm transition-colors border-b border-border/50 last:border-b-0"
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
                              measurement_factor: "1",
                            }));
                            setInlineSearch("");
                            setInlineDropdownOpen(false);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{gi.name}</p>
                            {gi.category && (
                              <span className="text-xs text-muted-foreground">{gi.category}</span>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">
                            {(() => {
                              const mc = gi.measurement_config_id ? measurementConfigs?.find(c => c.id === gi.measurement_config_id) : null;
                              return mc ? mc.unit_symbol : measurementUnits[gi.measurement_type];
                            })()} - {gi.default_unit_price.toLocaleString()} د.ل
                          </Badge>
                        </button>
                      ))}
                    {generalItems?.filter(gi => 
                      gi.name.toLowerCase().includes(inlineSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        لا توجد نتائج - سيتم إضافة "{inlineSearch}" كبند مخصص
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Item Description */}
              <div className="lg:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">تسمية / وصف البند</Label>
                <Input
                  value={inlineItem.description}
                  onChange={(e) => setInlineItem(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف أو تسمية مخصصة للبند..."
                  className="border-dashed h-11 text-base"
                />
              </div>

              {/* Measurement Components or simple Quantity */}
              {(() => {
                const inlineMeasConfig = inlineItem.measurement_config_id 
                  ? measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id) 
                  : null;
                
                if (inlineMeasConfig && inlineMeasConfig.components.length > 0) {
                  return (
                    <>
                      {inlineMeasConfig.components.map((comp) => (
                        <div key={comp.symbol}>
                          <Label className="text-xs text-muted-foreground mb-1 block">{comp.label} ({comp.symbol})</Label>
                          <Input
                            type="number"
                            value={inlineItem.component_values[comp.symbol] || ""}
                            onChange={(e) => {
                              const newValues = { ...inlineItem.component_values, [comp.symbol]: e.target.value };
                              let calculatedQty = "";
                              if (inlineMeasConfig.formula) {
                                try {
                                  let formula = inlineMeasConfig.formula;
                                  const factor = parseFloat(inlineItem.measurement_factor) || 1;
                                  const itemCount = parseFloat(inlineItem.item_count) || 1;
                                  inlineMeasConfig.components.forEach(c => {
                                    const val = c.symbol === comp.symbol ? parseFloat(e.target.value) || 0 : parseFloat(newValues[c.symbol]) || 0;
                                    formula = formula.replace(new RegExp(c.symbol, 'g'), val.toString());
                                  });
                                   const result = safeEvaluate(formula);
                                  if (result !== null) {
                                    calculatedQty = (result * factor * itemCount).toFixed(4).replace(/\.?0+$/, '');
                                  }
                                } catch { /* ignore */ }
                              }
                              setInlineItem(prev => ({ 
                                ...prev, 
                                component_values: newValues,
                                quantity: calculatedQty || prev.quantity,
                              }));
                            }}
                            placeholder={comp.label}
                            className="border-dashed h-11 text-base"
                          />
                        </div>
                      ))}
                      {/* Item Count */}
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">عدد العناصر</Label>
                        <Input
                          type="number"
                          value={inlineItem.item_count}
                          onChange={(e) => {
                            const newCount = e.target.value;
                            // Recalculate quantity with new item count
                            let calculatedQty = "";
                            if (inlineMeasConfig.formula) {
                              try {
                                let formula = inlineMeasConfig.formula;
                                const factor = parseFloat(inlineItem.measurement_factor) || 1;
                                const itemCount = parseFloat(newCount) || 1;
                                inlineMeasConfig.components.forEach(c => {
                                  const val = parseFloat(inlineItem.component_values[c.symbol]) || 0;
                                  formula = formula.replace(new RegExp(c.symbol, 'g'), val.toString());
                                });
                                const result = safeEvaluate(formula);
                                if (result !== null) {
                                  calculatedQty = (result * factor * itemCount).toFixed(4).replace(/\.?0+$/, '');
                                }
                              } catch { /* ignore */ }
                            }
                            setInlineItem(prev => ({ 
                              ...prev, 
                              item_count: newCount,
                              quantity: calculatedQty || prev.quantity,
                            }));
                          }}
                          placeholder="عدد"
                          className="border-dashed h-11 text-base"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          الكمية الإجمالية ({inlineMeasConfig.unit_symbol})
                        </Label>
                        <Input
                          type="number"
                          value={inlineItem.quantity}
                          readOnly
                          className="h-11 text-base bg-muted/50"
                          placeholder="تحسب تلقائياً"
                        />
                      </div>
                    </>
                  );
                }
                
                return (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">عدد العناصر</Label>
                      <Input
                        type="number"
                        value={inlineItem.item_count}
                        onChange={(e) => setInlineItem(prev => ({ ...prev, item_count: e.target.value }))}
                        placeholder="1"
                        className="border-dashed h-11 text-base"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">الكمية</Label>
                      <Input
                        type="number"
                        value={inlineItem.quantity}
                        onChange={(e) => setInlineItem(prev => ({ ...prev, quantity: e.target.value }))}
                        placeholder="الكمية"
                        className="border-dashed h-11 text-base"
                      />
                    </div>
                  </>
                );
              })()}

              {/* Unit Price */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">سعر الوحدة</Label>
                <Input
                  type="number"
                  value={inlineItem.unit_price}
                  onChange={(e) => setInlineItem(prev => ({ ...prev, unit_price: e.target.value }))}
                  placeholder="السعر"
                  className="border-dashed h-11 text-base"
                />
              </div>

              {/* Engineer */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">المهندس المشرف</Label>
                <Select
                  value={inlineItem.engineer_id || "none"}
                  onValueChange={(value) => setInlineItem(prev => ({ ...prev, engineer_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="h-11 border-dashed">
                    <SelectValue placeholder="اختر مهندس" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="none">بدون مهندس</SelectItem>
                    {engineers?.map((eng) => (
                      <SelectItem key={eng.id} value={eng.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {eng.name}
                          <span className="text-xs text-muted-foreground">({eng.engineer_type})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Technician */}
              <div className={inlineItem.technician_id ? "xl:col-span-3" : ""}>
                <Label className="text-xs text-muted-foreground mb-1 block">{editingItem && editingItemTechnicians.length > 0 ? "إضافة فني جديد" : "الفني"}</Label>
                <div className={`flex gap-2 ${inlineItem.technician_id ? "" : ""}`}>
                  <Select
                    value={inlineItem.technician_id || "none"}
                    onValueChange={(value) => setInlineItem(prev => ({ 
                      ...prev, 
                      technician_id: value === "none" ? "" : value,
                      technician_rate_type: "unit",
                      technician_rate: "",
                    }))}
                  >
                    <SelectTrigger className="h-11 border-dashed">
                      <SelectValue placeholder="اختر فني" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="none">بدون فني</SelectItem>
                      {technicians?.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            {tech.name}
                            {tech.specialty && <span className="text-xs text-muted-foreground">({tech.specialty})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inlineItem.technician_id && (
                    <>
                      <Select
                        value={inlineItem.technician_rate_type}
                        onValueChange={(value: "unit" | "piece" | "fixed") => setInlineItem(prev => ({ ...prev, technician_rate_type: value, technician_rate: "", technician_piece_qty: "1" }))}
                      >
                        <SelectTrigger className="h-11 border-dashed w-[140px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          <SelectItem value="unit">بالوحدة (كالزبون)</SelectItem>
                          <SelectItem value="piece">بالقطعة</SelectItem>
                          <SelectItem value="fixed">مقطوعية</SelectItem>
                        </SelectContent>
                      </Select>
                      {inlineItem.technician_rate_type === "piece" && (
                        <div className="relative shrink-0 w-[100px]">
                          <Input
                            type="number"
                            value={inlineItem.technician_piece_qty}
                            onChange={(e) => setInlineItem(prev => ({ ...prev, technician_piece_qty: e.target.value }))}
                            placeholder="العدد"
                            className="border-dashed h-11 text-base"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">قطعة</span>
                        </div>
                      )}
                      <div className="relative shrink-0 w-[130px]">
                        <Input
                          type="number"
                          value={inlineItem.technician_rate}
                          onChange={(e) => setInlineItem(prev => ({ ...prev, technician_rate: e.target.value }))}
                          placeholder={inlineItem.technician_rate_type === "fixed" ? "المبلغ الكلي" : inlineItem.technician_rate_type === "piece" ? "سعر القطعة" : "سعر الوحدة"}
                          className="border-dashed h-11 text-base"
                        />
                      </div>
                      {/* Technician cost preview */}
                      <div className="flex items-center shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                        {(() => {
                          const techRate = parseFloat(inlineItem.technician_rate) || 0;
                          const qty = parseFloat(inlineItem.quantity) || 0;
                          const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
                          if (inlineItem.technician_rate_type === "fixed") {
                            return <span className="font-semibold text-foreground">{techRate.toLocaleString()} د.ل</span>;
                          } else if (inlineItem.technician_rate_type === "piece") {
                            const total = techRate * pieceQty;
                            return <span className="font-semibold text-foreground">{techRate.toLocaleString()} × {pieceQty} = {total.toLocaleString()} د.ل</span>;
                          } else {
                            const total = techRate * qty;
                            return <span className="font-semibold text-foreground">{techRate.toLocaleString()} × {qty} = {total.toLocaleString()} د.ل</span>;
                          }
                        })()}
                      </div>
                      {/* Add technician to pending list button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-8"
                        onClick={() => {
                          const techRate = parseFloat(inlineItem.technician_rate) || 0;
                          const qty = parseFloat(inlineItem.quantity) || 0;
                          const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
                          const tech = technicians?.find(t => t.id === inlineItem.technician_id);
                          if (!tech || !techRate) {
                            toast({ title: "يرجى اختيار الفني وتحديد السعر", variant: "destructive" });
                            return;
                          }
                          // Check if already added
                          if (pendingTechnicians.some(pt => pt.technician_id === tech.id)) {
                            toast({ title: "هذا الفني مضاف مسبقاً", variant: "destructive" });
                            return;
                          }
                          let totalCost = 0;
                          if (inlineItem.technician_rate_type === "fixed") totalCost = techRate;
                          else if (inlineItem.technician_rate_type === "piece") totalCost = techRate * pieceQty;
                          else totalCost = techRate * qty;

                          setPendingTechnicians(prev => [...prev, {
                            technician_id: tech.id,
                            technician_name: tech.name,
                            specialty: tech.specialty,
                            rate_type: inlineItem.technician_rate_type,
                            rate: techRate,
                            quantity: inlineItem.technician_rate_type === "piece" ? pieceQty : inlineItem.technician_rate_type === "fixed" ? 1 : qty,
                            piece_qty: pieceQty,
                            total_cost: totalCost,
                          }]);
                          // Clear technician fields for next
                          setInlineItem(prev => ({
                            ...prev,
                            technician_id: "",
                            technician_rate: "",
                            technician_rate_type: "unit",
                            technician_piece_qty: "1",
                          }));
                          toast({ title: `تمت إضافة ${tech.name}`, description: "يمكنك إضافة فني آخر" });
                        }}
                      >
                        <Plus className="h-3 w-3 ml-1" />
                        إضافة فني
                      </Button>
                    </>
                  )}
                </div>

                {/* Pending technicians list (not yet saved) */}
                {pendingTechnicians.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">فنيين سيتم إضافتهم</Label>
                    <div className="space-y-1">
                      {pendingTechnicians.map((pt, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
                          <Users className="h-3 w-3 text-primary shrink-0" />
                          <span className="font-medium">{pt.technician_name}</span>
                          {pt.specialty && <span className="text-xs text-muted-foreground">({pt.specialty})</span>}
                          <span className="text-xs text-muted-foreground">
                            {pt.rate_type === "fixed" ? "مقطوعية" : pt.rate_type === "piece" ? "بالقطعة" : "بالوحدة"}
                          </span>
                          <span className="font-semibold text-foreground text-xs mr-auto">{pt.total_cost.toLocaleString()} د.ل</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setPendingTechnicians(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show existing technicians when editing */}
                {editingItem && editingItemTechnicians.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground mb-1 block">الفنيين المعينين حالياً</Label>
                    <div className="space-y-2">
                      {editingItemTechnicians.map((et: any) => (
                        <div key={et.id} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm flex-wrap">
                          <Users className="h-3 w-3 text-primary shrink-0" />
                          <span className="font-medium shrink-0">{et.technicians?.name}</span>
                          <Select
                            value={et.rate_type || "meter"}
                            onValueChange={async (val) => {
                              await supabase.from("project_item_technicians").update({ rate_type: val }).eq("id", et.id);
                              setEditingItemTechnicians(prev => prev.map((t: any) => t.id === et.id ? { ...t, rate_type: val } : t));
                              queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                              <SelectItem value="meter">بالوحدة</SelectItem>
                              <SelectItem value="piece">بالقطعة</SelectItem>
                              <SelectItem value="fixed">مقطوعية</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={et.rate || ""}
                            onChange={(e) => setEditingItemTechnicians(prev => prev.map((t: any) => t.id === et.id ? { ...t, rate: e.target.value } : t))}
                            onBlur={async () => {
                              const rate = Number(et.rate) || 0;
                              const qty = Number(et.quantity) || 0;
                              const totalCost = et.rate_type === "fixed" ? rate : rate * qty;
                              await supabase.from("project_item_technicians").update({ rate, total_cost: totalCost }).eq("id", et.id);
                              setEditingItemTechnicians(prev => prev.map((t: any) => t.id === et.id ? { ...t, total_cost: totalCost } : t));
                              queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                            }}
                            placeholder="السعر"
                            className="h-8 w-[90px] text-xs"
                          />
                          {et.rate_type !== "fixed" && (
                            <Input
                              type="number"
                              value={et.quantity || ""}
                              onChange={(e) => setEditingItemTechnicians(prev => prev.map((t: any) => t.id === et.id ? { ...t, quantity: e.target.value } : t))}
                              onBlur={async () => {
                                const rate = Number(et.rate) || 0;
                                const qty = Number(et.quantity) || 0;
                                const totalCost = rate * qty;
                                await supabase.from("project_item_technicians").update({ quantity: qty, total_cost: totalCost }).eq("id", et.id);
                                setEditingItemTechnicians(prev => prev.map((t: any) => t.id === et.id ? { ...t, total_cost: totalCost } : t));
                                queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                              }}
                              placeholder="الكمية"
                              className="h-8 w-[80px] text-xs"
                            />
                          )}
                          <span className="text-xs text-muted-foreground shrink-0">
                            = {Number(et.total_cost || 0).toLocaleString()} د.ل
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={async () => {
                              await supabase.from("project_item_technicians").delete().eq("id", et.id);
                              setEditingItemTechnicians(prev => prev.filter((t: any) => t.id !== et.id));
                              queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                              toast({ title: "تم", description: "تم حذف الفني" });
                            }}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Total + Add Button */}
              <div className="lg:col-span-2 xl:col-span-4 flex items-end gap-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">الإجمالي:</span>
                  <span className="font-bold text-lg">
                    {(() => {
                      const qty = parseFloat(inlineItem.quantity) || 0;
                      const price = parseFloat(inlineItem.unit_price) || 0;
                      const itemCount = parseFloat(inlineItem.item_count) || 1;
                      // For non-config items, multiply qty by item_count
                      const inlineMC = inlineItem.measurement_config_id ? measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id) : null;
                      const hasConfig = inlineMC && inlineMC.components.length > 0;
                      const finalQty = hasConfig ? qty : qty * itemCount;
                      return (finalQty * price).toLocaleString();
                    })()} د.ل
                  </span>
                </div>
                {editingItem && (
                  <Button variant="outline" onClick={handleCancelEdit} className="gap-1">
                    <X className="h-4 w-4" />
                    إلغاء
                  </Button>
                )}
                <Button
                  disabled={!inlineItem.name.trim() || saveMutation.isPending}
                  onClick={async () => {
                    if (!inlineItem.name.trim()) return;
                    const itemCount = parseFloat(inlineItem.item_count) || 1;
                    const inlineMC = inlineItem.measurement_config_id ? measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id) : null;
                    const hasConfig = inlineMC && inlineMC.components.length > 0;
                    const rawQty = parseFloat(inlineItem.quantity) || 0;
                    const finalQty = hasConfig ? rawQty : rawQty * itemCount;
                    
                    const techId = inlineItem.technician_id;
                    
                    saveMutation.mutate({
                      name: inlineItem.name,
                      description: inlineItem.description,
                      measurement_type: inlineItem.measurement_type,
                      quantity: finalQty.toString(),
                      unit_price: inlineItem.unit_price || "0",
                      engineer_id: inlineItem.engineer_id,
                      formula: "",
                      length: "",
                      width: "",
                      height: "",
                      notes: inlineItem.notes,
                      measurement_factor: inlineItem.measurement_factor,
                      measurement_config_id: inlineItem.measurement_config_id,
                      component_values: inlineItem.component_values,
                    }, {
                      onSuccess: async (insertedItem) => {
                        const itemId = editingItem?.id || insertedItem?.id;
                        if (!itemId) return;

                        // Helper to compute DB fields from rate type
                        const computeTechFields = (rateType: string, rate: number, qty: number, pieceQty: number) => {
                          if (rateType === "piece") return { dbRateType: "piece", dbRate: rate, dbQuantity: pieceQty, dbTotalCost: rate * pieceQty };
                          if (rateType === "fixed") return { dbRateType: "fixed", dbRate: rate, dbQuantity: 1, dbTotalCost: rate };
                          return { dbRateType: "meter", dbRate: rate, dbQuantity: qty, dbTotalCost: rate * qty };
                        };

                        // Collect all technicians to insert: pending list + current field
                        const allTechs = [...pendingTechnicians];
                        const techId = inlineItem.technician_id;
                        const techRate = parseFloat(inlineItem.technician_rate) || 0;
                        if (techId && techRate > 0) {
                          const tech = technicians?.find(t => t.id === techId);
                          const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
                          const { dbTotalCost } = computeTechFields(inlineItem.technician_rate_type, techRate, finalQty, pieceQty);
                          allTechs.push({
                            technician_id: techId,
                            technician_name: tech?.name || "",
                            specialty: tech?.specialty || null,
                            rate_type: inlineItem.technician_rate_type,
                            rate: techRate,
                            quantity: inlineItem.technician_rate_type === "piece" ? pieceQty : inlineItem.technician_rate_type === "fixed" ? 1 : finalQty,
                            piece_qty: pieceQty,
                            total_cost: dbTotalCost,
                          });
                        }

                        // Get existing technicians for this item to avoid duplicates
                        const { data: existingTechs } = await supabase
                          .from("project_item_technicians")
                          .select("technician_id")
                          .eq("project_item_id", itemId);
                        const existingIds = new Set(existingTechs?.map(t => t.technician_id) || []);

                        // Insert all new technicians
                        for (const pt of allTechs) {
                          if (existingIds.has(pt.technician_id)) continue;
                          const { dbRateType, dbRate, dbQuantity, dbTotalCost } = computeTechFields(pt.rate_type, pt.rate, pt.quantity, pt.piece_qty);
                          await supabase.from("project_item_technicians").insert({
                            project_item_id: itemId,
                            technician_id: pt.technician_id,
                            rate_type: dbRateType,
                            rate: dbRate,
                            quantity: dbQuantity,
                            total_cost: dbTotalCost,
                          });
                          existingIds.add(pt.technician_id);

                          // Auto-register full progress when progress tracking is disabled
                          if (!(project as any)?.progress_tracking_enabled) {
                            const itemQty = dbQuantity || 0;
                            if (itemQty > 0) {
                              await supabase.from("technician_progress_records").insert({
                                project_item_id: itemId,
                                technician_id: pt.technician_id,
                                quantity_completed: itemQty,
                                date: new Date().toISOString().split("T")[0],
                                notes: "تسجيل تلقائي - إنجاز كامل",
                              });
                            }
                          }
                        }

                        queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                        setPendingTechnicians([]);
                        setEditingItem(null);
                        setEditingItemTechnicians([]);
                      }
                    });
                    if (!editingItem) {
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
                      });
                      setInlineSearch("");
                    }
                  }}
                  className="gap-1"
                  variant={editingItem ? "default" : "default"}
                >
                  {editingItem ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saveMutation.isPending ? "جاري الحفظ..." : editingItem ? "تحديث البند" : "إضافة"}
                </Button>
              </div>
            </div>
          </div>

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
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Ruler className="h-4 w-4" />
                        {(() => {
                          const mc = item.measurement_config_id ? measurementConfigs?.find(c => c.id === item.measurement_config_id) : null;
                          return mc ? mc.unit_symbol : (measurementUnits[item.measurement_type] || "وحدة");
                        })()}
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
                    <p className="text-orange-600">
                      ⚠️ هذا هو البند الأخير - سيصبح تقدم المشروع <strong>0%</strong>
                    </p>
                  ) : items && items.length > 1 ? (
                    <p>
                      سيتم إعادة حساب تقدم المشروع بناءً على البنود المتبقية ({items.length - 1} بند)
                    </p>
                  ) : null}
                  {(itemToDelete.technician_cost || 0) > 0 && (
                    <p className="text-orange-600">
                      ⚠️ يوجد فنيين معينين على هذا البند بتكلفة إجمالية
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
                  {projectPhases?.filter(p => p.id !== phaseId).map((phase) => (
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
                  {projectPhases?.filter(p => p.id !== phaseId).map((phase) => (
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
  );
};

export default ProjectItems;
