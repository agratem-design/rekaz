import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Building2,
  User,
  Users,
  Truck,
  Wrench,
  Landmark,
  Layers,
  FileText,
  CreditCard,
  Settings,
  Shield,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { getAllSearchableNavItems } from "@/config/navigation";

interface GlobalCommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GlobalCommandPalette({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: GlobalCommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { user, role, isAdmin, isAccountant, isEngineer } = useAuth();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = useCallback(
    (val: boolean) => {
      if (isControlled && setControlledOpen) {
        setControlledOpen(val);
      } else {
        setInternalOpen(val);
      }
      if (!val) {
        setSearchQuery("");
        setSelectedIndex(0);
      }
    },
    [isControlled, setControlledOpen]
  );

  // Global Keyboard Shortcut: Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Queries for search datasets
  const { data: projects } = useQuery({
    queryKey: ["command-palette-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_type, client_id, clients:client_id(name)")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const { data: clients } = useQuery({
    queryKey: ["command-palette-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["command-palette-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, category, phone")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const { data: technicians } = useQuery({
    queryKey: ["command-palette-technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, specialty, phone")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  const { data: treasuries } = useQuery({
    queryKey: ["command-palette-treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, balance")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  // Application system navigation pages from canonical metadata
  const searchableNavItems = useMemo(() => {
    return getAllSearchableNavItems(role, isAdmin);
  }, [role, isAdmin]);

  // Combined Search Results Filter
  const filteredResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query ? query.split(/\s+/) : [];
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      type: "project" | "client" | "supplier" | "technician" | "treasury" | "page";
      typeLabel: string;
      path: string;
      icon: React.ElementType;
      badgeColor: string;
    }> = [];

    // 1. Filter System Pages from Canonical Navigation Config
    searchableNavItems.forEach((item) => {
      const matches =
        !query ||
        queryWords.every(
          (w) =>
            item.name.toLowerCase().includes(w) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(w)) ||
            (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(w)))
        );

      if (matches) {
        results.push({
          id: `page-${item.id}`,
          title: item.name,
          subtitle: item.subtitle || item.groupLabel,
          type: "page",
          typeLabel: "صفحة",
          path: item.href,
          icon: item.icon,
          badgeColor: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
        });
      }
    });

    // 2. Filter Projects
    projects?.forEach((p) => {
      const clientName = (p.clients as any)?.name;
      const isFinishing = p.project_type === "finishing";
      const typeText = isFinishing ? "تشطيبات" : "مقاولات";

      if (
        !query ||
        p.name.toLowerCase().includes(query) ||
        (clientName && clientName.toLowerCase().includes(query)) ||
        typeText.includes(query)
      ) {
        results.push({
          id: `project-${p.id}`,
          title: p.name,
          subtitle: clientName ? `العميل: ${clientName} • ${typeText}` : typeText,
          type: "project",
          typeLabel: "مشروع",
          path: `/projects/${p.id}`,
          icon: isFinishing ? Sparkles : Building2,
          badgeColor: isFinishing
            ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
            : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        });
      }
    });

    // 3. Filter Clients
    clients?.forEach((c) => {
      if (
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query))
      ) {
        results.push({
          id: `client-${c.id}`,
          title: c.name,
          subtitle: c.phone ? `هاتف: ${c.phone}` : "سجل عميل",
          type: "client",
          typeLabel: "عميل",
          path: `/clients/${c.id}`,
          icon: User,
          badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        });
      }
    });

    // 4. Filter Suppliers
    suppliers?.forEach((s) => {
      if (
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.category && s.category.toLowerCase().includes(query)) ||
        (s.phone && s.phone.includes(query))
      ) {
        results.push({
          id: `supplier-${s.id}`,
          title: s.name,
          subtitle: s.category ? `التصنيف: ${s.category}` : "سجل مورد",
          type: "supplier",
          typeLabel: "مورد",
          path: `/suppliers/${s.id}`,
          icon: Truck,
          badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        });
      }
    });

    // 5. Filter Technicians
    technicians?.forEach((t) => {
      if (
        !query ||
        t.name.toLowerCase().includes(query) ||
        (t.specialty && t.specialty.toLowerCase().includes(query)) ||
        (t.phone && t.phone.includes(query))
      ) {
        results.push({
          id: `technician-${t.id}`,
          title: t.name,
          subtitle: t.specialty ? `التخصص: ${t.specialty}` : "سجل فني",
          type: "technician",
          typeLabel: "فني",
          path: `/technicians/${t.id}`,
          icon: Wrench,
          badgeColor: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
        });
      }
    });

    // 6. Filter Treasuries
    if (isAdmin || isAccountant) {
      treasuries?.forEach((tr) => {
        if (!query || tr.name.toLowerCase().includes(query)) {
          results.push({
            id: `treasury-${tr.id}`,
            title: tr.name,
            subtitle: `الرصيد: ${formatCurrencyLYD(tr.balance || 0)}`,
            type: "treasury",
            typeLabel: "خزينة",
            path: `/treasuries/${tr.id}`,
            icon: Landmark,
            badgeColor: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
          });
        }
      });
    }

    return results;
  }, [searchQuery, searchableNavItems, projects, clients, suppliers, technicians, treasuries, isAdmin, isAccountant]);

  // Handle item navigation selection
  const handleSelect = (item: (typeof filteredResults)[0]) => {
    setIsOpen(false);
    navigate(item.path);
  };

  // Keyboard navigation inside results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredResults[selectedIndex]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl" dir="rtl">
        {/* Search Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <Input
            autoFocus
            placeholder="ابحث عن مشروع، عميل، مورد، فني، خزينة، أو صفحة في المنظومة..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="h-10 text-base bg-transparent border-0 shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded-md shrink-0">
            <span>ESC</span>
            <span>للإغلاق</span>
          </div>
        </div>

        {/* Results List */}
        <ScrollArea className="max-h-[420px] p-2">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
              <p className="font-semibold text-foreground text-sm">لا توجد نتائج مطابقة</p>
              {searchQuery && (
                <p className="text-xs mt-1">لم نتمكن من العثور على أي نتائج لـ "{searchQuery}"</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredResults.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-right p-3 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "hover:bg-muted/60 text-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">
                            {item.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 font-medium ${item.badgeColor}`}
                          >
                            {item.typeLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected ? (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <span>انتقال</span>
                          <CornerDownLeft className="h-3.5 w-3.5" />
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer Navigation Instructions */}
        <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">↓</kbd>
              <span>للتنقل</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd>
              <span>للاختيار</span>
            </span>
          </div>
          <span className="text-[11px] font-mono">
            {filteredResults.length} نتيجة متاحة
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
