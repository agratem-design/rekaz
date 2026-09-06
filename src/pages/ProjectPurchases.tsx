import { useState, useMemo, useEffect } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import { ProjectOperationDrawerShell } from "@/components/purchases/ProjectOperationDrawerShell";
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
import { ArrowRight, Plus, Pencil, Trash2, ShoppingCart, FileText, Printer, AlertTriangle, ArrowRightLeft, CheckSquare, X, Wallet, Landmark, Download, Layers, Coins, User, Paperclip } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow, openReceiptPrintWindow, generatePrintStyles, getPrintValues } from "@/lib/printStyles";
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
  paid_amount?: number;
  status: string;
  items: unknown;
  notes: string | null;
  purchase_type?: "material" | "labor" | "rental" | "service" | string;
  title?: string | null;
  phase_id?: string | null;
  invoice_image_url?: string | null;
  project_item_id?: string | null;
  treasury_id?: string | null;
  project_items?: {
    id: string;
    name: string;
  } | null;
  suppliers?: {
    id: string;
    name: string;
  } | null;
  purchase_payments?: Array<{
    id: string;
    amount: number;
    payment_method: string;
    notes?: string | null;
  }>;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activePhaseId = searchParams.get("phase") || phaseId || null;
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
    queryKey: ["project-purchases", projectId, activePhaseId],
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
      
      if (activePhaseId) {
        query = query.eq("phase_id", activePhaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Purchase[];
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

  const handlePrintPurchaseReceipt = (purchase: Purchase) => {
    openReceiptPrintWindow(
      {
        receiptNumber: purchase.invoice_number ? `INV-${purchase.invoice_number}` : `PUR-${purchase.id.slice(0, 8)}`,
        date: purchase.date,
        type: "payment",
        amount: Number(purchase.total_amount),
        paidToOrBy: purchase.suppliers?.name || purchase.title || "المورد",
        description: `فاتورة مشتريات: ${purchase.title || purchase.invoice_number || ''}`,
        projectName: project?.name,
        treasuryName: allTreasuries.find(t => t.id === purchase.treasury_id)?.name,
        notes: purchase.notes || undefined,
      },
      settings
    );
  };

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

  // Validate Phase Ownership: if activePhaseId does not belong to projectId, reset phase query param
  useEffect(() => {
    if (activePhaseId && projectPhases && projectPhases.length > 0) {
      const isValid = projectPhases.some((p) => p.id === activePhaseId);
      if (!isValid) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("phase");
          return next;
        }, { replace: true });
      }
    }
  }, [activePhaseId, projectPhases, setSearchParams]);

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
  // Only sub-treasuries (children) should be selectable, restricted to project sector
  const allParents = useMemo(() => allTreasuriesRaw.filter(t => !(t as any).parent_id), [allTreasuriesRaw]);
  const treasuryParents = useMemo(() => {
    const pType = project?.project_type || "contracting";
    const matched = allParents.filter((t: any) =>
      t.project_category === pType ||
      (pType === "contracting" && (t.name.includes("مقاولات") || t.name.includes("المقاولات"))) ||
      (pType === "finishing" && (t.name.includes("تشطيب") || t.name.includes("التشطيب")))
    );
    return matched.length > 0 ? matched : allParents;
  }, [allParents, project?.project_type]);
  const allTreasuries = useMemo(() => allTreasuriesRaw.filter(t => (t as any).parent_id), [allTreasuriesRaw]);

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
        phase_id: activePhaseId || null,
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
      const { error } = await supabase
        .from("purchase_payments")
        .insert({
          purchase_id: selectedPurchaseForPay.id,
          amount: parseFloat(data.amount),
          date: data.date,
          payment_method: data.payment_method,
          treasury_id: data.treasury_id,
          commission: parseFloat(data.commission) || 0,
          notes: data.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });

      const purchaseSnapshot = selectedPurchaseForPay;
      const treasuryName = allTreasuries.find(t => t.id === variables.treasury_id)?.name;

      toast({
        title: "تم تسجيل الدفعة بنجاح",
        description: `المبلغ: ${formatCurrencyLYD(parseFloat(variables.amount))}`,
        action: (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer font-bold"
            onClick={() => {
              openReceiptPrintWindow(
                {
                  receiptNumber: `PAY-${purchaseSnapshot?.invoice_number || purchaseSnapshot?.id?.slice(0, 8) || Date.now().toString().slice(-6)}`,
                  date: variables.date,
                  type: "payment",
                  amount: parseFloat(variables.amount),
                  paidToOrBy: purchaseSnapshot?.suppliers?.name || purchaseSnapshot?.title || "المورد",
                  description: `سداد دفعة مشتريات: ${purchaseSnapshot?.title || purchaseSnapshot?.invoice_number || ''}`,
                  projectName: project?.name,
                  treasuryName: treasuryName,
                  paymentMethod: variables.payment_method,
                  notes: variables.notes || undefined,
                },
                settings
              );
            }}
          >
            طباعة السند
          </Button>
        ),
      });

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
    let parentId = targetParentId || treasuryParents[0]?.id || "";
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
      project_item_id: "",
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

  const isPurchaseFormDirty = useMemo(() => {
    if (!dialogOpen) return false;
    if (editingPurchase) {
      return (
        formData.title !== (editingPurchase.title || "") ||
        formData.notes !== (editingPurchase.notes || "") ||
        formData.supplier_id !== (editingPurchase.supplier_id || "") ||
        formData.invoice_number !== (editingPurchase.invoice_number || "")
      );
    }
    return (
      (Boolean(formData.title) && formData.title.trim().length > 0) ||
      (Boolean(formData.notes) && formData.notes.trim().length > 0) ||
      (Boolean(formData.supplier_id) && formData.supplier_id.length > 0) ||
      formData.items.some((i) => i.name.trim() !== "" || i.price > 0) ||
      (parseFloat(formData.total_amount_direct) > 0)
    );
  }, [dialogOpen, editingPurchase, formData]);

  const isSavingPurchase = saveMutation.isPending;

  const {
    showConfirmDialog: showPurchaseUnsavedDialog,
    setShowConfirmDialog: setShowPurchaseUnsavedDialog,
    requestAction: requestPurchaseCloseAction,
    confirmDiscard: handleConfirmPurchaseDiscard,
    cancelDiscard: handleCancelPurchaseDiscard,
  } = useUnsavedChangesGuard({
    isDirty: isPurchaseFormDirty,
    isSubmitting: isSavingPurchase,
    onDiscard: () => {
      handleCloseDialog();
    },
  });

  const handlePurchaseDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (isSavingPurchase) return; // Block closing while mutation in-flight
      if (isPurchaseFormDirty) {
        requestPurchaseCloseAction(() => {
          handleCloseDialog();
        });
      } else {
        handleCloseDialog();
      }
    } else {
      setDialogOpen(true);
    }
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
      project_item_id: "",
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
    if (!activePhaseId || !projectPhases) return "";
    const currentPhase = projectPhases.find(p => p.id === activePhaseId);
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
      const isCheck = p.purchase_payments?.some((pay: any) => pay.payment_method === 'check') || (p as any).purchase_type === 'check';
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
  const currentPhase = activePhaseId ? projectPhases?.find(p => p.id === activePhaseId) : null;
  
  // When viewing a specific phase, use its percentage; otherwise aggregate from all phases with percentage
  const phasePercentage = currentPhase?.has_percentage ? Number(currentPhase.percentage_value) : 0;
  
  // Calculate service fee: per-phase when activePhaseId exists, or sum across all purchases by their phase
  const serviceFeeAmount = useMemo(() => {
    // If the project is finishing type, calculate service fee based on project's finishing_percentage directly
    if (project?.project_type === "finishing") {
      const pct = Number((project as any).finishing_percentage || 0);
      return pct > 0 ? (totalPurchases * pct) / 100 : 0;
    }

    if (activePhaseId && phasePercentage > 0) {
      return (totalPurchases * phasePercentage) / 100;
    }
    // No specific phase: calculate per purchase based on its own phase percentage
    if (!purchases || !projectPhases) return 0;
    return purchases.reduce((sum, p) => {
      const pPhase = (p as any).phase_id ? projectPhases.find(ph => ph.id === (p as any).phase_id) : null;
      const pct = pPhase?.has_percentage ? Number(pPhase.percentage_value) : 0;
      return sum + (pct > 0 ? Number(p.total_amount) * pct / 100 : 0);
    }, 0);
  }, [purchases, projectPhases, activePhaseId, phasePercentage, totalPurchases, project]);
  
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
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        {/* Phase Context Banner (if inside a Phase) */}
        {activePhaseId && currentPhase && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">أنت تتصفح حالياً مشتريات مرحلة:</span>
                <span className="font-bold text-foreground mr-1.5">{currentPhase.name}</span>
                <Badge variant="outline" className="text-[10px] mr-2">
                  #{currentPhase.order_index || 1}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer"
                onClick={() => navigate(`/projects/${projectId}/phases/${activePhaseId}`)}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>مساحة عمل المرحلة</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => navigate(`/projects/${projectId}/purchases`)}
              >
                <span>عرض جميع مشتريات المشروع</span>
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {activePhaseId && currentPhase
                ? `مشتريات وخدمات ${currentPhase.name}`
                : "فواتير الخدمات والمشتريات"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {activePhaseId
                ? "فواتير ومشتريات المواد والخدمات المخصصة لهذه المرحلة"
                : "جميع مشتريات وتوريدات المشروع ككل"}
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
                ) : activePhaseId && phasePercentage > 0 ? (
                  <>
                    <p className="text-2xl font-bold">{phasePercentage}%</p>
                    <p className="text-xs text-muted-foreground">{formatCurrencyLYD(serviceFeeAmount)}</p>
                    <p className="text-xs text-primary font-bold">المستحق: {formatCurrencyLYD(totalPurchases + serviceFeeAmount)}</p>
                  </>
                ) : !activePhaseId && allPhasesWithPercentage.length > 0 ? (
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
                    {activeTab === "labor" ? "العامل / العنوان" : "المورد / الجهة"}
                  </TableHead>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">نوع العملية</TableHead>
                  <TableHead className="text-right">التفاصيل / البنود</TableHead>
                  <TableHead className="text-right">بند المقايسة / المرحلة</TableHead>
                  <TableHead className="text-right">المبلغ المتكبد (د.ل)</TableHead>
                  <TableHead className="text-center w-16">المرفق</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => {
                  const isSelected = selectedPurchaseIds.includes(purchase.id);
                  const purchasePhase = purchase.phase_id 
                    ? projectPhases?.find(p => p.id === purchase.phase_id) 
                    : currentPhase;
                  
                  const operationTypeLabel = 
                    purchase.purchase_type === "service" 
                      ? "خدمة" 
                      : (purchase.purchase_type === "labor" ? "عمالة" : "مواد");

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
                      <Badge variant="outline" className="font-medium text-xs">
                        {operationTypeLabel}
                      </Badge>
                    </TableCell>
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
                    <TableCell>
                      {purchase.project_items?.name ? (
                        <Badge variant="secondary" className="text-xs">
                          {purchase.project_items.name}
                        </Badge>
                      ) : purchasePhase?.name ? (
                        <span className="text-xs text-muted-foreground">{purchasePhase.name}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrencyLYD(purchase.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {purchase.invoice_image_url ? (
                        <a 
                          href={purchase.invoice_image_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center justify-center p-1 rounded hover:bg-muted text-primary"
                          title="عرض المرفق"
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintPurchaseReceipt(purchase)}
                          title="طباعة إيصال / سند المشترى"
                          className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenPayDialog(purchase)}
                          title="سداد دفعة / سجل الدفعات"
                          className="cursor-pointer"
                        >
                          <Coins className="h-4 w-4 text-emerald-600" />
                        </Button>
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

      {/* Contextual Operation Drawer Shell */}
      <ProjectOperationDrawerShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId!}
        projectName={project?.name}
        projectType={project?.project_type || "contracting"}
        defaultTreasuryId={project?.default_treasury_id}
        activePhaseId={activePhaseId}
        editingRecord={
          editingPurchase
            ? {
                type: (editingPurchase as any).purchase_type === "labor" ? "labor" : (editingPurchase as any).purchase_type === "service" ? "service" : "material",
                data: editingPurchase,
              }
            : null
        }
      />

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
                  {projectPhases?.filter(p => p.id !== (purchaseToMove?.phase_id || activePhaseId)).map((phase) => (
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
                  {projectPhases?.filter(p => p.id !== activePhaseId).map((phase) => (
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
              <div className="p-3 bg-muted/50 rounded-xl border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">القسم / الخزينة الرئيسية *</Label>
                    <Select
                      value={paySelectedParentTreasuryId}
                      onValueChange={(value) => {
                        setPaySelectedParentTreasuryId(value);
                        setPayFormData(prev => ({ ...prev, treasury_id: "" })); // reset sub
                      }}
                      disabled={treasuryParents.length <= 1}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-10 rounded-xl" dir="rtl">
                        <SelectValue placeholder="اختر الخزينة الرئيسية..." />
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
                    <Label className="text-xs font-semibold">الحساب / الفرع المخصوم منه *</Label>
                    <Select
                      value={payFormData.treasury_id}
                      onValueChange={(value) => setPayFormData(prev => ({ ...prev, treasury_id: value }))}
                      disabled={!paySelectedParentTreasuryId}
                      dir="rtl"
                    >
                      <SelectTrigger className="h-10 rounded-xl" dir="rtl">
                        <SelectValue placeholder={paySelectedParentTreasuryId ? "اختر الحساب / الفرع..." : "حدد الخزينة الرئيسية أولاً"} />
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
    </ProjectWorkspaceLayout>
  );
};

export default ProjectPurchases;
