import { useState, useEffect } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRight, Pencil, Trash2, RotateCcw, AlertTriangle, Printer, ImageIcon, Check, Wrench, Download, Layers } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrencyLYD } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";
import { ar } from "date-fns/locale";
import { openPrintWindow, generatePrintStyles, getPrintValues } from "@/lib/printStyles";
import { getElementLabels } from "@/lib/printLabels";
import html2pdf from "html2pdf.js";

interface EquipmentRental {
  id: string;
  equipment_id: string;
  project_id: string | null;
  start_date: string;
  end_date: string | null;
  daily_rate: number;
  total_amount: number;
  status: string;
  damage_notes: string | null;
  damage_cost: number;
  notes: string | null;
  fund_source?: string | null;
  custody_id?: string | null;
  equipment?: {
    id: string;
    name: string;
    category: string | null;
    current_condition: string;
    image_url: string | null;
  };
}

interface RentalFormData {
  equipment_id: string;
  start_date: string;
  end_date: string;
  daily_rate: number;
  status: string;
  damage_notes: string;
  damage_cost: number;
  notes: string;
  fund_source: string;
  custody_id: string;
}

const statusOptions = [
  { value: "active", label: "نشط", color: "bg-blue-500" },
  { value: "returned", label: "مُرجع", color: "bg-green-500" },
  { value: "damaged", label: "متضرر", color: "bg-red-500" },
];

const fundSourceOptions = [
  { value: "treasury", label: "من الخزينة" },
  { value: "client", label: "من الزبون" },
  { value: "custody", label: "من العهدة" },
];

