import React, { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2,
  ChevronDown,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import {
  getCanonicalSidebarGroups,
  isNavItemActive,
  type NavigationGroup,
  type NavigationItem,
  type AppUserRole,
} from "@/config/navigation";

export interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  activeRentalsCount?: number;
  settings?: {
    company_name?: string | null;
    company_logo?: string | null;
  } | null;
  profile?: {
    display_name?: string | null;
    username?: string | null;
    title?: string | null;
  } | null;
  onSignOut: () => Promise<void> | void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onMobileClose,
  activeRentalsCount = 0,
  settings,
  profile,
  onSignOut,
}: AppSidebarProps) {
  const location = useLocation();
  const { user, role, isAdmin, isEngineer, isAccountant } = useAuth();

  // 1. Get canonical navigation groups from single authority
  const navigationGroups = useMemo(() => {
    return getCanonicalSidebarGroups(role, isAdmin);
  }, [role, isAdmin]);

  // 2. Identify the active group based on current URL path
  const activeGroupId = useMemo(() => {
    for (const group of navigationGroups) {
      for (const item of group.items) {
        if (isNavItemActive(item, location.pathname, role)) {
          return group.id;
        }
      }
    }
    return navigationGroups[0]?.id || "main";
  }, [location.pathname, navigationGroups, role]);

  // 3. User manual accordion state: auto-expand the active group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => ({
        ...prev,
        [activeGroupId]: true,
      }));
    }
  }, [activeGroupId]);

  const isGroupOpen = (groupId: string) => {
    if (groupId in openGroups) return openGroups[groupId];
    return groupId === activeGroupId || groupId === "main";
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !isGroupOpen(groupId),
    }));
  };

  const userDisplayName =
    profile?.display_name ||
    profile?.username ||
    user?.email?.split("@")[0] ||
    "المستخدم";

  const userRoleLabel =
    profile?.title ||
    (isAdmin
      ? "مدير النظام"
      : isEngineer
      ? "مهندس مشاريع"
      : isAccountant
      ? "المحاسب المالي"
      : role === "supervisor"
      ? "مشرف موقع"
      : "موظف");

  // Helper to render nav items
  const renderNavList = (isMobile: boolean = false) => {
    return (
      <ul className="space-y-3.5">
        {navigationGroups.map((group) => {
          const hasActiveChild = group.items.some((item) =>
            isNavItemActive(item, location.pathname, role)
          );
          const isOpen = isGroupOpen(group.id);

          return (
            <li key={group.id} className="space-y-0.5">
              {/* Group Header (Expanded / Mobile) - Semantic, transparent, no pill background */}
              {(!collapsed || isMobile) ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={`group-items-${group.id}`}
                  className={cn(
                    "flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-semibold tracking-wider transition-colors cursor-pointer select-none",
                    hasActiveChild
                      ? "text-foreground/90 font-bold"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent/30"
                  )}
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 shrink-0",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>
              ) : (
                <div className="my-1.5 mx-auto w-6 border-t border-sidebar-border/40" />
              )}

              {/* Group Items */}
              {(collapsed && !isMobile) ? (
                // Collapsed desktop mode: Tooltip icons
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isNavItemActive(item, location.pathname, role);

                    return (
                      <li key={item.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.href}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "relative flex h-10 w-10 mx-auto items-center justify-center rounded-lg transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                isActive
                                  ? "bg-primary/[0.08] text-primary font-semibold before:absolute before:right-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-l-full before:bg-primary"
                                  : "text-muted-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                              )}
                            >
                              <Icon className="h-[18px] w-[18px] shrink-0" />
                              {item.id === "rentals" && activeRentalsCount > 0 && (
                                <span className="absolute top-1.5 left-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                              )}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-right">
                            <p className="font-semibold text-xs">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{group.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                // Expanded mode / Mobile mode
                isOpen && (
                  <ul id={`group-items-${group.id}`} className="space-y-0.5 pr-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isNavItemActive(item, location.pathname, role);

                      return (
                        <li key={item.id}>
                          <Link
                            to={item.href}
                            onClick={() => {
                              if (isMobile && onMobileClose) {
                                onMobileClose();
                              }
                            }}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isMobile && "min-h-[44px]",
                              isActive
                                ? "bg-primary/[0.08] text-foreground font-semibold before:absolute before:right-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-l-full before:bg-primary"
                                : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-[18px] w-[18px] shrink-0 transition-colors",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground/70 group-hover:text-sidebar-foreground"
                              )}
                            />
                            <span className="truncate flex-1 text-right">{item.name}</span>
                            {item.id === "rentals" && activeRentalsCount > 0 && (
                              <Badge
                                variant={isActive ? "default" : "secondary"}
                                className="text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center shrink-0"
                              >
                                {activeRentalsCount}
                              </Badge>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      {/* ========================================================= */}
      {/* 1. DESKTOP PERMANENT SIDEBAR                               */}
      {/* ========================================================= */}
      <aside
        aria-label="القائمة الرئيسية"
        className={cn(
          "fixed right-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-l border-sidebar-border/60 shadow-xs transition-all duration-200 ease-in-out hidden md:flex md:flex-col",
          collapsed ? "w-[70px]" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            "flex h-[68px] items-center border-b border-sidebar-border/40 shrink-0 px-3.5",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {settings?.company_logo ? (
                <img
                  src={settings.company_logo}
                  alt={settings?.company_name || "شعار الشركة"}
                  className="h-9 w-9 object-contain rounded-lg shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-foreground truncate max-w-[130px]">
                  {settings?.company_name || "ركاز"}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  منظومة إدارة المقاولات
                </span>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 cursor-pointer"
                  onClick={onToggleCollapse}
                >
                  <Building2 className="h-5 w-5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="font-semibold text-xs">{settings?.company_name || "ركاز"}</p>
                <p className="text-[10px] text-muted-foreground">توسيع القائمة</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Collapse Toggle Button */}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors shrink-0 cursor-pointer"
                  aria-label="طي القائمة الجانبية"
                >
                  <PanelRightClose className="h-4.5 w-4.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">طي القائمة الجانبية</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Scrollable Navigation Body */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
          {renderNavList(false)}
        </nav>

        {/* User Account Footer */}
        <div className="border-t border-sidebar-border/40 p-2.5 shrink-0 bg-sidebar">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-semibold text-foreground truncate">{userDisplayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{userRoleLabel}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSignOut}
                    className="h-8 w-8 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0 cursor-pointer"
                    aria-label="تسجيل الخروج"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">تسجيل الخروج</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 cursor-default">
                    {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="font-semibold text-xs">{userDisplayName}</p>
                  <p className="text-[10px] text-muted-foreground">{userRoleLabel}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSignOut}
                    className="h-8 w-8 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0 cursor-pointer"
                    aria-label="تسجيل الخروج"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">تسجيل الخروج</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE RESPONSIVE RIGHT DRAWER (SHEET)                  */}
      {/* ========================================================= */}
      <Sheet open={isMobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent
          side="right"
          className="p-0 w-[85vw] max-w-[300px] bg-sidebar text-sidebar-foreground border-l border-sidebar-border/60 flex flex-col h-full z-50 focus:outline-none"
        >
          {/* Mobile Drawer Header */}
          <SheetHeader className="h-[68px] border-b border-sidebar-border/40 px-4 flex flex-row items-center justify-between space-y-0 text-right">
            <div className="flex items-center gap-2.5 min-w-0">
              {settings?.company_logo ? (
                <img
                  src={settings.company_logo}
                  alt={settings?.company_name || "شعار الشركة"}
                  className="h-8 w-8 object-contain rounded-lg shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
              )}
              <SheetTitle className="text-sm font-bold text-foreground truncate">
                {settings?.company_name || "ركاز"}
              </SheetTitle>
            </div>
          </SheetHeader>

          {/* Mobile Scrollable Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-3.5 scrollbar-thin">
            {renderNavList(true)}
          </nav>

          {/* Mobile User Footer */}
          <div className="border-t border-sidebar-border/40 p-3 shrink-0 bg-sidebar flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {isAdmin ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-xs font-semibold text-foreground truncate">{userDisplayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{userRoleLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="h-8 w-8 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0 cursor-pointer"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
