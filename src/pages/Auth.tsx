import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isOfflineMode } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, Lock, User } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string().min(3, "يرجى إدخال بريد إلكتروني أو اسم مستخدم صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

const Auth = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch company settings
  const { data: settings } = useQuery({
    queryKey: ["company-settings-auth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("company_name, company_logo")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate inputs
    const result = loginSchema.safeParse({ identifier, password });
    if (!result.success) {
      const fieldErrors: { identifier?: string; password?: string } = {};
      result.error.issues.forEach((err) => {
        if (err.path[0] === 'identifier') fieldErrors.identifier = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    // Determine if identifier is email or username
    let email = identifier;
    
    // If it doesn't contain @, resolve username to email
    if (!identifier.includes('@')) {
      let resolvedEmail: string | null = null;

      if (isOfflineMode) {
        // In offline mode, query profiles table directly
        const sanitized = identifier.trim().slice(0, 100);
        const { data: byUsername } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", sanitized)
          .maybeSingle();

        if (byUsername?.email) {
          resolvedEmail = byUsername.email;
        } else {
          const { data: byName } = await supabase
            .from("profiles")
            .select("email")
            .eq("display_name", sanitized)
            .maybeSingle();

          if (byName?.email) {
            resolvedEmail = byName.email;
          } else {
            const { data: byCode } = await supabase
              .from("profiles")
              .select("email")
              .eq("access_code", sanitized.toUpperCase())
              .maybeSingle();

            if (byCode?.email) {
              resolvedEmail = byCode.email;
            }
          }
        }
      } else {
        // Online mode: use edge function
        const { data, error: resolveError } = await supabase.functions.invoke("resolve-username", {
          body: { identifier },
        });
        if (!resolveError && data?.email) {
          resolvedEmail = data.email;
        }
      }

      if (!resolvedEmail) {
        toast({
          title: "خطأ",
          description: "اسم المستخدم أو رمز الدخول غير موجود",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      email = resolvedEmail;
    }

    const { error } = await signIn(email, password);

    if (error) {
      let message = "حدث خطأ في تسجيل الدخول";
      if (error.message.includes("Invalid login credentials")) {
        message = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
      } else if (error.message.includes("Email not confirmed")) {
        message = "يرجى تأكيد البريد الإلكتروني أولاً";
      }
      toast({
        title: "خطأ",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "مرحباً",
        description: "تم تسجيل الدخول بنجاح",
      });
      navigate("/");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
            {settings?.company_logo ? (
              <img 
                src={settings.company_logo} 
                alt={settings?.company_name || "شعار الشركة"}
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : (
              <Building2 className="w-10 h-10 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {settings?.company_name || "تسجيل الدخول"}
          </CardTitle>
          <CardDescription>
            أدخل بيانات الدخول للوصول إلى النظام
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">البريد الإلكتروني أو اسم المستخدم</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="example@email.com أو اسم المستخدم"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pr-10"
                  dir="ltr"
                />
              </div>
              {errors.identifier && (
                <p className="text-sm text-destructive">{errors.identifier}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  dir="ltr"
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جاري الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
