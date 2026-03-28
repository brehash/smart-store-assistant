

## Token Tracking + Admin Panel

### Feature 1: Token Usage Tracking

**How it works**: The OpenAI API response already includes `usage: { prompt_tokens, completion_tokens, total_tokens }` in `aiData`. We accumulate tokens across all iterations in the while loop, then send the total to the frontend via a new SSE event `token_usage`, and persist it in the `messages` table metadata.

**Changes:**

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Accumulate `aiData.usage` across iterations; emit `{ type: "token_usage", prompt_tokens, completion_tokens, total_tokens }` SSE event before `[DONE]` |
| `src/lib/chat-stream.ts` | Handle `token_usage` event type, pass to callback |
| `src/pages/Index.tsx` | Receive token_usage event, store in metadata, display small token count badge on assistant messages |
| `src/components/chat/ChatMessage.tsx` | Add optional `tokenUsage` prop, render as subtle text below message (e.g. "423 tokens") |

### Feature 2: Admin Panel

**Database changes (migration):**

1. **`user_roles` table** — stores admin roles per user (following the required pattern with `app_role` enum)
2. **`message_limits` table** — stores per-user daily/monthly message limits
3. Add `token_usage` column (jsonb) to `messages` table for queryability
4. RLS policies: admins can read all users, conversations, messages; regular users unchanged

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admins can see all data
CREATE POLICY "Admins can view all messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all conversations" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.message_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_limit int DEFAULT 50,
  monthly_limit int DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.message_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage limits" ON public.message_limits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own limits" ON public.message_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS token_usage jsonb;
```

**New edge function: `supabase/functions/admin/index.ts`**
- Validates caller has admin role
- Endpoints: `GET /users` (list all profiles + message counts + token totals), `GET /users/:id/messages`, `PUT /users/:id/limits`, `GET /stats` (aggregate usage)

**New frontend pages/components:**

| File | Purpose |
|------|---------|
| `src/pages/Admin.tsx` | Admin dashboard with tabs: Users, Messages, Usage Stats |
| `src/components/admin/UsersTable.tsx` | List all users with message count, total tokens, limits |
| `src/components/admin/UserDetail.tsx` | View user's conversations/messages, edit limits |
| `src/components/admin/UsageStats.tsx` | Charts showing token usage over time, active users |
| `src/App.tsx` | Add `/admin` route with admin-only protection |
| `src/components/AdminRoute.tsx` | ProtectedRoute variant that checks `has_role(admin)` |

**Message limit enforcement** in `supabase/functions/chat/index.ts`:
- Before processing, query `message_limits` and count today's/this month's messages for the user
- If exceeded, return error SSE: "You've reached your daily message limit"

### Files to modify/create

| File | Action |
|------|--------|
| `supabase/functions/chat/index.ts` | Add token accumulation, emit token_usage SSE, check message limits |
| `supabase/functions/admin/index.ts` | **New** — admin API edge function |
| `src/lib/chat-stream.ts` | Handle `token_usage` event |
| `src/pages/Index.tsx` | Store token usage in metadata |
| `src/components/chat/ChatMessage.tsx` | Display token count |
| `src/pages/Admin.tsx` | **New** — admin dashboard |
| `src/components/admin/UsersTable.tsx` | **New** — users list |
| `src/components/admin/UserDetail.tsx` | **New** — user detail/limits |
| `src/components/admin/UsageStats.tsx` | **New** — usage charts |
| `src/components/AdminRoute.tsx` | **New** — admin route guard |
| `src/App.tsx` | Add admin route |
| DB migration | Create user_roles, message_limits tables, has_role function, admin RLS policies, token_usage column |

