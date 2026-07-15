# Agent Prompt — Continue AI Agent Platform Development

Use this prompt when handing off to another AI agent (Claude, GPT, Cursor, etc.).

---

## PROMPT

```
You are continuing development on a multi-tenant AI Agent Platform SaaS. The project is at /home/harsh/ai-agent-platform.

READ THESE FILES FIRST:
1. /home/harsh/ai-agent-platform/DEPLOYMENT.md — All resource IDs, URLs, secrets, deployment commands
2. /home/harsh/ai-agent-platform/IMPROVEMENTS.md — Full audit report with every bug and improvement needed

The platform is deployed and partially working:
- API Worker: https://api-worker.orbitcrew2026.workers.dev (Cloudflare Workers)
- Dashboard: https://dashboard-deploy-psi-nine.vercel.app (Next.js on Vercel)
- Widget: https://widget-deploy-alpha.vercel.app (Next.js on Vercel)
- Database: D1 on Cloudflare (19 tables, 3 migrations applied)

CRITICAL BUGS TO FIX FIRST (Widget is broken end-to-end):

BUG W1 — WebSocket tenantId always empty:
The WS upgrade endpoint at apps/api-worker/src/index.ts (line ~305-352) only resolves tenantId if a `token` query param is provided. The widget never sends it. Result: all WS messages fail silently. Fix: Pass tenantId from the widget config endpoint response to the WS connection, or resolve it in the DO from the sessionId.

BUG W2 — POST fallback drops assistant response:
In apps/widget/src/hooks/useChat.ts (line ~206-214), sendMessage calls fetch() but never reads the response body. isTyping stays true forever. Fix: Read response.json() and add the assistant message to state.

BUG W3 — Error messages never shown to users:
In apps/widget/src/hooks/useChat.ts (line ~156-158), the error WS case only calls setIsTyping(false), ignoring data.payload.message. Fix: Add an error message to the messages array or show a toast.

DASHBOARD GAPS (Missing features):
- D1: Analytics page expects wrong response shape — backend returns {usage, totalCost, period}, frontend expects {totalMessages, totalConversations}. Fix AnalyticsContent.tsx.
- D2: No document upload UI in knowledge base detail page. Add file input + upload button.
- D3: No document delete UI. Add deleteDocument to api.ts and delete button per document.
- D4: Agent detail page is read-only. Add edit form (name, description, config).
- D5: No archive button in agent list. Add it.
- D6: Widget detail page is read-only. Add edit form.
- D9: Agent creation form missing description and config fields.

DEPLOYMENT:
After making changes, deploy with:
- API Worker: cd apps/api-worker && wrangler deploy
- Dashboard: Build locally, copy to /tmp/dashboard-deploy, npm install, npm run build, vercel --prod --yes
- Widget: Build locally, copy to /tmp/widget-deploy, npm install, npm run build, vercel --prod --yes

Tech stack: TypeScript, Hono (Cloudflare Workers), Drizzle ORM (D1), Next.js 14, Tailwind, Clerk auth, Groq LLM, Razorpay billing.
```

---

## HOW TO USE THIS PROMPT

### Option 1: In Cursor / Windsurf
1. Open the project in Cursor
2. Open AI chat (Cmd+L)
3. Paste the content of this file as a message
4. The agent will read the files and start fixing

### Option 2: In Claude / ChatGPT
1. Start a new conversation
2. Paste the prompt section above
3. The agent will ask for file contents — provide them from the codebase

### Option 3: In a new opencode session
```bash
cd /home/harsh/ai-agent-platform
opencode
# Then paste the prompt
```

---

## WHAT TO FIX IN ORDER

### Round 1: Make the widget work (CRITICAL)
1. Fix W1 (WS tenantId) — this is the #1 blocker
2. Fix W2 (POST fallback response)
3. Fix W3 (error messages)
4. Deploy api-worker + widget

### Round 2: Make the dashboard useful
1. Fix D1 (analytics response shape)
2. Fix D2 + D3 (knowledge document upload/delete)
3. Fix D4 (agent edit form)
4. Fix D6 (widget edit form)
5. Deploy dashboard

### Round 3: Polish
1. Fix remaining D-series issues
2. Fix W-series medium issues
3. Add missing UI elements
4. Deploy all

After each round, test by:
1. Opening dashboard at https://dashboard-deploy-psi-nine.vercel.app
2. Sign in with Google
3. Create an agent, publish it
4. Create a widget for the agent
5. Embed the widget on a test page
6. Send a message and verify response comes back
