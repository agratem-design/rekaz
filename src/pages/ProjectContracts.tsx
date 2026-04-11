import { useState } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { printContract } from "@/lib/contractPrint";
import {
  ArrowRight,
  Plus,
  FileText,
  Trash2,
  Edit,
  Calendar,
  ChevronDown,
  ChevronUp,
  Package,
  Printer,
  BookOpen,
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "معلق", color: "bg-yellow-500/20 text-yellow-500" },
  active: { label: "نشط", color: "bg-green-500/20 text-green-500" },
  completed: { label: "مكتمل", color: "bg-blue-500/20 text-blue-500" },
  cancelled: { label: "ملغي", color: "bg-red-500/20 text-red-500" },
};

type ContractItem = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  order_index: number;
  project_item_id: string | null;
};

export default function ProjectContracts() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<string>("active");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [contractItems, setContractItems] = useState<
    { id: string; name: string; quantity: number; unit_price: number; project_item_id: string }[]
  >([]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name)")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: companySettings } = useQuery({
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

  const { data: clauseTemplates = [] } = useQuery({
    queryKey: ["contract-clause-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_clause_templates")
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["project-contracts", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name")
        .eq("project_id", projectId!)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items-list", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select("id, name, unit_price, quantity")
        .eq("project_id", projectId!);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch contract items for expanded contract
  const { data: loadedContractItems = [] } = useQuery({
    queryKey: ["contract-items", expandedContract],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_items")
        .select("*")
        .eq("contract_id", expandedContract!)
        .order("order_index");
      if (error) throw error;
      return data as ContractItem[];
    },
    enabled: !!expandedContract,
  });

  // Fetch contract clauses for expanded contract
  const { data: loadedContractClauses = [] } = useQuery({
    queryKey: ["contract-clauses", expandedContract],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_clauses")
        .select("*")
        .eq("contract_id", expandedContract!)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!expandedContract,
  });

  const handlePrintContract = async (contract: any) => {
    // Load items and clauses
    const [itemsRes, clausesRes] = await Promise.all([
      supabase.from("contract_items").select("*").eq("contract_id", contract.id).order("order_index"),
      supabase.from("contract_clauses").select("*").eq("contract_id", contract.id).order("order_index"),
    ]);

    printContract({
      contract,
      projectName: project?.name || "",
      clientName: (project as any)?.clients?.name || "",
      companyName: companySettings?.company_name || "",
      items: (itemsRes.data || []).map((it: any) => ({
        name: it.name,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total_price: Number(it.total_price),
      })),
      clauses: (clausesRes.data || []).map((c: any) => ({
        title: c.title,
        content: c.content,
        order_index: c.order_index,
      })),
      settings: companySettings,
    });
  };

  const loadClausesFromTemplates = async (contractId: string) => {
    // Load active templates and insert as contract clauses
    const { data: templates } = await supabase
      .from("contract_clause_templates")
      .select("*")
      .eq("is_active", true)
      .order("order_index");

    if (templates && templates.length > 0) {
      // Delete existing clauses first
      await supabase.from("contract_clauses").delete().eq("contract_id", contractId);

      const clausesToInsert = templates.map((t: any) => ({
        contract_id: contractId,
        title: t.title,
        content: t.content,
        order_index: t.order_index,
      }));

      const { error } = await supabase.from("contract_clauses").insert(clausesToInsert);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["contract-clauses", contractId] });
      toast({ title: `تم تحميل ${templates.length} بند من القوالب الافتراضية` });
    } else {
      toast({ title: "لا توجد قوالب بنود مفعّلة", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setTitle("");
    setContractNumber(`CNT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
    setDescription("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setAmount(0);
    setStatus("active");
    setPaymentTerms("");
    setNotes("");
    setPhaseId("");
    setContractItems([]);
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setContractNumber(`CNT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
    setFormOpen(true);
  };

  const openEditForm = async (contract: any) => {
    setEditingId(contract.id);
    setTitle(contract.title);
    setContractNumber(contract.contract_number);
    setDescription(contract.description || "");
    setStartDate(contract.start_date);
    setEndDate(contract.end_date || "");
    setAmount(Number(contract.amount));
    setStatus(contract.status);
    setPaymentTerms(contract.payment_terms || "");
    setNotes(contract.notes || "");
    setPhaseId((contract as any).phase_id || "");

    // Load contract items
    const { data } = await supabase
      .from("contract_items")
      .select("*")
      .eq("contract_id", contract.id)
      .order("order_index");

    setContractItems(
      (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        project_item_id: item.project_item_id || "",
      }))
    );
    setFormOpen(true);
  };

  const addContractItem = () => {
    setContractItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: "", quantity: 0, unit_price: 0, project_item_id: "" },
    ]);
  };

  const updateContractItem = (idx: number, patch: any) => {
    setContractItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...patch };
        // If linking to project item, auto-fill
        if (patch.project_item_id && patch.project_item_id !== "") {
          const pItem = projectItems.find((p) => p.id === patch.project_item_id);
          if (pItem) {
            updated.name = pItem.name;
            updated.unit_price = Number(pItem.unit_price);
            updated.quantity = Number(pItem.quantity);
          }
        }
        return updated;
      })
    );
  };

  const removeContractItem = (idx: number) => {
    setContractItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const itemsTotal = contractItems.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const contractData = {
        title,
        contract_number: contractNumber,
        description: description || null,
        start_date: startDate,
        end_date: endDate || null,
        amount: amount || itemsTotal,
        status,
        payment_terms: paymentTerms || null,
        notes: notes || null,
        client_id: (project as any)?.client_id || null,
        project_id: projectId!,
        phase_id: phaseId || null,
      };

      let contractId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("contracts")
          .update(contractData as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("contracts")
          .insert(contractData as any)
          .select("id")
          .single();
        if (error) throw error;
        contractId = data.id;
      }

      // Save contract items
      if (contractId) {
        // Delete existing items for this contract
        await supabase.from("contract_items").delete().eq("contract_id", contractId);

        // Insert new items
        if (contractItems.length > 0) {
          const itemsToInsert = contractItems.map((item, idx) => ({
            contract_id: contractId!,
            project_item_id: item.project_item_id || null,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
            order_index: idx,
          }));
          const { error } = await supabase.from("contract_items").insert(itemsToInsert);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      queryClient.invalidateQueries({ queryKey: ["contract-items"] });
      toast({ title: editingId ? "تم تحديث العقد" : "تم إنشاء العقد بنجاح" });
      setFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      toast({ title: "تم حذف العقد" });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: "خطأ في الحذف", variant: "destructive" });
    },
  });

  const totalContractsValue = contracts.reduce((sum, c) => sum + Number(c.amount), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            عقود المشروع
          </h1>
          <p className="text-sm text-muted-foreground">{project?.name}</p>
        </div>
        <Button className="gap-2" onClick={openNewForm}>
          <Plus className="h-4 w-4" />
          عقد جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">إجمالي العقود</p>
          <p className="text-2xl font-bold text-primary">{contracts.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">العقود النشطة</p>
          <p className="text-2xl font-bold text-green-500">
            {contracts.filter((c) => c.status === "active").length}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">القيمة الإجمالية</p>
          <p className="text-lg font-bold text-primary">{formatCurrencyLYD(totalContractsValue)}</p>
        </Card>
      </div>

      {/* Contracts List */}
      {contracts.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد عقود لهذا المشروع</h3>
          <p className="text-muted-foreground mb-4">أنشئ عقداً جديداً لربطه بالمشروع</p>
          <Button onClick={openNewForm}>
            <Plus className="h-4 w-4 ml-2" />
            إنشاء عقد
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => {
            const isExpanded = expandedContract === contract.id;
            const cfg = statusConfig[contract.status] || statusConfig.pending;
            return (
              <Card key={contract.id} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedContract(isExpanded ? null : contract.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{contract.title}</h3>
                          <Badge variant="outline" className={cfg.color}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {contract.contract_number} • {contract.start_date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-primary">
                        {formatCurrencyLYD(Number(contract.amount))}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4 bg-muted/10">
                    {/* Contract Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">تاريخ البدء</span>
                        <p className="font-medium">{contract.start_date}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">تاريخ الانتهاء</span>
                        <p className="font-medium">{contract.end_date || "غير محدد"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">شروط الدفع</span>
                        <p className="font-medium">{contract.payment_terms || "غير محدد"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">القيمة</span>
                        <p className="font-bold text-primary">
                          {formatCurrencyLYD(Number(contract.amount))}
                        </p>
                      </div>
                    </div>

                    {contract.description && (
                      <p className="text-sm text-muted-foreground">{contract.description}</p>
                    )}

                    {/* Contract Items */}
                    {loadedContractItems.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <Package className="h-4 w-4" />
                          بنود العقد ({loadedContractItems.length})
                        </h4>
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">البند</TableHead>
                                <TableHead className="text-xs">الكمية</TableHead>
                                <TableHead className="text-xs">سعر الوحدة</TableHead>
                                <TableHead className="text-xs">الإجمالي</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {loadedContractItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-sm font-medium">{item.name}</TableCell>
                                  <TableCell className="text-sm">{item.quantity}</TableCell>
                                  <TableCell className="text-sm">
                                    {formatCurrencyLYD(Number(item.unit_price))}
                                  </TableCell>
                                  <TableCell className="text-sm font-semibold">
                                    {formatCurrencyLYD(Number(item.total_price))}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Contract Clauses */}
                    {loadedContractClauses.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4" />
                          شروط وأحكام العقد ({loadedContractClauses.length})
                        </h4>
                        <div className="space-y-2">
                          {loadedContractClauses.map((clause: any, idx: number) => (
                            <div key={clause.id} className="rounded-lg border p-3 bg-muted/20">
                              <p className="text-xs font-bold text-primary mb-1">
                                المادة {idx + 1}: {clause.title}
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                {clause.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintContract(contract);
                        }}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        طباعة العقد
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadClausesFromTemplates(contract.id);
                        }}
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        تحميل البنود الافتراضية
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditForm(contract);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContractId(contract.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Contract Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل العقد" : "عقد جديد"}</DialogTitle>
            <DialogDescription>
              {editingId ? "عدّل بيانات العقد وبنوده" : "أنشئ عقداً جديداً وأضف بنوده المالية"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 space-y-1.5">
                <Label>عنوان العقد *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان العقد" />
              </div>

              <div className="space-y-1.5">
                <Label>رقم العقد *</Label>
                <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {phases.length > 0 && (
                <div className="space-y-1.5">
                  <Label>المرحلة (اختياري)</Label>
                  <Select value={phaseId || "__none__"} onValueChange={(val) => setPhaseId(val === "__none__" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المرحلة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">كل المشروع</SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>تاريخ البدء *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>تاريخ الانتهاء</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>قيمة العقد (د.ل)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>شروط الدفع</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="مثال: دفعة مقدمة 30%"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label>الوصف</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف العقد"
                  rows={2}
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية"
                  rows={2}
                />
              </div>
            </div>

            {/* Contract Items Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  بنود العقد المالية
                </h3>
                <Button variant="outline" size="sm" onClick={addContractItem}>
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  إضافة بند
                </Button>
              </div>

              {contractItems.length > 0 && (
                <div className="space-y-3">
                  {contractItems.map((item, idx) => (
                    <Card key={item.id} className="p-3">
                      <div className="grid gap-2 md:grid-cols-5 items-end">
                        {projectItems.length > 0 && (
                          <div className="md:col-span-5 space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              ربط ببند المشروع (اختياري)
                            </Label>
                            <Select
                              value={item.project_item_id || "__none__"}
                              onValueChange={(val) => updateContractItem(idx, { project_item_id: val === "__none__" ? "" : val })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="اختر بند المشروع" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">بدون ربط</SelectItem>
                                {projectItems.map((pi) => (
                                  <SelectItem key={pi.id} value={pi.id}>
                                    {pi.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">اسم البند</Label>
                          <Input
                            value={item.name}
                            onChange={(e) => updateContractItem(idx, { name: e.target.value })}
                            placeholder="اسم البند"
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">الكمية</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateContractItem(idx, { quantity: Number(e.target.value) })
                            }
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">سعر الوحدة</Label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateContractItem(idx, { unit_price: Number(e.target.value) })
                            }
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">الإجمالي</Label>
                            <p className="h-8 flex items-center text-sm font-bold text-primary">
                              {formatCurrencyLYD(item.quantity * item.unit_price)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeContractItem(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                  <div className="flex justify-end items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">إجمالي البنود:</span>
                    <span className="font-bold text-primary">{formatCurrencyLYD(itemsTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جاري الحفظ..." : editingId ? "تحديث" : "حفظ العقد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا العقد؟ سيتم حذف جميع بنوده أيضاً.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedContractId && deleteMutation.mutate(selectedContractId)}
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
