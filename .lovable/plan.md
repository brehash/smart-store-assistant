

## Store OpenAI API Key as a Platform Secret

Currently the OpenAI API key is stored per-user in the `woo_connections` table. This change moves it to a platform-level Supabase secret (`OPENAI_API_KEY`), removing it from the database and the Settings UI.

### Changes

#### 1. Add the secret
- Use `add_secret` tool to prompt user for their `OPENAI_API_KEY` value

#### 2. `supabase/functions/chat/index.ts`
- Replace `connData?.openai_api_key` with `Deno.env.get("OPENAI_API_KEY")`
- Remove `openai_api_key` from the `.select()` query on `woo_connections`

#### 3. `src/pages/Settings.tsx`
- Remove the OpenAI API Key input field, `showApiKey` state, and `openaiApiKey` state
- Remove `openai_api_key` from the save payload

#### 4. Database migration
- Drop the `openai_api_key` column from `woo_connections` (optional cleanup)

### Files to modify
| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Read key from `Deno.env` instead of DB |
| `src/pages/Settings.tsx` | Remove API key UI |

