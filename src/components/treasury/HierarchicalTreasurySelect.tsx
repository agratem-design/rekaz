import React, { useMemo, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Landmark, Wallet } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";

export interface TreasuryOption {
  id: string;
  name: string;
  parent_id?: string | null;
  balance?: number | null;
  treasury_type?: string | null;
  project_category?: string | null;
  is_active?: boolean;
}

export interface HierarchicalTreasurySelectProps {
  value: string;
  onValueChange: (treasuryId: string) => void;
  treasuries: TreasuryOption[];
  selectedParentId?: string;
  onParentChange?: (parentId: string) => void;
  parentLabel?: string;
  childLabel?: string;
  parentPlaceholder?: string;
  childPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  layout?: "grid" | "vertical";
  parentAriaLabel?: string;
  childAriaLabel?: string;
  excludeTreasuryId?: string;
  allowParentIfNoChildren?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
}

export const HierarchicalTreasurySelect: React.FC<HierarchicalTreasurySelectProps> = ({
  value,
  onValueChange,
  treasuries = [],
  selectedParentId: controlledParentId,
  onParentChange,
  parentLabel = "الخزينة الرئيسية *",
  childLabel = "الحساب / الفرع التابع *",
  parentPlaceholder = "اختر الخزينة الرئيسية...",
  childPlaceholder = "اختر الحساب أو الفرع...",
  disabled = false,
  required = false,
  layout = "grid",
  parentAriaLabel,
  childAriaLabel,
  excludeTreasuryId,
  allowParentIfNoChildren = true,
  allowNone = false,
  noneLabel = "-- بدون خزينة --",
  className = "",
}) => {
  const [internalParentId, setInternalParentId] = useState<string>("");

  const currentParentId = controlledParentId !== undefined ? controlledParentId : internalParentId;

  // Active parent (root) treasuries
  const parentTreasuries = useMemo(() => {
    return treasuries.filter((t) => {
      if (t.is_active === false) return false;
      return !t.parent_id;
    });
  }, [treasuries]);

  // Synchronize parent from value if provided and parent is not set
  useEffect(() => {
    if (!value || value === "none") {
      if (controlledParentId === undefined && !currentParentId) {
        setInternalParentId("");
      }
      return;
    }

    const currentSelected = treasuries.find((t) => t.id === value);
    if (!currentSelected) return;

    const resolvedParentId = currentSelected.parent_id || currentSelected.id;
    if (resolvedParentId && resolvedParentId !== currentParentId) {
      if (controlledParentId === undefined) {
        setInternalParentId(resolvedParentId);
      }
      onParentChange?.(resolvedParentId);
    }
  }, [value, treasuries, currentParentId, controlledParentId, onParentChange]);

  // Available child / branch treasuries for current parent
  const childTreasuries = useMemo(() => {
    if (!currentParentId || currentParentId === "none") return [];
    
    let children = treasuries.filter((t) => {
      if (t.is_active === false) return false;
      if (excludeTreasuryId && t.id === excludeTreasuryId) return false;
      return t.parent_id === currentParentId;
    });

    if (children.length === 0 && allowParentIfNoChildren) {
      const parent = treasuries.find((t) => t.id === currentParentId);
      if (parent && (!excludeTreasuryId || parent.id !== excludeTreasuryId)) {
        return [parent];
      }
    }

    return children;
  }, [treasuries, currentParentId, excludeTreasuryId, allowParentIfNoChildren]);

  const handleParentSelect = (pId: string) => {
    if (controlledParentId === undefined) {
      setInternalParentId(pId);
    }
    onParentChange?.(pId);

    if (pId === "none") {
      onValueChange(allowNone ? "none" : "");
      return;
    }

    const availableChildren = treasuries.filter((t) => {
      if (t.is_active === false) return false;
      if (excludeTreasuryId && t.id === excludeTreasuryId) return false;
      return t.parent_id === pId;
    });

    if (availableChildren.length === 0 && allowParentIfNoChildren) {
      const parent = treasuries.find((t) => t.id === pId);
      if (parent && (!excludeTreasuryId || parent.id !== excludeTreasuryId)) {
        onValueChange(parent.id);
        return;
      }
    }

    if (availableChildren.length === 1) {
      onValueChange(availableChildren[0].id);
    } else {
      onValueChange("");
    }
  };

  const containerClasses =
    layout === "grid"
      ? `grid grid-cols-1 sm:grid-cols-2 gap-3 text-right ${className}`
      : `space-y-3 text-right ${className}`;

  return (
    <div className={containerClasses} dir="rtl">
      {/* 1. Main Treasury */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <Landmark className="h-3.5 w-3.5 text-primary" />
          <span>{parentLabel}</span>
        </Label>
        <Select
          value={currentParentId || (allowNone ? "none" : "")}
          onValueChange={handleParentSelect}
          disabled={disabled}
          dir="rtl"
        >
          <SelectTrigger className="h-9 text-xs" aria-label={parentAriaLabel} dir="rtl">
            <SelectValue placeholder={parentPlaceholder} />
          </SelectTrigger>
          <SelectContent dir="rtl">
            {allowNone && (
              <SelectItem value="none" className="text-xs text-muted-foreground">
                {noneLabel}
              </SelectItem>
            )}
            {parentTreasuries.map((pt) => (
              <SelectItem key={pt.id} value={pt.id} className="text-xs">
                {pt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. Branch / Child Treasury */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          <span>{childLabel}</span>
        </Label>
        <Select
          value={value || (allowNone && currentParentId === "none" ? "none" : "")}
          onValueChange={onValueChange}
          disabled={disabled || !currentParentId || currentParentId === "none"}
          dir="rtl"
          required={required}
        >
          <SelectTrigger className="h-9 text-xs" aria-label={childAriaLabel} dir="rtl">
            <SelectValue
              placeholder={
                !currentParentId || currentParentId === "none"
                  ? "حدد الخزينة الرئيسية أولاً"
                  : childPlaceholder
              }
            />
          </SelectTrigger>
          <SelectContent dir="rtl">
            {allowNone && (
              <SelectItem value="none" className="text-xs text-muted-foreground">
                {noneLabel}
              </SelectItem>
            )}
            {childTreasuries.map((ct) => (
              <SelectItem key={ct.id} value={ct.id} className="text-xs">
                {ct.name}{" "}
                {ct.balance !== undefined && ct.balance !== null
                  ? `(${formatCurrencyLYD(ct.balance)})`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentParentId && currentParentId !== "none" && childTreasuries.length === 0 && (
          <p role="alert" className="text-[11px] text-destructive">
            لا توجد حسابات فرعية نشطة تابعة لهذه الخزينة
          </p>
        )}
      </div>
    </div>
  );
};
