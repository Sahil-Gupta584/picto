# Autonomous GitHub Repository Maintainer - Architecture & Spec

## Overview
Autonomous GitHub Repository Maintainer built on **TrueForge** agent harness for TrueForge Hackathon.

Workflow:
`GitHub Issue → Agent Investigate → Modify Code (Daytona Sandbox) → Run Tests → Create PR → Request Human Approval → Merge via Dashboard`

---

## System Components

### 1. TrueForge Agent Harness (`@truefoundry/trueforge-sdk`)
- **Agent Spec**:
  - Instruction: Autonomous Maintainer persona (triage issues, run sandbox tests, create PRs).
  - MCP Tooling: GitHub MCP server (`github-mcp`).
  - Sandbox: Daytona VM (`config.sandbox.enabled = true`).
  - Approval Checkpoint: `require_approval_for_tools: ["github_merge_pr"]` (or custom approval tool).
- **Session Management**:
  - 1 TrueForge session per GitHub issue workflow.
- **Turn Lifecycle**:
  - SSE stream (`createTurnStream` / `subscribeToTurn`).
  - Pause on `tool.approval_required` event when merge is requested.

### 2. GitHub Integration (`Octokit` / REST)
- Fetch repository issues, PRs, comments, file trees.
- Parse issue descriptions & linked commits.
- Execute PR merge after human approval.

### 3. Maintainer Web Dashboard (TanStack Start + oRPC + HeroUI)
- **Needs Attention**:
  - PRs awaiting maintainer approval.
  - Clarification prompts & risk flags.
- **Since Your Last Visit**:
  - Metrics (triaged issues, created PRs, completed actions).
- **Issue View**:
  - In-app issue details, agent commentary, related context, trigger maintainer run.
- **PR Review View**:
  - Diff view, sandbox test log, agent risk analysis, **Approve & Merge** button (resumes TrueForge approval turn).

---

## TrueForge Integration Blueprint

```typescript
// Example TrueForge session & turn trigger pattern
import { TrueForge } from '@truefoundry/trueforge-sdk';

const trueforge = new TrueForge({ apiKey: process.env.TRUEFORGE_API_KEY });

// 1. Create session for issue
const session = await trueforge.sessions.create({
  agent: 'github-maintainer-agent',
  metadata: { issueId: 101, repo: 'owner/repo' }
});

// 2. Start turn with issue context
const stream = await trueforge.sessions.createTurnStream(session.id, {
  input: [
    {
      type: 'user_message',
      content: 'Investigate issue #101, fix in sandbox, run tests, open PR, and request approval before merge.'
    }
  ]
});

// 3. Handle SSE events & Tool Approval Checkpoint
for await (const event of stream) {
  if (event.type === 'tool.approval_required') {
    // Save checkpoint event.id & wait for Maintainer Dashboard approval
  }
}
```

---

## Progress Checklist
- [x] Architecture & Spec documented
- [ ] TrueForge SDK Integration module (`apps/web/src/lib/trueforge.ts`)
- [ ] GitHub API integration service (`apps/web/src/lib/github.ts`)
- [ ] Maintainer database models / schema
- [ ] oRPC backend routes for Issues, PRs, Agent Actions
- [ ] Maintainer Dashboard UI (`Needs Attention`, `Since Last Visit`, `Issue View`, `PR Review View`)
