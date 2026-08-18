import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border/80 bg-card/40 transition-colors duration-200",
        className
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-3.5 shadow-sm">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed mb-4">
        {description}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
