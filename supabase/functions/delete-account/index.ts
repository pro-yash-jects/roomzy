import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendOtpEmail(email: string, code: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Roomzy <onboarding@resend.dev>",
      to: [email],
      subject: "Your Account Deletion Code",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 32px;">
          <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 22px; font-weight: 700;">Account Deletion Verification</h2>
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">You requested to delete your account. Use the code below to confirm:</p>
          <div style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 0.5em; color: #1a1a1a; font-family: monospace;">${code.split('').join(' ')}</span>
          </div>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send email [${res.status}]: ${body}`);
  }
}

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

    // ACTION: generate-code — generate a 6-digit code and email it
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

      // Send the code via email
      await sendOtpEmail(user.email!, code);

      return new Response(JSON.stringify({ success: true }), {
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
