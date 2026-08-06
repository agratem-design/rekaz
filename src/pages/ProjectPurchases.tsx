import { useState, useMemo, useEffect } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Plus, Pencil, Trash2, ShoppingCart, FileText, Printer, AlertTriangle, ArrowRightLeft, CheckSquare, X, Wallet, Landmark, Download, Layers, Coins, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow, generatePrintStyles, getPrintValues } from "@/lib/printStyles";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import html2pdf from "html2pdf.js";
import { getElementLabels } from "@/lib/printLabels";

interface PurchaseItem {
  name: string;
  qty: number;
  price: number;
  unit: string;
}

interface Purchase {
  id: string;
  project_id: string;
  supplier_id: string | null;
  date: string;
  invoice_number: string | null;
  total_amount: number;
  status: string;
  items: unknown;
  notes: string | null;
  purchase_type?: "material" | "labor" | "rental";
  title?: string | null;
  project_item_id?: string | null;
  project_items?: {
    id: string;
    name: string;
  } | null;
  suppliers?: {
    id: string;
    name: string;
  } | null;
}

interface Supplier {
  id: string;
  name: string;
  category: string | null;
}

const statusLabels: Record<string, string> = {
  paid: "مدفوع",
  due: "مستحق",
  partial: "مدفوع جزئياً",
};

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-500",
  due: "bg-red-500/10 text-red-500",
  partial: "bg-yellow-500/10 text-yellow-500",
};


