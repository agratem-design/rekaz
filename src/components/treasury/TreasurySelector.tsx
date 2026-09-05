import React, { useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyLYD } from "@/lib/currency";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Wallet, Landmark, AlertCircle, ExternalLink, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export interface TreasuryRecord {
  id: string;
  name: string;
  balance: number;
  treasury_type: string;
  parent_id: string | null;
  project_category: string | null;
  is_active?: boolean;
}

interface TreasurySelectorProps {
  value: string;
  onValueChange: (treasuryId: string) => void;
  projectType?: "contracting" | "finishing" | string;
  projectDefaultTreasuryId?: string | null;
  requiredAmount?: number;
  label?: string;
  disabled?: boolean;
}

export const TreasurySelector: React.FC<TreasurySelectorProps> = ({
  value,
  onValueChange,
  projectType = "contracting",
  projectDefaultTreasuryId,
  requiredAmount = 0,
  label = "الخزينة المخصوم منها",
  disabled = false,
}) => {
  const navigate = useNavigate();
  const { isAdmin, isAccountant } = useAuth();

  // Fetch active treasuries
  const { data: allTreasuries = [], isLoading: isTreasuriesLoading } = useQuery<TreasuryRecord[]>({
    queryKey: ["treasuries-active-selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id, project_category, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as TreasuryRecord[];
    },
  });

  // Fetch company settings for authoritative main treasury IDs
  const { data: companySettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["company-settings-treasury-authority"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("id, contracting_treasury_id, finishing_treasury_id")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isTreasuriesLoading || isSettingsLoading;

  // Domain Partitioning Logic: Authoritative Sector Main + Active Same-Domain Descendants
  const { authoritativeRoot, descendants, eligibleOptions, allowedTreasuryIds, defaultCandidateId } = useMemo(() => {
    const isContracting = projectType === "contracting";
    const targetMainId = isContracting
      ? companySettings?.contracting_treasury_id
      : companySettings?.finishing_treasury_id;
    const targetDomain = isContracting ? "contracting" : "finishing";

    // Build parent lookup map to resolve root for any treasury
    const treasuryMap = new Map<string, TreasuryRecord>();
    allTreasuries.forEach((t) => treasuryMap.set(t.id, t));

    const getRootTreasury = (treasury: TreasuryRecord): TreasuryRecord => {
      let current = treasury;
      let depth = 0;
      while (current.parent_id && treasuryMap.has(current.parent_id) && depth < 10) {
        current = treasuryMap.get(current.parent_id)!;
        depth++;
      }
      return current;
    };

    // Filter strictly to active treasuries in current domain
    const activeDomainTreasuries = allTreasuries.filter((t) => {
      if (t.is_active === false) return false;
      const root = getRootTreasury(t);
      return root.project_category === targetDomain;
    });

    // 1. Resolve deterministic default ID from project or company_settings
    let defaultId = "";
    if (projectDefaultTreasuryId) {
      const projDef = allTreasuries.find((t) => t.id === projectDefaultTreasuryId && t.is_active !== false);
      if (projDef && getRootTreasury(projDef).project_category === targetDomain) {
        defaultId = projectDefaultTreasuryId;
      }
    }
    if (!defaultId && targetMainId) {
      const mainSetting = allTreasuries.find((t) => t.id === targetMainId && t.is_active !== false);
      if (mainSetting && getRootTreasury(mainSetting).project_category === targetDomain) {
        defaultId = targetMainId;
      }
    }

    // 2. Resolve authoritative single Main Root Treasury
    let rootRecord: TreasuryRecord | null = null;
    if (defaultId && treasuryMap.has(defaultId)) {
      const matched = treasuryMap.get(defaultId)!;
      rootRecord = matched.parent_id ? getRootTreasury(matched) : matched;
    } else if (targetMainId && treasuryMap.has(targetMainId)) {
      const matched = treasuryMap.get(targetMainId)!;
      rootRecord = matched.parent_id ? getRootTreasury(matched) : matched;
    } else {
      rootRecord = activeDomainTreasuries.find((t) => !t.parent_id) || null;
    }

    // 3. Resolve descendants belonging strictly to this authoritative root
    const descendantList = rootRecord
      ? activeDomainTreasuries.filter(
          (t) => t.id !== rootRecord!.id && getRootTreasury(t).id === rootRecord!.id
        )
      : [];

    const eligibleList = rootRecord
      ? (descendantList.length > 0 ? [...descendantList, rootRecord] : [rootRecord])
      : [];

    const allowedIds = new Set<string>(eligibleList.map((d) => d.id));

    let candidate = "";
    if (projectDefaultTreasuryId && allowedIds.has(projectDefaultTreasuryId)) {
      candidate = projectDefaultTreasuryId;
    } else if (descendantList.length > 0) {
      candidate = descendantList[0].id;
    } else if (rootRecord) {
      candidate = rootRecord.id;
    }

    return {
      authoritativeRoot: rootRecord,
      descendants: descendantList,
      eligibleOptions: eligibleList,
      allowedTreasuryIds: allowedIds,
      defaultCandidateId: candidate,
    };
  }, [allTreasuries, companySettings, projectType, projectDefaultTreasuryId]);

  // Handle default selection and project-type switch safety
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    if (!isLoading && defaultCandidateId && !disabled) {
      // If current value is empty or not in allowed domain IDs, reset to deterministic domain default
      if (!value || !allowedTreasuryIds.has(value)) {
        onValueChangeRef.current(defaultCandidateId);
      }
    }
  }, [value, defaultCandidateId, allowedTreasuryIds, disabled, isLoading]);

  const selectedTreasury = useMemo(() => {
    return allTreasuries.find((t) => t.id === value);
  }, [allTreasuries, value]);

  if (isLoading) {
    return (
      <div className="space-y-1.5 p-3 rounded-lg border bg-muted/30 animate-pulse text-right" dir="rtl">
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="h-9 w-full bg-muted rounded" />
      </div>
    );
  }

  // No active authoritative treasury configured for this domain
  if (!authoritativeRoot && descendants.length === 0) {
    return (
      <div className="space-y-2 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-right" dir="rtl">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
          <AlertCircle className="h-4 w-4" />
          لم يتم تكوين خزائن نشطة لقطاع {projectType === "contracting" ? "المقاولات" : "التشطيبات"}
        </div>
        <p className="text-xs text-muted-foreground">
          يرجى تفعيل أو إضافة خزينة أولاً لتتمكن من تسجيل الحركات النقدية.
        </p>
        {(isAdmin || isAccountant) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/treasuries")}
            className="text-xs gap-1.5 h-8 mt-1 border-amber-500/40 hover:bg-amber-500/20"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            فتح إعدادات الخزائن
          </Button>
        )}
      </div>
    );
  }

  const branchLabel = label.includes("مودع") || label.includes("استلام") || label.includes("قبض")
    ? "الحساب / الفرع المستلم *"
    : "الحساب / الفرع المخصوم منه *";

  return (
    <div className="space-y-3 p-3 bg-muted/40 rounded-xl border border-border/80 text-right" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1. القسم / الخزينة الرئيسية */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 text-primary" />
            <span>القسم / الخزينة الرئيسية *</span>
          </Label>
          <Select
            value={authoritativeRoot?.id || ""}
            disabled={true}
            dir="rtl"
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-border/60" dir="rtl">
              <SelectValue placeholder="اختر الخزينة الرئيسية..." />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {authoritativeRoot && (
                <SelectItem value={authoritativeRoot.id} className="font-semibold text-primary">
                  {authoritativeRoot.name} ({formatCurrencyLYD(authoritativeRoot.balance || 0)})
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 2. الحساب / الفرع المستلم أو المخصوم منه */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span>{branchLabel}</span>
            </Label>
            {selectedTreasury && (
              <span className="text-[11px] text-muted-foreground font-normal">
                المتاح: <span className="font-bold text-foreground font-mono">{formatCurrencyLYD(selectedTreasury.balance || 0)}</span>
              </span>
            )}
          </div>
          <Select
            value={value}
            onValueChange={onValueChange}
            disabled={disabled || !authoritativeRoot || eligibleOptions.length === 0}
            dir="rtl"
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-border/60" dir="rtl">
              <SelectValue placeholder={authoritativeRoot ? "اختر الحساب أو الفرع..." : "حدد الخزينة الرئيسية أولاً"} />
            </SelectTrigger>
            <SelectContent dir="rtl" className="max-h-64">
              {eligibleOptions.map((desc) => (
                <SelectItem key={desc.id} value={desc.id} className="py-2 text-xs cursor-pointer">
                  <span className="flex items-center gap-2">
                    {desc.treasury_type === "bank" ? (
                      <Landmark className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <Wallet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span>{desc.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-normal">
                      {desc.treasury_type === "bank" ? "مصرفي" : (desc.parent_id ? "فرع" : "رئيسية")}
                    </span>
                    <span className="text-xs text-muted-foreground mr-auto font-normal font-mono">
                      • {formatCurrencyLYD(desc.balance || 0)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Warning if authoritative Main Treasury cannot be resolved from settings */}
      {!defaultCandidateId && (
        <Alert variant="destructive" className="py-2 px-3 text-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            لم يتم العثور على الخزينة الرئيسية الصالحة لقطاع {projectType === "contracting" ? "المقاولات" : "التشطيبات"} في إعدادات الشركة. يرجى مراجعة إعدادات الخزائن.
          </AlertDescription>
        </Alert>
      )}

      {/* Informational balance warning if deduction exceeds balance */}
      {selectedTreasury && requiredAmount > (selectedTreasury.balance || 0) && (
        <Alert variant="destructive" className="py-2 px-3 text-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            تنبيه: المبلغ المطلوب ({formatCurrencyLYD(requiredAmount)}) يتجاوز رصيد الخزينة الحالي ({formatCurrencyLYD(selectedTreasury.balance || 0)}).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
