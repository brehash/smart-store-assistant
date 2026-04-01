

# Interactive GEO Audit Actions

## What changes

After a GEO audit displays the score and recommendations, the card will show clickable action buttons derived from the recommendations. The user clicks a button (e.g. "Generate JSON-LD & FAQ", "Optimize Meta Description") and that action is sent as a chat message, triggering the corresponding GEO generation flow.

## Design

The `GeoReportCard` will receive an `onAction` callback. Below the recommendations list, a row of action buttons appears — each mapped from a recommendation. The buttons send a pre-formatted message like `"Generează JSON-LD și FAQ pentru [product] #[id]"` back to the chat input.

## Files to modify

### 1. `src/components/chat/GeoReportCard.tsx`
- Add `onAction?: (message: string) => void` prop to `GeoReportCard`
- Add `GeoReportData.entityId` (already exists) usage
- After the recommendations section, render a "Ce vrei să optimizezi?" section with buttons:
  - Map each recommendation to an actionable button
  - Add a "Generează tot" (Generate All) primary button that triggers full GEO content generation
  - Each button calls `onAction` with a natural-language message like `"Generează meta description optimizată pentru [entityName] #[entityId]"` or `"Generează JSON-LD, FAQ și meta description pentru [entityName] #[entityId]"`
  - Buttons are disabled when no `onAction` is provided
  - Show only for `mode === "single"` audit results (not bulk, not generation previews)

### 2. `src/components/chat/ChatMessage.tsx`
- Add `onSendMessage?: (message: string) => void` prop
- Pass it to `GeoReportCard` as `onAction`

### 3. `src/pages/Index.tsx`
- Pass the existing `handleSend` (or a wrapper) as `onSendMessage` to `ChatMessage`

### Action mapping logic (in GeoReportCard)
Group recommendations into predefined action categories:
- "meta description" recs → button: "Optimizează Meta Description"
- "FAQ" / "structured data" / "JSON-LD" recs → button: "Generează JSON-LD & FAQ"  
- "description" / "content" recs → button: "Optimizează Descrierea"
- Always show: "Generează tot" → triggers `generate_geo_content` for the full entity

Each button sends a message like: `"Generează [action] pentru produsul [entityName] (ID: [entityId])"`

