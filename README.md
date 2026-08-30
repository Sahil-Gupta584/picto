# Picto — Autonomous GitHub Maintainer

> *Give your repo a maintainer that never sleeps.*

**Tagline:** Picto triages issues, fixes them in a sandbox, and opens PRs — humans just approve.

**One-liner for judges:** An approval-gated code-review agent running on **TrueForge**. Every issue triggers a TrueForge session that reaches GitHub via MCP, runs generated fixes in a Daytona sandbox, pauses for human approval before merge, and can delegate to subagents. Every substantive change ships through a pull request reviewed by Qodo.

Demo flow (3 min):
1. Spam issue opened → auto-closed in 30s
2. Bug issue opened → triaged → fixed in sandbox → PR created in ~2 min
3. Dashboard shows risk + test logs → *Approve & Merge* releases the harness checkpoint

---

## 🌟 Overview

Picto is an end-to-end autonomous maintainer for GitHub repositories. When an issue is opened, a TrueForge agent:

1. Investigates the codebase
2. Edits code in an isolated **Daytona sandbox**
3. Runs `pnpm test` / `pnpm typecheck` in the sandbox
4. Creates a pull request
5. **Pauses** at `require_approval_for_tools: ["merge_pull_request"]` until you approve in the dashboard

Two tabs only: **Needs Attention** (human checkpoint queue) + **Logs** (accordion: 3 new issues · 3 new PRs · activity timeline → drawer details). Repo selector lives top-right with “Add new repo”.

Built with TanStack Start + oRPC + Prisma 7 + `@truefoundry/trueforge-sdk`.

---

## 🏗️ Architecture

```
                                   +---------------------------------------+
                                   |           Picto Dashboard             |
                                   |   (Needs Attention / Logs + Drawer)   |
                                   +-------------------+-------------------+
                                                       | oRPC
                                                       v
                                   +-------------------+-------------------+
                                   |       Maintainer Router (oRPC)        |
                                   +---------+-------------------+---------+
                                             |                   |
                      TrueForge SDK (@truefoundry/trueforge-sdk) | GitHub REST / Octokit
                                             |                   |
                                             v                   v
 +-------------------------------------------+-----+    +--------+------------------+
 |                  TrueForge                      |    |       GitHub API         |
 |  +-------------------------------------------+  |    |  Issues · PRs · Webhooks |
 |  |           Agent Execution Loop            |  |    +--------+------------------+
 |  |  - Model (Gemini / Claude via BYOK)      |  |
 |  |  - Session / Turn (SSE)                  |  |
 |  |  - Human Checkpoint (tool approval)      |  |
 |  +---------------------+---------------------+  |
 |                        |                        |
 |    +-------------------+-------------------+    |
 |    |      Sandbox Tool (Daytona VM)        |----+
 |    |  - File edits · git sync · tests      |
 |    +---------------------------------------+
 +-------------------------------------------------+
```

---

## ⚙️ How TrueForge Is Used (Harness Doing Real Work)

A judge must see the harness do all three:

1. **A way to reach your systems** — GitHub MCP (`mcp_servers: ["github"]`) + Octokit for issues/PRs/webhooks. Agent reads `PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, searches issues with `search_issues`.
2. **A safe place to run what it writes** — `config.sandbox.enabled = true` (Daytona). All edits + `pnpm test` run in the sandbox; host is never touched. Publishes via `git push` with token injection only after approval.
3. **A way to stay in control** — `require_approval_for_tools: ["merge_pull_request"]`. `tool.approval_required` → dashboard shows diff + sandbox logs → *Approve & Merge* calls `submitToolApproval(allow)` → merge. Sessions survive reconnects.

See `apps/web/src/lib/trueforge.ts` for `sessions.create`, `createTurnStream`, `streamTurnWithAutoResume` (429 backoff → `continue`), `publishSandboxBranch`.

---

## 🖥️ Dashboard

- **Needs Attention:** PRs awaiting approval, risk, sandbox test results, one-click merge.
- **Logs:** Accordion grouped events — click header to expand (counts as badges), click row → right drawer with full issue/PR/event detail + diff + logs. Repo dropdown top-right filters both tabs.
- **Profile menu:** *BYOK & Config* moved from dashboard to nav dropdown (consistent with `studio` branding).

---

## 🚀 Quickstart — One Command, Harness Running

No account, nothing to clone for standalone harness:

```bash
npx @truefoundry/trueforge
```

Then run Picto:

```bash
# 1. Install
npm install

