import { useEffect, useState } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import SearchableSelect from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
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
  ArrowRight,
  Wrench,
  Image,
  ShoppingCart,
  Receipt,
  Banknote,
  MapPin,
  Calendar,
  User,
  HardHat,
  FileText,
  Sparkles,
  Save,
  X,
  Plus,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { ImageUploader } from "@/components/ui/image-uploader";

const projectSchema = z.object({
  name: z.string().min(3, "يجب أن يكون اسم المشروع 3 أحرف على الأقل").max(200),
  description: z.string().optional().or(z.literal("")),
  client_id: z.string().optional().or(z.literal("")),
  supervising_engineer_id: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "pending", "completed", "cancelled"]),
  budget: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return 0;
      const str = String(val).replace(/,/g, "");
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    },
    z.number().min(0, "الميزانية يجب أن تكون أكبر من أو تساوي 0")
  ),
  budget_type: z.enum(["open", "warning", "lumpsum"]).optional(),
  start_date: z.string().optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  image_url: z.string().optional().or(z.literal("")),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const today = new Date().toISOString().split("T")[0];

const statusConfig: Record<string, { label: string; dot: string }> = {
  pending: { label: "قيد الانتظار", dot: "bg-yellow-500" },
  active: { label: "نشط", dot: "bg-emerald-500" },
  completed: { label: "مكتمل", dot: "bg-sky-500" },
  cancelled: { label: "ملغي", dot: "bg-red-500" },
};

