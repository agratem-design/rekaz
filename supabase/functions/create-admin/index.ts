import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid admin JWT — only an existing admin can call this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller's JWT
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

    // Only existing admins can create admin accounts
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "يجب أن تكون مديراً لإنشاء حساب مدير" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept email and password from request body — no hardcoded credentials
    const { email, password, display_name } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name || "المدير",
      },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ message: "المستخدم موجود مسبقاً", exists: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error("فشل في إنشاء المستخدم");
    }

    // Wait for trigger to create profile
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update profile with display name
    await supabaseAdmin
      .from("profiles")
      .update({ display_name: display_name || "المدير" })
      .eq("user_id", authData.user.id);

    // Add admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "admin",
      });

    if (roleError) {
      throw roleError;
    }

    return new Response(
      JSON.stringify({
        message: "تم إنشاء حساب الأدمن بنجاح",
        email,
        user_id: authData.user.id,
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
