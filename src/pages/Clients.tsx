import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Phone,
  Mail,
  MapPin,
  Building,
  Edit,
  Trash2,
  Coins,
  TrendingUp,
  Printer,
  ExternalLink,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { openPrintWindow } from "@/lib/printStyles";
import { calculateProjectFinancials } from "@/lib/financialCore";
import { useClientCreditLedger } from "@/hooks/useClientCreditLedger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

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

export default function Clients() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(initialForm);
  
  // Two-step delete dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteCheckboxChecked, setDeleteCheckboxChecked] = useState(false);

  const searchQuery = searchParams.get("search") || "";
  const setSearchQuery = (newSearch: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newSearch) {
        next.set("search", newSearch);
      } else {
        next.delete("search");
      }
      return next;
    }, { replace: true });
  };

  // Fetch clients metadata
  const { data: clients, isLoading: loadingClients, error: clientsError } = useQuery({
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

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch financial dependencies to calculate totals
  const { data: projects, error: projectsError } = useQuery({
    queryKey: ["all-projects-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: phases, error: phasesError } = useQuery({
    queryKey: ["all-phases-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: projectItems, error: projectItemsError } = useQuery({
    queryKey: ["all-items-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_items").select("id, project_id, phase_id, total_price");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: purchases, error: purchasesError } = useQuery({
    queryKey: ["all-purchases-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("id, project_id, phase_id, total_amount, paid_amount, purchase_type, supplier_id, technician_id, rental_id");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: clientExpenses, error: clientExpensesError } = useQuery({
    queryKey: ["all-expenses-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id, project_id, amount, type, technician_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientItemTechs, error: clientItemTechsError } = useQuery({
    queryKey: ["all-item-techs-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_item_technicians").select("id, total_cost, rate, quantity, project_item_id, project_items(project_id)");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientPayments, error: clientPaymentsError } = useQuery({
    queryKey: ["all-payments-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_payments").select("id, client_id, project_id, amount").is("reversed_at", null);
      if (error) throw error;
      return data as any;
    },
  });

  const { data: contracts, error: contractsError } = useQuery({
    queryKey: ["all-contracts-clients-page"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id, client_id, project_id, amount, status");
      if (error) throw error;
      return data;
    },
  });

  // Map clients to their calculated financial overview using Central Financial Domain
  const creditLedgerQuery = useClientCreditLedger();
  const creditLedger = creditLedgerQuery.data;
  const clientsWithFinancials = useMemo(() => {
    if (!clients || !projects || !phases || !projectItems || !purchases || !clientPayments || !creditLedger) return [];

    return clients.map((client) => {
      const clientProjList = projects.filter((p) => p.client_id === client.id);
      let totalBilled = 0;
      let remaining = 0;
      let totalPaid = 0;

      clientProjList.forEach((proj) => {
        const projPurchases = purchases.filter((p: any) => p.project_id === proj.id);
        const projItems = projectItems.filter((item: any) => item.project_id === proj.id);
        const projContracts = (contracts || []).filter(
          (c) => c.status !== "cancelled" && c.project_id === proj.id
        );
        const projExpenses = (clientExpenses || []).filter((e: any) => e.project_id === proj.id);
        const projItemTechs = (clientItemTechs || []).filter((r: any) => r.project_items?.project_id === proj.id);
        const projPayments = (clientPayments || []).filter((p: any) => p.project_id === proj.id);

        const projResult = calculateProjectFinancials({
          project: proj,
          contracts: projContracts,
          projectItems: projItems,
          purchases: projPurchases,
          projectItemTechnicians: projItemTechs,
          expenses: projExpenses,
          clientPayments: projPayments,
          creditLedger,
        });

        totalBilled += projResult.clientObligation;
        remaining += projResult.clientRemaining;
        totalPaid += projResult.totalSettled;
      });

      return {
        ...client,
        projects: clientProjList,
        totalBilled,
        totalPaid,
        remaining,
      };
    });
  }, [clients, projects, phases, projectItems, purchases, clientPayments, contracts, clientExpenses, clientItemTechs, creditLedger]);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!clientsWithFinancials) return [];
    if (!searchQuery.trim()) return clientsWithFinancials;
    const q = searchQuery.toLowerCase();
    return clientsWithFinancials.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q))
    );
  }, [clientsWithFinancials, searchQuery]);

  // General Stats
  const stats = useMemo(() => {
    if (!clientsWithFinancials) return { totalClients: 0, totalBilled: 0, totalPaid: 0, totalRemaining: 0 };
    
    const totalClients = clientsWithFinancials.length;
    const totalBilled = clientsWithFinancials.reduce((sum, c) => sum + c.totalBilled, 0);
    const totalPaid = clientsWithFinancials.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalRemaining = clientsWithFinancials.reduce((sum, c) => sum + (c.remaining > 0 ? c.remaining : 0), 0);

    return {
      totalClients,
      totalBilled,
      totalPaid,
      totalRemaining,
    };
  }, [clientsWithFinancials]);

  // Save/Update Mutation
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
      queryClient.invalidateQueries({ queryKey: ["all-clients-debts"] });
      toast.success(editingClient ? "تم تحديث العميل بنجاح" : "تمت إضافة العميل بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      // Get all projects for this client
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", clientId);
      
      const projectIds = projects?.map(p => p.id) || [];

      if (projectIds.length > 0) {
        for (const projectId of projectIds) {
          // Delete project_item_technicians
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

          // Delete project_items
          await supabase
            .from("project_items")
            .delete()
            .eq("project_id", projectId);

          // Delete project_technicians
          await supabase
            .from("project_technicians")
            .delete()
            .eq("project_id", projectId);

          // Delete project_suppliers
          await supabase
            .from("project_suppliers")
            .delete()
            .eq("project_id", projectId);

          // Delete purchases
          await supabase
            .from("purchases")
            .delete()
            .eq("project_id", projectId);

          // Delete expenses
          await supabase
            .from("expenses")
            .delete()
            .eq("project_id", projectId);

          // Delete income
          await supabase
            .from("income")
            .delete()
            .eq("project_id", projectId);

          // Delete transfers
          await supabase
            .from("transfers")
            .delete()
            .eq("project_id", projectId);
        }

        // Delete all projects for this client
        await supabase
          .from("projects")
          .delete()
          .eq("client_id", clientId);
      }

      // Delete contracts for this client
      await supabase
        .from("contracts")
        .delete()
        .eq("client_id", clientId);

      // Delete income records directly linked to client
      await supabase
        .from("income")
        .delete()
        .eq("client_id", clientId);

      // Finally delete the client
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
    setDeleteStep(1);
    setDeleteConfirmText("");
    setDeleteCheckboxChecked(false);
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

  // Print client summary report
  const handlePrintClientsReport = () => {
    let rowsHTML = "";
    filteredClients.forEach((c, idx) => {
      rowsHTML += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${c.name}</td>
          <td>${c.phone || "---"}</td>
          <td>${c.projects.map(p => p.name).join(" - ") || "---"}</td>
          <td style="text-align: center; font-weight: bold;">${c.totalBilled.toLocaleString()} د.ل</td>
          <td style="text-align: center; color: green;">${c.totalPaid.toLocaleString()} د.ل</td>
          <td style="text-align: center; color: ${c.remaining > 0 ? "red" : "green"}; font-weight: bold;">${c.remaining.toLocaleString()} د.ل</td>
        </tr>
      `;
    });

    const printHTML = `
      <style>
        .report-container {
          direction: rtl;
          font-family: 'Tajawal', sans-serif;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        .report-table th, .report-table td {
          border: 1px solid #000;
          padding: 8px;
          font-size: 10pt;
        }
        .report-table th {
          background-color: #f2f2f2;
        }
      </style>
      <div class="report-container">
        <h2 style="text-align: center; margin-bottom: 20px;">كشف الحساب الإجمالي للعملاء</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 5%;">ر.م</th>
              <th>العميل</th>
              <th>رقم الهاتف</th>
              <th>المشاريع</th>
              <th>إجمالي الأعمال</th>
              <th>إجمالي المسدد</th>
              <th>القيمة المتبقية</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    `;

    openPrintWindow("كشف العملاء الإجمالي", printHTML, companySettings);
  };

  const financialError = [clientsError, projectsError, phasesError, projectItemsError, purchasesError, clientExpensesError, clientItemTechsError, clientPaymentsError, contractsError, creditLedgerQuery.error].find(Boolean);
  if (financialError) return (
    <Card className="p-6 space-y-3" dir="rtl" role="alert">
      <p>تعذر تحميل الحسابات كاملة. لم نعرض أرصدة جزئية حتى لا تظهر أرقام غير صحيحة.</p>
      <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>إعادة المحاولة</Button>
    </Card>
  );
  if (!clients || !projects || !phases || !projectItems || !purchases || !clientExpenses || !clientItemTechs || !clientPayments || !contracts || !creditLedger) return (
    <Card className="p-6 text-muted-foreground" dir="rtl" role="status">جاري تحميل الحسابات ومطابقة الأرصدة…</Card>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <PageHeader
        title="العملاء"
        description="إدارة قاعدة بيانات العملاء ومتابعة قيم الأعمال، المدفوعات والذمم المتبقية"
        actions={
          <>
            <Button onClick={handlePrintClientsReport} variant="outline" className="gap-2 cursor-pointer">
              <Printer className="h-4 w-4" />
              <span>طباعة الكشف الإجمالي</span>
            </Button>
            <Button className="gap-2 cursor-pointer" onClick={() => { setEditingClient(null); setForm(initialForm); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              <span>عميل جديد</span>
            </Button>
          </>
        }
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              <Button type="submit" className="flex-1 cursor-pointer" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "جاري الحفظ..." : editingClient ? "تحديث" : "إضافة"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="cursor-pointer">
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي العملاء</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-foreground">{stats.totalClients}</p>
            <p className="text-xs text-muted-foreground mt-1">العملاء المسجلين بالمنظومة</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">قيمة الأعمال المنجزة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-primary">{stats.totalBilled.toLocaleString()} د.ل</p>
            <p className="text-xs text-muted-foreground mt-1">مجموع المطالبات والبنود لجميع المشاريع</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المسدد</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">{stats.totalPaid.toLocaleString()} د.ل</p>
            <p className="text-xs text-muted-foreground mt-1">مجموع المبالغ المقبوضة والمحصلة</p>
          </CardContent>
        </Card>

        <Card className="border-[#d6ac40]/30 bg-[#d6ac40]/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#b8860b]">الذمم المستحقة (المتبقية)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{stats.totalRemaining.toLocaleString()} د.ل</p>
            <p className="text-xs text-muted-foreground mt-1">الديون المستحقة المعلقة على الزبائن</p>
          </CardContent>
        </Card>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم الزبون، الهاتف، أو المدينة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      {loadingClients ? (
        <div className="text-center py-12 text-muted-foreground">جاري تحميل بيانات العملاء...</div>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Building}
          title={searchQuery ? "لا يوجد عملاء مطابقين للبحث" : "لا يوجد عملاء حتى الآن"}
          description={
            searchQuery
              ? `لم نتمكن من العثور على أي عميل يطابق "${searchQuery}".`
              : "ابدأ بإضافة أول عميل إلى المنظومة لمتابعة مشاريعه وحساباته المالية."
          }
          action={
            !searchQuery ? (
              <Button
                className="gap-2 cursor-pointer"
                onClick={() => {
                  setEditingClient(null);
                  setForm(initialForm);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span>إضافة عميل</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="cursor-pointer"
              >
                مسح البحث
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const hasDebt = client.remaining > 0;
            return (
              <Card key={client.id} className="p-6 border border-border/80 hover:border-primary/50 transition-all flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Title and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                        {client.name}
                        {hasDebt && (
                          <Badge variant="outline" className="border-red-500/20 bg-red-500/5 text-red-600 text-[10px] py-0 px-1 font-semibold">
                            مدين
                          </Badge>
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {client.projects.map((p) => (
                          <Badge key={p.id} variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                            {p.name}
                          </Badge>
                        ))}
                        {client.projects.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">لا توجد مشاريع حالية</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
                        onClick={() => handleDelete(client)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Client details info */}
                  <div className="space-y-2 text-xs border-t border-b border-border/60 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <span>{client.phone || "غير محدد"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>{client.city} {client.address ? ` - ${client.address}` : ""}</span>
                    </div>
                  </div>

                  {/* Financial calculations */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-primary" />
                        إجمالي الأعمال:
                      </span>
                      <span className="font-bold text-foreground">
                        {client.totalBilled.toLocaleString()} د.ل
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        المسدد للشركة:
                      </span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {client.totalPaid.toLocaleString()} د.ل
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed border-border/80">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                        المتبقي (المستحق):
                      </span>
                      <span
                        className={`font-extrabold ${
                          client.remaining > 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {client.remaining.toLocaleString()} د.ل
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4">
                  <Button variant="outline" className="w-full text-xs h-9 cursor-pointer flex items-center justify-center gap-1 font-semibold" asChild>
                    <Link to={`/clients/${client.id}`} state={{ returnTo: `${location.pathname}${location.search}` }}>
                      <span>عرض تفاصيل الحساب والدفعات</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Two-step Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md bg-background border-destructive/20" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-lg">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>تحذير أمني هام جداً!</span>
            </DialogTitle>
          </DialogHeader>

          {deleteStep === 1 ? (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg text-sm text-destructive leading-relaxed">
                <p className="font-bold mb-1">تنبيه حرج لحذف العميل: "{clientToDelete?.name}"</p>
                <p>
                  الاستمرار في الحذف سيؤدي إلى **إزالة العميل نهائياً من قاعدة البيانات ومسح كافة السجلات المرتبطة به**:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 font-semibold">
                  <li>جميع المشاريع والمراحل التابعة للعميل.</li>
                  <li>جميع البنود المنفذة ومحاضر القياسات.</li>
                  <li>جميع عقود الزبون مع المرفقات البنود.</li>
                  <li>جميع المصاريف التشغيلية والمشتريات وإيجار المعدات المسجلة بالمراحل.</li>
                  <li>جميع إيصالات مقبوضات الدفعات والقيود المالية.</li>
                </ul>
                <p className="mt-2 font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 inline text-red-600" />
                  <span>هذه العملية خطيرة جداً ولا يمكن التراجع عنها أبداً!</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">
                  لتأكيد الحذف، اكتب عبارة <span className="font-black text-red-600">"تأكيد حذف العميل"</span> في الحقل أدناه:
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="اكتب العبارة بدقة هنا"
                  className="border-destructive/40 focus-visible:ring-destructive"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setDeleteStep(2)}
                  disabled={deleteConfirmText !== "تأكيد حذف العميل"}
                  className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer font-bold"
                >
                  التالي (تأكيد أخير)
                </Button>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="cursor-pointer">
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-sm text-red-700 dark:text-red-400 leading-relaxed font-semibold">
                <p className="text-center text-base mb-2 font-bold flex items-center justify-center gap-1.5 text-red-600">
                  <AlertTriangle className="h-5 w-5 inline text-red-600" />
                  <span>خطوة التأكيد النهائية</span>
                </p>
                <p className="text-center">
                  أنت على وشك حذف العميل بشكل قطعي. هل قمت بنسخ بيانات العميل احتياطياً وتأكيد رغبتك بالمسح؟
                </p>
              </div>

              <div className="flex items-center gap-2 border p-3 rounded-lg bg-muted/40 cursor-pointer" onClick={() => setDeleteCheckboxChecked(!deleteCheckboxChecked)}>
                <input
                  type="checkbox"
                  id="final-checkbox"
                  checked={deleteCheckboxChecked}
                  onChange={(e) => setDeleteCheckboxChecked(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-destructive focus:ring-destructive cursor-pointer"
                />
                <Label htmlFor="final-checkbox" className="text-xs font-bold leading-none cursor-pointer">
                  أنا أتحمل مسؤولية حذف هذا العميل وكافة بياناته ومشاريعه بشكل نهائي.
                </Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => clientToDelete && deleteMutation.mutate(clientToDelete.id)}
                  disabled={!deleteCheckboxChecked || deleteMutation.isPending}
                  className="flex-1 bg-red-700 text-white hover:bg-red-800 cursor-pointer font-bold"
                >
                  {deleteMutation.isPending ? "جاري الحذف النهائي..." : "حذف نهائي وقطعي"}
                </Button>
                <Button variant="outline" onClick={() => setDeleteStep(1)} className="cursor-pointer">
                  السابق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
