import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, User, Phone, Mail, Award, Search, FolderKanban, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface Engineer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  engineer_type: string;
  specialty: string | null;
  license_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const engineerTypes = [
  { value: "civil", label: "مهندس مدني" },
  { value: "architectural", label: "مهندس معماري" },
  { value: "structural", label: "مهندس إنشائي" },
  { value: "electrical", label: "مهندس كهربائي" },
  { value: "mechanical", label: "مهندس ميكانيكي" },
  { value: "surveying", label: "مهندس مساحة" },
  { value: "geotechnical", label: "مهندس جيوتقني" },
  { value: "project_manager", label: "مدير مشروع" },
  { value: "other", label: "أخرى" },
];

const Engineers = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState<Engineer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    engineer_type: "civil",
    specialty: "",
    license_number: "",
    notes: "",
  });

  // Fetch engineers
  const { data: engineers, isLoading } = useQuery({
    queryKey: ["engineers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Engineer[];
    },
  });

  // Fetch projects with supervising engineers
  const { data: projects } = useQuery({
    queryKey: ["projects-with-supervisors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, supervising_engineer_id")
        .not("supervising_engineer_id", "is", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Group projects by engineer
  const projectsByEngineer = projects?.reduce((acc, project) => {
    const engineerId = project.supervising_engineer_id;
    if (engineerId) {
      if (!acc[engineerId]) {
        acc[engineerId] = [];
      }
      acc[engineerId].push(project);
    }
    return acc;
  }, {} as Record<string, typeof projects>);

  // Add/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        engineer_type: data.engineer_type,
        specialty: data.specialty || null,
        license_number: data.license_number || null,
        notes: data.notes || null,
      };

      if (editingEngineer) {
        const { error } = await supabase
          .from("engineers")
          .update(payload)
          .eq("id", editingEngineer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("engineers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineers"] });
      toast({
        title: editingEngineer ? "تم تحديث المهندس" : "تم إضافة المهندس",
        description: editingEngineer
          ? "تم تحديث بيانات المهندس بنجاح"
          : "تم إضافة المهندس بنجاح",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (engineerId: string) => {
      // SET NULL on referencing tables before delete
      await supabase.from("projects").update({ supervising_engineer_id: null }).eq("supervising_engineer_id", engineerId);
      await supabase.from("project_items").update({ engineer_id: null }).eq("engineer_id", engineerId);
      await supabase.from("project_custody").update({ engineer_id: null }).eq("engineer_id", engineerId);

      const { error } = await supabase
        .from("engineers")
        .delete()
        .eq("id", engineerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineers"] });
      toast({
        title: "تم حذف المهندس",
        description: "تم حذف المهندس بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المهندس",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEngineer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      engineer_type: "civil",
      specialty: "",
      license_number: "",
      notes: "",
    });
  };

  const handleEdit = (engineer: Engineer) => {
    setEditingEngineer(engineer);
    setFormData({
      name: engineer.name,
      phone: engineer.phone || "",
      email: engineer.email || "",
      engineer_type: engineer.engineer_type,
      specialty: engineer.specialty || "",
      license_number: engineer.license_number || "",
      notes: engineer.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم المهندس",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getEngineerTypeLabel = (type: string) => {
    return engineerTypes.find((t) => t.value === type)?.label || type;
  };

  const filteredEngineers = engineers?.filter((engineer) => {
    const matchesSearch =
      engineer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      engineer.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      engineer.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === "all" || engineer.engineer_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Group by type
  const groupedEngineers = filteredEngineers?.reduce((acc, engineer) => {
    const type = engineer.engineer_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(engineer);
    return acc;
  }, {} as Record<string, Engineer[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المهندسون</h1>
          <p className="text-muted-foreground">إدارة المهندسين والمشرفين على المشاريع</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة مهندس
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المهندسين..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="جميع التخصصات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع التخصصات</SelectItem>
            {engineerTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المهندسين</p>
                <p className="text-2xl font-bold">{engineers?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {engineerTypes.slice(0, 3).map((type) => (
          <Card key={type.value}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/50 rounded-lg">
                  <Award className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{type.label}</p>
                  <p className="text-2xl font-bold">
                    {engineers?.filter((e) => e.engineer_type === type.value).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engineers by Type */}
      {groupedEngineers && Object.keys(groupedEngineers).length > 0 ? (
        Object.entries(groupedEngineers).map(([type, typeEngineers]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {getEngineerTypeLabel(type)} ({typeEngineers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">التخصص</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">المشاريع المشرف عليها</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeEngineers.map((engineer) => (
                    <TableRow key={engineer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{engineer.name}</p>
                            {engineer.notes && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {engineer.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {engineer.specialty ? (
                          <Badge variant="secondary">{engineer.specialty}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {engineer.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{engineer.phone}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {projectsByEngineer?.[engineer.id]?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {projectsByEngineer[engineer.id].map((project) => (
                              <Link key={project.id} to={`/projects/${project.id}/items`}>
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                                >
                                  <FolderKanban className="h-3 w-3 ml-1" />
                                  {project.name}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">لا توجد مشاريع</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link to={`/engineers/${engineer.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(engineer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من حذف هذا المهندس؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(engineer.id)}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا يوجد مهندسون</p>
              <p className="text-sm">اضغط على "إضافة مهندس" لبدء إضافة المهندسين</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingEngineer ? "تعديل بيانات المهندس" : "إضافة مهندس جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label>نوع المهندس</Label>
              <Select
                value={formData.engineer_type}
                onValueChange={(value) => setFormData({ ...formData, engineer_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {engineerTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">التخصص الفرعي</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="مثال: خرسانة مسلحة"
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
                <Label htmlFor="license_number">رقم الترخيص</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="رقم الترخيص"
                />
              </div>
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
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جاري الحفظ..." : editingEngineer ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Engineers;
