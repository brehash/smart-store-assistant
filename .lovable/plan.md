

## Two Small Fixes

### 1. OpenAI API Key — toggle visibility
In `src/pages/Settings.tsx` (line ~282), replace the plain `type="password"` `<Input>` with an input that has a show/hide toggle button (eye icon). Add a `showApiKey` boolean state; when true, render `type="text"`, otherwise `type="password"`. Place an `Eye`/`EyeOff` icon button inside the input wrapper.

### 2. Move the close "X" button into the settings sidebar
The current `DialogContent` uses the default Radix close button (top-right corner of the modal). To move it into the settings sidebar:
- In `Index.tsx`, pass a custom `DialogContent` without the default close button (add `className` to hide it or use a custom wrapper without the auto-close button).
- In `Settings.tsx`, add a close button (X icon) at the top of the sidebar nav panel, and accept an `onClose` callback prop to trigger it.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Add `showApiKey` state + eye toggle on API key input; add `onClose` prop + X button at top of sidebar nav |
| `src/pages/Index.tsx` | Pass `onClose` to `SettingsContent`; hide default DialogContent close button |

