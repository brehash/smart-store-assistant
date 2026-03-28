

## Always-Visible Credit Balance

### Problem
Credits are only shown in the chat header after the first message is sent (populated from stream events). On page load, `creditBalance` is `null` so nothing renders.

### Changes

**`src/pages/Index.tsx`**
- Add a `useEffect` that fetches the user's credit balance from `credit_balances` table on mount (and when `user` changes)
- Call `refill_credits_if_due` RPC first to ensure balance is current, then set `creditBalance` from the result
- Keep the existing stream-event update so the badge stays live after each message

This is a small change — roughly 10-15 lines added to the existing file. The UI badge already exists (line 523-527), it just needs data on load.

