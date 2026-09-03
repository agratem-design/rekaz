import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { clearImageUploadCache } from "@/services/imageUploadService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Sliders,
  UserCog,
  History,
  Printer,
  ScrollText,
  Compass,
  ListChecks,
  Save,
  Loader2,
  ArrowRight,
  ExternalLink,
  Check,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  ShieldAlert,
  Database,
  Cloud,
  Wallet,
  Landmark,
  Coins,
  TrendingUp,
  Wrench,
  Plus,
  Edit,
  Power,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const Settings = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local states for settings fields
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyTagline, setCompanyTagline] = useState("");
  const [signeeName, setSigneeName] = useState("");
  const [signeeTitle, setSigneeTitle] = useState("");
  
  const [imageUploadProvider, setImageUploadProvider] = useState("supabase_storage");
  const [imgbbApiKey, setImgbbApiKey] = useState("");
  const [freeimageApiKey, setFreeimageApiKey] = useState("");
  const [postimagesApiKey, setPostimagesApiKey] = useState("");
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState("");
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState("");
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState("");
  const [googleDriveScriptUrl, setGoogleDriveScriptUrl] = useState("");
  
  const [themeColor, setThemeColor] = useState("#d6ac40");
  const [defaultTheme, setDefaultTheme] = useState("light");
  
  const [contractingTreasuryId, setContractingTreasuryId] = useState("");
  const [finishingTreasuryId, setFinishingTreasuryId] = useState("");

  // Show/Hide API Key States
  const [showImgbbKey, setShowImgbbKey] = useState(false);
  const [showFreeimageKey, setShowFreeimageKey] = useState(false);
  const [showPostimagesKey, setShowPostimagesKey] = useState(false);
  const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);

  // Technician Specialties Master Data States
  const [isSpecialtyModalOpen, setIsSpecialtyModalOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<any | null>(null);
  const [specName, setSpecName] = useState("");
  const [specDesc, setSpecDesc] = useState("");
  const [specCode, setSpecCode] = useState("");

  const { data: technicianTypesList = [], isLoading: isLoadingTypes } = useQuery<any[]>({
    queryKey: ["technician-types-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_types" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const saveSpecialtyMutation = useMutation({
    mutationFn: async () => {
      if (!specName.trim()) throw new Error("يرجى إدخال اسم التخصص");
      if (editingSpecialty) {
        const { error } = await (supabase
          .from("technician_types" as any)
          .update({
            name: specName.trim(),
            description: specDesc.trim() || null,
          } as any)
          .eq("id", editingSpecialty.id));
        if (error) throw error;
      } else {
        const generatedCode = specCode.trim() || `type_${Date.now()}`;
        const { error } = await (supabase
          .from("technician_types" as any)
          .insert({
            name: specName.trim(),
            description: specDesc.trim() || null,
            code: generatedCode,
            is_active: true,
          } as any));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-types-settings"] });
      queryClient.invalidateQueries({ queryKey: ["technician-types"] });
      toast.success(editingSpecialty ? "تم تحديث التخصص بنجاح" : "تمت إضافة التخصص بنجاح");
      setIsSpecialtyModalOpen(false);
      setEditingSpecialty(null);
      setSpecName("");
      setSpecDesc("");
      setSpecCode("");
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ التخصص");
    },
  });

  const toggleSpecialtyActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase
        .from("technician_types" as any)
        .update({ is_active: !is_active } as any)
        .eq("id", id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-types-settings"] });
      queryClient.invalidateQueries({ queryKey: ["technician-types"] });
      toast.success("تم تحديث حالة التخصص");
    },
  });

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
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

  // Fetch parent treasuries for selection
  const { data: treasuries } = useQuery({
    queryKey: ["parent-treasuries-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, is_active")
        .is("parent_id", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Set initial states when data is loaded
  useEffect(() => {
    if (settings) {
      const sData = settings as any;
      setCompanyName(sData.company_name || "");
      setCompanyLogo(sData.company_logo || "");
      setCompanyPhone(sData.company_phone || "");
      setCompanyAddress(sData.company_address || "");
      setCompanyTagline(sData.company_tagline || "");
      setImageUploadProvider(sData.image_upload_provider || "supabase_storage");
      setImgbbApiKey(sData.imgbb_api_key || "");
      setFreeimageApiKey(sData.freeimage_api_key || "");
      setPostimagesApiKey(sData.postimages_api_key || "");
      setCloudinaryCloudName(sData.cloudinary_cloud_name || "");
      setCloudinaryApiKey(sData.cloudinary_api_key || "");
      setCloudinaryUploadPreset(sData.cloudinary_upload_preset || "");
      setThemeColor(sData.theme_color || "#d6ac40");
      setDefaultTheme(sData.default_theme || "light");
      setGoogleDriveScriptUrl(sData.google_drive_script_url || "");
      setContractingTreasuryId(sData.contracting_treasury_id || "");
      setFinishingTreasuryId(sData.finishing_treasury_id || "");
      setSigneeName(sData.signee_name || "");
      setSigneeTitle(sData.signee_title || "");
    }
  }, [settings]);

  // Handle Logo file upload
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 1.5 ميجابايت");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCompanyLogo(event.target?.result as string);
        toast.success("تم تحميل الشعار في الذاكرة المؤقتة. يرجى الضغط على حفظ لحفظ التغييرات.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("لم يتم العثور على سجل الإعدادات في النظام.");
      if (!isAdmin) throw new Error("عذراً، يجب أن تكون مسؤول نظام لحفظ الإعدادات.");

      const { error } = await supabase
        .from("company_settings")
        .update({
          company_name: companyName,
          company_logo: companyLogo || null,
          company_phone: companyPhone || null,
          company_address: companyAddress || null,
          company_tagline: companyTagline || null,
          image_upload_provider: imageUploadProvider || null,
          imgbb_api_key: imgbbApiKey || null,
          freeimage_api_key: freeimageApiKey || null,
          postimages_api_key: postimagesApiKey || null,
          cloudinary_cloud_name: cloudinaryCloudName || null,
          cloudinary_api_key: cloudinaryApiKey || null,
          cloudinary_upload_preset: cloudinaryUploadPreset || null,
          theme_color: themeColor || null,
          default_theme: defaultTheme || "light",
          google_drive_script_url: googleDriveScriptUrl || null,
          contracting_treasury_id: contractingTreasuryId || null,
          finishing_treasury_id: finishingTreasuryId || null,
          signee_name: signeeName || null,
          signee_title: signeeTitle || null,
        } as any)
        .eq("id", settings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      clearImageUploadCache();
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("تم حفظ إعدادات النظام بنجاح");
    },
    onError: (error: any) => {
      toast.error(`حدث خطأ أثناء حفظ الإعدادات: ${error.message}`);
    }
  });

  const handleSave = () => {
    if (!companyName.trim()) {
      toast.error("اسم المؤسسة حقل مطلوب");
      return;
    }
    updateMutation.mutate();
  };

  // Loading skeleton screen
  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="h-10 w-full max-w-2xl bg-muted animate-pulse rounded mb-6" />
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="h-6 w-36 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-80 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Predefined theme color presets
  const themePresets = [
    { name: "ذهبي الفارس (الافتراضي)", hex: "#d6ac40" },
    { name: "ذهبي داكن", hex: "#b8860b" },
    { name: "أزرق ملكي", hex: "#1e3a8a" },
    { name: "أخضر زمردي", hex: "#065f46" },
    { name: "رصاصي داكن", hex: "#374151" },
    { name: "بنفسجي إمبراطوري", hex: "#5b21b6" },
  ];

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header section with back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer p-0"
              onClick={() => navigate(-1)}
            >
              <ArrowRight className="h-4 w-4" />
              <span>العودة للرئيسية</span>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">إعدادات النظام العامة</h1>
          <p className="text-muted-foreground">التحكم في بيانات المؤسسة ومزودي الخدمات البرمجية للملفات والمظهر العام</p>
        </div>

        {isAdmin && (
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/95 transition-all self-start sm:self-center"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ إعدادات النظام
          </Button>
        )}
      </div>

      {/* Non-admin alert warning */}
      {!isAdmin && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">تنبيه: وضع العرض فقط</p>
            <p className="mt-0.5 opacity-90">أنت تتصفح الإعدادات بصلاحيات محدودة. يلزم وجود حساب مسؤول (Admin) للتمكن من تعديل وحفظ إعدادات النظام.</p>
          </div>
        </div>
      )}

      {/* Main Tabbed settings */}
      <Tabs defaultValue="company" className="w-full" dir="rtl">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 w-full bg-secondary border border-border p-1 rounded-lg">
          <TabsTrigger value="company" className="gap-2 cursor-pointer transition-all">
            <Building2 className="h-4 w-4" />
            بيانات المؤسسة
          </TabsTrigger>
          <TabsTrigger value="image-api" className="gap-2 cursor-pointer transition-all">
            <ImageIcon className="h-4 w-4" />
            رفع الصور
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-2 cursor-pointer transition-all">
            <Palette className="h-4 w-4" />
            مظهر النظام
          </TabsTrigger>
          <TabsTrigger value="financial-sync" className="gap-2 cursor-pointer transition-all">
            <Wallet className="h-4 w-4" />
            الربط المالي
          </TabsTrigger>
          <TabsTrigger value="technician-types" className="gap-2 cursor-pointer transition-all">
            <Wrench className="h-4 w-4" />
            تخصصات الفنيين
          </TabsTrigger>
          <TabsTrigger value="admin-tools" className="gap-2 cursor-pointer transition-all">
            <Sliders className="h-4 w-4" />
            أدوات الإدارة
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Company Profile */}
        <TabsContent value="company" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Building2 className="h-5 w-5 text-primary" />
                البيانات الأساسية للمؤسسة
              </CardTitle>
              <CardDescription>
                تُعرض هذه البيانات بشكل تلقائي في ترويسات وجداول التقارير والطباعة ونماذج العقود.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-sm font-semibold">اسم المؤسسة / الشركة <span className="text-destructive">*</span></Label>
                  <Input
                    id="company-name"
                    disabled={!isAdmin}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="أدخل اسم الشركة الرسمي..."
                    className="border-border bg-background focus:ring-primary focus:border-primary text-right"
                  />
                </div>

                {/* Company Tagline */}
                <div className="space-y-2">
                  <Label htmlFor="company-tagline" className="text-sm font-semibold">الشعار الفرعي أو الوصف العام</Label>
                  <Input
                    id="company-tagline"
                    disabled={!isAdmin}
                    value={companyTagline}
                    onChange={(e) => setCompanyTagline(e.target.value)}
                    placeholder="مثال: للمقاولات العامة والتجهيزات الكهروميكانيكية..."
                    className="border-border bg-background focus:ring-primary focus:border-primary text-right"
                  />
                </div>

                {/* Company Phone */}
                <div className="space-y-2">
                  <Label htmlFor="company-phone" className="text-sm font-semibold">رقم الهاتف للتواصل</Label>
                  <Input
                    id="company-phone"
                    disabled={!isAdmin}
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="أدخل رقم الهاتف للاتصال والواتساب..."
                    className="border-border bg-background focus:ring-primary focus:border-primary text-left"
                    dir="ltr"
                  />
                </div>

                {/* Company Address */}
                <div className="space-y-2">
                  <Label htmlFor="company-address" className="text-sm font-semibold">العنوان والموقع الجغرافي</Label>
                  <Input
                    id="company-address"
                    disabled={!isAdmin}
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="مثال: طرابلس، ليبيا - شارع النصر..."
                    className="border-border bg-background focus:ring-primary focus:border-primary text-right"
                  />
                </div>

                {/* Signee Name */}
                <div className="space-y-2">
                  <Label htmlFor="signee-name" className="text-sm font-semibold">اسم الموقّع الافتراضي للفواتير</Label>
                  <Input
                    id="signee-name"
                    disabled={!isAdmin}
                    value={signeeName}
                    onChange={(e) => setSigneeName(e.target.value)}
                    placeholder="مثال: علي بن عروس شميله..."
                    className="border-border bg-background focus:ring-primary focus:border-primary text-right"
                  />
                </div>

                {/* Signee Title */}
                <div className="space-y-2">
                  <Label htmlFor="signee-title" className="text-sm font-semibold">صفة الموقّع الافتراضي</Label>
                  <Input
                    id="signee-title"
                    disabled={!isAdmin}
                    value={signeeTitle}
                    onChange={(e) => setSigneeTitle(e.target.value)}
                    placeholder="مثال: المهندس المشرف..."
                    className="border-border bg-background focus:ring-primary focus:border-primary text-right"
                  />
                </div>
              </div>

              {/* Company Logo Upload & Preview */}
              <div className="space-y-3 border-t border-border pt-6">
                <Label className="text-sm font-semibold">شعار المؤسسة الرسمي</Label>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  
                  {/* Logo Preview */}
                  <div className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {companyLogo ? (
                      <>
                        <img src={companyLogo} alt="شعار المؤسسة" className="w-full h-full object-contain p-1" />
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            onClick={() => setCompanyLogo("")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
                        <ImageIcon className="h-8 w-8 opacity-30" />
                        <span className="text-[10px] text-muted-foreground/60">لا يوجد شعار</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  {isAdmin && (
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          id="logo-file-picker"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="cursor-pointer gap-2"
                          onClick={() => document.getElementById("logo-file-picker")?.click()}
                        >
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          تحميل صورة الشعار
                        </Button>
                        
                        <div className="flex-1">
                          <Input
                            placeholder="أو الصق رابط URL مباشر للشعار..."
                            value={companyLogo.startsWith("data:") ? "" : companyLogo}
                            onChange={(e) => setCompanyLogo(e.target.value)}
                            className="border-border bg-background focus:ring-primary focus:border-primary text-left"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ينصح باستخدام صورة مربعة ذات خلفية شفافة (PNG) وبحجم لا يتجاوز 1.5 ميجابايت لضمان ظهورها بشكل صحيح في التقارير المطبوعة.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button inside Card */}
              {isAdmin && (
                <div className="flex justify-end border-t border-border pt-4 mt-6">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="cursor-pointer gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    حفظ التغييرات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Image API Config */}
        <TabsContent value="image-api" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <ImageIcon className="h-5 w-5 text-primary" />
                إعدادات مزود رفع الصور والمستندات
              </CardTitle>
              <CardDescription>
                تحديد وضبط مزود رفع الملفات لاستخدامه في التقارير، العقود، اللوحات، والمرفقات المختلفة بالنظام.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              
              {/* Select Provider Toggle Grid */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">مزود خدمة الرفع النشط حالياً</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  
                  {/* Supabase Storage Option */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setImageUploadProvider("supabase_storage")}
                    className={`flex flex-col items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer text-center ${
                      imageUploadProvider === "supabase_storage"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <Database className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-bold block mb-1">Supabase Storage</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">تخزين داخلي (موصى به)</span>
                  </button>

                  {/* Google Drive Option */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setImageUploadProvider("google_drive")}
                    className={`flex flex-col items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer text-center ${
                      imageUploadProvider === "google_drive"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <Cloud className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-bold block mb-1">Google Drive</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Apps Script Web App</span>
                  </button>

                  {/* ImgBB Option */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setImageUploadProvider("imgbb")}
                    className={`flex flex-col items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer text-center ${
                      imageUploadProvider === "imgbb"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <ImageIcon className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-bold block mb-1">ImgBB API</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">سهل وسريع للصور</span>
                  </button>

                  {/* Cloudinary Option */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setImageUploadProvider("cloudinary")}
                    className={`flex flex-col items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer text-center ${
                      imageUploadProvider === "cloudinary"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <Upload className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-bold block mb-1">Cloudinary</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">متقدم للمؤسسات</span>
                  </button>

                  {/* FreeImage Option */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setImageUploadProvider("freeimage")}
                    className={`flex flex-col items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer text-center ${
                      imageUploadProvider === "freeimage"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <ImageIcon className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-bold block mb-1">FreeImage</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">مساحة مجانية للملفات</span>
                  </button>

                  {/* PostImages Option */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setImageUploadProvider("postimages")}
                    className={`flex flex-col items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer text-center ${
                      imageUploadProvider === "postimages"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <ImageIcon className="h-6 w-6 text-primary mb-2" />
                    <span className="text-xs font-bold block mb-1">PostImages</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">سيرفرات صور مباشرة</span>
                  </button>
                </div>
              </div>

              {/* Conditional Inputs */}
              <div className="border-t border-border pt-6 mt-6 space-y-6">
                
                {/* Supabase Storage */}
                {imageUploadProvider === "supabase_storage" && (
                  <div className="space-y-3 max-w-2xl p-5 rounded-xl bg-primary/5 border border-primary/20">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      مساحة التخزين الداخلية لـ Supabase (البكت: images)
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      يتم رفع جميع الصور وعقود العمل والمستندات مباشرة إلى السحابة الداخلية الملحقة بقاعدة بيانات النظام.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      لا يتطلب هذا الخيار خدمات طرف ثالث أو مفاتيح API إضافية، وهو مفعّل وجاهز للاستخدام الفوري لسهولة الأرشفة.
                    </p>
                  </div>
                )}

                {/* Google Drive */}
                {imageUploadProvider === "google_drive" && (
                  <div className="space-y-4 max-w-2xl">
                    <h3 className="text-sm font-bold text-foreground">إعدادات قوقل درايف (عبر Apps Script Web App)</h3>
                    
                    {/* General Script URL */}
                    <div className="space-y-2">
                      <Label htmlFor="drive-script-url" className="text-sm font-semibold">رابط Apps Script العام (Web App URL)</Label>
                      <Input
                        id="drive-script-url"
                        disabled={!isAdmin}
                        value={googleDriveScriptUrl}
                        onChange={(e) => setGoogleDriveScriptUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="border-border bg-background text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {/* ImgBB Fields */}
                {imageUploadProvider === "imgbb" && (
                  <div className="space-y-3 max-w-2xl">
                    <h3 className="text-sm font-bold text-foreground">إعدادات مزود ImgBB</h3>
                    <div className="space-y-2">
                      <Label htmlFor="imgbb-key" className="text-sm font-semibold">مفتاح API الخاص بـ ImgBB (API Key)</Label>
                      <div className="relative">
                        <Input
                          id="imgbb-key"
                          type={showImgbbKey ? "text" : "password"}
                          disabled={!isAdmin}
                          value={imgbbApiKey}
                          onChange={(e) => setImgbbApiKey(e.target.value)}
                          placeholder="أدخل مفتاح الـ API..."
                          className="border-border bg-background text-left pr-3 pl-10"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowImgbbKey(!showImgbbKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                        >
                          {showImgbbKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        يمكنك الحصول على المفتاح مجاناً من خلال حسابك في موقع <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">imgbb.com <ExternalLink className="h-3 w-3" /></a>
                      </p>
                    </div>
                  </div>
                )}

                {/* FreeImage Fields */}
                {imageUploadProvider === "freeimage" && (
                  <div className="space-y-3 max-w-2xl">
                    <h3 className="text-sm font-bold text-foreground">إعدادات مزود FreeImage</h3>
                    <div className="space-y-2">
                      <Label htmlFor="freeimage-key" className="text-sm font-semibold">مفتاح API الخاص بـ FreeImage (API Key)</Label>
                      <div className="relative">
                        <Input
                          id="freeimage-key"
                          type={showFreeimageKey ? "text" : "password"}
                          disabled={!isAdmin}
                          value={freeimageApiKey}
                          onChange={(e) => setFreeimageApiKey(e.target.value)}
                          placeholder="أدخل مفتاح الـ API لـ FreeImage..."
                          className="border-border bg-background text-left pr-3 pl-10"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFreeimageKey(!showFreeimageKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                        >
                          {showFreeimageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        يتطلب الحصول على حساب ومفتاح API من موقع <a href="https://freeimage.host/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">freeimage.host <ExternalLink className="h-3 w-3" /></a>
                      </p>
                    </div>
                  </div>
                )}

                {/* PostImages Fields */}
                {imageUploadProvider === "postimages" && (
                  <div className="space-y-3 max-w-2xl">
                    <h3 className="text-sm font-bold text-foreground">إعدادات مزود PostImages</h3>
                    <div className="space-y-2">
                      <Label htmlFor="postimages-key" className="text-sm font-semibold">مفتاح API الخاص بـ PostImages (API Key / Auth)</Label>
                      <div className="relative">
                        <Input
                          id="postimages-key"
                          type={showPostimagesKey ? "text" : "password"}
                          disabled={!isAdmin}
                          value={postimagesApiKey}
                          onChange={(e) => setPostimagesApiKey(e.target.value)}
                          placeholder="أدخل رمز المصادقة المخصص..."
                          className="border-border bg-background text-left pr-3 pl-10"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPostimagesKey(!showPostimagesKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                        >
                          {showPostimagesKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cloudinary Fields */}
                {imageUploadProvider === "cloudinary" && (
                  <div className="space-y-4 max-w-2xl">
                    <h3 className="text-sm font-bold text-foreground">إعدادات مزود Cloudinary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Cloud Name */}
                      <div className="space-y-2">
                        <Label htmlFor="cloudinary-cloud" className="text-sm font-semibold">اسم السحابة (Cloud Name)</Label>
                        <Input
                          id="cloudinary-cloud"
                          disabled={!isAdmin}
                          value={cloudinaryCloudName}
                          onChange={(e) => setCloudinaryCloudName(e.target.value)}
                          placeholder="مثال: cloud_name_here"
                          className="border-border bg-background text-left"
                          dir="ltr"
                        />
                      </div>

                      {/* Upload Preset */}
                      <div className="space-y-2">
                        <Label htmlFor="cloudinary-preset" className="text-sm font-semibold">بادئة الرفع (Upload Preset)</Label>
                        <Input
                          id="cloudinary-preset"
                          disabled={!isAdmin}
                          value={cloudinaryUploadPreset}
                          onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
                          placeholder="مثال: preset_unsigned"
                          className="border-border bg-background text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                      <Label htmlFor="cloudinary-key" className="text-sm font-semibold">مفتاح API الخاص بـ Cloudinary</Label>
                      <div className="relative">
                        <Input
                          id="cloudinary-key"
                          type={showCloudinaryKey ? "text" : "password"}
                          disabled={!isAdmin}
                          value={cloudinaryApiKey}
                          onChange={(e) => setCloudinaryApiKey(e.target.value)}
                          placeholder="أدخل مفتاح الـ API الخاص بـ Cloudinary..."
                          className="border-border bg-background text-left pr-3 pl-10"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCloudinaryKey(!showCloudinaryKey)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
                        >
                          {showCloudinaryKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        أدخل تفاصيل الاتصال التي توفرها لوحة تحكم موقع <a href="https://cloudinary.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">cloudinary.com <ExternalLink className="h-3 w-3" /></a>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button inside Card */}
              {isAdmin && (
                <div className="flex justify-end border-t border-border pt-4 mt-6">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="cursor-pointer gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    حفظ التغييرات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Appearance & Theme */}
        <TabsContent value="theme" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Palette className="h-5 w-5 text-primary" />
                مظهر وألوان النظام
              </CardTitle>
              <CardDescription>
                تخصيص اللمسات والسمات اللونية المعتمدة للواجهات والتقارير الرسمية المصدرة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              
              {/* Predefined colors */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">اختيار اللون الأساسي لهوية النظام (Theme Color)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {themePresets.map((preset) => {
                    const isSelected = themeColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setThemeColor(preset.hex)}
                        className={`flex flex-col items-center justify-between p-3.5 rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-background hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full shadow-inner flex items-center justify-center mb-2"
                          style={{ backgroundColor: preset.hex }}
                        >
                          {isSelected && <Check className="h-4 w-4 text-white" />}
                        </div>
                        <span className="text-xs font-medium text-foreground">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom hex color */}
              <div className="max-w-md space-y-3 border-t border-border pt-6 mt-6">
                <Label htmlFor="custom-color" className="text-sm font-semibold">رمز لون مخصص (Hex Code)</Label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input
                      id="custom-color"
                      disabled={!isAdmin}
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      placeholder="#d6ac40"
                      className="border-border bg-background text-left pl-3"
                      dir="ltr"
                    />
                  </div>
                  <input
                    type="color"
                    disabled={!isAdmin}
                    value={themeColor.startsWith('#') && themeColor.length === 7 ? themeColor : '#d6ac40'}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-10 h-10 p-0.5 border border-border rounded-lg cursor-pointer shrink-0 bg-background"
                    title="اختر لوناً من منتقي الألوان"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  تأكد من إدخال رمز اللون بالصيغة الست عشرية بشكل صحيح (مثل: #d6ac40) لتجنب أخطاء العرض.
                </p>
              </div>

              {/* Default Theme Mode */}
              <div className="max-w-md space-y-3 border-t border-border pt-6 mt-6">
                <Label htmlFor="default-theme" className="text-sm font-semibold">الوضع الافتراضي للنظام (عند التحميل الأول)</Label>
                <Select
                  value={defaultTheme}
                  disabled={!isAdmin}
                  onValueChange={setDefaultTheme}
                >
                  <SelectTrigger id="default-theme" className="border-border bg-background">
                    <SelectValue placeholder="اختر الوضع الافتراضي..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">فاتح (Light Mode)</SelectItem>
                    <SelectItem value="dark">مظلم (Dark Mode)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  يحدد الوضع اللوني الافتراضي للواجهات عند فتح النظام لأول مرة على المتصفح.
                </p>
              </div>

              {/* Action Button inside Card */}
              {isAdmin && (
                <div className="flex justify-end border-t border-border pt-4 mt-6">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="cursor-pointer gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    حفظ التغييرات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Financial Sync Settings */}
        <TabsContent value="financial-sync" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Coins className="h-5 w-5 text-primary" />
                إعدادات الربط المالي وتوزيع الخزائن
              </CardTitle>
              <CardDescription>
                تخصيص وتثبيت الخزائن الافتراضية العامة المربوطة بمشاريع المقاولات ومشاريع التشطيبات.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Contracting Default Treasury */}
                <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">مشاريع المقاولات</h4>
                      <p className="text-xs text-muted-foreground">الخزينة الافتراضية المرتبطة بفواتير وبنود المقاولات</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="contracting_treasury">اختر الخزينة الرئيسية</Label>
                    <Select
                      value={contractingTreasuryId || "__none__"}
                      onValueChange={(val) => setContractingTreasuryId(val === "__none__" ? "" : val)}
                    >
                      <SelectTrigger dir="rtl" className="bg-background">
                        <SelectValue placeholder="اختر الخزينة للمقاولات" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="__none__">بدون خزينة افتراضية</SelectItem>
                        {treasuries?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              {t.treasury_type === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                              {t.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Finishing Default Treasury */}
                <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Palette className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">مشاريع التشطيبات</h4>
                      <p className="text-xs text-muted-foreground">الخزينة الافتراضية المرتبطة بفواتير التشطيبات بالنسبة المئوية</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="finishing_treasury">اختر الخزينة الرئيسية</Label>
                    <Select
                      value={finishingTreasuryId || "__none__"}
                      onValueChange={(val) => setFinishingTreasuryId(val === "__none__" ? "" : val)}
                    >
                      <SelectTrigger dir="rtl" className="bg-background">
                        <SelectValue placeholder="اختر الخزينة للتشطيبات" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="__none__">بدون خزينة افتراضية</SelectItem>
                        {treasuries?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              {t.treasury_type === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                              {t.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-600 dark:text-yellow-500">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p className="text-xs">
                  ملاحظة: هذا الخيار يُثبّت خزينة افتراضية عامة على مستوى النظام بالكامل. سيتم تلقائياً ربط أي فواتير مراحل جديدة بالخزينة المختارة هنا بناءً على نوع المشروع، مع إمكانية تعديلها يدوياً للمرحلة لاحقاً إذا لزم الأمر.
                </p>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button 
                    onClick={handleSave} 
                    disabled={updateMutation.isPending}
                    className="gap-2"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ إعدادات الربط المالي
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Admin tools */}
        <TabsContent value="admin-tools" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Sliders className="h-5 w-5 text-primary" />
                أدوات التحكم وإدارة النظام
              </CardTitle>
              <CardDescription>
                روابط سريعة لأدوات التحكم المخصصة لمدير النظام لتعديل الهيكل الأساسي للنظام ومتابعة النشاط.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              
              {/* Quick links grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1. User Management */}
                <Link to="/users" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <UserCog className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">إدارة المستخدمين والصلاحيات</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        تعديل وإضافة مستخدمي النظام، تغيير أدوار الموظفين وتغيير كلمات السر.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 2. Audit Logs */}
                <Link to="/audit-log" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <History className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">سجل الرقابة والنشاط</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        متابعة السجلات التاريخية لجميع عمليات قواعد البيانات والمستخدمين لتأمين الحسابات.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 3. Print Design Settings */}
                <Link to="/print-design" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <Printer className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">إعدادات وتصميم الطباعة</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        تصميم وتخصيص هوامش التقارير، خلفية الأوراق، وتنسيق ألوان جداول المخرجات.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 4. Contract Templates */}
                <Link to="/contract-templates" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <ScrollText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">قوالب شروط العقود</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        بناء بنود وشروط قياسية جاهزة لإدراجها تلقائياً عند صياغة عقود المشاريع الجديدة.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 5. Measurement Configurations */}
                <Link to="/measurement-types" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">وحدات القياس والمعادلات</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        تخصيص وحدات القياس (متر طولي، متر مسطح، مقطوعية) وصيغ الحساب ومكوناتها الرياضية.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 6. General Project Items */}
                <Link to="/general-items" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">البنود العامة للمشاريع</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        إعداد قائمة العناصر العامة مثل (بند الخرسانة، بند الطلاء) ليسهل استدعاؤها في بنود التسعير.
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 7. Database Backup */}
                <Link to="/database-backup" className="group">
                  <div className="h-full flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <Database className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">النسخ الاحتياطي لقاعدة البيانات</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        التحكم في النسخ الاحتياطي الصامت لتطبيق سطح المكتب، المزامنة مع Google Drive واستعادة البيانات.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Technician Types Master Data */}
        <TabsContent value="technician-types" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Wrench className="h-5 w-5 text-primary" />
                  دليل تخصصات الفنيين المعتمدة
                </CardTitle>
                <CardDescription>
                  إدارة وتخصيص المهن والتخصصات الفنية المعتمدة لإسناد الأعمال ومتابعة نسب الإنجاز.
                </CardDescription>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingSpecialty(null);
                    setSpecName("");
                    setSpecDesc("");
                    setSpecCode("");
                    setIsSpecialtyModalOpen(true);
                  }}
                  className="gap-1.5 cursor-pointer text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة تخصص جديد</span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table dir="rtl">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-bold text-xs">اسم التخصص</TableHead>
                      <TableHead className="text-right font-bold text-xs">الرمز البرمجي</TableHead>
                      <TableHead className="text-right font-bold text-xs">الوصف</TableHead>
                      <TableHead className="text-center font-bold text-xs">الحالة</TableHead>
                      {isAdmin && <TableHead className="text-left font-bold text-xs">الإجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTypes ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                          جاري تحميل التخصصات...
                        </TableCell>
                      </TableRow>
                    ) : technicianTypesList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                          لا توجد تخصصات مسجلة حالياً
                        </TableCell>
                      </TableRow>
                    ) : (
                      technicianTypesList.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-muted/20">
                          <TableCell className="font-bold text-sm text-foreground">{item.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">{item.code || "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{item.description || "-"}</TableCell>
                          <TableCell className="text-center">
                            {item.is_active ? (
                              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>نشط</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-muted-foreground/40 bg-muted text-muted-foreground font-bold text-[11px] gap-1">
                                <XCircle className="h-3 w-3" />
                                <span>معطل</span>
                              </Badge>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-left">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => {
                                    setEditingSpecialty(item);
                                    setSpecName(item.name);
                                    setSpecDesc(item.description || "");
                                    setSpecCode(item.code || "");
                                    setIsSpecialtyModalOpen(true);
                                  }}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 cursor-pointer ${item.is_active ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                                  title={item.is_active ? "تعطيل التخصص" : "تفعيل التخصص"}
                                  onClick={() => toggleSpecialtyActiveMutation.mutate({ id: item.id, is_active: item.is_active })}
                                >
                                  <Power className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG FOR ADDING / EDITING SPECIALTY */}
      <Dialog open={isSpecialtyModalOpen} onOpenChange={setIsSpecialtyModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span>{editingSpecialty ? "تعديل التخصص الفني" : "إضافة تخصص فني جديد"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              تحديد اسم التخصص والوصف لاستخدامه في نماذج الفنيين وبنود المشاريع.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم التخصص *</Label>
              <Input
                value={specName}
                onChange={(e) => setSpecName(e.target.value)}
                placeholder="مثال: فني تكييف وتبريد"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الرمز البرمجي (اختياري)</Label>
              <Input
                value={specCode}
                onChange={(e) => setSpecCode(e.target.value)}
                placeholder="hvac_technician"
                className="text-xs h-9 font-mono"
                disabled={!!editingSpecialty}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الوصف (اختياري)</Label>
              <Input
                value={specDesc}
                onChange={(e) => setSpecDesc(e.target.value)}
                placeholder="وصف مختصر للمهام والمسؤوليات"
                className="text-xs h-9"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 text-xs h-8 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={saveSpecialtyMutation.isPending || !specName.trim()}
                onClick={() => saveSpecialtyMutation.mutate()}
              >
                {saveSpecialtyMutation.isPending ? "جاري الحفظ..." : "حفظ التخصص"}
              </Button>
              <Button
                variant="outline"
                className="text-xs h-8"
                onClick={() => setIsSpecialtyModalOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
