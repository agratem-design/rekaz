import { useEffect, useState, useMemo } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectFinancialSummaryCards } from "@/components/projects/ProjectFinancialSummaryCards";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import {
  ArrowRight,
  Printer,
  Wrench,
  Image,
  Link2,
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
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  GitBranch,
  CalendarDays,
  Upload,
  Clipboard,
  Trash2,
  Loader2,
  Wallet,
  Landmark,
  CheckCircle2
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";

const projectSchema = z.object({
  name: z.string().min(3, "يجب أن يكون اسم المشروع 3 أحرف على الأقل").max(200),
  description: z.string().optional().or(z.literal("")),
  client_id: z.string().optional().or(z.literal("")),
  supervising_engineer_id: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "pending", "completed", "cancelled"]),
  project_type: z.enum(["contracting", "finishing"], {
    required_error: "يرجى اختيار نوع المشروع",
    invalid_type_error: "يرجى اختيار نوع المشروع",
  }),
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
  finishing_percentage: z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return 0;
      const str = String(val).replace(/,/g, "");
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    },
    z.number().min(0, "النسبة يجب أن تكون أكبر من أو تساوي 0").max(100, "النسبة لا يمكن أن تتجاوز 100")
  ).optional().default(0),
  default_treasury_id: z.string().optional().or(z.literal("")),
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
  const projectTypeFromUrl = searchParams.get("type") as "contracting" | "finishing" | null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        sonnerToast.error("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت");
        return;
      }
      try {
        setUploadingImage(true);
        const uploadToast = sonnerToast.loading("جاري رفع الصورة للموقع المعتمد...");
        const { uploadImage } = await import("@/services/imageUploadService");
        const uploadedUrl = await uploadImage(file);
        setValue("image_url", uploadedUrl);
        sonnerToast.dismiss(uploadToast);
        sonnerToast.success("تم رفع صورة المشروع بنجاح");
      } catch (err: any) {
        sonnerToast.error("فشل رفع الصورة: " + err.message);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      sonnerToast.error("لصق الصور برمجياً غير مدعوم في هذا الاتصال. يرجى تشغيل النظام على HTTPS أو localhost، أو لصق الصورة يدوياً (Ctrl + V) بداخل حقل الإدخال.");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            setUploadingImage(true);
            const uploadToast = sonnerToast.loading("جاري رفع الصورة المنسوخة من الحافظة...");
            const blob = await item.getType(type);
            const file = new File([blob], `project-clip-${Date.now()}.png`, { type });
            const { uploadImage } = await import("@/services/imageUploadService");
            const uploadedUrl = await uploadImage(file);
            setValue("image_url", uploadedUrl);
            sonnerToast.dismiss(uploadToast);
            sonnerToast.success("تم رفع الصورة من الحافظة بنجاح");
            setUploadingImage(false);
            return;
          }
        }
      }
      
      const text = await navigator.clipboard.readText();
      if (text.startsWith("http://") || text.startsWith("https://")) {
        setValue("image_url", text);
        sonnerToast.success("تم لصق الرابط من الحافظة");
        return;
      }
      sonnerToast.error("لم يتم العثور على صورة أو رابط صالح في الحافظة. يرجى نسخ صورة أو رابط أولاً.");
    } catch (err: any) {
      sonnerToast.error("فشل قراءة الحافظة: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClearImage = () => {
    setValue("image_url", "");
    sonnerToast.success("تم إزالة الصورة");
  };

  const getReturnPath = () => {
    if (returnTo) return returnTo;
    if (isEdit && id) return `/projects/${id}`;
    if (clientIdFromUrl) return `/projects/client/${clientIdFromUrl}`;
    const currentType = watch("project_type");
    return `/projects/${currentType || "contracting"}`;
  };

  const isSectorLocked = !isEdit && (projectTypeFromUrl === "contracting" || projectTypeFromUrl === "finishing");
  const initialType: "contracting" | "finishing" = (projectTypeFromUrl === "contracting" || projectTypeFromUrl === "finishing")
    ? projectTypeFromUrl
    : "contracting";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      status: "active",
      project_type: initialType,
      budget: 0,
      budget_type: "open",
      client_id: clientIdFromUrl || "",
      start_date: today,
      default_treasury_id: "",
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
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

  const { data: treasuries, isLoading: isTreasuriesLoading } = useQuery({
    queryKey: ["parent-treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, project_category, is_active, parent_id")
        .is("parent_id", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings, isLoading: isCompanySettingsLoading } = useQuery({
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

  const isSettingsLoading = isCompanySettingsLoading || isTreasuriesLoading;
  const projectType = watch("project_type");

  const resolvedTreasuryId = useMemo(() => {
    if (!projectType) return "";
    if (projectType === "contracting") {
      if (companySettings?.contracting_treasury_id) return companySettings.contracting_treasury_id;
      return treasuries?.find((t) => (t.project_category === "contracting" || !t.project_category) && t.is_active)?.id || "";
    }
    if (projectType === "finishing") {
      if (companySettings?.finishing_treasury_id) return companySettings.finishing_treasury_id;
      return treasuries?.find((t) => t.project_category === "finishing" && t.is_active)?.id || "";
    }
    return "";
  }, [projectType, companySettings, treasuries]);

  const resolvedTreasury = useMemo(() => {
    const currentTreasuryId = watch("default_treasury_id") || resolvedTreasuryId;
    return treasuries?.find((t) => t.id === currentTreasuryId);
  }, [treasuries, watch("default_treasury_id"), resolvedTreasuryId]);

  // 1. Sync project_type from URL when creating new project
  useEffect(() => {
    if (!isEdit) {
      if (projectTypeFromUrl === "contracting" || projectTypeFromUrl === "finishing") {
        setValue("project_type", projectTypeFromUrl, { shouldValidate: true, shouldDirty: false });
      }
    }
  }, [projectTypeFromUrl, isEdit, setValue]);

  // 2. Automatically resolve and assign the sector default Treasury
  useEffect(() => {
    if (!isEdit && resolvedTreasuryId) {
      setValue("default_treasury_id", resolvedTreasuryId, { shouldValidate: true, shouldDirty: false });
    }
  }, [resolvedTreasuryId, isEdit, setValue]);

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
        totalSpent: purchasesTotal + expensesTotal,
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
      setValue("project_type", (project as any).project_type || "contracting");
      setValue("budget", project.budget);
      const bt = project.budget_type === 'fixed' ? 'warning' : (project.budget_type as "open" | "warning" | "lumpsum") || "open";
      setValue("budget_type", bt);
      setValue("start_date", project.start_date || "");
      setValue("location", project.location || "");
      setValue("notes", project.notes || "");
      setValue("image_url", (project as any).image_url || "");
      setValue("finishing_percentage", (project as any).finishing_percentage || 0);
      setValue("default_treasury_id", (project as any).default_treasury_id || "");
    } else if (clientIdFromUrl && !isEdit) {
      setValue("client_id", clientIdFromUrl);
    }
  }, [project, setValue, clientIdFromUrl, isEdit]);

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const insertData = {
        name: data.name,
        description: data.description || null,
        client_id: data.client_id || clientIdFromUrl || null,
        supervising_engineer_id: data.supervising_engineer_id || null,
        status: data.status,
        project_type: data.project_type,
        budget_type: data.budget_type || "open",
        budget: data.budget_type === "open" ? 0 : (data.budget || 0),
        spent: 0,
        progress: 0,
        start_date: data.start_date || today,
        end_date: null,
        location: data.location || null,
        notes: data.notes || null,
        image_url: data.image_url || null,
        finishing_percentage: data.project_type === "finishing" ? (data.finishing_percentage || 0) : 0,
        default_treasury_id: data.default_treasury_id || null,
      };
      const { data: created, error } = await supabase.from("projects").insert([insertData as any]).select("id").single();
      if (error) throw error;
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "تم بنجاح", description: "تم إضافة المشروع بنجاح" });
      navigate(`/projects/${created.id}`);
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
        project_type: data.project_type,
        budget_type: data.budget_type || "open",
        budget: data.budget_type === "open" ? 0 : (data.budget || 0),
        spent: calculatedSpent,
        start_date: data.start_date || null,
        location: data.location || null,
        notes: data.notes || null,
        image_url: data.image_url || null,
        finishing_percentage: data.project_type === "finishing" ? (data.finishing_percentage || 0) : 0,
        default_treasury_id: data.default_treasury_id || null,
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
      toast({ title: "تم التحديث", description: "تم تحديث المشروع بنجاح" });
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

  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    showConfirmDialog: showUnsavedPrompt,
    setShowConfirmDialog,
    requestAction,
    confirmDiscard: confirmUnsavedNavigation,
    cancelDiscard: cancelUnsavedNavigation,
  } = useUnsavedChangesGuard({
    isDirty,
    isSubmitting: isPending,
  });

  const handleSafeClose = (action: () => void) => {
    if (isDirty) {
      requestAction(action);
    } else {
      action();
    }
  };

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

  const formContent = (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isEdit && (
            <Button variant="ghost" size="icon" aria-label="الرجوع إلى المشاريع" disabled={isPending} onClick={() => handleSafeClose(() => navigate(getReturnPath()))}>
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {isEdit ? "إعدادات وبيانات المشروع" : "مشروع جديد"}
            </h1>
            {!isEdit && selectedClientName && (
              <p className="text-muted-foreground text-sm mt-0.5">
                للعميل: <span className="text-primary">{selectedClientName}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary Cards - 6 Independent Sections */}
      {isEdit && id && (
        <ProjectFinancialSummaryCards projectId={id} />
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Section: Basic Info */}
        <Card className="p-5 space-y-4">
          <SectionTitle icon={FileText} title="المعلومات الأساسية" />

          <div className="space-y-2">
            <Label htmlFor="name">اسم المشروع *</Label>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Type Field */}
            <div className="space-y-2">
              <Label htmlFor="project_type" className="font-semibold text-foreground">
                نوع المشروع / الفواتير *
              </Label>
              {isSectorLocked ? (
                <div className="space-y-1.5">
                  <div className="h-10 flex items-center justify-between px-3 rounded-lg border border-border bg-muted/50 text-foreground text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      {watch("project_type") === "finishing" ? (
                        <Sparkles className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Wrench className="h-4 w-4 text-blue-600" />
                      )}
                      {watch("project_type") === "finishing"
                        ? "مشاريع تشطيبات (نسبة مئوية مضافة)"
                        : "مشاريع مقاولات (حسب البنود الفردية)"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      محدد تلقائياً
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {watch("project_type") === "finishing"
                      ? "تم تحديد النوع تلقائياً من سياق مشاريع التشطيبات"
                      : "تم تحديد النوع تلقائياً من سياق مشاريع المقاولات"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Select
                    value={watch("project_type") || ""}
                    onValueChange={(value: "contracting" | "finishing") => {
                      setValue("project_type", value, { shouldValidate: true, shouldDirty: true });
                      if (value === "contracting") {
                        setValue("finishing_percentage", 0);
                      }
                    }}
                  >
                    <SelectTrigger dir="rtl" className={errors.project_type ? "border-destructive" : ""}>
                      <SelectValue placeholder="اختر نوع المشروع / الفواتير" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="contracting">
                        <span className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-blue-600" />
                          مشاريع مقاولات (حسب البنود الفردية)
                        </span>
                      </SelectItem>
                      <SelectItem value="finishing">
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          مشاريع تشطيبات (نسبة مئوية مضافة)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.project_type && (
                    <p className="text-sm text-destructive">{errors.project_type.message}</p>
                  )}
                </div>
              )}
            </div>
            
            {watch("project_type") === "finishing" && (
              <div className="space-y-2">
                <Label htmlFor="finishing_percentage" className="font-semibold text-foreground">
                  نسبة الإشراف / التشطيب (%) *
                </Label>
                <Input
                  id="finishing_percentage"
                  type="number"
                  placeholder="مثال: 10"
                  {...register("finishing_percentage")}
                  className="text-base font-bold"
                />
                {errors.finishing_percentage && (
                  <p className="text-sm text-destructive">{errors.finishing_percentage.message}</p>
                )}
              </div>
            )}

            {/* Default Treasury Section */}
            <div className="space-y-2">
              <Label htmlFor="default_treasury_id" className="flex items-center gap-1.5 font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                الخزينة الافتراضية للمشروع
              </Label>
              {isSettingsLoading ? (
                <div className="h-10 flex items-center gap-2 px-3 rounded-lg border border-border bg-muted/40 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>جاري جلب الخزينة الافتراضية للقطاع...</span>
                </div>
              ) : resolvedTreasuryId && resolvedTreasury ? (
                <div className="space-y-1.5">
                  <div className="h-10 flex items-center justify-between px-3 rounded-lg border border-primary/30 bg-primary/5 text-foreground text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {resolvedTreasury.treasury_type === "bank" ? (
                        <Landmark className="h-4 w-4 text-primary" />
                      ) : (
                        <Wallet className="h-4 w-4 text-primary" />
                      )}
                      <span className="font-bold">{resolvedTreasury.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[11px] bg-primary/10 border-primary/20 text-primary">
                      خزينة رئيسية افتراضية
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    المراحل والعمليات المالية الجديدة سترتبط تلقائياً بهذه الخزينة
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="h-10 flex items-center gap-2 px-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <span className="text-xs">
                      {projectType === "contracting"
                        ? "لم يتم العثور على خزينة افتراضية صالحة لقطاع المقاولات"
                        : "لم يتم العثور على خزينة افتراضية صالحة لقطاع التشطيبات"}
                    </span>
                  </div>
                  <p className="text-xs text-destructive">
                    يرجى تعيين الخزينة الرئيسية في شاشة الإعدادات العامة للمنظومة
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client_id" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                العميل
              </Label>
              <Select
                value={watch("client_id") || ""}
                onValueChange={(value) => setValue("client_id", value, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervising_engineer_id" className="flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5 text-muted-foreground" />
                المهندس المشرف
              </Label>
              <Select
                value={watch("supervising_engineer_id") || "none"}
                onValueChange={(value) =>
                  setValue("supervising_engineer_id", value === "none" ? "" : value, { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المهندس المشرف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بلا</SelectItem>
                  {engineers?.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      {engineer.name} {engineer.specialty ? `(${engineer.specialty})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <Card className="p-5 space-y-4">
          <SectionTitle icon={Calendar} title="الحالة والتفاصيل" />

          <div className="grid gap-4 md:grid-cols-3">
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

          <div className="grid gap-4 md:grid-cols-2">
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
                    يُحسب تلقائياً من المشتريات والمصروفات
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Section: Image & Notes (collapsed for new, shown for edit) */}
        <Card className="p-5 space-y-4">
          <SectionTitle icon={Image} title="الصورة والملاحظات" />

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Image className="h-4 w-4 text-primary" />
                صورة المشروع
              </Label>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* File picker */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  id="project-image-file-picker"
                  className="hidden"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => document.getElementById("project-image-file-picker")?.click()}
                  className="cursor-pointer gap-2 hover:bg-primary/10"
                >
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                  تحميل صورة
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={handlePasteFromClipboard}
                  className="cursor-pointer gap-2 hover:bg-primary/10"
                >
                  <Clipboard className="h-4 w-4 text-muted-foreground" />
                  لصق صورة أو رابط
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                  className="cursor-pointer gap-2 text-muted-foreground"
                >
                  <Link2 className="h-4 w-4" />
                  {showImageUrlInput ? "إخفاء خانة الرابط" : "إدخال رابط يدوياً"}
                </Button>

                {watch("image_url") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearImage}
                    className="cursor-pointer gap-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    إزالة الصورة
                  </Button>
                )}
              </div>
            </div>

            {/* Hidden Input toggled by state */}
            {showImageUrlInput && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="image_url" className="text-xs text-muted-foreground">رابط الصورة المباشر (URL)</Label>
                <Input
                  id="image_url"
                  {...register("image_url")}
                  placeholder="https://example.com/image.jpg"
                  className="border-border text-left"
                  dir="ltr"
                />
              </div>
            )}

            {/* Preview Section */}
            {watch("image_url") && (
              <div className="relative group w-40 h-28 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={watch("image_url")}
                  alt="معاينة صورة المشروع"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="ملاحظات إضافية عن المشروع..."
              rows={2}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 sticky bottom-4 z-10">
          <Button
            type="submit"
            disabled={isPending}
            className="gap-2 flex-1 md:flex-none md:min-w-[200px] h-11"
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
            className="gap-2 cursor-pointer"
            onClick={() => handleSafeClose(() => navigate(getReturnPath()))}
          >
            <X className="h-4 w-4" />
            إلغاء
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog
        open={showUnsavedPrompt}
        onOpenChange={setShowConfirmDialog}
        onConfirmDiscard={confirmUnsavedNavigation}
        onStay={cancelUnsavedNavigation}
      />
    </div>
  );

  if (isEdit) {
    return <ProjectWorkspaceLayout>{formContent}</ProjectWorkspaceLayout>;
  }

  return formContent;
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
