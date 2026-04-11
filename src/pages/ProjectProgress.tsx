import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, ClipboardCheck, TrendingUp, Users, Calendar, Eye } from "lucide-react";
import { TechnicianDuesDialog } from "@/components/progress/TechnicianDuesDialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface ProjectItem {
  id: string;
  name: string;
  quantity: number;
  measurement_type: string;
  progress?: number;
  project_item_technicians?: {
    id: string;
    technician_id: string;
    quantity: number;
    rate: number;
    rate_type: string;
    total_cost: number;
    technicians: {
      id: string;
      name: string;
    };
  }[];
}

interface ProgressRecord {
  id: string;
  project_item_id: string;
  technician_id: string;
  quantity_completed: number;
  date: string;
  notes: string | null;
  technicians?: {
    id: string;
    name: string;
  };
}

const measurementUnits: Record<string, string> = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const ProjectProgress = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [duesDialogOpen, setDuesDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProjectItem | null>(null);
  const [progressFormData, setProgressFormData] = useState<{
    technician_id: string;
    quantity_completed: string;
    date: string;
    notes: string;
  }>({
    technician_id: "",
    quantity_completed: "",
    date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  // Fetch project details with client
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch project items with technicians
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["project-items-progress", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select(`
          id,
          name,
          quantity,
          measurement_type,
          progress,
          project_item_technicians (
            id,
            technician_id,
            quantity,
            rate,
            rate_type,
            total_cost,
            technicians (id, name, specialty)
          )
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProjectItem[];
    },
    enabled: !!projectId,
  });

  // Fetch progress records for selected item
  const { data: progressRecords } = useQuery({
    queryKey: ["progress-records", selectedItem?.id],
    queryFn: async () => {
      if (!selectedItem?.id) return [];
      const { data, error } = await supabase
        .from("technician_progress_records")
        .select(`
          *,
          technicians (id, name, specialty)
        `)
        .eq("project_item_id", selectedItem.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as ProgressRecord[];
    },
    enabled: !!selectedItem?.id,
  });

  // Save progress record mutation
  const saveProgressMutation = useMutation({
    mutationFn: async (data: typeof progressFormData) => {
      const { error } = await supabase
        .from("technician_progress_records")
        .insert({
          project_item_id: selectedItem!.id,
          technician_id: data.technician_id,
          quantity_completed: parseFloat(data.quantity_completed) || 0,
          date: data.date,
          notes: data.notes || null,
        });
      if (error) throw error;

      // Calculate total completed for this item
      const { data: allRecords, error: recordsError } = await supabase
        .from("technician_progress_records")
        .select("quantity_completed")
        .eq("project_item_id", selectedItem!.id);
      if (recordsError) throw recordsError;

      const totalCompleted = allRecords.reduce((sum, r) => sum + Number(r.quantity_completed), 0) + parseFloat(data.quantity_completed);
      const progressPercent = Math.min(100, Math.round((totalCompleted / selectedItem!.quantity) * 100));

      // Update item progress
      const { error: updateError } = await supabase
        .from("project_items")
        .update({ progress: progressPercent })
        .eq("id", selectedItem!.id);
      if (updateError) throw updateError;

      // Update project progress (average of all items)
      await updateProjectProgress();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items-progress", projectId] });
      queryClient.invalidateQueries({ queryKey: ["progress-records", selectedItem?.id] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "تم تسجيل التقدم",
        description: "تم تسجيل إنجاز الفني بنجاح",
      });
      setProgressFormData({
        technician_id: "",
        quantity_completed: "",
        date: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تسجيل التقدم",
        variant: "destructive",
      });
    },
  });

  // Function to update project progress based on all items
  const updateProjectProgress = async () => {
    // Get all items with their progress
    const { data: allItems, error: itemsError } = await supabase
      .from("project_items")
      .select("progress, quantity")
      .eq("project_id", projectId!);
    
    if (itemsError) throw itemsError;
    
    let projectProgress = 0;
    
    if (allItems && allItems.length > 0) {
      // Calculate weighted average based on quantity
      const totalQuantity = allItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      
      if (totalQuantity > 0) {
        const weightedProgress = allItems.reduce((sum, item) => {
          const weight = Number(item.quantity || 0) / totalQuantity;
          return sum + (Number(item.progress || 0) * weight);
        }, 0);
        projectProgress = Math.round(weightedProgress);
      } else {
        // If total quantity is 0, use simple average
        projectProgress = Math.round(
          allItems.reduce((sum, item) => sum + Number(item.progress || 0), 0) / allItems.length
        );
      }
    }
    // If no items, projectProgress remains 0
    
    // Update project progress
    const { error: updateError } = await supabase
      .from("projects")
      .update({ progress: projectProgress })
      .eq("id", projectId!);
    
    if (updateError) throw updateError;
  };

  // Delete progress record mutation
  const deleteProgressMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from("technician_progress_records")
        .delete()
        .eq("id", recordId);
      if (error) throw error;

      // Recalculate progress
      const { data: remainingRecords, error: recordsError } = await supabase
        .from("technician_progress_records")
        .select("quantity_completed")
        .eq("project_item_id", selectedItem!.id);
      if (recordsError) throw recordsError;

      const totalCompleted = remainingRecords.reduce((sum, r) => sum + Number(r.quantity_completed), 0);
      const progressPercent = selectedItem!.quantity > 0 
        ? Math.min(100, Math.round((totalCompleted / selectedItem!.quantity) * 100))
        : 0;

      const { error: updateError } = await supabase
        .from("project_items")
        .update({ progress: progressPercent })
        .eq("id", selectedItem!.id);
      if (updateError) throw updateError;

      // Update project progress (average of all items)
      await updateProjectProgress();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-items-progress", projectId] });
      queryClient.invalidateQueries({ queryKey: ["progress-records", selectedItem?.id] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast({
        title: "تم الحذف",
        description: "تم حذف سجل التقدم بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف السجل",
        variant: "destructive",
      });
    },
  });

  const handleOpenProgressDialog = (item: ProjectItem) => {
    setSelectedItem(item);
    setProgressDialogOpen(true);
  };

  const handleOpenDuesDialog = (item: ProjectItem) => {
    setSelectedItem(item);
    setDuesDialogOpen(true);
  };

  const handleSaveProgress = () => {
    if (!progressFormData.technician_id) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الفني",
        variant: "destructive",
      });
      return;
    }
    if (!progressFormData.quantity_completed || parseFloat(progressFormData.quantity_completed) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال الكمية المنجزة",
        variant: "destructive",
      });
      return;
    }
    saveProgressMutation.mutate(progressFormData);
  };

  // Calculate totals
  const totalItems = items?.length || 0;
  const totalQuantity = items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const averageProgress = totalItems > 0 
    ? Math.round(items!.reduce((sum, item) => sum + (item.progress || 0), 0) / totalItems)
    : 0;

  // Get technician progress summary per item
  const getTechnicianProgress = (itemId: string) => {
    if (!progressRecords) return {};
    const itemRecords = progressRecords.filter(r => r.project_item_id === itemId);
    const summary: Record<string, number> = {};
    itemRecords.forEach(r => {
      summary[r.technician_id] = (summary[r.technician_id] || 0) + r.quantity_completed;
    });
    return summary;
  };

  if (projectLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">المشروع غير موجود</p>
        <Link to="/projects">
          <Button variant="link">العودة للمشاريع</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">تقدم بنود المشروع</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{project.name}</span>
            {(project as any).clients && (
              <>
                <span>•</span>
                <Link 
                  to={`/projects/client/${(project as any).clients.id}`}
                  className="text-primary hover:underline"
                >
                  {(project as any).clients.name}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد البنود</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">متوسط التقدم</p>
                <p className="text-2xl font-bold">{averageProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العناصر المكتملة</p>
                <p className="text-2xl font-bold">
                  {items?.filter(i => (i.progress || 0) >= 100).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                <p className="text-2xl font-bold">
                  {items?.filter(i => (i.progress || 0) > 0 && (i.progress || 0) < 100).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle>عناصر المشروع</CardTitle>
        </CardHeader>
        <CardContent>
          {items && items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العنصر</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">الفنيين</TableHead>
                  <TableHead className="text-right">التقدم</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const progress = item.progress || 0;
                  const technicians = item.project_item_technicians || [];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        {item.quantity.toLocaleString()} {measurementUnits[item.measurement_type] || ""}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {technicians.length > 0 ? (
                            technicians.map((t) => (
                              <Badge key={t.id} variant="outline" className="text-xs">
                                {t.technicians?.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">لا يوجد فنيين</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <Progress value={progress} className="flex-1" />
                          <span className="text-sm font-medium w-12 text-left">
                            {progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDuesDialog(item)}
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            التفاصيل
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenProgressDialog(item)}
                            disabled={technicians.length === 0}
                          >
                            <Plus className="h-4 w-4 ml-1" />
                            تسجيل إنجاز
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد عناصر في هذا المشروع</p>
              <Link to={`/projects/${projectId}/items`}>
                <Button variant="link">إضافة عناصر</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Dialog */}
      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل إنجاز - {selectedItem?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Progress */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">التقدم الحالي</span>
                <span className="text-sm font-bold">{selectedItem?.progress || 0}%</span>
              </div>
              <Progress value={selectedItem?.progress || 0} />
              <p className="text-xs text-muted-foreground mt-2">
                الكمية الإجمالية: {selectedItem?.quantity.toLocaleString()} {measurementUnits[selectedItem?.measurement_type || "linear"]}
              </p>
            </div>

            {/* Add Progress Form */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">تسجيل إنجاز جديد</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفني</Label>
                  <select
                    className="w-full p-2 border rounded-md bg-background"
                    value={progressFormData.technician_id}
                    onChange={(e) =>
                      setProgressFormData({ ...progressFormData, technician_id: e.target.value })
                    }
                  >
                    <option value="">اختر الفني</option>
                    {selectedItem?.project_item_technicians?.map((t) => (
                      <option key={t.technician_id} value={t.technician_id}>
                        {t.technicians?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>الكمية المنجزة</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={progressFormData.quantity_completed}
                    onChange={(e) =>
                      setProgressFormData({ ...progressFormData, quantity_completed: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={progressFormData.date}
                    onChange={(e) =>
                      setProgressFormData({ ...progressFormData, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input
                    placeholder="ملاحظات اختيارية"
                    value={progressFormData.notes}
                    onChange={(e) =>
                      setProgressFormData({ ...progressFormData, notes: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button onClick={handleSaveProgress} disabled={saveProgressMutation.isPending}>
                {saveProgressMutation.isPending ? "جاري الحفظ..." : "تسجيل الإنجاز"}
              </Button>
            </div>

            {/* Progress Records */}
            <div className="space-y-2">
              <h3 className="font-semibold">سجل الإنجازات</h3>
              {progressRecords && progressRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الفني</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                      <TableHead className="text-right">حذف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {progressRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.technicians?.name}</TableCell>
                        <TableCell>
                          {record.quantity_completed.toLocaleString()} {measurementUnits[selectedItem?.measurement_type || "linear"]}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.date), "yyyy/MM/dd", { locale: ar })}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {record.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                حذف
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من حذف سجل التقدم هذا؟ سيؤثر ذلك على نسبة إنجاز البند.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteProgressMutation.mutate(record.id)}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">
                  لا توجد إنجازات مسجلة
                </p>
              )}
            </div>

            {/* Technician Summary */}
            {selectedItem?.project_item_technicians && selectedItem.project_item_technicians.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">ملخص إنجازات الفنيين</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedItem.project_item_technicians.map((tech) => {
                    const completed = progressRecords
                      ?.filter((r) => r.technician_id === tech.technician_id)
                      .reduce((sum, r) => sum + r.quantity_completed, 0) || 0;
                    const assigned = tech.quantity || 0;
                    const percent = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
                    return (
                      <div key={tech.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{tech.technicians?.name}</span>
                          <Badge variant={percent >= 100 ? "default" : "secondary"}>
                            {percent}%
                          </Badge>
                        </div>
                        <Progress value={Math.min(100, percent)} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {completed.toLocaleString()} / {assigned.toLocaleString()} {measurementUnits[selectedItem.measurement_type]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Technician Dues Dialog */}
      <TechnicianDuesDialog
        open={duesDialogOpen}
        onOpenChange={setDuesDialogOpen}
        item={selectedItem}
        projectName={project?.name}
      />
    </div>
  );
};

export default ProjectProgress;
