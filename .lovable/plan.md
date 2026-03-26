

## Move AI Response Language to General, Remove Settings Tab

### Changes in `src/pages/Settings.tsx`

1. **Remove "settings" from `TABS` array** (line 35) — delete the `{ id: "settings", label: "Settings", icon: Globe }` entry
2. **Remove `renderSettings` function** (lines 247-278) entirely
3. **Add language selector to `renderGeneral`** — insert a new Card with the AI Response Language `<Select>` between the profile card and the Change Password card (before line 221)
4. **Remove "settings" case from `renderTab` switch** (line 445)
5. **Update `SettingsTab` type** (line 29) — remove `"settings"` from the union
6. **Clean up unused imports** — remove `Globe` if no longer used elsewhere

### Changes in `src/pages/Index.tsx`
- If there are any references to `?settings=settings` as a default or redirect, update to use `general` instead

