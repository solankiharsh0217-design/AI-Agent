# AI Agent Platform — Full Audit Report & Improvements

## Date: July 15, 2026

---

## Project Context

A multi-tenant AI Agent Platform SaaS built on Cloudflare infrastructure with a Next.js dashboard and embeddable chat widget.

### Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces, TypeScript-first
- **Backend**: Hono on Cloudflare Workers, Drizzle ORM on D1, Zod validation
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Clerk auth
- **AI**: Groq (LLM), Sarvam (STT/TTS), Workers AI (embeddings)
- **Payments**: Razorpay subscriptions
- **Telephony**: Twilio
- **Storage**: D1 (SQL), R2 (files), Vectorize (embeddings), KV (cache), Durable Objects (sessions)

### Packages
| Package | Purpose |
|---------|---------|
| `apps/api-worker` | Main API (Cloudflare Worker) |
| `apps/ingestion-worker` | Document ingestion (Cloudflare Worker) |
| `apps/dashboard` | Admin dashboard (Next.js on Vercel) |
| `apps/widget` | Embeddable chat widget (Next.js on Vercel) |
| `packages/types` | Shared TypeScript types |
| `packages/shared` | Logger, errors, audit, constants |
| `packages/database` | Drizzle schema, repositories |
| `packages/auth` | Permissions, RBAC |
| `packages/agent` | LLM runtime, memory, tools, prompt builder |
| `packages/billing` | Razorpay integration, plans, subscriptions |
| `packages/analytics` | Usage tracking, cost calculation |
| `packages/channels` | API, phone, voice, WebSocket adapters |
| `packages/sdk` | Client SDK (embed.ts) |
| `packages/providers` | LLM, STT, TTS, embedding providers |

---

## Deployed Services

| Service | URL | Platform |
|---------|-----|----------|
| API Worker | `https://api-worker.orbitcrew2026.workers.dev` | Cloudflare Workers |
| Ingestion Worker | `https://ingestion-worker.orbitcrew2026.workers.dev` | Cloudflare Workers |
| Dashboard | `https://dashboard-deploy-psi-nine.vercel.app` | Vercel |
| Widget | `https://widget-deploy-alpha.vercel.app` | Vercel |
| GitHub | `https://github.com/solankiharsh0217-design/AI-Agent` | GitHub |

### Cloudflare Resources
- D1 Database: `ai-agent-platform` — ID `62105372-6230-4a00-b9c0-15d4c24145fd` (3 migrations, 19 tables)
- Vectorize: `agent-embeddings` (dimensions=1024, metric=cosine)
- KV: `CACHE` — ID `b196ec6abd724e71917750b852cd25bd`
- R2: `ai-agent-docs`
- Queue: `ingestion-queue` → consumer: `ingestion-worker`
- Durable Objects: `SessionDurableObject` (SQLite-backed)

### Secrets (Cloudflare)
`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `GROQ_API_KEY`, `SARVAM_API_KEY`, `INTERNAL_API_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

### Vercel Env Vars (Dashboard)
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

---

## Deployment Commands

### Initial Setup
```bash
cd /home/harsh/ai-agent-platform
pnpm install
pnpm run build  # All 13 packages build
```

### Deploy API Worker
```bash
cd apps/api-worker
wrangler deploy
wrangler secret put CLERK_PUBLISHABLE_KEY
wrangler secret put CLERK_SECRET_KEY
wrangler secret put GROQ_API_KEY
wrangler secret put SARVAM_API_KEY
wrangler secret put INTERNAL_API_SECRET
wrangler secret put RAZORPAY_KEY_ID
wrangler secret put RAZORPAY_KEY_SECRET
wrangler secret put RAZORPAY_WEBHOOK_SECRET
```

### Deploy Ingestion Worker
```bash
cd apps/ingestion-worker
wrangler deploy
```

### Deploy Dashboard (from standalone build)
```bash
# Build locally (needs tsconfig.json without extends, and local-packages with tgz of types/shared)
cd /tmp/dashboard-deploy
npm install
npm run build
vercel --prod --yes
```

### Deploy Widget
```bash
cd /tmp/widget-deploy
npm install
vercel --prod --yes
# Set env: NEXT_PUBLIC_API_URL=https://api-worker.orbitcrew2026.workers.dev
```

### KV Cache Clear
```bash
cd apps/api-worker
wrangler kv key delete "clerk:jwks:cache" --namespace-id=b196ec6abd724e71917750b852cd25bd --remote
```

### Database Migrations
```bash
cd apps/api-worker
wrangler d1 migrations apply ai-agent-platform
```

