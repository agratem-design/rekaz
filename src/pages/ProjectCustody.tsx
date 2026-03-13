import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Plus, ArrowRight, Wallet, TrendingDown, TrendingUp, User, HardHat, Edit, Trash2 } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface CustodyRecord {
  id: string;
  project_id: string;
  holder_type: "engineer" | "employee";
  engineer_id: string | null;
  employee_id: string | null;
  amount: number;
  spent_amount: number;
  remaining_amount: number;
  date: string;
  status: string;
  notes: string | null;
  engineer?: { id: string; name: string } | null;
  employee?: { id: string; name: string } | null;
}

export default function ProjectCustody() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustodyRecord | null>(null);
  const [formData, setFormData] = useState({
    holder_type: "engineer" as "engineer" | "employee",
    engineer_id: "",
    employee_id: "",
    amount: "",
    spent_amount: "",
    date: new Date().toISOString().split("T")[0],
    status: "active",
    notes: "",
  });

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name)")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch custody records
  const { data: custodyRecords = [], isLoading } = useQuery({
    queryKey: ["project-custody", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_custody")
        .select(`
          *,
          engineer:engineers(id, name),
          employee:employees(id, name)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustodyRecord[];
    },
  });

  // Fetch engineers
  const { data: engineers = [] } = useQuery({
    queryKey: ["engineers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("project_custody").insert({
        project_id: projectId,
        holder_type: data.holder_type,
        engineer_id: data.holder_type === "engineer" ? data.engineer_id : null,
        employee_id: data.holder_type === "employee" ? data.employee_id : null,
        amount: parseFloat(data.amount),
        spent_amount: parseFloat(data.spent_amount) || 0,
        date: data.date,
        status: data.status,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-custody", projectId] });
      toast.success("تم إضافة العهدة بنجاح");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => toast.error("فشل في إضافة العهدة"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("project_custody")
        .update({
          holder_type: data.holder_type,
          engineer_id: data.holder_type === "engineer" ? data.engineer_id : null,
          employee_id: data.holder_type === "employee" ? data.employee_id : null,
          amount: parseFloat(data.amount),
          spent_amount: parseFloat(data.spent_amount) || 0,
          date: data.date,
          status: data.status,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-custody", projectId] });
      toast.success("تم تحديث العهدة بنجاح");
      resetForm();
      setIsDialogOpen(false);
      setEditingRecord(null);
    },
    onError: () => toast.error("فشل في تحديث العهدة"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_custody").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-custody", projectId] });
      toast.success("تم حذف العهدة");
    },
    onError: () => toast.error("فشل في حذف العهدة"),
  });

  const resetForm = () => {
    setFormData({
      holder_type: "engineer",
      engineer_id: "",
      employee_id: "",
      amount: "",
      spent_amount: "",
      date: new Date().toISOString().split("T")[0],
      status: "active",
      notes: "",
    });
  };

  const handleEdit = (record: CustodyRecord) => {
    setEditingRecord(record);
    setFormData({
      holder_type: record.holder_type,
      engineer_id: record.engineer_id || "",
      employee_id: record.employee_id || "",
      amount: record.amount.toString(),
      spent_amount: record.spent_amount.toString(),
      date: record.date,
      status: record.status,
      notes: record.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (formData.holder_type === "engineer" && !formData.engineer_id) {
      toast.error("يرجى اختيار المهندس");
      return;
    }
    if (formData.holder_type === "employee" && !formData.employee_id) {
      toast.error("يرجى اختيار الموظف");
      return;
    }
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  // Stats
  const totalCustody = custodyRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalSpent = custodyRecords.reduce((sum, r) => sum + r.spent_amount, 0);
  const totalRemaining = custodyRecords.reduce((sum, r) => sum + r.remaining_amount, 0);
  const activeCount = custodyRecords.filter((r) => r.status === "active").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">نشطة</Badge>;
      case "closed":
        return <Badge variant="secondary">مغلقة</Badge>;
      case "settled":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">مسوّاة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">عهد المشروع</h1>
            <p className="text-muted-foreground">
              {project?.name}
              {(project as any)?.clients?.name && (
                <>
                  {" - "}
                  <Link 
                    to={`/projects/client/${project?.client_id}`}
                    className="text-primary hover:underline"
                  >
                    {(project as any).clients.name}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingRecord(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              إضافة عهدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRecord ? "تعديل العهدة" : "إضافة عهدة جديدة"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>نوع المستلم</Label>
                <Select
                  value={formData.holder_type}
                  onValueChange={(value: "engineer" | "employee") =>
                    setFormData({ ...formData, holder_type: value, engineer_id: "", employee_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineer">مهندس</SelectItem>
                    <SelectItem value="employee">موظف</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.holder_type === "engineer" ? (
                <div className="space-y-2">
                  <Label>المهندس *</Label>
                  <Select
                    value={formData.engineer_id}
                    onValueChange={(value) => setFormData({ ...formData, engineer_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المهندس" />
                    </SelectTrigger>
                    <SelectContent>
                      {engineers.map((eng) => (
                        <SelectItem key={eng.id} value={eng.id}>
                          {eng.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>الموظف *</Label>
                  <Select
                    value={formData.employee_id}
                    onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المبلغ *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="مبلغ العهدة"
                  />
                </div>
                <div className="space-y-2">
                  <Label>المصروف</Label>
                  <Input
                    type="number"
                    value={formData.spent_amount}
                    onChange={(e) => setFormData({ ...formData, spent_amount: e.target.value })}
                    placeholder="المبلغ المصروف"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">نشطة</SelectItem>
                      <SelectItem value="closed">مغلقة</SelectItem>
                      <SelectItem value="settled">مسوّاة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات إضافية"
                />
              </div>

              <Button type="submit" className="w-full" disabled={addMutation.isPending || updateMutation.isPending}>
                {editingRecord ? "تحديث" : "إضافة"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العهد</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(totalCustody)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المصروف</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المتبقي</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(totalRemaining)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Wallet className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العهد النشطة</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custody Records */}
      {custodyRecords.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد عهد</h3>
          <p className="text-muted-foreground mb-4">ابدأ بإضافة عهدة للمشروع</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة عهدة
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {custodyRecords.map((record) => {
            const spentPercentage = record.amount > 0 ? (record.spent_amount / record.amount) * 100 : 0;
            const holderName = record.holder_type === "engineer" 
              ? record.engineer?.name 
              : record.employee?.name;
            
            return (
              <Card key={record.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {record.holder_type === "engineer" ? (
                        <HardHat className="h-5 w-5 text-orange-500" />
                      ) : (
                        <User className="h-5 w-5 text-blue-500" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{holderName}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {record.holder_type === "engineer" ? "مهندس" : "موظف"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(record.status)}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">المبلغ</p>
                      <p className="font-semibold">{formatCurrencyLYD(record.amount)}</p>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">المصروف</p>
                      <p className="font-semibold text-red-600">{formatCurrencyLYD(record.spent_amount)}</p>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">المتبقي</p>
                      <p className="font-semibold text-green-600">{formatCurrencyLYD(record.remaining_amount)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">نسبة الصرف</span>
                      <span>{spentPercentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={spentPercentage} className="h-2" />
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {format(new Date(record.date), "dd MMMM yyyy", { locale: ar })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
