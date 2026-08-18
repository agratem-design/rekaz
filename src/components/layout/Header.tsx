import React, { useState, useEffect } from "react";
import { Search, Bell, Building2, LogOut, Settings, User, Shield, UserCog, CheckCheck, Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

import { getAuditSummary } from "@/lib/auditHelpers";
import { GlobalCommandPalette } from "@/components/navigation/GlobalCommandPalette";

export interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export const Header = ({ onMobileMenuToggle }: HeaderProps = {}) => {
  const { user, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
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

  // Fetch recent audit logs as notifications
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
    refetchInterval: 30000, // refresh every 30 seconds
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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      {/* Mobile Menu Toggle Button */}
      {onMobileMenuToggle && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuToggle}
          className="md:hidden shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Company Logo & Name */}
      <div className="flex items-center gap-2.5">
        {settings?.company_logo ? (
          <img
            src={settings.company_logo}
            alt={settings?.company_name || "شعار الشركة"}
            className="h-9 w-9 object-contain rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
        )}
        <span className="font-bold text-base hidden sm:block">
          {settings?.company_name || "اسم الشركة"}
        </span>
      </div>

      {/* Real Command Palette Search Trigger (Fake search count = 0) */}
      <div className="flex-1 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="relative flex-1 max-w-sm flex items-center justify-between px-3 h-9 rounded-xl bg-secondary/80 hover:bg-secondary border border-border/80 hover:border-primary/40 transition-all text-muted-foreground hover:text-foreground text-xs cursor-pointer"
          aria-label="فتح البحث الشامل (Ctrl+K)"
          title="البحث الشامل في المنظومة (Ctrl+K)"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">ابحث عن مشروع، عميل، مورد، صفحة...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-muted/80 px-1.5 py-0.5 rounded border border-border text-muted-foreground shrink-0">
            <span>Ctrl</span>
            <span>+</span>
            <span>K</span>
          </kbd>
        </button>
      </div>

      <GlobalCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <div className="flex items-center gap-1">
        {/* Dark/Light Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "الوضع الفاتح" : "الوضع المظلم"}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-5 w-5 text-amber-500" />
          ) : (
            <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          )}
        </Button>

        {/* Notifications Bell */}
        {isAdmin && (
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
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
            <Button variant="ghost" size="sm" className="gap-2 px-2">
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
