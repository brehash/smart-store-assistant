import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_EMAIL = "wcai@kconcept.ro";
const SENDER_NAME = "WooCommerce AI Assistant";

// Brand colors extracted from the app's design system
const PRIMARY = "hsl(262, 83%, 58%)";
const PRIMARY_FG = "hsl(0, 0%, 100%)";
const FOREGROUND = "hsl(222, 47%, 11%)";
const MUTED_FG = "hsl(220, 9%, 46%)";
const BG = "#ffffff";

interface EmailPayload {
  user: {
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    confirmation_url?: string;
    email_action_type: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
    new_email?: string;
  };
}

function getEmailContent(payload: EmailPayload): { subject: string; html: string } | null {
  const { email_action_type, confirmation_url, token, new_email } = payload.email_data;
  const recipientName =
    (payload.user.user_metadata?.full_name as string) ||
    (payload.user.user_metadata?.display_name as string) ||
    payload.user.email.split("@")[0];

  const actionUrl = confirmation_url || "#";

  const wrap = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:${BG};border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${PRIMARY};padding:28px 32px;">
          <h1 style="margin:0;font-size:20px;color:${PRIMARY_FG};font-weight:700;">${SENDER_NAME}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;font-size:22px;color:${FOREGROUND};font-weight:700;">${title}</h2>
          ${body}
        </td></tr>
        <!-- Footer -->
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

  const button = (text: string, url: string) =>
    `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:${PRIMARY};border-radius:8px;padding:12px 28px;">
        <a href="${url}" style="color:${PRIMARY_FG};text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">${text}</a>
      </td></tr>
    </table>`;

  const text = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${FOREGROUND};">${t}</p>`;

  const muted = (t: string) =>
    `<p style="margin:14px 0 0;font-size:13px;color:${MUTED_FG};line-height:1.5;">${t}</p>`;

  switch (email_action_type) {
    case "signup":
      return {
        subject: "Confirm your email address",
        html: wrap(
          "Welcome! 👋",
          text(`Hi ${recipientName},`) +
            text("Thanks for signing up. Please confirm your email address to get started.") +
            button("Confirm Email", actionUrl) +
            muted("If you didn't create this account, you can safely ignore this email.")
        ),
      };

    case "recovery":
      return {
        subject: "Reset your password",
        html: wrap(
          "Password Reset",
          text(`Hi ${recipientName},`) +
            text("We received a request to reset your password. Click the button below to choose a new one.") +
            button("Reset Password", actionUrl) +
            muted("If you didn't request a password reset, you can safely ignore this email. The link will expire in 24 hours.")
        ),
      };

    case "magiclink":
      return {
        subject: "Your login link",
        html: wrap(
          "Magic Link Login",
          text(`Hi ${recipientName},`) +
            text("Click the button below to log in to your account. This link is valid for a limited time.") +
            button("Log In", actionUrl) +
            muted("If you didn't request this link, you can safely ignore this email.")
        ),
      };

    case "invite":
      return {
        subject: "You've been invited",
        html: wrap(
          "You're Invited! 🎉",
          text(`Hi ${recipientName},`) +
            text("You've been invited to join. Click the button below to accept the invitation and set up your account.") +
            button("Accept Invitation", actionUrl) +
            muted("If you weren't expecting this invitation, you can safely ignore this email.")
        ),
      };

    case "email_change":
      return {
        subject: "Confirm your email change",
        html: wrap(
          "Email Change Confirmation",
          text(`Hi ${recipientName},`) +
            text(`We received a request to change your email address${new_email ? ` to <strong>${new_email}</strong>` : ""}. Please confirm this change.`) +
            button("Confirm Email Change", actionUrl) +
            muted("If you didn't request this change, please secure your account immediately.")
        ),
      };

    case "reauthentication":
      return {
        subject: "Reauthentication code",
        html: wrap(
          "Verification Code",
          text(`Hi ${recipientName},`) +
            text("Use the following code to verify your identity:") +
            `<div style="margin:24px 0;text-align:center;">
              <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:${PRIMARY};background:hsl(262,83%,95%);padding:12px 24px;border-radius:8px;display:inline-block;">${token || "------"}</span>
            </div>` +
            muted("This code will expire shortly. If you didn't request this, please secure your account.")
        ),
      };

    default:
      console.warn(`Unknown email_action_type: ${email_action_type}`);
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const payload: EmailPayload = await req.json();
    console.log("Received auth email hook:", payload.email_data.email_action_type, "for", payload.user.email);

    const emailContent = getEmailContent(payload);
    if (!emailContent) {
      return new Response(
        JSON.stringify({ error: `Unsupported email type: ${payload.email_data.email_action_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brevoPayload = {
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: payload.user.email }],
      subject: emailContent.subject,
      htmlContent: emailContent.html,
    };

    const brevoRes = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    const brevoBody = await brevoRes.text();

    if (!brevoRes.ok) {
      console.error("Brevo API error:", brevoRes.status, brevoBody);
      return new Response(
        JSON.stringify({ error: "Failed to send email via Brevo", details: brevoBody }),
        { status: brevoRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully via Brevo:", brevoBody);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("brevo-email-hook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
