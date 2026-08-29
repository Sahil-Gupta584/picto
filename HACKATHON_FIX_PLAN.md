# HACKATHON FIX PLAN — TrueForge | WeMakeDevs (Aug 24-30 2026)

> **Goal:** Stop losing on `Use of sponsor tools` + `Control/safety` + `Technical excellence`.
> Judging: 6 equal criteria — Impact, Creativity, Technical excellence, Use of sponsor tools, Control/safety, Presentation (demo = hard as code).
> Deadline: **Aug 30 8PM London**. Public repo + ~3-min demo + README Qodo evidence required.

## Context

- **App:** `Picto` — Autonomous GitHub Maintainer (`apps/web` = TanStack Start + oRPC + Prisma 7 + `@truefoundry/trueforge-sdk`).
- **Harness today:** `apps/web/src/lib/trueforge.ts:534` → `mcp_servers:['github']`, `sandbox:{enabled:true}`, `require_approval_for_tools:["merge_pull_request"]`.
- **Flow:** `Issue → add labels/assign → sandbox (Daytona) → tests → PR → human checkpoint → merge` (`ARCHITECTURE.md:9`, `README.md:22`).
- **DB:** `prisma/schema.prisma:10-77` → `MaintainerRepo`, `MaintainerWorkflow(trueforgeSessionId, diff, testLog)`, `MaintainerEvent`, `MaintainerSettings`.
- **Dashboard:** `apps/web/src/routes/_protected/dashboard.tsx:96` — 5 tabs, `Approve & Merge` → `submitToolApproval` (`src/lib/trueforge.ts:689`). Already shows `Harness Guardrails Active`.
- **Current risks:** 0 Qodo PR history (direct pushes to `main` only), fake 18/18 metrics, mock store still shipped, no real subagents, bypassable merge.

---

## Phase 1 — Fix Disqualifiers (Today, ~2h) — Blocks Everything Else

### 1a. Qodo Trail (P0 — cannot be faked last day)

**Why:** Every substantive merge must be `branch → PR → Qodo review → fix/dismiss → re-review → human merge`. Judges open PR tab. `grep Qodo` is 0 today, `git log --oneline -15` is all on `main`, `apps/web/README.md:1` is TanStack boilerplate.

**Steps:**
1. One admin teammate → `https://app.qodo.ai/signin` → `Integrations > SaaS > GitHub > Add installation` → authorize `C:\s\maintainer` repo. One install covers team, 14-day trial no card.
2. If Qodo doesn't auto-run, comment `/agentic_review` on PR ([docs](https://docs.qodo.ai/code-review/use-qodo-in-prs)).
3. Create branch: `git checkout -b chore/qodo-setup` → add `## Qodo Code Review Evidence` to **root** `README.md:1` (not just `apps/web/README.md`) with:
   - Link to ≥1 merged representative PR (meaningful hackathon code)
   - 1–2 sentences: what Qodo flagged (e.g., `src/lib/code-review.ts:230 throw Error('LLM client not configured')`) and what you fixed/dismissed with reason
   - PR history showing completed review + your decisions + follow-up review on final code
4. Push → let Qodo review → fix every valid **High** (or dismiss with thread reason) → push → re-run review → **human merges** via GitHub UI.
5. Repeat for every substantive merge after today — no direct pushes to `main`.

**Verify:** `git log --graph` shows PR merges, README evidence renders, Qodo dashboard shows `Reviewed`.

### 1b. Stranger-Runnable Repo

- Update `apps/web/.env.example` (and root `.env.example`) with `DATABASE_URL`, `GITHUB_TOKEN`, `TRUEFORGE_BASE_URL/TOKEN`, `BETTER_AUTH_SECRET`, `GITHUB_WEBHOOK_URL`.
- Fix root `README.md:88` quickstart:
  ```bash
  npx @truefoundry/trueforge        # standalone, no clone
  # or
  git clone git@github.com:truefoundry/trueforge.git && cd trueforge && docker compose up
  npm install && npm run dev        # harness at :8790, web at :5173
  ```
- Remove/ gate `src/lib/maintainer-store.ts:92` mock data (hardcoded `repo-1/iss-1/pr-1`) — behind `NODE_ENV==='development'` or delete — ensure `src/orpc/maintainer-router.ts:36` Prisma is single source of truth.
- Verify: `npm run build && npm run check-types` passes on fresh clone.

---

## Phase 2 — Prove TrueForge Is Doing Real Work (4–6h) — Best Use Track (DGX Spark $5k)

### 2a. Real Subagents (not 3 sequential turns)

**Today:** `src/lib/trueforge.ts:214 setup`, `556 supervisor`, `606 developer` are 3 sequential `createTurnStream` calls in same session. Judges expect `delegate_to_subagent`.

**Plan:**
- In `src/lib/prompts.ts:36` `buildSupervisorPrompt`, add instruction: `If decision===fix, call delegate_to_subagent(developer)` with `plan` JSON (`category, reasoning, plan.steps`).
- In `src/lib/trueforge.ts:809` `consumeDeveloperAgentSession`, replace fire-and-forget `streamTurnWithAutoResume` with harness subagent delegation: `client.sessions.delegate` or tool handler for `delegate_to_subagent`. If SDK `0.1.3` lacks helper, simulate via `createTurnStream` with `parentSessionId` metadata, log `subagentId` to `MaintainerWorkflow.threadId` (`prisma/schema.prisma:55`) + `MaintainerEvent(type='sub_agent_completed')` (`src/lib/trueforge.ts:993`).
- Keep `normalizeModelName` (`trueforge.ts:66`) and `sandbox.enabled` untouched.

