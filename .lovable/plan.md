

# Implement Brevo API for Auth Emails

## Overview
Create an edge function that acts as a Supabase Auth email hook, intercepting auth emails (signup confirmation, password reset, magic link, etc.) and sending them via Brevo's transactional email API.

## Changes

### 1. Store Brevo API Key as a secret
- Use the `add_secret` tool to request `BREVO_API_KEY` from the user

### 2. Create `supabase/functions/brevo-email-hook/index.ts`
Edge function that:
- Receives Supabase Auth webhook payloads (signup, recovery, magic_link, email_change, reauthentication)
- Renders appropriate HTML email content per email type with branded templates
- Calls Brevo's `https://api.brevo.com/v3/smtp/email` API to send the email
- Uses the `BREVO_API_KEY` secret for authentication
- Includes CORS headers and proper error handling
- Handles all auth email types: `signup`, `recovery`, `magiclink`, `invite`, `email_change`, `reauthentication`

Each email type will have:
- A subject line
- HTML body with the confirmation/action URL and branded styling matching the app's primary colors
- Sender configured as `noreply@yourdomain.com` (configurable)

### 3. Database migration — register the Auth email hook
Register the edge function as the Supabase Auth `send_email` hook so auth emails are routed through Brevo instead of the default mailer:

```sql
-- No migration needed; we'll configure this via the edge function approach
```

Actually, the Auth hook registration requires using `supabase/config.toml` or the Auth hook API. Since this is Lovable Cloud, we'll set up the edge function and the user will need the hook to be wired. We'll handle this by creating a self-contained edge function that Supabase Auth calls.

### 4. Configure sender email
The user will need to specify:
- Sender email address (must be verified in Brevo)
- Sender name

We'll ask the user for these details or use sensible defaults.

## Technical Details

**Brevo API call pattern:**
```typescript
await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": BREVO_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sender: { name: "Your App", email: "noreply@yourdomain.com" },
    to: [{ email: recipientEmail }],
    subject: subject,
    htmlContent: htmlBody,
  }),
});
```

**Email templates** will be inline HTML with the app's brand colors (extracted from CSS variables) for: confirmation, password reset, magic link, email change, and reauthentication.

## Questions to Clarify
- Sender email and name to use in Brevo (must be verified in their Brevo account)

