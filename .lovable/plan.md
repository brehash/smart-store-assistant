

## Fix Admin Credit Adjustment & Plan Assignment

### Root Causes
- **Credit input bug**: `parseInt(e.target.value) || 0` converts `-` (intermediate typing) to `0`, making it impossible to type negative numbers. Same issue prevents entering `0` as part of larger numbers.
- **Plans dropdown**: `loadPlans` silently fails — if the fetch errors, the dropdown is empty with no feedback.
- **No visual confirmation**: After adjusting credits or assigning a plan, the credit balance card at the top doesn't refresh to show the updated value.

### Changes

**`src/components/admin/UserDetail.tsx`**
1. Fix credit amount input to handle intermediate typing states (use string state for the input, parse only on submit)
2. Add error handling/toast for `loadPlans` failure
3. After successful credit adjustment or plan assignment, refresh the credit balance display
4. Reload credits data after plan assignment to reflect new monthly_allowance

This is a focused fix — roughly 15-20 lines changed in the existing file. No new files needed, no backend changes (backend already works correctly).

