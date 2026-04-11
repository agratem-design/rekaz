import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchableSelect from "@/components/ui/searchable-select";
import {
  ShoppingCart,
  Wrench,
  Receipt,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";

const QuickAddSection = () => {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [activeTab, setActiveTab] = useState("purchase");

  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: "", invoice_number: "", total_amount: "", paid_amount: "",
    commission: "0", date: new Date().toISOString().split("T")[0], treasury_id: "", notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    description: "", amount: "", type: "materials",
    date: new Date().toISOString().split("T")[0], notes: "",
  });

  const [rentalForm, setRentalForm] = useState({
    equipment_id: "", daily_rate: "",
    start_date: new Date().toISOString().split("T")[0], notes: "",
  });

  const [itemForm, setItemForm] = useState({
    name: "", description: "", quantity: "", unit_price: "",
    measurement_type: "linear", notes: "",
  });

  const { data: projects } = useQuery({
    queryKey: ["quick-add-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("id, name, client_id, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: phases } = useQuery({
    queryKey: ["quick-add-phases", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const { data, error } = await supabase.from("project_phases")
        .select("id, name, phase_number")
        .eq("project_id", selectedProjectId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProjectId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["quick-add-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: treasuries } = useQuery({
    queryKey: ["quick-add-treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("treasuries")
        .select("id, name, treasury_type")
        .eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: equipment } = useQuery({
    queryKey: ["quick-add-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment")
        .select("id, name, daily_rental_rate, available_quantity")
        .gt("available_quantity", 0).order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { setSelectedPhaseId(""); }, [selectedProjectId]);

  useEffect(() => {
    if (rentalForm.equipment_id && equipment) {
      const eq = equipment.find((e) => e.id === rentalForm.equipment_id);
      if (eq) setRentalForm((prev) => ({ ...prev, daily_rate: String(eq.daily_rental_rate) }));
    }
  }, [rentalForm.equipment_id, equipment]);

  // Memoized options for searchable selects
  const projectOptions = useMemo(() =>
    projects?.map((p: any) => ({
      value: p.id,
      label: p.name,
      sublabel: p.clients?.name || undefined,
    })) || [], [projects]);

  const phaseOptions = useMemo(() => [
    { value: "none", label: "بدون مرحلة" },
    ...(phases?.map((ph) => ({
      value: ph.id,
      label: ph.name,
      sublabel: ph.phase_number ? `رقم ${ph.phase_number}` : undefined,
    })) || []),
  ], [phases]);

  const supplierOptions = useMemo(() =>
    suppliers?.map((s) => ({ value: s.id, label: s.name })) || [], [suppliers]);

  const treasuryOptions = useMemo(() =>
    treasuries?.map((t) => ({ value: t.id, label: t.name, sublabel: t.treasury_type === "bank" ? "بنك" : "نقد" })) || [], [treasuries]);

  const equipmentOptions = useMemo(() =>
    equipment?.map((eq) => ({ value: eq.id, label: eq.name, sublabel: `${eq.available_quantity} متاح` })) || [], [equipment]);

  // Mutations
  const addPurchase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("purchases").insert({
        project_id: selectedProjectId,
        phase_id: selectedPhaseId && selectedPhaseId !== "none" ? selectedPhaseId : null,
        supplier_id: purchaseForm.supplier_id || null,
        invoice_number: purchaseForm.invoice_number || null,
        total_amount: Number(purchaseForm.total_amount) || 0,
        paid_amount: Number(purchaseForm.paid_amount) || 0,
        commission: Number(purchaseForm.commission) || 0,
        date: purchaseForm.date,
        treasury_id: purchaseForm.treasury_id || null,
        notes: purchaseForm.notes || null,
        status: Number(purchaseForm.paid_amount) >= Number(purchaseForm.total_amount) ? "paid" : Number(purchaseForm.paid_amount) > 0 ? "partial" : "due",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تمت إضافة فاتورة المشتريات بنجاح ✓" });
      setPurchaseForm((prev) => ({
        ...prev, invoice_number: "", total_amount: "", paid_amount: "", commission: "0",
        date: new Date().toISOString().split("T")[0], notes: "",
      }));
      queryClient.invalidateQueries({ queryKey: ["all-purchases-client-projects"] });
    },
    onError: (e: any) => { toast({ title: "خطأ", description: e.message, variant: "destructive" }); },
  });

  const addExpense = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        project_id: selectedProjectId,
        phase_id: selectedPhaseId && selectedPhaseId !== "none" ? selectedPhaseId : null,
        description: expenseForm.description,
        amount: Number(expenseForm.amount) || 0,
        type: expenseForm.type,
        date: expenseForm.date,
        notes: expenseForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تمت إضافة المصروف بنجاح ✓" });
      setExpenseForm({ description: "", amount: "", type: "materials", date: new Date().toISOString().split("T")[0], notes: "" });
      queryClient.invalidateQueries({ queryKey: ["all-expenses-client-projects"] });
    },
    onError: (e: any) => { toast({ title: "خطأ", description: e.message, variant: "destructive" }); },
  });

  const addRental = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("equipment_rentals").insert({
        equipment_id: rentalForm.equipment_id,
        project_id: selectedProjectId,
        daily_rate: Number(rentalForm.daily_rate) || 0,
        start_date: rentalForm.start_date,
        total_amount: 0, status: "active",
        notes: rentalForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تمت إضافة إيجار المعدات بنجاح ✓" });
      setRentalForm({ equipment_id: "", daily_rate: "", start_date: new Date().toISOString().split("T")[0], notes: "" });
      queryClient.invalidateQueries({ queryKey: ["all-rentals-client-projects"] });
      queryClient.invalidateQueries({ queryKey: ["quick-add-equipment"] });
    },
    onError: (e: any) => { toast({ title: "خطأ", description: e.message, variant: "destructive" }); },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const qty = Number(itemForm.quantity) || 0;
      const price = Number(itemForm.unit_price) || 0;
      const { error } = await supabase.from("project_items").insert({
        project_id: selectedProjectId,
        phase_id: selectedPhaseId && selectedPhaseId !== "none" ? selectedPhaseId : null,
        name: itemForm.name,
        description: itemForm.description || null,
        measurement_type: itemForm.measurement_type,
        quantity: qty,
        unit_price: price,
        total_price: qty * price,
        notes: itemForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تمت إضافة بند المقاولات بنجاح ✓" });
      setItemForm({ name: "", description: "", quantity: "", unit_price: "", measurement_type: "linear", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["project-items"] });
      queryClient.invalidateQueries({ queryKey: ["all-items-client-projects"] });
    },
    onError: (e: any) => { toast({ title: "خطأ", description: e.message, variant: "destructive" }); },
  });

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const isLoading = addPurchase.isPending || addExpense.isPending || addRental.isPending || addItem.isPending;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            إضافة سريعة
            {selectedProject && (
              <Badge variant="secondary" className="mr-2 text-xs">
                {(selectedProject as any).clients?.name} — {selectedProject.name}
              </Badge>
            )}
          </CardTitle>
          {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Project & Phase Selection with Search */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">المشروع *</Label>
              <SearchableSelect
                options={projectOptions}
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                placeholder="ابحث عن مشروع أو زبون..."
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">المرحلة (اختياري)</Label>
              <SearchableSelect
                options={phaseOptions}
                value={selectedPhaseId}
                onValueChange={setSelectedPhaseId}
                placeholder="ابحث عن مرحلة..."
                disabled={!selectedProjectId}
              />
            </div>
          </div>

          {selectedProjectId && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="item" className="text-xs gap-1">
                  <Package className="h-3.5 w-3.5" /> بنود مقاولات
                </TabsTrigger>
                <TabsTrigger value="purchase" className="text-xs gap-1">
                  <ShoppingCart className="h-3.5 w-3.5" /> مشتريات
                </TabsTrigger>
                <TabsTrigger value="expense" className="text-xs gap-1">
                  <Receipt className="h-3.5 w-3.5" /> مصروفات
                </TabsTrigger>
                <TabsTrigger value="rental" className="text-xs gap-1">
                  <Wrench className="h-3.5 w-3.5" /> إيجار معدات
                </TabsTrigger>
              </TabsList>

              {/* Item Tab */}
              <TabsContent value="item" className="mt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <Label className="text-xs">اسم البند *</Label>
                    <Input className="h-9" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="اسم البند" />
                  </div>
                  <div>
                    <Label className="text-xs">الكمية *</Label>
                    <Input className="h-9" type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">سعر الوحدة *</Label>
                    <Input className="h-9" type="number" value={itemForm.unit_price} onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">نوع القياس</Label>
                    <Select value={itemForm.measurement_type} onValueChange={(v) => setItemForm({ ...itemForm, measurement_type: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">طولي</SelectItem>
                        <SelectItem value="area">مسطح</SelectItem>
                        <SelectItem value="volume">حجمي</SelectItem>
                        <SelectItem value="unit">وحدة</SelectItem>
                        <SelectItem value="weight">وزن</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">الوصف</Label>
                    <Input className="h-9" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="اختياري" />
                  </div>
                  <div>
                    <Label className="text-xs">ملاحظات</Label>
                    <Input className="h-9" value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} placeholder="اختياري" />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full h-9" onClick={() => addItem.mutate()} disabled={!itemForm.name || !itemForm.quantity || !itemForm.unit_price || isLoading}>
                      {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 ml-1" />إضافة</>}
                    </Button>
                  </div>
                </div>
                {itemForm.quantity && itemForm.unit_price && (
                  <p className="text-xs text-muted-foreground mt-2">
                    الإجمالي: {formatCurrencyLYD(Number(itemForm.quantity) * Number(itemForm.unit_price))}
                  </p>
                )}
              </TabsContent>

              {/* Purchase Tab */}
              <TabsContent value="purchase" className="mt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">المورد</Label>
                    <SearchableSelect
                      options={supplierOptions}
                      value={purchaseForm.supplier_id}
                      onValueChange={(v) => setPurchaseForm({ ...purchaseForm, supplier_id: v })}
                      placeholder="ابحث عن مورد..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">رقم الفاتورة</Label>
                    <Input className="h-9" value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">الإجمالي *</Label>
                    <Input className="h-9" type="number" value={purchaseForm.total_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, total_amount: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">المدفوع</Label>
                    <Input className="h-9" type="number" value={purchaseForm.paid_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, paid_amount: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">العمولة</Label>
                    <Input className="h-9" type="number" value={purchaseForm.commission} onChange={(e) => setPurchaseForm({ ...purchaseForm, commission: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">الخزينة</Label>
                    <SearchableSelect
                      options={treasuryOptions}
                      value={purchaseForm.treasury_id}
                      onValueChange={(v) => setPurchaseForm({ ...purchaseForm, treasury_id: v })}
                      placeholder="ابحث عن خزينة..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">التاريخ</Label>
                    <Input className="h-9" type="date" value={purchaseForm.date} onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full h-9" onClick={() => addPurchase.mutate()} disabled={!purchaseForm.total_amount || isLoading}>
                      {addPurchase.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 ml-1" />إضافة</>}
                    </Button>
                  </div>
                </div>
                {purchaseForm.total_amount && (
                  <p className="text-xs text-muted-foreground mt-2">
                    الإجمالي: {formatCurrencyLYD(Number(purchaseForm.total_amount))} | المدفوع: {formatCurrencyLYD(Number(purchaseForm.paid_amount) || 0)} | العمولة: {formatCurrencyLYD(Number(purchaseForm.commission) || 0)}
                  </p>
                )}
              </TabsContent>

              {/* Expense Tab */}
              <TabsContent value="expense" className="mt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <Label className="text-xs">الوصف *</Label>
                    <Input className="h-9" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="وصف المصروف" />
                  </div>
                  <div>
                    <Label className="text-xs">المبلغ *</Label>
                    <Input className="h-9" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">النوع</Label>
                    <Select value={expenseForm.type} onValueChange={(v) => setExpenseForm({ ...expenseForm, type: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materials">مواد</SelectItem>
                        <SelectItem value="labor">عمالة</SelectItem>
                        <SelectItem value="equipment">معدات</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">التاريخ</Label>
                    <Input className="h-9" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">ملاحظات</Label>
                    <Input className="h-9" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="اختياري" />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full h-9" onClick={() => addExpense.mutate()} disabled={!expenseForm.description || !expenseForm.amount || isLoading}>
                      {addExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 ml-1" />إضافة</>}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Rental Tab */}
              <TabsContent value="rental" className="mt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">المعدة *</Label>
                    <SearchableSelect
                      options={equipmentOptions}
                      value={rentalForm.equipment_id}
                      onValueChange={(v) => setRentalForm({ ...rentalForm, equipment_id: v })}
                      placeholder="ابحث عن معدة..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">الإيجار اليومي *</Label>
                    <Input className="h-9" type="number" value={rentalForm.daily_rate} onChange={(e) => setRentalForm({ ...rentalForm, daily_rate: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">تاريخ البدء</Label>
                    <Input className="h-9" type="date" value={rentalForm.start_date} onChange={(e) => setRentalForm({ ...rentalForm, start_date: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full h-9" onClick={() => addRental.mutate()} disabled={!rentalForm.equipment_id || !rentalForm.daily_rate || isLoading}>
                      {addRental.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 ml-1" />إضافة</>}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {!selectedProjectId && (
            <p className="text-sm text-muted-foreground text-center py-2">ابحث واختر مشروعاً للبدء بالإضافة السريعة</p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default QuickAddSection;
