import { useState, useEffect } from "react";
import { Search, Bell, Building2, LogOut, Settings, User, Shield, UserCog, CheckCheck, Sun, Moon, Command, Menu, Cloud, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isOfflineMode } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useTheme } from "next-themes";
import { getAuditSummary } from "@/lib/auditHelpers";

// Search pages data
const SEARCH_PAGES = [
  { name: "لوحة التحكم", href: "/", group: "الرئيسية" },
  { name: "لوحة التحكم المالية", href: "/accountant", group: "الرئيسية" },
  { name: "المشاريع", href: "/projects", group: "الرئيسية" },
  { name: "سجل حركات الزبائن", href: "/client-activities", group: "الرئيسية" },
  { name: "البنود العامة", href: "/general-items", group: "العمليات" },
  { name: "المعدات", href: "/equipment", group: "العمليات" },
  { name: "إيجارات المشاريع", href: "/rentals", group: "العمليات" },
  { name: "المخازن", href: "/inventory", group: "العمليات" },
  { name: "التدفق النقدي", href: "/cash-flow", group: "التخطيط" },
  { name: "سجل المخاطر", href: "/risk-register", group: "التخطيط" },
  { name: "الجدولة الزمنية", href: "/schedule", group: "التخطيط" },
  { name: "ضبط الجودة", href: "/quality", group: "التخطيط" },
  { name: "أوامر التغيير", href: "/variation-orders", group: "التخطيط" },
  { name: "العملاء", href: "/clients", group: "الأشخاص" },
  { name: "الموردون", href: "/suppliers", group: "الأشخاص" },
  { name: "الفنيون", href: "/technicians", group: "الأشخاص" },
  { name: "المهندسون", href: "/engineers", group: "الأشخاص" },
  { name: "الموظفين", href: "/employees", group: "الأشخاص" },
  { name: "مصروفات المشاريع", href: "/project-expenses", group: "المالية" },
  { name: "مركز الفواتير", href: "/invoice-control", group: "المالية" },
  { name: "خزائن الشركة", href: "/treasuries", group: "المالية" },
  { name: "الدخول", href: "/income", group: "المالية" },
  { name: "الدخول والخروج", href: "/transfers", group: "المالية" },
  { name: "الخروج", href: "/expenses", group: "المالية" },
  { name: "التقارير", href: "/reports", group: "النظام" },
  { name: "سجل التعديلات", href: "/audit-log", group: "النظام" },
  { name: "المستخدمون", href: "/users", group: "النظام" },
  { name: "التقويم", href: "/calendar", group: "النظام" },
  { name: "الإعدادات", href: "/settings", group: "النظام" },
  { name: "تصميم الطباعة", href: "/print-design", group: "النظام" },
  { name: "قوالب العقود", href: "/contract-templates", group: "النظام" },
  { name: "معرض الصور", href: "/gallery", group: "النظام" },
  { name: "قاعدة بيانات MySQL", href: "/database-manager", group: "النظام" },
  { name: "العهد", href: "/custody", group: "العمليات" },
];

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const { user, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: notifications } = useQuery({
    queryKey: ["header-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.length ?? 0;

  const roleLabel = {
    admin: "مدير النظام",
    engineer: "مهندس",
    accountant: "محاسب",
    supervisor: "مشرف",
  }[role ?? ""] ?? "مستخدم";

  const displayName =
    profile?.display_name || profile?.username || user?.email?.split("@")[0] || "المستخدم";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Group search pages
  const searchGroups = SEARCH_PAGES.reduce((acc, page) => {
    if (!acc[page.group]) acc[page.group] = [];
    acc[page.group].push(page);
    return acc;
  }, {} as Record<string, typeof SEARCH_PAGES>);

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 md:px-6">
      {/* Mobile Menu Button */}
      {onMenuClick && (
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0 md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Company Logo & Name - hidden on mobile when menu button exists */}
      <div className={`flex items-center gap-3 ${onMenuClick ? "hidden md:flex" : "flex"}`}>
        {settings?.company_logo ? (
          <img
            src={settings.company_logo}
            alt={settings?.company_name || "شعار الشركة"}
            className="h-8 w-8 md:h-9 md:w-9 object-contain rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
        )}
        <span className="font-bold text-base hidden sm:block">
          {settings?.company_name || "اسم الشركة"}
        </span>
        {/* Mode indicator */}
        <Badge
          variant={isOfflineMode ? "secondary" : "outline"}
          className="hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5"
        >
          {isOfflineMode ? (
            <>
              <HardDrive className="h-3 w-3 text-amber-500" />
              محلي
            </>
          ) : (
            <>
              <Cloud className="h-3 w-3 text-green-500" />
              Cloud
            </>
          )}
        </Badge>
      </div>

      {/* Search - triggers CommandDialog */}
      <div className="flex-1 flex items-center gap-4">
        <button
          onClick={() => setSearchOpen(true)}
          className="relative flex-1 max-w-sm flex items-center gap-2 h-8 md:h-9 px-2.5 md:px-3 rounded-md border border-input bg-secondary/50 text-muted-foreground text-xs md:text-sm hover:bg-secondary transition-colors"
        >
          <Search className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
          <span>بحث...</span>
          <kbd className="mr-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Command Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="ابحث عن صفحة أو وظيفة..." />
        <CommandList>
          <CommandEmpty>لا توجد نتائج</CommandEmpty>
          {Object.entries(searchGroups).map(([group, pages]) => (
            <CommandGroup key={group} heading={group}>
              {pages.map((page) => (
                <CommandItem
                  key={page.href}
                  value={page.name}
                  onSelect={() => {
                    navigate(page.href);
                    setSearchOpen(false);
                  }}
                >
                  {page.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>

      <div className="flex items-center gap-0.5 md:gap-1">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-9 md:w-9"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 md:h-5 md:w-5" /> : <Moon className="h-4 w-4 md:h-5 md:w-5" />}
        </Button>

        {/* Notifications Bell */}
        {isAdmin && (
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-9 md:w-9">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] leading-none flex items-center justify-center"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  آخر التعديلات
                </span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} تعديل
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!notifications || notifications.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  <CheckCheck className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  لا توجد تعديلات جديدة
                </div>
              ) : (
              notifications.map((log: any) => {
                  const summary = getAuditSummary(log);
                  const timeAgo = formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                    locale: ar,
                  });
                  const actionColor =
                    log.action === "INSERT"
                      ? "text-green-600"
                      : log.action === "DELETE"
                      ? "text-red-600"
                      : "text-blue-600";
                  return (
                    <DropdownMenuItem
                      key={log.id}
                      className="flex flex-col items-start gap-0.5 py-2.5 cursor-default"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <span className={`text-xs font-semibold ${actionColor}`}>{summary.action}</span>
                        <span className="text-xs text-foreground">{summary.table}</span>
                        <span className="text-xs text-muted-foreground mr-auto">{timeAgo}</span>
                      </div>
                      {summary.details && (
                        <span className="text-[11px] text-muted-foreground/80 leading-snug line-clamp-2">
                          {summary.details}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        بواسطة: {summary.user}
                      </span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 md:gap-2 px-1.5 md:px-2">
              <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                {isAdmin ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-xs font-semibold leading-tight">{displayName}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{roleLabel}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="font-semibold">{displayName}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
              <Badge variant="secondary" className="w-fit text-[10px] mt-1">{roleLabel}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate("/users")} className="gap-2 cursor-pointer">
                <UserCog className="h-4 w-4" />
                إدارة المستخدمين
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              الإعدادات
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
