

## Fix & Enhance: Token Tracking, Admin Credits, Subscription Plans, Credits Modal, User Creation

### Issues & Features

1. **Token usage not tracked** -- The chat edge function receives `aiData.usage` from each AI API call but never accumulates or emits it as a `token_usage` SSE event.
2. **Admin can't add credits to users** -- The credit adjustment UI in UserDetail exists but may have issues with the API call flow. Need to verify the edge function route works.
3. **Admin can't set subscription plans for users** -- No `subscription_plans` table or plan assignment mechanism exists yet.
4. **Credits badge should open upgrade/top-up modal** -- When clicking the credits badge in the header, show a modal with subscription plans and top-up packs. Admin toggle to enable/disable this feature.
5. **Admin should be able to create users** -- Add user creation form in admin panel.

---

### Implementation

#### 1. Fix Token Usage Tracking
**File: `supabase/functions/chat/index.ts`**
- Declare a `totalUsage` accumulator (`{ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }`) before the iteration loop
- After each `aiData = await aiResp.json()`, accumulate `aiData.usage` into `totalUsage`
- After the loop ends (before credit deduction), emit `sendSSE({ type: "token_usage", ...totalUsage })`

#### 2. Database Migration -- Subscription Plans & Admin Settings
- Create `subscription_plans` table: `id`, `name`, `slug`, `monthly_price_cents`, `credits`, `description`, `is_active`, `sort_order`
- Seed 4 plans: Starter ($9/100cr), Growth ($29/500cr), Pro ($59/1500cr), Enterprise ($149/5000cr)
- Add `plan_id` column (nullable UUID) to `credit_balances` referencing `subscription_plans`
- Create `app_settings` table: `id`, `key` (unique text), `value` (jsonb) -- for admin toggles like "enable_topup_modal"
- Seed default setting: `{ key: "enable_topup_modal", value: true }`
- RLS: authenticated SELECT on `subscription_plans` and `app_settings`; admin ALL on both

#### 3. Admin Edge Function Updates
**File: `supabase/functions/admin/index.ts`**
- `GET /plans` -- list subscription plans
- `PUT /plans/:id` -- edit a plan
- `PUT /users/:id/plan` -- assign plan to user (updates `credit_balances.plan_id` and `monthly_allowance`)
- `POST /users` -- create a new user via `serviceClient.auth.admin.createUser()` with email + password + optional display name
- `GET /settings` -- list app settings
- `PUT /settings/:key` -- update a setting value

#### 4. Admin UI -- User Creation
**File: `src/components/admin/UsersTable.tsx`**
- Add a "Create User" button that opens a dialog with email, password, display name fields
- On submit, call `POST /admin/users`

#### 5. Admin UI -- Plan Assignment in UserDetail
**File: `src/components/admin/UserDetail.tsx`**
- Add a plan selector (dropdown of subscription plans) in the Credit Management section
- On change, call `PUT /admin/users/:id/plan`

#### 6. Admin UI -- Toggle for Top-Up Modal
**File: `src/components/admin/PlansManager.tsx`**
- Add a switch "Enable credit top-up modal for users" that reads/writes to `app_settings`

#### 7. Credits Modal for Users
**File: `src/pages/Index.tsx`**
- Make the credits badge clickable
- Open a new `CreditsModal` component showing:
  - Current balance and plan info
  - Available subscription plans (upgrade options)
  - Top-up packs with pricing
  - "Contact admin" or placeholder for future payment
- Only show if `app_settings.enable_topup_modal` is true (fetch on load)

**New file: `src/components/chat/CreditsModal.tsx`**
- Displays subscription plans grid and top-up packs
- Fetches from `subscription_plans` and `credit_topup_packs` tables directly via Supabase client

#### 8. Fix Admin.tsx Duplicate Tab
**File: `src/pages/Admin.tsx`**
- Remove the duplicate `<TabsContent value="stats">` block (lines 92-94)

---

### Files to Create/Modify

| File | Action |
|------|--------|
| DB migration | Create `subscription_plans`, `app_settings`; add `plan_id` to `credit_balances`; seed data |
| `supabase/functions/chat/index.ts` | Add token usage accumulation and SSE emission |
| `supabase/functions/admin/index.ts` | Add routes: plans CRUD, user plan assignment, user creation, settings CRUD |
| `src/components/chat/CreditsModal.tsx` | New -- modal with plans & top-ups |
| `src/components/admin/UsersTable.tsx` | Add "Create User" dialog |
| `src/components/admin/UserDetail.tsx` | Add plan selector dropdown |
| `src/components/admin/PlansManager.tsx` | Add top-up modal toggle switch |
| `src/pages/Index.tsx` | Make credits badge clickable, open CreditsModal, fetch app_settings |
| `src/pages/Admin.tsx` | Remove duplicate stats tab |

