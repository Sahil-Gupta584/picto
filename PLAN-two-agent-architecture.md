# Two-Agent Architecture Plan

## Goal
Split the monolithic "do everything" agent into two focused agents:
1. **Supervisor**: Triage only (classify, decide, plan)
2. **Developer**: Implementation only (code, test, commit)

Both run in the **same session** to avoid re-cloning the repo.

---

## Current Flow (Broken)

```
Session 1 (one prompt does everything):
  Turn 1: Setup → clone repo, write issue.md
  Turn 2: Triage + Implementation → agent returns JSON AND implements
  Problem: Agent confused, does both jobs in one turn
```

## New Flow (Correct)

```
Session 1 (same session, two focused prompts):

  Turn 1: Setup
    - Clone repo inside sandbox
    - Write issue.md
    - Agent responds: "Setup complete."
    - Our code: stores setup completion

  Turn 2: Supervisor Triage
    - Prompt: "Read issue.md. Classify the issue. Return JSON. Do NOT implement."
    - Agent explores codebase
    - Agent returns JSON decision
    - Our code: parses JSON, stores decision

  Turn 3: Developer Implementation (only if action=FIX)
    - Prompt: "Here's the plan from supervisor. Implement the fix."
    - Agent reads issue.md for context
    - Agent implements the fix
    - Agent commits changes
    - Our code: creates PR from committed changes
```

---

## Files to Modify

### 1. `apps/web/src/lib/trueforge.ts`

#### A. Split Instructions

**Remove:** `combinedInstructions` (does everything)

**Add:** Two separate prompt builders:

```typescript
// Supervisor prompt - triage only
function buildSupervisorPrompt(params: {
  repoFullName: string;
}): string {
  return `You are a Triage Agent. Your ONLY job is to classify the GitHub issue.

## Instructions
1. Read issue.md in your working directory for the full issue details
2. The repository is ${params.repoFullName}
3. Explore the codebase using your tools (list_dir, read_file, grep_search)
4. Classify the issue and return a JSON decision

## Triage Categories

### Bug Fix (action: FIX)
- Clear error or unexpected behavior
- Steps to reproduce provided
- Affects existing functionality
- Can be fixed with code changes

### Feature Request (action: CLARIFY or REJECT — NEVER FIX)
- New functionality or improvement suggestion
- CRITICAL: Feature requests must NEVER use action: FIX
- If it's a good idea: action: CLARIFY (ask maintainer for approval)
- If it's already implemented or unnecessary: action: REJECT
- Check if the feature already exists (search codebase)
- Check if similar functionality exists (e.g. PR template already asks for issue numbers)

### Question/Support (action: CLARIFY)
- User needs help using the project
- Not a bug or feature request

### Duplicate (action: REJECT)
- Search for similar issues before responding
- Use search_issues tool to find related issues
- If duplicate found, close with reference to original issue

### Spam/Invalid (action: REJECT)
- Gibberish, promotional content, or unrelated to the project
- Close immediately with spam reasoning

## Output Format
Return ONLY a JSON object (no markdown wrappers, no explanation before or after):

{
  "category": "bug" | "feature_request" | "question" | "duplicate" | "spam",
  "decision": "fix" | "clarify" | "reject",
  "reasoning": "Why this decision.",
  "confidence": "high" | "medium" | "low",
  "duplicateOf": "issue number or null",
  "directPr": true | false,
  "directPrReasoning": "true = low-risk fix, safe to auto-merge. false = needs human review before merge.",
  "plan": {
    "context": "What the issue is solving.",
    "findings": "Root cause and files involved.",
    "steps": ["1. Edit [file]...", "2. Run [test]..."]
  },
  "replyComment": "Comment for CLARIFY/REJECT."
}

## Decision Rules
- category: bug → decision: fix
- category: feature_request → decision: clarify (good idea) or reject (already exists)
- category: question → decision: clarify
- category: duplicate → decision: reject + set duplicateOf
- category: spam → decision: reject

