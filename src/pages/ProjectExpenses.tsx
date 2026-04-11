import { useState } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, useNavigate, Link } from "react-router-dom";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { Plus, ArrowRight, Pencil, Trash2, Coins, Printer } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { openPrintWindow } from "@/lib/printStyles";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  // Fetch project expenses (مصروفات only)
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["project-expenses", projectId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("*")
        .eq("project_id", projectId)
        .eq("subtype", "مصروفات")
        .order("date", { ascending: false });
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("expenses")
        .insert({
          project_id: projectId,
          phase_id: phaseId || null,
          description: data.description,
          amount: parseFloat(data.amount),
          type: data.type,
          subtype: "مصروفات",
          payment_method: data.payment_method,
          date: data.date,
          notes: data.notes || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
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

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      type: "other",
      subtype: "مصروفات",
      payment_method: "cash",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setEditingExpense(null);
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      type: expense.type,
      subtype: "مصروفات",
      payment_method: expense.payment_method,
      date: expense.date,
      notes: expense.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExpense) {
      updateMutation.mutate({ ...formData, id: editingExpense.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePrint = () => {
    if (!expenses || expenses.length === 0) {
      toast({ title: "لا توجد مصروفات للطباعة", variant: "destructive" });
      return;
    }

    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const pl = getElementLabels(companySettings?.print_labels, "expenses");

    const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">${pl.title}</h1>
        <h2 style="margin: 10px 0; font-size: 18px; color: #666;">${project?.name || ""}</h2>
        ${project?.clients?.name ? `<p style="margin: 5px 0; color: #888;">العميل: ${project.clients.name}</p>` : ""}
        <p style="margin: 5px 0; color: #888;">التاريخ: ${format(new Date(), "yyyy/MM/dd", { locale: ar })}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: ${companySettings?.print_table_header_color || "#a47c58"}; color: ${companySettings?.print_header_text_color || "#fff"};">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">${pl.col_number}</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">${pl.col_description}</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">${pl.col_type}</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">${pl.col_date}</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">${pl.col_payment_method}</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">${pl.col_amount}</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((exp, idx) => `
            <tr style="background: ${idx % 2 === 0 ? companySettings?.print_table_row_even_color || "#f9f9f9" : companySettings?.print_table_row_odd_color || "#fff"};">
              <td style="padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${exp.description}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${expenseTypes.find(t => t.value === exp.type)?.label || exp.type}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${format(parseISO(exp.date), "yyyy/MM/dd", { locale: ar })}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${paymentMethods.find(m => m.value === exp.payment_method)?.label || exp.payment_method}</td>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyLYD(exp.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background: ${companySettings?.print_table_header_color || "#a47c58"}; color: ${companySettings?.print_header_text_color || "#fff"};">
            <td colspan="5" style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${pl.total_label}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyLYD(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    openPrintWindow(content, `${pl.title} - ${project?.name || "مشروع"}`, companySettings);
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

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مصروفات المشروع</h1>
            <p className="text-sm text-muted-foreground">
              {project?.name}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={!expenses?.length}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            {(() => {
              const isWarningBudget = project?.budget_type === 'warning' || project?.budget_type === 'fixed';
              const budget = Number(project?.budget) || 0;
              const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
              const isBudgetExceeded = isWarningBudget && budget > 0 && totalExpenses >= budget;
              
              return (
                <DialogTrigger asChild>
                  <Button disabled={isBudgetExceeded}>
                    <Plus className="h-4 w-4 ml-2" />
                    {isBudgetExceeded ? 'تم تجاوز الميزانية' : 'إضافة مصروف'}
                  </Button>
                </DialogTrigger>
              );
            })()}
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? "تعديل المصروف" : "إضافة مصروف جديد"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف *</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">المبلغ *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">التاريخ *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>النوع</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>طريقة الدفع</Label>
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value: any) => setFormData({ ...formData, payment_method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingExpense ? "تحديث" : "إضافة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
                      <div className="flex gap-1">
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
    </div>
  );
};

export default ProjectExpenses;
