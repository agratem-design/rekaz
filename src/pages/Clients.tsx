import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Phone, Mail, MapPin, Building, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  notes: string;
}

const initialForm: ClientForm = {
  name: "",
  phone: "",
  email: "",
  city: "زليتن",
  address: "",
  notes: "",
};

const Clients = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(initialForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["clients-stats"],
    queryFn: async () => {
      const { count: totalClients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      const { data: projects } = await supabase
        .from("projects")
        .select("client_id, budget, status");

      const activeClients = new Set(
        projects?.filter((p) => p.status === "active").map((p) => p.client_id)
      ).size;

      const activeProjects = projects?.filter((p) => p.status === "active").length || 0;
      const totalValue = projects?.reduce((sum, p) => sum + Number(p.budget), 0) || 0;

      return {
        totalClients: totalClients || 0,
        activeClients,
        activeProjects,
        totalValue,
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ClientForm) => {
      const clientData = {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        city: data.city || null,
        address: data.address || null,
        notes: data.notes || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(clientData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-stats"] });
      toast.success(editingClient ? "تم تحديث العميل بنجاح" : "تمت إضافة العميل بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      // Get all projects for this client
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", clientId);
      
      const projectIds = projects?.map(p => p.id) || [];

      // Delete client_payment_allocations before client_payments
      const { data: clientPayments } = await supabase
        .from("client_payments")
        .select("id")
        .eq("client_id", clientId);
      
      const paymentIds = clientPayments?.map(p => p.id) || [];
      if (paymentIds.length > 0) {
        await supabase
          .from("client_payment_allocations")
          .delete()
          .in("payment_id", paymentIds);
        
        // Delete treasury_transactions linked to client_payments
        await supabase
          .from("treasury_transactions")
          .delete()
          .eq("reference_type", "client_payment")
          .in("reference_id", paymentIds);
      }

      await supabase
        .from("client_payments")
        .delete()
        .eq("client_id", clientId);

      if (projectIds.length > 0) {
        for (const projectId of projectIds) {
          // Delete project_item_technicians & progress records
          const { data: projectItems } = await supabase
            .from("project_items")
            .select("id")
            .eq("project_id", projectId);
          
          const itemIds = projectItems?.map(i => i.id) || [];
          
          if (itemIds.length > 0) {
            await supabase
              .from("project_item_technicians")
              .delete()
              .in("project_item_id", itemIds);
            
            await supabase
              .from("technician_progress_records")
              .delete()
              .in("project_item_id", itemIds);
          }

          // Delete checklist_items before inspection_checklists
          const { data: checklists } = await supabase
            .from("inspection_checklists")
            .select("id")
            .eq("project_id", projectId);
          
          const checklistIds = checklists?.map(c => c.id) || [];
          if (checklistIds.length > 0) {
            await supabase
              .from("checklist_items")
              .delete()
              .in("checklist_id", checklistIds);
          }

          await supabase.from("inspection_checklists").delete().eq("project_id", projectId);
          await supabase.from("project_schedules").delete().eq("project_id", projectId);
          await supabase.from("stock_movements").delete().eq("project_id", projectId);
          await supabase.from("project_items").delete().eq("project_id", projectId);
          await supabase.from("project_technicians").delete().eq("project_id", projectId);
          await supabase.from("project_suppliers").delete().eq("project_id", projectId);
          // Delete treasury_transactions for purchases
          const { data: projPurchases } = await supabase.from("purchases").select("id").eq("project_id", projectId);
          const projPurchaseIds = projPurchases?.map(p => p.id) || [];
          if (projPurchaseIds.length > 0) {
            await supabase.from("treasury_transactions").delete().eq("reference_type", "purchase").in("reference_id", projPurchaseIds);
          }
          await supabase.from("purchases").delete().eq("project_id", projectId);
          await supabase.from("expenses").delete().eq("project_id", projectId);
          await supabase.from("income").delete().eq("project_id", projectId);
          await supabase.from("transfers").delete().eq("project_id", projectId);
          await supabase.from("equipment_rentals").delete().eq("project_id", projectId);
          await supabase.from("project_custody").delete().eq("project_id", projectId);
          await supabase.from("project_phases").delete().eq("project_id", projectId);
        }

        // Delete contract_items and contract_clauses before contracts (must be before project deletion)
        const { data: contracts } = await supabase
          .from("contracts")
          .select("id")
          .eq("client_id", clientId);
        
        const contractIds = contracts?.map(c => c.id) || [];
        if (contractIds.length > 0) {
          await supabase
            .from("contract_items")
            .delete()
            .in("contract_id", contractIds);
          
          await supabase
            .from("contract_clauses")
            .delete()
            .in("contract_id", contractIds);
        }

        await supabase.from("contracts").delete().eq("client_id", clientId);

        // Now delete projects (after contracts are cleaned up)
        await supabase.from("projects").delete().eq("client_id", clientId);
      }

      // Delete income records directly linked to client
      await supabase.from("income").delete().eq("client_id", clientId);

      // Finally delete the client
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-stats"] });
      toast.success("تم حذف العميل وجميع البيانات المرتبطة بنجاح");
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف العميل");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setForm(initialForm);
  };

  const handleEdit = (client: any) => {
    setEditingClient(client.id);
    setForm({
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      city: client.city || "زليتن",
      address: client.address || "",
      notes: client.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (client: any) => {
    setClientToDelete({ id: client.id, name: client.name });
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("يرجى إدخال اسم العميل");
      return;
    }
    saveMutation.mutate(form);
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">العملاء</h1>
          <p className="text-muted-foreground">إدارة قاعدة بيانات العملاء والمشاريع</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingClient(null); setForm(initialForm); }}>
              <Plus className="h-5 w-5" />
              عميل جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم العميل *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="أدخل اسم العميل"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="09xxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="example@mail.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">المدينة</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="أدخل المدينة"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="أدخل العنوان التفصيلي"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "جاري الحفظ..." : editingClient ? "تحديث" : "إضافة"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">إجمالي العملاء</p>
            <p className="text-3xl font-bold text-primary">{stats?.totalClients || 0}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">عملاء نشطين</p>
            <p className="text-3xl font-bold text-green-500">{stats?.activeClients || 0}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">مشاريع نشطة</p>
            <p className="text-3xl font-bold text-primary">{stats?.activeProjects || 0}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">القيمة الإجمالية</p>
            <p className="text-2xl font-bold text-primary">
              {(stats?.totalValue || 0).toLocaleString("ar-LY")} د.ل
            </p>
          </div>
        </Card>
      </div>

      {/* Clients Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients?.map((client) => (
          <Card key={client.id} className="p-6 card-hover">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-2">{client.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(client)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(client)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Building className="h-8 w-8 text-primary/40" />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{client.phone || "غير محدد"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{client.email || "غير محدد"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{client.city || "غير محدد"}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">العنوان</p>
                <p className="text-sm">{client.address || "غير محدد"}</p>
              </div>

              <Link to={`/clients/${client.id}`} className="w-full">
                <Button variant="outline" className="w-full">
                  عرض التفاصيل
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل "{clientToDelete?.name}"؟
              <br />
              <span className="text-destructive font-semibold">
                سيتم حذف جميع المشاريع والعقود والمصروفات والإيرادات المرتبطة بهذا العميل نهائياً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clientToDelete && deleteMutation.mutate(clientToDelete.id)}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف العميل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
