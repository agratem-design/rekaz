import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Wallet, Landmark, Banknote } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";

interface TreasurySelectorProps {
  treasuryId: string;
  onTreasuryChange: (id: string) => void;
  parentTreasuryId: string;
  onParentTreasuryChange: (id: string) => void;
  paymentMethod: "cash" | "bank";
  onPaymentMethodChange: (method: "cash" | "bank") => void;
  amountToCheck?: number;
  enabled?: boolean;
  showPaymentMethod?: boolean;
}

type TreasuryRecord = {
  id: string;
  name?: string;
  balance?: number | null;
  treasury_type?: string | null;
  parent_id?: string | null;
};

export function getEffectiveTreasuryBalance(
  treasuryId: string,
  treasuries: TreasuryRecord[],
  paymentMethod?: "cash" | "bank"
) {
  const treasury = treasuries.find((item) => item.id === treasuryId);
  if (!treasury) return 0;

  const matchingChildren = treasuries.filter(
    (item) =>
      item.parent_id === treasuryId &&
      (!paymentMethod || item.treasury_type === paymentMethod)
  );

  if (matchingChildren.length > 0) {
    return matchingChildren.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  }

  return Number(treasury.balance || 0);
}

export function TreasurySelector({
  treasuryId,
  onTreasuryChange,
  parentTreasuryId,
  onParentTreasuryChange,
  paymentMethod,
  onPaymentMethodChange,
  amountToCheck = 0,
  enabled = true,
  showPaymentMethod = true,
}: TreasurySelectorProps) {
  const { data: allTreasuriesRaw = [] } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const allTreasuries = allTreasuriesRaw as TreasuryRecord[];
  const allChildren = allTreasuries.filter((t) => t.parent_id);
  const allParents = allTreasuries.filter((t) => !t.parent_id);

  const filteredParents = allParents.filter((parent) => {
    const children = allChildren.filter(
      (child) => child.parent_id === parent.id && child.treasury_type === paymentMethod
    );
    return children.length > 0;
  });

  const filteredChildren = allChildren.filter(
    (child) => child.parent_id === parentTreasuryId && child.treasury_type === paymentMethod
  );

  const selectedBalance = treasuryId
    ? getEffectiveTreasuryBalance(treasuryId, allTreasuries, paymentMethod)
    : 0;
  const insufficientBalance = Boolean(treasuryId) && amountToCheck > selectedBalance;

  const methodTotals = useMemo(() => ({
    cash: allChildren.filter(t => t.treasury_type === 'cash').reduce((s, t) => s + Number(t.balance || 0), 0),
    bank: allChildren.filter(t => t.treasury_type === 'bank').reduce((s, t) => s + Number(t.balance || 0), 0),
  }), [allChildren]);

  return (
    <div className="space-y-3">
      {showPaymentMethod && (
        <div className="space-y-2">
          <Label>طريقة الدفع</Label>
          <Select value={paymentMethod} onValueChange={(v: "cash" | "bank") => {
            onPaymentMethodChange(v);
            onParentTreasuryChange("");
            onTreasuryChange("");
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-[99999] pointer-events-auto">
              <SelectItem value="cash">
                <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> كاش ({formatCurrencyLYD(methodTotals.cash)})</span>
              </SelectItem>
              <SelectItem value="bank">
                <span className="flex items-center gap-1"><Landmark className="h-3 w-3" /> تحويل مصرفي ({formatCurrencyLYD(methodTotals.bank)})</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>الخزينة الرئيسية</Label>
          <Select value={parentTreasuryId} onValueChange={(v) => {
            onParentTreasuryChange(v);
            onTreasuryChange("");
          }}>
            <SelectTrigger>
              <SelectValue placeholder="اختر" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-[99999] pointer-events-auto">
              {filteredParents.length === 0 ? (
                <SelectItem value="none" disabled>لا توجد خزائن</SelectItem>
              ) : (
                filteredParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    <span className="flex items-center gap-1">
                      {paymentMethod === "bank" ? <Landmark className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                      {parent.name} - {formatCurrencyLYD(getEffectiveTreasuryBalance(parent.id, allTreasuries, paymentMethod))}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>الفرع</Label>
          <Select value={treasuryId} onValueChange={onTreasuryChange} disabled={!parentTreasuryId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الفرع" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="z-[99999] pointer-events-auto">
              {filteredChildren.length === 0 ? (
                <SelectItem value="none" disabled>اختر خزينة أولاً</SelectItem>
              ) : (
                filteredChildren.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    <span className="flex items-center gap-1">
                      {child.treasury_type === "bank" ? <Landmark className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                      {child.name} - {formatCurrencyLYD(getEffectiveTreasuryBalance(child.id, allTreasuries, paymentMethod))}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {insufficientBalance && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            رصيد الخزينة غير كافٍ! المتاح: {formatCurrencyLYD(selectedBalance)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Hook to get treasury data for validation in parent components */
export function useTreasuryData(enabled = true) {
  const { data: allTreasuriesRaw = [] } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const allTreasuries = (allTreasuriesRaw as TreasuryRecord[]) || [];
  const allChildren = allTreasuries.filter((t) => t.parent_id);
  return { allTreasuriesRaw: allTreasuries, allChildren };
}

