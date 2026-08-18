import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyLYD } from "@/lib/currency";
import { 
  User, 
  FileText, 
  ShoppingCart, 
  Truck, 
  HardHat, 
  Wrench, 
  Receipt, 
  Coins, 
  TrendingUp, 
  BarChart3, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight,
  Sparkles,
  Layers,
  Scale
} from "lucide-react";
import { useProjectFinancialSummary } from "@/hooks/useProjectFinancialSummary";

interface ProjectFinancialSummaryCardsProps {
  projectId: string;
  className?: string;
  showTitle?: boolean;
}

export function ProjectFinancialSummaryCards({
  projectId,
  className = "",
  showTitle = true,
}: ProjectFinancialSummaryCardsProps) {
  const summary = useProjectFinancialSummary(projectId);

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-pulse" dir="rtl">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4 bg-muted/40 h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} dir="rtl">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">الملخص المالي الشامل للمشروع</h3>
          </div>
          <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary">
            تحديث لحظي من المصدر المعتمد
          </Badge>
        </div>
      )}

      {/* 6 Independent Financial Fact Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. CLIENT SECTION */}
        <Card className="border-t-4 border-t-blue-500 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-blue-500/10 text-blue-600">
                  <User className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">حساب العميل</span>
              </div>
              <Badge className="bg-blue-500/10 text-blue-600 border-none text-xs">
                {summary.projectType === "finishing" ? "تكلفة + نسبة" : "تعاقدات"}
              </Badge>
            </div>
            
            <div className="space-y-1.5 pt-1 text-xs">
              {summary.projectType === "finishing" ? (
                <>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>قاعدة التكلفة المعتمدة:</span>
                    <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.eligibleCostBase)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>نسبة الإدارة ({summary.finishingPercentage}%):</span>
                    <span className="font-semibold text-blue-600 text-sm">{formatCurrencyLYD(summary.companyFee)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground font-semibold">
                    <span>إجمالي المستحق:</span>
                    <span className="font-bold text-foreground text-sm">{formatCurrencyLYD(summary.clientObligation)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>قيمة العقد / البنود:</span>
                  <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.contractValue)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-muted-foreground">
                <span>المحصل من الزبون:</span>
                <span className="font-semibold text-emerald-600 text-sm">{formatCurrencyLYD(summary.clientCollected)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold">
                <span className="text-foreground">المتبقي على الزبون:</span>
                <span className={summary.clientRemaining > 0 ? "text-destructive text-sm" : "text-emerald-600 text-sm"}>
                  {formatCurrencyLYD(summary.clientRemaining)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. SUPPLIERS SECTION */}
        <Card className="border-t-4 border-t-amber-500 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-amber-500/10 text-amber-600">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">حساب الموردين والمواد</span>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 border-none text-xs">مشتريات</Badge>
            </div>
            
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>إجمالي المشتريات:</span>
                <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.supplierPurchases)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>المسدد للموردين:</span>
                <span className="font-semibold text-emerald-600 text-sm">{formatCurrencyLYD(summary.supplierPaid)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold">
                <span className="text-foreground">المتبقي للموردين:</span>
                <span className={summary.supplierRemaining > 0 ? "text-amber-600 text-sm" : "text-muted-foreground text-sm"}>
                  {formatCurrencyLYD(summary.supplierRemaining)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. TECHNICIANS SECTION */}
        <Card className="border-t-4 border-t-purple-500 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-purple-500/10 text-purple-600">
                  <HardHat className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">حساب الفنيين والعمالة</span>
              </div>
              <Badge className="bg-purple-500/10 text-purple-600 border-none text-xs">استحقاقات</Badge>
            </div>
            
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>استحقاقات الفنيين:</span>
                <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.technicianObligations)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>المسدد للفنيين:</span>
                <span className="font-semibold text-emerald-600 text-sm">{formatCurrencyLYD(summary.technicianPaid)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold">
                <span className="text-foreground">المتبقي للفنيين:</span>
                <span className={summary.technicianRemaining > 0 ? "text-purple-600 text-sm" : "text-muted-foreground text-sm"}>
                  {formatCurrencyLYD(summary.technicianRemaining)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. EXPENSES & DIRECT COSTS SECTION */}
        <Card className="border-t-4 border-t-rose-500 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-rose-500/10 text-rose-600">
                  <Receipt className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">المصروفات والتكاليف المباشرة</span>
              </div>
              <Badge className="bg-rose-500/10 text-rose-600 border-none text-xs">منصرف مباشر</Badge>
            </div>
            
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>مصروفات المشروع المباشرة:</span>
                <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.projectExpenses)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>إيجارات المعدات:</span>
                <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.equipmentRentals)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold">
                <span className="text-foreground">إجمالي التكلفة المعتمدة:</span>
                <span className="text-rose-600 text-sm">{formatCurrencyLYD(summary.projectCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. PROFITABILITY SECTION */}
        <Card className="border-t-4 border-t-emerald-500 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">الربحية (أساس الاستحقاق)</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-xs">
                {summary.profitMarginPercent.toFixed(1)}% هامش
              </Badge>
            </div>
            
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>إيرادات المشروع (العقد):</span>
                <span className="font-semibold text-foreground text-sm">{formatCurrencyLYD(summary.projectRevenue)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>تكلفة المشروع الكلية:</span>
                <span className="font-semibold text-rose-600 text-sm">{formatCurrencyLYD(summary.projectCost)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold">
                <span className="text-foreground">مجمل الربح التقديري:</span>
                <span className={summary.grossProfit >= 0 ? "text-emerald-600 text-sm font-bold" : "text-destructive text-sm font-bold"}>
                  {formatCurrencyLYD(summary.grossProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. CASH FLOW SECTION */}
        <Card className="border-t-4 border-t-cyan-500 shadow-sm bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-600">
                  <Wallet className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground">التدفق النقدي للمشروع</span>
              </div>
              <Badge className="bg-cyan-500/10 text-cyan-600 border-none text-xs">حركة فعلية</Badge>
            </div>
            
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                  المقبوض نقداً للمشروع:
                </span>
                <span className="font-semibold text-emerald-600 text-sm">{formatCurrencyLYD(summary.cashCollected)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-rose-600" />
                  المدفوع نقداً للمشروع:
                </span>
                <span className="font-semibold text-rose-600 text-sm">{formatCurrencyLYD(summary.cashPaid)}</span>
              </div>
              <div className="border-t pt-1.5 flex justify-between items-center font-bold">
                <span className="text-foreground">صافي التدفق النقدي:</span>
                <span className={summary.netCashFlow >= 0 ? "text-cyan-600 text-sm font-bold" : "text-destructive text-sm font-bold"}>
                  {formatCurrencyLYD(summary.netCashFlow)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