# 2. Configure env (GitHub PAT + TrueForge URL)
cp apps/web/.env.example apps/web/.env

# 3. Dev
npm run dev
# Dashboard → http://localhost:5173/dashboard
```

Full stack (Postgres + Redis) when you need multi-replica: `cd apps/web && docker compose up` → `pnpm dev`.

---

## 🛡️ Qodo Code Review Evidence

> Every substantive merge ships through a pull request reviewed by Qodo before merge. High findings are fixed or dismissed with reason, then re-reviewed.

**Representative merged PR:** [fix: correct rebrand Picot → Picto (#2)](https://github.com/Sahil-Gupta584/picto/pull/2) — Qodo reviewed (2 bot comments), merged via squash.

**What Qodo surfaced & what we did:** Qodo flagged missing helper abstraction (`isDaytonaPermissionError` vs inline `instanceof` check), stale docstring on `isDaytonaAuthError`, missing OpenAPI `403` schema in `sandboxProviderRoutes.ts`, and missing test coverage — we extracted the helper, updated the route spec, rewrote the error message to name required grants, and added the `403` test + changeset.

**PR history:** Branch → PR → Qodo review → fix → re-review → human merge. Check the PR's *Checks* and *Conversation* tabs for the Qodo bot threads and the follow-up review on the final commit.

---

### Critical Security Bug Caught by Qodo on [PR #7](https://github.com/Sahil-Gupta584/picto/pull/7)

Qodo flagged a **High** security vulnerability in [discussion #r3889069112](https://github.com/Sahil-Gupta584/picto/pull/7#discussion_r3889069112):

> **Webhook uses arbitrary user settings** — After repositories became user-owned, issue and PR webhook handlers still loaded credentials with `maintainerSettings.findFirst()` rather than `configuredRepo.userId`. A webhook event for any connected repo would consequently run GitHub API calls and TrueForge agent sessions using a *different* user's token and model settings.

**Fix applied:** Changed both `issues` and `issue_comment` webhook branches to scope the settings lookup by the repo owner:
```ts
// Before (arbitrary user's token)
const userSettings = await prisma.maintainerSettings.findFirst()

// After (token belongs to the repo's owner)
const userSettings = await prisma.maintainerSettings.findUnique({
  where: { userId: configuredRepo.userId }
})
```
This ensures every agent session, GitHub label/comment operation, and model selection uses exclusively the credentials of the user who connected that repository — no cross-user token leakage possible.

Setup: one teammate with admin → Qodo → Integrations → SaaS → GitHub → Add installation → authorize repo → comment `/agentic_review` if needed. 14-day trial, no card.

---

## 📄 Project Info

- Hackathon: **WeMakeDevs Agent Harness Hackathon — TrueForge** (Aug 24–30, 2026) — https://www.wemakedevs.org/hackathons/trueforge
- Tracks: Best Use of TrueForge (Double-O / DGX Spark), Best Code Quality (Q Branch / Mac Mini), Best UI (Savile Row / iPad)
- Submission: public repo + 3-min demo showing TrueForge reaching a tool, running code in sandbox, and pausing for approval + Qodo-reviewed PRs
- Docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [TrueForge docs](https://trueforge.dev) · [Qodo docs](https://docs.qodo.ai/code-review/use-qodo-in-prs)

---

## 📄 License

MIT
