import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Edit
} from "lucide-react";

type Contract = {
  id: string;
  title: string;
  contract_number: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  amount: number;
  status: string;
  payment_terms: string | null;
  notes: string | null;
  attachments: any;
  client_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
  projects?: { name: string } | null;
};

const Contracts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          clients(name),
          projects(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Contract[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: "تم حذف العقد بنجاح" });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف العقد", variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-500/20 text-green-500">نشط</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-500">مكتمل</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500">معلق</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/20 text-red-500">ملغي</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    pending: contracts.filter(c => c.status === 'pending').length,
    totalValue: contracts.reduce((sum, c) => sum + Number(c.amount), 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">العقود</h1>
          <p className="text-muted-foreground">إدارة العقود والأصناف المرتبطة بالمشاريع</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/contracts/new')}>
          <Plus className="h-5 w-5" />
          عقد جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">إجمالي العقود</p>
              <p className="text-3xl font-bold text-primary">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-primary/40" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">عقود نشطة</p>
              <p className="text-3xl font-bold text-green-500">{stats.active}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500/40" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">عقود معلقة</p>
              <p className="text-3xl font-bold text-yellow-500">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500/40" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">القيمة الإجمالية</p>
              <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(stats.totalValue)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary/40" />
          </div>
        </Card>
      </div>

      {/* Contracts List */}
      <div className="space-y-4">
        {contracts.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد عقود</h3>
            <p className="text-muted-foreground mb-4">ابدأ بإنشاء عقد جديد</p>
            <Button onClick={() => navigate('/contracts/new')}>
              <Plus className="h-4 w-4 mr-2" />
              إنشاء عقد
            </Button>
          </Card>
        ) : (
          contracts.map((contract) => (
            <Card key={contract.id} className="p-6 card-hover">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{contract.title}</h3>
                      {getStatusBadge(contract.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      رقم العقد: {contract.contract_number} 
                      {contract.clients?.name && ` | العميل: ${contract.clients.name}`}
                      {contract.projects?.name && ` | المشروع: ${contract.projects.name}`}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">تاريخ البدء</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">{contract.start_date}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">تاريخ الانتهاء</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">{contract.end_date || 'غير محدد'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">قيمة العقد</p>
                    <p className="text-sm font-bold text-primary">{formatCurrencyLYD(contract.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">شروط الدفع</p>
                    <p className="text-sm font-semibold">{contract.payment_terms || 'غير محدد'}</p>
                  </div>
                </div>

                {contract.description && (
                  <p className="text-sm text-muted-foreground">{contract.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate(`/contracts/${contract.id}`)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    تعديل
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => {
                      setSelectedContract(contract);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold mb-2">نظام العقود الذكي</h4>
            <p className="text-sm text-muted-foreground">
              يتم ربط كل عقد تلقائياً بالمشاريع والعملاء، مما يسهل تتبع التقدم والمدفوعات.
            </p>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف العقد "{selectedContract?.title}"؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedContract && deleteMutation.mutate(selectedContract.id)}
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contracts;
