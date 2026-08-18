import React, { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Check, X, ChevronDown, Plus, User, Building2, Phone } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  phone?: string;
  badge?: string;
}

interface EntityComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  onCreateNew?: () => void;
  createButtonText?: string;
  showCreateButton?: boolean;
  icon?: "user" | "building" | "none";
}

export const EntityCombobox: React.FC<EntityComboboxProps> = ({
  options,
  value,
  onValueChange,
  placeholder = "اختر...",
  searchPlaceholder = "ابحث بالاسم أو الهاتف...",
  emptyText = "لا توجد نتائج مطابقة",
  disabled = false,
  className,
  onCreateNew,
  createButtonText = "+ إضافة جديد",
  showCreateButton = false,
  icon = "building",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase().trim();
    return options.filter((o) => {
      const matchLabel = o.label.toLowerCase().includes(s);
      const matchSub = o.sublabel ? o.sublabel.toLowerCase().includes(s) : false;
      const matchPhone = o.phone ? o.phone.toLowerCase().includes(s) : false;
      const matchBadge = o.badge ? o.badge.toLowerCase().includes(s) : false;
      return matchLabel || matchSub || matchPhone || matchBadge;
    });
  }, [options, search]);

  const selectedOption = useMemo(() => {
    return options.find((o) => o.value === value);
  }, [options, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (val: string) => {
    onValueChange(val);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange("");
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} dir="rtl">
      {/* Trigger Button */}
      <div
        onClick={handleOpen}
        className={cn(
          "flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-accent/40 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-ring ring-offset-1"
        )}
      >
        {icon === "building" && <Building2 className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />}
        {icon === "user" && <User className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />}
        
        <span className={cn("flex-1 truncate text-right", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {selectedOption?.phone && (
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {selectedOption.phone}
          </span>
        )}

        <div className="flex items-center gap-1 mr-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95">
          {/* Search Header */}
          <div className="p-2 border-b border-border/60">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pr-8 pl-3 h-9 text-sm text-right"
              />
            </div>
          </div>

          {/* Quick Create Action Button */}
          {showCreateButton && onCreateNew && (
            <div className="p-1.5 border-b border-border/40 bg-muted/20">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
                className="w-full justify-start text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary h-8"
              >
                <Plus className="h-3.5 w-3.5 ml-1.5" />
                {createButtonText}
              </Button>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/20">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-foreground"
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {(opt.sublabel || opt.phone) && (
                        <span className="text-xs text-muted-foreground truncate">
                          {opt.sublabel} {opt.phone ? `• ${opt.phone}` : ""}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mr-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
