import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  User,
  Phone,
  Mail,
  Award,
  FolderKanban,
  FileText,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const engineerTypes: Record<string, string> = {
  civil: "مهندس مدني",
  architectural: "مهندس معماري",
  structural: "مهندس إنشائي",
  electrical: "مهندس كهربائي",
  mechanical: "مهندس ميكانيكي",
  surveying: "مهندس مساحة",
  geotechnical: "مهندس جيوتقني",
  project_manager: "مدير مشروع",
  other: "أخرى",
};

const statusLabels: Record<string, string> = {
  active: "نشط",
  pending: "معلق",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-500",
  pending: "bg-yellow-500/20 text-yellow-500",
  completed: "bg-blue-500/20 text-blue-500",
  cancelled: "bg-red-500/20 text-red-500",
};

const EngineerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    engineer_type: "",
    specialty: "",
    phone: "",
    email: "",
    license_number: "",
    notes: "",
  });

  // Fetch engineer data
  const { data: engineer, isLoading: loadingEngineer } = useQuery({
    queryKey: ["engineer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch supervised projects
  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ["engineer-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(name)")
        .eq("supervising_engineer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (loadingEngineer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("engineers")
        .update({
          name: data.name,
          engineer_type: data.engineer_type,
          specialty: data.specialty || null,
          phone: data.phone || null,
          email: data.email || null,
          license_number: data.license_number || null,
          notes: data.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineer", id] });
      setEditDialogOpen(false);
      toast({ title: "تم تحديث بيانات المهندس بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء التحديث", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // FK cleanup: SET NULL on referencing tables
      await supabase.from("projects").update({ supervising_engineer_id: null }).eq("supervising_engineer_id", id);
      await supabase.from("project_items").update({ engineer_id: null }).eq("engineer_id", id);
      await supabase.from("project_custody").update({ engineer_id: null }).eq("engineer_id", id);
      
      const { error } = await supabase
        .from("engineers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineers"] });
      toast({ title: "تم حذف المهندس بنجاح" });
      navigate("/engineers");
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء الحذف. قد يكون المهندس مرتبطاً بمشاريع.", variant: "destructive" });
    },
  });

  const openEditDialog = () => {
    if (engineer) {
      setFormData({
        name: engineer.name || "",
        engineer_type: engineer.engineer_type || "civil",
        specialty: engineer.specialty || "",
        phone: engineer.phone || "",
        email: engineer.email || "",
        license_number: engineer.license_number || "",
        notes: engineer.notes || "",
      });
      setEditDialogOpen(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "يرجى إدخال اسم المهندس", variant: "destructive" });
      return;
    }
    updateMutation.mutate(formData);
  };

  if (!engineer) {
    return (
      <div className="text-center py-20" dir="rtl">
        <h2 className="text-2xl font-bold">المهندس غير موجود</h2>
        <Link to="/engineers">
          <Button className="mt-4">العودة لقائمة المهندسين</Button>
      </Link>
      </div>
    );
  }

  const activeProjects = projects?.filter((p) => p.status === "active").length || 0;
  const completedProjects = projects?.filter((p) => p.status === "completed").length || 0;
  const totalBudget = projects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/engineers">
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{engineer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {engineerTypes[engineer.engineer_type] || engineer.engineer_type}
              </Badge>
              {engineer.specialty && (
                <Badge variant="outline">{engineer.specialty}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openEditDialog}>
                <Pencil className="h-4 w-4 ml-2" />
                تعديل
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل بيانات المهندس</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="اسم المهندس"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engineer_type">نوع المهندس</Label>
                <Select
                  value={formData.engineer_type}
                  onValueChange={(value) => setFormData({ ...formData, engineer_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع المهندس" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(engineerTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty">التخصص</Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="تخصص المهندس"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">الهاتف</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="رقم الهاتف"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="البريد الإلكتروني"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_number">رقم الترخيص</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="رقم ترخيص المهندس"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات إضافية"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                  {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 ml-2" />
                حذف
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد من حذف المهندس؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حذف المهندس "{engineer.name}" نهائياً. لا يمكن التراجع عن هذا الإجراء.
                  {projects && projects.length > 0 && (
                    <span className="block mt-2 text-destructive font-medium">
                      تحذير: هذا المهندس مشرف على {projects.length} مشروع/مشاريع.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المشاريع</p>
                <p className="text-2xl font-bold">{projects?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <FolderKanban className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مشاريع نشطة</p>
                <p className="text-2xl font-bold">{activeProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FolderKanban className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مشاريع مكتملة</p>
                <p className="text-2xl font-bold">{completedProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/50 rounded-lg">
                <Award className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الميزانيات</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(totalBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              معلومات الاتصال
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {engineer.phone && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الهاتف</p>
                  <p className="font-medium" dir="ltr">{engineer.phone}</p>
                </div>
              </div>
            )}
            {engineer.email && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                  <p className="font-medium">{engineer.email}</p>
                </div>
              </div>
            )}
            {engineer.license_number && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم الترخيص</p>
                  <p className="font-medium">{engineer.license_number}</p>
                </div>
              </div>
            )}
            {engineer.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm">{engineer.notes}</p>
              </div>
            )}
            {!engineer.phone && !engineer.email && !engineer.license_number && !engineer.notes && (
              <p className="text-muted-foreground text-sm">لا توجد معلومات اتصال</p>
            )}
          </CardContent>
        </Card>

        {/* Projects List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              المشاريع المشرف عليها ({projects?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}/items`}>
                    <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{project.name}</h4>
                            <Badge className={statusColors[project.status]} variant="outline">
                              {statusLabels[project.status]}
                            </Badge>
                          </div>
                          {project.clients?.name && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {project.clients.name}
                            </p>
                          )}
                          {project.location && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {project.location}
                            </p>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-sm text-muted-foreground">الميزانية</p>
                          <p className="font-semibold">{formatCurrencyLYD(project.budget)}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">التقدم</span>
                          <span className="font-medium">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد مشاريع مشرف عليها</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EngineerDetail;