---

## Bugs Found & Fixed During Deployment

### 1. Sign-in 404 (FIXED)
- **Problem**: Clerk needs catch-all route `/sign-in/[[...sign-in]]/page.tsx`, not flat `/sign-in/page.tsx`
- **Fix**: Created `/sign-in/[[...sign-in]]/page.tsx` and `/sign-up/[[...sign-up]]/page.tsx`

### 2. Dashboard tsconfig extends missing (FIXED)
- **Problem**: `tsconfig.json` extends `../../tsconfig.base.json` which doesn't exist on Vercel
- **Fix**: Made `tsconfig.json` self-contained (merged base config into it)

### 3. Missing Authorization header race condition (FIXED)
- **Problem**: `ClerkTokenSync` sets token via `useEffect`, but components fire API calls in their own `useEffect` before token arrives
- **Fix**: Added promise-based `waitForToken()` in `api.ts` that resolves before any request

### 4. Clerk JWT issuer mismatch (FIXED)
- **Problem**: `verifyClerkToken` computed issuer as `https://clerk.test_xxxx.accounts.dev` but Clerk's actual issuer is `https://clerk.xxxx.accounts.dev` (base64-encoded in publishable key)
- **Fix**: Removed issuer computation entirely — trust the JWT's `iss` claim and fetch JWKS from it. Signature verification proves authenticity.

### 5. Missing tenant auto-provision (FIXED)
- **Problem**: Agent create fails with FK constraint — no tenant record for the user
- **Fix**: Added middleware that auto-creates a tenant row on first authenticated request

### 6. Widget embed code pointing to wrong URL (FIXED)
- **Problem**: Dashboard generated `<script src="{dashboard-origin}/api/widget.js">` — that endpoint doesn't exist
- **Fix**: Changed to `<script src="https://widget-deploy-alpha.vercel.app/embed.js" data-widget-id="..." data-api-url="https://api-worker.orbitcrew2026.workers.dev">`

### 7. Widget creation missing agentId (FIXED)
- **Problem**: Widget create form only sent `{ name }` but API requires `agentId`
- **Fix**: Added agent dropdown selector to widget creation form

### 8. Widget hardcoded apiUrl to localhost (FIXED)
- **Problem**: `useChat.ts` had `const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'`
- **Fix**: `apiUrl` now passed as query param from embed.js → iframe URL → page → ChatWidget → useChat

---

## DASHBOARD AUDIT FINDINGS

### CRITICAL Issues

| # | Feature | Issue | Files |
|---|---------|-------|-------|
| D1 | Analytics | Frontend expects `{totalMessages, totalConversations, activeUsers}` but backend returns `{usage, totalCost, period}` — all cards show 0 | `AnalyticsContent.tsx:6-11`, `analytics.ts:24-31` |
| D2 | Knowledge | No document upload UI exists — users cannot upload files to knowledge base | `knowledge/[id]/page.tsx` |
| D3 | Knowledge | No document delete UI or `deleteDocument` API client method | `knowledge/[id]/page.tsx`, `api.ts` |
| D4 | Agents | Detail page is read-only — no edit form for name/description/config | `agents/[id]/page.tsx:32-47` |
| D5 | Agents | No archive button in UI (backend supports `POST /:id/archive`) | `AgentList.tsx` |
| D6 | Widgets | Detail page is read-only — no edit form for name/config/status/domains | `widgets/[id]/page.tsx:44-81` |
| D7 | Analytics | Cost endpoint `GET /analytics/cost` never called, cost info missing | `AnalyticsContent.tsx`, `api.ts:118-123` |

### HIGH Issues

| # | Feature | Issue | Files |
|---|---------|-------|-------|
| D8 | Analytics | No date range filter UI despite backend supporting `from`/`to` params | `AnalyticsContent.tsx` |
| D9 | Agents | Create form missing description and config fields (model, temperature, systemPrompt) | `agents/new/page.tsx:10-19` |
| D10 | Settings | No link in navbar — page is unreachable | `Navbar.tsx` |
| D11 | Settings | Duplicates billing page content (subscription + invoices) | `SettingsContent.tsx:41-45` |
| D12 | Conversations | Pagination `meta` lost — `request()` returns `data.data` discarding `{total, totalPages}` | `ConversationsList.tsx:25,71` |
| D13 | API Client | Missing `deleteDocument(kbId, documentId)` method | `api.ts:61-85` |

### MEDIUM Issues

