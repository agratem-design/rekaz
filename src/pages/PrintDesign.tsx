import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Save, 
  Loader2, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft,
  Palette,
  Layout,
  Type,
  FileText,
  Table,
  AlignVerticalJustifyStart,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tags,
  ShoppingCart,
  Wallet,
  Truck,
  Users,
  ClipboardList,
  Layers,
  FileSignature
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PRINT_LABELS, getPrintLabels, PrintLabelsConfig } from "@/lib/printLabels";

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
  print_labels?: any;
}

const DEFAULT_PRINT_TEMPLATE = {
  bgPosX: 0,
  bgPosY: 0,
  bgScale: 100,
  padTop: 55,
  padRight: 12,
  padBottom: 35,
  padLeft: 12,
  contentMaxH: 200,
  footerEnabled: true,
  footerHeight: 15,
  footerBottom: 10,
  tableHeaderColor: '#B4A078',
  tableBorderColor: '#888888',
  sectionTitleColor: '#7A5A10',
  tableRowEvenColor: '#f9f9f9',
  tableRowOddColor: '#ffffff',
  tableTextColor: '#333333',
  headerTextColor: '#ffffff',
  tableFontSize: 11,
  headerFontSize: 12,
  titleFontSize: 14,
  borderWidth: 1,
  borderRadius: 0,
  cellPadding: 6,
} as const;

const PRINT_THEMES = [
  {
    name: "كلاسيكي ذهبي",
    headerColor: "#8B6914",
    headerTextColor: "#ffffff",
    borderColor: "#A08050",
    sectionTitleColor: "#6B5210",
    rowEvenColor: "#f9f9f9",
    rowOddColor: "#ffffff",
    textColor: "#333333",
  },
  {
    name: "أزرق مهني",
    headerColor: "#1e40af",
    headerTextColor: "#ffffff",
    borderColor: "#3b82f6",
    sectionTitleColor: "#1e3a5f",
    rowEvenColor: "#eff6ff",
    rowOddColor: "#ffffff",
    textColor: "#1e293b",
  },
  {
    name: "أخضر طبيعي",
    headerColor: "#166534",
    headerTextColor: "#ffffff",
    borderColor: "#22c55e",
    sectionTitleColor: "#14532d",
    rowEvenColor: "#f0fdf4",
    rowOddColor: "#ffffff",
    textColor: "#1a2e1a",
  },
  {
    name: "داكن أنيق",
    headerColor: "#1f2937",
    headerTextColor: "#f9fafb",
    borderColor: "#4b5563",
    sectionTitleColor: "#111827",
    rowEvenColor: "#f3f4f6",
    rowOddColor: "#ffffff",
    textColor: "#111827",
  },
  {
    name: "أحمر رسمي",
    headerColor: "#991b1b",
    headerTextColor: "#ffffff",
    borderColor: "#dc2626",
    sectionTitleColor: "#7f1d1d",
    rowEvenColor: "#fef2f2",
    rowOddColor: "#ffffff",
    textColor: "#1c1917",
  },
  {
    name: "بنفسجي عصري",
    headerColor: "#6d28d9",
    headerTextColor: "#ffffff",
    borderColor: "#8b5cf6",
    sectionTitleColor: "#4c1d95",
    rowEvenColor: "#f5f3ff",
    rowOddColor: "#ffffff",
    textColor: "#1e1b4b",
  },
  {
    name: "رمادي محايد",
    headerColor: "#475569",
    headerTextColor: "#ffffff",
    borderColor: "#94a3b8",
    sectionTitleColor: "#334155",
    rowEvenColor: "#f8fafc",
    rowOddColor: "#ffffff",
    textColor: "#334155",
  },
  {
    name: "برتقالي دافئ",
    headerColor: "#c2410c",
    headerTextColor: "#ffffff",
    borderColor: "#ea580c",
    sectionTitleColor: "#9a3412",
    rowEvenColor: "#fff7ed",
    rowOddColor: "#ffffff",
    textColor: "#292524",
  },
];

