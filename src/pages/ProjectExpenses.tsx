import { useState, useMemo, useEffect } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/dialogs/UnsavedChangesDialog";
import { ProjectOperationDrawerShell } from "@/components/purchases/ProjectOperationDrawerShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowRight, Pencil, Trash2, Coins, Printer, Layers, Wallet, Landmark, Receipt, FileText, AlertTriangle, ArrowRightLeft, X } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { openPrintWindow, openReceiptPrintWindow } from "@/lib/printStyles";
import { getElementLabels } from "@/lib/printLabels";

const expenseTypes = [
  { value: "materials", label: "مواد" },
  { value: "labor", label: "عمالة" },
  { value: "equipment", label: "معدات" },
  { value: "other", label: "أخرى" },
];

const paymentMethods = [
  { value: "cash", label: "نقدي" },
  { value: "transfer", label: "تحويل" },
  { value: "check", label: "شيك" },
  { value: "installments", label: "أقساط" },
];

const ProjectExpenses = () => {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePhaseId = searchParams.get("phase") || phaseId || null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [forcedPhaseSelectorOpen, setForcedPhaseSelectorOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: "other" as "materials" | "labor" | "equipment" | "other",
    subtype: "مصروفات",
    payment_method: "cash" as "cash" | "transfer" | "check" | "installments",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    treasury_id: "",
  });

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(name)")
        .eq("id", projectId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch project phases for forced selection dialog
  const { data: projectPhases } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, order_index")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Validate Phase Ownership: if activePhaseId does not belong to projectId, reset phase query param
  useEffect(() => {
    if (activePhaseId && projectPhases && projectPhases.length > 0) {
      const isValid = projectPhases.some((p) => p.id === activePhaseId);
      if (!isValid) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("phase");
          return next;
        }, { replace: true });
      }
    }
  }, [activePhaseId, projectPhases, setSearchParams]);

  useEffect(() => {
    setForcedPhaseSelectorOpen(false);
  }, []);

  // Fetch project expenses (مصروفات only)
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["project-expenses", projectId, activePhaseId],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select(`
          *,
          treasuries:treasury_id(id, name, treasury_type)
        `)
        .eq("project_id", projectId!)
        .eq("subtype", "مصروفات")
        .order("date", { ascending: false });
      
      if (activePhaseId) {
        query = query.eq("phase_id", activePhaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch company settings for printing
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const handlePrintExpenseReceipt = (expense: any) => {
    openReceiptPrintWindow(
      {
        receiptNumber: `EXP-${expense.id.slice(0, 8)}`,
        date: expense.date,
        type: "expense",
        amount: Number(expense.amount),
        paidToOrBy: project?.name || "المشروع",
        description: expense.description,
        paymentMethod: expense.payment_method,
        treasuryName: expense.treasuries?.name,
        projectName: project?.name,
        notes: expense.notes || undefined,
      },
      companySettings
    );
  };

  // Fetch all active treasuries (with parent info)
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
  });
  const treasuryParents = allTreasuriesRaw.filter(t => !(t as any).parent_id);
  const allTreasuries = allTreasuriesRaw.filter(t => (t as any).parent_id);

  const groupedTreasuries = useMemo(() => {
    return treasuryParents.map(parent => ({
      parent,
      children: allTreasuriesRaw.filter(t => (t as any).parent_id === parent.id)
    }));
  }, [treasuryParents, allTreasuriesRaw]);

  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState<string>("");

  // Auto-select default treasuries based on project or system settings
  useEffect(() => {
    if (!editingExpense && project && companySettings && allTreasuriesRaw.length > 0) {
      const defaultParentId = (project as any)?.default_treasury_id || 
        (project?.project_type === "contracting" ? (companySettings as any)?.contracting_treasury_id : (companySettings as any)?.finishing_treasury_id);

      if (defaultParentId) {
        setSelectedParentTreasuryId(defaultParentId);
        // Find the first sub-treasury (child) belonging to this default parent
        const defaultSubTreasury = allTreasuriesRaw.find(t => (t as any).parent_id === defaultParentId);
        if (defaultSubTreasury) {
          setFormData(prev => ({
            ...prev,
            treasury_id: defaultSubTreasury.id
          }));
        }
      }
    }
  }, [project, companySettings, allTreasuriesRaw, editingExpense]);

  const resetForm = () => {
    const defaultParentId = (project as any)?.default_treasury_id || 
      (project?.project_type === "contracting" ? (companySettings as any)?.contracting_treasury_id : (companySettings as any)?.finishing_treasury_id) || "";
    
    const defaultSubTreasuryId = defaultParentId 
      ? allTreasuriesRaw.find(t => (t as any).parent_id === defaultParentId)?.id || "" 
      : "";

    setFormData({
      description: "",
      amount: "",
      type: "other",
      subtype: "مصروفات",
      payment_method: "cash",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      treasury_id: defaultSubTreasuryId,
    });
    setSelectedParentTreasuryId(defaultParentId);
    setEditingExpense(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: insertedExp, error } = await supabase
        .from("expenses")
        .insert({
          project_id: projectId,
          phase_id: activePhaseId || null,
          description: data.description,
          amount: parseFloat(data.amount),
          type: data.type,
          subtype: "مصروفات",
          payment_method: data.payment_method,
          date: data.date,
          notes: data.notes || null,
          treasury_id: data.treasury_id || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم إضافة المصروف بنجاح" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });
 
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("expenses")
        .update({
          description: data.description,
          amount: parseFloat(data.amount),
          type: data.type,
          payment_method: data.payment_method,
          date: data.date,
          notes: data.notes || null,
          treasury_id: data.treasury_id || null,
        })
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      toast({ title: "تم تحديث المصروف بنجاح" });
      resetForm();
      setIsDialogOpen(false);
      setEditingExpense(null);
    },
    onError: (error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      toast({ title: "تم حذف المصروف بنجاح" });
      setDeleteId(null);
    },
    onError: (error) => {
      toast({ title: "حدث خطأ", description: error.message, variant: "destructive" });
    },
  });


  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    const expenseTreasuryId = expense.treasury_id || "";
    let parentId = "";
    if (expenseTreasuryId) {
      const childTreasury = allTreasuries.find(t => t.id === expenseTreasuryId);
      if (childTreasury) {
        parentId = (childTreasury as any).parent_id || "";
      }
    }
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      type: expense.type,
      subtype: "مصروفات",
      payment_method: expense.payment_method,
      date: expense.date,
      notes: expense.notes || "",
      treasury_id: expenseTreasuryId,
    });
    setSelectedParentTreasuryId(parentId);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.treasury_id) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الخزينة الفرعية المخصوم منها المصروف",
        variant: "destructive",
      });
      return;
    }

    const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
    const amountNum = parseFloat(formData.amount) || 0;
    if (selectedTreasury && (selectedTreasury.balance || 0) < amountNum) {
      toast({
        title: "خطأ",
        description: `رصيد الخزينة غير كافٍ. المطلوب: ${formatCurrencyLYD(amountNum)} - المتاح: ${formatCurrencyLYD(selectedTreasury.balance || 0)}`,
        variant: "destructive",
      });
      return;
    }

    if (editingExpense) {
      updateMutation.mutate({ ...formData, id: editingExpense.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isFormDirty = useMemo(() => {
    if (!isDialogOpen) return false;
    if (editingExpense) {
      return (
        formData.description !== (editingExpense.description || "") ||
        formData.amount !== String(editingExpense.amount || "") ||
        formData.notes !== (editingExpense.notes || "")
      );
    }
    return (
      formData.description.trim() !== "" ||
      formData.amount.trim() !== "" ||
      formData.notes.trim() !== ""
    );
  }, [isDialogOpen, editingExpense, formData]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    showConfirmDialog: showUnsavedDialog,
    setShowConfirmDialog,
    requestAction,
    confirmDiscard: handleConfirmDiscard,
    cancelDiscard: handleCancelDiscard,
  } = useUnsavedChangesGuard({
    isDirty: isFormDirty,
    isSubmitting,
    onDiscard: () => {
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (isSubmitting) return; // Block closing while mutation is in-flight
      if (isFormDirty) {
        requestAction(() => {
          resetForm();
          setIsDialogOpen(false);
        });
      } else {
        resetForm();
        setIsDialogOpen(false);
      }
    } else {
      setIsDialogOpen(true);
    }
  };

  const handlePrint = () => {
    if (!expenses || expenses.length === 0) {
      toast({ title: "لا توجد مصروفات للطباعة", variant: "destructive" });
      return;
    }

    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const pl = getElementLabels(companySettings?.print_labels, "expenses");
    const borderStyle = `border: 1px solid ${companySettings?.print_table_border_color || "#ddd"};`;

    const content = `
      <div style="text-align: right; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: ${companySettings?.print_section_title_color || "#7A5A10"};">${pl.title}</h2>
        <p style="margin: 5px 0; color: #888;">المشروع: ${project?.name || ""}</p>
        <p style="margin: 5px 0; color: #888;">التاريخ: ${format(new Date(), "yyyy/MM/dd", { locale: ar })}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; ${borderStyle}">
        <thead>
          <tr style="background: ${companySettings?.print_table_header_color || "#a47c58"}; color: ${companySettings?.print_header_text_color || "#fff"};">
            <th style="padding: 10px; ${borderStyle} text-align: right;">${pl.col_number}</th>
            <th style="padding: 10px; ${borderStyle} text-align: right;">${pl.col_description}</th>
            <th style="padding: 10px; ${borderStyle} text-align: right;">${pl.col_type}</th>
            <th style="padding: 10px; ${borderStyle} text-align: right;">${pl.col_date}</th>
            <th style="padding: 10px; ${borderStyle} text-align: right;">${pl.col_payment_method}</th>
            <th style="padding: 10px; ${borderStyle} text-align: right;">${pl.col_amount}</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((exp, idx) => `
            <tr style="background: ${idx % 2 === 0 ? companySettings?.print_table_row_even_color || "#f9f9f9" : companySettings?.print_table_row_odd_color || "#fff"};">
              <td style="padding: 8px; ${borderStyle}">${idx + 1}</td>
              <td style="padding: 8px; ${borderStyle}">${exp.description}</td>
              <td style="padding: 8px; ${borderStyle}">${expenseTypes.find(t => t.value === exp.type)?.label || exp.type}</td>
              <td style="padding: 8px; ${borderStyle}">${format(parseISO(exp.date), "yyyy/MM/dd", { locale: ar })}</td>
              <td style="padding: 8px; ${borderStyle}">${paymentMethods.find(m => m.value === exp.payment_method)?.label || exp.payment_method}</td>
              <td style="padding: 8px; ${borderStyle} font-weight: bold;">${formatCurrencyLYD(exp.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background: ${companySettings?.print_table_header_color || "#a47c58"}; color: ${companySettings?.print_header_text_color || "#fff"};">
            <td colspan="5" style="padding: 10px; ${borderStyle} font-weight: bold;">${pl.total_label}</td>
            <td style="padding: 10px; ${borderStyle} font-weight: bold;">${formatCurrencyLYD(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    openPrintWindow(`${pl.title} - ${project?.name || "مشروع"}`, content, companySettings);
  };

  const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const currentPhase = projectPhases?.find((p) => p.id === activePhaseId);

  return (
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        {/* Phase Context Banner (if inside a Phase) */}
        {activePhaseId && currentPhase && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">أنت تتصفح حالياً مصروفات مرحلة:</span>
                <span className="font-bold text-foreground mr-1.5">{currentPhase.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer"
                onClick={() => navigate(`/projects/${projectId}/phases/${activePhaseId}`)}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>مساحة عمل المرحلة</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => navigate(`/projects/${projectId}/expenses`)}
              >
                <span>عرض جميع مصروفات المشروع</span>
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Coins className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {activePhaseId && currentPhase
                  ? `مصروفات ${currentPhase.name}`
                  : "مصروفات المشروع"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {activePhaseId
                  ? "المصروفات النثرية والمباشرة المخصصة لهذه المرحلة"
                  : "جميع المصروفات المباشرة للمشروع ككل"}
              </p>
            </div>
          </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={!expenses?.length}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>

          {(() => {
            const isWarningBudget = project?.budget_type === 'warning' || project?.budget_type === 'fixed';
            const budget = Number(project?.budget) || 0;
            const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
            const isBudgetExceeded = isWarningBudget && budget > 0 && totalExpenses >= budget;
            
            return (
              <Button
                disabled={isBudgetExceeded}
                onClick={() => {
                  setEditingExpense(null);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 ml-2" />
                {isBudgetExceeded ? 'تم تجاوز الميزانية' : 'إضافة مصروف'}
              </Button>
            );
          })()}

          {/* Contextual Operation Drawer Shell for Direct Expenses */}
          <ProjectOperationDrawerShell
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            projectId={projectId!}
            projectName={project?.name}
            projectType={project?.project_type || "contracting"}
            defaultTreasuryId={project?.default_treasury_id}
            activePhaseId={activePhaseId}
            initialOperationType="expense"
            editingRecord={
              editingExpense
                ? {
                    type: "expense",
                    data: editingExpense,
                  }
                : null
            }
          />
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">ملخص المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
              <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totalExpenses)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">عدد المصروفات</p>
              <p className="text-2xl font-bold">{expenses?.length || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-0">
          {expensesLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : expenses?.length === 0 ? (
            <div className="p-12 text-center">
              <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">لا توجد نثريات</h3>
              <p className="text-muted-foreground mb-4">ابدأ بإضافة مصروفات نثرية للمشروع</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوصف</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>طريقة الدفع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead className="w-[100px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses?.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        {expense.notes && (
                          <p className="text-xs text-muted-foreground">{expense.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {expenseTypes.find(t => t.value === expense.type)?.label || expense.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(expense.date), "yyyy/MM/dd", { locale: ar })}
                    </TableCell>
                    <TableCell>
                      {paymentMethods.find(m => m.value === expense.payment_method)?.label || expense.payment_method}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrencyLYD(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintExpenseReceipt(expense)}
                          title="طباعة سند صرف المصروف"
                          className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(expense.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا المصروف نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Forced Phase Selector Dialog */}
      <Dialog open={forcedPhaseSelectorOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button]:hidden" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Layers className="h-5 w-5 text-primary animate-pulse" />
              الرجاء اختيار مرحلة لعرض مصروفاتها
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              يجب اختيار مرحلة معينة لعرض وإضافة المصروفات الخاصة بها.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 pt-4">
            {!projectPhases ? (
              <div className="py-4 text-center text-muted-foreground text-sm">جاري تحميل المراحل...</div>
            ) : projectPhases.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-sm font-semibold mb-3">لا توجد مراحل مضافة لهذا المشروع بعد.</p>
                <Button 
                  onClick={() => {
                    setForcedPhaseSelectorOpen(false);
                    navigate(`/projects/${projectId}/phases`);
                  }}
                  className="w-full cursor-pointer"
                >
                  الذهاب لإنشاء مرحلة
                </Button>
              </div>
            ) : (
              <>
                {projectPhases.map((phase) => (
                  <Button
                    key={phase.id}
                    variant="outline"
                    className="w-full justify-start text-right h-12 text-sm font-semibold hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                      navigate(`/projects/${projectId}/phases/${phase.id}/expenses`);
                    }}
                  >
                    <Layers className="h-4 w-4 ml-2 text-primary shrink-0" />
                    <span>{phase.name}</span>
                  </Button>
                ))}
                
                <div className="border-t border-border my-2 pt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 h-10 text-xs cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                    }}
                  >
                    عرض كل المصروفات
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 h-10 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                      navigate(`/projects/${projectId}/phases`);
                    }}
                  >
                    العودة لصفحة المراحل
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </ProjectWorkspaceLayout>
    );
  };

export default ProjectExpenses;
