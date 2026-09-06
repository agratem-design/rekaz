import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Wrench, Receipt, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type OperationType = "material" | "service" | "expense" | "labor";

interface OperationTypeSelectorProps {
  selectedType: OperationType | null;
  onSelectType: (type: OperationType) => void;
}

export const OperationTypeSelector: React.FC<OperationTypeSelectorProps> = ({
  selectedType,
  onSelectType,
}) => {
  const operations: Array<{
    type: OperationType;
    title: string;
    description: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      type: "material",
      title: "شراء مواد ومستلزمات",
      description: "تسجيل فواتير شراء مواد بناء وأدوات من الموردين (نقدية أو ذمم)",
      icon: <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
    },
    {
      type: "service",
      title: "خدمة مورد خارجية",
      description: "تسجيل خدمات الموردين الخارجيين وفواتير الخدمات المتعددة",
      icon: <Wrench className="h-6 w-6 text-purple-600 dark:text-purple-400" />,
    },
    {
      type: "labor",
      title: "عمل فني / عمالة يومية",
      description: "تسجيل فواتير المصنعيات، أجور الفنيين، واليوميات المباشرة للمشروع",
      icon: <Users className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
    },
    {
      type: "expense",
      title: "مصروف مباشر للمشروع",
      description: "تسجيل نثريات، وقود، ضيافة، ومصروفات موقعية نقدية مباشرة",
      icon: <Receipt className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
      badge: "نقدي",
    },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <h3 className="text-sm font-bold text-foreground">ماذا تريد أن تضيف للمشروع؟</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          اختر نوع العملية لعرض الحقول المناسبة لها بدقة وبدون تعقيد.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {operations.map((op) => {
          const isSelected = selectedType === op.type;
          return (
            <div
              key={op.type}
              onClick={() => onSelectType(op.type)}
              className={cn(
                "group relative flex items-start gap-3.5 p-3.5 rounded-xl border bg-card text-card-foreground cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-sm",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/70"
              )}
            >
              <div className="p-2 rounded-lg bg-muted/60 group-hover:bg-background transition-colors shrink-0">
                {op.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{op.title}</span>
                  {op.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {op.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {op.description}
                </p>
              </div>

              <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-1 shrink-0 self-center" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
