import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Database, Trash2, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Download, Shield, FileJson, RefreshCw,
} from "lucide-react";

type LogEntry = {
  time: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
};

// Tables in correct deletion order (children first, parents last)
const SUPABASE_TABLES = [
  { name: "checklist_items", label: "عناصر قوائم الفحص", group: "فرعية" },
  { name: "inspection_checklists", label: "قوائم الفحص", group: "فرعية" },
  { name: "technician_progress_records", label: "سجلات تقدم الفنيين", group: "فرعية" },
  { name: "project_item_technicians", label: "فنيو بنود المشاريع", group: "فرعية" },
  { name: "client_payment_allocations", label: "توزيعات الدفعات", group: "مالية" },
  { name: "contract_items", label: "بنود العقود", group: "فرعية" },
  { name: "contract_clauses", label: "بنود العقود القانونية", group: "فرعية" },
  { name: "stock_movements", label: "حركات المخزون", group: "مخزون" },
  { name: "treasury_transactions", label: "حركات الخزينة", group: "مالية" },
  { name: "project_schedules", label: "جداول المشاريع", group: "مشاريع" },
  { name: "project_suppliers", label: "موردو المشاريع", group: "مشاريع" },
  { name: "project_technicians", label: "فنيو المشاريع", group: "مشاريع" },
  { name: "project_items", label: "بنود المشاريع", group: "مشاريع" },
  { name: "project_phases", label: "مراحل المشاريع", group: "مشاريع" },
  { name: "project_custody", label: "العهد", group: "مشاريع" },
  { name: "equipment_rentals", label: "إيجارات المعدات", group: "معدات" },
  { name: "client_payments", label: "دفعات العملاء", group: "مالية" },
  { name: "expenses", label: "المصروفات", group: "مالية" },
  { name: "income", label: "الإيرادات", group: "مالية" },
  { name: "transfers", label: "التحويلات", group: "مالية" },
  { name: "contracts", label: "العقود", group: "عقود" },
  { name: "cash_flow_forecast", label: "توقعات التدفق النقدي", group: "مالية" },
  { name: "projects", label: "المشاريع", group: "مشاريع" },
  { name: "clients", label: "العملاء", group: "أساسية" },
  { name: "suppliers", label: "الموردون", group: "أساسية" },
  { name: "technicians", label: "الفنيون", group: "أساسية" },
  { name: "engineers", label: "المهندسون", group: "أساسية" },
  { name: "employees", label: "الموظفون", group: "أساسية" },
  { name: "equipment", label: "المعدات", group: "معدات" },
  { name: "materials", label: "المواد", group: "مخزون" },
  { name: "treasuries", label: "الخزائن", group: "مالية" },
  { name: "measurement_configs", label: "إعدادات القياس", group: "إعدادات" },
  { name: "general_project_items", label: "البنود العامة", group: "إعدادات" },
  { name: "contract_clause_templates", label: "قوالب بنود العقود", group: "إعدادات" },
  { name: "audit_logs", label: "سجل التدقيق", group: "نظام" },
  { name: "phase_reference_seq", label: "تسلسل المراحل", group: "نظام" },
] as const;