| # | Feature | Issue | Files |
|---|---------|-------|-------|
| D14 | Billing | No Razorpay checkout integration — never opens payment UI | `billing/page.tsx:128-138` |
| D15 | Billing | "Reactivate" button calls DELETE (cancel) instead of reactivating | `billing/page.tsx:233-239` |
| D16 | Phone | Create form missing provider, monthlyCost, providerReference fields | `phone/page.tsx:61-62` |
| D17 | Widgets | Create form missing config and domains fields | `widgets/new/page.tsx:12-13` |
| D18 | Settings | No profile editing capability | `SettingsContent.tsx` |
| D19 | Analytics | No chart visualization — only stat cards and plain table | `AnalyticsContent.tsx` |
| D20 | Knowledge | Detail page lacks description, config, document count, creation date | `knowledge/[id]/page.tsx:34-48` |

### LOW Issues

| # | Feature | Issue | Files |
|---|---------|-------|-------|
| D21 | Conversations | Detail page missing metadata (agent name, channel, status, timestamps) | `conversations/[id]/page.tsx` |
| D22 | Billing | Usage limits hardcoded instead of reading from plan | `billing/page.tsx:60-66` |
| D23 | Inconsistent | Loading states inconsistent across detail pages | Various |

---

## WIDGET AUDIT FINDINGS

### CRITICAL Issues

| # | Issue | Impact | Files |
|---|-------|--------|-------|
| W1 | **WebSocket tenantId always empty** — WS upgrade endpoint only resolves tenantId if `token` query param is provided, widget never sends it | All WS messages fail silently — user gets no response | `index.ts:305-352`, `session.ts:138-167`, `useChat.ts:97-101` |
| W2 | **POST fallback drops response** — `sendMessage` calls `fetch()` but never reads response body; `isTyping` stays forever | HTTP fallback also broken — no response displayed | `useChat.ts:206-214` |
| W3 | **Error messages never shown** — `error` WS case only calls `setIsTyping(false)`, ignores `data.payload.message` | Users see typing indicator vanish with zero feedback | `useChat.ts:156-158` |

### HIGH Issues

| # | Issue | Impact | Files |
|---|-------|--------|-------|
| W4 | `connected` WS event silently dropped — no `case 'connected'` in switch | Widget can't confirm DO-side session is ready | `session.ts:158-162`, `useChat.ts:113-159` |
| W5 | Reconnection uses stale sessionId — no mechanism to create new session after expiry | After disconnection, widget permanently broken until page refresh | `useChat.ts:169-178` |
| W6 | No WebSocket heartbeat/ping — Cloudflare has ~100s idle timeout | Connection dies silently after inactivity | `useChat.ts`, `session.ts:216-217` |

### MEDIUM Issues

| # | Issue | Impact | Files |
|---|-------|--------|-------|
| W7 | Premature "connected" state — set before WS is actually open | User sees "Online" then it may fail | `useChat.ts:74,105` |
| W8 | POST responses not visible to WS clients (DO broadcasts `state:updated` but not message content) | Hybrid POST/WS scenarios miss messages | `session.ts:379-472` |
| W9 | embed.js toggle button hardcoded `#3B82F6` — ignores widget theme | Brand inconsistency | `embed.js:28` |
| W10 | embed.js hover behavior broken when widget open (both branches identical) | Visual glitch | `embed.js:64-69` |
| W11 | No `default` case in WS message switch | Unknown message types (tool-call, session:ended, pong) silently dropped | `useChat.ts:113-159` |
| W12 | Domain validation fails in some iframe contexts (null Origin header) | Widget config/session creation may 403 | `index.ts:195-198` |

### LOW Issues

| # | Issue | Files |
|---|-------|-------|
| W13 | No textarea maxLength (API enforces 10000 chars) | `ChatWidget.tsx:146-159` |
| W14 | No message retry on failure | `useChat.ts:186-218` |
| W15 | No markdown rendering in MessageBubble (plain text only) | `MessageBubble.tsx:28` |
| W16 | Greeting + suggested prompts may overlap visually | `ChatWidget.tsx:89-136` |
| W17 | No debounce on sendMessage (double-submit possible) | `useChat.ts:186-218` |
| W18 | No accessibility attributes (role, aria-label) on embed | `embed.js:26-29` |
| W19 | Dynamic imports in DO add latency per message | `session.ts:386-389,481-484` |
| W20 | No security headers (X-Frame-Options, CSP) on widget app | `next.config.js` |
| W21 | No `session:ended` handling | `useChat.ts:113-159` |
| W22 | Submit not blocked in `error` connectionState | `ChatWidget.tsx:41` |
| W23 | `WIDGET_URL` breaks with subpath deployments | `embed.js:19` |