## RULES
- You are ONLY classifying. Do NOT implement anything.
- Do NOT edit files. Do NOT create commits.
- Do NOT run tests. Do NOT modify code.
- Return ONLY the JSON. Nothing else.
- Root-level files in this repo:
${params.rootFilesList}`;
}

// Developer prompt - implementation only
function buildDeveloperPrompt(params: {
  issueNumber: number;
  title: string;
  repoFullName: string;
  plan: {
    issueContext: string;
    analysisFindings: string;
    executionSteps: string[];
  };
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
2. Implement the fix according to the plan above
3. Run 'git diff' to review ALL your changes before committing
4. If any change is unnecessary or unrelated, revert it with 'git checkout -- <file>'
5. Only commit files that directly address the issue
6. Do NOT commit lockfiles, build artifacts, or unrelated changes
7. Verify changes with test suites if available
8. Commit with a descriptive message (e.g., "fix: resolve <what> (<where>)")
9. Do NOT push to remote or create PRs

## RULES
- You are ONLY implementing. Do NOT classify or triage.
- Do NOT return JSON. Do NOT analyze the issue type.
- Follow the plan exactly. Make minimal, precise edits.
- The repo is already cloned — work with files in the root.`;
}
```

#### B. Refactor `runAutonomousMaintainerOrchestrator`

**Remove:**
- `combinedInstructions` usage
- Single session doing everything
- `consumeDeveloperAgentSession` call in supervisor flow

**Add:**
- Two-phase flow in same session

```typescript
async runAutonomousMaintainerOrchestrator(params) {
  // ... workflow setup (same as before) ...

  // 1. Create single session
  const { data: session } = await this.client.sessions.create({
    agent: {
      spec: {
        model: { name: this.normalizeModelName(params.modelName), params: { max_tokens: 4096, temperature: 0.1 } },
        instructions: "You are an AI agent. Follow the instructions given to you in each turn.",
        config: {
          sandbox: { enabled: true },
          require_approval_for_tools: ['merge_pull_request'],
          mcp_servers: ['github'],
        },
      },
    },
  });

  const sessionId = session.id;

  // 2. Turn 1: Setup (clone repo, write issue.md)
  await this.prepareSandbox({
    repoFullName: params.repoFullName,
    sessionId,
    token: params.githubToken,
    issueFileContent: issueContent,
  });

  // Wait for setup to complete
  await this.waitForSetup(sessionId);

  // 3. Turn 2: Supervisor Triage
  const supervisorPrompt = buildSupervisorPrompt({
    repoFullName: params.repoFullName,
  });

  const triageResponse = await this.streamTurnWithAutoResume(sessionId, supervisorPrompt, callback);
  const decision = this.parseTriageJSON(triageResponse);

  // 4. Dispatch based on decision
  if (decision.decision === 'reject') {
    await this.handleReject(params, decision, workflow);
    return { workflow, sessionId };
  }

  if (decision.decision === 'clarify') {
    await this.handleClarify(params, decision, workflow);
    return { workflow, sessionId };
  }

  // 5. Turn 3: Developer Implementation (only if FIX)
  const developerPrompt = buildDeveloperPrompt({
    issueNumber: params.issueNumber,
    title: params.title,
    repoFullName: params.repoFullName,
    plan: decision.plan,
  });

  await this.streamTurnWithAutoResume(sessionId, developerPrompt, callback);

  // 6. Post-processing: create PR
  await this.postProcessAndCreatePR(sessionId, workflow, decision);

  return { workflow, sessionId };
}
```

#### C. Add Helper Methods

```typescript
// Parse triage JSON from agent response
private parseTriageJSON(response: string): TriageDecision {
  const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/) || response.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }
  throw new Error('No valid JSON found in triage response');
}

// Handle REJECT decision
private async handleReject(params, decision, workflow) {
  let commentBody = '';
  let eventTitle = '';

  if (decision.category === 'spam') {
    commentBody = decision.replyComment || `🤖 This issue has been identified as spam and has been closed.\n\n**Reason**: ${decision.reasoning}`;
    await githubService.closeIssue(owner, repoName, params.issueNumber, commentBody, params.githubToken);
    eventTitle = 'Issue rejected (spam)';
  } else if (decision.category === 'duplicate' && decision.duplicateOf) {
    commentBody = decision.replyComment || `🤖 This issue is a duplicate of #${decision.duplicateOf} and has been closed.\n\n**Reason**: ${decision.reasoning}`;
    await githubService.closeIssue(owner, repoName, params.issueNumber, commentBody, params.githubToken);
    eventTitle = `Issue closed as duplicate of #${decision.duplicateOf}`;
  } else {
    commentBody = decision.replyComment || `🤖 Issue closed.\n\n**Reason**: ${decision.reasoning}`;
    await githubService.closeIssue(owner, repoName, params.issueNumber, commentBody, params.githubToken);
    eventTitle = 'Issue rejected';
  }

  await prisma.maintainerWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: 'failed',
      prDecisionReasoning: `Triage: REJECT (${decision.category}). ${decision.reasoning}`,
      events: { create: { type: 'issue_rejected', title: eventTitle, detail: commentBody } },
    },
  });
}

