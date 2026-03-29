

# Add Show/Hide Toggle to Secret Fields in Settings

## Overview
Add eye icon toggle buttons to the Consumer Key, Consumer Secret, and Colete Online Client Secret fields so users can reveal/hide the values.

## Changes

### `src/pages/Settings.tsx`

1. Add state variables for visibility toggles:
   - `showConsumerKey`, `showConsumerSecret`, `showColeteSecret` (booleans, default `false`)

2. Import `Eye` and `EyeOff` from `lucide-react`

3. Wrap each secret Input in a `relative` div and add an eye toggle button:
   - **Line 448** — Consumer Key: change `type="password"` to dynamic, add toggle button
   - **Line 449** — Consumer Secret: same treatment
   - **Line 729** — Colete Online Client Secret: same treatment

Each field will look like:
```tsx
<div className="relative">
  <Input type={showConsumerKey ? "text" : "password"} ... className="pr-10" />
  <button onClick={() => setShowConsumerKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 ...">
    {showConsumerKey ? <EyeOff /> : <Eye />}
  </button>
</div>
```

4 fields total (Consumer Key, Consumer Secret, Colete Client Secret). No other files changed.

