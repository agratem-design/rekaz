import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer, User, Wrench, Calculator } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow } from "@/lib/printStyles";
import { toast } from "sonner";
import { getElementLabels } from "@/lib/printLabels";

interface TechnicianDuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    name: string;
    quantity: number;
    measurement_type: string;
    progress?: number;
    project_item_technicians?: {
      id: string;
      technician_id: string;
      quantity: number;
      rate: number;
      rate_type: string;
      total_cost: number;
      technicians: {
        id: string;
        name: string;
        specialty?: string;
      };
    }[];
  } | null;
  projectName?: string;
}

const measurementUnits: Record<string, string> = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const rateTypeLabels: Record<string, string> = {
  meter: "بالمتر",
  piece: "بالقطعة",
  daily: "يومي",
  hourly: "بالساعة",
  fixed: "ثابت",
};

export function TechnicianDuesDialog({
  open,
  onOpenChange,
  item,
  projectName,
}: TechnicianDuesDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch company settings
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

  // Fetch progress records for this item
  const { data: progressRecords = [] } = useQuery({
    queryKey: ["progress-records-dues", item?.id],
    queryFn: async () => {
      if (!item?.id) return [];
      const { data, error } = await supabase
        .from("technician_progress_records")
        .select(`
          *,
          technicians (id, name)
        `)
        .eq("project_item_id", item.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!item?.id,
  });

  // Fetch engineer for this item
  const { data: engineer } = useQuery({
    queryKey: ["item-engineer", item?.id],
    queryFn: async () => {
      if (!item?.id) return null;
      const { data, error } = await supabase
        .from("project_items")
        .select("engineer_id, engineers(id, name)")
        .eq("id", item.id)
        .maybeSingle();
      if (error) throw error;
      return data?.engineers;
    },
    enabled: !!item?.id,
  });

  // Calculate technician summaries with dues
  const technicianSummaries = item?.project_item_technicians?.map((tech) => {
    const completed = progressRecords
      .filter((r) => r.technician_id === tech.technician_id)
      .reduce((sum, r) => sum + Number(r.quantity_completed), 0);
    const assigned = tech.quantity || 0;
    // Calculate percent based on assigned quantity (what the technician should complete)
    // Cap at 100% to avoid showing more than complete
    const percent = assigned > 0 ? Math.min(100, Math.round((completed / assigned) * 100)) : 0;
    const dues = completed * Number(tech.rate);
    return {
      ...tech,
      completed,
      percent,
      dues,
    };
  }) || [];

  const totalDues = technicianSummaries.reduce((sum, t) => sum + t.dues, 0);
  const totalCompleted = technicianSummaries.reduce((sum, t) => sum + t.completed, 0);

  const handlePrint = () => {
    printTechnicianDues();
  };

  const printTechnicianDues = (technicianId?: string) => {
    const techToPrint = technicianId
      ? technicianSummaries.filter((t) => t.technician_id === technicianId)
      : technicianSummaries;

    const techRecords = technicianId
      ? progressRecords.filter((r) => r.technician_id === technicianId)
      : progressRecords;

    const techTotalDues = techToPrint.reduce((sum, t) => sum + t.dues, 0);
    const techTotalCompleted = techToPrint.reduce((sum, t) => sum + t.completed, 0);

    const techName = technicianId ? techToPrint[0]?.technicians?.name : "جميع الفنيين";
    const pl = getElementLabels(settings?.print_labels, "technician_dues");
    const reportTitle = `${pl.title} - ${techName} - ${item?.name || "عنصر"}`;

    const printContent = `
      <div class="print-area">
        <div class="print-content">
          <!-- Header -->
          <div class="print-section">
            <h2 class="print-section-title">كشف مستحقات ${techName}</h2>
            <table class="print-info-table">
              <tbody>
                <tr>
                  <td class="info-label">المشروع</td>
                  <td class="info-value">${projectName || "-"}</td>
                  <td class="info-label">العنصر</td>
                  <td class="info-value">${item?.name || "-"}</td>
                </tr>
                <tr>
                  <td class="info-label">الكمية الإجمالية</td>
                  <td class="info-value">
                    ${item?.quantity.toLocaleString()} ${measurementUnits[item?.measurement_type || "linear"]}
                  </td>
                  <td class="info-label">نسبة الإنجاز</td>
                  <td class="info-value">${item?.progress || 0}%</td>
                </tr>
                ${engineer ? `
                <tr>
                  <td class="info-label">المهندس المشرف</td>
                  <td class="info-value" colspan="3">${engineer.name}</td>
                </tr>
                ` : ""}
              </tbody>
            </table>
          </div>

          <!-- Technicians Table -->
          <div class="print-section">
            <h3 class="print-section-title">تفاصيل المستحقات</h3>
            <table class="print-table">
              <thead>
                <tr>
                  <th>${pl.col_technician}</th>
                  <th>نوع السعر</th>
                  <th>السعر</th>
                  <th>الكمية المعينة</th>
                  <th>${pl.col_completed}</th>
                  <th>${pl.col_percent}</th>
                  <th>${pl.col_dues}</th>
                </tr>
              </thead>
              <tbody>
                ${techToPrint.map((tech) => `
                  <tr>
                    <td style="text-align: center">${tech.technicians?.name || "-"}</td>
                    <td style="text-align: center">${rateTypeLabels[tech.rate_type] || tech.rate_type}</td>
                    <td style="text-align: center">${formatCurrencyLYD(tech.rate)}</td>
                    <td style="text-align: center">
                      ${tech.quantity?.toLocaleString()} ${measurementUnits[item?.measurement_type || "linear"]}
                    </td>
                    <td style="text-align: center">
                      ${tech.completed.toLocaleString()} ${measurementUnits[item?.measurement_type || "linear"]}
                    </td>
                    <td style="text-align: center">${tech.percent}%</td>
                    <td style="text-align: center; font-weight: bold">
                      ${formatCurrencyLYD(tech.dues)}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: center; font-weight: bold">
                    ${pl.total_label}
                  </td>
                  <td style="text-align: center; font-weight: bold">
                    ${techTotalCompleted.toLocaleString()} ${measurementUnits[item?.measurement_type || "linear"]}
                  </td>
                  <td style="text-align: center; font-weight: bold">
                    ${item?.progress || 0}%
                  </td>
                  <td style="text-align: center; font-weight: bold">
                    ${formatCurrencyLYD(techTotalDues)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Progress Records -->
          ${techRecords.length > 0 && pl.show_records ? `
          <div class="print-section">
            <h3 class="print-section-title">${pl.records_section}</h3>
            <table class="print-table">
              <thead>
                <tr>
                  <th>${pl.col_date}</th>
                  <th>${pl.col_technician}</th>
                  <th>${pl.col_completed}</th>
                  <th>${pl.col_notes}</th>
                </tr>
              </thead>
              <tbody>
                ${techRecords.map((record) => `
                  <tr>
                    <td style="text-align: center">
                      ${format(new Date(record.date), "yyyy/MM/dd", { locale: ar })}
                    </td>
                    <td style="text-align: center">${record.technicians?.name || "-"}</td>
                    <td style="text-align: center">
                      ${record.quantity_completed.toLocaleString()} ${measurementUnits[item?.measurement_type || "linear"]}
                    </td>
                    <td style="text-align: center">${record.notes || "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          ` : ""}

          <!-- Total Box -->
          <div class="total-box">
            <div class="label">${pl.total_label}</div>
            <div class="value">${formatCurrencyLYD(techTotalDues)}</div>
          </div>

          <!-- Footer -->
          <div class="print-footer">
            <span>تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd", { locale: ar })}</span>
            <span>${settings?.company_name || ""}</span>
          </div>
        </div>
      </div>
    `;

    const printWindow = openPrintWindow(reportTitle, printContent, settings);
    if (!printWindow) {
      toast.error("تعذر فتح نافذة الطباعة - يرجى السماح بالنوافذ المنبثقة");
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            تفاصيل ومستحقات العنصر - {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">الكمية الإجمالية</p>
              <p className="font-bold">
                {item.quantity.toLocaleString()} {measurementUnits[item.measurement_type]}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الكمية المنجزة</p>
              <p className="font-bold text-green-600">
                {totalCompleted.toLocaleString()} {measurementUnits[item.measurement_type]}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">نسبة الإنجاز</p>
              <div className="flex items-center gap-2">
                <Progress value={item.progress || 0} className="flex-1" />
                <span className="font-bold">{item.progress || 0}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المستحقات</p>
              <p className="font-bold text-primary">{formatCurrencyLYD(totalDues)}</p>
            </div>
          </div>

          {/* Engineer */}
          {engineer && (
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <User className="h-5 w-5 text-blue-500" />
              <span className="text-muted-foreground">المهندس المشرف:</span>
              <Badge variant="outline">{engineer.name}</Badge>
            </div>
          )}

          {/* Technicians Details */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              الفنيين المعينين
            </h3>
            {technicianSummaries.length > 0 ? (
              <div className="space-y-3">
                {technicianSummaries.map((tech) => (
                  <div key={tech.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{tech.technicians?.name}</span>
                        {tech.technicians?.specialty && (
                          <Badge variant="outline">{tech.technicians.specialty}</Badge>
                        )}
                        <Badge variant="secondary">{rateTypeLabels[tech.rate_type] || tech.rate_type}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={tech.percent >= 100 ? "default" : "outline"}>
                          {tech.percent}% منجز
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printTechnicianDues(tech.technician_id)}
                          className="gap-1"
                        >
                          <Printer className="h-3 w-3" />
                          طباعة
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">الكمية المعينة</p>
                        <p className="font-medium">
                          {tech.quantity?.toLocaleString()} {measurementUnits[item.measurement_type]}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">الكمية المنجزة</p>
                        <p className="font-medium text-green-600">
                          {tech.completed.toLocaleString()} {measurementUnits[item.measurement_type]}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">السعر</p>
                        <p className="font-medium">{formatCurrencyLYD(tech.rate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">المستحقات</p>
                        <p className="font-bold text-primary">{formatCurrencyLYD(tech.dues)}</p>
                      </div>
                      <div>
                        <Progress value={Math.min(100, tech.percent)} className="mt-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">لا يوجد فنيين معينين</p>
            )}
          </div>

          {/* Progress History */}
          {progressRecords.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">سجل الإنجازات</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفني</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressRecords.map((record) => {
                    const tech = item.project_item_technicians?.find(
                      (t) => t.technician_id === record.technician_id
                    );
                    const recordDues = Number(record.quantity_completed) * Number(tech?.rate || 0);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>{record.technicians?.name}</TableCell>
                        <TableCell>
                          {record.quantity_completed.toLocaleString()} {measurementUnits[item.measurement_type]}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.date), "yyyy/MM/dd", { locale: ar })}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {record.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Print Button */}
          <div className="flex justify-end gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة المستحقات
            </Button>
          </div>
        </div>

        {/* Print Area - Hidden */}
        <div className="hidden">
          <div ref={printRef} className="print-area">
            <div className="print-content">
              {/* Header */}
              <div className="print-section">
                <h2 className="print-section-title">كشف مستحقات الفنيين</h2>
                <table className="print-info-table">
                  <tbody>
                    <tr>
                      <td className="info-label">المشروع</td>
                      <td className="info-value">{projectName || "-"}</td>
                      <td className="info-label">العنصر</td>
                      <td className="info-value">{item.name}</td>
                    </tr>
                    <tr>
                      <td className="info-label">الكمية الإجمالية</td>
                      <td className="info-value">
                        {item.quantity.toLocaleString()} {measurementUnits[item.measurement_type]}
                      </td>
                      <td className="info-label">نسبة الإنجاز</td>
                      <td className="info-value">{item.progress || 0}%</td>
                    </tr>
                    {engineer && (
                      <tr>
                        <td className="info-label">المهندس المشرف</td>
                        <td className="info-value" colSpan={3}>{engineer.name}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Technicians Table */}
              <div className="print-section">
                <h3 className="print-section-title">تفاصيل مستحقات الفنيين</h3>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>الفني</th>
                      <th>نوع السعر</th>
                      <th>السعر</th>
                      <th>الكمية المعينة</th>
                      <th>الكمية المنجزة</th>
                      <th>نسبة الإنجاز</th>
                      <th>المستحقات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {technicianSummaries.map((tech) => (
                      <tr key={tech.id}>
                        <td style={{ textAlign: "center" }}>{tech.technicians?.name}</td>
                        <td style={{ textAlign: "center" }}>{rateTypeLabels[tech.rate_type] || tech.rate_type}</td>
                        <td style={{ textAlign: "center" }}>{formatCurrencyLYD(tech.rate)}</td>
                        <td style={{ textAlign: "center" }}>
                          {tech.quantity?.toLocaleString()} {measurementUnits[item.measurement_type]}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {tech.completed.toLocaleString()} {measurementUnits[item.measurement_type]}
                        </td>
                        <td style={{ textAlign: "center" }}>{tech.percent}%</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>
                          {formatCurrencyLYD(tech.dues)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", fontWeight: "bold" }}>
                        الإجمالي
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {totalCompleted.toLocaleString()} {measurementUnits[item.measurement_type]}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {item.progress || 0}%
                      </td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {formatCurrencyLYD(totalDues)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Progress Records */}
              {progressRecords.length > 0 && (
                <div className="print-section">
                  <h3 className="print-section-title">سجل الإنجازات التفصيلي</h3>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>الفني</th>
                        <th>الكمية المنجزة</th>
                        <th>ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressRecords.map((record) => (
                        <tr key={record.id}>
                          <td style={{ textAlign: "center" }}>
                            {format(new Date(record.date), "yyyy/MM/dd", { locale: ar })}
                          </td>
                          <td style={{ textAlign: "center" }}>{record.technicians?.name}</td>
                          <td style={{ textAlign: "center" }}>
                            {record.quantity_completed.toLocaleString()} {measurementUnits[item.measurement_type]}
                          </td>
                          <td style={{ textAlign: "center" }}>{record.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total Box */}
              <div className="total-box">
                <div className="label">إجمالي المستحقات</div>
                <div className="value">{formatCurrencyLYD(totalDues)}</div>
              </div>

              {/* Footer */}
              <div className="print-footer">
                <span>تاريخ الطباعة: {format(new Date(), "yyyy/MM/dd", { locale: ar })}</span>
                <span>{settings?.company_name || ""}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