---

## IMPROVEMENTS TO DO (Priority Order)

### Phase 1: Make It Work (Widget Critical Path)

- [ ] **W1**: Fix WS tenantId — pass tenantId from widget config endpoint to the WS connection (either as query param or via the session creation response)
- [ ] **W2**: Fix POST fallback — read response body and display assistant message, set `isTyping(false)`
- [ ] **W3**: Show error messages to users in the chat UI
- [ ] **W11**: Add `default` case in WS switch + handle `connected`, `session:ended`, `pong`
- [ ] **W4**: Handle `connected` WS event properly
- [ ] **W6**: Add WS ping heartbeat (every 60s)

### Phase 2: Make It Usable (Dashboard Core Features)

- [ ] **D2**: Add document upload UI to knowledge base detail page (file input + drag-drop)
- [ ] **D3**: Add `deleteDocument` API method + delete button per document
- [ ] **D4**: Add edit form to agent detail page (name, description, config: model, temperature, systemPrompt)
- [ ] **D5**: Add archive button to agent list
- [ ] **D6**: Add edit form to widget detail page (name, config, status, domains)
- [ ] **D9**: Add description + config fields to agent creation form
- [ ] **D1**: Fix analytics to match backend response shape (`usage`, `totalCost`, `period`)
- [ ] **D7**: Call `GET /analytics/cost` and display cost data
- [ ] **D8**: Add date range picker to analytics

### Phase 3: Polish (Widget Improvements)

- [ ] **W5**: Reconnection creates new session instead of reusing stale one
- [ ] **W7**: Set `connectionState` only after WS `onopen`, not after session creation
- [ ] **W9**: Fetch widget config and apply theme to toggle button
- [ ] **W10**: Fix embed.js hover behavior
- [ ] **W12**: Relax domain validation for null Origin in iframe contexts
- [ ] **W13**: Add maxLength to textarea
- [ ] **W15**: Add basic markdown rendering (code blocks, bold, links)
- [ ] **W17**: Add isSending guard to prevent double-submit
- [ ] **W22**: Block submit in error state

### Phase 4: Complete Dashboard

- [ ] **D10**: Add Settings link to navbar
- [ ] **D11**: Remove billing duplication from Settings, add profile editing
- [ ] **D12**: Fix conversation pagination (return meta from API client)
- [ ] **D14**: Integrate Razorpay checkout (open payment modal after plan selection)
- [ ] **D15**: Fix Reactivate button to cancel the cancellation
- [ ] **D16**: Add missing fields to phone number creation form
- [ ] **D17**: Add config/domains to widget creation form
- [ ] **D19**: Add chart visualization (recharts or similar)
- [ ] **D20**: Enhance knowledge detail page with stats
- [ ] **D21**: Add conversation metadata to detail page

### Phase 5: Production Hardening

- [ ] **W14**: Add message retry mechanism
- [ ] **W18**: Add accessibility attributes to embed
- [ ] **W20**: Add security headers to widget app
- [ ] **W21**: Handle `session:ended` in widget
- [ ] **W23**: Make WIDGET_URL robust for subpath deployments
- [ ] **D22**: Read billing limits from plan instead of hardcoding
- [ ] **D23**: Consistent loading states across all pages
- [ ] Add error boundaries to all pages
- [ ] Add proper loading skeletons instead of "Loading..." text

---

## Architecture Notes

### Auth Flow
1. Dashboard → Clerk OAuth → JWT token
2. Dashboard sends `Authorization: Bearer <clerk_jwt>` to API Worker
3. API Worker fetches JWKS from Clerk issuer, verifies RSA signature
4. Extracts `tenantId` from JWT (falls back to `userId` for single-user mode)
5. Auto-provisions tenant if first request

### Widget Flow (Current — Broken)
1. Embed script creates iframe to widget app with `?widgetId=xxx&apiUrl=xxx`
2. Widget fetches config from `GET /api/widgets/:id` (public)
3. Widget creates session via `POST /api/widgets/:id/sessions` (public)
4. Widget connects to `ws://api-worker/ws/widget?sessionId=xxx`
5. **BROKEN**: WS upgrade doesn't resolve tenantId without token → all messages fail

### Widget Flow (Target)
1. Embed script creates iframe (same)
2. Widget fetches config (same)
3. Widget creates session → gets back `sessionId` + `conversationId`
4. Widget connects WS with `sessionId`
5. **FIX NEEDED**: Pass tenantId through (either from config response, session response, or DO lookup)
6. DO processes messages, streams responses back via WS
