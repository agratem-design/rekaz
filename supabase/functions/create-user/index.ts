import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Only admins can create users
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "يجب أن تكون مديراً لإنشاء مستخدمين" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, display_name, role, engineer_id, username, title } = await req.json();

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "البريد الإلكتروني وكلمة المرور والصلاحية مطلوبة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with Admin API — no email confirmation needed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name || "" },
    });

    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        return new Response(JSON.stringify({ error: "هذا البريد الإلكتروني مسجل مسبقاً" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw authError;
    }

    if (!authData.user) throw new Error("فشل في إنشاء المستخدم");

    const userId = authData.user.id;

    // Wait for trigger to create profile
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Update profile
    const profileUpdate: Record<string, string | null> = {
      display_name: display_name || null,
      username: username || null,
      title: title || null,
    };
    if (engineer_id) profileUpdate.engineer_id = engineer_id;

    await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", userId);

    // Add role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
    });

    if (roleError) throw roleError;

    return new Response(
      JSON.stringify({
        message: "تم إنشاء المستخدم بنجاح — يمكنه تسجيل الدخول فوراً",
        user_id: userId,
        email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