const ManageProject = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const clientIdFromUrl = searchParams.get("client_id");
  const returnTo = searchParams.get("returnTo");
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  // Quick-add dialog states
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddEngineer, setShowAddEngineer] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientCity, setNewClientCity] = useState("");
  const [newEngineerName, setNewEngineerName] = useState("");
  const [newEngineerPhone, setNewEngineerPhone] = useState("");
  const [newEngineerSpecialty, setNewEngineerSpecialty] = useState("");

  // Collapsible extras
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [hasPurchaseSections, setHasPurchaseSections] = useState(false);
  const [progressTrackingEnabled, setProgressTrackingEnabled] = useState(false);
  const [supervisionMode, setSupervisionMode] = useState<"percentage" | "fixed">("percentage");
  const [supervisionAmount, setSupervisionAmount] = useState("");

  const getReturnPath = () => {
    if (returnTo) return returnTo;
    if (clientIdFromUrl) return `/projects/client/${clientIdFromUrl}`;
    return "/projects";
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      status: "active",
      budget: 0,
      budget_type: "open",
      client_id: clientIdFromUrl || "",
      start_date: today,
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: engineers } = useQuery({
    queryKey: ["engineers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("id, name, specialty")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: projectSummary } = useQuery({
    queryKey: ["project-summary", id],
    queryFn: async () => {
      if (!id) return { purchases: 0, expenses: 0, rentals: 0, custody: 0, totalSpent: 0 };

      const [{ data: purchases }, { data: expenses }, { data: rentals }, { data: custody }] =
        await Promise.all([
          supabase.from("purchases").select("total_amount").eq("project_id", id),
          supabase.from("expenses").select("amount").eq("project_id", id),
          supabase.from("equipment_rentals").select("total_amount").eq("project_id", id),
          supabase.from("project_custody").select("amount").eq("project_id", id),
        ]);

      const purchasesTotal = purchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
      const expensesTotal = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
      const rentalsTotal = rentals?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0;
      const custodyTotal = custody?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;

      return {
        purchases: purchasesTotal,
        expenses: expensesTotal,
        rentals: rentalsTotal,
        custody: custodyTotal,
        totalSpent: purchasesTotal + expensesTotal + rentalsTotal + custodyTotal,
      };
    },
    enabled: isEdit,
  });

  const calculatedSpent = projectSummary?.totalSpent || 0;

  useEffect(() => {
    if (project) {
      setValue("name", project.name);
      setValue("description", project.description || "");
      setValue("client_id", project.client_id || "");
      setValue("supervising_engineer_id", (project as any).supervising_engineer_id || "");
      setValue("status", project.status as "active" | "pending" | "completed" | "cancelled");
      setValue("budget", project.budget);
      const bt = project.budget_type === 'fixed' ? 'warning' : (project.budget_type as "open" | "warning" | "lumpsum") || "open";
      setValue("budget_type", bt);
      setValue("start_date", project.start_date || "");
      setValue("location", project.location || "");
      setValue("notes", project.notes || "");
      setValue("image_url", (project as any).image_url || "");
      setHasPurchaseSections(!!(project as any).has_purchase_sections);
      setProgressTrackingEnabled(!!(project as any).progress_tracking_enabled);
      setSupervisionMode((project as any).supervision_mode || "percentage");
      setSupervisionAmount(String((project as any).supervision_amount || ""));
      // Open extras section when editing (has data)
      setExtrasOpen(true);
    } else if (clientIdFromUrl && !isEdit) {
      setValue("client_id", clientIdFromUrl);
    }
  }, [project, setValue, clientIdFromUrl, isEdit]);

  // Quick-add client mutation
  const addClientMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .insert([{ name: newClientName, phone: newClientPhone || null, city: newClientCity || null }])
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setValue("client_id", data.id, { shouldDirty: true });
      setShowAddClient(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientCity("");
      toast({ title: "تم إضافة العميل ✨" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Quick-add engineer mutation
  const addEngineerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .insert([{ name: newEngineerName, phone: newEngineerPhone || null, specialty: newEngineerSpecialty || null }])
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["engineers"] });
      setValue("supervising_engineer_id", data.id, { shouldDirty: true });
      setShowAddEngineer(false);
      setNewEngineerName("");
      setNewEngineerPhone("");
      setNewEngineerSpecialty("");
      toast({ title: "تم إضافة المهندس ✨" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const insertData = {
        name: data.name,
        description: data.description || null,
        client_id: data.client_id || clientIdFromUrl || null,
        supervising_engineer_id: data.supervising_engineer_id || null,
        status: data.status,
        budget: data.budget_type === "open" ? 0 : (data.budget || 0),
        budget_type: data.budget_type || "open",
        spent: 0,
        progress: 0,
        start_date: data.start_date || today,
        end_date: null,
        location: data.location || null,
        notes: data.notes || null,
        image_url: data.image_url || null,
        has_purchase_sections: hasPurchaseSections,
        progress_tracking_enabled: progressTrackingEnabled,
        supervision_mode: supervisionMode,
        supervision_amount: supervisionMode === "fixed" ? (parseFloat(supervisionAmount) || 0) : 0,
      };
      const { error } = await supabase.from("projects").insert([insertData as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "تم بنجاح ✨", description: "تم إضافة المشروع بنجاح" });
      navigate(getReturnPath());
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const updateData = {
        name: data.name,
        description: data.description || null,
        client_id: data.client_id || null,
        supervising_engineer_id: data.supervising_engineer_id || null,
        status: data.status,
        budget: data.budget_type === "open" ? 0 : (data.budget || 0),
        budget_type: data.budget_type || "open",
        spent: calculatedSpent,
        start_date: data.start_date || null,
        location: data.location || null,
        notes: data.notes || null,
        image_url: data.image_url || null,
        has_purchase_sections: hasPurchaseSections,
        progress_tracking_enabled: progressTrackingEnabled,
        supervision_mode: supervisionMode,
        supervision_amount: supervisionMode === "fixed" ? (parseFloat(supervisionAmount) || 0) : 0,
      };
      const { error } = await supabase
        .from("projects")
        .update(updateData as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast({ title: "تم التحديث ✨", description: "تم تحديث المشروع بنجاح" });
      navigate(getReturnPath());
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No project ID");
      const projectId = id;

      // 1. Get client_payments for this project
      const { data: payments } = await supabase
        .from("client_payments")
        .select("id")
        .eq("project_id", projectId);
      const paymentIds = payments?.map(p => p.id) || [];

      // 2. Delete client_payment_allocations
      if (paymentIds.length > 0) {
        await supabase.from("client_payment_allocations").delete().in("payment_id", paymentIds);
      }

      // 3. Delete treasury_transactions linked to client_payments
      if (paymentIds.length > 0) {
        await supabase.from("treasury_transactions").delete().eq("reference_type", "client_payment").in("reference_id", paymentIds);
      }

      // 4. Delete client_payments
      await supabase.from("client_payments").delete().eq("project_id", projectId);

      // 5. Get purchases for treasury_transactions cleanup
      const { data: purchases } = await supabase.from("purchases").select("id").eq("project_id", projectId);
      const purchaseIds = purchases?.map(p => p.id) || [];
      if (purchaseIds.length > 0) {
        await supabase.from("treasury_transactions").delete().eq("reference_type", "purchase").in("reference_id", purchaseIds);
      }

      // 6. Get project_items for sub-relations
      const { data: projectItems } = await supabase.from("project_items").select("id").eq("project_id", projectId);
      const itemIds = projectItems?.map(i => i.id) || [];
      if (itemIds.length > 0) {
        await supabase.from("project_item_technicians").delete().in("project_item_id", itemIds);
        await supabase.from("technician_progress_records").delete().in("project_item_id", itemIds);
      }

      // 7. Checklists
      const { data: checklists } = await supabase.from("inspection_checklists").select("id").eq("project_id", projectId);
      const checklistIds = checklists?.map(c => c.id) || [];
      if (checklistIds.length > 0) {
        await supabase.from("checklist_items").delete().in("checklist_id", checklistIds);
      }
      await supabase.from("inspection_checklists").delete().eq("project_id", projectId);

      // 8. Contracts
      const { data: contracts } = await supabase.from("contracts").select("id").eq("project_id", projectId);
      const contractIds = contracts?.map(c => c.id) || [];
      if (contractIds.length > 0) {
        await supabase.from("contract_items").delete().in("contract_id", contractIds);
        await supabase.from("contract_clauses").delete().in("contract_id", contractIds);
      }
      await supabase.from("contracts").delete().eq("project_id", projectId);

      // 9. Other related tables
      await supabase.from("purchases").delete().eq("project_id", projectId);
      await supabase.from("expenses").delete().eq("project_id", projectId);
      await supabase.from("income").delete().eq("project_id", projectId);
      await supabase.from("transfers").delete().eq("project_id", projectId);
      await supabase.from("equipment_rentals").delete().eq("project_id", projectId);
      await supabase.from("project_custody").delete().eq("project_id", projectId);
      await supabase.from("project_phases").delete().eq("project_id", projectId);
      await supabase.from("project_schedules").delete().eq("project_id", projectId);
      await supabase.from("stock_movements").delete().eq("project_id", projectId);
      await supabase.from("project_items").delete().eq("project_id", projectId);
      await supabase.from("project_technicians").delete().eq("project_id", projectId);
      await supabase.from("project_suppliers").delete().eq("project_id", projectId);

      // 10. Delete the project
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "تم حذف المشروع وجميع البيانات المرتبطة بنجاح ✅" });
      navigate("/projects");
    },
    onError: (error: any) => {
      toast({ title: "خطأ في الحذف", description: error.message, variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">جاري تحميل بيانات المشروع...</p>
        </div>
      </div>
    );
  }

  const selectedClientName = clients?.find((c) => c.id === watch("client_id"))?.name;

  // Prepare options for SearchableSelect
  const clientOptions = (clients || []).map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.phone || undefined,
  }));

  const engineerOptions = (engineers || []).map((e) => ({
    value: e.id,
    label: e.name,
    sublabel: e.specialty || undefined,
  }));

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto" dir="rtl">
      {isEdit && <ProjectNavBar />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isEdit && (
            <Button variant="ghost" size="icon" onClick={() => navigate(getReturnPath())}>
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {isEdit ? "تعديل المشروع" : "مشروع جديد"}
            </h1>
            {isEdit && project && (
              <p className="text-muted-foreground text-sm mt-0.5">{project.name}</p>
            )}
            {!isEdit && selectedClientName && (
              <p className="text-muted-foreground text-sm mt-0.5">
                للعميل: <span className="text-primary">{selectedClientName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards - Only show when editing */}
      {isEdit && projectSummary && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <SummaryCard icon={ShoppingCart} label="المشتريات" value={projectSummary.purchases} accent="text-primary" />
          <SummaryCard icon={Receipt} label="المصروفات" value={projectSummary.expenses} accent="text-primary" />
          <SummaryCard icon={Wrench} label="الإيجارات" value={projectSummary.rentals} accent="text-primary" />
          <SummaryCard icon={Banknote} label="العهد" value={projectSummary.custody} accent="text-primary" />
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Section: Basic Info */}
        <Card className="p-3 md:p-5 space-y-4">
          <SectionTitle icon={FileText} title="المعلومات الأساسية" />

          <div className="space-y-2">
            <Label htmlFor="name">
              اسم المشروع <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="مثال: مشروع فيلا سكنية - حي الأندلس"
              className="text-base"
              autoFocus={!isEdit}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
            {/* Client with SearchableSelect + Quick-Add */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                العميل
              </Label>
              <div className="flex gap-2">
                <SearchableSelect
                  options={clientOptions}
                  value={watch("client_id") || ""}
                  onValueChange={(value) => setValue("client_id", value, { shouldDirty: true })}
                  placeholder="ابحث عن عميل..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => setShowAddClient(true)}
                  title="إضافة عميل جديد"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Engineer with SearchableSelect + Quick-Add */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                المهندس المشرف
              </Label>
              <div className="flex gap-2">
                <SearchableSelect
                  options={engineerOptions}
                  value={watch("supervising_engineer_id") || ""}
                  onValueChange={(value) => setValue("supervising_engineer_id", value, { shouldDirty: true })}
                  placeholder="ابحث عن مهندس..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9 border-dashed border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => setShowAddEngineer(true)}
                  title="إضافة مهندس جديد"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">وصف المشروع</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="وصف مختصر للمشروع ونطاق العمل..."
              rows={2}
            />
          </div>
        </Card>

        {/* Section: Status & Details */}
        <Card className="p-3 md:p-5 space-y-4">
          <SectionTitle icon={Calendar} title="الحالة والتفاصيل" />

          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) =>
                  setValue("status", value as ProjectFormData["status"], { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                تاريخ البدء
              </Label>
              <Input id="start_date" type="date" {...register("start_date")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                الموقع
              </Label>
              <Input
                id="location"
                {...register("location")}
                placeholder="مثال: زليتن - المركز"
              />
            </div>
          </div>

          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <Label>نوع الميزانية</Label>
              <Select
                value={watch("budget_type") || "open"}
                onValueChange={(value: "open" | "warning" | "lumpsum") =>
                  setValue("budget_type", value, { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">غير محددة (بدون حد)</SelectItem>
                  <SelectItem value="warning">محددة للتنبيه (تنبيه عند التجاوز)</SelectItem>
                  <SelectItem value="lumpsum">مقطوعية (ميزانية ثابتة)</SelectItem>
                </SelectContent>
              </Select>
              {watch("budget_type") === "warning" && (
                <p className="text-xs text-muted-foreground">سيتم التنبيه ومنع الإضافة عند تجاوز الميزانية المحددة</p>
              )}
              {watch("budget_type") === "lumpsum" && (
                <p className="text-xs text-muted-foreground">المتبقي من الميزانية يُعتبر صافي الربح</p>
              )}
            </div>

            {(watch("budget_type") === "warning" || watch("budget_type") === "lumpsum") && (
              <div className="space-y-2">
                <Label htmlFor="budget">قيمة الميزانية (د.ل)</Label>
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  {...register("budget")}
                  placeholder="أدخل قيمة الميزانية"
                />
                {errors.budget && (
                  <p className="text-sm text-destructive">{errors.budget.message}</p>
                )}
              </div>
            )}

            {isEdit && (
              <div className="space-y-2">
                <Label>إجمالي المصروف</Label>
                <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-lg font-bold text-primary">
                    {formatCurrencyLYD(calculatedSpent)}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    يُحسب تلقائياً من المشتريات والمصروفات والإيجارات والعهد
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Section: Purchase Sections */}
        <Card className="p-3 md:p-5 space-y-4">
          <SectionTitle icon={ShoppingCart} title="إعدادات الفواتير" />
          <div className="flex items-center justify-between">
            <div>
              <Label>تقسيم الفواتير إلى أقسام</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                تفعيل هذا الخيار يقسم فواتير المشتريات إلى قسمين: مقاولات وتشطيب
              </p>
            </div>
            <Switch
              checked={hasPurchaseSections}
              onCheckedChange={setHasPurchaseSections}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>تفعيل تسجيل الإنجاز</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                عند التفعيل يمكن تسجيل إنجازات الفنيين يدوياً. عند الإيقاف يتم تسجيل الإنجاز كاملاً تلقائياً
              </p>
            </div>
            <Switch
              checked={progressTrackingEnabled}
              onCheckedChange={setProgressTrackingEnabled}
            />
          </div>

          {/* Supervision Mode */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <Label>نوع الإشراف</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="supervision_mode"
                  value="percentage"
                  checked={supervisionMode === "percentage"}
                  onChange={() => setSupervisionMode("percentage")}
                  className="accent-primary"
                />
                <span className="text-sm">نسبة مئوية (من المراحل)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="supervision_mode"
                  value="fixed"
                  checked={supervisionMode === "fixed"}
                  onChange={() => setSupervisionMode("fixed")}
                  className="accent-primary"
                />
                <span className="text-sm">مقطوعية</span>
              </label>
            </div>
            {supervisionMode === "fixed" && (
              <div className="space-y-2">
                <Label>مبلغ الإشراف المقطوع</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={supervisionAmount}
                  onChange={(e) => setSupervisionAmount(e.target.value)}
                  placeholder="أدخل مبلغ الإشراف"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Section: Image & Notes - Collapsible for new, open for edit */}
        <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
          <Card className="p-3 md:p-5 space-y-0">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full pb-0 group"
              >
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">الصورة والملاحظات</h3>
                  {!extrasOpen && (
                    <span className="text-xs text-muted-foreground">(اختياري)</span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                    extrasOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <ImageUploader
                value={watch("image_url") || ""}
                onChange={(url) => setValue("image_url", url, { shouldDirty: true })}
                folder="projects"
                label="صورة المشروع"
              />

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder="ملاحظات إضافية عن المشروع..."
                  rows={2}
                />
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Actions - Sticky with backdrop */}
        <div className="flex items-center gap-3 sticky bottom-4 z-10">
          <div className="flex items-center gap-3 bg-background/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-lg w-full md:w-auto">
            <Button
              type="submit"
              disabled={isPending}
              className="gap-2 flex-1 md:flex-none md:min-w-[200px] h-11 shadow-md"
            >
              {isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEdit ? "حفظ التعديلات" : "إنشاء المشروع"}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => navigate(getReturnPath())}
            >
              <X className="h-4 w-4" />
              إلغاء
            </Button>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                حذف المشروع
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Delete Project Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المشروع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المشروع "{project?.name}"؟
              <br />
              <span className="text-destructive font-semibold">
                سيتم حذف جميع المدفوعات والمقبوضات والمشتريات والمصروفات والعقود والعهد وجميع البيانات المرتبطة نهائياً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteProjectMutation.mutate()}
            >
              {deleteProjectMutation.isPending ? "جاري الحذف..." : "حذف المشروع نهائياً"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick-Add Client Dialog */}
      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              إضافة عميل جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                اسم العميل <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="اسم العميل"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Input
                  value={newClientCity}
                  onChange={(e) => setNewClientCity(e.target.value)}
                  placeholder="المدينة"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              onClick={() => addClientMutation.mutate()}
              disabled={!newClientName.trim() || addClientMutation.isPending}
              className="gap-2"
            >
              {addClientMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              إضافة
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAddClient(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-Add Engineer Dialog */}
      <Dialog open={showAddEngineer} onOpenChange={setShowAddEngineer}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              إضافة مهندس جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                اسم المهندس <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newEngineerName}
                onChange={(e) => setNewEngineerName(e.target.value)}
                placeholder="اسم المهندس"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input
                  value={newEngineerPhone}
                  onChange={(e) => setNewEngineerPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                />
              </div>
              <div className="space-y-2">
                <Label>التخصص</Label>
                <Input
                  value={newEngineerSpecialty}
                  onChange={(e) => setNewEngineerSpecialty(e.target.value)}
                  placeholder="التخصص"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              onClick={() => addEngineerMutation.mutate()}
              disabled={!newEngineerName.trim() || addEngineerMutation.isPending}
              className="gap-2"
            >
              {addEngineerMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              إضافة
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAddEngineer(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------- Sub-components ---------- */

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="font-semibold text-sm">{title}</h3>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-primary/10 rounded-md">
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-sm font-bold">{formatCurrencyLYD(value)}</p>
        </div>
      </div>
    </Card>
  );
}

export default ManageProject;
