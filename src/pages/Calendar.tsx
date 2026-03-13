import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay, isToday } from "date-fns";
import { ar } from "date-fns/locale";
import { ChevronRight, ChevronLeft, CalendarIcon, FolderKanban, ShoppingCart, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const Calendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch projects with dates
  const { data: projects = [] } = useQuery({
    queryKey: ["calendar-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, start_date, end_date, status")
        .not("start_date", "is", null)
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchases (due)
  const { data: purchases = [] } = useQuery({
    queryKey: ["calendar-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, date, total_amount, paid_amount, status, suppliers(name)")
        .eq("status", "due")
        .order("date");
      if (error) throw error;
      return data;
    },
  });

  // Fetch risk register items
  const { data: risks = [] } = useQuery({
    queryKey: ["calendar-risks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_register")
        .select("id, title, due_date, status, priority")
        .not("due_date", "is", null)
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Day of week offset (0=Sunday, make Sunday=6 for RTL Arabic calendar starting Monday)
  const firstDayOfWeek = getDay(monthStart);
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const getEventsForDay = (day: Date) => {
    const events: Array<{ type: string; label: string; color: string; id: string; path?: string }> = [];

    projects.forEach((p: any) => {
      if (p.start_date && isSameDay(new Date(p.start_date), day)) {
        events.push({ type: "project-start", label: `بداية: ${p.name}`, color: "bg-blue-500", id: p.id, path: `/projects/${p.id}` });
      }
      if (p.end_date && isSameDay(new Date(p.end_date), day)) {
        events.push({ type: "project-end", label: `نهاية: ${p.name}`, color: "bg-green-500", id: p.id, path: `/projects/${p.id}` });
      }
    });

    purchases.forEach((p: any) => {
      if (p.date && isSameDay(new Date(p.date), day)) {
        events.push({ type: "purchase", label: `فاتورة: ${p.suppliers?.name || "مورد"}`, color: "bg-red-500", id: p.id });
      }
    });

    risks.forEach((r: any) => {
      if (r.due_date && isSameDay(new Date(r.due_date), day)) {
        events.push({ type: "risk", label: `خطر: ${r.title}`, color: r.priority === "high" ? "bg-orange-600" : "bg-yellow-500", id: r.id });
      }
    });

    return events;
  };

  const weekDays = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

  // Summary stats
  const monthProjects = projects.filter((p: any) => {
    const start = p.start_date ? new Date(p.start_date) : null;
    const end = p.end_date ? new Date(p.end_date) : null;
    return (start && isSameMonth(start, currentDate)) || (end && isSameMonth(end, currentDate));
  });

  const monthPurchases = purchases.filter((p: any) => p.date && isSameMonth(new Date(p.date), currentDate));
  const monthRisks = risks.filter((r: any) => r.due_date && isSameMonth(new Date(r.due_date), currentDate));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">التقويم</h1>
          <p className="text-muted-foreground text-sm">جدول المشاريع والمواعيد والفواتير المستحقة</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-500/30">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2">
              <FolderKanban className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مشاريع هذا الشهر</p>
              <p className="text-xl font-bold text-blue-600">{monthProjects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
              <ShoppingCart className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">فواتير مستحقة</p>
              <p className="text-xl font-bold text-red-600">{monthPurchases.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مخاطر مجدولة</p>
              <p className="text-xl font-bold text-orange-600">{monthRisks.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <CardTitle className="text-xl">
              {format(currentDate, "MMMM yyyy", { locale: ar })}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week headers */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Offset empty cells */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {days.map((day) => {
              const events = getEventsForDay(day);
              const hasEvents = events.length > 0;
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[80px] p-1.5 rounded-lg border transition-colors",
                    isCurrentDay ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                    hasEvents && "border-primary/30"
                  )}
                >
                  <div className={cn(
                    "text-xs font-semibold mb-1 w-6 h-6 rounded-full flex items-center justify-center",
                    isCurrentDay && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {events.slice(0, 2).map((event, i) => (
                      <div
                        key={i}
                        className={cn(
                          "text-[9px] leading-tight px-1 py-0.5 rounded text-white truncate cursor-pointer",
                          event.color
                        )}
                        title={event.label}
                        onClick={() => event.path && navigate(event.path)}
                      >
                        {event.label}
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-[9px] text-muted-foreground text-center">
                        +{events.length - 2} أخرى
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-4 border-t flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>بداية مشروع</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>نهاية مشروع</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>فاتورة مستحقة</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded bg-orange-600" />
              <span>خطر مجدول</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar;
