import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const body = await req.json();
    const { action, target_user_id, payload } = body ?? {};
    if (!action || !target_user_id) return json({ error: "Missing action/target_user_id" }, 400);

    if (action === "approve") {
      await admin.from("profiles").update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: callerId,
      }).eq("id", target_user_id);
      return json({ success: true });
    }

    if (action === "reject") {
      await admin.from("profiles").update({ status: "rejected" }).eq("id", target_user_id);
      return json({ success: true });
    }

    if (action === "deactivate") {
      await admin.from("profiles").update({ status: "inactive" }).eq("id", target_user_id);
      return json({ success: true });
    }

    if (action === "reactivate") {
      await admin.from("profiles").update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: callerId,
      }).eq("id", target_user_id);
      return json({ success: true });
    }

    if (action === "set_role") {
      const role = payload?.role;
      if (!["admin", "penguji", "guru", "parent"].includes(role))
        return json({ error: "Invalid role" }, 400);
      await admin.from("user_roles").delete().eq("user_id", target_user_id);
      await admin.from("user_roles").insert({ user_id: target_user_id, role });
      return json({ success: true });
    }

    if (action === "update_profile") {
      const allowed = [
        "full_name", "username", "whatsapp", "bio", "jabatan",
        "title", "nip", "display_name_rapor", "display_name_certificate",
        "assigned_classes",
      ];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) if (k in (payload ?? {})) updates[k] = payload[k];
      if (Object.keys(updates).length) {
        const { error } = await admin.from("profiles").update(updates).eq("id", target_user_id);
        if (error) throw error;
      }
      if (payload?.email) {
        const { error } = await admin.auth.admin.updateUserById(target_user_id, { email: payload.email });
        if (error) throw error;
        await admin.from("profiles").update({ email: payload.email }).eq("id", target_user_id);
      }
      return json({ success: true });
    }

    if (action === "reset_password") {
      const mode = payload?.mode ?? "temporary";
      if (mode === "temporary") {
        const newPass = payload?.password || cryptoRandomPassword();
        const { error } = await admin.auth.admin.updateUserById(target_user_id, { password: newPass });
        if (error) throw error;
        return json({ success: true, temporary_password: newPass });
      }
      if (mode === "link") {
        const { data: userInfo } = await admin.auth.admin.getUserById(target_user_id);
        const email = userInfo?.user?.email;
        if (!email) return json({ error: "User has no email" }, 400);
        const { data, error } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (error) throw error;
        return json({ success: true, action_link: data.properties?.action_link });
      }
      return json({ error: "Invalid mode" }, 400);
    }

    if (action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(target_user_id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Operation failed" }, 400);
  }
});

function cryptoRandomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}