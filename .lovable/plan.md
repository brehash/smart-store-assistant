

# Translate interface to Romanian

## Overview
Replace all English UI strings across the application with Romanian translations. This covers every user-facing label, button, placeholder, toast message, description, and heading.

## Scope — Files to modify

| File | Key strings to translate |
|------|------------------------|
| `src/pages/Auth.tsx` | Login/signup form labels, feature descriptions, invite text |
| `src/pages/Index.tsx` | Header title, empty state text, suggested prompts, toast messages, credit label |
| `src/pages/PackageSlips.tsx` | Config labels, tab names, buttons, confirmation dialogs, toast messages |
| `src/pages/Settings.tsx` | All tab labels, section headings, card titles/descriptions, buttons, language options |
| `src/components/chat/ConnectionSetupCard.tsx` | Step labels, button text, status messages |
| `src/components/chat/WebhookSetupCard.tsx` | Card title, descriptions, topic labels, buttons |
| `src/components/chat/ConversationSidebar.tsx` | Menu items, tooltips, section labels, dropdown items |
| `src/components/chat/ChatInput.tsx` | Placeholder text |
| `src/components/chat/CreditsModal.tsx` | Dialog title, section headings, labels, button text |
| `src/components/chat/DebugPanel.tsx` | "API Responses", "Request Args", "Response" labels |
| `src/components/chat/ReasoningBubbles.tsx` | "Thought for Xs", "Process stopped" labels |
| `src/components/chat/ApprovalCard.tsx` | "Approved", "Skipped", "Edited & Approved" labels, buttons |
| `src/components/chat/QuestionCard.tsx` | "Other..." placeholder, "Send" button |
| `src/components/chat/OrderFormCard.tsx` | Form labels, buttons, placeholders |
| `src/components/chat/GeoReportCard.tsx` | Report headings and labels |
| `src/components/settings/TeamSettings.tsx` | Team management labels, invite form, dialogs |
| `src/components/chat/ShippingTimeline.tsx` | Already mostly in Romanian — verify and keep |

## Translation approach

All strings will be hardcoded in Romanian directly in the components (no i18n library). This matches the current approach where strings are inline. Examples:

- "Sign in" → "Autentificare"
- "Create account" → "Creează cont"
- "Settings" → "Setări"
- "New Chat" → "Chat nou"
- "Search chats..." → "Caută conversații..."
- "Credits & Plans" → "Credite & Planuri"
- "Save" → "Salvează"
- "Delete" → "Șterge"
- "Cancel" → "Anulează"
- "Package Slips" → "Fișe de ambalare"
- "How can I help you?" → "Cu ce te pot ajuta?"
- "Ask about products, orders, analytics..." → "Întreabă despre produse, comenzi, analize..."
- "Connection lost" → "Conexiune pierdută"
- "Test Connection" → "Testează conexiunea"
- "Mark as Packed" → "Marchează ca împachetat"

## Technical notes

- The Settings page LANGUAGES array and language selector will remain unchanged (language names stay in English as identifiers)
- Toast messages across all files will be translated
- The `title.html` won't change (it's a meta concern)
- Edge function responses stay in English (server-side, controlled by AI response language setting)
- No new dependencies needed

