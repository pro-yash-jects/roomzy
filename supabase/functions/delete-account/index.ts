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

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get all listings owned by this user
    const { data: listings } = await adminClient
      .from("listings")
      .select("id")
      .eq("host_id", user.id);

    const listingIds = (listings ?? []).map((l: { id: string }) => l.id);

    if (listingIds.length > 0) {
      // Delete listing images
      await adminClient.from("listing_images").delete().in("listing_id", listingIds);
      // Delete rooms
      await adminClient.from("rooms").delete().in("listing_id", listingIds);
      // Cancel bookings on host's listings
      await adminClient
        .from("bookings")
        .update({ status: "cancelled", cancelled_by: user.id, cancellation_reason: "Host account deleted" })
        .in("listing_id", listingIds)
        .neq("status", "cancelled");
      // Delete listings
      await adminClient.from("listings").delete().eq("host_id", user.id);
    }

    // Cancel guest bookings made by this user
    await adminClient
      .from("bookings")
      .update({ status: "cancelled", cancelled_by: user.id, cancellation_reason: "Guest account deleted" })
      .eq("guest_id", user.id)
      .eq("status", "confirmed");

    // Delete conversations (messages cascade automatically)
    await adminClient.from("conversations").delete().or(`guest_id.eq.${user.id},host_id.eq.${user.id}`);

    // Delete profile and role
    await adminClient.from("user_roles").delete().eq("user_id", user.id);
    await adminClient.from("profiles").delete().eq("id", user.id);

    // Delete avatar storage files
    const { data: avatarFiles } = await adminClient.storage.from("avatars").list(user.id);
    if (avatarFiles?.length) {
      await adminClient.storage.from("avatars").remove(
        avatarFiles.map((f: { name: string }) => `${user.id}/${f.name}`)
      );
    }

    // Finally delete the auth user
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
