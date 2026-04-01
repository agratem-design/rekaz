import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  Plus,
  Wallet,
  TrendingDown,
  TrendingUp,
  User,
  HardHat,
  Edit,
  Trash2,
  Search,
  Building2,
  FolderOpen,
  Eye,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface CustodyRecord {
  id: string;
  project_id: string | null;
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
  project?: { id: string; name: string; client_id: string | null; clients?: { id: string; name: string } | null } | null;
}

export default function Custody() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustodyRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [holderFilter, setHolderFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    holder_type: "engineer" as "engineer" | "employee",
    engineer_id: "",
    employee_id: "",
    project_id: "",
    amount: "",
    spent_amount: "",
    date: new Date().toISOString().split("T")[0],
    status: "active",
    notes: "",
  });

  // Fetch all custody records
  const { data: custodyRecords = [], isLoading } = useQuery({
    queryKey: ["all-custody"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_custody")
        .select(`
          *,
          engineer:engineers(id, name),
          employee:employees(id, name),
          project:projects(id, name, client_id, clients:client_id(id, name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustodyRecord[];
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
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
        project_id: data.project_id || null,
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
      queryClient.invalidateQueries({ queryKey: ["all-custody"] });
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
          project_id: data.project_id || null,
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
      queryClient.invalidateQueries({ queryKey: ["all-custody"] });
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
      queryClient.invalidateQueries({ queryKey: ["all-custody"] });
      toast.success("تم حذف العهدة");
    },
    onError: () => toast.error("فشل في حذف العهدة"),
  });

  const resetForm = () => {
    setFormData({
      holder_type: "engineer",
      engineer_id: "",
      employee_id: "",
      project_id: "",
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
      project_id: record.project_id || "",
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

  // Filter records
  const filteredRecords = custodyRecords.filter((record) => {
    const holderName = record.holder_type === "engineer" 
      ? record.engineer?.name 
      : record.employee?.name;
    const projectName = record.project?.name || "";
    const clientName = record.project?.clients?.name || "";
    
    const matchesSearch = 
      holderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    const matchesHolder = holderFilter === "all" || record.holder_type === holderFilter;
    
    return matchesSearch && matchesStatus && matchesHolder;
  });

  // Stats
  const totalCustody = filteredRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalSpent = filteredRecords.reduce((sum, r) => sum + r.spent_amount, 0);
  const totalRemaining = filteredRecords.reduce((sum, r) => sum + r.remaining_amount, 0);
  const activeCount = filteredRecords.filter((r) => r.status === "active").length;

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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">العهد المالية</h1>
          <p className="text-muted-foreground">إدارة جميع العهد المالية للمشاريع</p>
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
                <Label>المشروع</Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المشروع (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون مشروع</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو المشروع أو العميل..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="active">نشطة</SelectItem>
            <SelectItem value="closed">مغلقة</SelectItem>
            <SelectItem value="settled">مسوّاة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={holderFilter} onValueChange={setHolderFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="نوع المستلم" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="engineer">مهندس</SelectItem>
            <SelectItem value="employee">موظف</SelectItem>
          </SelectContent>
        </Select>
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
                <FolderOpen className="h-5 w-5 text-blue-500" />
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
      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد عهد</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" || holderFilter !== "all"
                ? "لا توجد نتائج تطابق البحث"
                : "ابدأ بإضافة عهدة جديدة"}
            </p>
            {!searchTerm && statusFilter === "all" && holderFilter === "all" && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة عهدة
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRecords.map((record) => {
            const holderName = record.holder_type === "engineer" 
              ? record.engineer?.name 
              : record.employee?.name;
            const spentPercent = record.amount > 0 
              ? Math.min((record.spent_amount / record.amount) * 100, 100) 
              : 0;

            return (
              <Card key={record.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Holder Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className={`p-2 rounded-full ${
                        record.holder_type === "engineer" 
                          ? "bg-blue-500/10" 
                          : "bg-orange-500/10"
                      }`}>
                        {record.holder_type === "engineer" ? (
                          <HardHat className={`h-5 w-5 text-blue-500`} />
                        ) : (
                          <User className={`h-5 w-5 text-orange-500`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{holderName || "غير محدد"}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.holder_type === "engineer" ? "مهندس" : "موظف"}
                        </p>
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {record.project ? (
                        <Link 
                          to={`/projects/${record.project.id}/custody`}
                          className="text-sm text-primary hover:underline"
                        >
                          {record.project.name}
                          {record.project.clients?.name && (
                            <span className="text-muted-foreground">
                              {" "}({record.project.clients.name})
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">بدون مشروع</span>
                      )}
                    </div>

                    {/* Status & Date */}
                    <div className="flex items-center gap-4">
                      {getStatusBadge(record.status)}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(record.date), "d MMMM yyyy", { locale: ar })}
                      </span>
                    </div>

                    {/* Amounts */}
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>المصروف: {formatCurrencyLYD(record.spent_amount)}</span>
                        <span>من {formatCurrencyLYD(record.amount)}</span>
                      </div>
                      <Progress value={spentPercent} className="h-2" />
                      <p className="text-sm text-muted-foreground">
                        المتبقي: {formatCurrencyLYD(record.remaining_amount)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/custody/${record.id}`)}
                        title="عرض التفاصيل"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                            <AlertDialogDescription>هل أنت متأكد من حذف هذه العهدة؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(record.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
