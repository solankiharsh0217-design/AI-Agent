# AI Agent Platform — Complete Deployment Guide

## Project Root: `/home/harsh/ai-agent-platform`

---

## ALL RESOURCE IDs & CONFIGURATION

### Cloudflare Account
- **Email**: orbitcrew2026@gmail.com
- **Account ID**: 4777b50081bb0426d6511a47acd6b85f
- **Team ID**: team_zf060tObR7GlL5qq6Y4CNS0X

### D1 Database
- **Name**: ai-agent-platform
- **ID**: 62105372-6230-4a00-b9c0-15d4c24145fd
- **Bindings name**: DB
- **Migrations dir**: `apps/api-worker/migrations/`
- **Tables**: agents, tenants, users, knowledge_bases, documents, conversations, messages, sessions, widgets, phone_numbers, calls, subscriptions, invoices, usage_records, audit_logs, token_usage, tool_calls, billing_usage, workflows

### KV Namespace
- **Name**: CACHE
- **ID**: b196ec6abd724e71917750b852cd25bd
- **Bindings name**: KV

### R2 Bucket
- **Name**: ai-agent-docs
- **Bindings name**: R2

### Vectorize Index
- **Name**: agent-embeddings
- **Dimensions**: 1024
- **Metric**: cosine
- **Bindings name**: VECTORIZE

### Queue
- **Name**: ingestion-queue
- **ID**: f8da4fab02b7480082f6597a39624bc4
- **Consumer**: ingestion-worker

### Durable Objects
- **Class**: SessionDurableObject
- **Migration tag**: v1
- **Type**: SQLite-backed (new_sqlite_classes)

### Vercel Projects
| Project | ID | Production URL |
|---------|----|----------------|
| dashboard-deploy | prj_foSboz4xX2bAt0Qkymig104XkL1T | https://dashboard-deploy-psi-nine.vercel.app |
| widget-deploy | (check Vercel dashboard) | https://widget-deploy-alpha.vercel.app |

### GitHub
- **Repo**: https://github.com/solankiharsh0217-design/AI-Agent
- **Branch**: main

### Live URLs
| Service | URL |
|---------|-----|
| API Worker | https://api-worker.orbitcrew2026.workers.dev |
| Ingestion Worker | https://ingestion-worker.orbitcrew2026.workers.dev |
| Dashboard | https://dashboard-deploy-psi-nine.vercel.app |
| Widget | https://widget-deploy-alpha.vercel.app |

---

## SECRETS (Set via `wrangler secret put`)

| Secret Name | Where | How to Get |
|-------------|-------|------------|
| CLERK_PUBLISHABLE_KEY | Cloudflare (api-worker) | Clerk Dashboard → API Keys → Publishable Key |
| CLERK_SECRET_KEY | Cloudflare (api-worker) + Vercel (dashboard) | Clerk Dashboard → API Keys → Secret Key |
| GROQ_API_KEY | Cloudflare (api-worker) | https://console.groq.com/keys |
| SARVAM_API_KEY | Cloudflare (api-worker) | https://dashboard.sarvam.ai/ |
| INTERNAL_API_SECRET | Cloudflare (api-worker) | Generate any random string |
| RAZORPAY_KEY_ID | Cloudflare (api-worker) | https://dashboard.razorpay.com/ → Settings → API Keys |
| RAZORPAY_KEY_SECRET | Cloudflare (api-worker) | Same as above |
| RAZORPAY_WEBHOOK_SECRET | Cloudflare (api-worker) | Razorpay → Settings → Webhooks → Secret |
| TWILIO_ACCOUNT_SID | Cloudflare (api-worker) | https://console.twilio.com/ |
| TWILIO_AUTH_TOKEN | Cloudflare (api-worker) | Same page |
| CF_ACCOUNT_ID | Cloudflare (api-worker) | Your Cloudflare account ID |
| CF_API_TOKEN | Cloudflare (api-worker) | Cloudflare → My Profile → API Tokens |

### Vercel Environment Variables (Dashboard)
| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_API_URL | https://api-worker.orbitcrew2026.workers.dev |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | (from Clerk dashboard) |
| CLERK_SECRET_KEY | (from Clerk dashboard) |
| NEXT_PUBLIC_CLERK_SIGN_IN_URL | /sign-in |
| NEXT_PUBLIC_CLERK_SIGN_UP_URL | /sign-up |
| NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL | /agents |
| NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL | /agents |

