import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = "wcai@kconcept.ro";
const SENDER_NAME = "WooCommerce AI Assistant";
const PRIMARY = "hsl(262, 83%, 58%)";
const PRIMARY_FG = "#ffffff";
const FOREGROUND = "hsl(222, 47%, 11%)";
const MUTED_FG = "hsl(220, 9%, 46%)";
const BG = "#ffffff";

function emailWrap(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:${BG};border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
        <tr><td style="background:${PRIMARY};padding:28px 32px;">
          <h1 style="margin:0;font-size:20px;color:${PRIMARY_FG};font-weight:700;">${SENDER_NAME}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;font-size:22px;color:${FOREGROUND};font-weight:700;">${title}</h2>
          ${body}
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #e5e5e5;">
          <p style="margin:0;font-size:12px;color:${MUTED_FG};text-align:center;">
            &copy; ${new Date().getFullYear()} ${SENDER_NAME}. All rights reserved.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${PRIMARY};border-radius:8px;padding:12px 28px;">
      <a href="${url}" style="color:${PRIMARY_FG};text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">${text}</a>
    </td></tr>
  </table>`;
}

function txt(t: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${FOREGROUND};">${t}</p>`;
}

async function sendBrevoEmail(to: string, subject: string, html: string) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Brevo error:", res.status, body);
    throw new Error(`Brevo API error: ${res.status}`);
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/team\/?/, "").replace(/\/$/, "");

    // ── PUBLIC: Get invite info by token (no auth required) ──
    if (req.method === "GET" && url.searchParams.has("invite_info")) {
      const token = url.searchParams.get("invite_info");
      if (!token) return json({ error: "Token required" }, 400);

      const { data: invitation } = await serviceClient
        .from("team_invitations")
        .select("email, team_id, invited_by, status, expires_at")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();

      if (!invitation) return json({ error: "Invalid or expired invitation" }, 404);
      if (new Date(invitation.expires_at) < new Date()) return json({ error: "Invitation has expired" }, 410);

      const { data: team } = await serviceClient
        .from("teams")
        .select("name")
        .eq("id", invitation.team_id)
        .single();

      const { data: { user: inviter } } = await serviceClient.auth.admin.getUserById(invitation.invited_by);
      const inviterName = inviter?.user_metadata?.full_name || inviter?.email?.split("@")[0] || "Someone";

      return json({
        email: invitation.email,
        team_name: team?.name || "Unknown team",
        inviter_name: inviterName,
      });
    }

    // ── All other endpoints require auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await serviceClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);
    const userId = user.id;

    const body = req.method === "POST" || req.method === "DELETE"
      ? await req.json().catch(() => ({}))
      : {};

    // ── GET: Get user's team info ──
    if (req.method === "GET" && (!path || path === "")) {
      // Check for invite acceptance
      const token = url.searchParams.get("accept_token");
      if (token) {
        return await handleAcceptInvitation(serviceClient, userId, user, token);
      }

      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership) return json({ team: null });

      const { data: team } = await serviceClient
        .from("teams")
        .select("*")
        .eq("id", membership.team_id)
        .single();

      const { data: members } = await serviceClient
        .from("team_members")
        .select("*")
        .eq("team_id", membership.team_id);

      // Get member profiles
      const memberIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", memberIds);

      // Get member emails from auth
      const membersWithInfo = await Promise.all(
        (members || []).map(async (m: any) => {
          const profile = (profiles || []).find((p: any) => p.user_id === m.user_id);
          const { data: { user: memberUser } } = await serviceClient.auth.admin.getUserById(m.user_id);
          return {
            ...m,
            display_name: profile?.display_name || memberUser?.email?.split("@")[0] || "Unknown",
            avatar_url: profile?.avatar_url,
            email: memberUser?.email || "",
          };
        })
      );

      const { data: invitations } = await serviceClient
        .from("team_invitations")
        .select("*")
        .eq("team_id", membership.team_id)
        .eq("status", "pending");

      // Get team credit balance
      const { data: creditBalance } = await serviceClient
        .from("credit_balances")
        .select("*")
        .eq("team_id", membership.team_id)
        .maybeSingle();

      return json({
        team,
        members: membersWithInfo,
        invitations: invitations || [],
        creditBalance,
        userRole: membership.role,
      });
    }

    // ── POST: Create team ──
    if (req.method === "POST" && (!path || path === "")) {
      const { name } = body;
      if (!name?.trim()) return json({ error: "Team name is required" }, 400);

      // Check if user already in a team
      const { data: existing } = await serviceClient
        .from("team_members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) return json({ error: "You are already in a team" }, 400);

      // Create team
      const { data: team, error: teamErr } = await serviceClient
        .from("teams")
        .insert({ name: name.trim(), owner_id: userId })
        .select()
        .single();
      if (teamErr) throw teamErr;

      // Add owner as member
      await serviceClient.from("team_members").insert({
        team_id: team.id,
        user_id: userId,
        role: "owner",
      });

      // Link owner's credit balance to team
      await serviceClient
        .from("credit_balances")
        .update({ team_id: team.id })
        .eq("user_id", userId);

      return json({ team });
    }

    // ── POST: Invite member ──
    if (req.method === "POST" && path === "invite") {
      const { email } = body;
      if (!email?.trim()) return json({ error: "Email is required" }, 400);

      // Get user's team
      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return json({ error: "You don't have a team" }, 400);
      if (membership.role !== "owner") return json({ error: "Only team owner can invite" }, 403);

      const { data: team } = await serviceClient
        .from("teams")
        .select("name")
        .eq("id", membership.team_id)
        .single();

      // Check if already invited
      const { data: existingInv } = await serviceClient
        .from("team_invitations")
        .select("id")
        .eq("team_id", membership.team_id)
        .eq("email", email.trim().toLowerCase())
        .eq("status", "pending")
        .maybeSingle();
      if (existingInv) return json({ error: "Already invited" }, 400);

      // Check if already a member
      const { data: existingUser } = await serviceClient.auth.admin.listUsers();
      const invitedUser = existingUser?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
      );
      if (invitedUser) {
        const { data: existingMember } = await serviceClient
          .from("team_members")
          .select("id")
          .eq("team_id", membership.team_id)
          .eq("user_id", invitedUser.id)
          .maybeSingle();
        if (existingMember) return json({ error: "User is already a team member" }, 400);
      }

      const token = crypto.randomUUID();
      const { error: invErr } = await serviceClient.from("team_invitations").insert({
        team_id: membership.team_id,
        invited_by: userId,
        email: email.trim().toLowerCase(),
        token,
      });
      if (invErr) throw invErr;

      // Determine site URL and generate magic link for seamless sign-in
      const siteUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://intelibot-express.lovable.app";
      const redirectUrl = `${siteUrl}/auth?invite_token=${token}`;
      const inviterName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";

      // Auto-create user if they don't exist
      const targetEmail = email.trim().toLowerCase();
      let existingUserForInvite = invitedUser;
      if (!existingUserForInvite) {
        const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
          email: targetEmail,
          email_confirm: true,
        });
        if (createErr) {
          console.error("Error creating user for invite:", createErr);
        } else {
          existingUserForInvite = newUser?.user;
        }
      }

      // Generate magic link so the invitee can one-click sign in + accept
      let acceptUrl = redirectUrl; // fallback
      if (existingUserForInvite) {
        try {
          const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
            type: "magiclink",
            email: targetEmail,
            options: { redirectTo: redirectUrl },
          });
          if (!linkErr && linkData?.properties?.action_link) {
            acceptUrl = linkData.properties.action_link;
          } else {
            console.error("Magic link generation failed:", linkErr);
          }
        } catch (e) {
          console.error("Magic link error:", e);
        }
      }

      const emailHtml = emailWrap(
        "You're Invited! 🎉",
        txt(`Hi there,`) +
        txt(`<strong>${inviterName}</strong> has invited you to join the team <strong>${team?.name || "their team"}</strong> on ${SENDER_NAME}.`) +
        txt("Click the button below to accept the invitation and start collaborating.") +
        btn("Accept Invitation", acceptUrl) +
        `<p style="margin:14px 0 0;font-size:13px;color:${MUTED_FG};line-height:1.5;">This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.</p>`
      );

      await sendBrevoEmail(
        targetEmail,
        `You've been invited to join ${team?.name || "a team"}`,
        emailHtml
      );

      return json({ success: true });
    }

    // ── POST: Remove member ──
    if (req.method === "POST" && path === "remove-member") {
      const { memberId } = body;
      if (!memberId) return json({ error: "Member ID required" }, 400);

      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership || membership.role !== "owner")
        return json({ error: "Only team owner can remove members" }, 403);

      if (memberId === userId)
        return json({ error: "Cannot remove yourself. Delete the team instead." }, 400);

      // Unlink the removed member's credit balance from the team
      await serviceClient
        .from("credit_balances")
        .update({ team_id: null })
        .eq("user_id", memberId);

      await serviceClient
        .from("team_members")
        .delete()
        .eq("team_id", membership.team_id)
        .eq("user_id", memberId);

      return json({ success: true });
    }

    // ── POST: Cancel invitation ──
    if (req.method === "POST" && path === "cancel-invitation") {
      const { invitationId } = body;
      if (!invitationId) return json({ error: "Invitation ID required" }, 400);

      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership || membership.role !== "owner")
        return json({ error: "Only team owner can cancel invitations" }, 403);

      await serviceClient
        .from("team_invitations")
        .delete()
        .eq("id", invitationId)
        .eq("team_id", membership.team_id);

      return json({ success: true });
    }

    // ── POST: Leave team ──
    if (req.method === "POST" && path === "leave") {
      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return json({ error: "You're not in a team" }, 400);
      if (membership.role === "owner")
        return json({ error: "Team owner cannot leave. Delete the team instead." }, 400);

      // Unlink credit balance
      await serviceClient
        .from("credit_balances")
        .update({ team_id: null })
        .eq("user_id", userId);

      await serviceClient
        .from("team_members")
        .delete()
        .eq("team_id", membership.team_id)
        .eq("user_id", userId);

      return json({ success: true });
    }

    // ── POST: Delete team ──
    if (req.method === "POST" && path === "delete") {
      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership || membership.role !== "owner")
        return json({ error: "Only team owner can delete the team" }, 403);

      // Unlink all credit balances
      await serviceClient
        .from("credit_balances")
        .update({ team_id: null })
        .eq("team_id", membership.team_id);

      // Delete team (cascades to members and invitations)
      await serviceClient.from("teams").delete().eq("id", membership.team_id);

      return json({ success: true });
    }

    // ── GET: Team member usage stats ──
    if (req.method === "GET" && path === "usage") {
      const { data: membership } = await serviceClient
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership || membership.role !== "owner")
        return json({ error: "Only team owner can view usage" }, 403);

      const { data: members } = await serviceClient
        .from("team_members")
        .select("user_id")
        .eq("team_id", membership.team_id);

      const memberIds = (members || []).map((m: any) => m.user_id);
      
      // Get profiles for display names
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", memberIds);

      // Get message counts for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: messageCounts } = await serviceClient
        .from("messages")
        .select("user_id")
        .in("user_id", memberIds)
        .eq("role", "user")
        .gte("created_at", monthStart);

      // Get credit transactions for current month
      const { data: creditTxns } = await serviceClient
        .from("credit_transactions")
        .select("user_id, amount")
        .in("user_id", memberIds)
        .gte("created_at", monthStart);

      const usage = memberIds.map((uid: string) => {
        const profile = (profiles || []).find((p: any) => p.user_id === uid);
        const msgCount = (messageCounts || []).filter((m: any) => m.user_id === uid).length;
        const creditsUsed = (creditTxns || [])
          .filter((t: any) => t.user_id === uid && t.amount < 0)
          .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        return {
          user_id: uid,
          display_name: profile?.display_name || "Unknown",
          message_count: msgCount,
          credits_used: creditsUsed,
        };
      });

      return json(usage);
    }

    return json({ error: "Not found" }, 404);
  } catch (error: any) {
    console.error("Team function error:", error);
    return json({ error: error.message || "Internal error" }, 500);
  }
});

