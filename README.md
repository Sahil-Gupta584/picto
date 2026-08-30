<p align="center">
  <img width="120" height="120" alt="Picto" src="https://github.com/user-attachments/assets/f77a3e5e-c28f-4311-a18a-c0fb334ff3a6" />
</p>

<h1 align="center">Picto</h1>
<p align="center">Your entire repo. One screen.</p>
<p align="center">
  <a href="https://www.wemakedevs.org/hackathons/trueforge">WeMakeDevs × TrueForge Hackathon 2026</a> ·
  <a href="https://trueforge.dev">TrueForge</a> ·
  <a href="https://github.com/Sahil-Gupta584/picto/pulls">Pull Requests</a>
</p>

---

Picto runs your repo maintenance so you don't have to. When an issue is opened, a TrueForge agent reads the codebase, edits code in an isolated sandbox, runs tests, and opens a pull request. Then it stops — and waits for you.

---

## How it works

```
Issue opened
    │
    ▼
Supervisor agent triages
    ├── spam / duplicate / already exists → closed with comment
    ├── clarification needed → comment posted, waits in Needs Attention
    └── fix
          │
          ▼
    Developer subagent spawned (TrueForge create_sub_agent)
          │  reads CONTRIBUTING.md, AGENTS.md, tests, changeset conventions
          ▼
    Code edited in Daytona sandbox · tests run
          │
          ▼
    PR opened on GitHub
          │
          ▼
    ⏸  Harness pauses — require_approval_for_tools: ["merge_pull_request"]
          │
          ▼
    You review diff + test logs in dashboard → Approve & Merge
```

---

## Stack

| Layer | Tech |
|-------|------|
| Web app | TanStack Start · oRPC · Prisma 7 · PostgreSQL |
| Agent harness | `@truefoundry/trueforge-sdk` · Daytona sandbox |
| GitHub | Octokit · MCP server (`mcp_servers: ["github"]`) |
| Auth | better-auth (magic link + Google OAuth) |
| UI | HeroUI v3 · Tailwind CSS v4 |

---

## Quickstart

**1. Start the TrueForge harness**

```bash
npx @truefoundry/trueforge
```

**2. Clone and configure Picto**

```bash
git clone https://github.com/Sahil-Gupta584/picto.git
cd picto
npm install
cp apps/web/.env.example apps/web/.env
# Fill in DATABASE_URL, GITHUB_TOKEN, TRUEFORGE_BASE_URL
```

**3. Run**

```bash
npm run dev
# → http://localhost:5173
```

---

## TrueForge integration

Three things the harness does that a plain LLM call cannot:

- **Real tools** — GitHub MCP server. Agent calls `search_issues`, reads `PULL_REQUEST_TEMPLATE.md`, `CONTRIBUTING.md`, creates PRs — all through the harness, not mocked.
- **Safe execution** — `config.sandbox.enabled = true`. Every file edit and test run happens inside a Daytona VM. The host is never touched.
- **Human checkpoint** — `require_approval_for_tools: ["merge_pull_request"]`. The agent physically cannot merge without a human pressing Approve in the dashboard. Not a UI toggle — a harness-level gate.

---

## Dashboard

Two tabs:

- **Logs** — accordion of new issues, new PRs, and Picto's Activity (live-polls every 3s during active runs). Click any row to open a drawer with full issue/PR detail, diff, test results, reply box, and close button.
- **Needs Attention** — clarification requests and PR approval queue. One-click approve or close.

---

## Qodo Code Review

Every substantive change ships through a PR reviewed by Qodo before merge.

**Representative PR:** [fix: correct rebrand Picot → Picto (#2)](https://github.com/Sahil-Gupta584/picto/pull/2) — 2 Qodo bot comments, merged via squash.

**Security finding caught on [PR #7](https://github.com/Sahil-Gupta584/picto/pull/7):** Qodo flagged a **High** — webhook handler loaded credentials with `maintainerSettings.findFirst()` instead of scoping by the repo owner's `userId`. Fixed: every agent session and GitHub operation now uses exclusively the token of the user who connected that repository.

---

## Hackathon

**WeMakeDevs Agent Harness Hackathon — TrueForge** · Aug 24–30 2026  
Tracks: Best Use of TrueForge · Best Code Quality · Best UI

---

## License

MIT
