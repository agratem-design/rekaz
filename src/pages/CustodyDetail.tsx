import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Wallet, ShoppingCart, Wrench, User, Calendar, Building2, FileText } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const CustodyDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: custody, isLoading: custodyLoading } = useQuery({
    queryKey: ['custody', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_custody')
        .select(`
          *,
          project:projects(id, name, client:clients(id, name)),
          engineer:engineers(id, name),
          employee:employees(id, name)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['custody-purchases', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          supplier:suppliers(id, name)
        `)
        .eq('custody_id', id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ['custody-rentals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_rentals')
        .select(`
          *,
          equipment:equipment(id, name)
        `)
        .eq('custody_id', id)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  if (custodyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!custody) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">العهدة غير موجودة</h2>
          <Link to="/custody">
            <Button variant="outline">
              <ArrowRight className="ml-2 h-4 w-4" />
              العودة للعهد
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const holderName = custody.holder_type === 'engineer' 
    ? custody.engineer?.name 
    : custody.employee?.name;

  const spentPercentage = custody.amount > 0 
    ? Math.min((custody.spent_amount / custody.amount) * 100, 100) 
    : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">نشطة</Badge>;
      case 'closed':
        return <Badge className="bg-gray-100 text-gray-800">مغلقة</Badge>;
      case 'settled':
        return <Badge className="bg-blue-100 text-blue-800">مسددة</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const totalRentals = rentals.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/custody">
              <Button variant="outline" size="icon">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Wallet className="h-6 w-6 text-primary" />
                تفاصيل العهدة
              </h1>
              <p className="text-muted-foreground">عهدة {holderName}</p>
            </div>
          </div>
          {getStatusBadge(custody.status)}
        </div>

        {/* Custody Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المسؤول</p>
                  <p className="font-semibold">{holderName}</p>
                  <p className="text-xs text-muted-foreground">
                    {custody.holder_type === 'engineer' ? 'مهندس' : 'موظف'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المشروع</p>
                  {custody.project ? (
                    <Link to={`/projects/${custody.project.id}`} className="font-semibold hover:text-primary">
                      {custody.project.name}
                    </Link>
                  ) : (
                    <p className="font-semibold text-muted-foreground">بدون مشروع</p>
                  )}
                  {custody.project?.client && (
                    <p className="text-xs text-muted-foreground">{custody.project.client.name}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">تاريخ العهدة</p>
                  <p className="font-semibold">
                    {format(new Date(custody.date), 'dd MMMM yyyy', { locale: ar })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المبلغ الكلي</p>
                  <p className="font-semibold">{formatCurrencyLYD(custody.amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle>الملخص المالي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">المبلغ المصروف</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrencyLYD(custody.spent_amount)}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">المبلغ المتبقي</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrencyLYD(custody.remaining_amount || 0)}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">نسبة الصرف</p>
                <p className="text-2xl font-bold">{spentPercentage.toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={spentPercentage} className="h-3" />
          </CardContent>
        </Card>

        {/* Notes */}
        {custody.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                ملاحظات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{custody.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Purchases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
                المشتريات ({purchases.length})
              </span>
              <span className="text-lg font-normal text-muted-foreground">
                الإجمالي: {formatCurrencyLYD(totalPurchases)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {purchases.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد مشتريات مرتبطة بهذه العهدة</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        {format(new Date(purchase.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{purchase.supplier?.name || '-'}</TableCell>
                      <TableCell>{purchase.invoice_number || '-'}</TableCell>
                      <TableCell className="font-medium">{formatCurrencyLYD(purchase.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={purchase.status === 'paid' ? 'default' : 'secondary'}>
                          {purchase.status === 'paid' ? 'مدفوع' : 
                           purchase.status === 'partial' ? 'جزئي' : 
                           purchase.status === 'due' ? 'مستحق' : purchase.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Rentals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-500" />
                الإيجارات ({rentals.length})
              </span>
              <span className="text-lg font-normal text-muted-foreground">
                الإجمالي: {formatCurrencyLYD(totalRentals)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rentals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد إيجارات مرتبطة بهذه العهدة</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المعدة</TableHead>
                    <TableHead>تاريخ البداية</TableHead>
                    <TableHead>تاريخ النهاية</TableHead>
                    <TableHead>السعر اليومي</TableHead>
                    <TableHead>المبلغ الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((rental) => (
                    <TableRow key={rental.id}>
                      <TableCell>{rental.equipment?.name || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(rental.start_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {rental.end_date ? format(new Date(rental.end_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>{formatCurrencyLYD(rental.daily_rate)}</TableCell>
                      <TableCell className="font-medium">{formatCurrencyLYD(rental.total_amount || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={rental.status === 'active' ? 'default' : 'secondary'}>
                          {rental.status === 'active' ? 'نشط' : 'منتهي'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustodyDetail;
