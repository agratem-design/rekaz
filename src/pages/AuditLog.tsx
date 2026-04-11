import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Search, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const TABLE_LABELS: Record<string, string> = {
  clients: "الزبائن",
  projects: "المشاريع",
  project_phases: "فواتير مراحل المشروع",
  project_items: "بنود المشروع",
  purchases: "المشتريات",
  expenses: "المصروفات",
  equipment: "المعدات",
  equipment_rentals: "إيجار المعدات",
  suppliers: "الموردين",
  technicians: "الفنيين",
  engineers: "المهندسين",
  employees: "الموظفين",
  contracts: "العقود",
  contract_items: "بنود العقد",
  contract_clauses: "بنود العقد القانونية",
  client_payments: "دفعات الزبائن",
  treasuries: "الخزائن",
  treasury_transactions: "حركات الخزينة",
  transfers: "التحويلات",
  income: "الإيرادات",
  project_custody: "العهد",
  project_item_technicians: "فنيو البنود",
  project_suppliers: "موردو المشروع",
  project_technicians: "فنيو المشروع",
  technician_progress_records: "سجلات تقدم الفنيين",
  company_settings: "إعدادات الشركة",
};

const ACTION_LABELS: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  INSERT: { label: "إضافة", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Plus },
  UPDATE: { label: "تعديل", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Pencil },
  DELETE: { label: "حذف", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: Trash2 },
};

const AuditLog = () => {
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", tableFilter, actionFilter, searchQuery, dateFrom, dateTo, page],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);
      if (searchQuery) query = query.or(`user_email.ilike.%${searchQuery}%,record_id.ilike.%${searchQuery}%`);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
  });

  const renderChangedFields = (fields: Record<string, { old: any; new: any }>) => {
    if (!fields) return null;
    return (
      <div className="space-y-2">
        {Object.entries(fields).map(([key, val]) => (
          <div key={key} className="border rounded-lg p-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-1">{key}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-red-50 dark:bg-red-950/30 rounded p-1.5">
                <span className="text-xs text-red-600 dark:text-red-400">القيمة القديمة:</span>
                <p className="font-mono text-xs break-all">{JSON.stringify(val.old) ?? "—"}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/30 rounded p-1.5">
                <span className="text-xs text-green-600 dark:text-green-400">القيمة الجديدة:</span>
                <p className="font-mono text-xs break-all">{JSON.stringify(val.new) ?? "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8 text-primary" />
          سجل التعديلات
        </h1>
        <p className="text-muted-foreground">تتبع جميع العمليات التي تمت على النظام</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">الجدول</Label>
              <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الجداول</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">العملية</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العمليات</SelectItem>
                  <SelectItem value="INSERT">إضافة</SelectItem>
                  <SelectItem value="UPDATE">تعديل</SelectItem>
                  <SelectItem value="DELETE">حذف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">بحث (بريد / معرف)</Label>
              <div className="relative">
                <Search className="absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input className="h-9 pr-8" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }} placeholder="بحث..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input className="h-9" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input className="h-9" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{data?.total || 0} سجل</Badge>
        <Badge variant="outline">صفحة {page + 1} من {totalPages || 1}</Badge>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">العملية</TableHead>
                <TableHead className="text-right">الجدول</TableHead>
                <TableHead className="text-right">التغييرات</TableHead>
                <TableHead className="text-right w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell>
                </TableRow>
              ) : !data?.logs.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell>
                </TableRow>
              ) : (
                data.logs.map((log: any) => {
                  const actionInfo = ACTION_LABELS[log.action];
                  const ActionIcon = actionInfo?.icon || Pencil;
                  const changedCount = log.changed_fields ? Object.keys(log.changed_fields).length : 0;
                  return (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell className="text-xs">
                        {format(new Date(log.created_at), "yyyy/MM/dd HH:mm", { locale: ar })}
                      </TableCell>
                      <TableCell className="text-xs">{log.user_email || "نظام"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${actionInfo?.color}`}>
                          <ActionIcon className="h-3 w-3 ml-1" />
                          {actionInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TABLE_LABELS[log.table_name] || log.table_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.action === "UPDATE" && changedCount > 0
                          ? `${changedCount} حقل`
                          : log.action === "INSERT"
                          ? "سجل جديد"
                          : "تم الحذف"}
                      </TableCell>
                      <TableCell>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              تفاصيل العملية
              {selectedLog && (
                <Badge className={ACTION_LABELS[selectedLog.action]?.color}>
                  {ACTION_LABELS[selectedLog.action]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">الجدول:</span>
                    <p className="font-medium">{TABLE_LABELS[selectedLog.table_name] || selectedLog.table_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المعرف:</span>
                    <p className="font-mono text-xs">{selectedLog.record_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المستخدم:</span>
                    <p>{selectedLog.user_email || "نظام"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">التاريخ:</span>
                    <p>{format(new Date(selectedLog.created_at), "yyyy/MM/dd HH:mm:ss", { locale: ar })}</p>
                  </div>
                </div>

                {selectedLog.action === "UPDATE" && selectedLog.changed_fields && (
                  <div>
                    <h4 className="font-medium mb-2">الحقول المتغيرة:</h4>
                    {renderChangedFields(selectedLog.changed_fields)}
                  </div>
                )}

                {selectedLog.action === "INSERT" && selectedLog.new_data && (
                  <div>
                    <h4 className="font-medium mb-2">البيانات المضافة:</h4>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-60 font-mono" dir="ltr">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.action === "DELETE" && selectedLog.old_data && (
                  <div>
                    <h4 className="font-medium mb-2">البيانات المحذوفة:</h4>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-60 font-mono" dir="ltr">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLog;
