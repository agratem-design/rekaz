import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function QuickAddMeasurementDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreated: (unit: { id: string; name: string; unit_symbol: string }) => void;
}) {
  const [name, setName] = useState(""), [symbol, setSymbol] = useState("");
  const queryClient = useQueryClient();
  const save = useMutation({ mutationFn: async () => {
    if (!name.trim() || !symbol.trim()) throw new Error("أدخل اسم الوحدة ورمزها.");
    const { data, error } = await supabase.from("measurement_configs").insert({ name: name.trim(), unit_symbol: symbol.trim(),
      components: [{ name: "الكمية", symbol: "Q", label: "الكمية" }], formula: "Q" }).select("id, name, unit_symbol").single();
    if (error) throw error;
    return data;
  }, onSuccess: async unit => {
    await queryClient.invalidateQueries({ queryKey: ["measurement-configs"] });
    onCreated(unit); setName(""); setSymbol(""); onOpenChange(false); toast.success("أُضيفت الوحدة واختيرت للبند.");
  }, onError: (error: Error) => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={value => { if (!save.isPending) onOpenChange(value); }}><DialogContent dir="rtl">
    <DialogHeader><DialogTitle>إضافة وحدة قياس</DialogTitle><DialogDescription>وحدة بكمية مباشرة، مثل قطعة أو يوم. يمكن إعداد معادلات الأبعاد لاحقاً من أنواع القياس.</DialogDescription></DialogHeader>
    <form onSubmit={e => { e.preventDefault(); if (!save.isPending) save.mutate(); }}><fieldset disabled={save.isPending} className="space-y-4">
      <div><Label htmlFor="quick-unit-name">اسم الوحدة</Label><Input id="quick-unit-name" value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="مثال: يوم عمل" /></div>
      <div><Label htmlFor="quick-unit-symbol">رمز الوحدة</Label><Input id="quick-unit-symbol" value={symbol} onChange={e => setSymbol(e.target.value)} required placeholder="مثال: يوم" /></div>
      <div className="flex gap-2"><Button type="submit">{save.isPending ? "جاري الحفظ..." : "حفظ واختيار الوحدة"}</Button><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>رجوع</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}