async function handleAcceptInvitation(
  serviceClient: any,
  userId: string,
  user: any,
  token: string
) {
  // Find invitation (any status)
  const { data: invitation } = await serviceClient
    .from("team_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return json({ error: "Invalid or expired invitation" }, 400);

  // If already accepted, check if user is already a member (idempotent)
  if (invitation.status === "accepted") {
    const { data: alreadyMember } = await serviceClient
      .from("team_members")
      .select("id")
      .eq("team_id", invitation.team_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (alreadyMember) {
      return json({ success: true, already_accepted: true, teamId: invitation.team_id });
    }
    // If accepted but user not a member (edge case), treat as invalid
    return json({ error: "This invitation has already been used" }, 400);
  }

  if (invitation.status !== "pending") {
    return json({ error: "Invalid or expired invitation" }, 400);
  }

  // Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    await serviceClient
      .from("team_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    return json({ error: "Invitation has expired" }, 400);
  }

  // Check if user is already in a team
  const { data: existingMembership } = await serviceClient
    .from("team_members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingMembership)
    return json({ error: "You are already in a team. Leave your current team first." }, 400);

  // Add to team
  await serviceClient.from("team_members").insert({
    team_id: invitation.team_id,
    user_id: userId,
    role: "member",
  });

  // Mark invitation as accepted
  await serviceClient
    .from("team_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id);

  // Merge credits: add user's individual balance to team balance, then link
  const { data: userBalance } = await serviceClient
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .is("team_id", null)
    .maybeSingle();

  const { data: teamBalance } = await serviceClient
    .from("credit_balances")
    .select("balance, user_id")
    .eq("team_id", invitation.team_id)
    .limit(1)
    .maybeSingle();

  if (userBalance && teamBalance) {
    // Add user's credits to team pool
    await serviceClient
      .from("credit_balances")
      .update({ balance: teamBalance.balance + userBalance.balance })
      .eq("team_id", invitation.team_id)
      .eq("user_id", teamBalance.user_id);
  }

  // Link user's balance row to team (set balance to 0 since merged)
  await serviceClient
    .from("credit_balances")
    .update({ team_id: invitation.team_id, balance: 0 })
    .eq("user_id", userId);

  // Send notification email to team owner
  const { data: team } = await serviceClient
    .from("teams")
    .select("name, owner_id")
    .eq("id", invitation.team_id)
    .single();

  if (team) {
    const { data: { user: owner } } = await serviceClient.auth.admin.getUserById(team.owner_id);
    if (owner?.email) {
      const memberName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";
      const notifHtml = emailWrap(
        "New Team Member! 🎉",
        txt(`Hi ${owner.user_metadata?.full_name || owner.email?.split("@")[0] || "there"},`) +
        txt(`Great news! <strong>${memberName}</strong> (${user.email}) has accepted your invitation and joined <strong>${team.name}</strong>.`) +
        txt("Their credits have been merged into your shared team balance.") +
        `<p style="margin:14px 0 0;font-size:13px;color:${MUTED_FG};line-height:1.5;">You can manage your team in the Settings → Team tab.</p>`
      );

      try {
        await sendBrevoEmail(
          owner.email,
          `${memberName} has joined your team`,
          notifHtml
        );
      } catch (e) {
        console.error("Failed to send acceptance notification:", e);
      }
    }
  }

  return json({ success: true, teamId: invitation.team_id });
}
