

## Credit Top-Up Packs — Profitable Pricing

### Top-Up Tiers (one-time purchases, max 1000 credits)

| Pack | Credits | Price | Cost per Credit | Your Margin vs base |
|------|---------|-------|-----------------|---------------------|
| **Starter** | 100 | $12 | $0.120 | baseline |
| **Basic** | 250 | $27 | $0.108 | 10% discount to user |
| **Plus** | 500 | $49 | $0.098 | 18% discount to user |
| **Max** | 1,000 | $89 | $0.089 | 26% discount to user |

Even the biggest pack keeps a healthy margin — users get a volume discount but you still profit well above cost on every tier.

### Implementation

#### 1. Database Migration
- Create `credit_topup_packs` table: `id`, `name`, `credits` (int), `price_cents` (int), `is_active` (bool), `sort_order` (int)
- Seed with the 4 packs above
- RLS: public SELECT for all authenticated users, admin-only for mutations

#### 2. Admin Edge Function (`supabase/functions/admin/index.ts`)
- `GET /topup-packs` — list all packs
- `PUT /topup-packs/:id` — admin edits a pack (credits, price, active status)

#### 3. Settings Page — "Credits" Tab (`src/pages/Settings.tsx`)
- Add a new "Credits" tab showing:
  - Current balance and plan info
  - Top-up pack cards with "Buy" buttons (for now, admin-assigned — no Stripe yet)
  - Each card shows credits, price, and per-credit cost

#### 4. Admin UI — Plans Manager (`src/components/admin/PlansManager.tsx`)
- New component: table of top-up packs with inline editing (credits, price, active toggle)
- Add as a tab in Admin page

### Files to Create/Modify

| File | Action |
|------|--------|
| DB migration | Create `credit_topup_packs`, seed 4 packs |
| `supabase/functions/admin/index.ts` | Add topup-pack CRUD routes |
| `src/pages/Settings.tsx` | Add "Credits" tab with pack display |
| `src/components/admin/PlansManager.tsx` | Create — admin pack management |
| `src/pages/Admin.tsx` | Add "Plans" tab linking to PlansManager |

