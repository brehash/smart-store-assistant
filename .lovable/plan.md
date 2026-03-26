

## Settings Modal Redesign: Sidebar Navigation with Sections

### Overview
Redesign the settings modal to use a two-panel layout like the ChatGPT screenshot: a left sidebar with navigation items and a right content area showing the active section. Add theme switching (System/Dark/Light), profile display, and account danger zone.

### Sections

| Tab | Icon | Content |
|-----|------|---------|
| **General** | Settings icon | Display name, email (read-only), registered date (read-only), password change |
| **Settings** | Globe | AI Response Language selector, OpenAI API Key |
| **Appearance** | Palette | System / Dark / Light theme toggle (new) |
| **Connection** | Store | WooCommerce connection + Default Order Statuses |
| **Account** | User | Account info summary + Danger Zone (delete account) |

### Changes by file

#### 1. `src/pages/Settings.tsx` — Full rewrite
- Replace single-page `SettingsContent` with a tabbed layout component
- Left panel (~w-56): vertical nav list with icons, highlight active tab
- Right panel: scrollable content area showing the active section
- Active tab persisted in URL as `?settings=general` / `?settings=appearance` etc.
- **General tab**: show user email, created_at from auth, editable display name (stored in woo_connections or a future profiles table — for now just show email + registration date), password change via `supabase.auth.updateUser`
- **Settings tab**: move Language selector and OpenAI key here
- **Appearance tab**: three-option selector (System / Dark / Light), apply `.dark` class to `<html>`, persist in localStorage
- **Connection tab**: existing WooCommerce connection card + order statuses card
- **Account tab**: account summary + red "Delete Account" button with confirmation dialog

#### 2. `src/pages/Index.tsx` — Minor update
- Change `?settings=true` to `?settings=general` (default tab)
- Pass the settings tab value to `SettingsContent`
- Update `handleOpenSettings` / `handleCloseSettings` accordingly

#### 3. `src/index.css` — No changes needed
- Dark theme variables already defined under `.dark` class

#### 4. `src/App.tsx` — Minor update
- Update redirect from `/?settings=true` to `/?settings=general`

### Theme implementation
- Read from `localStorage("theme")` on app mount (in `App.tsx` or `main.tsx`)
- Values: `"system"`, `"dark"`, `"light"`
- Apply/remove `.dark` class on `document.documentElement`
- For `"system"`: use `matchMedia("(prefers-color-scheme: dark)")` listener

### Files to modify
- `src/pages/Settings.tsx`
- `src/pages/Index.tsx`
- `src/App.tsx`
- `src/main.tsx` (theme init on load)

