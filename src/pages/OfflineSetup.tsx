import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase, isOfflineMode } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Download,
  Database,
  Image,
  Monitor,
  Cloud,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";

// All tables in dependency order (parents first)
const TABLE_ORDER = [
  "clients",
  "suppliers",
  "technicians",
  "engineers",
  "employees",
  "equipment",
  "materials",
  "measurement_configs",
  "general_project_items",
  "projects",
  "project_phases",
  "project_items",
  "project_item_technicians",
  "technician_progress_records",
  "project_suppliers",
  "project_technicians",
  "contracts",
  "contract_items",
  "contract_clauses",
  "contract_clause_templates",
  "treasuries",
  "treasury_transactions",
  "purchases",
  "expenses",
  "income",
  "transfers",
  "equipment_rentals",
  "project_custody",
  "client_payments",
  "client_payment_allocations",
  "company_settings",
  "profiles",
  "user_roles",
  "audit_logs",
  "cash_flow_forecast",
  "inspection_checklists",
  "checklist_items",
  "project_schedules",
  "stock_movements",
  "phase_reference_seq",
  "variation_orders",
  "risk_register",
  "invoices",
  "invoice_items",
  "gallery_images",
];

const escapeSQL = (val: any): string => {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
};

const OfflineSetup = () => {
  const [exportingData, setExportingData] = useState(false);
  const [exportingImages, setExportingImages] = useState(false);
  const [convertingImages, setConvertingImages] = useState(false);
  const [localUrl, setLocalUrl] = useState(
    localStorage.getItem("db_local_url") || "http://localhost:54321"
  );
  const [localKey, setLocalKey] = useState(
    localStorage.getItem("db_local_key") || ""
  );
  const [offlineEnabled, setOfflineEnabled] = useState(isOfflineMode);

  // Export all data as SQL
  const handleExportData = async () => {
    setExportingData(true);
    try {
      // Use the active supabase client (already has session)
      const activeClient = supabase;

      const zip = new JSZip();
      let fullSQL = "-- Rekaz Data Export\n-- Generated: " + new Date().toISOString() + "\n\n";
      fullSQL += "SET session_replication_role = 'replica';\n\n";

      let tableCount = 0;
      let totalRows = 0;

      for (const table of TABLE_ORDER) {
        try {
          // Fetch all rows (handle > 1000 with pagination)
          let allRows: any[] = [];
          let from = 0;
          const batchSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data, error } = await activeClient
              .from(table as any)
              .select("*")
              .range(from, from + batchSize - 1);

            if (error) {
              console.warn(`Skipping table ${table}: ${error.message}`);
              hasMore = false;
              break;
            }

            if (data && data.length > 0) {
              allRows = [...allRows, ...data];
              from += batchSize;
              hasMore = data.length === batchSize;
            } else {
              hasMore = false;
            }
          }

          if (allRows.length === 0) continue;

          tableCount++;
          totalRows += allRows.length;

          const columns = Object.keys(allRows[0]);
          let tableSQL = `-- Table: ${table} (${allRows.length} rows)\n`;
          tableSQL += `DELETE FROM public.${table};\n`;

          for (const row of allRows) {
            const values = columns.map((col) => escapeSQL(row[col]));
            tableSQL += `INSERT INTO public.${table} (${columns.join(", ")}) VALUES (${values.join(", ")});\n`;
          }
          tableSQL += "\n";

          fullSQL += tableSQL;
          zip.file(`tables/${table}.sql`, tableSQL);
        } catch (e) {
          console.warn(`Error exporting ${table}:`, e);
        }
      }

      fullSQL += "\nSET session_replication_role = 'origin';\n";

      zip.file("data_full_restore.sql", fullSQL);

      // Include schema file
      try {
        const schemaResponse = await fetch("/database-schema-backup.sql");
        if (schemaResponse.ok) {
          const schemaText = await schemaResponse.text();
          zip.file("database-schema-backup.sql", schemaText);
        }
      } catch {
        // Schema file not available as static asset, include a note
        console.warn("Schema file not bundled as static asset");
      }

      // Export user profiles for offline setup
      try {
        const { data: profiles } = await activeClient.from("profiles").select("*");
        if (profiles && profiles.length > 0) {
          let profilesSQL = "-- User Profiles Export\n";
          profilesSQL += "-- Use these to recreate users in local Supabase Studio\n\n";
          for (const p of profiles) {
            profilesSQL += `-- User: ${p.display_name || p.email || p.username || 'unknown'}\n`;
            profilesSQL += `--   Email: ${p.email || 'N/A'}\n`;
            profilesSQL += `--   Username: ${p.username || 'N/A'}\n`;
            profilesSQL += `--   Access Code: ${p.access_code || 'N/A'}\n\n`;
          }
          zip.file("user_accounts_reference.txt", profilesSQL);
        }
      } catch { /* skip if profiles not accessible */ }

      zip.file(
        "README.txt",
        `ملف تصدير بيانات نظام ركاز
========================
تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}
عدد الجداول: ${tableCount}
إجمالي الصفوف: ${totalRows}

الملفات:
- database-schema-backup.sql: هيكل قاعدة البيانات (الجداول والعلاقات)
- data_full_restore.sql: ملف SQL كامل لاستعادة جميع البيانات
- tables/: ملفات SQL مقسمة حسب الجدول
- user_accounts_reference.txt: مرجع حسابات المستخدمين

خطوات الاستعادة:
1. شغّل ملف database-schema-backup.sql لإنشاء هيكل قاعدة البيانات
2. شغّل ملف data_full_restore.sql لاستعادة البيانات
3. أنشئ المستخدمين يدوياً في Supabase Studio المحلي (راجع user_accounts_reference.txt)
`
      );

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `rekaz-data-export-${new Date().toISOString().split("T")[0]}.zip`);

      toast({
        title: "تم تصدير البيانات بنجاح",
        description: `${tableCount} جدول، ${totalRows} صف`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ في تصدير البيانات",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExportingData(false);
    }
  };

  // Export images
  const handleExportImages = async () => {
    setExportingImages(true);
    try {
      const activeClient = supabase;

      const zip = new JSZip();
      let imageCount = 0;
      const imageMapping: Record<string, string> = {};

      // 1. Equipment images
      const { data: equipment } = await activeClient
        .from("equipment")
        .select("id, name, image_url")
        .not("image_url", "is", null);

      if (equipment) {
        for (const eq of equipment) {
          if (!eq.image_url) continue;
          try {
            const response = await fetch(eq.image_url);
            if (response.ok) {
              const blob = await response.blob();
              const ext = eq.image_url.split(".").pop()?.split("?")[0] || "jpg";
              const filename = `equipment/${eq.id}.${ext}`;
              zip.file(filename, blob);
              imageMapping[eq.image_url] = filename;
              imageCount++;
            }
          } catch (e) {
            console.warn(`Failed to download image for equipment ${eq.id}`);
          }
        }
      }

      // 2. Company logo
      const { data: settings } = await activeClient
        .from("company_settings")
        .select("company_logo")
        .limit(1)
        .single();

      if (settings?.company_logo) {
        try {
          const response = await fetch(settings.company_logo);
          if (response.ok) {
            const blob = await response.blob();
            zip.file("company/logo.png", blob);
            imageMapping[settings.company_logo] = "company/logo.png";
            imageCount++;
          }
        } catch (e) {
          console.warn("Failed to download company logo");
        }
      }

      // 3. Storage bucket images
      try {
        const { data: storageFiles } = await activeClient.storage
          .from("images")
          .list("", { limit: 500 });

        if (storageFiles) {
          for (const file of storageFiles) {
            try {
              const { data } = await activeClient.storage
                .from("images")
                .download(file.name);

              if (data) {
                zip.file(`storage/${file.name}`, data);
                imageCount++;
              }
            } catch (e) {
              console.warn(`Failed to download storage file: ${file.name}`);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to list storage bucket");
      }

      // Add mapping file
      zip.file("image_mapping.json", JSON.stringify(imageMapping, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `rekaz-images-${new Date().toISOString().split("T")[0]}.zip`);

      toast({
        title: "تم تنزيل الصور بنجاح",
        description: `${imageCount} صورة`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ في تنزيل الصور",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExportingImages(false);
    }
  };

  // Convert all external image URLs to Base64
  const handleConvertImagesToBase64 = async () => {
    setConvertingImages(true);
    let converted = 0;
    try {
      const convertUrlToBase64 = async (url: string): Promise<string | null> => {
        if (!url || url.startsWith("data:")) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };

      // Equipment images
      const { data: equipment } = await supabase.from("equipment").select("id, image_url").not("image_url", "is", null);
      if (equipment) {
        for (const eq of equipment) {
          if (!eq.image_url || eq.image_url.startsWith("data:")) continue;
          const b64 = await convertUrlToBase64(eq.image_url);
          if (b64) {
            await supabase.from("equipment").update({ image_url: b64 } as any).eq("id", eq.id);
            converted++;
          }
        }
      }

      // Company logo & report_background
      const { data: settings } = await supabase.from("company_settings").select("id, company_logo, report_background").limit(1).single();
      if (settings) {
        const updates: any = {};
        if (settings.company_logo && !settings.company_logo.startsWith("data:")) {
          const b64 = await convertUrlToBase64(settings.company_logo);
          if (b64) { updates.company_logo = b64; converted++; }
        }
        if ((settings as any).report_background && !(settings as any).report_background.startsWith("data:")) {
          const b64 = await convertUrlToBase64((settings as any).report_background);
          if (b64) { updates.report_background = b64; converted++; }
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("company_settings").update(updates).eq("id", settings.id);
        }
      }

      // Projects images
      const { data: projects } = await supabase.from("projects").select("id, image_url").not("image_url", "is", null);
      if (projects) {
        for (const p of projects) {
          if (!p.image_url || p.image_url.startsWith("data:")) continue;
          const b64 = await convertUrlToBase64(p.image_url);
          if (b64) {
            await supabase.from("projects").update({ image_url: b64 } as any).eq("id", p.id);
            converted++;
          }
        }
      }

      toast({
        title: "تم تحويل الصور بنجاح",
        description: `تم تحويل ${converted} صورة إلى Base64 داخل قاعدة البيانات`,
      });
    } catch (error: any) {
      toast({
        title: "خطأ في تحويل الصور",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setConvertingImages(false);
    }
  };


  // Toggle offline mode
  const handleToggleMode = (checked: boolean) => {
    if (checked && !localKey) {
      toast({
        title: "أدخل Anon Key",
        description: "يجب إدخال مفتاح Anon Key للخادم المحلي (يظهر عند تشغيل supabase start)",
        variant: "destructive",
      });
      return;
    }

    if (checked) {
      localStorage.setItem("db_mode", "offline");
      localStorage.setItem("db_local_url", localUrl);
      localStorage.setItem("db_local_key", localKey);
    } else {
      localStorage.setItem("db_mode", "online");
    }

    toast({
      title: checked ? "جاري التبديل إلى الوضع المحلي..." : "جاري التبديل إلى السحابة...",
      description: "سيتم إعادة تحميل الصفحة",
    });

    setTimeout(() => window.location.reload(), 1000);
  };

  // Download Windows setup script
  const handleDownloadScript = () => {
    const script = `@echo off
chcp 65001 >nul
echo ==========================================
echo    إعداد بيئة ركاز المحلية - Windows
echo ==========================================
echo.

REM التحقق من وجود Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js غير مثبت. جاري التثبيت...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    echo [✓] تم تثبيت Node.js. أعد تشغيل هذا السكربت.
    pause
    exit /b
)

REM التحقق من وجود Supabase CLI
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Supabase CLI غير مثبت. جاري التثبيت...
    npm install -g supabase
    echo [✓] تم تثبيت Supabase CLI
)

REM التحقق من Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Docker غير مثبت. Supabase CLI يحتاج Docker Desktop.
    echo    حمّل Docker Desktop من: https://www.docker.com/products/docker-desktop/
    echo    بعد التثبيت، أعد تشغيل هذا السكربت.
    pause
    exit /b
)

echo.
echo [1/4] إنشاء مجلد المشروع...
if not exist "rekaz-local" mkdir rekaz-local
cd rekaz-local

echo [2/4] تهيئة Supabase محلياً...
if not exist "supabase" (
    supabase init
)

echo [3/4] تشغيل Supabase محلياً...
echo    (تأكد أن Docker Desktop يعمل)
supabase start

echo.
echo ==========================================
echo    ✅ اكتمل الإعداد بنجاح!
echo ==========================================
echo.
echo    الخطوات التالية:
echo    1. انسخ ملف database-schema-backup.sql إلى هذا المجلد
echo    2. انسخ ملف data_full_restore.sql إلى هذا المجلد
echo    3. شغّل الأوامر التالية:
echo.
echo    psql -U postgres -h localhost -p 54322 -d postgres -f database-schema-backup.sql
echo    psql -U postgres -h localhost -p 54322 -d postgres -f data_full_restore.sql
echo.
echo [4/4] تشغيل Edge Functions محلياً...
echo    (اختياري - لتشغيل وظائف مثل إنشاء المستخدمين)
if exist "supabase\\functions" (
    start /B supabase functions serve
    echo    [✓] Edge Functions تعمل محلياً
) else (
    echo    [!] مجلد Edge Functions غير موجود - تخطي
)
echo.
echo    معلومات الاتصال:
echo    📡 API URL: http://localhost:54321
echo    🗄️ DB URL: postgresql://postgres:postgres@localhost:54322/postgres
echo    🎨 Studio: http://localhost:54323
echo    🔑 Anon Key: يظهر أعلاه في مخرجات supabase start
echo.
echo    4. أنشئ المستخدمين في Studio المحلي (http://localhost:54323)
echo    5. انسخ الـ Anon Key وأدخله في صفحة "الوضع المحلي" في التطبيق
echo    6. بدّل المفتاح إلى "وضع محلي"
echo.
pause
`;

    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "setup-rekaz-local.bat");

    toast({ title: "تم تنزيل سكربت الإعداد" });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Monitor className="h-7 w-7 text-primary" />
            الوضع المحلي (Offline)
          </h1>
          <p className="text-muted-foreground mt-1">
            تبديل بين Supabase Cloud وPostgreSQL محلي عبر Supabase CLI
          </p>
        </div>
        <Badge
          variant={isOfflineMode ? "secondary" : "default"}
          className="text-sm px-3 py-1"
        >
          {isOfflineMode ? (
            <span className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              وضع محلي
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" />
              Supabase Cloud
            </span>
          )}
        </Badge>
      </div>

      {/* Warning */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-yellow-600 dark:text-yellow-400">
              تنبيه مهم
            </p>
            <p className="text-muted-foreground">
              قبل التبديل إلى الوضع المحلي، تأكد من تنزيل البيانات والصور أولاً.
              الوضع المحلي يتطلب تشغيل Supabase CLI و Docker Desktop على جهازك.
              Edge Functions لن تعمل في الوضع المحلي.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section A: Export Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              تصدير البيانات
            </CardTitle>
            <CardDescription>
              تنزيل جميع البيانات من Supabase كملف SQL جاهز للاستعادة في PostgreSQL محلي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• يتم جلب جميع الجداول ({TABLE_ORDER.length} جدول)</p>
              <p>• ترتيب الإدخال حسب العلاقات (Foreign Keys)</p>
              <p>• ملف ZIP يحتوي على SQL كامل + ملفات مقسمة</p>
            </div>
            <Button
              onClick={handleExportData}
              disabled={exportingData}
              className="w-full"
            >
              {exportingData ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Download className="h-4 w-4 ml-2" />
              )}
              {exportingData ? "جاري التصدير..." : "تنزيل البيانات كـ SQL"}
            </Button>
          </CardContent>
        </Card>

        {/* Section B: Export Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              تنزيل الصور
            </CardTitle>
            <CardDescription>
              تنزيل جميع الصور المرتبطة بالمعدات والشعار وملفات Storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• صور المعدات (equipment.image_url)</p>
              <p>• شعار الشركة</p>
              <p>• ملفات Storage bucket "images"</p>
            </div>
            <Button
              onClick={handleExportImages}
              disabled={exportingImages}
              variant="secondary"
              className="w-full"
            >
              {exportingImages ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Download className="h-4 w-4 ml-2" />
              )}
              {exportingImages ? "جاري التنزيل..." : "تنزيل الصور كـ ZIP"}
            </Button>
            <Separator />
            <Button
              onClick={handleConvertImagesToBase64}
              disabled={convertingImages}
              variant="outline"
              className="w-full"
            >
              {convertingImages ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="h-4 w-4 ml-2" />
              )}
              {convertingImages ? "جاري التحويل..." : "تحويل جميع الصور إلى Base64"}
            </Button>
            <p className="text-xs text-muted-foreground">
              يجلب كل روابط الصور الخارجية من المعدات والمشاريع والشعار، ويحولها إلى Base64 ويحفظها في القاعدة مباشرة.
            </p>
          </CardContent>
        </Card>

        {/* Section C: Connection Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              إعدادات الاتصال المحلي
            </CardTitle>
            <CardDescription>
              إعداد عنوان Supabase المحلي ومفتاح الوصول
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>عنوان API المحلي</Label>
                <Input
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  placeholder="http://localhost:54321"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  الافتراضي: http://localhost:54321
                </p>
              </div>
              <div className="space-y-2">
                <Label>Anon Key المحلي</Label>
                <Input
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  يظهر عند تشغيل: supabase start
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Cloud className="h-4 w-4 text-blue-500" />
                  <span>Supabase Cloud</span>
                </div>
                <Switch
                  checked={offlineEnabled}
                  onCheckedChange={handleToggleMode}
                />
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4 text-amber-500" />
                  <span>وضع محلي</span>
                </div>
              </div>
              <Badge variant={offlineEnabled ? "secondary" : "default"}>
                {offlineEnabled ? "محلي" : "سحابي"}
              </Badge>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                عند التبديل، سيتم حفظ الإعدادات وإعادة تحميل الصفحة.
                يمكنك الرجوع للوضع السحابي في أي وقت.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Section D: Windows Script */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              سكربت إعداد Windows
            </CardTitle>
            <CardDescription>
              تنزيل سكربت .bat لإعداد البيئة المحلية تلقائياً على Windows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>السكربت يقوم بالتالي:</p>
              <p>1. تثبيت Supabase CLI (إذا لم يكن مثبتاً)</p>
              <p>2. التحقق من Docker Desktop</p>
              <p>3. تهيئة وتشغيل Supabase محلياً</p>
              <p>4. عرض تعليمات استعادة قاعدة البيانات</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleDownloadScript} variant="outline" className="flex-1">
                <Download className="h-4 w-4 ml-2" />
                تنزيل سكربت Windows (.bat)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OfflineSetup;
