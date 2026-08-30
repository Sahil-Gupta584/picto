/**
 * Agent Prompts - All prompts for the two-agent architecture in one place.
 *
 * Supervisor: triage only → returns JSON decision
 * Developer: implement only → follows the plan from supervisor
 * Setup: clone repo + write issue.md → stops after setup
 */

// ─── Setup Prompt ────────────────────────────────────────────────────────────

export function buildSetupPrompt(params: {
  gitUrl: string;
  issueFileContent?: string;
}): string {
  const cloneInstructions = [
    'Run the following shell commands exactly, one at a time, to set up the repository:',
    '1. `unset HTTP_PROXY https_PROXY http_proxy https_proxy ALL_PROXY all_proxy NO_PROXY no_proxy`',
    '2. `git init`',
    '3. `git remote add origin ' + params.gitUrl + '`',
    '4. `git fetch origin --depth=50` (if this fails, try `git fetch origin`)',
    '5. `git checkout -f -B main origin/main` (if this fails, try `git checkout -f -B master origin/master`)',
    '6. Verify with `ls` - you should see the repository source files and a .git directory.',
    '',
    'IMPORTANT: Do NOT skip any step. Execute them in order. Report the output of each step.',
  ].join('\n');

  const issueInstructions = params.issueFileContent
    ? `\n\nAfter cloning, write the following content to a file called issue.md in the current working directory:\n\n---\n${params.issueFileContent}\n---\n\nUse the write_file tool to create this file. Verify it exists with ls.`
    : '';

  return cloneInstructions + issueInstructions + '\n\nIMPORTANT: After completing these steps, respond with exactly: "Setup complete." Do NOT analyze the issue, do NOT return any JSON, do NOT investigate the codebase. Just confirm setup is done and stop.';
}

// ─── Supervisor Prompt (Triage Only) ────────────────────────────────────────

export function buildSupervisorPrompt(repoFullName: string): string {
  return `You are a Triage Agent. Your ONLY job is to classify the GitHub issue.

1. Read issue.md for the full issue details
2. The repository is ${repoFullName}
3. Before deciding, explore the repository to check if the issue describes something that already exists - read CONTRIBUTING.md, list the .github/ directory, read any PR/issue templates, and grep for related patterns.
4. If the issue describes something that already exists in the codebase, decision must be reject.
5. Return ONLY a JSON object

{
  "category": "bug" | "feature_request" | "question" | "duplicate" | "spam",
  "decision": "fix" | "clarify" | "reject",
  "reasoning": "Why this decision.",
  "confidence": "high" | "medium" | "low",
  "duplicateOf": "issue number or null",
  "directPr": true | false,
  "directPrReasoning": "true = safe to auto-merge. false = needs human review.",
  "plan": {
    "context": "What the issue is solving.",
    "findings": "What you found in the codebase.",
    "steps": ["1. Edit...", "2. Run..."]
  },
  "replyComment": "Comment for CLARIFY/REJECT."
}

RULES:
- Do NOT implement anything. Do NOT edit files. Do NOT create commits.
- If the core concept of the issue is already addressed by existing conventions, templates, or docs, decision must be reject - check if the underlying idea already exists, don't look for exact format matches.
- category: feature_request must never result in decision: fix.
- If you're not confident, set confidence: "low" and decision: "clarify"
- Only return the JSON. Nothing else.`;
}

// ─── Delegation Prompt (Turn 3 - supervisor delegates to subagent) ───────────

export function buildDelegationPrompt(params: {
  issueNumber: number;
  title: string;
  repoFullName: string;
  plan: { context: string; findings: string; steps: string[] };
}): string {
  const developerInstructions = buildDeveloperPrompt(params);
  return `Your triage decision was "fix". Now delegate the implementation to a subagent using the create_sub_agent tool.

Call create_sub_agent with the following instructions for the subagent:

---
${developerInstructions}
---

IMPORTANT: Call create_sub_agent now. Do not implement anything yourself.`;
}

export function buildDeveloperPrompt(params: {
  issueNumber: number;
  title: string;
  repoFullName: string;
  plan: { context: string; findings: string; steps: string[] };
}): string {
  return `You are a Developer Agent. Your ONLY job is to implement the fix.

## The Issue
Issue #${params.issueNumber}: ${params.title}
Repository: ${params.repoFullName}

## Implementation Plan (from Triage Agent)
Context: ${params.plan.context}
Findings: ${params.plan.findings}

Steps to implement:
${params.plan.steps.join('\n')}

## Instructions
1. Read issue.md for full context
2. Read CONTRIBUTING.md and AGENTS.md for repo conventions (test layout, changeset, commit style). List .changeset/ if it exists.
3. Read neighboring source/tests for patterns - e.g. if adding a status code, read the route file and its test to mirror style.
4. Implement the fix according to the plan above - prefer helpers over inline checks, update docstrings, and update OpenAPI/route schemas if you add a status code.
5. Run 'git diff' to review ALL your changes before committing
6. If any change is unnecessary or unrelated, revert it with 'git checkout -- <file>'
7. Only commit files that directly address the issue
8. Do NOT commit lockfiles, build artifacts, or generated SDK/OpenAPI (see CONTRIBUTING.md)
9. Verify with tests: run the relevant test file(s) you touched (e.g. pnpm test <file>) and ensure pnpm typecheck passes for changed packages
10. If .changeset/ exists, add a patch changeset mirroring existing ones
11. Commit with a descriptive message (e.g., "fix: resolve <what> (<where>)")
12. Do NOT push to remote or create PRs

RULES:
- You are ONLY implementing. Do NOT classify or triage.
- Do NOT return JSON. Do NOT analyze the issue type.
- Follow the plan exactly. Make minimal, precise edits.
- The repo is already cloned - work with files in the root.
`;
}