const SupabaseDataManager = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tableDeleteConfirm, setTableDeleteConfirm] = useState("");

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const addLog = (type: LogEntry["type"], message: string) => {
    const time = new Date().toLocaleTimeString("ar-EG");
    setLogs((prev) => [{ time, type, message }, ...prev]);
  };

  // Delete all data from all tables
  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== "حذف جميع البيانات") return;
    setLoading("delete-all");
    setDeleteConfirmText("");
    addLog("warning", "جاري حذف جميع بيانات Supabase...");

    let successCount = 0;
    let errorCount = 0;

    for (const table of SUPABASE_TABLES) {
      try {
        const { error } = await supabase.from(table.name as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          // Try alternative delete for tables without 'id' column
          if (error.message?.includes("id")) {
            const { error: err2 } = await supabase.from(table.name as any).delete().gte("created_at", "1900-01-01");
            if (err2) {
              addLog("error", `${table.label}: ${err2.message}`);
              errorCount++;
              continue;
            }
          } else {
            addLog("error", `${table.label}: ${error.message}`);
            errorCount++;
            continue;
          }
        }
        addLog("success", `✅ تم حذف بيانات: ${table.label}`);
        successCount++;
      } catch (e: any) {
        addLog("error", `${table.label}: ${e.message}`);
        errorCount++;
      }
    }

    const msg = `تم حذف ${successCount} جدول${errorCount > 0 ? `، فشل ${errorCount}` : ""}`;
    addLog(errorCount > 0 ? "warning" : "success", msg);
    toast({ title: "تم الحذف", description: msg, variant: errorCount > 0 ? "destructive" : "default" });
    setLoading(null);
  };

  // Delete selected tables
  const handleDeleteSelected = async () => {
    if (tableDeleteConfirm !== "تأكيد" || selectedTables.length === 0) return;
    setLoading("delete-selected");
    setTableDeleteConfirm("");
    addLog("warning", `جاري حذف بيانات ${selectedTables.length} جدول...`);

    // Sort selected tables by SUPABASE_TABLES order (children first)
    const ordered = SUPABASE_TABLES.filter(t => selectedTables.includes(t.name));
    let successCount = 0;

    for (const table of ordered) {
      try {
        const { error } = await supabase.from(table.name as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
          if (error.message?.includes("id")) {
            await supabase.from(table.name as any).delete().gte("created_at", "1900-01-01");
          } else {
            addLog("error", `${table.label}: ${error.message}`);
            continue;
          }
        }
        addLog("success", `✅ تم حذف بيانات: ${table.label}`);
        successCount++;
      } catch (e: any) {
        addLog("error", `${table.label}: ${e.message}`);
      }
    }

    toast({ title: "تم", description: `تم حذف بيانات ${successCount} جدول` });
    setSelectedTables([]);
    setLoading(null);
  };

  // Export all data as JSON
  const handleExportAll = async () => {
    setLoading("export");
    addLog("info", "جاري تصدير جميع البيانات...");
    const allData: Record<string, any[]> = {};
    let totalRows = 0;

    for (const table of SUPABASE_TABLES) {
      try {
        const { data, error } = await supabase.from(table.name as any).select("*");
        if (error) {
          addLog("warning", `${table.label}: ${error.message}`);
          continue;
        }
        allData[table.name] = data || [];
        totalRows += (data?.length || 0);
        addLog("info", `${table.label}: ${data?.length || 0} سجل`);
      } catch (e: any) {
        addLog("error", `${table.label}: ${e.message}`);
      }
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supabase_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog("success", `تم تصدير ${totalRows} سجل من ${Object.keys(allData).length} جدول`);
    toast({ title: "تم التصدير", description: `تم تصدير ${totalRows} سجل بنجاح` });
    setLoading(null);
  };

  // Export single table
  const handleExportTable = async (tableName: string, tableLabel: string) => {
    try {
      const { data, error } = await supabase.from(tableName as any).select("*");
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tableName}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "تم التصدير", description: `تم تصدير ${data?.length || 0} سجل من ${tableLabel}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const toggleTable = (name: string) => {
    setSelectedTables(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const selectAllTables = () => {
    if (selectedTables.length === SUPABASE_TABLES.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(SUPABASE_TABLES.map(t => t.name));
    }
  };

  const logIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
      default: return <Database className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  // Group tables
  const groups = SUPABASE_TABLES.reduce((acc, t) => {
    if (!acc[t.group]) acc[t.group] = [];
    acc[t.group].push(t);
    return acc;
  }, {} as Record<string, typeof SUPABASE_TABLES[number][]>);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة بيانات Supabase</h1>
            <p className="text-muted-foreground">تصدير وحذف بيانات قاعدة البيانات</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              تصدير البيانات
            </CardTitle>
            <CardDescription>تصدير بيانات Supabase كملف JSON</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleExportAll} disabled={loading !== null} className="w-full">
              {loading === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
              تصدير جميع البيانات (JSON)
            </Button>

            <Separator />

            <p className="text-sm text-muted-foreground">تصدير جدول محدد:</p>
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              <div className="space-y-1">
                {Object.entries(groups).map(([group, tables]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground py-1 px-2">{group}</p>
                    {tables.map(table => (
                      <div key={table.name} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                        <span className="text-sm">{table.label}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleExportTable(table.name, table.label)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Delete Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              حذف البيانات
            </CardTitle>
            <CardDescription>حذف بيانات من جداول Supabase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Delete All */}
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
              <h3 className="font-semibold text-destructive mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                حذف جميع البيانات
              </h3>
              <p className="text-sm text-muted-foreground mb-3">حذف جميع البيانات من جميع الجداول (لا يمكن التراجع)</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={loading !== null}>
                    <Trash2 className="h-4 w-4" />
                    حذف جميع البيانات
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">⚠️ تحذير خطير</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف جميع البيانات من جميع جداول Supabase نهائياً.
                      <br />
                      اكتب <strong>"حذف جميع البيانات"</strong> للتأكيد.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="حذف جميع البيانات"
                    className="mt-2"
                  />
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllData}
                      disabled={deleteConfirmText !== "حذف جميع البيانات"}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      تأكيد الحذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            {/* Delete Selected */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  حذف جداول محددة
                </h3>
                <Button variant="ghost" size="sm" onClick={selectAllTables} className="text-xs">
                  {selectedTables.length === SUPABASE_TABLES.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                </Button>
              </div>

              <ScrollArea className="h-[250px] border rounded-lg p-2">
                <div className="space-y-1">
                  {Object.entries(groups).map(([group, tables]) => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-muted-foreground py-1 px-2">{group}</p>
                      {tables.map(table => (
                        <label
                          key={table.name}
                          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTables.includes(table.name)}
                            onCheckedChange={() => toggleTable(table.name)}
                          />
                          <span className="text-sm">{table.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {selectedTables.length > 0 && (
                <div className="mt-3">
                  <Badge variant="secondary" className="mb-2">
                    {selectedTables.length} جدول محدد
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10" disabled={loading !== null}>
                        <Trash2 className="h-4 w-4" />
                        حذف الجداول المحددة
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">تأكيد حذف البيانات</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم حذف بيانات {selectedTables.length} جدول. اكتب <strong>"تأكيد"</strong> للمتابعة.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Input
                        value={tableDeleteConfirm}
                        onChange={(e) => setTableDeleteConfirm(e.target.value)}
                        placeholder="تأكيد"
                        className="mt-2"
                      />
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={() => setTableDeleteConfirm("")}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteSelected}
                          disabled={tableDeleteConfirm !== "تأكيد"}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                سجل العمليات
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
                مسح
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm py-1">
                    {logIcon(log.type)}
                    <span className="text-muted-foreground text-xs shrink-0 mt-0.5">{log.time}</span>
                    <span className={
                      log.type === "error" ? "text-destructive" :
                      log.type === "success" ? "text-green-600 dark:text-green-400" :
                      log.type === "warning" ? "text-yellow-600 dark:text-yellow-400" :
                      "text-foreground"
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupabaseDataManager;
