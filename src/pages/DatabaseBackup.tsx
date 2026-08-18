import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Database,
  Cloud,
  FolderOpen,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  FileArchive,
  ExternalLink,
  Laptop
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DesktopBackupStatus, LocalBackupFile } from "@/types/desktop";

const DatabaseBackup = () => {
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [backupStatus, setBackupStatus] = useState<DesktopBackupStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const checkDesktopAndFetchStatus = async () => {
    if (typeof window !== "undefined" && window.desktopAPI) {
      setIsDesktop(true);
      try {
        const status = await window.desktopAPI.getBackupStatus();
        setBackupStatus(status);
      } catch (err) {
        console.error("Failed to get backup status:", err);
      }
    } else {
      setIsDesktop(false);
    }
  };

  useEffect(() => {
    checkDesktopAndFetchStatus();

    if (window.desktopAPI) {
      const unsubscribe = window.desktopAPI.onBackupStatus((data) => {
        if (data.status === "starting" || data.status === "dumping" || data.status === "uploading") {
          setIsRunning(true);
        } else {
          setIsRunning(false);
          checkDesktopAndFetchStatus();
        }
      });

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, []);

  const handleStartManualBackup = async () => {
    if (!window.desktopAPI) {
      toast.error("هذه الميزة متاحة فقط عند تشغيل التطبيق كبرنامج سطح مكتب مستقل");
      return;
    }

    setIsRunning(true);
    try {
      const res = await window.desktopAPI.startBackup();
      if (res.success) {
        toast.success("تم إكمال النسخ الاحتياطي بنجاح");
        checkDesktopAndFetchStatus();
      } else {
        toast.error(`فشل النسخ الاحتياطي: ${res.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      toast.error(`حدث خطأ غير متوقع: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpenFolder = async (filePath?: string) => {
    if (!window.desktopAPI) {
      toast.error("هذه الميزة متاحة فقط داخل تطبيق سطح المكتب");
      return;
    }

    try {
      const res = await window.desktopAPI.openBackupFolder(filePath);
      if (!res.success && res.error) {
        toast.error(`تعذر فتح المجلد: ${res.error}`);
      }
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("تم نسخ النص إلى الحافظة");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header */}
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
              <span>العودة</span>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            النسخ الاحتياطي لقاعدة البيانات
          </h1>
          <p className="text-muted-foreground">
            إدارة النسخ الاحتياطي الصامت لقاعدة بيانات ركاز، المزامنة السحابية مع Google Drive، واستعادة البيانات.
          </p>
        </div>

        {isDesktop && (
          <Button
            onClick={handleStartManualBackup}
            disabled={isRunning}
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all self-start sm:self-center"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            أخذ نسخة احتياطية فورية الآن
          </Button>
        )}
      </div>

      {/* Desktop Status Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Laptop className="h-5 w-5 text-primary" />
              محرك النسخ الاحتياطي الصامت لتطبيق سطح المكتب
            </CardTitle>
            <Badge variant={isDesktop ? "default" : "secondary"} className="gap-1.5 w-fit">
              {isDesktop ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  برنامج سطح المكتب نشط (Windows Executable)
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  بيئة الويب (Web Browser Mode)
                </>
              )}
            </Badge>
          </div>
          <CardDescription>
            يقوم تطبيق سطح المكتب تلقائياً عند كل تشغيل بأخذ نسخة احتياطية كاملة وشاملة 100% لكافة الجداول والبيانات عبر pg_dump بدون أي نوافذ منبثقة ورفعها فوراً إلى Google Drive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {isDesktop ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stat 1: Status */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    حالة المحرك
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {isRunning ? "جاري النسخ في الخلفية..." : "جاهز للعمل التلقائي"}
                  </p>
                </div>

                {/* Stat 2: Last Run */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    توقيت آخر نسخة
                  </span>
                  <p className="text-base font-bold text-foreground truncate">
                    {backupStatus?.lastRunTime
                      ? new Date(backupStatus.lastRunTime).toLocaleString("ar-LY")
                      : "لم يتم بعد في هذه الجلسة"}
                  </p>
                </div>

                {/* Stat 3: Last File Size */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileArchive className="h-4 w-4 text-primary" />
                    حجم آخر ملف
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {backupStatus?.lastFileSize || "غير محدد"}
                  </p>
                </div>

                {/* Stat 4: Cloud Sync */}
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Cloud className="h-4 w-4 text-primary" />
                    المزامنة السحابية
                  </span>
                  <p className="text-base font-bold text-foreground">
                    Google Drive (مفعل)
                  </p>
                </div>
              </div>

              {/* Action Buttons & Directory */}
              <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block mb-0.5">
                      مجلد حفظ النسخ الاحتياطية على هذا الجهاز:
                    </span>
                    <code className="text-xs font-mono text-foreground bg-muted px-2 py-1 rounded" dir="ltr">
                      {backupStatus?.backupDir || "Documents\\AdHub_Backups"}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenFolder()}
                      className="cursor-pointer gap-2"
                    >
                      <FolderOpen className="h-4 w-4 text-primary" />
                      فتح المجلد في ويندوز
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleStartManualBackup}
                      disabled={isRunning}
                      className="cursor-pointer gap-2"
                    >
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      تحديث ونسخ فوري
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <h4 className="font-bold text-base text-primary flex items-center gap-2">
                <Laptop className="h-5 w-5" />
                تشغيل المنظومة كتطبيق ويندوز مستقل (Desktop Executable)
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                للحصول على ميزة النسخ الاحتياطي الصامت والتلقائي مع كل إقلاع، وتخزين ملفات الدامب بحجمها الطبيعي الكامل ورفعها إلى Google Drive بدون نوافذ أوامر، يمكنك تشغيل المنظومة عبر النسخة التنفيذية المخصصة لويندوز (<code className="font-mono text-xs">AdHub-Pro.exe</code>).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Local Backups List (Desktop Only) */}
      {isDesktop && backupStatus?.localBackups && backupStatus.localBackups.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <HardDrive className="h-5 w-5 text-primary" />
              النسخ الاحتياطية المحفوظة محلياً على القرص ({backupStatus.localBackups.length})
            </CardTitle>
            <CardDescription>
              قائمة بأحدث ملفات النسخ الاحتياطي المأخوذة والمحفوظة في مجلد المستندات على هذا الجهاز.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border text-xs">
                    <tr>
                      <th className="p-3">اسم ملف النسخة</th>
                      <th className="p-3">تاريخ ووقت النسخ</th>
                      <th className="p-3">حجم الملف</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {backupStatus.localBackups.map((b: LocalBackupFile) => (
                      <tr key={b.name} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs font-semibold text-foreground flex items-center gap-2" dir="ltr">
                          <FileArchive className="h-4 w-4 text-primary shrink-0" />
                          {b.name}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString("ar-LY")}
                        </td>
                        <td className="p-3 text-xs font-medium text-foreground">
                          <Badge variant="outline" className="font-mono text-xs">
                            {b.size}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFolder(b.path)}
                            className="cursor-pointer gap-1.5 text-xs text-primary hover:text-primary/80"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            تحديد في ويندوز
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Connection & Direct Command Info */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Terminal className="h-5 w-5 text-primary" />
            معلومات الاتصال بقاعدة البيانات وأوامر الاستعادة
          </CardTitle>
          <CardDescription>
            بيانات الاتصال بالسيرفر لتنفيذ عمليات النسخ اليدوي أو استرجاع البيانات بالكامل عبر أمر pg_restore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-1">
              <span className="text-xs text-muted-foreground">خادم قاعدة البيانات (Host)</span>
              <div className="flex items-center justify-between">
                <code className="text-xs font-mono text-foreground truncate" dir="ltr">
                  aws-1-eu-west-1.pooler.supabase.com
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 cursor-pointer"
                  onClick={() => handleCopy("aws-1-eu-west-1.pooler.supabase.com", "host")}
                >
                  {copiedKey === "host" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-1">
              <span className="text-xs text-muted-foreground">المنفذ (Port)</span>
              <div className="flex items-center justify-between">
                <code className="text-xs font-mono text-foreground" dir="ltr">6543</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 cursor-pointer"
                  onClick={() => handleCopy("6543", "port")}
                >
                  {copiedKey === "port" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-1">
              <span className="text-xs text-muted-foreground">اسم المستخدم (User)</span>
              <div className="flex items-center justify-between">
                <code className="text-xs font-mono text-foreground truncate" dir="ltr">
                  postgres.bpnhzaexmqruzaxyzlyc
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 cursor-pointer"
                  onClick={() => handleCopy("postgres.bpnhzaexmqruzaxyzlyc", "user")}
                >
                  {copiedKey === "user" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-1">
              <span className="text-xs text-muted-foreground">قاعدة البيانات (Database)</span>
              <div className="flex items-center justify-between">
                <code className="text-xs font-mono text-foreground" dir="ltr">postgres</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 cursor-pointer"
                  onClick={() => handleCopy("postgres", "db")}
                >
                  {copiedKey === "db" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Restore Command snippet */}
          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-sm font-bold text-foreground">أمر الاستعادة الشامل لقاعدة البيانات (pg_restore):</h4>
            <p className="text-xs text-muted-foreground">
              لاسترجاع نسخة احتياطية من ملف .dump إلى السيرفر بالكامل، قم بتنفيذ الأمر التالي في موجه الأوامر:
            </p>
            <div className="relative bg-zinc-950 text-zinc-100 p-3.5 rounded-lg border border-zinc-800 font-mono text-xs overflow-x-auto" dir="ltr">
              <pre>
{`pg_restore -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U "postgres.bpnhzaexmqruzaxyzlyc" -d postgres -v --clean "REKAZ_BACKUP_FILE.dump"`}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2.5 right-2.5 h-7 gap-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                onClick={() => handleCopy(
                  `pg_restore -h aws-1-eu-west-1.pooler.supabase.com -p 6543 -U "postgres.bpnhzaexmqruzaxyzlyc" -d postgres -v --clean "REKAZ_BACKUP_FILE.dump"`,
                  "restore_cmd"
                )}
              >
                {copiedKey === "restore_cmd" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                نسخ الأمر
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseBackup;
