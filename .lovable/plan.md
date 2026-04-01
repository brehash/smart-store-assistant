

# Fix GEO Audit Action Buttons Not Rendering

## Root Cause

Two issues prevent the buttons from appearing:

1. **Falsy `entityId` check** — Line 269 in `GeoReportCard.tsx` uses `data.entityId` as a truthy check. When the product ID is `0` (or any falsy value), the entire action buttons section is hidden. Same issue in `deriveActions` (line 97).

2. **No `entityId` in data from backend** — The session replay shows `#0`, meaning the `entity_id` from the backend might not be correctly passed through to the richContent data.

## Fix (2 files)

### 1. `src/components/chat/GeoReportCard.tsx`

- **Line 97**: Change `!data.entityId` to `data.entityId == null` so `0` doesn't block it
- **Line 269**: Change `data.entityId` to `data.entityId != null` — same fix for the render guard

### 2. `supabase/functions/chat/tool-executor.ts`

- **Line 954**: The `generate_geo_content` handler rejects `entity_id === 0` — verify the `audit_geo` handler properly resolves the product ID before building the report. If the product search returns an ID, it should be correctly threaded into `reportData.entityId`.

These are minimal one-line fixes that unblock the existing button rendering logic.

