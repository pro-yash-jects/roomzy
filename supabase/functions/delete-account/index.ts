import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "delete";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ACTION: generate-code — generate a 6-digit code and return it
    if (action === "generate-code") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      
      // Clear old codes for this user
      await adminClient.from("deletion_codes").delete().eq("user_id", user.id);
      
      // Store new code (expires in 10 minutes)
      await adminClient.from("deletion_codes").insert({
        user_id: user.id,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      return new Response(JSON.stringify({ success: true, code }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: delete — verify code and delete the account
    const { code } = body;
    if (!code || code.length !== 6) {
      return new Response(JSON.stringify({ error: "A valid 6-digit code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify code
    const { data: codeRow } = await adminClient
      .from("deletion_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (!codeRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark code as used
    await adminClient.from("deletion_codes").update({ used: true }).eq("id", codeRow.id);

    // Proceed with account deletion
    const { data: listings } = await adminClient
      .from("listings")
      .select("id")
      .eq("host_id", user.id);

    const listingIds = (listings ?? []).map((l: { id: string }) => l.id);

    if (listingIds.length > 0) {
      await adminClient.from("listing_images").delete().in("listing_id", listingIds);
      await adminClient.from("rooms").delete().in("listing_id", listingIds);
      await adminClient
        .from("bookings")
        .update({ status: "cancelled", cancelled_by: user.id, cancellation_reason: "Host account deleted" })
        .in("listing_id", listingIds)
        .neq("status", "cancelled");
      await adminClient.from("listings").delete().eq("host_id", user.id);
    }

    await adminClient
      .from("bookings")
      .update({ status: "cancelled", cancelled_by: user.id, cancellation_reason: "Guest account deleted" })
      .eq("guest_id", user.id)
      .eq("status", "confirmed");

    await adminClient.from("conversations").delete().or(`guest_id.eq.${user.id},host_id.eq.${user.id}`);
    await adminClient.from("deletion_codes").delete().eq("user_id", user.id);
    await adminClient.from("user_roles").delete().eq("user_id", user.id);
    await adminClient.from("profiles").delete().eq("id", user.id);

    const { data: avatarFiles } = await adminClient.storage.from("avatars").list(user.id);
    if (avatarFiles?.length) {
      await adminClient.storage.from("avatars").remove(
        avatarFiles.map((f: { name: string }) => `${user.id}/${f.name}`)
      );
    }

    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
