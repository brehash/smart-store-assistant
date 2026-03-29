

# Package Slips Enhancements

## 1. New order notification bubble on Package Slips icon

**Sidebar (`ConversationSidebar.tsx`):**
- Accept a new prop `newOrderCount?: number` (passed from `Index.tsx`)
- In both collapsed and expanded views, show a red notification badge on the Package icon when `newOrderCount > 0`

**Index.tsx:**
- Add a `newOrderCount` state, increment it when a `order.created` webhook event arrives via the existing realtime channel
- Reset it when user navigates to `/package-slips` (or pass a reset callback)
- Pass `newOrderCount` to `ConversationSidebar`
- Also show the badge on the mobile hamburger `Menu` button when `newOrderCount > 0`

Only active when webhooks exist (the realtime subscription already only fires for users who have webhook events).

## 2. Prevent sidebar collapse on mobile

**Index.tsx:**
- On mobile (`< lg` breakpoint), force `sidebarCollapsed` to `false` and skip the toggle. The sidebar is already an overlay on mobile — just prevent the collapse toggle from doing anything on small screens.
- Hide the collapse/expand button in the sidebar on mobile, or make `onToggle` a no-op when mobile.

## 3. Notification bubble on mobile hamburger icon

**Index.tsx:**
- On the `<Button>` that opens the mobile sidebar overlay, render a small red dot/badge when `newOrderCount > 0`

## 4. Printable package slip

**PackageSlips.tsx:**
- Add a "Print" button on each order slip card
- On click, open a new window/iframe with a print-friendly HTML layout for that single order: order number, customer details, line items with quantities, styled with `@media print` rules
- Call `window.print()` automatically

## Files to change
- `src/pages/Index.tsx` — newOrderCount state, pass to sidebar, badge on hamburger, mobile collapse prevention
- `src/components/chat/ConversationSidebar.tsx` — accept `newOrderCount` prop, render badge on Package icon
- `src/pages/PackageSlips.tsx` — add print button + print-friendly slip generation

