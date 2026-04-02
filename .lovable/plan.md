

# Mobile Responsiveness Fixes — Index + Auth Pages

## Issues

1. **Index.tsx**: Uses `h-screen` which on mobile browsers (Safari/Chrome) doesn't account for the address bar, causing content to overflow or the input to be hidden behind the browser chrome.
2. **Auth.tsx**: Uses `min-h-screen` with the same mobile browser chrome issue. The form padding (`p-6`) is generous for small screens.

## Changes

### 1. `src/pages/Index.tsx`

- Replace `h-screen` with `h-[100dvh]` (dynamic viewport height) which accounts for mobile browser chrome.
- The empty state container already has `h-full` + `justify-center` — this should work correctly once the parent uses `dvh`.

### 2. `src/pages/Auth.tsx`

- Replace `min-h-screen` with `min-h-[100dvh]`.
- Reduce form panel padding on mobile: `p-4 sm:p-6`.
- Scale down heading/icon sizes on mobile: card title `text-xl sm:text-2xl`, icon container `h-10 w-10 sm:h-12 sm:w-12`.
- Add `safe-area-inset` padding for notched devices if needed.

### 3. `src/index.css` (if needed)

- Add a global `@supports` fallback for browsers that don't support `dvh`:
  ```css
  :root { --vh: 100vh; }
  @supports (height: 100dvh) { :root { --vh: 100dvh; } }
  ```

## Files

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | `h-screen` → `h-[100dvh]` |
| `src/pages/Auth.tsx` | `min-h-screen` → `min-h-[100dvh]`, tighter mobile padding/sizing |

