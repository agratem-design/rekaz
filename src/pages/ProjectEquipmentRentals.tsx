import { useState } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import { Plus, ArrowRight, Pencil, Trash2, RotateCcw, AlertTriangle, Printer, ImageIcon, Check, Wrench } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrencyLYD } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";
import { ar } from "date-fns/locale";
import { openPrintWindow } from "@/lib/printStyles";
import { getElementLabels } from "@/lib/printLabels";

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
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  const handlePrintInvoice = () => {
    const today = format(new Date(), "dd/MM/yyyy");
    const statusLabels: Record<string, string> = {
      active: "نشط",
      returned: "مُرجع",
      damaged: "متضرر",
    };
    const pl = getElementLabels(companySettings?.print_labels, "equipment_rentals");

    const content = `
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
                  <th>${pl.col_number}</th>
                  <th>${pl.col_equipment}</th>
                  <th>${pl.col_start_date}</th>
                  <th>${pl.col_end_date}</th>
                  <th>${pl.col_days}</th>
                  <th>${pl.col_daily_rate}</th>
                  <th>${pl.col_total}</th>
                  <th>${pl.col_status}</th>
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
          <span>تاريخ الطباعة: ${today}</span>
        </div>
      </div>
    `;

    const printWindow = openPrintWindow(
      `${pl.title} - ${project?.name || "المشروع"}`,
      content,
      companySettings
    );

    if (!printWindow) {
      toast({
        title: "خطأ",
        description: "تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إيجار المعدات</h1>
          <p className="text-muted-foreground">{project?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handlePrintInvoice} disabled={rentals.length === 0}>
            <Printer className="h-4 w-4" />
            طباعة الفاتورة
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
    </div>
  );
};

export default ProjectEquipmentRentals;