// Handle CLARIFY decision
private async handleClarify(params, decision, workflow) {
  const commentBody = decision.replyComment || `🤖 Clarification requested.\n\n**Reason**: ${decision.reasoning}`;
  await githubService.addIssueComment(owner, repoName, params.issueNumber, commentBody, params.githubToken);

  await prisma.maintainerWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: 'awaiting_input',
      prDecisionReasoning: `Triage: CLARIFY (${decision.category}). ${decision.reasoning}`,
      events: { create: { type: 'clarification_requested', title: 'Clarification requested', detail: commentBody } },
    },
  });
}

// Post-process: create PR after developer implements
private async postProcessAndCreatePR(sessionId, workflow, decision) {
  const changedFiles = await this.getSandboxChangedFiles(sessionId);

  if (changedFiles.length === 0) {
    console.log('No changes detected after implementation');
    return;
  }

  // Publish branch
  const published = await this.publishSandboxBranch({
    sessionId,
    repoFullName: workflow.repoFullName,
    token,
    issueNumber: workflow.issueNumber,
  });

  if (!published.ok) {
    console.error('Failed to publish branch:', published.error);
    return;
  }

  // Create PR
  const createdPr = await githubService.createPullRequestOnGitHub(
    owner,
    repoName,
    {
      title: buildConventionalTitle(published.lastCommitMessage || workflow.title, workflow.issueNumber),
      body: `### Autonomous Maintainer Fix\n\n**Issue**: #${workflow.issueNumber} (${workflow.title})\n\n**Branch**: \`${published.branch}\`\n\n**Triage**: ${decision.reasoning}\n\n---\n*Created by AI Maintainer via TrueForge.*`,
      head: published.branch,
    },
    token
  );

  if (createdPr.success) {
    await prisma.maintainerWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'awaiting_approval',
        prNumber: createdPr.number,
        prCreated: true,
        branch: published.branch,
      },
    });

    // Run code review
    await this.runCodeReview(owner, repoName, createdPr.number, token);
  }
}
```

---

## Key Principle: No Hand-Feeding

**Do NOT pass information the agent can discover itself.**

The agent has tools: `list_dir`, `read_file`, `grep_search`, `search_issues`, etc.

❌ Don't pass `rootFilesList` in prompts — agent can run `list_dir` itself
❌ Don't paste issue text in triage prompt — agent reads `issue.md`
❌ Don't list existing PRs — agent can search with `search_issues`

Let the agent explore. That's why we give it tools.

---

## Token Usage Comparison

| Step | Current | New |
|------|---------|-----|
| Setup | ~5K | ~5K |
| Triage | ~10K (includes implementation noise) | ~6K (pure classification, no hand-fed data) |
| Implementation | ~15K (includes triage context) | ~12K (clean, focused) |
| **Total** | ~30K | ~23K |

**Fewer tokens** because:
- No hand-fed data (rootFilesList, issue text, etc.)
- Supervisor prompt is shorter (no implementation instructions)
- Developer prompt is shorter (no triage instructions)
- Agent discovers context via tools instead of prompt bloat

---

## Testing Checklist

- [ ] Supervisor correctly classifies bugs → category: bug, decision: fix
- [ ] Supervisor correctly classifies feature requests → category: feature_request, decision: clarify
- [ ] Supervisor correctly classifies spam → category: spam, decision: reject
- [ ] Supervisor correctly classifies duplicates → category: duplicate, decision: reject + duplicateOf set
- [ ] Supervisor returns confidence level (high/medium/low)
- [ ] Developer only runs when decision: fix
- [ ] Developer implements the fix per the plan
- [ ] PR is created after developer completes
- [ ] Code review runs on the PR
- [ ] Same session is used (no re-cloning)

---

## Implementation Order

1. [ ] Create `buildSupervisorPrompt()` function
2. [ ] Create `buildDeveloperPrompt()` function
3. [ ] Create `parseTriageJSON()` helper
4. [ ] Create `handleReject()` method
5. [ ] Create `handleClarify()` method
6. [ ] Refactor `runAutonomousMaintainerOrchestrator` to use two-phase flow
7. [ ] Remove old `combinedInstructions` and `consumeDeveloperAgentSession` from supervisor flow
8. [ ] Add `postProcessAndCreatePR()` method
9. [ ] Test end-to-end flow
10. [ ] Update README with architecture description