**Verify:** TrueForge dashboard/log shows `subagent spawned` event.

### 2b. Session Resilience

- Already storing `trueforgeSessionId` (`trueforge.ts:546`, `prisma/schema.prisma:53`). Add `Dashboard > attention` Reconnect button: `client.sessions.get(sessionId)` + `subscribeToTurn` on page reload.
- **Demo test:** Refresh mid-developer turn → show turn continues and logs append.

### 2c. Second MCP Tool

- Beyond `github`, add `postgres` or `web search` (40+ built-ins) to prove harness reach (`trueforge.ts:538` → `mcp_servers:['github','postgres']`). Even read-only `SELECT` counts. Surface tool call in UI log viewer.

### 2d. Make It Visible (Presentation)

- In `apps/web/src/routes/_protected/dashboard.tsx:331` (attention tab), add live SSE viewer: `model.message.delta`, `tool.approval_required`, `subagent spawned`, `sandbox.exec` output (git diff, test log at `dashboard.tsx:845`). This is what judges film.

---

## Phase 3 — Harden Control & Safety (2h) — Judged Separately

### 3a. No Bypass Merge

- **Bug today:** `src/orpc/maintainer-router.ts:560` `approvePR` does both `trueforge.submitToolApproval` **and** direct `githubService.mergePullRequest` — merge happens even if harness not approved.
- **Fix:** Only call `githubService.mergePullRequest` after stream returns `tool.approved` event. If still `approval_required`, return `{status:'pending'}`. Remove `call_merge_pr` placeholder.
- Also fix `apps/web/src/lib/github.ts:422` `mergePullRequest` to use `merge_method:'squash'` + `commit_title` with issue ref.

### 3b. Sandbox Proof

- `src/lib/trueforge.ts:242` `getSandboxBaseDir` hardcodes `wsl` path — replace with `env.TRUEFORGE_SANDBOX_BASE` + fallback (`os.homedir()`), log `sandbox.exec` git diff/test output to dashboard (`dashboard.tsx:845` `testResults.log`).
- Keep `HARNESS_ARTIFACT_PATHS` filtering (`trueforge.ts:9`) visible in diff viewer so judges see `package-lock.json` excluded.

---

## Phase 4 — Technical Excellence Cleanup (2h) — Best Code Quality (Mac Mini $1k)

- Replace hardcoded metrics `src/orpc/maintainer-router.ts:151` (`passed:18 total:18`) and `dashboard.tsx:440` `Sandbox: 18 Tests Passed (100%)` with parsed counts from `trueforge.ts:815 accumulatedLogs` / `testLog`.
- Resolve `src/lib/code-review.ts:216` `throw new Error('LLM client not configured')` — either delete custom review (Qodo is sponsor) or guard it.
- Split `dashboard.tsx:893` (>500 lines) into `dashboard/-components/` per `AGENTS.md:8`: e.g., `NeedsAttentionCard.tsx`, `PRDiffViewer.tsx`, `SinceLastVisit.tsx`.
- Ensure `npm run lint` + `npm run check-types` + `npm run test` green.

---

## Phase 5 — Narrative & Demo (1h) — Impact + Creativity + Presentation

- **Pick one narrow job** for 3-min demo (sponsor advice: *One narrow job done end-to-end beats platform*): keep existing `README.md:7` flow:
  1. Spam issue → auto-closed in 30s (`trueforge.ts:113 handleReject`)
  2. Bug issue → triaged, fixed in Daytona, PR in 2m (`trueforge.ts:596 developerPrompt`)
  3. PR → `Agent Root-Cause Rationale` (`dashboard.tsx:422`) → `Sandbox: Tests Passed` → `Approve & Merge` → `MERGED TO MAIN` (`dashboard.tsx:802`)
- Keep design tokens `Background #141414, Accent #118af3` (`design.md:14`).
- README must remain public, `PR history` + Qodo evidence + 3-min Loom link.

---

## Verification Checklist

- [ ] Qodo installed, ≥2 PRs merged via `branch → PR → /agentic_review → fix → re-review → human merge`
- [ ] Root `README.md` has `## Qodo Code Review Evidence` with merged PR link + 2-sentence finding summary + follow-up review hash
- [ ] Dashboard SSE viewer shows: MCP tool call, sandbox `git diff`, `tool.approval_required` pause, `subagent` handoff, reconnect survival
- [ ] `approvePR` only merges after harness approval (no bypass)
- [ ] Fresh clone: `npm install && npx prisma generate && npm run dev` runs, `.env.example` complete, `npm run build` passes
- [ ] Demo video (3 min) shows approval gate before irreversible merge

## Open Questions

1. **Subagents:** Use true TrueForge `delegate_to_subagent` (needs docs/SDK check, 1h risk) or document 2-turn pattern as subagents? True wins higher but riskier.
2. **Qodo admin:** Who on team has GitHub repo admin to install Qodo today? Blocks Phase 1.
3. **Second MCP:** Prefer `postgres` (analytics agent) or `web search` (research desk) for demo story?

## Next Action

Start **Phase 1a Qodo** now (0 code, unblocks judging), then Phase 2 → 3 → 4 in order.