### Vercel Environment Variables (Widget)
| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_API_URL | https://api-worker.orbitcrew2026.workers.dev |

---

## EMBED CODE (For Client Sites)

```html
<script 
  src="https://widget-deploy-alpha.vercel.app/embed.js" 
  data-widget-id="YOUR_WIDGET_ID" 
  data-api-url="https://api-worker.orbitcrew2026.workers.dev">
</script>
```

---

## DEPLOYMENT COMMANDS

### Step 1: Clone & Install
```bash
git clone https://github.com/solankiharsh0217-design/AI-Agent.git
cd AI-Agent
pnpm install
```

### Step 2: Create Cloudflare Resources
```bash
# D1 Database
wrangler d1 create ai-agent-platform
# Note the database_id, update in apps/api-worker/wrangler.toml

# KV Namespace
wrangler kv namespace create CACHE
# Note the id, update in apps/api-worker/wrangler.toml

# R2 Bucket
wrangler r2 bucket create ai-agent-docs

# Vectorize Index
wrangler vectorize create agent-embeddings --dimensions=1024 --metric=cosine

# Queue
wrangler queues create ingestion-queue
wrangler queues consumer add ingestion-queue ingestion-worker
```

### Step 3: Run Database Migrations
```bash
cd apps/api-worker
wrangler d1 migrations apply ai-agent-platform --remote
```

### Step 4: Set Cloudflare Secrets
```bash
cd apps/api-worker

wrangler secret put CLERK_PUBLISHABLE_KEY
# Paste: pk_test_xxxxx

wrangler secret put CLERK_SECRET_KEY
# Paste: sk_test_xxxxx

wrangler secret put GROQ_API_KEY
# Paste: gsk_xxxxx

wrangler secret put SARVAM_API_KEY
# Paste: xxxxx

wrangler secret put INTERNAL_API_SECRET
# Paste: (any random string, e.g. openssl rand -hex 32)

wrangler secret put RAZORPAY_KEY_ID
# Paste: rzp_test_xxxxx

wrangler secret put RAZORPAY_KEY_SECRET
# Paste: xxxxx

wrangler secret put RAZORPAY_WEBHOOK_SECRET
# Paste: xxxxx
```

### Step 5: Deploy API Worker
```bash
cd apps/api-worker
wrangler deploy
```

### Step 6: Deploy Ingestion Worker
```bash
cd apps/ingestion-worker
wrangler deploy
```

### Step 7: Deploy Dashboard to Vercel
```bash
# First, build packages that dashboard depends on
cd /path/to/AI-Agent
pnpm --filter @ai-agent/types build
pnpm --filter @ai-agent/shared build

# Create deploy directory
rm -rf /tmp/dashboard-deploy && mkdir -p /tmp/dashboard-deploy
cp -r apps/dashboard/* /tmp/dashboard-deploy/
rm -rf /tmp/dashboard-deploy/.next /tmp/dashboard-deploy/node_modules

# Remove workspace: references from package.json
cd /tmp/dashboard-deploy
python3 -c "
import json
with open('package.json') as f: pkg = json.load(f)
pkg['dependencies']['@ai-agent/types'] = '0.0.0'
pkg['dependencies']['@ai-agent/shared'] = '0.0.0'
with open('package.json', 'w') as f: json.dump(pkg, f, indent=2)
"

# Create local packages for workspace deps
mkdir -p local-packages/@ai-agent
cd /path/to/AI-Agent/packages/types && npm pack --pack-destination /tmp/dashboard-deploy/local-packages/@ai-agent/
cd /path/to/AI-Agent/packages/shared && npm pack --pack-destination /tmp/dashboard-deploy/local-packages/@ai-agent/

# Update package.json to use file: refs
cd /tmp/dashboard-deploy
python3 -c "
import json, glob
with open('package.json') as f: pkg = json.load(f)
tgz = glob.glob('local-packages/@ai-agent/*.tgz')
for t in tgz:
    name = t.split('/')[-1]
    if 'types' in name: pkg['dependencies']['@ai-agent/types'] = f'file:{t}'
    elif 'shared' in name: pkg['dependencies']['@ai-agent/shared'] = f'file:{t}'
with open('package.json', 'w') as f: json.dump(pkg, f, indent=2)
"

# Install & build
npm install
npm run build

# Link to Vercel project & deploy
vercel link --project dashboard-deploy --yes
vercel --prod --yes
```