const ProjectEquipmentRentals = () => {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePhaseId = searchParams.get("phase") || phaseId || null;
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [forcedPhaseSelectorOpen, setForcedPhaseSelectorOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [editingRental, setEditingRental] = useState<EquipmentRental | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<RentalFormData>({
    equipment_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    daily_rate: 0,
    status: "active",
    damage_notes: "",
    damage_cost: 0,
    notes: "",
    fund_source: "treasury",
    custody_id: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name)")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch project phases for forced selection dialog
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

  const { data: companySettings } = useQuery({
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

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["project-equipment-rentals", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select(`
          *,
          equipment:equipment_id (
            id,
            name,
            category,
            current_condition,
            image_url
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EquipmentRental[];
    },
  });

  // Get available equipment (not currently rented or owned equipment)
  const { data: availableEquipment = [] } = useQuery({
    queryKey: ["available-equipment"],
    queryFn: async () => {
      // Get all equipment
      const { data: allEquipment, error: eqError } = await supabase
        .from("equipment")
        .select("*")
        .in("current_condition", ["good", "fair"])
        .order("name");
      if (eqError) throw eqError;

      // Get actively rented equipment
      const { data: activeRentals, error: rentalsError } = await supabase
        .from("equipment_rentals")
        .select("equipment_id")
        .eq("status", "active");
      if (rentalsError) throw rentalsError;

      const rentedIds = new Set(activeRentals?.map((r) => r.equipment_id));

      // Filter out rented equipment (except if editing the same rental)
      return allEquipment?.filter(
        (eq) => !rentedIds.has(eq.id) || eq.id === editingRental?.equipment_id
      ) || [];
    },
  });

  // Fetch active custody records for this project
  const { data: projectCustody = [] } = useQuery({
    queryKey: ["project-custody-active", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_custody")
        .select(`
          id,
          amount,
          spent_amount,
          remaining_amount,
          holder_type,
          engineer:engineers(name),
          employee:employees(name)
        `)
        .eq("project_id", projectId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const calculateTotal = (startDate: string, endDate: string, dailyRate: number) => {
    if (!startDate || !endDate) return 0;
    const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    return days > 0 ? days * dailyRate : 0;
  };

  const createMutation = useMutation({
    mutationFn: async (data: RentalFormData) => {
      const totalAmount = calculateTotal(data.start_date, data.end_date, data.daily_rate);
      const equipment = availableEquipment.find(eq => eq.id === data.equipment_id);
      
      // Create the rental first
      const { data: rentalData, error: rentalError } = await supabase
        .from("equipment_rentals")
        .insert([{
          equipment_id: data.equipment_id,
          project_id: projectId,
          start_date: data.start_date,
          end_date: data.end_date || null,
          daily_rate: data.daily_rate,
          total_amount: totalAmount,
          status: data.status,
          damage_notes: data.damage_notes || null,
          damage_cost: data.damage_cost,
          notes: data.notes || null,
          fund_source: data.fund_source as "custody" | "client" | "treasury",
          custody_id: data.fund_source === "custody" && data.custody_id ? data.custody_id : null,
        }])
        .select()
        .single();
      
      if (rentalError) throw rentalError;
      
      // Create purchase record linked to rental
      const daysCount = data.end_date 
        ? differenceInDays(parseISO(data.end_date), parseISO(data.start_date)) + 1 
        : 1;
      
      const purchaseItems = [{
        name: `إيجار معدة: ${equipment?.name || 'معدة'}`,
        qty: daysCount,
        price: data.daily_rate,
      }];
      
      const { error: purchaseError } = await supabase
        .from("purchases")
        .insert([{
          project_id: projectId,
          rental_id: rentalData.id,
          date: data.start_date,
          invoice_number: `إيجار-${rentalData.id.substring(0, 8)}`,
          status: "due" as const,
          notes: `إيجار معدة: ${equipment?.name || ''} - ${data.notes || ''}`.trim(),
          items: purchaseItems,
          total_amount: totalAmount,
          fund_source: data.fund_source as "custody" | "client" | "treasury",
          custody_id: data.fund_source === "custody" && data.custody_id ? data.custody_id : null,
        }]);
      
      if (purchaseError) throw purchaseError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-rentals", projectId] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      toast({ title: "تم إضافة الإيجار وإنشاء فاتورة المشتريات بنجاح" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RentalFormData }) => {
      const totalAmount = calculateTotal(data.start_date, data.end_date, data.daily_rate);
      const equipment = availableEquipment.find(eq => eq.id === data.equipment_id);
      
      // Update the rental
      const { error } = await supabase
        .from("equipment_rentals")
        .update({
          equipment_id: data.equipment_id,
          start_date: data.start_date,
          end_date: data.end_date || null,
          daily_rate: data.daily_rate,
          total_amount: totalAmount,
          status: data.status,
          damage_notes: data.damage_notes || null,
          damage_cost: data.damage_cost,
          notes: data.notes || null,
          fund_source: data.fund_source as "custody" | "client" | "treasury",
          custody_id: data.fund_source === "custody" && data.custody_id ? data.custody_id : null,
        })
        .eq("id", id);
      if (error) throw error;
      
      // Update linked purchase
      const daysCount = data.end_date 
        ? differenceInDays(parseISO(data.end_date), parseISO(data.start_date)) + 1 
        : 1;
      
      const purchaseItems = [{
        name: `إيجار معدة: ${equipment?.name || 'معدة'}`,
        qty: daysCount,
        price: data.daily_rate,
      }];
      
      const { error: purchaseError } = await supabase
        .from("purchases")
        .update({
          date: data.start_date,
          notes: `إيجار معدة: ${equipment?.name || ''} - ${data.notes || ''}`.trim(),
          items: purchaseItems,
          total_amount: totalAmount,
          fund_source: data.fund_source as "custody" | "client" | "treasury",
          custody_id: data.fund_source === "custody" && data.custody_id ? data.custody_id : null,
        })
        .eq("rental_id", id);
      
      if (purchaseError) throw purchaseError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-rentals", projectId] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      toast({ title: "تم تحديث الإيجار والمشتريات المرتبطة بنجاح" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete linked purchase first
      const { error: purchaseError } = await supabase
        .from("purchases")
        .delete()
        .eq("rental_id", id);
      if (purchaseError) throw purchaseError;
      
      // Then delete the rental
      const { error } = await supabase.from("equipment_rentals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-rentals", projectId] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      toast({ title: "تم حذف الإيجار والمشتريات المرتبطة بنجاح" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const returnEquipmentMutation = useMutation({
    mutationFn: async (rental: EquipmentRental) => {
      const endDate = new Date().toISOString().split("T")[0];
      const totalAmount = calculateTotal(rental.start_date, endDate, rental.daily_rate);
      
      // Update rental
      const { error } = await supabase
        .from("equipment_rentals")
        .update({
          end_date: endDate,
          total_amount: totalAmount,
          status: "returned",
        })
        .eq("id", rental.id);
      if (error) throw error;
      
      // Update linked purchase
      const daysCount = differenceInDays(parseISO(endDate), parseISO(rental.start_date)) + 1;
      
      const purchaseItems = [{
        name: `إيجار معدة: ${rental.equipment?.name || 'معدة'}`,
        qty: daysCount,
        price: rental.daily_rate,
      }];
      
      const { error: purchaseError } = await supabase
        .from("purchases")
        .update({
          items: purchaseItems,
          total_amount: totalAmount,
          status: "paid" as const,
        })
        .eq("rental_id", rental.id);
      
      if (purchaseError) throw purchaseError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-rentals", projectId] });
      queryClient.invalidateQueries({ queryKey: ["available-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      toast({ title: "تم إرجاع المعدة وتحديث المشتريات بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRental(null);
    setFormData({
      equipment_id: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      daily_rate: 0,
      status: "active",
      damage_notes: "",
      damage_cost: 0,
      notes: "",
      fund_source: "treasury",
      custody_id: "",
    });
  };

  const handleEdit = (rental: EquipmentRental) => {
    setEditingRental(rental);
    setFormData({
      equipment_id: rental.equipment_id,
      start_date: rental.start_date,
      end_date: rental.end_date || "",
      daily_rate: rental.daily_rate,
      status: rental.status,
      damage_notes: rental.damage_notes || "",
      damage_cost: rental.damage_cost,
      notes: rental.notes || "",
      fund_source: (rental as any).fund_source || "treasury",
      custody_id: (rental as any).custody_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    const eq = availableEquipment.find((e) => e.id === equipmentId);
    setFormData({
      ...formData,
      equipment_id: equipmentId,
      daily_rate: eq?.daily_rental_rate || 0,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipment_id) {
      toast({ title: "خطأ", description: "يجب اختيار المعدة", variant: "destructive" });
      return;
    }

    if (editingRental) {
      updateMutation.mutate({ id: editingRental.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    const opt = statusOptions.find((o) => o.value === status);
    if (!opt) return null;
    return (
      <Badge variant={status === "active" ? "default" : status === "returned" ? "secondary" : "destructive"}>
        {opt.label}
      </Badge>
    );
  };

  const totalRentalCost = rentals.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
  const totalDamageCost = rentals.reduce((sum, r) => sum + Number(r.damage_cost || 0), 0);

  const buildPrintableEl = (innerHtml: string): HTMLDivElement => {
    const wrapper = document.createElement("div");
    wrapper.dir = "rtl";
    wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;height:297mm;background-color:#fff;box-sizing:border-box;";
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      ${generatePrintStyles(companySettings)}
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

  const buildInvoiceHTML = () => {
    const today = format(new Date(), "dd/MM/yyyy");
    const statusLabels: Record<string, string> = {
      active: "نشط",
      returned: "مُرجع",
      damaged: "متضرر",
    };
    const pl = getElementLabels(companySettings?.print_labels, "equipment_rentals");

    return `
      <div class="print-area">
        <div class="print-content">
          <div class="print-section">
            <h2 class="print-section-title">${pl.title}</h2>
            <table class="print-info-table">
              <tr>
                <td class="info-label">المشروع</td>
                <td class="info-value">${project?.name || "-"}</td>
                <td class="info-label">العميل</td>
                <td class="info-value">${(project as any)?.clients?.name || "-"}</td>
              </tr>
              <tr>
                <td class="info-label">تاريخ الفاتورة</td>
                <td class="info-value">${today}</td>
                <td class="info-label">الموقع</td>
                <td class="info-value">${project?.location || "-"}</td>
              </tr>
            </table>
          </div>

          <div class="print-section">
            <h3 class="print-section-title">تفاصيل الإيجارات</h3>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">${pl.col_number}</th>
                  <th style="width: 30%;">${pl.col_equipment}</th>
                  <th style="width: 13%; text-align: center;">${pl.col_start_date}</th>
                  <th style="width: 13%; text-align: center;">${pl.col_end_date}</th>
                  <th style="width: 7%; text-align: center;">${pl.col_days}</th>
                  <th style="width: 10%; text-align: center;">${pl.col_daily_rate}</th>
                  <th style="width: 12%; text-align: center;">${pl.col_total}</th>
                  <th style="width: 10%; text-align: center;">${pl.col_status}</th>
                </tr>
              </thead>
              <tbody>
                ${rentals.map((rental, index) => {
                  const days = rental.end_date 
                    ? differenceInDays(parseISO(rental.end_date), parseISO(rental.start_date)) + 1 
                    : "-";
                  return `
                    <tr>
                      <td style="text-align: center">${index + 1}</td>
                      <td>${rental.equipment?.name || "غير معروف"}</td>
                      <td style="text-align: center">${format(parseISO(rental.start_date), "dd/MM/yyyy")}</td>
                      <td style="text-align: center">${rental.end_date ? format(parseISO(rental.end_date), "dd/MM/yyyy") : "-"}</td>
                      <td style="text-align: center">${days}</td>
                      <td style="text-align: center">${formatCurrencyLYD(rental.daily_rate)}</td>
                      <td style="text-align: center">${formatCurrencyLYD(rental.total_amount)}</td>
                      <td style="text-align: center">${statusLabels[rental.status] || rental.status}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" style="text-align: left">${pl.rental_total_label}</td>
                  <td colspan="2" style="text-align: center">${formatCurrencyLYD(totalRentalCost)}</td>
                </tr>
                ${totalDamageCost > 0 && pl.show_damage_section ? `
                  <tr>
                    <td colspan="6" style="text-align: left">${pl.damage_total_label}</td>
                    <td colspan="2" style="text-align: center">${formatCurrencyLYD(totalDamageCost)}</td>
                  </tr>
                  <tr>
                    <td colspan="6" style="text-align: left; font-size: 14pt;">${pl.grand_total_label}</td>
                    <td colspan="2" style="text-align: center; font-size: 14pt;">${formatCurrencyLYD(totalRentalCost + totalDamageCost)}</td>
                  </tr>
                ` : ""}
              </tfoot>
            </table>
          </div>

          <div class="total-box">
            <div class="label">${pl.total_due_label}</div>
            <div class="value">${formatCurrencyLYD(totalRentalCost + totalDamageCost)}</div>
          </div>
        </div>

        <div class="print-footer">
          <span>${companySettings?.company_name || ""}</span>
          <span class="print-date">تاريخ الطباعة: ${today}</span>
        </div>
      </div>
    `;
  };

  const handlePrintInvoice = () => {
    const pl = getElementLabels(companySettings?.print_labels, "equipment_rentals");
    const clientName = (project as any)?.clients?.name || "عميل";
    const projectName = project?.name || "مشروع";
    const dateStr = format(new Date(), "dd-MM-yyyy");
    const windowTitle = `${pl.title} - ${clientName} - ${projectName} - تاريخ ${dateStr}`;
    printViaCanvas(buildInvoiceHTML(), windowTitle);
  };

  const handleSaveInvoicePdf = () => {
    const pl = getElementLabels(companySettings?.print_labels, "equipment_rentals");
    const clientName = (project as any)?.clients?.name || "عميل";
    const projectName = project?.name || "مشروع";
    const dateStr = format(new Date(), "dd-MM-yyyy");
    const filename = `${pl.title.replace(/\s+/g, "_")}_${clientName.replace(/\s+/g, "_")}_${projectName.replace(/\s+/g, "_")}_تاريخ_${dateStr}.pdf`;
    savePdfViaCanvas(buildInvoiceHTML(), filename);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">إيجار المعدات</h1>
            <p className="text-xs text-muted-foreground">معدات المشروع وإيجاراتها وسجلات التشغيل</p>
          </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 cursor-pointer" onClick={handlePrintInvoice} disabled={rentals.length === 0}>
            <Printer className="h-4 w-4" />
            طباعة الفاتورة
          </Button>
          <Button variant="outline" className="gap-2 cursor-pointer" onClick={handleSaveInvoicePdf} disabled={rentals.length === 0 || isPdfLoading}>
            <Download className="h-4 w-4" />
            {isPdfLoading ? "جاري الحفظ..." : "حفظ PDF"}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إيجار معدة
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRental ? "تعديل الإيجار" : "إيجار معدة جديدة"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3 md:col-span-2">
                <Label>المعدة *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto p-1">
                  {availableEquipment.length === 0 ? (
                    <p className="col-span-full text-center text-muted-foreground py-4">
                      لا توجد معدات متاحة للإيجار
                    </p>
                  ) : (
                    availableEquipment.map((eq) => (
                      <div
                        key={eq.id}
                        onClick={() => handleEquipmentSelect(eq.id)}
                        className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:border-primary ${
                          formData.equipment_id === eq.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        {formData.equipment_id === eq.id && (
                          <div className="absolute top-1 left-1 rounded-full bg-primary p-1">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <div className="aspect-square mb-2 rounded-md overflow-hidden bg-muted">
                          {eq.image_url ? (
                            <img
                              src={eq.image_url}
                              alt={eq.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder.svg';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium text-center truncate">{eq.name}</p>
                        {eq.category && (
                          <p className="text-xs text-muted-foreground text-center truncate">{eq.category}</p>
                        )}
                        <p className="text-xs text-primary text-center mt-1">
                          {formatCurrencyLYD(eq.daily_rental_rate || 0)}/يوم
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date">تاريخ البداية *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">تاريخ النهاية</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily_rate">السعر اليومي (د.ل)</Label>
                  <Input
                    id="daily_rate"
                    type="number"
                    step="0.01"
                    value={formData.daily_rate}
                    onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.status === "damaged" && (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="damage_notes">وصف الضرر</Label>
                      <Textarea
                        id="damage_notes"
                        value={formData.damage_notes}
                        onChange={(e) => setFormData({ ...formData, damage_notes: e.target.value })}
                        placeholder="وصف الأضرار..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="damage_cost">تكلفة الإصلاح (د.ل)</Label>
                      <Input
                        id="damage_cost"
                        type="number"
                        step="0.01"
                        value={formData.damage_cost}
                        onChange={(e) => setFormData({ ...formData, damage_cost: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </>
                )}
              </div>
              
              {/* Fund Source Section */}
              <div className="space-y-3">
                <div className="grid gap-4 md:grid-cols-2 p-3 bg-muted/50 rounded-lg border">
                  <div className="space-y-2">
                    <Label>مصدر الأموال</Label>
                    <Select
                      value={formData.fund_source}
                      onValueChange={(value) => setFormData({ ...formData, fund_source: value, custody_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fundSourceOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.fund_source === "custody" && (
                    <div className="space-y-2">
                      <Label>العهدة</Label>
                      <Select
                        value={formData.custody_id}
                        onValueChange={(value) => setFormData({ ...formData, custody_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر العهدة" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectCustody.length === 0 ? (
                            <SelectItem value="none" disabled>
                              لا توجد عهد نشطة
                            </SelectItem>
                          ) : (
                            projectCustody.map((custody: any) => (
                              <SelectItem key={custody.id} value={custody.id}>
                                {custody.holder_type === "engineer" 
                                  ? custody.engineer?.name 
                                  : custody.employee?.name} - {formatCurrencyLYD(custody.remaining_amount)} متبقي
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {/* Custody Exceeded Warning */}
                {formData.fund_source === "custody" && formData.custody_id && (() => {
                  const selectedCustody = projectCustody.find((c: any) => c.id === formData.custody_id);
                  const totalAmount = calculateTotal(formData.start_date, formData.end_date, formData.daily_rate);
                  const remainingAmount = selectedCustody?.remaining_amount || 0;
                  // For editing, we need to add back the original amount
                  const originalAmount = editingRental ? editingRental.total_amount || 0 : 0;
                  const effectiveRemaining = remainingAmount + (editingRental && editingRental.custody_id === formData.custody_id ? originalAmount : 0);
                  if (totalAmount > effectiveRemaining) {
                    return (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          تحذير: المبلغ الإجمالي ({formatCurrencyLYD(totalAmount)}) يتجاوز المبلغ المتبقي في العهدة ({formatCurrencyLYD(effectiveRemaining)})
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  rows={2}
                />
              </div>
              {formData.start_date && formData.end_date && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    <span className="text-muted-foreground">الإجمالي المقدر: </span>
                    <span className="font-bold">
                      {formatCurrencyLYD(calculateTotal(formData.start_date, formData.end_date, formData.daily_rate))}
                    </span>
                    <span className="text-muted-foreground mr-2">
                      ({differenceInDays(parseISO(formData.end_date), parseISO(formData.start_date)) + 1} يوم)
                    </span>
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editingRental ? "تحديث" : "إضافة"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">عدد الإيجارات</p>
          <p className="text-2xl font-bold">{rentals.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">إجمالي تكلفة الإيجار</p>
          <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totalRentalCost)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">إجمالي تكلفة الأضرار</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrencyLYD(totalDamageCost)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المعدة</TableHead>
                <TableHead>تاريخ البداية</TableHead>
                <TableHead>تاريخ النهاية</TableHead>
                <TableHead>السعر اليومي</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[120px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد إيجارات
                  </TableCell>
                </TableRow>
              ) : (
                rentals.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {rental.equipment?.image_url ? (
                          <img
                            src={rental.equipment.image_url}
                            alt={rental.equipment.name}
                            className="w-10 h-10 rounded object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setZoomedImage(rental.equipment?.image_url || null)}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                            <Wrench className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span>{rental.equipment?.name || "غير معروف"}</span>
                        {rental.status === "damaged" && (
                          <AlertTriangle className="inline-block h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(rental.start_date), "dd MMM yyyy", { locale: ar })}
                    </TableCell>
                    <TableCell>
                      {rental.end_date
                        ? format(parseISO(rental.end_date), "dd MMM yyyy", { locale: ar })
                        : "-"}
                    </TableCell>
                    <TableCell>{formatCurrencyLYD(rental.daily_rate)}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrencyLYD(rental.total_amount)}
                      {rental.damage_cost > 0 && (
                        <span className="text-destructive text-xs block">
                          + {formatCurrencyLYD(rental.damage_cost)} إصلاح
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(rental.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {rental.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => returnEquipmentMutation.mutate(rental)}
                            title="إرجاع المعدة"
                          >
                            <RotateCcw className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(rental)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(rental.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا الإيجار نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Zoom Dialog */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="صورة مكبرة"
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Forced Phase Selector Dialog */}
      <Dialog open={forcedPhaseSelectorOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button]:hidden" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Layers className="h-5 w-5 text-primary animate-pulse" />
              الرجاء اختيار مرحلة لعرض معداتها
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              يجب اختيار مرحلة معينة لعرض وإضافة إيجارات المعدات الخاصة بها.
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
                      navigate(`/projects/${projectId}/phases/${phase.id}/equipment`);
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
                    عرض كل المعدات
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
      </div>
    </ProjectWorkspaceLayout>
  );
};

export default ProjectEquipmentRentals;