const ProjectPurchases = () => {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forcedPhaseSelectorOpen, setForcedPhaseSelectorOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [purchaseToMove, setPurchaseToMove] = useState<Purchase | null>(null);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [targetPhaseId, setTargetPhaseId] = useState<string>("");
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState<string>("");
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [activeTab, setActiveTab] = useState<"material" | "labor">("material");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedPurchaseForPay, setSelectedPurchaseForPay] = useState<Purchase | null>(null);
  const [payFormData, setPayFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    commission: "",
    notes: "",
  });
  const [paySelectedParentTreasuryId, setPaySelectedParentTreasuryId] = useState<string>("");
  const [formData, setFormData] = useState({
    supplier_id: "",
    project_item_id: "",
    date: new Date().toISOString().split("T")[0],
    invoice_number: "",
    paid_amount: "",
    notes: "",
    items: [{ name: "", qty: 1, price: 0, unit: "" }] as PurchaseItem[],
    treasury_id: "",
    commission: "",
    purchase_type: "material" as "material" | "labor" | "rental",
    title: "",
    total_amount_direct: "0",
  });
  const [selectedLaborType, setSelectedLaborType] = useState<"station" | "registered">("station");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>("");
  
  // Fetch project items for linking purchases
  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items-for-purchases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select("id, name, phase_id")
        .eq("project_id", projectId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch purchases
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["project-purchases", projectId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("purchases")
        .select(`
          *,
          suppliers (id, name),
          project_items (id, name),
          treasuries (id, name, treasury_type),
          purchase_payments (id, amount, payment_method, notes)
        `)
        .eq("project_id", projectId!)
        .order("date", { ascending: true });
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!projectId,
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, category")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Fetch technicians
  const { data: technicians } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, specialty")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch company settings for printing
  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const companySettings = settings;

  // (Custody query removed - all purchases now go through treasury)

  // Fetch project phases for move dialog (with treasury info)
  const { data: projectPhases } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, order_index, treasury_id, has_percentage, percentage_value")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    setForcedPhaseSelectorOpen(false);
  }, []);

  // Fetch all active treasuries (with parent info)
  const { data: allTreasuriesRaw = [] } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  // Only sub-treasuries (children) should be selectable
  const treasuryParents = allTreasuriesRaw.filter(t => !(t as any).parent_id);
  const allTreasuries = allTreasuriesRaw.filter(t => (t as any).parent_id);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const isLabor = data.purchase_type === "labor";
      const totalAmount = (isLabor || data.total_amount_direct) 
        ? parseFloat(data.total_amount_direct) || 0
        : data.items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const paidAmount = parseFloat(data.paid_amount) || 0;
      const commission = parseFloat(data.commission) || 0;
      
      // Auto-calculate status
      let status: "due" | "paid" | "partial" = "due";
      if (paidAmount >= totalAmount && totalAmount > 0) {
        status = "paid";
      } else if (paidAmount > 0) {
        status = "partial";
      }
      
      const payload = {
        project_id: projectId!,
        phase_id: phaseId || null,
        project_item_id: data.project_item_id || null,
        supplier_id: isLabor ? null : (data.supplier_id || null),
        technician_id: isLabor && selectedLaborType === "registered" ? (selectedTechnicianId || null) : null,
        date: data.date,
        invoice_number: data.invoice_number || null,
        status,
        notes: data.notes || null,
        items: isLabor 
          ? [] 
          : JSON.parse(JSON.stringify(data.items.filter(item => item.name.trim()))),
        total_amount: totalAmount,
        paid_amount: paidAmount,
        fund_source: "treasury" as const,
        custody_id: null,
        treasury_id: data.treasury_id || null,
        commission,
        purchase_type: data.purchase_type,
        title: data.title || null,
      };

      if (editingPurchase) {
        const { error } = await supabase
          .from("purchases")
          .update(payload as any)
          .eq("id", editingPurchase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("purchases").insert([payload as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({
        title: editingPurchase ? "تم تحديث المشترى" : "تم إضافة المشترى",
        description: editingPurchase
          ? "تم تحديث بيانات المشترى بنجاح"
          : "تم إضافة المشترى بنجاح",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ المشترى",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      // Delete related client payment allocations (not handled by DB trigger)
      await supabase
        .from("client_payment_allocations")
        .delete()
        .eq("reference_id", purchaseId);

      // Delete the purchase
      // DB trigger (handle_purchase_deletion) automatically:
      // - Deletes related treasury transactions
      // - Recalculates treasury balance
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم حذف المشترى",
        description: "تم حذف المشترى وإرجاع الرصيد للخزينة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المشترى",
        variant: "destructive",
      });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (data: typeof payFormData) => {
      if (!selectedPurchaseForPay) return;
      const { data: insertedPay, error } = await supabase
        .from("purchase_payments")
        .insert({
          purchase_id: selectedPurchaseForPay.id,
          amount: parseFloat(data.amount),
          date: data.date,
          payment_method: data.payment_method,
          treasury_id: data.treasury_id,
          commission: parseFloat(data.commission) || 0,
          notes: data.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (data.treasury_id && insertedPay) {
        const partyName = selectedPurchaseForPay.suppliers?.name || selectedPurchaseForPay.technicians?.name || selectedPurchaseForPay.title || "مشتريات";
        await supabase.from("treasury_transactions").insert({
          treasury_id: data.treasury_id,
          type: "withdrawal",
          amount: parseFloat(data.amount),
          balance_after: 0,
          description: `سداد مدفوعات: ${partyName}`,
          date: data.date,
          source: "purchase_payments",
          reference_type: "purchase_payment",
          reference_id: insertedPay.id,
          notes: data.notes || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم تسجيل الدفعة بنجاح" });
      setPayDialogOpen(false);
      setPayFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        treasury_id: "",
        commission: "",
        notes: "",
      });
      setPaySelectedParentTreasuryId("");
      setSelectedPurchaseForPay(null);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تسجيل الدفعة",
        variant: "destructive",
      });
    },
  });

  const handleOpenPayDialog = (purchase: Purchase) => {
    setSelectedPurchaseForPay(purchase);
    // Suggest the remaining balance
    const remaining = Number(purchase.total_amount) - Number((purchase as any).paid_amount || 0);
    
    // Auto-select parent treasury based on project type
    const isFinishing = project?.project_type === "finishing";
    const targetParentId = isFinishing
      ? (companySettings as any)?.finishing_treasury_id || ""
      : (companySettings as any)?.contracting_treasury_id || "";

    const purchaseTreasuryId = (purchase as any).treasury_id || "";
    let parentId = targetParentId || "";
    let subTreasuryId = "";

    if (purchaseTreasuryId) {
      const isParent = treasuryParents.find(t => t.id === purchaseTreasuryId);
      if (isParent) {
        // If it's a parent, check if it matches targetParentId
        parentId = purchaseTreasuryId === targetParentId ? purchaseTreasuryId : (targetParentId || purchaseTreasuryId);
      } else {
        const childTreasury = allTreasuries.find(t => t.id === purchaseTreasuryId);
        if (childTreasury) {
          const childParentId = (childTreasury as any).parent_id || "";
          if (childParentId === targetParentId) {
            parentId = childParentId;
            subTreasuryId = purchaseTreasuryId;
          }
        }
      }
    }

    // If subTreasuryId is still empty, pre-select the first child of parentId
    if (!subTreasuryId && parentId) {
      const firstChild = allTreasuries.find(t => (t as any).parent_id === parentId);
      if (firstChild) {
        subTreasuryId = firstChild.id;
      }
    }
    
    setPayFormData({
      amount: String(remaining > 0 ? remaining : ""),
      date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      treasury_id: subTreasuryId,
      commission: "",
      notes: "",
    });
    setPaySelectedParentTreasuryId(parentId);
    setPayDialogOpen(true);
  };

  // Move purchase to another phase mutation
  const movePurchaseMutation = useMutation({
    mutationFn: async ({ purchaseId, newPhaseId }: { purchaseId: string; newPhaseId: string | null }) => {
      const { error } = await supabase
        .from("purchases")
        .update({ phase_id: newPhaseId })
        .eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم نقل المشترى",
        description: "تم نقل المشترى إلى المرحلة الجديدة بنجاح",
      });
      setMoveDialogOpen(false);
      setPurchaseToMove(null);
      setTargetPhaseId("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نقل المشترى",
        variant: "destructive",
      });
    },
  });

  // Bulk move purchases mutation
  const bulkMovePurchasesMutation = useMutation({
    mutationFn: async ({ purchaseIds, newPhaseId }: { purchaseIds: string[]; newPhaseId: string | null }) => {
      const { error } = await supabase
        .from("purchases")
        .update({ phase_id: newPhaseId })
        .in("id", purchaseIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم نقل المشتريات",
        description: `تم نقل ${selectedPurchaseIds.length} مشترى إلى المرحلة الجديدة بنجاح`,
      });
      setBulkMoveDialogOpen(false);
      setSelectedPurchaseIds([]);
      setTargetPhaseId("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نقل المشتريات",
        variant: "destructive",
      });
    },
  });

  // Bulk delete purchases mutation
  const bulkDeletePurchasesMutation = useMutation({
    mutationFn: async (purchaseIds: string[]) => {
      // Delete related client payment allocations (not handled by DB trigger)
      await supabase
        .from("client_payment_allocations")
        .delete()
        .in("reference_id", purchaseIds);

      // Delete purchases one by one to trigger handle_purchase_deletion for each
      // which automatically cleans up treasury transactions and recalculates balance
      for (const pid of purchaseIds) {
        const { error } = await supabase.from("purchases").delete().eq("id", pid);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({
        title: "تم حذف المشتريات",
        description: `تم حذف ${selectedPurchaseIds.length} مشترى وإرجاع الأرصدة بنجاح`,
      });
      setBulkDeleteDialogOpen(false);
      setSelectedPurchaseIds([]);
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المشتريات",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPurchase(null);
    
    const defaultParentId = (project as any)?.default_treasury_id || 
      (project?.project_type === "contracting" ? (companySettings as any)?.contracting_treasury_id : (companySettings as any)?.finishing_treasury_id) || "";
    
    const defaultSubTreasuryId = defaultParentId 
      ? allTreasuriesRaw.find(t => (t as any).parent_id === defaultParentId)?.id || "" 
      : "";

    setFormData({
      supplier_id: "",
      date: new Date().toISOString().split("T")[0],
      invoice_number: "",
      paid_amount: "",
      notes: "",
      items: [{ name: "", qty: 1, price: 0, unit: "" }],
      treasury_id: defaultSubTreasuryId,
      commission: "",
      purchase_type: "material",
      title: "",
      total_amount_direct: "0",
    });
    setSelectedLaborType("station");
    setSelectedTechnicianId("");
    setSelectedParentTreasuryId(defaultParentId);
  };

  const handleOpenNewPurchase = () => {
    setEditingPurchase(null);
    
    const defaultParentId = (project as any)?.default_treasury_id || 
      (project?.project_type === "contracting" ? (companySettings as any)?.contracting_treasury_id : (companySettings as any)?.finishing_treasury_id) || "";
    
    const defaultSubTreasuryId = defaultParentId 
      ? allTreasuriesRaw.find(t => (t as any).parent_id === defaultParentId)?.id || "" 
      : "";

    setFormData({
      supplier_id: "",
      date: new Date().toISOString().split("T")[0],
      invoice_number: "",
      paid_amount: "",
      notes: "",
      items: [{ name: "", qty: 1, price: 0, unit: "" }],
      treasury_id: defaultSubTreasuryId,
      commission: "",
      purchase_type: "material",
      title: "",
      total_amount_direct: "0",
    });
    setSelectedLaborType("station");
    setSelectedTechnicianId("");
    setSelectedParentTreasuryId(defaultParentId);
    setDialogOpen(true);
  };

  // Check if current phase has a linked treasury (to make parent read-only)
  const phaseLinkedTreasuryId = (() => {
    if (!phaseId || !projectPhases) return "";
    const currentPhase = projectPhases.find(p => p.id === phaseId);
    return currentPhase?.treasury_id || "";
  })();

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    const pType = (purchase as any).purchase_type || "material";
    const isLabor = pType === "labor";
    const techId = (purchase as any).technician_id;
    if (techId) {
      setSelectedLaborType("registered");
      setSelectedTechnicianId(techId);
    } else {
      setSelectedLaborType("station");
      setSelectedTechnicianId("");
    }
    setFormData({
      supplier_id: purchase.supplier_id || "",
      project_item_id: (purchase as any).project_item_id || "",
      date: purchase.date,
      invoice_number: purchase.invoice_number || "",
      paid_amount: String((purchase as any).paid_amount || 0),
      notes: purchase.notes || "",
      items: Array.isArray(purchase.items) && purchase.items.length > 0
        ? (purchase.items as any[]).map((item: any) => ({ ...item, unit: item.unit || "" }))
        : [{ name: "", qty: 1, price: 0, unit: "" }],
      treasury_id: (purchase as any).treasury_id || "",
      commission: String((purchase as any).commission || 0),
      purchase_type: pType,
      title: (purchase as any).title || "",
      total_amount_direct: isLabor ? String(purchase.total_amount || "") : "",
    });
    // Set parent treasury for the two-step selection
    const treasuryId = (purchase as any).treasury_id;
    if (treasuryId) {
      const childTreasury = allTreasuries.find(t => t.id === treasuryId);
      if (childTreasury) {
        setSelectedParentTreasuryId((childTreasury as any).parent_id || "");
      }
    }
    setDialogOpen(true);
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { name: "", qty: 1, price: 0, unit: "" }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const buildPrintableEl = (innerHtml: string): HTMLDivElement => {
    const v = getPrintValues(settings);
    const wrapper = document.createElement("div");
    wrapper.dir = "rtl";
    wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;height:297mm;background-color:#fff;box-sizing:border-box;";
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      ${generatePrintStyles(settings)}
      .print-area {
        position: relative !important;
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        height: 100% !important;
        background-size: 100% 100% !important;
      }
    `;
    wrapper.appendChild(styleEl);
    const inner = document.createElement("div");
    inner.innerHTML = innerHtml;
    wrapper.appendChild(inner);
    return wrapper;
  };

  const printViaCanvas = async (html: string, title: string) => {
    const el = buildPrintableEl(html);
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 200));
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, scrollY: 0 });
    document.body.removeChild(el);
    const dataUrl = canvas.toDataURL("image/png");
    
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const totalPages = Math.ceil(imgHeight / pageHeight);

    let pagesHtml = "";
    for (let i = 0; i < totalPages; i++) {
      const topOffset = -(i * pageHeight);
      pagesHtml += `
        <div class="page-container">
          <img src="${dataUrl}" style="top: ${topOffset}mm;" />
        </div>
      `;
    }

    const win = window.open("", "_blank", "width=900,height=750");
    if (!win) {
      toast({ title: "تعذّر الطباعة", description: "يرجى السماح بالنوافذ المنبثقة", variant: "destructive" });
      return;
    }
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{background:#e8e8e8;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:'Tajawal',sans-serif}
      .toolbar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:999;background:rgba(0,0,0,.65);padding:10px 20px;border-radius:50px;backdrop-filter:blur(8px)}
      button{padding:10px 22px;border:none;border-radius:50px;cursor:pointer;font-size:13px;font-family:'Tajawal',sans-serif;font-weight:bold;color:#fff;transition:all .2s}
      .btn-print{background:#2563eb}.btn-print:hover{background:#1d4ed8}
      .btn-close{background:#64748b}.btn-close:hover{background:#475569}
      .page-container{width:210mm;height:297mm;overflow:hidden;position:relative;background:#fff;page-break-after:always;break-after:page;box-shadow:0 4px 24px rgba(0,0,0,.15);border-radius:4px;margin-top:68px}
      .page-container:first-of-type{margin-top:68px}
      .page-container+ .page-container{margin-top:20px}
      .page-container img{position:absolute;left:0;width:210mm;height:auto;display:block}
      @media print{
        @page{size:A4;margin:0}
        .toolbar{display:none!important}
        body{background:#fff;padding:0}
        .page-container{margin:0!important;box-shadow:none!important;border-radius:0!important;page-break-after:always!important;break-after:page!important}
      }
    </style></head><body>
      <div class="toolbar">
        <button class="btn-print" onclick="window.print()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 6px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>طباعة
        </button>
        <button class="btn-close" onclick="window.close()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 6px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>إغلاق
        </button>
      </div>
      ${pagesHtml}
    </body></html>`);
    win.document.close();
  };

  const savePdfViaCanvas = async (html: string, filename: string) => {
    setIsPdfLoading(true);
    try {
      const el = buildPrintableEl(html);
      document.body.appendChild(el);
      await new Promise(r => setTimeout(r, 200));
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollY: 0 });
      document.body.removeChild(el);
      
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
      pdf.save(filename);
      toast({ title: "تم حفظ الملف بنجاح" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "فشل حفظ الملف", variant: "destructive" });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handlePrintProjectInvoice = async (mode: 'client' | 'company') => {
    if (!purchases || purchases.length === 0) return;

    // Fetch project serial number to generate a sequential invoice number
    let projectSerial = 1;
    if (project?.created_at) {
      const { count: prCount, error: prErr } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("project_type", "finishing")
        .lte("created_at", project.created_at);
      if (!prErr && prCount) {
        projectSerial = prCount;
      }
    }
    const projectYear = new Date(project?.created_at || new Date()).getFullYear();
    const invoiceNumber = `F-${projectYear}-${String(projectSerial).padStart(4, '0')}`;

    // Separate purchases into cash and check
    const cashTransactions: any[] = [];
    const checkTransactions: any[] = [];

    purchases.forEach((p) => {
      const isCheck = p.purchase_payments?.some((pay: any) => pay.payment_method === 'check') || p.purchase_type === 'check';
      const itemData = {
        description: p.notes || p.title || "مشتريات خدمات ومواد",
        supplier: p.suppliers?.name || "غير محدد",
        invoice_number: p.invoice_number || "-",
        amount: Number(p.total_amount || 0)
      };

      if (isCheck) {
        checkTransactions.push(itemData);
      } else {
        cashTransactions.push(itemData);
      }
    });

    const totalCash = cashTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCheck = checkTransactions.reduce((sum, t) => sum + t.amount, 0);
    const subtotal = totalCash + totalCheck;

    const commissionPercent = Number((project as any)?.finishing_percentage || 0);
    const commissionAmount = (subtotal * commissionPercent) / 100;
    const isClient = mode === 'client';
    const grandTotal = isClient ? subtotal + commissionAmount : subtotal;

    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });

    const htmlContent = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 25px; color: #333; max-width: 210mm; margin: 0 auto; background: #fff;">
        <!-- Scraped Header Metadata -->
        <div class="print-report-header" style="display: none;">
          <div class="print-report-title">فاتورة التشطيب (${isClient ? 'عميل' : 'شركة'})</div>
          <div class="print-report-subtitle">رقم الفاتورة: ${invoiceNumber} &nbsp;|&nbsp; التاريخ: ${dateStr}</div>
          <div class="print-report-meta">الزبون: ${project?.clients?.name || "غير محدد"} &nbsp;|&nbsp; المشروع: ${project?.name || "غير محدد"}</div>
        </div>

        <!-- Summary Table (Unified summary box) -->
        <div style="display: flex; justify-content: center; margin-bottom: 20px;">
          <table class="print-table" style="width: 60%;">
            <thead>
              <tr>
                <th style="width: 40%; text-align: center;">القيمة</th>
                <th style="width: 60%; text-align: right;">البيان</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(totalCash)}</td>
                <td style="font-weight: bold; text-align: right;">إجمالي المدفوع نقداً</td>
              </tr>
              <tr>
                <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(totalCheck)}</td>
                <td style="font-weight: bold; text-align: right;">إجمالي المدفوع بصك</td>
              </tr>
              <tr style="font-weight: bold;">
                <td style="text-align: center;">${formatCurrencyLYD(subtotal)}</td>
                <td style="text-align: right;">الإجمالي قبل أتعاب الشركة</td>
              </tr>
              ${isClient && commissionPercent > 0 ? `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(commissionAmount)}</td>
                  <td style="font-weight: bold; text-align: right;">أتعاب الشركة في الإشراف وتوفير المواد (${commissionPercent}%)</td>
                </tr>
                <tr style="font-weight: bold; font-size: 11pt;">
                  <td style="text-align: center;">${formatCurrencyLYD(grandTotal)}</td>
                  <td style="text-align: right;">إجمالي الفاتورة المستحق</td>
                </tr>
              ` : `
                <tr style="font-weight: bold; font-size: 11pt;">
                  <td style="text-align: center;">${formatCurrencyLYD(grandTotal)}</td>
                  <td style="text-align: right;">إجمالي مصروفات المشروع</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Cash Table -->
        ${cashTransactions.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 class="print-section-title">الفواتير المسددة نقداً</h3>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 6%; text-align: center;">ر.م</th>
                  <th style="text-align: right;">البند</th>
                  <th style="width: 22%; text-align: center;">المورد/العامل</th>
                  <th style="width: 14%; text-align: center;">رقم الفاتورة</th>
                  <th style="width: 16%; text-align: center;">القيمة</th>
                </tr>
              </thead>
              <tbody>
                ${cashTransactions.map((t, idx) => `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: right; font-weight: 500;">${t.description}</td>
                    <td style="text-align: center;">${t.supplier}</td>
                    <td style="text-align: center;">${t.invoice_number}</td>
                    <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(t.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: bold;">إجمالي الفواتير المسددة نقداً</td>
                  <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(totalCash)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ` : ''}

        <!-- Check Table -->
        ${checkTransactions.length > 0 ? `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <h3 class="print-section-title">الفواتير المسددة بصك</h3>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 6%; text-align: center;">ر.م</th>
                  <th style="text-align: right;">البند</th>
                  <th style="width: 22%; text-align: center;">المورد/العامل</th>
                  <th style="width: 14%; text-align: center;">رقم الفاتورة</th>
                  <th style="width: 16%; text-align: center;">القيمة</th>
                </tr>
              </thead>
              <tbody>
                ${checkTransactions.map((t, idx) => `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: right; font-weight: 500;">${t.description}</td>
                    <td style="text-align: center;">${t.supplier}</td>
                    <td style="text-align: center;">${t.invoice_number}</td>
                    <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(t.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: bold;">إجمالي الفواتير المسددة بصك</td>
                  <td style="text-align: center; font-weight: bold;">${formatCurrencyLYD(totalCheck)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ` : ''}

      </div>
    `;

    openPrintWindow("فاتورة التشطيب", htmlContent, settings);
  };

  const handleSubmit = () => {
    const isLabor = formData.purchase_type === "labor";
    const isSimplified = !!formData.total_amount_direct;

    if (isLabor) {
      if (!formData.title) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال اسم العامل أو الفريق في حقل العنوان",
          variant: "destructive",
        });
        return;
      }
      if (!formData.total_amount_direct || parseFloat(formData.total_amount_direct) <= 0) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال مبلغ الفاتورة الإجمالي",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!formData.supplier_id) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار المورد",
          variant: "destructive",
        });
        return;
      }
      if (!isSimplified && !formData.items.some(item => item.name.trim())) {
        toast({
          title: "خطأ",
          description: "يرجى إضافة بند واحد على الأقل أو إدخال القيمة الإجمالية مباشرة",
          variant: "destructive",
        });
        return;
      }
      if (isSimplified && parseFloat(formData.total_amount_direct) <= 0) {
        toast({
          title: "خطأ",
          description: "يرجى إدخال القيمة الإجمالية للفاتورة",
          variant: "destructive",
        });
        return;
      }
    }

    const totalAmount = (isLabor || isSimplified)
      ? parseFloat(formData.total_amount_direct) || 0
      : formData.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const paidAmount = parseFloat(formData.paid_amount) || 0;

    if (paidAmount < 0) {
      toast({
        title: "خطأ",
        description: "القيمة المسددة لا يمكن أن تكون سالبة",
        variant: "destructive",
      });
      return;
    }

    if (paidAmount > totalAmount) {
      toast({
        title: "خطأ",
        description: "القيمة المسددة لا يمكن أن تتجاوز إجمالي الفاتورة",
        variant: "destructive",
      });
      return;
    }
    
    // Validate treasury selection
    if (!formData.treasury_id) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الخزينة",
        variant: "destructive",
      });
      return;
    }
    
    const commissionAmount = parseFloat(formData.commission) || 0;
    const totalDeduction = paidAmount + commissionAmount;
    
    if (totalDeduction > 0) {
      const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
      if (!selectedTreasury || totalDeduction > (selectedTreasury.balance || 0)) {
        toast({
          title: "خطأ",
          description: `رصيد الخزينة غير كافٍ. المطلوب: ${formatCurrencyLYD(totalDeduction)} - المتاح: ${formatCurrencyLYD(selectedTreasury?.balance || 0)}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    saveMutation.mutate(formData);
  };

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter(p => {
      const type = (p as any).purchase_type || "material";
      if (activeTab === "labor") {
        return type === "labor";
      }
      return type === "material" || type === "rental";
    });
  }, [purchases, activeTab]);

  const totalPurchases = purchases?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0;
  const paidPurchases = purchases?.reduce((sum, p) => sum + Number((p as any).paid_amount || 0), 0) || 0;
  const totalCommission = purchases?.reduce((sum, p) => sum + Number((p as any).commission || 0), 0) || 0;
  
  
  // Get phase percentage for service fee calculation
  const currentPhase = phaseId ? projectPhases?.find(p => p.id === phaseId) : null;
  
  // When viewing a specific phase, use its percentage; otherwise aggregate from all phases with percentage
  const phasePercentage = currentPhase?.has_percentage ? Number(currentPhase.percentage_value) : 0;
  
  // Calculate service fee: per-phase when phaseId exists, or sum across all purchases by their phase
  const serviceFeeAmount = useMemo(() => {
    // If the project is finishing type, calculate service fee based on project's finishing_percentage directly
    if (project?.project_type === "finishing") {
      const pct = Number((project as any).finishing_percentage || 0);
      return pct > 0 ? (totalPurchases * pct) / 100 : 0;
    }

    if (phaseId && phasePercentage > 0) {
      return (totalPurchases * phasePercentage) / 100;
    }
    // No specific phase: calculate per purchase based on its own phase percentage
    if (!purchases || !projectPhases) return 0;
    return purchases.reduce((sum, p) => {
      const pPhase = (p as any).phase_id ? projectPhases.find(ph => ph.id === (p as any).phase_id) : null;
      const pct = pPhase?.has_percentage ? Number(pPhase.percentage_value) : 0;
      return sum + (pct > 0 ? Number(p.total_amount) * pct / 100 : 0);
    }, 0);
  }, [purchases, projectPhases, phaseId, phasePercentage, totalPurchases, project]);
  
  // For the stats card: show aggregated percentage info when no specific phase
  const allPhasesWithPercentage = useMemo(() => {
    if (!projectPhases) return [];
    return projectPhases.filter(p => p.has_percentage && Number(p.percentage_value) > 0);
  }, [projectPhases]);

  // Collect unique units from all existing purchases for suggestions
  const usedUnits = useMemo(() => {
    const units = new Set<string>();
    // Default common units
    ["قطعة", "متر", "متر مربع", "متر مكعب", "كيلو", "طن", "لتر", "كرتون", "علبة", "كيس"].forEach(u => units.add(u));
    // Units from existing purchases
    purchases?.forEach((p) => {
      if (Array.isArray(p.items)) {
        (p.items as any[]).forEach((item: any) => {
          if (item.unit && typeof item.unit === "string" && item.unit.trim()) {
            units.add(item.unit.trim());
          }
        });
      }
    });
    return Array.from(units);
  }, [purchases]);

  if (projectLoading || purchasesLoading) {
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">فواتير الخدمات والمشتريات</h1>
          <p className="text-muted-foreground">
            {project.name} - العميل: {project.clients?.name || "غير محدد"}
          </p>
        </div>
        {(() => {
          const isWarningBudget = project.budget_type === 'warning' || project.budget_type === 'fixed';
          const budget = Number(project.budget) || 0;
          const totalPurch = purchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
          const isBudgetExceeded = isWarningBudget && budget > 0 && totalPurch >= budget;
          
          return (
            <div className="flex items-center gap-3 relative">
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setPrintMenuOpen(!printMenuOpen)}
                  className="gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  طباعة الفاتورة
                </Button>
                {printMenuOpen && (
                  <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-popover border border-border z-50 p-1 space-y-1">
                    <button
                      className="w-full text-right px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer text-foreground"
                      onClick={() => {
                        setPrintMenuOpen(false);
                        handlePrintProjectInvoice('client');
                      }}
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      نسخة العميل
                    </button>
                    <button
                      className="w-full text-right px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer text-foreground"
                      onClick={() => {
                        setPrintMenuOpen(false);
                        handlePrintProjectInvoice('company');
                      }}
                    >
                      <Printer className="h-4 w-4 text-muted-foreground" />
                      نسخة الشركة
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <Button onClick={handleOpenNewPurchase} disabled={isBudgetExceeded}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة مشترى
                </Button>
                {isBudgetExceeded && (
                  <p className="text-xs text-destructive mt-1">تم تجاوز الميزانية - لا يمكن إضافة مشتريات</p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
                <p className="text-2xl font-bold">{purchases?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(totalPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المدفوع</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(paidPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Wallet className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نسبة الخدمات / التشطيب</p>
                {project?.project_type === "finishing" ? (
                  <>
                    <p className="text-2xl font-bold">{project.finishing_percentage || 0}%</p>
                    <p className="text-xs text-muted-foreground">{formatCurrencyLYD(serviceFeeAmount)}</p>
                    <p className="text-xs text-primary font-bold">المستحق: {formatCurrencyLYD(totalPurchases + serviceFeeAmount)}</p>
                  </>
                ) : phaseId && phasePercentage > 0 ? (
                  <>
                    <p className="text-2xl font-bold">{phasePercentage}%</p>
                    <p className="text-xs text-muted-foreground">{formatCurrencyLYD(serviceFeeAmount)}</p>
                    <p className="text-xs text-primary font-bold">المستحق: {formatCurrencyLYD(totalPurchases + serviceFeeAmount)}</p>
                  </>
                ) : !phaseId && allPhasesWithPercentage.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold">{formatCurrencyLYD(serviceFeeAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {allPhasesWithPercentage.map(p => `${p.name}: ${p.percentage_value}%`).join(" | ")}
                    </p>
                    <p className="text-xs text-primary font-bold">المستحق: {formatCurrencyLYD(totalPurchases + serviceFeeAmount)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-muted-foreground">غير محددة</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {totalCommission > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي العمولات البنكية</p>
                  <p className="text-2xl font-bold">{formatCurrencyLYD(totalCommission)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tab Selector */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as "material" | "labor");
        setSelectedPurchaseIds([]);
      }} className="w-full" dir="rtl">
        <TabsList className="grid w-[400px] grid-cols-2">
          <TabsTrigger value="material">مشتريات مواد وخدمات</TabsTrigger>
          <TabsTrigger value="labor">فواتير العمالة واليوميات</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Purchases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {activeTab === "labor" ? "سجلات العمالة واليوميات" : "قائمة المشتريات والمواد"}
          </CardTitle>
          {selectedPurchaseIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                تم تحديد {selectedPurchaseIds.length} فاتورة
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
                onClick={() => setSelectedPurchaseIds([])}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredPurchases && filteredPurchases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredPurchases.length > 0 && selectedPurchaseIds.length === filteredPurchases.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPurchaseIds(filteredPurchases.map(p => p.id));
                        } else {
                          setSelectedPurchaseIds([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    {activeTab === "labor" ? "العامل / العنوان" : "المورد"}
                  </TableHead>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">التفاصيل / البنود</TableHead>
                   <TableHead className="text-right">المبلغ</TableHead>
                   <TableHead className="text-right">طريقة الدفع</TableHead>
                   <TableHead className="text-right">العمولة</TableHead>
                   <TableHead className="text-right">نسبة الخدمات</TableHead>
                   <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => {
                  const isSelected = selectedPurchaseIds.includes(purchase.id);
                  return (
                  <TableRow key={purchase.id} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPurchaseIds(prev => [...prev, purchase.id]);
                          } else {
                            setSelectedPurchaseIds(prev => prev.filter(id => id !== purchase.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {activeTab === "labor" ? (
                        <span className="font-bold text-foreground">
                          {purchase.title || "يومية عمالة"}
                        </span>
                      ) : purchase.suppliers ? (
                        <Link 
                          to={`/suppliers/${purchase.suppliers.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {purchase.suppliers.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-foreground">{purchase.title || "مورد غير محدد"}</span>
                      )}
                    </TableCell>
                    <TableCell>{purchase.invoice_number || "-"}</TableCell>
                    <TableCell>{purchase.date}</TableCell>
                    <TableCell>
                      {activeTab === "labor" ? (
                        <span className="text-xs text-muted-foreground">
                          {purchase.notes || "يومية عمالة - قيمة إجمالية"}
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {Array.isArray(purchase.items) && purchase.items.length > 0 ? (
                            <>
                              {purchase.items.slice(0, 2).map((item: any, idx) => (
                                <div key={idx} className="text-sm">
                                  {item.name} ({item.qty}{item.unit ? ` ${item.unit}` : ""} × {formatCurrencyLYD(item.price)})
                                </div>
                              ))}
                              {purchase.items.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{purchase.items.length - 2} أخرى
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{purchase.title || "فاتورة إجمالية مبسطة"}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrencyLYD(purchase.total_amount)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const treasury = (purchase as any).treasuries;
                        if (!treasury) return <span className="text-muted-foreground">-</span>;
                        const isCash = treasury.treasury_type === "cash";
                        return (
                          <Badge variant="outline" className={isCash ? "border-primary/30 text-primary" : "border-muted-foreground/30"}>
                            {isCash ? (
                              <><Wallet className="h-3 w-3 ml-1" />نقدي</>
                            ) : (
                              <><Landmark className="h-3 w-3 ml-1" />بنكي</>
                            )}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {Number((purchase as any).commission) > 0 ? (
                        <span className="font-medium">{formatCurrencyLYD(Number((purchase as any).commission))}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const purchasePhase = (purchase as any).phase_id 
                          ? projectPhases?.find(p => p.id === (purchase as any).phase_id) 
                          : currentPhase;
                        const pct = purchasePhase?.has_percentage ? Number(purchasePhase.percentage_value) : 0;
                        if (pct > 0) {
                          const feeValue = Number(purchase.total_amount) * pct / 100;
                          const totalDue = Number(purchase.total_amount) + feeValue;
                          return (
                            <div>
                              <span className="font-medium">{pct}%</span>
                              <span className="text-xs text-muted-foreground block">{formatCurrencyLYD(feeValue)}</span>
                              <span className="text-xs text-primary font-bold block">المستحق: {formatCurrencyLYD(totalDue)}</span>
                            </div>
                          );
                        }
                        return <span className="text-muted-foreground">-</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[purchase.status]}>
                        {statusLabels[purchase.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPurchaseToMove(purchase);
                            setTargetPhaseId("");
                            setMoveDialogOpen(true);
                          }}
                          title="نقل إلى مرحلة أخرى"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        {purchase.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPayDialog(purchase)}
                            title="تسجيل دفعة مالية للمورد/العامل"
                            className="cursor-pointer"
                          >
                            <Coins className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(purchase)}
                          title="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(purchase.id)}
                          title="حذف"
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مشتريات مضافة</p>
              <p className="text-sm">اضغط على "إضافة مشترى" لبدء إضافة مشتريات المشروع</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forced Phase Selector Dialog */}
      <Dialog open={forcedPhaseSelectorOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button]:hidden" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Layers className="h-5 w-5 text-primary animate-pulse" />
              الرجاء اختيار مرحلة لعرض مشترياتها
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              يجب اختيار مرحلة معينة لعرض وإضافة المشتريات الخاصة بها.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 pt-4">
            {!projectPhases ? (
              <div className="py-4 text-center text-muted-foreground text-sm">جاري تحميل المراحل...</div>
            ) : projectPhases.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-sm font-semibold mb-3">لا توجد مراحل مضافة لهذا المشروع بعد.</p>
                <Button 
                  onClick={() => {
                    setForcedPhaseSelectorOpen(false);
                    navigate(`/projects/${projectId}/phases`);
                  }}
                  className="w-full cursor-pointer"
                >
                  الذهاب لإنشاء مرحلة
                </Button>
              </div>
            ) : (
              <>
                {projectPhases.map((phase) => (
                  <Button
                    key={phase.id}
                    variant="outline"
                    className="w-full justify-start text-right h-12 text-sm font-semibold hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                      navigate(`/projects/${projectId}/phases/${phase.id}/purchases`);
                    }}
                  >
                    <Layers className="h-4 w-4 ml-2 text-primary shrink-0" />
                    <span>{phase.name}</span>
                  </Button>
                ))}
                
                <div className="border-t border-border my-2 pt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 h-10 text-xs cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                    }}
                  >
                    عرض كل المشتريات
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 h-10 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                      navigate(`/projects/${projectId}/phases`);
                    }}
                  >
                    العودة لصفحة المراحل
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? "تعديل الفاتورة" : "إضافة فاتورة جديدة"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 1. Purchase Type Selector */}
            <div className="space-y-2">
              <Label>نوع الفاتورة</Label>
              <Select
                value={formData.purchase_type}
                onValueChange={(value: "material" | "labor") => {
                  setFormData((prev) => ({
                    ...prev,
                    purchase_type: value,
                    total_amount_direct: value === "material" ? "0" : "",
                    title: "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="material">مشتريات مواد وخدمات</SelectItem>
                  <SelectItem value="labor">فواتير عمالة ويوميات</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formData.purchase_type === "labor" ? (
                <div className="space-y-4 col-span-2">
                  {/* Selector for worker type */}
                  <div className="space-y-2">
                    <Label>مصدر العمالة</Label>
                    <Select
                      value={selectedLaborType}
                      onValueChange={(val: "station" | "registered") => {
                        setSelectedLaborType(val);
                        setFormData((prev) => ({ ...prev, title: "" }));
                        setSelectedTechnicianId("");
                      }}
                    >
                      <SelectTrigger dir="rtl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="station">عامل من محطة العمال (يومية/خارجي)</SelectItem>
                        <SelectItem value="registered">فني/عامل مسجل في النظام</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLaborType === "registered" ? (
                    <div className="space-y-2">
                      <Label>اختر الفني / العامل *</Label>
                      <Select
                        value={selectedTechnicianId}
                        onValueChange={(value) => {
                          setSelectedTechnicianId(value);
                          const tech = technicians?.find((t) => t.id === value);
                          if (tech) {
                            const specLabel = tech.specialty ? ` (${tech.specialty})` : "";
                            setFormData((prev) => ({
                              ...prev,
                              title: `${tech.name}${specLabel}`,
                            }));
                          }
                        }}
                      >
                        <SelectTrigger dir="rtl">
                          <SelectValue placeholder="اختر الفني المسجل" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          {technicians?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} {t.specialty ? `(${t.specialty})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>اسم العامل / الفريق / الوصف *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="مثال: عمال السباكة - دفعة إنجاز، أو اسم فني محدد"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>المورد *</Label>
                    <Select
                      value={formData.supplier_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, supplier_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المورد" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} {supplier.category && `(${supplier.category})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الفاتورة</Label>
                    <Input
                      value={formData.invoice_number}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, invoice_number: e.target.value }))
                      }
                      placeholder="أدخل رقم الفاتورة"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>بند المقاولة المرتبط (اختياري)</Label>
              <Select
                value={formData.project_item_id || "none"}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, project_item_id: val === "none" ? "" : val }))}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر بند المقاولة المرتبط بالفاتورة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="none">بدون ربط ببند مقاولة معين</SelectItem>
                  {projectItems?.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.purchase_type === "material" && (
              <div className="space-y-2">
                <Label>طريقة إدخال الفاتورة</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="material_input_mode"
                      checked={!formData.total_amount_direct}
                      onChange={() => setFormData(prev => ({ ...prev, total_amount_direct: "" }))}
                      className="cursor-pointer"
                    />
                    فاتورة تفصيلية (بالبنود)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="material_input_mode"
                      checked={!!formData.total_amount_direct}
                      onChange={() => setFormData(prev => ({ ...prev, total_amount_direct: "0" }))}
                      className="cursor-pointer"
                    />
                    فاتورة إجمالية مبسطة (قيمة فقط)
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>القيمة المسددة *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.paid_amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, paid_amount: e.target.value }))
                  }
                  placeholder="أدخل المبلغ المسدد"
                />
                {(() => {
                  const isLabor = formData.purchase_type === "labor";
                  const isSimplified = !!formData.total_amount_direct;
                  const totalAmount = (isLabor || isSimplified)
                    ? parseFloat(formData.total_amount_direct) || 0
                    : formData.items.reduce((sum, item) => sum + item.qty * item.price, 0);
                  const paidAmount = parseFloat(formData.paid_amount) || 0;
                  if (totalAmount > 0 && paidAmount >= totalAmount) {
                    return <p className="text-xs text-green-600">مدفوع بالكامل</p>;
                  } else if (paidAmount > 0) {
                    return <p className="text-xs text-yellow-600">مدفوع جزئياً ({formatCurrencyLYD(totalAmount - paidAmount)} متبقي)</p>;
                  } else if (totalAmount > 0) {
                    return <p className="text-xs text-destructive">مستحق</p>;
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Direct Total Amount input for labor / simplified */}
            {(formData.purchase_type === "labor" || !!formData.total_amount_direct) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>القيمة الإجمالية للفاتورة (د.ل) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.total_amount_direct}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, total_amount_direct: e.target.value }))
                    }
                    placeholder="أدخل إجمالي قيمة الفاتورة"
                  />
                </div>
                {formData.purchase_type === "material" && (
                  <div className="space-y-2 col-span-2">
                    <Label>عنوان الفاتورة المبسطة / البيان</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="مثال: فاتورة توريد مواد صحية وكهربائية"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Detailed Items Section — Only for material purchases in detailed mode */}
            {formData.purchase_type === "material" && !formData.total_amount_direct && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>بنود الفاتورة</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة بند
                  </Button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="اسم البند"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                        className="flex-1"
                      />
                      <div className="relative w-28">
                        <Input
                          placeholder="الوحدة"
                          value={item.unit || ""}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          list={`unit-suggestions-${index}`}
                        />
                        <datalist id={`unit-suggestions-${index}`}>
                          {usedUnits.map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                      </div>
                      <Input
                        type="number"
                        placeholder="الكمية"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, "qty", parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Input
                        type="number"
                        placeholder="السعر"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <span className="text-sm font-medium w-24 text-left">
                        {formatCurrencyLYD(item.qty * item.price)}
                      </span>
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end border-t pt-2">
                  <span className="font-bold">
                    الإجمالي: {formatCurrencyLYD(formData.items.reduce((sum, item) => sum + item.qty * item.price, 0))}
                  </span>
                </div>
              </div>
            )}

            {/* Treasury Selection Section */}
            {/* Treasury Selection Section */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-primary" />
                الخزينة المخصوم منها (الفرع) *
              </Label>
              <Select
                value={formData.treasury_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, treasury_id: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر فرع الخزينة المخصوم منه" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {treasuryParents.map((parent) => {
                    const children = allTreasuries.filter(c => (c as any).parent_id === parent.id);
                    if (children.length === 0) return null;
                    return (
                      <SelectGroup key={parent.id}>
                        <SelectLabel className="font-bold text-primary border-b border-border/40 pb-1 mb-1 mt-2 text-xs flex items-center gap-1">
                          <Wallet className="h-3.5 w-3.5 text-primary inline" /> {parent.name}
                        </SelectLabel>
                        {children.map((child) => (
                          <SelectItem key={child.id} value={child.id} className="pr-6">
                            <span className="flex items-center gap-2">
                              {(child as any).treasury_type === "bank" ? (
                                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              {child.name} (الرصيد: {formatCurrencyLYD(child.balance || 0)})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Treasury balance warning */}
              {formData.treasury_id && (() => {
                const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
                const paidAmount = parseFloat(formData.paid_amount) || 0;
                const commissionAmt = parseFloat(formData.commission) || 0;
                const totalDeduction = paidAmount + commissionAmt;
                if (selectedTreasury) {
                  return (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        الرصيد المتاح: <span className="font-bold">{formatCurrencyLYD(selectedTreasury.balance || 0)}</span>
                      </p>
                      {totalDeduction > (selectedTreasury.balance || 0) && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            رصيد الخزينة غير كافٍ! المطلوب: {formatCurrencyLYD(totalDeduction)} - المتاح: {formatCurrencyLYD(selectedTreasury.balance || 0)}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Commission field for bank treasuries */}
              {formData.treasury_id && (() => {
                const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
                if (selectedTreasury && (selectedTreasury as any).treasury_type === "bank") {
                  return (
                    <div className="space-y-2">
                      <Label>عمولة التحويل</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.commission}
                        onChange={(e) => setFormData((prev) => ({ ...prev, commission: e.target.value }))}
                        placeholder="أدخل عمولة التحويل البنكي"
                      />
                      {parseFloat(formData.commission) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          سيتم خصم {formatCurrencyLYD(parseFloat(formData.commission))} كعمولة تحويل إضافة للمبلغ المسدد
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* No treasuries warning */}
              {allTreasuries.length === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    لا توجد خزائن نشطة. يرجى إضافة خزينة أولاً من صفحة الخزائن.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="أدخل أي ملاحظات إضافية"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Purchase to Phase Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              نقل المشترى إلى مرحلة أخرى
            </DialogTitle>
            <DialogDescription>
              {purchaseToMove && `نقل فاتورة ${purchaseToMove.invoice_number || purchaseToMove.id.slice(0, 8)} إلى مرحلة أخرى`}
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
                if (purchaseToMove) {
                  movePurchaseMutation.mutate({
                    purchaseId: purchaseToMove.id,
                    newPhaseId: targetPhaseId === "none" ? null : targetPhaseId,
                  });
                }
              }}
              disabled={!targetPhaseId || movePurchaseMutation.isPending}
            >
              {movePurchaseMutation.isPending ? "جاري النقل..." : "نقل المشترى"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Purchases Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              نقل {selectedPurchaseIds.length} مشترى
            </DialogTitle>
            <DialogDescription>
              نقل المشتريات المحددة إلى مرحلة أخرى
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
                bulkMovePurchasesMutation.mutate({
                  purchaseIds: selectedPurchaseIds,
                  newPhaseId: targetPhaseId === "none" ? null : targetPhaseId,
                });
              }}
              disabled={!targetPhaseId || bulkMovePurchasesMutation.isPending}
            >
              {bulkMovePurchasesMutation.isPending ? "جاري النقل..." : `نقل ${selectedPurchaseIds.length} مشترى`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Purchases Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              حذف {selectedPurchaseIds.length} مشترى
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>هل أنت متأكد من حذف المشتريات المحددة؟</p>
                <p className="text-destructive text-sm">
                  هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeletePurchasesMutation.mutate(selectedPurchaseIds)}
              disabled={bulkDeletePurchasesMutation.isPending}
            >
              {bulkDeletePurchasesMutation.isPending ? "جاري الحذف..." : `حذف ${selectedPurchaseIds.length} مشترى`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pay Purchase Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة مالية للمورد / العامل</DialogTitle>
            <DialogDescription className="text-right text-xs">
              تسجيل سداد نقدي أو بنكي للفاتورة رقم: {selectedPurchaseForPay?.invoice_number || "غير محدد"} - {selectedPurchaseForPay?.title || selectedPurchaseForPay?.suppliers?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4" dir="rtl">
            <div className="space-y-2">
              <Label>مبلغ الدفعة *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payFormData.amount}
                onChange={(e) => setPayFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="أدخل مبلغ الدفعة"
              />
              <p className="text-xs text-muted-foreground">
                المتبقي الإجمالي للفاتورة: {formatCurrencyLYD(
                  Number(selectedPurchaseForPay?.total_amount || 0) - Number(selectedPurchaseForPay?.paid_amount || 0)
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={payFormData.date}
                  onChange={(e) => setPayFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select
                  value={payFormData.payment_method}
                  onValueChange={(value) => setPayFormData(prev => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="check">شيك مصرفي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Treasury Selection (Double Dropdown) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">الخزينة المسحوب منها *</Label>
              <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>الخزينة الرئيسية</Label>
                    <Select
                      value={paySelectedParentTreasuryId}
                      onValueChange={(value) => {
                        setPaySelectedParentTreasuryId(value);
                        setPayFormData(prev => ({ ...prev, treasury_id: "" })); // reset sub
                      }}
                      disabled={true}
                    >
                      <SelectTrigger dir="rtl">
                        <SelectValue placeholder="اختر الخزينة الرئيسية" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {treasuryParents.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الخزينة الفرعية</Label>
                    <Select
                      value={payFormData.treasury_id}
                      onValueChange={(value) => setPayFormData(prev => ({ ...prev, treasury_id: value }))}
                      disabled={!paySelectedParentTreasuryId}
                    >
                      <SelectTrigger dir="rtl">
                        <SelectValue placeholder="اختر الخزينة الفرعية" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {allTreasuries
                          .filter(t => (t as any).parent_id === paySelectedParentTreasuryId)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} (المتاح: {formatCurrencyLYD(t.balance || 0)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>عمولة بنكية / إضافية (اختياري)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payFormData.commission}
                onChange={(e) => setPayFormData(prev => ({ ...prev, commission: e.target.value }))}
                placeholder="أدخل قيمة العمولة إن وجدت"
              />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات الدفعة</Label>
              <Textarea
                value={payFormData.notes}
                onChange={(e) => setPayFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="ملاحظات أو تفاصيل السداد..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={payMutation.isPending}
              onClick={() => {
                if (!payFormData.amount || parseFloat(payFormData.amount) <= 0) {
                  toast({ title: "خطأ", description: "يرجى إدخال مبلغ دفعة صحيح", variant: "destructive" });
                  return;
                }
                if (!payFormData.treasury_id) {
                  toast({ title: "خطأ", description: "يرجى اختيار الخزينة الفرعية", variant: "destructive" });
                  return;
                }
                payMutation.mutate(payFormData);
              }}
            >
              {payMutation.isPending ? "جاري الحفظ..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectPurchases;