### Step 8: Set Vercel Env Vars (Dashboard)
```bash
cd /tmp/dashboard-deploy
vercel env add NEXT_PUBLIC_API_URL production <<< 'https://api-worker.orbitcrew2026.workers.dev'
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production <<< 'pk_test_xxxxx'
vercel env add CLERK_SECRET_KEY production <<< 'sk_test_xxxxx'
vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL production <<< '/sign-in'
vercel env add NEXT_PUBLIC_CLERK_SIGN_UP_URL production <<< '/sign-up'
vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL production <<< '/agents'
vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL production <<< '/agents'
```

### Step 9: Deploy Widget to Vercel
```bash
rm -rf /tmp/widget-deploy && mkdir -p /tmp/widget-deploy
cp -r apps/widget/* /tmp/widget-deploy/
rm -rf /tmp/widget-deploy/.next /tmp/widget-deploy/node_modules

# Remove workspace: references
cd /tmp/widget-deploy
python3 -c "
import json
with open('package.json') as f: pkg = json.load(f)
if '@ai-agent/types' in pkg.get('dependencies', {}):
    del pkg['dependencies']['@ai-agent/types']
with open('package.json', 'w') as f: json.dump(pkg, f, indent=2)
"

npm install
npm run build

vercel link --project widget-deploy --yes
vercel --prod --yes

# Set env var
vercel env add NEXT_PUBLIC_API_URL production <<< 'https://api-worker.orbitcrew2026.workers.dev'
```

### Step 10: Configure Clerk
1. Go to Clerk Dashboard → Configure → Paths
2. Set Sign-in URL: `/sign-in`
3. Set Sign-up URL: `/sign-up`
4. Set After sign-in URL: `/agents`
5. Enable Google OAuth in Social Connections

### Step 11: Configure Razorpay Webhook
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://api-worker.orbitcrew2026.workers.dev/api/v1/billing/webhook`
3. Select events: `subscription.activated`, `subscription.cancelled`, `subscription.charged`, `subscription.paused`, `subscription.resumed`

---

## TROUBLESHOOTING

### Widget not responding (WS tenantId empty)
The WS upgrade endpoint doesn't resolve tenantId without a token. This is a known bug (W1 in IMPROVEMENTS.md). The fix is to pass tenantId through the session creation response.

### "Invalid or expired token" after Clerk login
The `verifyClerkToken` function trusts the JWT's `iss` claim and fetches JWKS from it. If JWKS fetch fails, check:
1. The Clerk publishable key is set correctly on Cloudflare
2. KV cache isn't stale: `wrangler kv key delete "clerk:jwks:cache" --namespace-id=b196ec6abd724e71917750b852cd25bd --remote`

### 404 on sign-in after Google login
Clerk needs catch-all routes at `/sign-in/[[...sign-in]]/page.tsx` and `/sign-up/[[...sign-up]]/page.tsx`.

### FK constraint failed on agent create
Tenant auto-provision middleware should handle this. If it fails, check the auth middleware in `apps/api-worker/src/index.ts`.

### Dashboard shows "Internal server error"
The production error handler hides details. Temporarily change `apps/api-worker/src/index.ts` line 410:
```typescript
message: err.message || 'Internal server error',  // temp debug
```

---

## TEST STATUS (as of July 2026)

All tests pass: **69 tests across 5 packages**

| Package | Tests | Coverage |
|---------|-------|----------|
| `@ai-agent/agent` | 4 | MiddlewareChain, AgentRuntime processTurn + streamTurn |
| `@ai-agent/auth` | 16 | PermissionChecker (8), TokenService generate/verify (8) |
| `@ai-agent/billing` | 16 | WebhookHandler (5), PricingEngine (11) |
| `@ai-agent/shared` | 20 | Error hierarchy, getErrorStatusCode, getErrorCode |
| `@ai-agent/analytics` | 13 | UsageTracker cost calculation + all recording methods |

### Run tests
```bash
pnpm test                           # all packages (turbo)
pnpm --filter @ai-agent/auth test   # single package
```

---

## BUG FIX SUMMARY (Phases 1-4 + Follow-up)

### Fixed (51+ bugs across 4 phases)
| Phase | Scope | Bugs Fixed |
|-------|-------|------------|
| 1 — Critical | Ingestion, analytics wiring, currency rounding | 7 |
| 2 — Functional | Call History JOINs, Razorpay webhooks, WAV merge, storage tracking | 5 |
| 3 — UI/UX | Auth guards, cancel button, permissions, layout, error banners | 20 |
| 4 — Cleanup | Dead code, side effects, CORS, queries, token validation | 11 |
| Follow-up | Conversation permissions, processTurn lastTurnUsage, test suite | 8 |

