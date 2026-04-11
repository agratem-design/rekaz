import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Calendar, DollarSign, Tag, FileText, Wrench, ImageIcon } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";

const EquipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: rentals } = useQuery({
    queryKey: ["equipment-rentals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select(`
          *,
          projects:project_id (name)
        `)
        .eq("equipment_id", id)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const getConditionBadge = (condition: string) => {
    const styles: Record<string, string> = {
      excellent: "bg-green-100 text-green-800",
      good: "bg-blue-100 text-blue-800",
      fair: "bg-yellow-100 text-yellow-800",
      poor: "bg-orange-100 text-orange-800",
      damaged: "bg-red-100 text-red-800",
    };
    const labels: Record<string, string> = {
      excellent: "ممتازة",
      good: "جيدة",
      fair: "مقبولة",
      poor: "ضعيفة",
      damaged: "تالفة",
    };
    return (
      <Badge className={styles[condition] || "bg-gray-100 text-gray-800"}>
        {labels[condition] || condition}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-blue-100 text-blue-800",
      returned: "bg-green-100 text-green-800",
      damaged: "bg-red-100 text-red-800",
    };
    const labels: Record<string, string> = {
      active: "مؤجرة",
      returned: "مُرجعة",
      damaged: "تالفة",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100 text-gray-800"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">المعدة غير موجودة</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/equipment")}>
            <ArrowRight className="h-4 w-4 ml-2" />
            العودة للمعدات
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Section */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {equipment.image_url ? (
                <img
                  src={equipment.image_url}
                  alt={equipment.name}
                  className="w-full h-96 object-cover"
                />
              ) : (
                <div className="w-full h-96 bg-muted flex items-center justify-center">
                  <ImageIcon className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">{equipment.name}</CardTitle>
                  {getConditionBadge(equipment.current_condition || "good")}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {equipment.description && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">الوصف</p>
                      <p>{equipment.description}</p>
                    </div>
                  </div>
                )}

                {equipment.category && (
                  <div className="flex items-start gap-3">
                    <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">الفئة</p>
                      <p>{equipment.category}</p>
                    </div>
                  </div>
                )}

                {equipment.serial_number && (
                  <div className="flex items-start gap-3">
                    <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">الرقم التسلسلي</p>
                      <p className="font-mono">{equipment.serial_number}</p>
                    </div>
                  </div>
                )}

                {equipment.purchase_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">تاريخ الشراء</p>
                      <p>{new Date(equipment.purchase_date).toLocaleDateString("ar-LY")}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">سعر الشراء</p>
                      <p className="font-semibold">{formatCurrencyLYD(equipment.purchase_price || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">سعر الإيجار اليومي</p>
                      <p className="font-semibold">{formatCurrencyLYD(equipment.daily_rental_rate || 0)}</p>
                    </div>
                  </div>
                </div>

                {equipment.notes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">ملاحظات</p>
                    <p className="text-sm">{equipment.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rental History */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>سجل الإيجارات</CardTitle>
          </CardHeader>
          <CardContent>
            {rentals && rentals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-3 px-4">المشروع</th>
                      <th className="text-right py-3 px-4">تاريخ البدء</th>
                      <th className="text-right py-3 px-4">تاريخ الانتهاء</th>
                      <th className="text-right py-3 px-4">السعر اليومي</th>
                      <th className="text-right py-3 px-4">الإجمالي</th>
                      <th className="text-right py-3 px-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentals.map((rental) => (
                      <tr key={rental.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{rental.projects?.name || "بدون مشروع"}</td>
                        <td className="py-3 px-4">
                          {new Date(rental.start_date).toLocaleDateString("ar-LY")}
                        </td>
                        <td className="py-3 px-4">
                          {rental.end_date
                            ? new Date(rental.end_date).toLocaleDateString("ar-LY")
                            : "-"}
                        </td>
                        <td className="py-3 px-4">{formatCurrencyLYD(rental.daily_rate)}</td>
                        <td className="py-3 px-4">{formatCurrencyLYD(rental.total_amount || 0)}</td>
                        <td className="py-3 px-4">{getStatusBadge(rental.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                لا يوجد سجل إيجارات لهذه المعدة
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EquipmentDetail;
