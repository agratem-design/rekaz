import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface MiniAuditLogProps {
  tableName?: string;
  recordId?: string;
  limit?: number;
}

const ACTION_INFO: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  INSERT: { label: "إضافة", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: Plus },
  UPDATE: { label: "تعديل", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Pencil },
  DELETE: { label: "حذف", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: Trash2 },
};

const MiniAuditLog = ({ tableName, recordId, limit = 10 }: MiniAuditLogProps) => {
  const navigate = useNavigate();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["mini-audit", tableName, recordId],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (tableName) query = query.eq("table_name", tableName);
      if (recordId) query = query.eq("record_id", recordId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || !logs?.length) return null;

  return (
    <Card className="border-muted">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />
          آخر التعديلات
        </CardTitle>
        <button
          onClick={() => navigate("/audit-log")}
          className="text-xs text-primary hover:underline"
        >
          عرض الكل
        </button>
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="max-h-48">
          <div className="space-y-1.5">
            {logs.map((log: any) => {
              const info = ACTION_INFO[log.action];
              const Icon = info?.icon || Pencil;
              const changedCount = log.changed_fields ? Object.keys(log.changed_fields).length : 0;
              return (
                <div key={log.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
                  <Badge className={`text-[10px] px-1.5 py-0 ${info?.color}`}>
                    <Icon className="h-2.5 w-2.5 ml-0.5" />
                    {info?.label}
                  </Badge>
                  <span className="text-muted-foreground truncate flex-1">
                    {log.user_email?.split("@")[0] || "نظام"}
                  </span>
                  {log.action === "UPDATE" && changedCount > 0 && (
                    <span className="text-muted-foreground">{changedCount} حقل</span>
                  )}
                  <span className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "MM/dd HH:mm")}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default MiniAuditLog;
