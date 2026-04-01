import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Check, X, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const SearchableSelect = ({
  options,
  value,
  onValueChange,
  placeholder = "بحث...",
  disabled = false,
  className,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(s) || o.sublabel?.toLowerCase().includes(s)
    );
  }, [options, search]);

  const selectedOption = options.find((o) => o.value === value);

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
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className={cn(
          "flex items-center h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer hover:bg-accent/50 transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-ring ring-offset-1"
        )}
      >
        <span className={cn("flex-1 truncate text-right", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 mr-1">
          {value && !disabled && (
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" onClick={handleClear} />
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          {/* Search input */}
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="h-8 pr-7 text-xs bg-background"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setSearch("");
                  }
                  if (e.key === "Enter" && filtered.length === 1) {
                    handleSelect(filtered[0].value);
                  }
                }}
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">لا توجد نتائج</p>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  onClick={() => handleSelect(o.value)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-accent transition-colors",
                    value === o.value && "bg-accent"
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", value === o.value ? "text-primary opacity-100" : "opacity-0")} />
                  <div className="flex-1 text-right truncate">
                    <span>{o.label}</span>
                    {o.sublabel && <span className="text-xs text-muted-foreground mr-1">({o.sublabel})</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
