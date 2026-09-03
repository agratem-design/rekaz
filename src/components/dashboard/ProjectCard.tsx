import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, Box, Pencil, ShoppingCart, TrendingUp, Printer, HardHat, Wrench, Coins, Wallet, FileText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectCardProps {
  id: string;
  name: string;
  progress: number;
  status: "active" | "pending" | "completed" | "cancelled";
  budget: string;
  spent: string;
  supervisingEngineerName?: string;
  hideFinancials?: boolean;
  imageUrl?: string;
  purchasesTotal?: number;
  expensesTotal?: number;
  rentalsTotal?: number;
  custodyTotal?: number;
  contractsCount?: number;
  contractsValue?: number;
  projectType?: "contracting" | "finishing";
}

const statusLabels = {
  active: "نشط",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغي"
};

const statusColors = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold",
  completed: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-bold",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-bold"
};

export const ProjectCard = ({ 
  id, 
  name, 
  progress, 
  status, 
  budget, 
  spent, 
  supervisingEngineerName, 
  hideFinancials,
  imageUrl,
  purchasesTotal = 0,
  expensesTotal = 0,
  rentalsTotal = 0,
  custodyTotal = 0,
  contractsCount = 0,
  contractsValue = 0,
  projectType = "contracting",
}: ProjectCardProps) => {
  const location = useLocation();
  const { isEngineer } = useAuth();
  const returnTo = encodeURIComponent(location.pathname);
  const shouldHideFinancials = hideFinancials ?? isEngineer;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', { style: 'decimal', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Card className="p-5 bg-card border border-border/80 shadow-xs hover:border-primary/50 hover:shadow-md transition-all overflow-hidden">
      <div className="space-y-4">
        {/* Project Image */}
        {imageUrl && (
          <div className="w-full h-32 -mx-5 -mt-5 mb-4 overflow-hidden bg-muted">
            <img 
              src={imageUrl} 
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-primary/15 p-2.5 shrink-0 text-primary">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg truncate text-foreground">{name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColors[status]} variant="outline">
                  {statusLabels[status]}
                </Badge>
                {supervisingEngineerName && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <HardHat className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[120px]">{supervisingEngineerName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          {!shouldHideFinancials && (
            <div className="flex gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to={`/projects/${id}/report`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>تقرير المشروع</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to={`/projects/${id}/edit?returnTo=${returnTo}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>تعديل المشروع</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-muted-foreground">التقدم</span>
            <span className="font-bold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-muted/60" />
        </div>

        {/* Budget */}
        {!shouldHideFinancials && (
          <div className="flex justify-between text-sm pt-3 border-t border-border/80">
            <div>
              <p className="text-muted-foreground text-xs font-bold">الميزانية</p>
              <p className="font-bold text-foreground">{budget}</p>
            </div>
            <div className="text-left">
              <p className="text-muted-foreground text-xs font-bold">المصروف</p>
              <p className="font-bold text-foreground">{spent}</p>
            </div>
          </div>
        )}

        {/* Contract Summary */}
        {!shouldHideFinancials && contractsCount > 0 && (
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border/80 bg-primary/10 -mx-5 px-5 py-2.5">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground/80 font-bold text-xs">{contractsCount} عقد</span>
            </div>
            <span className="font-black text-primary text-sm">{formatAmount(contractsValue)}</span>
          </div>
        )}

        {/* Financial Summaries */}
        {!shouldHideFinancials && (purchasesTotal > 0 || expensesTotal > 0 || rentalsTotal > 0) && (
          <div className={`grid gap-2 pt-2 border-t border-border/80`} style={{ gridTemplateColumns: `repeat(${[purchasesTotal > 0, expensesTotal > 0, rentalsTotal > 0].filter(Boolean).length}, 1fr)` }}>
            {purchasesTotal > 0 && (
              <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <ShoppingCart className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-foreground">{formatAmount(purchasesTotal)}</p>
              </div>
            )}
            {expensesTotal > 0 && (
              <div className="text-center p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <Coins className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-foreground">{formatAmount(expensesTotal)}</p>
              </div>
            )}
            {rentalsTotal > 0 && (
              <div className="text-center p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Wrench className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-foreground">{formatAmount(rentalsTotal)}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-border/80 space-y-2">
          {/* Standard layout for all projects */}
          <>
              <div className="grid grid-cols-3 gap-2">
                <Link to={`/projects/${id}/phases`}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 bg-card border-border/80 hover:border-primary hover:bg-primary/10 hover:text-primary font-bold text-xs text-foreground transition-all shadow-2xs cursor-pointer">
                    <Box className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">المراحل</span>
                  </Button>
                </Link>
                <Link to={`/projects/${id}/progress`}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 bg-card border-border/80 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 font-bold text-xs text-foreground transition-all shadow-2xs cursor-pointer">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">التقدم</span>
                  </Button>
                </Link>
                <Link to={`/projects/${id}/contracts`}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 bg-card border-border/80 hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-400 font-bold text-xs text-foreground transition-all shadow-2xs cursor-pointer">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">العقود</span>
                  </Button>
                </Link>
              </div>
              
              {!shouldHideFinancials && (
                <div className="grid grid-cols-3 gap-2">
                  <Link to={`/projects/${id}/purchases`}>
                    <Button variant="outline" size="sm" className="w-full gap-1 h-9 text-xs px-2 bg-card border-border/80 hover:border-primary hover:bg-primary/10 hover:text-primary font-semibold text-foreground transition-all shadow-2xs cursor-pointer">
                      <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">المشتريات</span>
                    </Button>
                  </Link>
                  <Link to={`/projects/${id}/equipment`}>
                    <Button variant="outline" size="sm" className="w-full gap-1 h-9 text-xs px-2 bg-card border-border/80 hover:border-purple-500/60 hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-400 font-semibold text-foreground transition-all shadow-2xs cursor-pointer">
                      <Wrench className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="truncate">الإيجارات</span>
                    </Button>
                  </Link>
                  <Link to={`/projects/${id}/expenses`}>
                    <Button variant="outline" size="sm" className="w-full gap-1 h-9 text-xs px-2 bg-card border-border/80 hover:border-orange-500/60 hover:bg-orange-500/10 hover:text-orange-700 dark:hover:text-orange-400 font-semibold text-foreground transition-all shadow-2xs cursor-pointer">
                      <Coins className="h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
                      <span className="truncate">المصروفات</span>
                    </Button>
                  </Link>
                </div>
              )}
          </>
        </div>
      </div>
    </Card>
  );
};
