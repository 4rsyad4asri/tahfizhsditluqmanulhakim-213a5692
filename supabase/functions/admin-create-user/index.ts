import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Check if caller is admin using service role to avoid RLS issues
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only admins can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, full_name, role, username, whatsapp, bio, jabatan, title, nip, assigned_classes } = await req.json();

    // Server-side input validation
    if (!email || !password || !full_name || !role) {
      throw new Error("Missing required fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    if (typeof password !== "string" || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (!["admin", "penguji", "guru", "parent"].includes(role)) {
      throw new Error("Invalid role");
    }

    if (typeof full_name !== "string" || full_name.trim().length === 0 || full_name.length > 100) {
      throw new Error("Name must be 1-100 characters");
    }

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        username,
        whatsapp,
        bio,
        role,
        created_by_admin: true,
        approved_by: callerId,
      },
    });

    if (createErr) throw createErr;

    // Trigger already inserts role; only update extra profile fields
    const extras: Record<string, unknown> = {};
    if (jabatan) extras.jabatan = jabatan;
    if (title) extras.title = title;
    if (nip) extras.nip = nip;
    if (assigned_classes) extras.assigned_classes = assigned_classes;
    if (Object.keys(extras).length) {
      await adminClient.from("profiles").update(extras).eq("id", newUser.user.id);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Operation failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
