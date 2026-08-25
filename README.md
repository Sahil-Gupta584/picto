# Autonomous GitHub Repository Maintainer

An autonomous GitHub maintenance agent and maintainer dashboard built on **TrueForge** agent harness for the **TrueForge Hackathon**.

---

## 🌟 Overview

This project provides an end-to-end automated maintainer pipeline for GitHub repositories. When a GitHub issue is opened, the TrueForge agent autonomously investigates the problem, modifies code in a Daytona sandbox environment, executes repository test suites, creates a pull request, and holds at a human approval checkpoint until the maintainer approves and merges the PR via the dashboard.

---

## 🏗️ Architecture

```
                                  +---------------------------------------+
                                  |         Maintainer Dashboard          |
                                  |    (Needs Attention / Issue / PR)     |
                                  +-------------------+-------------------+
                                                      | oRPC / HTTP
                                                      v
                                  +-------------------+-------------------+
                                  |       Maintainer Backend Router       |
                                  |       (TanStack Start + oRPC)         |
                                  +---------+-------------------+---------+
                                            |                   |
                     TrueForge SDK (@truefoundry/trueforge-sdk) | GitHub REST / Octokit
                                            |                   |
                                            v                   v
+-------------------------------------------+-----+    +--------+------------------+
|                  TrueForge                      |    |         GitHub API       |
|  +-------------------------------------------+  |    |  (Issues, PRs, Webhooks) |
|  |           Agent Execution Loop            |  |    +--------+------------------+
|  |  - Model Orchestration (Claude / Sonnet)  |  |
|  |  - Session / Turn Lifecycle (SSE Streams) |  |
|  |  - Human Checkpoints (Tool Approvals)     |  |
|  +---------------------+---------------------+  |
|                        |                        |
|    +-------------------+-------------------+    |
|    |      Sandbox Tool (Daytona VM)        |----+
|    |  - File Edit / Workspace Git Sync     |
|    |  - Test Execution (npm test / pytest) |
|    +---------------------------------------+
+-------------------------------------------------+
```

---

## ⚙️ How TrueForge is Used

1. **Agent Specification (`apps/web/src/lib/trueforge.ts`)**:
   - Model: `anthropic/claude-sonnet-4-6`
   - Sandbox: Enabled (`config.sandbox.enabled = true`) for isolated execution.
   - Approval Gate: `require_approval_for_tools: ['github_merge_pr', 'request_maintainer_merge_approval']`

2. **Session & Turn Lifecycle**:
   - 1 TrueForge Session per GitHub issue lifecycle.
   - Streaming Server-Sent Events (SSE) communicate agent turn progress.

3. **Human Checkpoint**:
   - The agent pauses at `tool.approval_required` when it attempts to call the merge tool.
   - Maintainer reviews the PR diff and sandbox test logs on the dashboard.
   - Clicking **Approve & Merge** submits the tool approval payload to TrueForge, releasing the agent to finalize the merge.

---

## 🖥️ Dashboard Capabilities

- **Needs Attention**: Highlights PRs awaiting maintainer approval and risk summaries.
- **Since Your Last Visit**: Displays triage stats, test pass rates, created PRs, and an audit trail.
- **Issue View**: In-dashboard rendering of issues, comments, and agent root cause analysis.
- **PR Review View**: Side-by-side PR summary, diff, Daytona sandbox test logs, and the **Approve & Merge** approval trigger.

---

## 🚀 Quickstart

### Prerequisites
- Node.js >= 24
- npm 11+

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open maintainer dashboard
# Navigate to http://localhost:5173/dashboard
```

---

## 📄 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Deep architectural specification & TrueForge SDK blueprint.
