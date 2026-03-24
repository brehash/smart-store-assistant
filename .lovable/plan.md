
# WooCommerce AI Chat Assistant

## Overview
An AI-powered chat interface that connects to your WooCommerce store, letting you manage orders, browse products, get analytics, and more — all through natural conversation. The AI learns your preferences over time.

## Core Pages & Auth
- **Login / Signup page** with email/password authentication (Supabase Auth)
- **Main Chat interface** — the primary workspace (protected route)
- **Settings page** — configure WooCommerce store URL and API keys per user

## Chat Interface
- Full-screen chat UI with message history, markdown rendering, and streaming AI responses
- Messages display rich content inline: product cards, order tables, charts, and action buttons
- Conversation history persisted in database, switchable between past conversations
- Mobile-responsive layout

## AI Capabilities (via Lovable AI + Edge Functions)
The AI agent will have access to these WooCommerce tools via function/tool calling:

### 1. Product Tools
- **Search products** — fuzzy search by name, SKU, category. Results displayed as a horizontal slider of product cards with images, price, stock status, and "Add to order" action buttons
- **Get product details** — full product info with images, variations, and inventory

### 2. Order Tools
- **Create order** — AI parses natural language ("2 of 50gr pasta bourbon"), searches for matching products, shows confirmation table, then creates the order
- **Search orders** — by customer, date range, status. Results shown in a sortable table
- **Update order status** — change order status (processing, completed, etc.)

### 3. Analytics Tools
- **Sales insights** — revenue summaries, top products, order trends displayed as interactive charts (bar, line, pie charts using Recharts)
- **Inventory overview** — low stock alerts, product performance tables

## Learning & Memory
- **User preferences table** — stores product aliases, shortcuts, and patterns per user (e.g., "pasta bourbon" → specific product ID)
- AI references past interactions to improve accuracy over time
- Preference management in settings (view/edit learned shortcuts)

## Backend Architecture
- **Supabase (Lovable Cloud)** for auth, database, and edge functions
- **Edge function: `woo-proxy`** — securely proxies all WooCommerce REST API calls (store credentials never exposed to client)
- **Edge function: `chat`** — handles AI conversations with tool calling, routes tool results back to the AI for natural responses
- WooCommerce API keys stored securely as Supabase secrets

## Database Tables
- `conversations` — chat session metadata per user
- `messages` — full message history with role, content, and rich content metadata
- `user_preferences` — learned product aliases and user patterns
- `woo_connections` — encrypted WooCommerce store credentials per user

## Rich UI Components
- **Product card slider** — horizontal scrollable cards with product image, name, price, stock badge, and quick-action buttons
- **Order table** — sortable/filterable table with order details
- **Charts** — Recharts-based visualizations for sales data, rendered inline in chat
- **Confirmation dialogs** — before executing write operations (create order, update status)
