import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PartyAccountHeader({
  kind,
  name,
  description,
  icon,
  details,
  actions,
}: {
  kind: string;
  name: string;
  description: string;
  icon: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-xs" dir="rtl">
      <div className="h-1 bg-primary" />
      <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <Badge variant="outline" className="mb-1 border-primary/30 bg-primary/10 text-primary">{kind}</Badge>
            <h1 className="truncate text-xl font-black leading-tight text-foreground sm:text-2xl">{name}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            {details && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">{details}</div>}
          </div>
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div>}
      </div>
    </Card>
  );
}

export function AccountSection({
  number,
  title,
  description,
  action,
}: {
  number: number;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-r-4 border-primary pr-3 sm:flex-row sm:items-end sm:justify-between" dir="rtl">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{number}</span>
          <h2 className="text-lg font-black text-foreground">{title}</h2>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

const toneClasses = {
  neutral: "border-border/80 bg-card",
  success: "border-emerald-600/30 bg-emerald-600/5",
  primary: "border-primary/40 bg-primary/5",
};

export function AccountSummaryGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    description: string;
    icon: ReactNode;
    tone?: keyof typeof toneClasses;
  }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3" dir="rtl">
      {items.map((item) => (
        <Card key={item.label} className={`min-h-36 rounded-xl border p-4 shadow-xs ${toneClasses[item.tone || "neutral"]}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-muted-foreground">{item.label}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/80 text-primary">{item.icon}</span>
          </div>
          <p className="mt-4 text-2xl font-black text-foreground" dir="ltr">{item.value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
        </Card>
      ))}
    </div>
  );
}