### Known issues NOT yet fixed (deployable — non-blocking)
| Issue | Severity | Notes |
|-------|----------|-------|
| Widget domain allow-list bypassed by `widgetToken` | Security | Needs `signedSecret` column wired up |
| `/ws/widget` trusts client-supplied `tenantId` | Security | Architectural change in DO binding |
| Cancel subscription revokes immediately (not period-end) | Billing | `findActiveByTenantId` excludes `canceled` status |
| Duplicate message persistence on voice/stream turns | Data | session.ts double-writes after runtime |
| Public SDK (`packages/sdk`) non-functional | SDK | Widget app lacks `postMessage` handlers |
| Runtime test coverage limited to mock-based paths | Quality | No integration tests with real LLM |

---

## DEPLOYMENT READINESS CHECKLIST

### Pre-deployment
- [x] All TypeScript packages typecheck clean (15/15)
- [x] All 69 tests pass (5/5 test packages)
- [x] Bug fixes committed to `main`
- [x] Secrets documented in this file

### Deployment order
1. **API Worker** (`apps/api-worker`) — Cloudflare Workers
   - `wrangler secret put` all 10 secrets
   - `wrangler deploy`
2. **Ingestion Worker** (`apps/ingestion-worker`) — Cloudflare Workers
   - `wrangler deploy`
3. **Dashboard** (`apps/dashboard`) — Vercel
   - Build with workspace dependency workaround (see Step 7)
   - Set 8 environment variables
4. **Widget** (`apps/widget`) — Vercel
   - Build and deploy
   - Set `NEXT_PUBLIC_API_URL`

### Post-deployment verification
- [ ] Create tenant account via Clerk sign-in
- [ ] Create agent, verify LLM responds
- [ ] Upload document to knowledge base, verify ingestion
- [ ] Create widget, verify embed script loads
- [ ] Verify analytics data populates (after usage)
- [ ] Test billing checkout with Razorpay test mode
- [ ] Verify WebSocket chat works via widget
- [ ] Test phone number assignment (if Twilio configured)

---

## FILE STRUCTURE

```
/home/harsh/ai-agent-platform/
├── apps/
│   ├── api-worker/          # Main API (Cloudflare Worker)
│   │   ├── wrangler.toml    # Cloudflare config
│   │   ├── src/
│   │   │   ├── index.ts     # Hono app, routes, middleware
│   │   │   ├── context.ts   # DB, provider registry setup
│   │   │   ├── middleware/   # Auth, CORS, rate limiting
│   │   │   ├── routes/      # agents, knowledge, conversations, widgets, analytics, users, phone, billing
│   │   │   └── durable/     # SessionDurableObject (WebSocket chat)
│   │   └── migrations/      # D1 SQL migrations
│   ├── ingestion-worker/    # Document ingestion (Cloudflare Worker)
│   ├── dashboard/           # Admin UI (Next.js on Vercel)
│   │   └── src/
│   │       ├── app/         # Pages: agents, knowledge, conversations, widgets, analytics, phone, billing
│   │       ├── components/  # AgentList, KnowledgeBaseList, ConversationsList, etc.
│   │       └── lib/api.ts   # API client
│   └── widget/              # Chat widget (Next.js on Vercel)
│       ├── public/embed.js  # Client-side bootstrapper
│       └── src/
│           ├── components/  # ChatWidget, MessageBubble
│           └── hooks/       # useChat (WebSocket + HTTP fallback)
├── packages/
│   ├── types/               # TypeScript types (agents, billing, channels, etc.)
│   ├── shared/              # Logger, errors, audit, constants, helpers
│   ├── database/            # Drizzle schema, repositories
│   ├── auth/                # Permissions, RBAC
│   ├── agent/               # LLM runtime, memory, tools, prompt builder
│   ├── billing/             # Razorpay integration, plans, subscriptions
│   ├── analytics/           # Usage tracking, cost calculation
│   ├── channels/            # API, phone, voice, WebSocket adapters
│   ├── sdk/                 # Client SDK (embed.ts)
│   └── providers/           # LLM, STT, TTS, embedding providers
├── IMPROVEMENTS.md          # Full audit report & TODO list
└── DEPLOYMENT.md            # This file
```
