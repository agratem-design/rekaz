import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isOfflineMode } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, Users as UsersIcon, Shield, HardHat, RefreshCw, KeyRound, Pencil, Calculator, Eye, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  title: string | null;
  engineer_id: string | null;
  access_code: string | null;
  created_at: string;
  role: string | null;
  engineer_name?: string;
}

interface EditUserData {
  email: string;
  display_name: string;
  username: string;
  title: string;
}

const UserManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [passwordDialogUser, setPasswordDialogUser] = useState<UserWithRole | null>(null);
  const [editDialogUser, setEditDialogUser] = useState<UserWithRole | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editData, setEditData] = useState<EditUserData>({
    email: "",
    display_name: "",
    username: "",
    title: "",
  });
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    display_name: "",
    username: "",
    role: "engineer" as "admin" | "engineer" | "accountant" | "supervisor",
    engineer_id: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users with roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const usersWithRoles: UserWithRole[] = [];
      for (const profile of profiles || []) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .maybeSingle();

        let engineerName = null;
        if (profile.engineer_id) {
          const { data: engineer } = await supabase
            .from("engineers")
            .select("name")
            .eq("id", profile.engineer_id)
            .single();
          engineerName = engineer?.name;
        }

        usersWithRoles.push({
          ...profile,
          role: roleData?.role || null,
          engineer_name: engineerName || undefined,
        });
      }

      return usersWithRoles;
    },
  });

  // Fetch engineers for linking
  const { data: engineers } = useQuery({
    queryKey: ["engineers-for-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Generate access code mutation
  const generateCodeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("generate_access_code");
      if (error) throw error;
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ access_code: data })
        .eq("id", userId);
      
      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (code) => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast({
        title: "تم إنشاء رمز الدخول",
        description: `الرمز: ${code}`,
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في إنشاء رمز الدخول",
        variant: "destructive",
      });
    },
  });

  // Create user mutation — uses Admin API via Edge Function (no email confirmation)
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: formData.email,
          password: formData.password,
          display_name: formData.display_name,
          username: formData.username,
          role: formData.role,
          engineer_id: formData.engineer_id || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setIsDialogOpen(false);
      setFormData({
        email: "",
        password: "",
        display_name: "",
        username: "",
        role: "engineer",
        engineer_id: "",
      });
      toast({
        title: "تم إنشاء المستخدم بنجاح",
        description: "يمكن للمستخدم تسجيل الدخول فوراً دون الحاجة لتأكيد البريد",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء المستخدم",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Note: Full user deletion requires admin API via edge function
      // Here we just remove the role and mark the profile
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      
      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setDeleteUserId(null);
      toast({
        title: "تم حذف صلاحيات المستخدم",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في حذف المستخدم",
        variant: "destructive",
      });
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke("update-password", {
        body: { user_id: userId, new_password: password },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setPasswordDialogUser(null);
      setNewPassword("");
      toast({
        title: "تم تغيير كلمة المرور",
        description: "تم تحديث كلمة المرور بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تغيير كلمة المرور",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string } & Partial<EditUserData>) => {
      const { data: result, error } = await supabase.functions.invoke("update-user", {
        body: { 
          user_id: data.userId, 
          email: data.email,
          display_name: data.display_name,
          username: data.username,
          title: data.title,
        },
      });
      
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setEditDialogUser(null);
      toast({
        title: "تم التحديث",
        description: "تم تحديث بيانات المستخدم بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث البيانات",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: "تم نسخ الرمز إلى الحافظة",
    });
  };

  const getRoleBadge = (role: string | null) => {
    if (role === "admin") {
      return (
        <Badge className="bg-primary/20 text-primary">
          <Shield className="w-3 h-3 ml-1" />
          مدير
        </Badge>
      );
    }
    if (role === "engineer") {
      return (
        <Badge variant="secondary">
          <HardHat className="w-3 h-3 ml-1" />
          مهندس
        </Badge>
      );
    }
    if (role === "accountant") {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          <Calculator className="w-3 h-3 ml-1" />
          محاسب
        </Badge>
      );
    }
    if (role === "supervisor") {
      return (
        <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          <Eye className="w-3 h-3 ml-1" />
          مشرف
        </Badge>
      );
    }
    return <Badge variant="outline">بدون صلاحية</Badge>;
  };

  const adminCount = users?.filter((u) => u.role === "admin").length || 0;
  const engineerCount = users?.filter((u) => u.role === "engineer").length || 0;
  const accountantCount = users?.filter((u) => u.role === "accountant").length || 0;
  const supervisorCount = users?.filter((u) => u.role === "supervisor").length || 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Offline Warning */}
      {isOfflineMode && (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            أنت في الوضع المحلي. إنشاء المستخدمين وتغيير كلمات المرور يتطلب Edge Functions.
            استخدم Supabase Studio المحلي (http://localhost:54323) لإدارة المستخدمين مباشرة.
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground">إدارة حسابات المستخدمين والصلاحيات</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ml-2 h-4 w-4" />
              إضافة مستخدم
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مستخدم جديد</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={6}
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">الاسم</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">الصلاحية</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "admin" | "engineer" | "accountant" | "supervisor") =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">مدير</SelectItem>
                    <SelectItem value="engineer">مهندس</SelectItem>
                    <SelectItem value="accountant">محاسب</SelectItem>
                    <SelectItem value="supervisor">مشرف</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "engineer" && (
                <div className="space-y-2">
                  <Label htmlFor="engineer_id">ربط بمهندس</Label>
                  <Select
                    value={formData.engineer_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, engineer_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر مهندس" />
                    </SelectTrigger>
                    <SelectContent>
                      {engineers?.map((eng) => (
                        <SelectItem key={eng.id} value={eng.id}>
                          {eng.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "جاري الإنشاء..." : "إنشاء المستخدم"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المستخدمين</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المدراء</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المهندسون</CardTitle>
            <HardHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engineerCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المحاسبون</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accountantCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المشرفون</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supervisorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>اسم المستخدم</TableHead>
                <TableHead>الاسم الظاهر</TableHead>
                <TableHead>الصفة</TableHead>
                <TableHead>الصلاحية</TableHead>
                <TableHead>المهندس المرتبط</TableHead>
                <TableHead>رمز الدخول</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    لا يوجد مستخدمون
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {user.email}
                    </TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {user.username || "-"}
                    </TableCell>
                    <TableCell>{user.display_name || "-"}</TableCell>
                    <TableCell>{user.title || "-"}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{user.engineer_name || "-"}</TableCell>
                    <TableCell>
                      {user.access_code ? (
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {user.access_code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(user.access_code!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateCodeMutation.mutate(user.id)}
                          disabled={generateCodeMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 ml-1" />
                          إنشاء رمز
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd MMM yyyy", {
                        locale: ar,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="تعديل البيانات"
                          onClick={() => {
                            setEditDialogUser(user);
                            setEditData({
                              email: user.email || "",
                              display_name: user.display_name || "",
                              username: user.username || "",
                              title: user.title || "",
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="تغيير كلمة المرور"
                          onClick={() => setPasswordDialogUser(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteUserId(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف صلاحيات هذا المستخدم. لن يتمكن من الوصول إلى النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Dialog */}
      <Dialog open={!!passwordDialogUser} onOpenChange={() => { setPasswordDialogUser(null); setNewPassword(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              تغيير كلمة المرور للمستخدم: <span className="font-medium">{passwordDialogUser?.email}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">كلمة المرور الجديدة</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الجديدة"
                minLength={6}
                dir="ltr"
              />
            </div>
            <Button
              className="w-full"
              disabled={newPassword.length < 6 || updatePasswordMutation.isPending}
              onClick={() => {
                if (passwordDialogUser) {
                  updatePasswordMutation.mutate({
                    userId: passwordDialogUser.id,
                    password: newPassword,
                  });
                }
              }}
            >
              {updatePasswordMutation.isPending ? "جاري التحديث..." : "تغيير كلمة المرور"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editDialogUser} onOpenChange={() => setEditDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_email">البريد الإلكتروني</Label>
              <Input
                id="edit_email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_username">اسم المستخدم (للدخول)</Label>
              <Input
                id="edit_username"
                value={editData.username}
                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                placeholder="اسم مستخدم فريد"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_display_name">الاسم الظاهر</Label>
              <Input
                id="edit_display_name"
                value={editData.display_name}
                onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                placeholder="الاسم الذي يظهر في النظام"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_title">الصفة / المسمى الوظيفي</Label>
              <Input
                id="edit_title"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                placeholder="مثال: مهندس مدني، مدير مشاريع"
              />
            </div>

            <Button
              className="w-full"
              disabled={updateUserMutation.isPending}
              onClick={() => {
                if (editDialogUser) {
                  updateUserMutation.mutate({
                    userId: editDialogUser.id,
                    ...editData,
                  });
                }
              }}
            >
              {updateUserMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
