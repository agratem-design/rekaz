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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { identifier } = await req.json();

    if (!identifier || typeof identifier !== "string" || identifier.length < 2) {
      return new Response(JSON.stringify({ error: "معرف غير صالح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize input
    const sanitized = identifier.trim().slice(0, 100);

    // Look up email by username, display_name, or access_code
    // Only return the email field — never expose other profile data
    let email: string | null = null;

    // Try username
    const { data: byUsername } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("username", sanitized)
      .maybeSingle();

    if (byUsername?.email) {
      email = byUsername.email;
    } else {
      // Try display_name
      const { data: byName } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("display_name", sanitized)
        .maybeSingle();

      if (byName?.email) {
        email = byName.email;
      } else {
        // Try access_code (uppercase)
        const { data: byCode } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("access_code", sanitized.toUpperCase())
          .maybeSingle();

        if (byCode?.email) {
          email = byCode.email;
        }
      }
    }

    if (!email) {
      // Return generic error — do NOT reveal whether user exists
      return new Response(JSON.stringify({ error: "اسم المستخدم أو رمز الدخول غير موجود" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير معروف";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
