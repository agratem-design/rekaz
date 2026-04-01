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
}

const statusLabels = {
  active: "نشط",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغي"
};

const statusColors = {
  active: "bg-green-500/20 text-green-500",
  pending: "bg-yellow-500/20 text-yellow-500",
  completed: "bg-blue-500/20 text-blue-500",
  cancelled: "bg-red-500/20 text-red-500"
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
}: ProjectCardProps) => {
  const location = useLocation();
  const { isEngineer } = useAuth();
  const returnTo = encodeURIComponent(location.pathname);
  const shouldHideFinancials = hideFinancials ?? isEngineer;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', { style: 'decimal', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Card className="p-5 card-hover overflow-hidden">
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
            <div className="rounded-lg bg-primary/20 p-2 shrink-0">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg truncate">{name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColors[status]} variant="outline">
                  {statusLabels[status]}
                </Badge>
                {supervisingEngineerName && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <HardHat className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">{supervisingEngineerName}</span>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>تقرير المشروع</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to={`/projects/${id}/edit?returnTo=${returnTo}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">التقدم</span>
            <span className="font-semibold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Budget */}
        {!shouldHideFinancials && (
          <div className="flex justify-between text-sm pt-2 border-t border-border">
            <div>
              <p className="text-muted-foreground text-xs">الميزانية</p>
              <p className="font-semibold">{budget}</p>
            </div>
            <div className="text-left">
              <p className="text-muted-foreground text-xs">المصروف</p>
              <p className="font-semibold">{spent}</p>
            </div>
          </div>
        )}

        {/* Contract Summary */}
        {!shouldHideFinancials && contractsCount > 0 && (
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border bg-primary/5 -mx-5 px-5 py-2">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">{contractsCount} عقد</span>
            </div>
            <span className="font-bold text-primary">{formatAmount(contractsValue)}</span>
          </div>
        )}

        {/* Financial Summaries */}
        {!shouldHideFinancials && (purchasesTotal > 0 || expensesTotal > 0 || rentalsTotal > 0) && (
          <div className={`grid gap-2 pt-2 border-t border-border`} style={{ gridTemplateColumns: `repeat(${[purchasesTotal > 0, expensesTotal > 0, rentalsTotal > 0].filter(Boolean).length}, 1fr)` }}>
            {purchasesTotal > 0 && (
              <div className="text-center p-2 bg-blue-500/10 rounded-lg">
                <ShoppingCart className="h-3.5 w-3.5 text-blue-500 mx-auto mb-1" />
                <p className="text-xs font-medium">{formatAmount(purchasesTotal)}</p>
              </div>
            )}
            {expensesTotal > 0 && (
              <div className="text-center p-2 bg-orange-500/10 rounded-lg">
                <Coins className="h-3.5 w-3.5 text-orange-500 mx-auto mb-1" />
                <p className="text-xs font-medium">{formatAmount(expensesTotal)}</p>
              </div>
            )}
            {rentalsTotal > 0 && (
              <div className="text-center p-2 bg-purple-500/10 rounded-lg">
                <Wrench className="h-3.5 w-3.5 text-purple-500 mx-auto mb-1" />
                <p className="text-xs font-medium">{formatAmount(rentalsTotal)}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-border space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Link to={`/projects/${id}/phases`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5 h-9">
                <Box className="h-4 w-4" />
                <span className="truncate">فواتير المراحل</span>
              </Button>
            </Link>
            <Link to={`/projects/${id}/progress`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5 h-9">
                <TrendingUp className="h-4 w-4" />
                <span className="truncate">التقدم</span>
              </Button>
            </Link>
            <Link to={`/projects/${id}/contracts`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5 h-9">
                <FileText className="h-4 w-4" />
                <span className="truncate">العقود</span>
              </Button>
            </Link>
          </div>
          
          {!shouldHideFinancials && (
            <div className="grid grid-cols-3 gap-2">
              <Link to={`/projects/${id}/purchases`}>
                <Button variant="outline" size="sm" className="w-full gap-1 h-9 text-xs px-2">
                  <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">المشتريات</span>
                </Button>
              </Link>
              <Link to={`/projects/${id}/equipment`}>
                <Button variant="outline" size="sm" className="w-full gap-1 h-9 text-xs px-2">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">الإيجارات</span>
                </Button>
              </Link>
              <Link to={`/projects/${id}/expenses`}>
                <Button variant="outline" size="sm" className="w-full gap-1 h-9 text-xs px-2">
                  <Coins className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">المصروفات</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
