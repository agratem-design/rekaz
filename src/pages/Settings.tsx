import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building2, Image, FileImage, FileText, Save, Loader2, Palette, ArrowLeft, FileSignature, TrendingUp, TrendingDown, ArrowLeftRight, ShoppingCart, Wallet, Receipt, AlertCircle, ExternalLink, Sun, Moon, Monitor, RotateCcw, Settings2, Printer, FileBarChart } from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";
import { useTheme } from "next-themes";
import {
  THEME_PRESETS, DEFAULT_THEME_COLOR, applyThemeColor, clearThemeColor,
  hexToHSL, hslToHex, parseHSL, deriveThemeColors, deriveThemeColorsDark,
  COLOR_PREVIEW_CONFIG, OVERRIDE_KEYS, type ThemeOverrides
} from "@/lib/themeColors";

// ─── Theme Settings Card ───────────────────────────────────────────────────────
const ThemeSettingsCard = ({ savedThemeColor, onSaveThemeColor }: { savedThemeColor: string; onSaveThemeColor: (color: string) => void }) => {
  const { theme, setTheme } = useTheme();
  const [defaultTheme, setDefaultThemeState] = useState(() => localStorage.getItem("default-theme") || "dark");
  const [activeColor, setActiveColor] = useState(savedThemeColor || DEFAULT_THEME_COLOR);
  const [customHex, setCustomHex] = useState(() => {
    const parsed = parseHSL(savedThemeColor || DEFAULT_THEME_COLOR);
    return parsed ? hslToHex(parsed.h, parsed.s, parsed.l) : '#8B6914';
  });
  const [manualMode, setManualMode] = useState(false);
  const [overrides, setOverrides] = useState<ThemeOverrides>({});

  useEffect(() => {
    if (savedThemeColor) {
      setActiveColor(savedThemeColor);
      const parsed = parseHSL(savedThemeColor);
      if (parsed) setCustomHex(hslToHex(parsed.h, parsed.s, parsed.l));
    }
  }, [savedThemeColor]);

  const handleApplyColor = (hsl: string, ovr?: ThemeOverrides) => {
    setActiveColor(hsl);
    applyThemeColor(hsl, ovr || (manualMode ? overrides : undefined));
    onSaveThemeColor(hsl);
  };

  const handleCustomColorChange = (hex: string) => {
    setCustomHex(hex);
    const { h, s, l } = hexToHSL(hex);
    const hsl = `${h} ${s}% ${l}%`;
    handleApplyColor(hsl);
  };

  const handleReset = () => {
    setOverrides({});
    setManualMode(false);
    handleApplyColor(DEFAULT_THEME_COLOR, {});
    const parsed = parseHSL(DEFAULT_THEME_COLOR);
    if (parsed) setCustomHex(hslToHex(parsed.h, parsed.s, parsed.l));
  };

  const handleSetDefaultTheme = (value: string) => {
    setDefaultThemeState(value);
    localStorage.setItem("default-theme", value);
    setTheme(value);
    setTimeout(() => applyThemeColor(activeColor, manualMode ? overrides : undefined), 100);
  };

  const handleOverrideChange = (key: string, hex: string) => {
    const { h, s, l } = hexToHSL(hex);
    const hslVal = `${h} ${s}% ${l}%`;
    const newOverrides = { ...overrides, [key]: hslVal };
    setOverrides(newOverrides);
    applyThemeColor(activeColor, newOverrides);
  };

  // Preview colors
  const parsed = parseHSL(activeColor);
  const derivedColors = parsed
    ? (document.documentElement.classList.contains('dark')
      ? deriveThemeColorsDark(parsed.h, parsed.s, parsed.l)
      : deriveThemeColors(parsed.h, parsed.s, parsed.l))
    : null;

  const previewColors = derivedColors
    ? (manualMode ? { ...derivedColors, ...overrides } : derivedColors)
    : null;

  const getOverrideHex = (key: string): string => {
    const hslVal = overrides[key] || (previewColors ? previewColors[key as keyof typeof previewColors] : null);
    if (!hslVal) return '#888888';
    const p = parseHSL(hslVal);
    return p ? hslToHex(p.h, p.s, p.l) : '#888888';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          ألوان ومظهر الموقع
        </CardTitle>
        <CardDescription>تحكم في الوضع الفاتح/الداكن وألوان الموقع — يُحفظ لجميع المستخدمين</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Theme Mode */}
        <div className="space-y-2">
          <Label>الوضع الافتراضي للموقع</Label>
          <p className="text-xs text-muted-foreground">يُطبّق عند فتح الموقع لأول مرة</p>
          <div className="flex gap-2">
            {[
              { val: "light", icon: Sun, label: "فاتح" },
              { val: "dark", icon: Moon, label: "داكن" },
              { val: "system", icon: Monitor, label: "تلقائي" },
            ].map(({ val, icon: Icon, label }) => (
              <Button key={val} type="button" variant={defaultTheme === val ? "default" : "outline"} size="sm" onClick={() => handleSetDefaultTheme(val)} className="gap-2">
                <Icon className="h-4 w-4" /> {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Current Theme Toggle */}
        <div className="space-y-2">
          <Label>تبديل الوضع الحالي</Label>
          <div className="flex gap-3">
            <Button type="button" variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => { setTheme("light"); setTimeout(() => applyThemeColor(activeColor, manualMode ? overrides : undefined), 100); }} className="gap-2">
              <Sun className="h-4 w-4" /> فاتح
            </Button>
            <Button type="button" variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => { setTheme("dark"); setTimeout(() => applyThemeColor(activeColor, manualMode ? overrides : undefined), 100); }} className="gap-2">
              <Moon className="h-4 w-4" /> داكن
            </Button>
          </div>
        </div>

        {/* Color Presets */}
        <div className="space-y-2">
          <Label>اللون الأساسي</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEME_PRESETS.map((preset) => (
              <Button key={preset.name} type="button" variant={activeColor === preset.hsl ? "default" : "outline"} size="sm" onClick={() => handleApplyColor(preset.hsl)} className="gap-2 justify-start h-9">
                <div className="h-4 w-4 rounded-full border shrink-0" style={{ backgroundColor: `hsl(${preset.hsl})` }} />
                <span className="text-xs truncate">{preset.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Color Picker */}
        <div className="space-y-2">
          <Label>لون مخصص</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={customHex} onChange={(e) => handleCustomColorChange(e.target.value)} className="h-10 w-14 rounded-md border border-input cursor-pointer" />
            <span className="text-sm text-muted-foreground font-mono">{customHex}</span>
            <span className="text-sm text-muted-foreground font-mono">({activeColor})</span>
          </div>
        </div>

        {/* Enhanced Preview Bar with text on backgrounds */}
        {previewColors && (
          <div className="space-y-3">
            <Label>معاينة الألوان المشتقة</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {COLOR_PREVIEW_CONFIG.map(({ key, label, fgKey, fgFallback }) => {
                const bgHSL = previewColors[key as keyof typeof previewColors] || '0 0% 50%';
                const fgHSL = fgKey && previewColors[fgKey as keyof typeof previewColors]
                  ? previewColors[fgKey as keyof typeof previewColors]
                  : fgFallback;
                return (
                  <div
                    key={key}
                    className="rounded-lg p-3 text-center transition-all hover:scale-105 hover:shadow-lg border border-border/30"
                    style={{ backgroundColor: `hsl(${bgHSL})` }}
                  >
                    <span className="text-[11px] font-bold block" style={{ color: `hsl(${fgHSL})` }}>
                      {label}
                    </span>
                    <span className="text-[9px] block mt-0.5 opacity-80" style={{ color: `hsl(${fgHSL})` }}>
                      نص تجريبي
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manual Override Toggle */}
        <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
          <div>
            <Label className="text-sm">تعديل يدوي للألوان المشتقة</Label>
            <p className="text-xs text-muted-foreground">تجاوز الألوان المشتقة تلقائياً وتعديل كل لون على حدة</p>
          </div>
          <Switch checked={manualMode} onCheckedChange={(v) => { setManualMode(v); if (!v) { setOverrides({}); applyThemeColor(activeColor); } }} />
        </div>

        {/* Manual Color Overrides */}
        {manualMode && previewColors && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <Label className="text-sm font-semibold">تعديل الألوان يدوياً</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {OVERRIDE_KEYS.map((key) => {
                const labelMap: Record<string, string> = {
                  '--accent': 'تمييز',
                  '--accent-foreground': 'نص التمييز',
                  '--sidebar-primary': 'شريط أساسي',
                  '--sidebar-accent': 'شريط تمييز',
                  '--chart-1': 'رسم 1',
                  '--chart-2': 'رسم 2',
                  '--chart-3': 'رسم 3',
                  '--chart-4': 'رسم 4',
                  '--chart-5': 'رسم 5',
                };
                return (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={getOverrideHex(key)}
                      onChange={(e) => handleOverrideChange(key, e.target.value)}
                      className="h-8 w-10 rounded border border-input cursor-pointer shrink-0"
                    />
                    <span className="text-xs">{labelMap[key] || key}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reset Button */}
        <Button type="button" variant="outline" size="sm" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          إعادة للافتراضي
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Overdue Purchases Summary ─────────────────────────────────────────────────
const OverduePurchasesSummary = () => {
  const navigate = useNavigate();
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["settings-overdue-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, status, date, invoice_number, suppliers(name), projects(name)")
        .eq("status", "due")
        .order("date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  if (purchases.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p className="text-sm">✅ لا توجد فواتير مستحقة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {purchases.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
          <div>
            <p className="text-sm font-medium">{p.suppliers?.name || "مورد غير محدد"}</p>
            <p className="text-xs text-muted-foreground">
              {p.projects?.name ? `${p.projects.name} — ` : ""}
              {p.invoice_number ? `فاتورة #${p.invoice_number}` : ""} {p.date}
            </p>
          </div>
          <p className="text-sm font-bold text-destructive">
            {Number(p.total_amount - p.paid_amount).toLocaleString("ar-LY")} د.ل
          </p>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate("/project-expenses")}>
        عرض جميع الفواتير المستحقة
      </Button>
    </div>
  );
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CompanySettings {
  id: string;
  company_name: string;
  company_logo: string | null;
  report_background: string | null;
  report_bg_pos_x_mm?: number;
  report_bg_pos_y_mm?: number;
  report_bg_scale_percent?: number;
  report_padding_top_mm?: number;
  report_padding_right_mm?: number;
  report_padding_bottom_mm?: number;
  report_padding_left_mm?: number;
  report_content_max_height_mm?: number;
  report_footer_enabled?: boolean;
  report_footer_height_mm?: number;
  report_footer_bottom_mm?: number;
  print_table_header_color?: string;
  print_table_border_color?: string;
  print_section_title_color?: string;
  contract_logo_position?: string;
  contract_title_text?: string;
  contract_show_project_info?: boolean;
  contract_show_description?: boolean;
  contract_show_items_table?: boolean;
  contract_show_clauses?: boolean;
  contract_show_signatures?: boolean;
  contract_header_bg_color?: string;
  contract_header_text_color?: string;
  contract_accent_color?: string;
  contract_font_size_body?: number;
  contract_font_size_title?: number;
  contract_signature_labels?: any;
  contract_background?: string;
  contract_padding_top_mm?: number;
  contract_padding_right_mm?: number;
  contract_padding_bottom_mm?: number;
  contract_padding_left_mm?: number;
  contract_bg_pos_x_mm?: number;
  contract_bg_pos_y_mm?: number;
  contract_bg_scale_percent?: number;
  contract_footer_enabled?: boolean;
  contract_footer_height_mm?: number;
  contract_footer_bottom_mm?: number;
  image_upload_provider?: string;
  imgbb_api_key?: string;
  freeimage_api_key?: string;
  postimages_api_key?: string;
  cloudinary_cloud_name?: string;
  cloudinary_api_key?: string;
  cloudinary_upload_preset?: string;
}

const DEFAULT_PRINT_TEMPLATE = {
  bgPosX: 0, bgPosY: 0, bgScale: 100,
  padTop: 55, padRight: 12, padBottom: 35, padLeft: 12,
  contentMaxH: 200, footerEnabled: true, footerHeight: 15, footerBottom: 10,
  tableHeaderColor: '#B4A078', tableBorderColor: '#888888', sectionTitleColor: '#7A5A10',
} as const;

// ─── Main Settings Component ───────────────────────────────────────────────────
const Settings = () => {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [reportBackground, setReportBackground] = useState("");

  // Print template
  const [bgPosX, setBgPosX] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosX);
  const [bgPosY, setBgPosY] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosY);
  const [bgScale, setBgScale] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgScale);
  const [padTop, setPadTop] = useState<number>(DEFAULT_PRINT_TEMPLATE.padTop);
  const [padRight, setPadRight] = useState<number>(DEFAULT_PRINT_TEMPLATE.padRight);
  const [padBottom, setPadBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.padBottom);
  const [padLeft, setPadLeft] = useState<number>(DEFAULT_PRINT_TEMPLATE.padLeft);
  const [contentMaxH, setContentMaxH] = useState<number>(DEFAULT_PRINT_TEMPLATE.contentMaxH);
  const [footerEnabled, setFooterEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.footerEnabled);
  const [footerHeight, setFooterHeight] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerHeight);
  const [footerBottom, setFooterBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerBottom);
  const [tableHeaderColor, setTableHeaderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
  const [tableBorderColor, setTableBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableBorderColor);
  const [sectionTitleColor, setSectionTitleColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);

  // Contract print
  const [contractLogoPosition, setContractLogoPosition] = useState("right");
  const [contractTitleText, setContractTitleText] = useState("عـقـد مـقـاولـة");
  const [contractShowProjectInfo, setContractShowProjectInfo] = useState(true);
  const [contractShowDescription, setContractShowDescription] = useState(true);
  const [contractShowItemsTable, setContractShowItemsTable] = useState(true);
  const [contractShowClauses, setContractShowClauses] = useState(true);
  const [contractShowSignatures, setContractShowSignatures] = useState(true);
  const [contractHeaderBg, setContractHeaderBg] = useState("#1a365d");
  const [contractHeaderText, setContractHeaderText] = useState("#ffffff");
  const [contractAccent, setContractAccent] = useState("#c6973f");
  const [contractFontSizeBody, setContractFontSizeBody] = useState(11);
  const [contractFontSizeTitle, setContractFontSizeTitle] = useState(18);
  const [contractSigLabel1, setContractSigLabel1] = useState("الطرف الأول (صاحب العمل)");
  const [contractSigLabel2, setContractSigLabel2] = useState("الطرف الثاني (المقاول)");
  // Contract independent layout
  const [contractBackground, setContractBackground] = useState("");
  const [contractPadTop, setContractPadTop] = useState(15);
  const [contractPadRight, setContractPadRight] = useState(12);
  const [contractPadBottom, setContractPadBottom] = useState(15);
  const [contractPadLeft, setContractPadLeft] = useState(12);
  const [contractBgPosX, setContractBgPosX] = useState(0);
  const [contractBgPosY, setContractBgPosY] = useState(0);
  const [contractBgScale, setContractBgScale] = useState(100);
  const [contractFooterEnabled, setContractFooterEnabled] = useState(true);
  const [contractFooterHeight, setContractFooterHeight] = useState(12);
  const [contractFooterBottom, setContractFooterBottom] = useState(8);

  // Image upload
  const [imageProvider, setImageProvider] = useState("supabase");
  const [imgbbKey, setImgbbKey] = useState("");
  const [freeimageKey, setFreeimageKey] = useState("");
  const [postimagesKey, setPostimagesKey] = useState("");
  const [cloudName, setCloudName] = useState("");
  const [cloudApiKey, setCloudApiKey] = useState("");
  const [cloudPreset, setCloudPreset] = useState("");

  // Theme
  const [themeColor, setThemeColor] = useState(DEFAULT_THEME_COLOR);

  // Drag state for A4 preview
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"content" | "footer" | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const SCALE = 1;

  const handleMouseDown = useCallback((e: React.MouseEvent, type: "content" | "footer") => {
    e.preventDefault();
    setDragging(type);
    setDragStartY(e.clientY);
    setDragStartValue(type === "content" ? padTop : footerBottom);
  }, [padTop, footerBottom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const deltaY = e.clientY - dragStartY;
    if (dragging === "content") setPadTop(Math.round(Math.max(10, Math.min(150, dragStartValue + deltaY * SCALE))));
    else setFooterBottom(Math.round(Math.max(5, Math.min(50, dragStartValue - deltaY * SCALE))));
  }, [dragging, dragStartY, dragStartValue]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).single();
      if (error) throw error;
      return data as CompanySettings;
    },
  });

  useEffect(() => {
    if (!settings) return;
    setCompanyName(settings.company_name || "");
    setCompanyLogo(settings.company_logo || "");
    setReportBackground(settings.report_background || "");
    setBgPosX(Number(settings.report_bg_pos_x_mm ?? DEFAULT_PRINT_TEMPLATE.bgPosX));
    setBgPosY(Number(settings.report_bg_pos_y_mm ?? DEFAULT_PRINT_TEMPLATE.bgPosY));
    setBgScale(Number(settings.report_bg_scale_percent ?? DEFAULT_PRINT_TEMPLATE.bgScale));
    setPadTop(Number(settings.report_padding_top_mm ?? DEFAULT_PRINT_TEMPLATE.padTop));
    setPadRight(Number(settings.report_padding_right_mm ?? DEFAULT_PRINT_TEMPLATE.padRight));
    setPadBottom(Number(settings.report_padding_bottom_mm ?? DEFAULT_PRINT_TEMPLATE.padBottom));
    setPadLeft(Number(settings.report_padding_left_mm ?? DEFAULT_PRINT_TEMPLATE.padLeft));
    setContentMaxH(Number(settings.report_content_max_height_mm ?? DEFAULT_PRINT_TEMPLATE.contentMaxH));
    setFooterEnabled(settings.report_footer_enabled ?? DEFAULT_PRINT_TEMPLATE.footerEnabled);
    setFooterHeight(Number(settings.report_footer_height_mm ?? DEFAULT_PRINT_TEMPLATE.footerHeight));
    setFooterBottom(Number(settings.report_footer_bottom_mm ?? DEFAULT_PRINT_TEMPLATE.footerBottom));
    setTableHeaderColor(settings.print_table_header_color ?? DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
    setTableBorderColor(settings.print_table_border_color ?? DEFAULT_PRINT_TEMPLATE.tableBorderColor);
    setSectionTitleColor(settings.print_section_title_color ?? DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
    setContractLogoPosition(settings.contract_logo_position || "right");
    setContractTitleText(settings.contract_title_text || "عـقـد مـقـاولـة");
    setContractShowProjectInfo(settings.contract_show_project_info !== false);
    setContractShowDescription(settings.contract_show_description !== false);
    setContractShowItemsTable(settings.contract_show_items_table !== false);
    setContractShowClauses(settings.contract_show_clauses !== false);
    setContractShowSignatures(settings.contract_show_signatures !== false);
    setContractHeaderBg(settings.contract_header_bg_color || "#1a365d");
    setContractHeaderText(settings.contract_header_text_color || "#ffffff");
    setContractAccent(settings.contract_accent_color || "#c6973f");
    setContractFontSizeBody(Number(settings.contract_font_size_body || 11));
    setContractFontSizeTitle(Number(settings.contract_font_size_title || 18));
    const sigLabels = Array.isArray(settings.contract_signature_labels) ? settings.contract_signature_labels : ["الطرف الأول (صاحب العمل)", "الطرف الثاني (المقاول)"];
    setContractSigLabel1(sigLabels[0] || "الطرف الأول (صاحب العمل)");
    setContractSigLabel2(sigLabels[1] || "الطرف الثاني (المقاول)");
    setContractBackground((settings as any).contract_background || "");
    setContractPadTop(Number((settings as any).contract_padding_top_mm ?? 15));
    setContractPadRight(Number((settings as any).contract_padding_right_mm ?? 12));
    setContractPadBottom(Number((settings as any).contract_padding_bottom_mm ?? 15));
    setContractPadLeft(Number((settings as any).contract_padding_left_mm ?? 12));
    setContractBgPosX(Number((settings as any).contract_bg_pos_x_mm ?? 0));
    setContractBgPosY(Number((settings as any).contract_bg_pos_y_mm ?? 0));
    setContractBgScale(Number((settings as any).contract_bg_scale_percent ?? 100));
    setContractFooterEnabled((settings as any).contract_footer_enabled !== false);
    setContractFooterHeight(Number((settings as any).contract_footer_height_mm ?? 12));
    setContractFooterBottom(Number((settings as any).contract_footer_bottom_mm ?? 8));
    setImgbbKey(settings.imgbb_api_key || "");
    setFreeimageKey(settings.freeimage_api_key || "");
    setPostimagesKey(settings.postimages_api_key || "");
    setCloudName(settings.cloudinary_cloud_name || "");
    setCloudApiKey(settings.cloudinary_api_key || "");
    setCloudPreset(settings.cloudinary_upload_preset || "");
    const tc = (settings as any).theme_color || DEFAULT_THEME_COLOR;
    setThemeColor(tc);
    applyThemeColor(tc);
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("No settings found");
      const { error } = await supabase
        .from("company_settings")
        .update({
          company_name: companyName,
          company_logo: companyLogo || null,
          report_background: reportBackground || null,
          report_bg_pos_x_mm: bgPosX,
          report_bg_pos_y_mm: bgPosY,
          report_bg_scale_percent: bgScale,
          report_padding_top_mm: padTop,
          report_padding_right_mm: padRight,
          report_padding_bottom_mm: padBottom,
          report_padding_left_mm: padLeft,
          report_content_max_height_mm: contentMaxH,
          report_footer_enabled: footerEnabled,
          report_footer_height_mm: footerHeight,
          report_footer_bottom_mm: footerBottom,
          print_table_header_color: tableHeaderColor,
          print_table_border_color: tableBorderColor,
          print_section_title_color: sectionTitleColor,
          contract_logo_position: contractLogoPosition,
          contract_title_text: contractTitleText,
          contract_show_project_info: contractShowProjectInfo,
          contract_show_description: contractShowDescription,
          contract_show_items_table: contractShowItemsTable,
          contract_show_clauses: contractShowClauses,
          contract_show_signatures: contractShowSignatures,
          contract_header_bg_color: contractHeaderBg,
          contract_header_text_color: contractHeaderText,
          contract_accent_color: contractAccent,
          contract_font_size_body: contractFontSizeBody,
          contract_font_size_title: contractFontSizeTitle,
          contract_signature_labels: [contractSigLabel1, contractSigLabel2],
          contract_background: contractBackground || null,
          contract_padding_top_mm: contractPadTop,
          contract_padding_right_mm: contractPadRight,
          contract_padding_bottom_mm: contractPadBottom,
          contract_padding_left_mm: contractPadLeft,
          contract_bg_pos_x_mm: contractBgPosX,
          contract_bg_pos_y_mm: contractBgPosY,
          contract_bg_scale_percent: contractBgScale,
          contract_footer_enabled: contractFooterEnabled,
          contract_footer_height_mm: contractFooterHeight,
          contract_footer_bottom_mm: contractFooterBottom,
          imgbb_api_key: imgbbKey || null,
          freeimage_api_key: freeimageKey || null,
          postimages_api_key: postimagesKey || null,
          cloudinary_cloud_name: cloudName || null,
          cloudinary_api_key: cloudApiKey || null,
          cloudinary_upload_preset: cloudPreset || null,
          theme_color: themeColor,
        } as any)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["upload-settings"] });
      toast.success("تم حفظ الإعدادات بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
        <p className="text-muted-foreground">إعدادات الشركة والموقع</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="general" dir="rtl" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" /> عام
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5 text-xs sm:text-sm">
              <Palette className="h-4 w-4" /> المظهر
            </TabsTrigger>
            <TabsTrigger value="printing" className="gap-1.5 text-xs sm:text-sm">
              <Printer className="h-4 w-4" /> الطباعة
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-1.5 text-xs sm:text-sm">
              <FileSignature className="h-4 w-4" /> العقود
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1.5 text-xs sm:text-sm">
              <FileBarChart className="h-4 w-4" /> مالي
            </TabsTrigger>
          </TabsList>

          {/* ═══ Tab: General ═══ */}
          <TabsContent value="general" className="space-y-6">
            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> معلومات الشركة</CardTitle>
                <CardDescription>اسم الشركة الذي سيظهر في جميع أنحاء الموقع والتقارير</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">اسم الشركة</Label>
                  <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="أدخل اسم الشركة" />
                </div>
              </CardContent>
            </Card>

            {/* Company Logo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> شعار الشركة</CardTitle>
                <CardDescription>شعار الشركة الذي سيظهر في الموقع والتقارير</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploader value={companyLogo} onChange={setCompanyLogo} folder="company" label="شعار الشركة" previewClassName="h-24 w-48" />
              </CardContent>
            </Card>

            {/* Image Upload Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> إعدادات رفع الصور</CardTitle>
                <CardDescription>اختر خدمة رفع الصور وأدخل مفتاح API الخاص بها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>خدمة رفع الصور</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { value: "supabase", label: "Supabase Storage", desc: "مجاني – داخلي" },
                      { value: "database", label: "داخل قاعدة البيانات", desc: "Base64 – أوفلاين" },
                      { value: "imgbb", label: "imgbb", desc: "مجاني – خارجي" },
                      { value: "freeimage", label: "Freeimage.host", desc: "مجاني – خارجي" },
                      { value: "cloudinary", label: "Cloudinary", desc: "مجاني/مدفوع" },
                    ].map((opt) => (
                      <Button key={opt.value} type="button" variant={imageProvider === opt.value ? "default" : "outline"} className="flex flex-col h-auto py-3 gap-0.5" onClick={() => setImageProvider(opt.value)}>
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px] opacity-70">{opt.desc}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                {imageProvider === "imgbb" && (
                  <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                    <Label htmlFor="imgbbKey">مفتاح API لـ imgbb</Label>
                    <Input id="imgbbKey" value={imgbbKey} onChange={(e) => setImgbbKey(e.target.value)} placeholder="أدخل مفتاح imgbb API" dir="ltr" />
                    <p className="text-xs text-muted-foreground">احصل على المفتاح من <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">api.imgbb.com</a></p>
                  </div>
                )}
                {imageProvider === "freeimage" && (
                  <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                    <Label htmlFor="freeimageKey">مفتاح API لـ Freeimage.host</Label>
                    <Input id="freeimageKey" value={freeimageKey} onChange={(e) => setFreeimageKey(e.target.value)} placeholder="أدخل مفتاح Freeimage API" dir="ltr" />
                    <p className="text-xs text-muted-foreground">احصل على المفتاح من <a href="https://freeimage.host/page/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">freeimage.host/page/api</a></p>
                  </div>
                )}
                {imageProvider === "cloudinary" && (
                  <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                    <div className="space-y-2">
                      <Label htmlFor="cloudName">Cloud Name</Label>
                      <Input id="cloudName" value={cloudName} onChange={(e) => setCloudName(e.target.value)} placeholder="your-cloud-name" dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cloudPreset">Upload Preset</Label>
                      <Input id="cloudPreset" value={cloudPreset} onChange={(e) => setCloudPreset(e.target.value)} placeholder="your-upload-preset" dir="ltr" />
                    </div>
                    <p className="text-xs text-muted-foreground">أنشئ Upload Preset من إعدادات Cloudinary → Settings → Upload</p>
                  </div>
                )}
                {imageProvider === "supabase" && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-primary font-medium">✅ Supabase Storage مُفعّل</p>
                    <p className="text-xs text-muted-foreground mt-1">يتم رفع الصور مباشرة إلى مستودع التخزين الداخلي</p>
                  </div>
                )}
                {imageProvider === "database" && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-primary font-medium">💾 تخزين داخل قاعدة البيانات</p>
                    <p className="text-xs text-muted-foreground mt-1">يتم ضغط الصور وتخزينها كـ Base64 داخل حقول النص. مناسب للوضع المحلي (Offline) — لا حاجة لخادم تخزين خارجي.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ Tab: Appearance ═══ */}
          <TabsContent value="appearance" className="space-y-6">
            <ThemeSettingsCard savedThemeColor={themeColor} onSaveThemeColor={setThemeColor} />
          </TabsContent>

          {/* ═══ Tab: Printing ═══ */}
          <TabsContent value="printing" className="space-y-6">
            {/* Report Background */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileImage className="h-5 w-5" /> خلفية التقارير (A4)</CardTitle>
                <CardDescription>صورة الخلفية التي ستظهر في التقارير المطبوعة بحجم A4</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ImageUploader value={reportBackground} onChange={setReportBackground} folder="reports" label="صورة خلفية التقرير" />
                <p className="text-xs text-muted-foreground">يُفضل استخدام صورة بحجم A4 (2480×3508 بكسل) للحصول على أفضل جودة طباعة</p>

                {/* Interactive A4 Preview */}
                <div className="space-y-2">
                  <Label>معاينة تفاعلية A4 (اسحب العناصر لتحريكها)</Label>
                  <div className="border rounded-lg p-6 bg-muted/30">
                    <div
                      ref={previewRef}
                      className="mx-auto relative bg-white shadow-lg border select-none"
                      style={{ width: '210px', height: '297px', cursor: dragging ? 'grabbing' : 'default' }}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <div className="absolute inset-0 pointer-events-none" style={{
                        backgroundImage: `url(${reportBackground || settings?.report_background || ""})`,
                        backgroundRepeat: "no-repeat",
                        backgroundColor: "white",
                        backgroundSize: `${bgScale}% ${bgScale}%`,
                        backgroundPosition: `${bgPosX * SCALE}px ${bgPosY * SCALE}px`,
                      }} />
                      <div
                        className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 rounded-sm flex items-center justify-center transition-colors hover:bg-blue-500/20"
                        style={{ top: `${padTop}px`, right: `${padRight}px`, left: `${padLeft}px`, height: `${contentMaxH}px`, cursor: dragging === "content" ? 'grabbing' : 'grab' }}
                        onMouseDown={(e) => handleMouseDown(e, "content")}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[7px] text-blue-700 font-bold bg-white/90 px-2 py-0.5 rounded shadow-sm">منطقة المحتوى</span>
                          <span className="text-[6px] text-blue-600 bg-white/80 px-1 rounded">↕ اسحب للتحريك</span>
                        </div>
                      </div>
                      {footerEnabled && (
                        <div
                          className="absolute left-2 right-2 border-2 border-dashed border-green-500 bg-green-500/15 rounded-sm flex items-center justify-between px-2 hover:bg-green-500/25"
                          style={{ bottom: `${footerBottom}px`, height: `${footerHeight}px`, cursor: dragging === "footer" ? 'grabbing' : 'grab' }}
                          onMouseDown={(e) => handleMouseDown(e, "footer")}
                        >
                          <span className="text-[5px] text-green-800 font-medium">اسم المشروع</span>
                          <span className="text-[5px] text-green-800 font-medium">↕ اسحب</span>
                          <span className="text-[5px] text-green-800 font-medium">صفحة 1</span>
                        </div>
                      )}
                      <div className="absolute -top-5 left-0 right-0 text-center pointer-events-none">
                        <span className="text-[8px] text-muted-foreground bg-background px-1 rounded">210mm</span>
                      </div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[7px] text-orange-700 font-bold bg-orange-200 px-1.5 py-0.5 rounded shadow-sm pointer-events-none" style={{ marginTop: `${Math.min(padTop * 0.4, 20)}px` }}>
                        ↓ {padTop}mm
                      </div>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 border-2 border-dashed border-blue-500 bg-blue-500/10 rounded-sm" />
                        <span>منطقة المحتوى</span>
                      </div>
                      {footerEnabled && (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-dashed border-green-500 bg-green-500/10 rounded-sm" />
                          <span>التذييل</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Print Template Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> إعدادات قالب الطباعة</CardTitle>
                <CardDescription>تحكم بموقع الخلفية وبداية الكتابة وحدود محتوى الجداول (بالملليمتر mm)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2"><Label>إزاحة الخلفية (X mm)</Label><Input type="number" value={bgPosX} onChange={(e) => setBgPosX(Number(e.target.value))} dir="ltr" /></div>
                  <div className="space-y-2"><Label>إزاحة الخلفية (Y mm)</Label><Input type="number" value={bgPosY} onChange={(e) => setBgPosY(Number(e.target.value))} dir="ltr" /><p className="text-xs text-muted-foreground">قيم سالبة ترفع الخلفية للأعلى.</p></div>
                  <div className="space-y-2"><Label>تكبير/تصغير الخلفية (%)</Label><Input type="number" min={50} max={150} value={bgScale} onChange={(e) => setBgScale(Number(e.target.value))} dir="ltr" /></div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2"><Label>بداية الكتابة (أعلى) mm</Label><Input type="number" value={padTop} onChange={(e) => setPadTop(Number(e.target.value))} dir="ltr" /></div>
                  <div className="space-y-2"><Label>يمين mm</Label><Input type="number" value={padRight} onChange={(e) => setPadRight(Number(e.target.value))} dir="ltr" /></div>
                  <div className="space-y-2"><Label>أسفل mm</Label><Input type="number" value={padBottom} onChange={(e) => setPadBottom(Number(e.target.value))} dir="ltr" /></div>
                  <div className="space-y-2"><Label>يسار mm</Label><Input type="number" value={padLeft} onChange={(e) => setPadLeft(Number(e.target.value))} dir="ltr" /></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>أقصى ارتفاع لمحتوى الجداول (mm)</Label><Input type="number" value={contentMaxH} onChange={(e) => setContentMaxH(Number(e.target.value))} dir="ltr" /></div>
                  <div className="space-y-2"><Label>إعادة الضبط</Label>
                    <Button type="button" variant="outline" onClick={() => {
                      setBgPosX(DEFAULT_PRINT_TEMPLATE.bgPosX); setBgPosY(DEFAULT_PRINT_TEMPLATE.bgPosY); setBgScale(DEFAULT_PRINT_TEMPLATE.bgScale);
                      setPadTop(DEFAULT_PRINT_TEMPLATE.padTop); setPadRight(DEFAULT_PRINT_TEMPLATE.padRight); setPadBottom(DEFAULT_PRINT_TEMPLATE.padBottom); setPadLeft(DEFAULT_PRINT_TEMPLATE.padLeft);
                      setContentMaxH(DEFAULT_PRINT_TEMPLATE.contentMaxH); setTableHeaderColor(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
                      setTableBorderColor(DEFAULT_PRINT_TEMPLATE.tableBorderColor); setSectionTitleColor(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
                      setFooterEnabled(DEFAULT_PRINT_TEMPLATE.footerEnabled); setFooterHeight(DEFAULT_PRINT_TEMPLATE.footerHeight); setFooterBottom(DEFAULT_PRINT_TEMPLATE.footerBottom);
                    }}>إعادة الضبط للقيم الافتراضية</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Footer Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> تذييل الطباعة</CardTitle>
                <CardDescription>إعدادات التذييل الذي يظهر أسفل كل صفحة مطبوعة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={footerEnabled} onChange={(e) => setFooterEnabled(e.target.checked)} className="w-4 h-4" />
                  <span>تفعيل التذييل</span>
                </label>
                {footerEnabled && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>ارتفاع التذييل (mm)</Label><Input type="number" value={footerHeight} onChange={(e) => setFooterHeight(Number(e.target.value))} dir="ltr" /></div>
                    <div className="space-y-2"><Label>المسافة من الأسفل (mm)</Label><Input type="number" value={footerBottom} onChange={(e) => setFooterBottom(Number(e.target.value))} dir="ltr" /></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Print Design Link */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> تصميم الطباعة</CardTitle>
                <CardDescription>تخصيص ألوان الجداول والخطوط وتنسيقات الطباعة مع معاينة حية</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/print-design">
                  <Button variant="outline" className="w-full gap-2">
                    <Palette className="h-4 w-4" /> فتح صفحة تصميم الطباعة <ArrowLeft className="h-4 w-4 mr-auto" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ Tab: Contracts ═══ */}
          <TabsContent value="contracts" className="space-y-6">
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /> إعدادات طباعة العقود</CardTitle>
                <CardDescription>تحكم في تصميم وتخطيط طباعة العقود</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>موقع الشعار</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={contractLogoPosition} onChange={(e) => setContractLogoPosition(e.target.value)}>
                      <option value="right">يمين (الافتراضي)</option>
                      <option value="left">يسار</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>عنوان العقد في الطباعة</Label>
                    <Input value={contractTitleText} onChange={(e) => setContractTitleText(e.target.value)} placeholder="عـقـد مـقـاولـة" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: "لون خلفية الرأس", value: contractHeaderBg, setter: setContractHeaderBg },
                    { label: "لون نص الرأس", value: contractHeaderText, setter: setContractHeaderText },
                    { label: "اللون المميز (أكسنت)", value: contractAccent, setter: setContractAccent },
                  ].map(({ label, value, setter }) => (
                    <div key={label} className="space-y-2">
                      <Label>{label}</Label>
                      <div className="flex gap-2">
                        <Input type="color" value={value} onChange={(e) => setter(e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                        <Input value={value} onChange={(e) => setter(e.target.value)} dir="ltr" className="flex-1" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>حجم خط العنوان (pt)</Label><Input type="number" value={contractFontSizeTitle} onChange={(e) => setContractFontSizeTitle(Number(e.target.value))} min={12} max={28} dir="ltr" /></div>
                  <div className="space-y-2"><Label>حجم خط المحتوى (pt)</Label><Input type="number" value={contractFontSizeBody} onChange={(e) => setContractFontSizeBody(Number(e.target.value))} min={8} max={16} dir="ltr" /></div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>مسمى الطرف الأول</Label><Input value={contractSigLabel1} onChange={(e) => setContractSigLabel1(e.target.value)} /></div>
                  <div className="space-y-2"><Label>مسمى الطرف الثاني</Label><Input value={contractSigLabel2} onChange={(e) => setContractSigLabel2(e.target.value)} /></div>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <Label className="text-sm font-semibold">الأقسام المعروضة في الطباعة</Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { label: "معلومات المشروع والعميل", value: contractShowProjectInfo, setter: setContractShowProjectInfo },
                      { label: "وصف العقد", value: contractShowDescription, setter: setContractShowDescription },
                      { label: "جدول الكميات والأسعار", value: contractShowItemsTable, setter: setContractShowItemsTable },
                      { label: "شروط وأحكام العقد", value: contractShowClauses, setter: setContractShowClauses },
                      { label: "قسم التوقيعات", value: contractShowSignatures, setter: setContractShowSignatures },
                    ].map((item) => (
                      <label key={item.label} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={item.value} onChange={(e) => item.setter(e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Contract Background & Layout */}
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-sm font-semibold">خلفية وهوامش العقد (مستقلة عن التقارير)</Label>
                  
                  <div className="space-y-2">
                    <Label>صورة خلفية A4 للعقود</Label>
                    <ImageUploader value={contractBackground} onChange={setContractBackground} label="رفع خلفية العقد" />
                  </div>

                  {contractBackground && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">موقع X (مم)</Label><Input type="number" value={contractBgPosX} onChange={(e) => setContractBgPosX(Number(e.target.value))} dir="ltr" /></div>
                      <div className="space-y-1"><Label className="text-xs">موقع Y (مم)</Label><Input type="number" value={contractBgPosY} onChange={(e) => setContractBgPosY(Number(e.target.value))} dir="ltr" /></div>
                      <div className="space-y-1"><Label className="text-xs">حجم الخلفية %</Label><Input type="number" value={contractBgScale} onChange={(e) => setContractBgScale(Number(e.target.value))} min={50} max={200} dir="ltr" /></div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1"><Label className="text-xs">هامش أعلى (مم)</Label><Input type="number" value={contractPadTop} onChange={(e) => setContractPadTop(Number(e.target.value))} min={5} max={80} dir="ltr" /></div>
                    <div className="space-y-1"><Label className="text-xs">هامش أسفل (مم)</Label><Input type="number" value={contractPadBottom} onChange={(e) => setContractPadBottom(Number(e.target.value))} min={5} max={80} dir="ltr" /></div>
                    <div className="space-y-1"><Label className="text-xs">هامش يمين (مم)</Label><Input type="number" value={contractPadRight} onChange={(e) => setContractPadRight(Number(e.target.value))} min={5} max={40} dir="ltr" /></div>
                    <div className="space-y-1"><Label className="text-xs">هامش يسار (مم)</Label><Input type="number" value={contractPadLeft} onChange={(e) => setContractPadLeft(Number(e.target.value))} min={5} max={40} dir="ltr" /></div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={contractFooterEnabled} onChange={(e) => setContractFooterEnabled(e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">إظهار تذييل العقد</span>
                    </label>
                    {contractFooterEnabled && (
                      <>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">ارتفاع التذييل</Label>
                          <Input type="number" value={contractFooterHeight} onChange={(e) => setContractFooterHeight(Number(e.target.value))} min={5} max={30} dir="ltr" className="w-20" />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">بُعد عن الأسفل</Label>
                          <Input type="number" value={contractFooterBottom} onChange={(e) => setContractFooterBottom(Number(e.target.value))} min={3} max={30} dir="ltr" className="w-20" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Contract A4 Preview */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-3 block">معاينة صفحة العقد A4</Label>
                  <div className="mx-auto border border-border rounded shadow-md overflow-hidden" style={{ width: 220, height: 310, position: 'relative', background: 'white', direction: 'rtl' }}>
                    {contractBackground && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `url(${contractBackground})`,
                        backgroundSize: `${contractBgScale}%`,
                        backgroundPosition: `${contractBgPosX}px ${contractBgPosY}px`,
                        backgroundRepeat: 'no-repeat', opacity: 0.3, zIndex: 0
                      }} />
                    )}
                    <div style={{
                      position: 'relative', zIndex: 1,
                      paddingTop: `${contractPadTop * 0.7}px`,
                      paddingRight: `${contractPadRight * 0.7}px`,
                      paddingBottom: `${contractPadBottom * 0.7}px`,
                      paddingLeft: `${contractPadLeft * 0.7}px`,
                      height: '100%', display: 'flex', flexDirection: 'column'
                    }}>
                      {/* Mini header */}
                      <div className="rounded" style={{ background: contractHeaderBg, color: contractHeaderText, padding: '4px 6px', fontSize: 6, textAlign: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 5, opacity: 0.8 }}>اسم الشركة</div>
                        <div style={{ fontWeight: 'bold', fontSize: 7 }}>{contractTitleText}</div>
                      </div>
                      <div style={{ height: 2, background: `linear-gradient(to left, ${contractAccent}, ${contractHeaderBg}, ${contractAccent})`, marginBottom: 4, borderRadius: 1 }} />
                      {/* Content placeholder */}
                      <div style={{ flex: 1 }}>
                        <div style={{ background: '#f0f0f0', height: 12, borderRadius: 2, marginBottom: 3 }} />
                        <div style={{ background: '#f0f0f0', height: 8, borderRadius: 2, marginBottom: 3, width: '70%' }} />
                        <div style={{ background: '#f0f0f0', height: 20, borderRadius: 2, marginBottom: 3 }} />
                      </div>
                      {contractFooterEnabled && (
                        <div style={{ borderTop: '1px solid #ccc', fontSize: 5, color: '#999', display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
                          <span>اسم الشركة</span><span>عقد رقم: ...</span><span>التاريخ</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contract Header Preview */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-3 block">معاينة ترويسة العقد</Label>
                  <div className="rounded-lg overflow-hidden shadow-md" style={{ direction: "rtl" }}>
                    <div className="flex items-center justify-between p-3 gap-3" style={{ background: contractHeaderBg, color: contractHeaderText }}>
                      {contractLogoPosition === "right" ? (
                        <>
                          <div className="text-xs" style={{ minWidth: 80 }}>
                            <div>رقم العقد: <strong style={{ color: contractAccent }}>CNT-2026-001</strong></div>
                            <div>التاريخ: <strong style={{ color: contractAccent }}>2026-01-01</strong></div>
                          </div>
                          <div className="text-center flex-1">
                            <div className="text-xs opacity-80">اسم الشركة</div>
                            <div className="font-bold" style={{ fontSize: `${Math.min(contractFontSizeTitle * 0.7, 14)}px` }}>{contractTitleText}</div>
                          </div>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: contractAccent, color: contractHeaderBg }}>ش</div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: contractAccent, color: contractHeaderBg }}>ش</div>
                          <div className="text-center flex-1">
                            <div className="text-xs opacity-80">اسم الشركة</div>
                            <div className="font-bold" style={{ fontSize: `${Math.min(contractFontSizeTitle * 0.7, 14)}px` }}>{contractTitleText}</div>
                          </div>
                          <div className="text-xs" style={{ minWidth: 80, textAlign: "left" }}>
                            <div>رقم العقد: <strong style={{ color: contractAccent }}>CNT-2026-001</strong></div>
                            <div>التاريخ: <strong style={{ color: contractAccent }}>2026-01-01</strong></div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="h-1" style={{ background: `linear-gradient(to left, ${contractAccent}, ${contractHeaderBg}, ${contractAccent})` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ Tab: Financial ═══ */}
          <TabsContent value="financial" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> الفواتير والسجلات المالية</CardTitle>
                <CardDescription>وصول سريع لجميع صفحات الفواتير والسجلات المالية</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { href: "/income", icon: TrendingUp, label: "سجل الإيرادات", desc: "إضافة وتعديل وحذف الإيرادات", color: "text-green-600", badge: "إيرادات" },
                    { href: "/expenses", icon: TrendingDown, label: "سجل المصروفات", desc: "إدارة المصروفات والمشتريات", color: "text-red-600", badge: "مصروفات" },
                    { href: "/transfers", icon: ArrowLeftRight, label: "التحويلات", desc: "سلف وعهد وتحويلات مالية", color: "text-blue-600", badge: "تحويلات" },
                    { href: "/project-expenses", icon: ShoppingCart, label: "مصروفات المشاريع", desc: "جميع مشتريات المشاريع", color: "text-orange-600", badge: "مشتريات" },
                    { href: "/treasuries", icon: Wallet, label: "الخزائن", desc: "إدارة الخزائن والأرصدة", color: "text-primary", badge: "خزائن" },
                    { href: "/client-activities", icon: Receipt, label: "حركات الزبائن", desc: "دفعات وحسابات العملاء", color: "text-purple-600", badge: "عملاء" },
                  ].map((item) => (
                    <Link key={item.href} to={item.href}>
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group">
                        <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold truncate">{item.label}</p>
                            <Badge variant="secondary" className="text-[10px] shrink-0">{item.badge}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5" /> الفواتير المستحقة</CardTitle>
                <CardDescription>عرض الفواتير المستحقة الحالية والوصول المباشر لإدارتها</CardDescription>
              </CardHeader>
              <CardContent>
                <OverduePurchasesSummary />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Spacer + Floating Save */}
        <div className="h-20" />
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Button type="submit" size="lg" disabled={updateMutation.isPending} className="shadow-2xl px-8">
            {updateMutation.isPending ? (
              <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...</>
            ) : (
              <><Save className="ml-2 h-4 w-4" /> حفظ الإعدادات</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
