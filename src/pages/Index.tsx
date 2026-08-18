import { useState, useEffect } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const Index = () => {
  const { user, isAdmin, role, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { setTheme } = useTheme();

  // Convert Hex to HSL space-separated values for Tailwind
  const hexToHSL = (hexColor: string) => {
    let hex = hexColor.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return "42 67% 55%"; // Default gold

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

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

  useEffect(() => {
    if (settings) {
      const sData = settings as any;
      if (sData.theme_color) {
        const hslVal = hexToHSL(sData.theme_color);
        document.documentElement.style.setProperty("--primary", hslVal);
      }
      if (sData.default_theme) {
        setTheme(sData.default_theme);
      }
    }
  }, [settings, setTheme]);

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch active rentals count
  const { data: activeRentalsCount } = useQuery({
    queryKey: ["active-rentals-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("equipment_rentals")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Global App Sidebar (Desktop + Mobile Sheet) */}
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        activeRentalsCount={activeRentalsCount || 0}
        settings={settings}
        profile={profile}
        onSignOut={signOut}
      />

      {/* Main Content Area */}
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-200 ease-in-out min-w-0",
          sidebarCollapsed ? "md:mr-[70px]" : "md:mr-64",
          "mr-0"
        )}
      >
        <Header onMobileMenuToggle={() => setIsMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Index;
