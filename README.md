# Reneo Live

A working slice of live commerce: a seller streams a product, customers watch, chat, and add it to cart — built for the Reneo Full-Stack internship assessment.

## Demo

**Deployed URL:** [https://reneo-live-q82y.vercel.app/]  
**Demo Video:** [reneo-live-demo.mp4](./reneo-live-demo.mp4)  
**Demo Accounts:**

- **Seller:** seller@demo.com / password123
- **Customer:** customer@demo.com / password123

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase + Agora values (see below)
npm run dev
```

### 1. Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor — creates all 5 tables, enables RLS, and adds every policy.
3. Storage → New bucket → name it `product-images`, make it **public**. Then run `supabase/storage-policies.sql`.
4. Copy the project URL + anon key into `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### 2. Agora

1. Create an Agora project (App ID + App Certificate, "Secured mode: APP ID + Token").
2. Put the App ID in `.env` as `VITE_AGORA_APP_ID`. **The App Certificate never goes in `.env` or the frontend.**
3. Deploy the token function and set the certificate as a server-only secret:
   ```bash
   supabase functions deploy agora-token
   supabase secrets set AGORA_APP_ID=xxx AGORA_APP_CERTIFICATE=xxx
   ```

## Part A Requirements Status

### ✅ A1. Authentication and Roles

- Supabase Auth with sign up, sign in, sign out
- Two roles: Seller and Customer
- Role-based routing and UI in `App.tsx`

### ✅ A2. User Profile

- `profiles` table with: id, name, avatar, role, created_at
- Relationship to `auth.users` via foreign key
- Profile creation handled in `AuthContext.tsx`

### ✅ A3. Product Creation (Seller)

- Fields: name, description, price, image, stock, status
- Stored in Supabase `products` table
- Image upload to Supabase Storage (`product-images` bucket)
- Seller can view their products in `SellerDashboard.tsx`

### ✅ A4. Live Session (Seller)

- `live_sessions` table with: id, host_id, product_id, status, created_at
- Status lifecycle: scheduled → live → ended
- Seller picks product and clicks "Go Live" in `SellerDashboard.tsx`

### ✅ A5. Agora Live Video

- **Seller:** camera + microphone, mute/unmute, camera on/off, end live
- **Customer:** join live, watch-only (audience role)
- Host/audience roles enforced via Agora SDK's `setClientRole()`
- Server-side token generation in Edge Function (`supabase/functions/agora-token`)
- Status change persisted to database on "End Live"

### ✅ A6. Live Commerce View (Customer)

- Live indicator, video, seller name, viewer count
- Product overlay: image, name, price, stock
- "View product" and "Add to cart" buttons
- Product viewed via overlay without losing live session (A6 requirement)

### ✅ A7. Real-time Chat

- Supabase Realtime for chat messages
- Each message: user, message, timestamp
- Real-time updates via `postgres_changes` subscription
- Implemented in `Chat.tsx`

### ✅ A8. Cart

- Add product, change quantity, remove, see total
- Cart state managed in `CartContext.tsx`
- Cart UI in `CartDrawer.tsx`

### ✅ A9. Responsive Web and Mobile

- CSS media queries in `index.css`
- Live view stacks vertically on mobile (≤768px)
- Product/session grids adapt to screen size
- Tested via browser dev tools device emulation

### ✅ A10. Security

- **RLS enabled on all tables** with appropriate policies
- **No secrets in repository** — Agora App Certificate is server-only secret
- **Server-side token generation** — Edge Function never exposes certificate
- **Security justification:** RLS policies check `auth.uid() = seller_id` at database level for products, preventing cross-seller data access even if request is modified

### ✅ A11. Error Handling

- Camera permission denied → Clear error message
- Microphone unavailable → Clear error message
- Agora connection failure → Detailed error with retry option
- Live already ended → Status check before joining
- Product not found → Error banner in live view
- Expired user session → Handled by Supabase Auth
- Network interruption → Offline banner with reconnection

### ✅ A12. Architecture Diagram

- See diagram below in Architecture section

## Architecture

```
┌─────────────┐        ┌──────────────────┐        ┌───────────────┐
│   Browser   │◄──────►│  Supabase Auth    │        │  Agora SFU     │
│  (React/TS) │        │  (sign up/in/out) │        │ (live video)   │
└──────┬──────┘        └──────────────────┘        └───────┬───────┘
       │                                                    │
       │ REST/websocket (RLS-enforced)          camera/mic  │
       ▼                                        stream       │
┌──────────────────┐   realtime (INSERT/UPDATE)  ◄──────────┘
│ Supabase Postgres │◄──────────────────────────┐
│ profiles          │                            │
│ products           │      ┌─────────────────────┴─┐
│ live_sessions       │◄────┤  Supabase Realtime      │
│ chat_messages        │     │  (chat, presence,       │
│ cart_items            │    │   session status)        │
└──────────────────┘        └──────────────────────────┘
       ▲
       │ signed upload URL
┌──────┴──────┐
│  Supabase    │
│  Storage     │  (product images, public bucket)
└─────────────┘

┌───────────────────────────┐
│ Supabase Edge Function     │  Client asks for a token by
│ agora-token                │◄─ (channel, uid, role); returns
│ — holds AGORA_APP_CERTIFICATE  a short-lived Agora RTC token.
│   as a server-only secret,     Certificate never reaches the
│   never sent to the client.    browser or the git repo.
└───────────────────────────┘
```

**Why this shape:**

- **Postgres + RLS as the security boundary**, not app code — every table's policies check `auth.uid()` against the row's owner column, so even a modified request from the browser can't cross into another seller's data.
- **Supabase Realtime** for both chat (`postgres_changes` on `chat_messages`) and live-session status (so a customer's feed/view updates the instant a seller ends a stream) — one system for both, rather than a separate websocket server.
- **Presence channels** for viewer counts — ephemeral, no table needed, resets naturally when a tab closes.
- **Agora token generation lives in an Edge Function**, isolating the one secret (App Certificate) that must never reach the browser.

## Security — what stops a user from deleting another seller's product?

RLS policies on `products` check `auth.uid() = seller_id` at the database level for every `update`/`delete`. Even if a user edits the product `id` in a request from dev tools, Postgres itself rejects the write unless the authenticated user's ID matches that row's `seller_id` — there's no code path in the app that can be bypassed to skip this check, because the check isn't in the app, it's in the database. See `supabase/schema.sql` for the full policy set.

Agora tokens are generated server-side only (`supabase/functions/agora-token`) — the App Certificate is a Supabase secret, never bundled into the frontend or committed to git.

## Known Limitations

- **Not yet tested on a real phone** — only browser dev-tools device emulation. Per the brief's ground rules, this should be done before final submission.
- **Viewer count lag** — uses Supabase presence, which can lag by a second or two on rapid join/leave.
- **No automatic reconnection** — if Agora drops mid-stream, user sees error banner and must refresh (Part B optional item).
- **Cart not synced across devices** — per-customer only, not real-time synced (not required by brief).
- **React StrictMode removed** — intentionally removed from `main.tsx` because it double-invokes effects in dev mode, causing rapid Agora join/leave cycles that produce silent connection errors.

## Part C — Written Answers

### 1. Which part of this would break first if 500 customers joined the same live? What would you change?

Agora's SFU scales viewer fan-out independently of this app, so the video layer itself likely holds. The first thing to break is almost certainly **Supabase Realtime chat** — every message broadcasts to every connected client, and at 500 concurrent chat subscribers with even a modest message rate, that's a lot of fan-out on one channel.

**What I would change:**

- Shard the chat channel (e.g., by viewer batches or geographic regions)
- Throttle/debounce message broadcast to prevent message storms
- Move viewer count off best-effort presence sync onto a periodic polled count for that scale
- Consider a dedicated chat service (like Pusher or Ably) for high-volume scenarios

### 2. What did you not have time to do, and what would you do next with two more days?

**Not completed:**

- Real device testing (mobile Safari has WebRTC quirks Agora's docs call out specifically)
- Automatic reconnection on Agora drop
- Server-side cart validation (price/stock could theoretically be manipulated client-side before RLS check)

**With two more days:**

1. **Real device testing** — Test on actual iOS/Android devices, not just browser emulation. Mobile Safari in particular has WebRTC permission quirks.
2. **Automatic reconnection** — Implement exponential backoff reconnection logic for Agora drops, with user-visible reconnection status.
3. **Server-side cart validation** — Move cart calculations server-side via Supabase Edge Function so price/stock can't be manipulated client-side even transiently.

### 3. Where did you use a library or an AI assistant to do something you would not have been able to write yourself, and what did you learn about it afterwards?

**AI Assistant Usage:**

- Used Claude to scaffold the RLS policy patterns and the Agora host/audience token flow.

**What I learned:**

- **Agora's live-streaming mode** enforces the host/audience split at the SDK level via `setClientRole`, not just as an app-level convention — meaning an audience client is structurally prevented from publishing, not just discouraged by hidden UI.
- **Supabase's `postgres_changes` realtime subscriptions** need an explicit `filter` per table/row or they broadcast every row change to every subscriber, which would have been a silent scaling problem.
- **React StrictMode behavior** — In dev mode it double-invokes effects, which caused rapid Agora join/leave cycles that produced silent connection errors. This is why StrictMode was intentionally removed from `main.tsx`.

**Library Usage:**

- **Agora RTC SDK NG** — Used for WebRTC video streaming. Learned about the difference between live mode and communication mode, and how token-based authentication works.
- **Supabase Realtime** — Used for chat and presence. Learned about presence channels for ephemeral state and postgres_changes for database-driven realtime updates.

## Deliverables Checklist

-  [1]GitHub repository with real commit history
- [2] README.md covering: setup, environment variables, Supabase schema, RLS policies, architecture, technical choices, known limitations, Part C answers
- [ 3] Deployed URL 
- [4 ] Demo accounts (seller@demo.com / password123, customer@demo.com / password123 — needs to be created)
- [ 5] 3-5 minute demo video (drive link provided)
(https://drive.google.com/file/d/1xUjzQz8C6uRFsJOgF_veB3OwQ3joT3jh/view?usp=sharing)