const PrintDesign = () => {
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);

  // Background controls
  const [bgPosX, setBgPosX] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosX);
  const [bgPosY, setBgPosY] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosY);
  const [bgScale, setBgScale] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgScale);
  
  // Padding controls
  const [padTop, setPadTop] = useState<number>(DEFAULT_PRINT_TEMPLATE.padTop);
  const [padRight, setPadRight] = useState<number>(DEFAULT_PRINT_TEMPLATE.padRight);
  const [padBottom, setPadBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.padBottom);
  const [padLeft, setPadLeft] = useState<number>(DEFAULT_PRINT_TEMPLATE.padLeft);
  const [contentMaxH, setContentMaxH] = useState<number>(DEFAULT_PRINT_TEMPLATE.contentMaxH);

  // Footer controls
  const [footerEnabled, setFooterEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.footerEnabled);
  const [footerHeight, setFooterHeight] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerHeight);
  const [footerBottom, setFooterBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerBottom);

  // Table color controls
  const [tableHeaderColor, setTableHeaderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
  const [tableBorderColor, setTableBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableBorderColor);
  const [sectionTitleColor, setSectionTitleColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
  
  // Extended table controls (local only for now - for preview)
  const [tableRowEvenColor, setTableRowEvenColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
  const [tableRowOddColor, setTableRowOddColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
  const [tableTextColor, setTableTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableTextColor);
  const [headerTextColor, setHeaderTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.headerTextColor);
  const [tableFontSize, setTableFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.tableFontSize);
  const [headerFontSize, setHeaderFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.headerFontSize);
  const [titleFontSize, setTitleFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.titleFontSize);
  const [borderWidth, setBorderWidth] = useState<number>(DEFAULT_PRINT_TEMPLATE.borderWidth);
  const [borderRadius, setBorderRadius] = useState<number>(DEFAULT_PRINT_TEMPLATE.borderRadius);
  const [cellPadding, setCellPadding] = useState<number>(DEFAULT_PRINT_TEMPLATE.cellPadding);

  // Print labels state
  const [printLabels, setPrintLabels] = useState<PrintLabelsConfig>(JSON.parse(JSON.stringify(DEFAULT_PRINT_LABELS)));
  const [activeElementTab, setActiveElementTab] = useState<string>("purchases");

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error) throw error;
      return data as CompanySettings & {
        print_table_row_even_color?: string;
        print_table_row_odd_color?: string;
        print_table_text_color?: string;
        print_header_text_color?: string;
        print_table_font_size?: number;
        print_header_font_size?: number;
        print_title_font_size?: number;
        print_border_width?: number;
        print_border_radius?: number;
        print_cell_padding?: number;
      };
    },
  });

  // Set initial values when data loads
  useEffect(() => {
    if (settings) {
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
      
      // Extended settings
      setTableRowEvenColor(settings.print_table_row_even_color ?? DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
      setTableRowOddColor(settings.print_table_row_odd_color ?? DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
      setTableTextColor(settings.print_table_text_color ?? DEFAULT_PRINT_TEMPLATE.tableTextColor);
      setHeaderTextColor(settings.print_header_text_color ?? DEFAULT_PRINT_TEMPLATE.headerTextColor);
      setTableFontSize(Number(settings.print_table_font_size ?? DEFAULT_PRINT_TEMPLATE.tableFontSize));
      setHeaderFontSize(Number(settings.print_header_font_size ?? DEFAULT_PRINT_TEMPLATE.headerFontSize));
      setTitleFontSize(Number(settings.print_title_font_size ?? DEFAULT_PRINT_TEMPLATE.titleFontSize));
      setBorderWidth(Number(settings.print_border_width ?? DEFAULT_PRINT_TEMPLATE.borderWidth));
      setBorderRadius(Number(settings.print_border_radius ?? DEFAULT_PRINT_TEMPLATE.borderRadius));
      setCellPadding(Number(settings.print_cell_padding ?? DEFAULT_PRINT_TEMPLATE.cellPadding));
      
      // Print labels
      setPrintLabels(getPrintLabels(settings.print_labels));
    }
  }, [settings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("No settings found");
      
      const { error } = await supabase
        .from("company_settings")
        .update({
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
          // Extended settings
          print_table_row_even_color: tableRowEvenColor,
          print_table_row_odd_color: tableRowOddColor,
          print_table_text_color: tableTextColor,
          print_header_text_color: headerTextColor,
          print_table_font_size: tableFontSize,
          print_header_font_size: headerFontSize,
          print_title_font_size: titleFontSize,
          print_border_width: borderWidth,
          print_border_radius: borderRadius,
          print_cell_padding: cellPadding,
          print_labels: printLabels as any,
        } as any)
        .eq("id", settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("تم حفظ إعدادات التصميم بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
      console.error(error);
    },
  });

  const handleReset = () => {
    setBgPosX(DEFAULT_PRINT_TEMPLATE.bgPosX);
    setBgPosY(DEFAULT_PRINT_TEMPLATE.bgPosY);
    setBgScale(DEFAULT_PRINT_TEMPLATE.bgScale);
    setPadTop(DEFAULT_PRINT_TEMPLATE.padTop);
    setPadRight(DEFAULT_PRINT_TEMPLATE.padRight);
    setPadBottom(DEFAULT_PRINT_TEMPLATE.padBottom);
    setPadLeft(DEFAULT_PRINT_TEMPLATE.padLeft);
    setContentMaxH(DEFAULT_PRINT_TEMPLATE.contentMaxH);
    setTableHeaderColor(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
    setTableBorderColor(DEFAULT_PRINT_TEMPLATE.tableBorderColor);
    setSectionTitleColor(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
    setTableRowEvenColor(DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
    setTableRowOddColor(DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
    setTableTextColor(DEFAULT_PRINT_TEMPLATE.tableTextColor);
    setHeaderTextColor(DEFAULT_PRINT_TEMPLATE.headerTextColor);
    setTableFontSize(DEFAULT_PRINT_TEMPLATE.tableFontSize);
    setHeaderFontSize(DEFAULT_PRINT_TEMPLATE.headerFontSize);
    setTitleFontSize(DEFAULT_PRINT_TEMPLATE.titleFontSize);
    setBorderWidth(DEFAULT_PRINT_TEMPLATE.borderWidth);
    setBorderRadius(DEFAULT_PRINT_TEMPLATE.borderRadius);
    setCellPadding(DEFAULT_PRINT_TEMPLATE.cellPadding);
    setFooterEnabled(DEFAULT_PRINT_TEMPLATE.footerEnabled);
    setFooterHeight(DEFAULT_PRINT_TEMPLATE.footerHeight);
    setFooterBottom(DEFAULT_PRINT_TEMPLATE.footerBottom);
    setPrintLabels(JSON.parse(JSON.stringify(DEFAULT_PRINT_LABELS)));
    toast.info("تم إعادة الضبط للقيم الافتراضية");
  };

  // Helper to update a label field
  const updateLabel = <K extends keyof PrintLabelsConfig>(
    section: K,
    field: string,
    value: any
  ) => {
    setPrintLabels(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  // Label input component
  const LabelInput = ({ label, value, onChange }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
        dir="rtl"
      />
    </div>
  );

  // Color input component
  const ColorInput = ({ label, value, onChange, description }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void;
    description?: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2 items-center">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-9 p-1 cursor-pointer border-2"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-sm"
          dir="ltr"
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );

  // Slider input component
  const SliderInput = ({ label, value, onChange, min, max, step = 1, unit = "" }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
  }) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sample data for preview
  const sampleTableData = [
    { name: "أعمال البلاط", quantity: "150", unit: "م²", price: "45.00", total: "6,750.00" },
    { name: "أعمال الدهان", quantity: "200", unit: "م²", price: "25.00", total: "5,000.00" },
    { name: "تمديدات كهربائية", quantity: "80", unit: "م.ط", price: "35.00", total: "2,800.00" },
  ];

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Controls Sidebar */}
      <div 
        className={cn(
          "transition-all duration-300 flex flex-col bg-card rounded-lg border overflow-hidden",
          sidebarCollapsed ? "w-12" : "w-[380px]"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b flex items-center justify-between bg-muted/30">
          {!sidebarCollapsed && (
            <h2 className="font-bold text-lg">إعدادات التصميم</h2>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="shrink-0"
          >
            {sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Content */}
        {!sidebarCollapsed && (
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Tabs defaultValue="colors" className="w-full">
                <TabsList className="w-full grid grid-cols-5 mb-4">
                  <TabsTrigger value="colors" className="text-xs px-1" title="الألوان">
                    <Palette className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs px-1" title="الجدول">
                    <Table className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs px-1" title="التخطيط">
                    <Layout className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="footer" className="text-xs px-1" title="التذييل">
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="elements" className="text-xs px-1" title="عناصر الطباعة">
                    <Tags className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                {/* Colors Tab */}
                <TabsContent value="colors" className="space-y-6 mt-0">
                  {/* Preset Themes */}
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        تيمات جاهزة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {PRINT_THEMES.map((theme) => (
                          <button
                            key={theme.name}
                            onClick={() => {
                              setTableHeaderColor(theme.headerColor);
                              setHeaderTextColor(theme.headerTextColor);
                              setTableBorderColor(theme.borderColor);
                              setSectionTitleColor(theme.sectionTitleColor);
                              setTableRowEvenColor(theme.rowEvenColor);
                              setTableRowOddColor(theme.rowOddColor);
                              setTableTextColor(theme.textColor);
                              toast.success(`تم تطبيق تيمة "${theme.name}"`);
                            }}
                            className="flex items-center gap-2 p-2 rounded-lg border hover:border-primary/50 transition-all text-right text-xs"
                          >
                            <div className="flex gap-0.5 shrink-0">
                              <div className="w-3 h-3 rounded-sm" style={{ background: theme.headerColor }} />
                              <div className="w-3 h-3 rounded-sm" style={{ background: theme.borderColor }} />
                              <div className="w-3 h-3 rounded-sm" style={{ background: theme.sectionTitleColor }} />
                            </div>
                            <span className="truncate">{theme.name}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        ألوان الجدول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ColorInput 
                        label="لون رأس الجدول" 
                        value={tableHeaderColor} 
                        onChange={setTableHeaderColor}
                      />
                      <ColorInput 
                        label="لون نص الرأس" 
                        value={headerTextColor} 
                        onChange={setHeaderTextColor}
                      />
                      <ColorInput 
                        label="لون الحدود" 
                        value={tableBorderColor} 
                        onChange={setTableBorderColor}
                      />
                      <ColorInput 
                        label="لون الصفوف الزوجية" 
                        value={tableRowEvenColor} 
                        onChange={setTableRowEvenColor}
                      />
                      <ColorInput 
                        label="لون الصفوف الفردية" 
                        value={tableRowOddColor} 
                        onChange={setTableRowOddColor}
                      />
                      <ColorInput 
                        label="لون النص" 
                        value={tableTextColor} 
                        onChange={setTableTextColor}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        ألوان العناوين
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ColorInput 
                        label="لون عناوين الأقسام" 
                        value={sectionTitleColor} 
                        onChange={setSectionTitleColor}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Table Tab */}
                <TabsContent value="table" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        أحجام الخطوط
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput 
                        label="حجم خط العنوان" 
                        value={titleFontSize} 
                        onChange={setTitleFontSize}
                        min={10}
                        max={20}
                        unit="px"
                      />
                      <SliderInput 
                        label="حجم خط الرأس" 
                        value={headerFontSize} 
                        onChange={setHeaderFontSize}
                        min={8}
                        max={16}
                        unit="px"
                      />
                      <SliderInput 
                        label="حجم خط الجدول" 
                        value={tableFontSize} 
                        onChange={setTableFontSize}
                        min={8}
                        max={14}
                        unit="px"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Square className="h-4 w-4" />
                        شكل الجدول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput 
                        label="سمك الحدود" 
                        value={borderWidth} 
                        onChange={setBorderWidth}
                        min={0}
                        max={3}
                        unit="px"
                      />
                      <SliderInput 
                        label="استدارة الزوايا" 
                        value={borderRadius} 
                        onChange={setBorderRadius}
                        min={0}
                        max={10}
                        unit="px"
                      />
                      <SliderInput 
                        label="المسافة الداخلية للخلايا" 
                        value={cellPadding} 
                        onChange={setCellPadding}
                        min={2}
                        max={12}
                        unit="px"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Layout Tab */}
                <TabsContent value="layout" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        الخلفية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput 
                        label="إزاحة X" 
                        value={bgPosX} 
                        onChange={setBgPosX}
                        min={-50}
                        max={50}
                        unit="mm"
                      />
                      <SliderInput 
                        label="إزاحة Y" 
                        value={bgPosY} 
                        onChange={setBgPosY}
                        min={-50}
                        max={50}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الحجم" 
                        value={bgScale} 
                        onChange={setBgScale}
                        min={50}
                        max={150}
                        unit="%"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layout className="h-4 w-4" />
                        الهوامش
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        💡 الهوامش تُطبق على كل صفحة تلقائياً. عند امتلاء الصفحة ينتقل المحتوى للصفحة التالية مع الحفاظ على نفس الهوامش والتصميم.
                      </p>
                      <SliderInput 
                        label="الهامش العلوي" 
                        value={padTop} 
                        onChange={setPadTop}
                        min={10}
                        max={100}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الهامش الأيمن" 
                        value={padRight} 
                        onChange={setPadRight}
                        min={5}
                        max={40}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الهامش الأيسر" 
                        value={padLeft} 
                        onChange={setPadLeft}
                        min={5}
                        max={40}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الهامش السفلي" 
                        value={padBottom} 
                        onChange={setPadBottom}
                        min={10}
                        max={60}
                        unit="mm"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Footer Tab */}
                <TabsContent value="footer" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                        إعدادات التذييل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>تفعيل التذييل</Label>
                        <Switch
                          checked={footerEnabled}
                          onCheckedChange={setFooterEnabled}
                        />
                      </div>
                      
                      {footerEnabled && (
                        <>
                          <SliderInput 
                            label="ارتفاع التذييل" 
                            value={footerHeight} 
                            onChange={setFooterHeight}
                            min={5}
                            max={30}
                            unit="mm"
                          />
                          <SliderInput 
                            label="المسافة من الأسفل" 
                            value={footerBottom} 
                            onChange={setFooterBottom}
                            min={5}
                            max={40}
                            unit="mm"
                          />
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Print Elements Tab */}
                <TabsContent value="elements" className="space-y-4 mt-0">
                  <Tabs value={activeElementTab} onValueChange={setActiveElementTab} className="w-full">
                    <TabsList className="w-full grid grid-cols-4 mb-3 h-auto">
                      <TabsTrigger value="purchases" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <ShoppingCart className="h-3 w-3" />
                        مشتريات
                      </TabsTrigger>
                      <TabsTrigger value="expenses" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Wallet className="h-3 w-3" />
                        مصروفات
                      </TabsTrigger>
                      <TabsTrigger value="equipment_rentals" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Truck className="h-3 w-3" />
                        إيجارات
                      </TabsTrigger>
                      <TabsTrigger value="technician_dues" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Users className="h-3 w-3" />
                        فنيين
                      </TabsTrigger>
                    </TabsList>
                    <TabsList className="w-full grid grid-cols-3 mb-3 h-auto">
                      <TabsTrigger value="project_report" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <ClipboardList className="h-3 w-3" />
                        تقارير
                      </TabsTrigger>
                      <TabsTrigger value="phase_report" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Layers className="h-3 w-3" />
                        مراحل
                      </TabsTrigger>
                      <TabsTrigger value="contracts" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <FileSignature className="h-3 w-3" />
                        عقود
                      </TabsTrigger>
                    </TabsList>

                    {/* Purchases Labels */}
                    <TabsContent value="purchases" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات فواتير المشتريات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان الفاتورة" value={printLabels.purchases.title} onChange={v => updateLabel("purchases", "title", v)} />
                          <LabelInput label="قسم البيانات" value={printLabels.purchases.info_section} onChange={v => updateLabel("purchases", "info_section", v)} />
                          <LabelInput label="قسم البنود" value={printLabels.purchases.items_section} onChange={v => updateLabel("purchases", "items_section", v)} />
                          <LabelInput label="قسم الملاحظات" value={printLabels.purchases.notes_section} onChange={v => updateLabel("purchases", "notes_section", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="رقم الفاتورة" value={printLabels.purchases.label_invoice_number} onChange={v => updateLabel("purchases", "label_invoice_number", v)} />
                              <LabelInput label="التاريخ" value={printLabels.purchases.label_date} onChange={v => updateLabel("purchases", "label_date", v)} />
                              <LabelInput label="المورد" value={printLabels.purchases.label_supplier} onChange={v => updateLabel("purchases", "label_supplier", v)} />
                              <LabelInput label="المشروع" value={printLabels.purchases.label_project} onChange={v => updateLabel("purchases", "label_project", v)} />
                              <LabelInput label="العميل" value={printLabels.purchases.label_client} onChange={v => updateLabel("purchases", "label_client", v)} />
                              <LabelInput label="حالة السداد" value={printLabels.purchases.label_status} onChange={v => updateLabel("purchases", "label_status", v)} />
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-3 gap-2">
                              <LabelInput label="الرقم" value={printLabels.purchases.col_number} onChange={v => updateLabel("purchases", "col_number", v)} />
                              <LabelInput label="البند" value={printLabels.purchases.col_item} onChange={v => updateLabel("purchases", "col_item", v)} />
                              <LabelInput label="الوحدة" value={printLabels.purchases.col_unit} onChange={v => updateLabel("purchases", "col_unit", v)} />
                              <LabelInput label="الكمية" value={printLabels.purchases.col_quantity} onChange={v => updateLabel("purchases", "col_quantity", v)} />
                              <LabelInput label="السعر" value={printLabels.purchases.col_price} onChange={v => updateLabel("purchases", "col_price", v)} />
                              <LabelInput label="الإجمالي" value={printLabels.purchases.col_total} onChange={v => updateLabel("purchases", "col_total", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.purchases.total_label} onChange={v => updateLabel("purchases", "total_label", v)} />
                          <div className="flex items-center justify-between pt-2">
                            <Label className="text-xs">إظهار الملاحظات</Label>
                            <Switch checked={printLabels.purchases.show_notes} onCheckedChange={v => updateLabel("purchases", "show_notes", v)} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Expenses Labels */}
                    <TabsContent value="expenses" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات تقرير المصروفات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="العنوان" value={printLabels.expenses.title} onChange={v => updateLabel("expenses", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-3 gap-2">
                              <LabelInput label="الرقم" value={printLabels.expenses.col_number} onChange={v => updateLabel("expenses", "col_number", v)} />
                              <LabelInput label="الوصف" value={printLabels.expenses.col_description} onChange={v => updateLabel("expenses", "col_description", v)} />
                              <LabelInput label="النوع" value={printLabels.expenses.col_type} onChange={v => updateLabel("expenses", "col_type", v)} />
                              <LabelInput label="التاريخ" value={printLabels.expenses.col_date} onChange={v => updateLabel("expenses", "col_date", v)} />
                              <LabelInput label="طريقة الدفع" value={printLabels.expenses.col_payment_method} onChange={v => updateLabel("expenses", "col_payment_method", v)} />
                              <LabelInput label="المبلغ" value={printLabels.expenses.col_amount} onChange={v => updateLabel("expenses", "col_amount", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.expenses.total_label} onChange={v => updateLabel("expenses", "total_label", v)} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Equipment Rentals Labels */}
                    <TabsContent value="equipment_rentals" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات إيجارات المعدات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="العنوان" value={printLabels.equipment_rentals.title} onChange={v => updateLabel("equipment_rentals", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="الرقم" value={printLabels.equipment_rentals.col_number} onChange={v => updateLabel("equipment_rentals", "col_number", v)} />
                              <LabelInput label="المعدة" value={printLabels.equipment_rentals.col_equipment} onChange={v => updateLabel("equipment_rentals", "col_equipment", v)} />
                              <LabelInput label="تاريخ البداية" value={printLabels.equipment_rentals.col_start_date} onChange={v => updateLabel("equipment_rentals", "col_start_date", v)} />
                              <LabelInput label="تاريخ النهاية" value={printLabels.equipment_rentals.col_end_date} onChange={v => updateLabel("equipment_rentals", "col_end_date", v)} />
                              <LabelInput label="عدد الأيام" value={printLabels.equipment_rentals.col_days} onChange={v => updateLabel("equipment_rentals", "col_days", v)} />
                              <LabelInput label="السعر اليومي" value={printLabels.equipment_rentals.col_daily_rate} onChange={v => updateLabel("equipment_rentals", "col_daily_rate", v)} />
                              <LabelInput label="الإجمالي" value={printLabels.equipment_rentals.col_total} onChange={v => updateLabel("equipment_rentals", "col_total", v)} />
                              <LabelInput label="الحالة" value={printLabels.equipment_rentals.col_status} onChange={v => updateLabel("equipment_rentals", "col_status", v)} />
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الإجماليات</p>
                            <LabelInput label="إجمالي الإيجار" value={printLabels.equipment_rentals.rental_total_label} onChange={v => updateLabel("equipment_rentals", "rental_total_label", v)} />
                            <LabelInput label="إجمالي الأضرار" value={printLabels.equipment_rentals.damage_total_label} onChange={v => updateLabel("equipment_rentals", "damage_total_label", v)} />
                            <LabelInput label="الإجمالي الكلي" value={printLabels.equipment_rentals.grand_total_label} onChange={v => updateLabel("equipment_rentals", "grand_total_label", v)} />
                            <LabelInput label="المبلغ المستحق" value={printLabels.equipment_rentals.total_due_label} onChange={v => updateLabel("equipment_rentals", "total_due_label", v)} />
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <Label className="text-xs">إظهار قسم الأضرار</Label>
                            <Switch checked={printLabels.equipment_rentals.show_damage_section} onCheckedChange={v => updateLabel("equipment_rentals", "show_damage_section", v)} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Technician Dues Labels */}
                    <TabsContent value="technician_dues" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات مستحقات الفنيين</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="العنوان" value={printLabels.technician_dues.title} onChange={v => updateLabel("technician_dues", "title", v)} />
                          <LabelInput label="قسم السجلات" value={printLabels.technician_dues.records_section} onChange={v => updateLabel("technician_dues", "records_section", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="التاريخ" value={printLabels.technician_dues.col_date} onChange={v => updateLabel("technician_dues", "col_date", v)} />
                              <LabelInput label="الفني" value={printLabels.technician_dues.col_technician} onChange={v => updateLabel("technician_dues", "col_technician", v)} />
                              <LabelInput label="المنجز" value={printLabels.technician_dues.col_completed} onChange={v => updateLabel("technician_dues", "col_completed", v)} />
                              <LabelInput label="النسبة" value={printLabels.technician_dues.col_percent} onChange={v => updateLabel("technician_dues", "col_percent", v)} />
                              <LabelInput label="المستحقات" value={printLabels.technician_dues.col_dues} onChange={v => updateLabel("technician_dues", "col_dues", v)} />
                              <LabelInput label="ملاحظات" value={printLabels.technician_dues.col_notes} onChange={v => updateLabel("technician_dues", "col_notes", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.technician_dues.total_label} onChange={v => updateLabel("technician_dues", "total_label", v)} />
                          <div className="flex items-center justify-between pt-2">
                            <Label className="text-xs">إظهار سجل الإنجازات</Label>
                            <Switch checked={printLabels.technician_dues.show_records} onCheckedChange={v => updateLabel("technician_dues", "show_records", v)} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Project Report Labels */}
                    <TabsContent value="project_report" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات تقارير المشاريع</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان التقرير" value={printLabels.project_report.title} onChange={v => updateLabel("project_report", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">عناوين الأقسام</p>
                            <LabelInput label="معلومات المشروع" value={printLabels.project_report.project_info} onChange={v => updateLabel("project_report", "project_info", v)} />
                            <LabelInput label="البنود" value={printLabels.project_report.items_section} onChange={v => updateLabel("project_report", "items_section", v)} />
                            <LabelInput label="المشتريات" value={printLabels.project_report.purchases_section} onChange={v => updateLabel("project_report", "purchases_section", v)} />
                            <LabelInput label="المصروفات" value={printLabels.project_report.expenses_section} onChange={v => updateLabel("project_report", "expenses_section", v)} />
                            <LabelInput label="الدفعات" value={printLabels.project_report.payments_section} onChange={v => updateLabel("project_report", "payments_section", v)} />
                            <LabelInput label="الملخص المالي" value={printLabels.project_report.financial_summary} onChange={v => updateLabel("project_report", "financial_summary", v)} />
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="اسم المشروع" value={printLabels.project_report.label_project_name} onChange={v => updateLabel("project_report", "label_project_name", v)} />
                              <LabelInput label="العميل" value={printLabels.project_report.label_client} onChange={v => updateLabel("project_report", "label_client", v)} />
                              <LabelInput label="الموقع" value={printLabels.project_report.label_location} onChange={v => updateLabel("project_report", "label_location", v)} />
                              <LabelInput label="تاريخ البدء" value={printLabels.project_report.label_start_date} onChange={v => updateLabel("project_report", "label_start_date", v)} />
                              <LabelInput label="تاريخ الانتهاء" value={printLabels.project_report.label_end_date} onChange={v => updateLabel("project_report", "label_end_date", v)} />
                              <LabelInput label="الميزانية" value={printLabels.project_report.label_budget} onChange={v => updateLabel("project_report", "label_budget", v)} />
                              <LabelInput label="الحالة" value={printLabels.project_report.label_status} onChange={v => updateLabel("project_report", "label_status", v)} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Phase Report Labels */}
                    <TabsContent value="phase_report" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات تقارير المراحل</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان التقرير" value={printLabels.phase_report.title} onChange={v => updateLabel("phase_report", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">عناوين الأقسام</p>
                            <LabelInput label="معلومات المرحلة" value={printLabels.phase_report.phase_info} onChange={v => updateLabel("phase_report", "phase_info", v)} />
                            <LabelInput label="البنود" value={printLabels.phase_report.items_section} onChange={v => updateLabel("phase_report", "items_section", v)} />
                            <LabelInput label="المشتريات" value={printLabels.phase_report.purchases_section} onChange={v => updateLabel("phase_report", "purchases_section", v)} />
                            <LabelInput label="المصروفات" value={printLabels.phase_report.expenses_section} onChange={v => updateLabel("phase_report", "expenses_section", v)} />
                            <LabelInput label="الإيجارات" value={printLabels.phase_report.rentals_section} onChange={v => updateLabel("phase_report", "rentals_section", v)} />
                            <LabelInput label="الملخص المالي" value={printLabels.phase_report.financial_summary} onChange={v => updateLabel("phase_report", "financial_summary", v)} />
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="اسم المرحلة" value={printLabels.phase_report.label_phase_name} onChange={v => updateLabel("phase_report", "label_phase_name", v)} />
                              <LabelInput label="الرقم المرجعي" value={printLabels.phase_report.label_reference} onChange={v => updateLabel("phase_report", "label_reference", v)} />
                              <LabelInput label="تاريخ البدء" value={printLabels.phase_report.label_start_date} onChange={v => updateLabel("phase_report", "label_start_date", v)} />
                              <LabelInput label="تاريخ الانتهاء" value={printLabels.phase_report.label_end_date} onChange={v => updateLabel("phase_report", "label_end_date", v)} />
                              <LabelInput label="الحالة" value={printLabels.phase_report.label_status} onChange={v => updateLabel("phase_report", "label_status", v)} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Contracts Labels */}
                    <TabsContent value="contracts" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات العقود</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان العقد" value={printLabels.contracts.title} onChange={v => updateLabel("contracts", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">عناوين الأقسام</p>
                            <LabelInput label="معلومات العقد" value={printLabels.contracts.info_section} onChange={v => updateLabel("contracts", "info_section", v)} />
                            <LabelInput label="جدول الكميات" value={printLabels.contracts.items_section} onChange={v => updateLabel("contracts", "items_section", v)} />
                            <LabelInput label="الشروط والأحكام" value={printLabels.contracts.clauses_section} onChange={v => updateLabel("contracts", "clauses_section", v)} />
                            <LabelInput label="التوقيعات" value={printLabels.contracts.signatures_section} onChange={v => updateLabel("contracts", "signatures_section", v)} />
                            <LabelInput label="وصف العقد" value={printLabels.contracts.description_section} onChange={v => updateLabel("contracts", "description_section", v)} />
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="رقم العقد" value={printLabels.contracts.label_contract_number} onChange={v => updateLabel("contracts", "label_contract_number", v)} />
                              <LabelInput label="التاريخ" value={printLabels.contracts.label_date} onChange={v => updateLabel("contracts", "label_date", v)} />
                              <LabelInput label="العميل" value={printLabels.contracts.label_client} onChange={v => updateLabel("contracts", "label_client", v)} />
                              <LabelInput label="المشروع" value={printLabels.contracts.label_project} onChange={v => updateLabel("contracts", "label_project", v)} />
                              <LabelInput label="تاريخ الانتهاء" value={printLabels.contracts.label_end_date} onChange={v => updateLabel("contracts", "label_end_date", v)} />
                              <LabelInput label="قيمة العقد" value={printLabels.contracts.label_amount} onChange={v => updateLabel("contracts", "label_amount", v)} />
                              <LabelInput label="شروط الدفع" value={printLabels.contracts.label_payment_terms} onChange={v => updateLabel("contracts", "label_payment_terms", v)} />
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-3 gap-2">
                              <LabelInput label="م" value={printLabels.contracts.col_number} onChange={v => updateLabel("contracts", "col_number", v)} />
                              <LabelInput label="البند" value={printLabels.contracts.col_item} onChange={v => updateLabel("contracts", "col_item", v)} />
                              <LabelInput label="الكمية" value={printLabels.contracts.col_quantity} onChange={v => updateLabel("contracts", "col_quantity", v)} />
                              <LabelInput label="سعر الوحدة" value={printLabels.contracts.col_unit_price} onChange={v => updateLabel("contracts", "col_unit_price", v)} />
                              <LabelInput label="الإجمالي" value={printLabels.contracts.col_total} onChange={v => updateLabel("contracts", "col_total", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.contracts.total_label} onChange={v => updateLabel("contracts", "total_label", v)} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}

        {/* Sidebar Footer - Actions */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t bg-muted/30 space-y-2">
            <Button 
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="w-full"
            >
              <RotateCcw className="ml-2 h-4 w-4" />
              إعادة الضبط
            </Button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-muted/30 rounded-lg border p-6 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <div></div>
          <div className="text-center">
            <h3 className="text-lg font-bold">معاينة حية للطباعة</h3>
            <p className="text-sm text-muted-foreground">التغييرات تظهر مباشرة</p>
          </div>
          <div className="flex items-center gap-2 bg-card rounded-lg border p-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.1))}
              disabled={previewScale <= 0.3}
              title="تصغير"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono w-14 text-center">{Math.round(previewScale * 100)}%</span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setPreviewScale(Math.min(1, previewScale + 0.1))}
              disabled={previewScale >= 1}
              title="تكبير"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setPreviewScale(1)}
              title="الحجم الكامل"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* A4 Preview */}
        <div className="flex justify-center">
          <div 
            className="relative bg-white shadow-2xl mx-auto transition-transform duration-200" 
            style={{ 
              width: '210mm', 
              minHeight: '297mm',
              maxWidth: '100%',
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Background Layer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: settings?.report_background ? `url(${settings.report_background})` : 'none',
                backgroundRepeat: "no-repeat",
                backgroundColor: "white",
                backgroundSize: `${bgScale}%`,
                backgroundPosition: `${bgPosX}mm ${bgPosY}mm`,
              }}
            />

            {/* مؤشرات الهوامش - خطوط متقطعة تظهر حدود منطقة المحتوى */}
            <div
              style={{
                position: 'absolute',
                top: `${padTop}mm`,
                right: `${padRight}mm`,
                bottom: `${padBottom}mm`,
                left: `${padLeft}mm`,
                border: '1px dashed rgba(99, 102, 241, 0.3)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            />

            {/* Content Area - بدون max-height لأن المحتوى ينتقل لصفحة جديدة */}
            <div
              style={{
                position: 'absolute',
                top: `${padTop}mm`,
                right: `${padRight}mm`,
                left: `${padLeft}mm`,
                bottom: `${padBottom}mm`,
                overflow: 'hidden',
                direction: 'rtl',
              }}
            >
              {/* Section Title */}
              <div 
                style={{ 
                  color: sectionTitleColor,
                  fontSize: `${titleFontSize}px`,
                  fontWeight: 'bold',
                  borderBottom: `2px solid ${sectionTitleColor}`,
                  paddingBottom: '8px',
                  marginBottom: '16px',
                }}
              >
                بنود المشروع
              </div>

              {/* Sample Table */}
              <table 
                style={{ 
                  width: '100%', 
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  border: `${borderWidth}px solid ${tableBorderColor}`,
                  borderRadius: `${borderRadius}px`,
                  overflow: 'hidden',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: tableHeaderColor }}>
                    {['البند', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map((header, i) => (
                      <th 
                        key={i}
                        style={{ 
                          padding: `${cellPadding}px`,
                          color: headerTextColor,
                          fontSize: `${headerFontSize}px`,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleTableData.map((row, idx) => (
                    <tr 
                      key={idx}
                      style={{ 
                        backgroundColor: idx % 2 === 0 ? tableRowEvenColor : tableRowOddColor,
                      }}
                    >
                      <td style={{ 
                        padding: `${cellPadding}px`, 
                        color: tableTextColor,
                        fontSize: `${tableFontSize}px`,
                        textAlign: 'right',
                        borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                      }}>
                        {row.name}
                      </td>
                      <td style={{ 
                        padding: `${cellPadding}px`, 
                        color: tableTextColor,
                        fontSize: `${tableFontSize}px`,
                        textAlign: 'center',
                        borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                      }}>
                        {row.quantity}
                      </td>
                      <td style={{ 
                        padding: `${cellPadding}px`, 
                        color: tableTextColor,
                        fontSize: `${tableFontSize}px`,
                        textAlign: 'center',
                        borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                      }}>
                        {row.unit}
                      </td>
                      <td style={{ 
                        padding: `${cellPadding}px`, 
                        color: tableTextColor,
                        fontSize: `${tableFontSize}px`,
                        textAlign: 'center',
                        borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                      }}>
                        {row.price}
                      </td>
                      <td style={{ 
                        padding: `${cellPadding}px`, 
                        color: tableTextColor,
                        fontSize: `${tableFontSize}px`,
                        textAlign: 'center',
                        fontWeight: 'bold',
                        borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                      }}>
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: tableHeaderColor }}>
                    <td 
                      colSpan={4} 
                      style={{ 
                        padding: `${cellPadding}px`,
                        color: headerTextColor,
                        fontSize: `${headerFontSize}px`,
                        fontWeight: 'bold',
                        textAlign: 'left',
                      }}
                    >
                      الإجمالي الكلي
                    </td>
                    <td 
                      style={{ 
                        padding: `${cellPadding}px`,
                        color: headerTextColor,
                        fontSize: `${headerFontSize}px`,
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}
                    >
                      14,550.00
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Summary Table Preview */}
              <div style={{ marginTop: '20px' }}>
                <div 
                  style={{ 
                    color: sectionTitleColor,
                    fontSize: `${titleFontSize}px`,
                    fontWeight: 'bold',
                    borderBottom: `2px solid ${sectionTitleColor}`,
                    paddingBottom: '4px',
                    marginBottom: '8px',
                  }}
                >
                  الملخص المالي
                </div>
                <table 
                  style={{ 
                    width: '100%', 
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    border: `${borderWidth}px solid ${tableBorderColor}`,
                    borderRadius: `${borderRadius}px`,
                    overflow: 'hidden',
                  }}
                >
                  <tbody>
                    {[
                      { label: 'إجمالي المستحقات', value: '14,550.00 د.ل' },
                      { label: 'إجمالي المدفوع', value: '8,200.00 د.ل' },
                      { label: 'المتبقي', value: '6,350.00 د.ل' },
                    ].map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ 
                          padding: `${cellPadding}px`,
                          color: tableTextColor,
                          fontSize: `${tableFontSize}px`,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          borderBottom: idx < 2 ? `${borderWidth}px solid ${tableBorderColor}` : 'none',
                          width: '50%',
                        }}>
                          {row.label}
                        </td>
                        <td style={{ 
                          padding: `${cellPadding}px`,
                          color: tableTextColor,
                          fontSize: `${tableFontSize}px`,
                          fontWeight: 'bold',
                          textAlign: 'center',
                          borderBottom: idx < 2 ? `${borderWidth}px solid ${tableBorderColor}` : 'none',
                          borderRight: `${borderWidth}px solid ${tableBorderColor}`,
                        }}>
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            {footerEnabled && (
              <div
                style={{
                  position: 'absolute',
                  bottom: `${footerBottom}mm`,
                  left: '12mm',
                  right: '12mm',
                  height: `${footerHeight}mm`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: `1px solid ${tableBorderColor}`,
                  paddingTop: '4px',
                  fontSize: '10px',
                  color: '#666',
                  direction: 'rtl',
                }}
              >
                <span>اسم المشروع</span>
                <span>التاريخ: {new Date().toLocaleDateString('ar-LY')}</span>
                <span>صفحة 1 من 1</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintDesign;
