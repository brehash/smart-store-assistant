

# Settings: Response Language & OpenAI API Key

## Overview
Add two new settings sections: a language selector for AI response language (and pipeline labels), and an optional OpenAI API key field. When an OpenAI key is provided, the chat edge function calls OpenAI directly instead of the Lovable AI gateway.

## Changes

### 1. Database Migration
Add two columns to `woo_connections`:
- `response_language TEXT DEFAULT 'English'`
- `openai_api_key TEXT` (nullable)

This keeps all user settings in one row per user.

### 2. Settings Page (`src/pages/Settings.tsx`)
Add two new Card sections:

**AI Language** — A select dropdown with languages: English, Romanian, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, Greek, Russian, Chinese, Japanese, Korean (no Arabic/Hebrew/Farsi/Urdu).

**OpenAI API Key** — A password input for the user's OpenAI key. When set, the chat uses OpenAI directly with model `gpt-4o-mini` (the closest real OpenAI nano-tier model — `gpt-5.4-nano` does not exist yet; can be updated when available). A note explains this overrides the default AI provider.

### 3. Chat Edge Function (`supabase/functions/chat/index.ts`)
- Load `response_language` and `openai_api_key` from the user's `woo_connections` row
- Append to system prompt: `"Always respond in {language}. Pipeline step labels and plan titles must also be in {language}."`
- If `openai_api_key` is set: call `https://api.openai.com/v1/chat/completions` with model `gpt-4o-mini` using the user's key directly, instead of the Lovable AI gateway
- If not set: continue using Lovable AI gateway as before

### 4. Stream Function (`src/lib/chat-stream.ts`)
No changes needed — the backend handles provider routing transparently.

### Files Modified
- **Migration SQL** — add columns
- `src/pages/Settings.tsx` — language dropdown + OpenAI key input
- `supabase/functions/chat/index.ts` — language injection + OpenAI routing

