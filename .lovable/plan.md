

# Translate interface to Romanian

All files still contain English strings. The translation needs to be applied now.

## Files to modify (16 files)

| File | Key changes |
|------|------------|
| `src/pages/Auth.tsx` | Feature labels, form labels, toast messages, invite text |
| `src/pages/Index.tsx` | Header, empty state, suggested prompts, toasts, webhook labels |
| `src/pages/PackageSlips.tsx` | Tab names, buttons, dialogs, toasts |
| `src/pages/Settings.tsx` | Tab labels, section headings, buttons |
| `src/components/chat/ChatInput.tsx` | Placeholder text |
| `src/components/chat/ConversationSidebar.tsx` | Menu items, tooltips, dropdown items |
| `src/components/chat/ConnectionSetupCard.tsx` | Step labels, buttons, status messages |
| `src/components/chat/WebhookSetupCard.tsx` | Card title, topic labels, buttons |
| `src/components/chat/CreditsModal.tsx` | Dialog title, labels, buttons |
| `src/components/chat/DebugPanel.tsx` | "API Responses", "Request Args", "Response" |
| `src/components/chat/ReasoningBubbles.tsx` | "Thought for Xs", "Process stopped" |
| `src/components/chat/ApprovalCard.tsx` | Status labels, buttons |
| `src/components/chat/QuestionCard.tsx` | "Other..." placeholder, "Send" button |
| `src/components/chat/OrderFormCard.tsx` | Form labels, buttons |
| `src/components/chat/GeoReportCard.tsx` | Report headings |
| `src/components/settings/TeamSettings.tsx` | Team management labels, invite form |

## Approach

Inline replacement of all English strings with Romanian equivalents. No i18n library — matches existing pattern. Key translations:

- "Sign in" → "Autentificare" | "Create account" → "Creează cont"
- "Welcome back" → "Bine ai revenit" | "Settings" → "Setări"
- "New Chat" → "Chat nou" | "Search chats..." → "Caută conversații..."
- "Save" → "Salvează" | "Delete" → "Șterge" | "Cancel" → "Anulează"
- "Ask about products, orders, analytics..." → "Întreabă despre produse, comenzi, analize..."
- Toast/error messages all translated
- Edge function responses stay in English (server-side)

