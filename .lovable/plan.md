

# Create `supabase/seed.sql` from Current Database Data

## What It Does

Generates a seed file containing INSERT statements for all reference/config data so you can run `supabase db reset` or `psql -f supabase/seed.sql` on your Ubuntu server to populate tables after a fresh migration.

## Tables to Seed

Only reference/config tables (not user-generated data):

1. **`subscription_plans`** — 4 rows (Starter, Growth, Pro, Enterprise)
2. **`credit_topup_packs`** — 4 rows (Starter, Basic, Plus, Max)
3. **`app_settings`** — 1 row (enable_topup_modal)

User-specific tables (profiles, messages, conversations, etc.) are excluded since they depend on auth users.

## File: `supabase/seed.sql`

Will contain:
- `INSERT ... ON CONFLICT DO NOTHING` statements for idempotent seeding
- Exact IDs, values, and sort orders from the current database
- Comments grouping each table's inserts

## Scope
One new file, no code changes needed.

