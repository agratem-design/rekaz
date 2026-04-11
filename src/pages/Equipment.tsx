import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { 
  Plus, Pencil, Trash2, Wrench, AlertTriangle, CheckCircle, XCircle, 
  ImageIcon, Eye, LayoutGrid, List, Package, PackageCheck, PackageX, 
  Boxes, DollarSign
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/ui/image-uploader";

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number;
  current_condition: string;
  daily_rental_rate: number;
  notes: string | null;
  image_url: string | null;
  total_quantity: number;
  available_quantity: number;
  created_at: string;
}

interface EquipmentFormData {
  name: string;
  description: string;
  category: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: number;
  current_condition: string;
  daily_rental_rate: number;
  notes: string;
  image_url: string;
  total_quantity: number;
}

const conditionOptions = [
  { value: "good", label: "جيدة", icon: CheckCircle, color: "text-green-500" },
  { value: "fair", label: "متوسطة", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "damaged", label: "متضررة", icon: XCircle, color: "text-red-500" },
  { value: "out_of_service", label: "خارج الخدمة", icon: Wrench, color: "text-muted-foreground" },
];

const Equipment = () => {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: "",
    description: "",
    category: "",
    serial_number: "",
    purchase_date: "",
    purchase_price: 0,
    current_condition: "good",
    daily_rental_rate: 0,
    notes: "",
    image_url: "",
    total_quantity: 1,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Equipment[];
    },
  });

  // Get rental counts for each equipment
  const { data: rentalCounts = [] } = useQuery({
    queryKey: ["equipment-rental-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select("equipment_id")
        .eq("status", "active");
      if (error) throw error;
      
      // Count rentals per equipment
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        counts[r.equipment_id] = (counts[r.equipment_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Calculate available quantity for each equipment
  const equipmentWithAvailability = useMemo(() => {
    return equipment.map((eq) => {
      const rentedCount = (rentalCounts as Record<string, number>)[eq.id] || 0;
      const available = Math.max(0, eq.total_quantity - rentedCount);
      return {
        ...eq,
        available_quantity: available,
        rented_count: rentedCount,
      };
    });
  }, [equipment, rentalCounts]);

  // Summary calculations
  const summary = useMemo(() => {
    const total = equipmentWithAvailability.length;
    const totalQuantity = equipmentWithAvailability.reduce((sum, eq) => sum + eq.total_quantity, 0);
    const totalAvailable = equipmentWithAvailability.reduce((sum, eq) => sum + eq.available_quantity, 0);
    const totalRented = totalQuantity - totalAvailable;
    const totalValue = equipmentWithAvailability.reduce((sum, eq) => sum + (eq.purchase_price * eq.total_quantity), 0);
    const fullyRented = equipmentWithAvailability.filter(eq => eq.available_quantity === 0).length;
    const partiallyRented = equipmentWithAvailability.filter(eq => eq.available_quantity > 0 && eq.available_quantity < eq.total_quantity).length;
    const fullyAvailable = equipmentWithAvailability.filter(eq => eq.available_quantity === eq.total_quantity).length;
    
    return { total, totalQuantity, totalAvailable, totalRented, totalValue, fullyRented, partiallyRented, fullyAvailable };
  }, [equipmentWithAvailability]);

  const createMutation = useMutation({
    mutationFn: async (data: EquipmentFormData) => {
      const { error } = await supabase.from("equipment").insert([{
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        serial_number: data.serial_number || null,
        purchase_date: data.purchase_date || null,
        purchase_price: data.purchase_price,
        current_condition: data.current_condition,
        daily_rental_rate: data.daily_rental_rate,
        notes: data.notes || null,
        image_url: data.image_url || null,
        total_quantity: data.total_quantity,
        available_quantity: data.total_quantity,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "تم إضافة المعدة بنجاح" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EquipmentFormData }) => {
      const { error } = await supabase
        .from("equipment")
        .update({
          name: data.name,
          description: data.description || null,
          category: data.category || null,
          serial_number: data.serial_number || null,
          purchase_date: data.purchase_date || null,
          purchase_price: data.purchase_price,
          current_condition: data.current_condition,
          daily_rental_rate: data.daily_rental_rate,
          notes: data.notes || null,
          image_url: data.image_url || null,
          total_quantity: data.total_quantity,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "تم تحديث المعدة بنجاح" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete equipment_rentals first (FK NO ACTION)
      await supabase.from("equipment_rentals").delete().eq("equipment_id", id);
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "تم حذف المعدة بنجاح" });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEquipment(null);
    setFormData({
      name: "",
      description: "",
      category: "",
      serial_number: "",
      purchase_date: "",
      purchase_price: 0,
      current_condition: "good",
      daily_rental_rate: 0,
      notes: "",
      image_url: "",
      total_quantity: 1,
    });
  };

  const handleEdit = (eq: Equipment) => {
    setEditingEquipment(eq);
    setFormData({
      name: eq.name,
      description: eq.description || "",
      category: eq.category || "",
      serial_number: eq.serial_number || "",
      purchase_date: eq.purchase_date || "",
      purchase_price: eq.purchase_price,
      current_condition: eq.current_condition,
      daily_rental_rate: eq.daily_rental_rate,
      notes: eq.notes || "",
      image_url: eq.image_url || "",
      total_quantity: eq.total_quantity,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "اسم المعدة مطلوب", variant: "destructive" });
      return;
    }

    if (editingEquipment) {
      updateMutation.mutate({ id: editingEquipment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredEquipment = equipmentWithAvailability.filter(
    (eq) =>
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.serial_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getConditionBadge = (condition: string) => {
    const opt = conditionOptions.find((o) => o.value === condition);
    if (!opt) return null;
    const Icon = opt.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className={`h-3 w-3 ${opt.color}`} />
        {opt.label}
      </Badge>
    );
  };

  const getAvailabilityBadge = (eq: typeof equipmentWithAvailability[0]) => {
    if (eq.available_quantity === 0) {
      return <Badge variant="secondary" className="bg-red-100 text-red-700">مؤجرة بالكامل</Badge>;
    }
    if (eq.available_quantity < eq.total_quantity) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
          متاح {eq.available_quantity} من {eq.total_quantity}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
        متاحة بالكامل ({eq.total_quantity})
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">معدات الشركة</h1>
          <p className="text-muted-foreground">إدارة المعدات والآلات القابلة للإيجار</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة معدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEquipment ? "تعديل المعدة" : "إضافة معدة جديدة"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم المعدة *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: رافعة شوكية"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">الفئة</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="مثال: معدات ثقيلة"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_quantity">الكمية الإجمالية</Label>
                  <Input
                    id="total_quantity"
                    type="number"
                    min="1"
                    value={formData.total_quantity}
                    onChange={(e) => setFormData({ ...formData, total_quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial_number">الرقم التسلسلي</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="SN-12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current_condition">الحالة</Label>
                  <Select
                    value={formData.current_condition}
                    onValueChange={(value) => setFormData({ ...formData, current_condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">تاريخ الشراء</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">سعر الشراء (د.ل)</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daily_rental_rate">سعر الإيجار اليومي (د.ل)</Label>
                  <Input
                    id="daily_rental_rate"
                    type="number"
                    step="0.01"
                    value={formData.daily_rental_rate}
                    onChange={(e) => setFormData({ ...formData, daily_rental_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف المعدة..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  rows={2}
                />
              </div>
              <ImageUploader
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                folder="equipment"
                label="صورة المعدة"
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editingEquipment ? "تحديث" : "إضافة"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Boxes className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المعدات</p>
                <p className="text-2xl font-bold">{summary.totalQuantity}</p>
                <p className="text-xs text-muted-foreground">{summary.total} نوع</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <PackageCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المتاحة</p>
                <p className="text-2xl font-bold text-green-600">{summary.totalAvailable}</p>
                <p className="text-xs text-muted-foreground">{summary.fullyAvailable} متاحة بالكامل</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <PackageX className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المؤجرة</p>
                <p className="text-2xl font-bold text-orange-600">{summary.totalRented}</p>
                <p className="text-xs text-muted-foreground">{summary.fullyRented} مؤجرة بالكامل</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">القيمة الإجمالية</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrencyLYD(summary.totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and View Toggle */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <Input
            placeholder="البحث عن معدة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-2">
            <Button
              variant={viewMode === "cards" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("cards")}
              title="عرض الكروت"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("table")}
              title="عرض الجدول"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Equipment Display */}
      {filteredEquipment.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">لا توجد معدات</p>
          <p className="text-sm text-muted-foreground">اضغط على "إضافة معدة" لبدء إضافة معدات الشركة</p>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipment.map((eq) => {
            const availabilityPercent = eq.total_quantity > 0 
              ? Math.round((eq.available_quantity / eq.total_quantity) * 100) 
              : 0;
            
            return (
              <Card key={eq.id} className="overflow-hidden card-hover">
                {/* Image */}
                <div className="h-40 bg-muted relative">
                  {eq.image_url ? (
                    <img
                      src={eq.image_url}
                      alt={eq.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getConditionBadge(eq.current_condition)}
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Name and Category */}
                  <div>
                    <h3 className="font-semibold text-lg truncate">{eq.name}</h3>
                    {eq.category && (
                      <p className="text-sm text-muted-foreground">{eq.category}</p>
                    )}
                  </div>

                  {/* Availability */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">التوفر</span>
                      {getAvailabilityBadge(eq)}
                    </div>
                    <Progress value={availabilityPercent} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>مؤجر: {eq.rented_count}</span>
                      <span>متاح: {eq.available_quantity}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-muted-foreground">الإيجار اليومي</span>
                    <span className="font-semibold text-primary">{formatCurrencyLYD(eq.daily_rental_rate)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/equipment/${eq.id}`)}
                    >
                      <Eye className="h-4 w-4 ml-1" />
                      التفاصيل
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleEdit(eq)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteId(eq.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">الصورة</TableHead>
                  <TableHead>اسم المعدة</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>المتاح</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإيجار اليومي</TableHead>
                  <TableHead className="w-[120px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell>
                      {eq.image_url ? (
                        <img
                          src={eq.image_url}
                          alt={eq.name}
                          className="w-10 h-10 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.svg';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{eq.name}</TableCell>
                    <TableCell>{eq.category || "-"}</TableCell>
                    <TableCell>{eq.total_quantity}</TableCell>
                    <TableCell>{getAvailabilityBadge(eq)}</TableCell>
                    <TableCell>{getConditionBadge(eq.current_condition)}</TableCell>
                    <TableCell>{formatCurrencyLYD(eq.daily_rental_rate)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/equipment/${eq.id}`)} title="عرض التفاصيل">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(eq)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(eq.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذه المعدة نهائياً. لا يمكن التراجع عن هذا الإجراء.
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

export default Equipment;
