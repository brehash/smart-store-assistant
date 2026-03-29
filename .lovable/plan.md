

# Fix: Preferences Not Saving — CHECK Constraint Missing `meta_definition`

## Root Cause

The `user_preferences` table has a CHECK constraint that only allows three values:

```sql
CHECK (preference_type IN ('product_alias', 'shortcut', 'pattern'))
```

The `meta_definition` type was added to the tool definition and prompts but never added to this database constraint. Any insert with `preference_type = 'meta_definition'` fails silently at the database level.

## Fix

### Database Migration

Run a single migration to drop the old CHECK constraint and replace it with one that includes `meta_definition`:

```sql
ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_preference_type_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_preference_type_check
  CHECK (preference_type IN ('product_alias', 'shortcut', 'pattern', 'meta_definition'));
```

No code changes needed — the edge function code is already correct.

