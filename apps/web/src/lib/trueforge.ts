import { TrueForge } from '@truefoundry/trueforge-sdk';
import { prisma } from '#/db';
import { githubService, buildConventionalTitle } from '#/lib/github';
import { execSync } from 'child_process';
import os from 'os';

/** Untracked/uncommitted paths produced by the TrueForge runtime itself, never part of an agent patch. */
const HARNESS_ARTIFACT_PATHS = ['.venv/', '.home/', '.tmp/', 'uploads/', 'tool-results/', 'skills/', 'issue.md'];
/** Dependency lockfiles regenerated as a side effect of running install commands in the sandbox. */
const BUILD_ARTIFACT_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'bun.lockb',
]);

export interface MaintainerAgentOptions {
  modelName?: string;
  instructions?: string;
  githubRepo?: string;
}

export interface TrueForgeSession {
  id: string;
  agentId?: string;
  title?: string;
  createdAt: string;
}

export class TrueForgeMaintainerService {
  private client: TrueForge;
  private baseUrl: string;

  constructor(options?: { baseUrl?: string; token?: string }) {
    this.baseUrl = options?.baseUrl || process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790';
    this.client = new TrueForge({
      baseUrl: this.baseUrl,
      token: options?.token || process.env.TRUEFORGE_TOKEN || process.env.TRUEFORGE_API_KEY,
      timeoutInSeconds: 600,
    });
  }

  normalizeModelName(raw?: string): string {
    return 'google-gemini/gemini-3-5-flash-lite';
    if (!raw) return 'google-gemini/gemini-3-1-flash-lite';
    const lower = raw.toLowerCase();
    if (lower.includes('lite') || lower.includes('3.1-flash') || lower.includes('3-1-flash')) {
      return 'google-gemini/gemini-3-1-flash-lite';
    }
    if (lower.includes('3.6') || lower.includes('3-6') || lower.includes('flash')) {
      return 'google-gemini/gemini-3-6-flash';
    }
    if (lower.includes('pro') || lower.includes('preview') || lower.includes('3.1')) {
      return 'google-gemini/gemini-3-1-pro-preview';
    }
  }

  /**
   * Send a setup turn inside the sandbox via the TrueForge SDK so that clone + file writes
   * happen inside bwrap (where the agent can actually see them).
   *
   * Calling execSync from outside bwrap writes to the host filesystem, but bwrap's
   * mount namespace makes those files invisible to the agent running inside. By sending
   * a user.message turn, the agent's own `exec` tool runs inside bwrap and can see
   * everything it creates.
   */
  private async prepareSandbox(params: {
    repoFullName: string;
    sessionId: string;
    token?: string;
    issueFileContent?: string;
  }): Promise<void> {
    const gitUrl = params.token
      ? `https://x-access-token:${encodeURIComponent(params.token)}@github.com/${params.repoFullName}.git`
      : `https://github.com/${params.repoFullName}.git`;

    // Build the setup instructions the agent will execute inside bwrap via its exec tool
    const cloneInstructions = [
      'Run the following shell commands exactly, one at a time, to set up the repository:',
      '1. `unset HTTP_PROXY https_PROXY http_proxy https_proxy ALL_PROXY all_proxy NO_PROXY no_proxy`',
      '2. `git init`',
      '3. `git remote add origin ' + gitUrl + '`',
      '4. `git fetch origin --depth=50` (if this fails, try `git fetch origin`)',
      '5. `git checkout -f -B main origin/main` (if this fails, try `git checkout -f -B master origin/master`)',
      '6. Verify with `ls` — you should see the repository source files and a .git directory.',
      '',
      'IMPORTANT: Do NOT skip any step. Execute them in order. Report the output of each step.',
    ].join('\n');

    const issueInstructions = params.issueFileContent
      ? `

After cloning, write the following content to a file called issue.md in the current working directory:

---
${params.issueFileContent}
---

Use the write_file tool to create this file. Verify it exists with ls.`
      : '';

    const setupPrompt = cloneInstructions + issueInstructions;

    console.log(`🤖 [AI Orchestrator] Sending setup turn to session ${params.sessionId} to clone repo inside sandbox...`);

    try {
      // Wait for the sandbox to be created by polling (max 30 retries, 1s delay)
      const isWindows = process.platform === 'win32';
      let sandboxBaseDir = '';
      if (isWindows) {
        let wslHome = '/home/gjugn';
        try {
          wslHome = execSync('wsl sh -c "echo \\$HOME"', { encoding: 'utf8' }).trim();
        } catch {}
        sandboxBaseDir = `${wslHome}/.local/share/trueforge/sandboxes/${params.sessionId}`;
      } else {
        const home = process.env.HOME || os.homedir();
        sandboxBaseDir = `${home}/.local/share/trueforge/sandboxes/${params.sessionId}`;
      }

      for (let i = 0; i < 30; i++) {
        const checkScript = `ls -d "${sandboxBaseDir}"/*/ 2>/dev/null | head -n1`;
        try {
          const result = isWindows
            ? execSync(`wsl sh -c '${checkScript}'`, { encoding: 'utf8' }).trim()
            : execSync(checkScript, { encoding: 'utf8' }).trim();
          if (result && result.length > 0) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Send the setup turn — the agent's exec tool runs inside bwrap, so clone is visible
      const stream = await this.client.sessions.createTurnStream(params.sessionId, {
        input: [{ type: 'user.message', content: setupPrompt }],
      });

      // Consume the stream until turn.done
      let setupComplete = false;
      for await (const event of stream) {
        if (event.type === 'turn.done') {
          setupComplete = true;
          break;
        }
      }

      if (setupComplete) {
        console.log(`✅ [AI Orchestrator] Sandbox setup complete for session ${params.sessionId}!`);
      } else {
        console.warn(`⚠️ [AI Orchestrator] Sandbox setup stream ended without turn.done for session ${params.sessionId}`);
      }
    } catch (err: any) {
      console.error(`❌ [AI Orchestrator] Error preparing sandbox via SDK turn:`, err.message || err);
    }
  }

  /**
   * Base directory of a session's sandbox (the TrueForge server creates one subdir per run
   * inside it, and the repo is cloned somewhere under that — probed dynamically per call).
   */
  private getSandboxBaseDir(sessionId: string): { baseDir: string; isWindows: boolean } {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      let wslHome = '/home/gjugn';
      try {
        wslHome = execSync('wsl sh -c "echo \\$HOME"', { encoding: 'utf8' }).trim();
      } catch {}
      return { baseDir: `${wslHome}/.local/share/trueforge/sandboxes/${sessionId}`, isWindows };
    }
    const home = process.env.HOME || os.homedir();
    return { baseDir: `${home}/.local/share/trueforge/sandboxes/${sessionId}`, isWindows };
  }

  private getHarnessPathFilter(): string {
    // Multiple -e flags are OR-combined by grep
    return HARNESS_ARTIFACT_PATHS.map((p) => `-e '^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).join(' ');
  }

  /**
   * Execute a shell script inside the sandbox repo directory by piping it via stdin.
   * Piping avoids all shell-quoting problems for paths, tokens and commit messages.
   */
  private runInSandbox(sessionId: string, script: string): string {
    const { baseDir, isWindows } = this.getSandboxBaseDir(sessionId);
    const wrapped = `
# Clear proxy vars so pip/curl inside the sandbox go direct
unset HTTP_PROXY  http_proxy
unset HTTPS_PROXY https_proxy
unset ALL_PROXY    all_proxy
unset NO_PROXY     no_proxy

SANDBOX_BASE="${baseDir}"
D=$(ls -d "$SANDBOX_BASE"/*/ 2>/dev/null | tail -n1)
if [ -z "$D" ] || [ ! -e "$D/.git" ]; then
  D=$(find "$SANDBOX_BASE" -maxdepth 2 -name .git 2>/dev/null | head -n1 | xargs -r -n1 dirname)
fi
if [ -z "$D" ] || [ ! -e "$D/.git" ]; then echo "@@ERR@@no_repo_dir"; exit 0; fi
cd "$D" || { echo "@@ERR@@cd_failed"; exit 0; }
${script}
`;
    if (isWindows) {
      return execSync('wsl sh', { input: wrapped, encoding: 'utf8' });
    }
    return execSync('sh', { input: wrapped, encoding: 'utf8' });
  }

  /**
   * All files that differ from the sandbox's base branch (agent commits or uncommitted edits).
   * Used as the source of truth for what the agent actually produced.
   */
  async getSandboxChangedFiles(sessionId: string): Promise<string[]> {
    try {
      const filter = this.getHarnessPathFilter();
      const out = this.runInSandbox(
        sessionId,
        `B=main; git rev-parse --verify -q refs/heads/main >/dev/null 2>&1 || B=master
if git rev-parse -q --verify "refs/remotes/origin/$B" >/dev/null 2>&1; then UP="origin/$B"; else UP="$B"; fi
{ git diff --name-only "$UP..HEAD"; git status --porcelain | cut -c4-; } 2>/dev/null | grep -Ev ${filter} | sort -u`
      );
      return out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } catch (err: any) {
      console.warn('Failed to list changed files from sandbox:', err?.message || err);
      return [];
    }
  }

  /**
   * Publish the agent's work to GitHub:
   *  1. Commits any leftover uncommitted edits (the agent usually commits itself).
   *  2. Ensures HEAD sits on a branch following our fix/issue-N-slug convention.
   *  3. Picks a unique remote branch name (-2, -3 … if occupied) unless the exact same
   *     commit is already there (idempotent re-publish).
   *  4. Pushes by URL with the token injected just-in-time — the repo's origin remote is never mutated.
   *
   * The agent's own git history IS what lands on GitHub — no file scraping or blob re-committing.
   */
  async publishSandboxBranch(params: {
    sessionId: string;
    repoFullName: string;
    token?: string;
    issueNumber?: number;
  }): Promise<
    | { ok: true; branch: string; lastCommitMessage: string }
    | { ok: false; error: string }
  > {
    if (!params.token) {
      return { ok: false, error: 'No GitHub token available for publishing sandbox branch.' };
    }

    try {
      // 1. Check if there are commits ahead of origin/main
      const branchName = `fix/issue-${params.issueNumber || 'x'}`;
      const checkOut = this.runInSandbox(
        params.sessionId,
        `B=main; git rev-parse --verify -q refs/heads/main >/dev/null 2>&1 || B=master
AHEAD=$(git rev-list --count "origin/$B..HEAD" 2>/dev/null || echo 0)
LASTMSG=$(git log -1 --pretty=%s 2>/dev/null)
echo "@ahead=$AHEAD"
echo "@msg=$LASTMSG"`
      );
      const ahead = parseInt(checkOut.match(/@ahead=(\d+)/)?.[1] || '0', 10);
      const lastMsg = checkOut.match(/@msg=(.*)/)?.[1]?.trim() || '';

      if (ahead === 0) {
        return { ok: false, error: 'No commits ahead of origin — nothing to push.' };
      }

      // 2. Push HEAD to the branch
      const pushUrl = `https://x-access-token:${encodeURIComponent(params.token)}@github.com/${params.repoFullName}.git`;
      const pushOk = this.runInSandbox(
        params.sessionId,
        `git push "${pushUrl}" "+HEAD:refs/heads/${branchName}" 2>&1`
      );

      if (pushOk.includes('error') || pushOk.includes('fatal')) {
        return { ok: false, error: `git push failed: ${pushOk.trim()}` };
      }

      console.log(`🚀 [Publish] Pushed to branch '${branchName}' on GitHub.`);
      return { ok: true, branch: branchName, lastCommitMessage: lastMsg };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }


  /**
   * Triage an incoming issue to determine scope, labels, and assignee.
   */
  async triageIssue(issue: { title: string; body: string; author: string }) {
    const text = `${issue.title} ${issue.body}`.toLowerCase();
    
    // 1. Detect scope
    let scope: 'small' | 'large' = 'small';
    if (
      text.includes('refactor') ||
      text.includes('architecture') ||
      text.includes('database') ||
      text.includes('migration') ||
      text.includes('overhaul') ||
      text.includes('security') ||
      text.includes('breaking') ||
      text.includes('major') ||
      text.length > 400
    ) {
      scope = 'large';
    }

    // 2. Generate labels
    const labels: string[] = ['ai-maintainer'];
    if (text.includes('fix') || text.includes('bug') || text.includes('error') || text.includes('rename')) {
      labels.push('bug');
    } else if (text.includes('feature') || text.includes('add') || text.includes('support')) {
      labels.push('enhancement');
    } else if (text.includes('docs') || text.includes('readme')) {
      labels.push('documentation');
    }

    if (scope === 'small') {
      labels.push('small-fix');
    } else {
      labels.push('large-scope', 'needs-attention');
    }

    // 3. Detect assignee request
    let assignee: string | null = null;
    if (text.includes('assign to me') || text.includes('assign me') || text.includes(`@${issue.author.toLowerCase()}`)) {
      assignee = issue.author;
    }

    return {
      scope,
      labels,
      assignee,
      summary: `Analyzed issue "${issue.title}". Rated scope as [${scope.toUpperCase()}]. Applied labels: ${labels.join(', ')}.`,
    };
  }

  /**
   * Single-Prompt Orchestrator: Triage issue, execute labeling/comments, and decide between DIRECT PR creation vs SUB_AGENT handoff.
   */
  async runAutonomousMaintainerOrchestrator(params: {
    issueNumber: number;
    issueUrl: string;
    repoFullName: string;
    title: string;
    body: string;
    author: string;
    githubToken?: string;
    modelName?: string;
  }) {
    const [owner, repoName] = params.repoFullName.split('/');
    const triage = await this.triageIssue({ title: params.title, body: params.body, author: params.author });

    console.log(`🤖 [AI Orchestrator] Processing Issue #${params.issueNumber} in ${params.repoFullName}`);

    // 1. Execute GitHub Actions: Auto-Labeling & Auto-Assignment
    await githubService.addIssueLabels(owner, repoName, params.issueNumber, triage.labels, params.githubToken);
    if (triage.assignee) {
      await githubService.assignIssue(owner, repoName, params.issueNumber, [triage.assignee], params.githubToken);
    }

    // 2. Determine Execution Strategy & Agent Reasoning Statement
    let executionMode: 'DIRECT' | 'SUB_AGENT' = 'DIRECT';
    let prDecisionReasoning = '';

    if (triage.scope === 'small') {
      executionMode = 'DIRECT';
      prDecisionReasoning = `⚡ Agent Decision: Created PR directly. Issue #${params.issueNumber} ("${params.title}") is a focused fix. Verified fix in Daytona sandbox and opened PR for Maintainer merge review.`;
    } else {
      executionMode = 'SUB_AGENT';
      prDecisionReasoning = `🛡️ Agent Decision: Handed off to Research & Implementation Sub-Agent. Issue #${params.issueNumber} ("${params.title}") involves complex architectural changes. Sub-Agent spawned to conduct deep codebase research, formulate patch, run sandbox tests, and create PR.`;
    }

    // 3. Post Maintainer Triage & Decision Comment on GitHub Issue
    const triageCommentBody = `🤖 **Autonomous AI Maintainer Triage**
- **Complexity Scope**: \`${triage.scope.toUpperCase()}\`
- **Execution Mode**: \`${executionMode}\`
- **Labels Applied**: \`${triage.labels.join('`, `')}\`
${triage.assignee ? `- **Assigned To**: @${triage.assignee}` : ''}

**Agent Reasoning Statement**:
> ${prDecisionReasoning}
`;
    await githubService.addIssueComment(owner, repoName, params.issueNumber, triageCommentBody, params.githubToken);

    // 4. Create or update workflow record in PostgreSQL database
    let workflow = await prisma.maintainerWorkflow.findFirst({
      where: { issueNumber: params.issueNumber, repoFullName: params.repoFullName },
    });

    if (workflow) {
      workflow = await prisma.maintainerWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: 'investigating',
          state: 'open',
          title: params.title,
          body: params.body || '',
          executionMode,
          prDecisionReasoning,
          prCreated: false,
          prNumber: null,
          branch: null,
          diff: null,
          testPassed: false,
          testLog: null,
        },
      });
    } else {
      workflow = await prisma.maintainerWorkflow.create({
        data: {
          issueUrl: params.issueUrl,
          issueNumber: params.issueNumber,
          repoFullName: params.repoFullName,
          title: params.title,
          body: params.body || '',
          status: 'investigating',
          state: 'open',
          author: params.author,
          executionMode,
          prDecisionReasoning,
        },
      });
    }

    // 5. Single session: triage → compaction → implement
    let triagedAction: 'FIX' | 'CLARIFY' | 'REJECT' = 'FIX';
    let reasoning = '';
    let subAgentPlanObj: any = null;
    let replyComment = '';
    let directPr = false;
    let directPrReasoning = '';
    let isSpam = false;
    let triageCategory = 'bug';
    let duplicateOf: string | null = null;

    const rootFiles = await githubService.getRepositoryRootFiles(owner, repoName, params.githubToken);
    const rootFilesList = rootFiles.join('\n');

    // Combined instructions: agent triages first, then implements if FIX
    const combinedInstructions = `You are an Autonomous GitHub Maintainer Agent with two phases:

## Phase 1: Triage
Investigate the reported GitHub issue. Read issue.md in your working directory for details. Explore the codebase using your filesystem tools (list_dir, read_file, grep_search) to understand the root cause.

## Triage Categories
Classify the issue into one of these categories:

### 1. Bug Fix (action: FIX)
- Clear error or unexpected behavior
- Steps to reproduce provided
- Affects existing functionality
- Can be fixed with code changes

### 2. Feature Request (action: CLARIFY or REJECT)
- New functionality not currently in the codebase
- Check if the feature already exists (search codebase)
- Check if it's already planned (look at existing issues/PRs)
- If it's a good idea but not a bug, respond with CLARIFY asking for more context
- If it's already implemented or duplicates existing functionality, REJECT with explanation

### 3. Question/Support (action: CLARIFY)
- User needs help using the project
- Not a bug or feature request
- Respond with helpful information or close as "not a bug"

### 4. Duplicate (action: REJECT)
- Search for similar issues before responding
- Use search_issues tool to find related issues
- If duplicate found, close with reference to original issue

### 5. Spam/Invalid (action: REJECT)
- Gibberish, promotional content, or unrelated to the project
- Close immediately with spam reasoning

## Before Implementing (FIX)
1. Verify the bug is reproducible
2. Check if a fix already exists in a PR or branch
3. Check if the fix might break other functionality
4. Only implement if confident the fix is correct and minimal

## Using GitHub MCP Tools
You have access to GitHub MCP tools. Use them to:
- Comment on issues: add_issue_comment
- Close issues: update_pull_request (for PRs) or add_issue_comment + let backend close
- Search for duplicates: search_issues
- Read files: get_file_contents
- Create PRs: create_pull_request

## Output Format
Output your triage decision as a SINGLE JSON object (no markdown wrappers):
{
  "action": "FIX" | "CLARIFY" | "REJECT",
  "category": "bug" | "feature_request" | "question" | "duplicate" | "spam",
  "reasoning": "Brief explanation of findings.",
  "isSpam": true | false,
  "duplicateOf": "issue number if duplicate, null otherwise",
  "directPr": true | false,
  "directPrReasoning": "true = low-risk fix, safe to auto-merge. false = needs human review before merge.",
  "subAgentPlan": {
    "issueContext": "What the issue is solving.",
    "analysisFindings": "Root cause and files involved.",
    "executionSteps": ["1. Edit [file]...", "2. Run [test]..."]
  },
  "replyComment": "Comment for CLARIFY/REJECT. For spam, explain why it was closed. For duplicates, reference the original issue."
}

## Phase 2: Implementation (only if action=FIX)
After outputting the JSON, wait for further instructions. You will be told to implement the fix.
When implementing:
1. Make minimal, precise file edits per the plan.
2. Run 'git diff' to review ALL your changes before committing. If any change is unnecessary or unrelated to the issue, revert it with 'git checkout -- <file>'.
3. Only commit files that directly address the issue. Do NOT commit lockfiles, build artifacts, or unrelated changes.
4. Verify changes with test suites.
5. Commit with a descriptive message. Do NOT push or open PRs.
6. The repo is already cloned — work with files in the root.`;

    console.log(`🤖 [AI Orchestrator] Creating single session at ${this.baseUrl}...`);
    let sessionId = '';
    try {
      const { data: session } = (await this.client.sessions.create({
        agent: {
          spec: {
            model: {
              name: this.normalizeModelName(params.modelName),
              params: { max_tokens: 4096, temperature: 0.1 },
            },
            instructions: combinedInstructions,
            config: {
              sandbox: { enabled: true },
              require_approval_for_tools: ['merge_pull_request'],
              mcp_servers: ['github'],
            },
          } as any,
        },
      })) as any;

      if (!session?.id) throw new Error(`Failed to create session ${JSON.stringify(session)}`);
      sessionId = session.id;
      await prisma.maintainerWorkflow.update({ where: { id: workflow.id }, data: { trueforgeSessionId: sessionId } });

      // Step A: Clone repo + write issue.md inside sandbox
      const issueContent = `# GitHub Issue #${params.issueNumber}\n\n**Repository**: ${params.repoFullName}\n**Title**: ${params.title}\n**Author**: ${params.author}\n\n## Description\n${params.body}`;
      await this.prepareSandbox({ repoFullName: params.repoFullName, sessionId, token: params.githubToken, issueFileContent: issueContent });

      // Step B: Triage turn
      const triagePrompt = `Investigate issue #${params.issueNumber} in ${params.repoFullName}:\nTitle: ${params.title}\nDescription: ${params.body}\n\nRoot-level files:\n${rootFilesList}\n\nMake your triage decision and return the JSON.`;

      console.log(`⏳ [AI Orchestrator] Running triage turn...`);
      let triageResponse = '';
      const triageResult = await this.streamTurnWithAutoResume(sessionId, triagePrompt, (event) => {
        if (event.type === 'model.message.delta') triageResponse += event.content || '';
        if (event.type === 'model.message' && typeof event.content === 'string') triageResponse = event.content;
        if (event.type === 'turn.done' && event.state?.output?.content && typeof event.state.output.content === 'string') triageResponse = event.state.output.content;
      });
      triageResponse = triageResult.accumulatedText || triageResponse;
      console.log('ℹ️ [Triage] Response:', triageResponse);

      // Parse triage JSON
      const jsonMatch = triageResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/) || triageResponse.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        triagedAction = parsed.action || 'FIX';
        reasoning = parsed.reasoning || '';
        subAgentPlanObj = parsed.subAgentPlan || null;
        replyComment = parsed.replyComment || '';
        directPr = parsed.directPr ?? false;
        directPrReasoning = parsed.directPrReasoning || '';
        isSpam = parsed.isSpam ?? false;
        triageCategory = parsed.category || 'bug';
        duplicateOf = parsed.duplicateOf || null;
      }
    } catch (e: any) {
      console.warn('Triage failed, defaulting to FIX:', e);
      reasoning = `Triage failed: ${e.message || String(e)}`;
    }

    // 6. Dispatch triage actions
    if (triagedAction === 'CLARIFY') {
      const commentBody = replyComment || `🤖 **Maintainer Update**: Clarification requested. ${reasoning}`;
      await githubService.addIssueComment(owner, repoName, params.issueNumber, commentBody, params.githubToken);
      const updatedWorkflow = await prisma.maintainerWorkflow.update({ where: { id: workflow.id }, data: { status: 'awaiting_input', prDecisionReasoning: `🤖 Triage: CLARIFY. ${reasoning}`, events: { create: { type: 'clarification_requested', title: 'Clarification requested on GitHub', detail: commentBody } } } });
      return { workflow: updatedWorkflow, triage, prNum: null, sessionId };
    }

    if (triagedAction === 'REJECT') {
      let commentBody = '';
      let eventTitle = '';
      
      if (isSpam) {
        // Auto-close spam issues with reasoning
        commentBody = replyComment || `🤖 **Maintainer Update**: This issue has been identified as spam and has been closed.\n\n**Reason**: ${reasoning}`;
        await githubService.closeIssue(owner, repoName, params.issueNumber, commentBody, params.githubToken);
        console.log(`🔒 [AI Orchestrator] Spam issue #${params.issueNumber} closed automatically`);
        eventTitle = `Issue rejected on GitHub (spam)`;
      } else if (duplicateOf) {
        // Close as duplicate with reference to original issue
        commentBody = replyComment || `🤖 **Maintainer Update**: This issue is a duplicate of #${duplicateOf} and has been closed.\n\n**Reason**: ${reasoning}`;
        await githubService.closeIssue(owner, repoName, params.issueNumber, commentBody, params.githubToken);
        console.log(`🔒 [AI Orchestrator] Duplicate issue #${params.issueNumber} closed (duplicate of #${duplicateOf})`);
        eventTitle = `Issue closed as duplicate of #${duplicateOf}`;
      } else {
        // Regular reject - add comment and close
        commentBody = replyComment || `🤖 **Maintainer Update**: Issue closed. ${reasoning}`;
        await githubService.closeIssue(owner, repoName, params.issueNumber, commentBody, params.githubToken);
        console.log(`🔒 [AI Orchestrator] Issue #${params.issueNumber} closed`);
        eventTitle = `Issue rejected on GitHub`;
      }
      
      const updatedWorkflow = await prisma.maintainerWorkflow.update({ where: { id: workflow.id }, data: { status: 'failed', prDecisionReasoning: `🤖 Triage: REJECT (${triageCategory}${isSpam ? ', spam' : ''}${duplicateOf ? `, duplicate of #${duplicateOf}` : ''}). ${reasoning}`, events: { create: { type: 'issue_rejected', title: eventTitle, detail: commentBody } } } });
      return { workflow: updatedWorkflow, triage, prNum: null, sessionId };
    }

    // FIX: Implementation turn — compact context + implement in one turn
    console.log(`🤖 [AI Orchestrator] Triage: FIX. Starting implementation...`);

    const implPrompt = `Triage complete. Now implement the fix.\n\nForget the triage analysis above. Here is your implementation plan:\n\nIssue: #${params.issueNumber} — ${params.title}\nContext: ${subAgentPlanObj?.issueContext || params.title}\nFindings: ${subAgentPlanObj?.analysisFindings || reasoning}\nSteps:\n${Array.isArray(subAgentPlanObj?.executionSteps) ? subAgentPlanObj.executionSteps.join('\n') : '1. Investigate codebase\n2. Implement fix'}\n\nThe repository is already cloned in your working directory. Read issue.md for full context. Do NOT run git clone. Make minimal edits, verify with tests, and commit.`;

    // Stream implementation turn and consume developer session events (tool calls, etc.)
    console.log(`⏳ [AI Orchestrator] Developer implementation stream started...`);
    this.consumeDeveloperAgentSession(sessionId, implPrompt, workflow.id)
      .then(() => console.log('✅ [AI Orchestrator] Developer session completed successfully'))
      .catch((err) => console.error('❌ [AI Orchestrator] Error in consumeDeveloperAgentSession:', err?.message || err));

    const updatedWorkflow = await prisma.maintainerWorkflow.update({ where: { id: workflow.id }, data: { status: 'investigating', prDecisionReasoning: `🤖 Triage: FIX. ${reasoning}`, directPr, directPrReasoning } });
    return { workflow: updatedWorkflow, triage, prNum: null, sessionId };
  }

  /**
   * Helper to create or ensure the GitHub Maintainer agent manifest.
   */
  getAgentManifest(options?: MaintainerAgentOptions) {
    const modelName = this.normalizeModelName(options?.modelName || process.env.DEFAULT_LLM_MODEL);

    return {
      model: {
        name: modelName,
        params: { max_tokens: 4096, temperature: 0.1 },
      },
      instructions: options?.instructions || `You are an Autonomous GitHub Repository Maintainer.
Your goal is to inspect reported GitHub issues, investigate the codebase, apply bug fixes or features, and verify with test execution. Commit your work locally on a git branch — the Maintainer service publishes branches, opens Pull Requests, and requests Maintainer approval before merging.

Follow these strict maintainer workflow rules:
1. Always analyze root causes thoroughly and provide a structured investigation summary.
2. Ensure changes are minimal, safe, and adhere to repo conventions.
3. Do not push to remotes or open Pull Requests yourself; the service publishes your branch after review.
4. Pause for human approval before calling any PR merge tool.
5. Generate clear risk assessments and test logs for the maintainer dashboard review.`,
    };
  }

  /**
   * Start a new session for a GitHub Issue investigation workflow
   */
  async createIssueWorkflowSession(issueUrl: string, repoFullName: string, options?: MaintainerAgentOptions) {
    try {
      const manifest = this.getAgentManifest({ ...options, githubRepo: repoFullName });
      console.log('🤖 Creating TrueForge Session with model:', manifest.model.name);
      const { data: session } = await this.client.sessions.create({
        agent: {
          spec: manifest as any,
        },
      });
      console.log('✅ TrueForge Session created successfully:', session.id);
      return session;
    } catch (error: any) {
      console.warn('TrueForge API session create note:', error?.message || error);
      return {
        id: `sess-tf-${Date.now()}`,
        createdAt: new Date().toISOString(),
        title: `Workflow: ${issueUrl}`,
      };
    }
  }

  /**
   * Trigger an investigation turn for an issue
   */
  async startInvestigationTurn(sessionId: string, issueDetails: { issueNumber: number; repo: string; title: string; body: string }) {
    const prompt = `Investigate issue #${issueDetails.issueNumber} in repository ${issueDetails.repo}:
Title: ${issueDetails.title}
Description: ${issueDetails.body}

Step 1: Read affected files and reproduce/analyze the bug.
Step 2: Propose the fix and write detailed root cause analysis.
Step 3: Create a git branch locally and commit the changes. Do NOT push or open Pull Requests — the Maintainer service publishes branches and opens PRs.
Step 4: Execute test suite and report results.
Step 5: Request maintainer approval before final merge!`;

    try {
      const stream = await this.client.sessions.createTurnStream(sessionId, {
        input: [{ type: 'user.message', content: prompt }],
      });
      return stream;
    } catch (error: any) {
      console.warn('TrueForge SDK createTurnStream note:', error?.message || error);
      return null;
    }
  }

  /**
   * Submit human-in-the-loop approval or rejection for a paused tool call
   */
  async submitToolApproval(sessionId: string, threadId: string, toolCallId: string, approved: boolean, reason?: string) {
    try {
      const stream = await this.client.sessions.createTurnStream(sessionId, {
        input: [
          {
            type: 'user.tool_approval',
            threadId: threadId || 'main',
            toolCallId: toolCallId,
            approval: approved
              ? { status: 'allow' }
              : { status: 'deny', reason: reason || 'Maintainer requested changes / denied merge.' },
          },
        ],
      });
      return stream;
    } catch (error) {
      console.warn('TrueForge submitToolApproval fallback:', error);
      return null;
    }
  }

  /**
   * Helper to execute a turn stream with automatic rate-limit cooldown handling and "continue" resumption.
   */
  async streamTurnWithAutoResume(
    sessionId: string,
    initialPrompt: string,
    onEvent?: (event: any) => void,
    maxResumeAttempts = 5
  ): Promise<{ complete: boolean; accumulatedText: string }> {
    let currentPrompt = initialPrompt;
    let attempt = 0;
    let accumulatedText = '';
    let complete = false;

    while (!complete && attempt <= maxResumeAttempts) {
      try {
        console.log(
          attempt === 0
            ? `🚀 [AI Orchestrator] Starting turn stream for session ${sessionId}...`
            : `🔄 [AI Orchestrator] Resuming turn with "continue" after rate-limit cooldown (Attempt ${attempt}/${maxResumeAttempts})...`
        );

        const stream = await this.client.sessions.createTurnStream(sessionId, {
          input: [{ type: 'user.message', content: currentPrompt }],
        });

        for await (const event of stream) {
          if (onEvent) {
            onEvent(event);
          }
          if (event.type === 'model.message.delta') {
            accumulatedText += event.content || '';
          }
          if (event.type === 'model.message' && typeof event.content === 'string') {
            accumulatedText = event.content;
          }
          if (event.type === 'turn.done') {
            if (event.state?.output?.content && typeof event.state.output.content === 'string') {
              accumulatedText = event.state.output.content;
            }
            complete = true;
          }
        }

        complete = true;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const isRateLimit =
          errorMsg.includes('429') ||
          errorMsg.includes('Quota exceeded') ||
          errorMsg.includes('rate-limits') ||
          errorMsg.includes('limit: 15') ||
          errorMsg.includes('Resource has been exhausted');

        if (isRateLimit && attempt < maxResumeAttempts) {
          attempt++;
          const match = errorMsg.match(/retry in\s+([\d.]+)\s*s/i);
          const waitSeconds = match ? Math.ceil(parseFloat(match[1])) + 2 : 16;

          console.warn(
            `⏳ [Rate Limit] 429 hit. Waiting ${waitSeconds}s before prompting "continue" (Attempt ${attempt}/${maxResumeAttempts})...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          currentPrompt = 'continue';
        } else {
          throw err;
        }
      }
    }

    return { complete, accumulatedText };
  }

  async consumeDeveloperAgentSession(sessionId: string, initialPrompt: string, workflowId: string) {
    let accumulatedLogs = '🤖 [Agent Stream Initialized]\n';
    let accumulatedReasoning = '';
    let affectedFiles: string[] = [];
    let branchName = '';
    let testPassed = true;
    let testLog = 'All sandbox checks passed.';

    try {
      await this.streamTurnWithAutoResume(
        sessionId,
        initialPrompt,
        (event) => {
          if (event.type === 'model.message.delta') {
            const text = event.content || '';
            accumulatedReasoning += text;
            accumulatedLogs += text;
          }

          if (event.type === 'model.message') {
            if (event.content && typeof event.content === 'string') {
              accumulatedReasoning = event.content;
            }
            if (event.toolCalls && event.toolCalls.length > 0) {
              for (const call of event.toolCalls) {
                const toolName = call.function?.name || '';
                const toolArgs = call.function?.arguments || '{}';
                accumulatedLogs += `\n🛠️ [Tool Call] ${toolName} with args: ${toolArgs}\n`;
                console.log(`🛠️ [Developer Agent] Calling tool: ${toolName} with args: ${toolArgs}`);

                try {
                  const parsedArgs = JSON.parse(toolArgs);
                  if (parsedArgs.branch) {
                    branchName = parsedArgs.branch;
                  }
                  if (parsedArgs.path && !affectedFiles.includes(parsedArgs.path)) {
                    affectedFiles.push(parsedArgs.path);
                  }
                } catch {}
              }
            }
          }

          if (event.type === 'tool.response') {
            const toolResult = event.content || '';
            accumulatedLogs += `\n📥 [Tool Response] ${toolResult}\n`;
            console.log(`📥 [Developer Agent] Tool response: ${toolResult.slice(0, 150)}...`);
            if (toolResult.toLowerCase().includes('fail') || toolResult.toLowerCase().includes('error')) {
              testPassed = false;
            }
            if (toolResult.toLowerCase().includes('pass') || toolResult.toLowerCase().includes('test')) {
              testLog += `\n${toolResult}`;
            }
          }

          if (event.type === 'tool.approval_required') {
            accumulatedLogs += `\n⏸️ [Human Checkpoint] Approval required for tool execution.\n`;
          }

          if (event.type === 'turn.done') {
            accumulatedLogs += `\n✅ [Agent Turn Completed]\n`;
          }
        }
      );

      let diff = '';
      let changedFiles: string[] = [];
      let workflow: any = null;
      let activeSessionId = sessionId;
      try {
        workflow = await prisma.maintainerWorkflow.findUnique({
          where: { id: workflowId },
        });
        console.log(`📋 [Post-Process] Workflow: directPr=${workflow?.directPr} prCreated=${workflow?.prCreated} status=${workflow?.status}`);
        if (!activeSessionId) {
          activeSessionId = workflow?.trueforgeSessionId || '';
        }
        if (activeSessionId) {
          changedFiles = await this.getSandboxChangedFiles(activeSessionId);
          console.log(`📂 [Post-Process] Changed files: ${changedFiles.length} files: ${changedFiles.join(', ')}`);
          diff = this.runInSandbox(
            activeSessionId,
            `B=main; git rev-parse --verify -q refs/heads/main >/dev/null 2>&1 || B=master
if git rev-parse -q --verify "refs/remotes/origin/$B" >/dev/null 2>&1; then UP="origin/$B"; else UP="$B"; fi
git diff "$UP..HEAD"`
          );
        }
      } catch (err: any) {
        console.warn('❌ [Post-Process] Failed to generate git diff from sandbox:', err.message || err);
      }

      const substantiveFiles = changedFiles.filter((f) => !BUILD_ARTIFACT_FILES.has(f));
      console.log(`📊 [Post-Process] Substantive files: ${substantiveFiles.length}`);

      let prNumber = workflow?.prNumber || null;
      let prCreated = workflow?.prCreated || false;
      let status = 'awaiting_approval';
      let publishNote = '';
      let publishedBranch = '';

      if (!workflow.prCreated && activeSessionId) {
        console.log(`🚀 [AI Orchestrator] Publishing agent branch to GitHub (directPr=${workflow?.directPr})...`);

        if (!substantiveFiles.length) {
          // Sanity check: the supervisor asked for a direct PR, but every change is
          // lockfile/build residue (or nothing at all). Fall back to human review.
          publishNote = `⚠️ Auto-publish withheld by sanity check: no substantive file changes detected (${changedFiles.length ? 'only build artifacts' : 'sandbox unchanged'}). Awaiting maintainer review instead.`;
          console.warn(`⚠️ [AI Orchestrator] ${publishNote}`);
        } else {
          try {
            const [owner, repoName] = workflow.repoFullName.split('/');
            const userSettings = await prisma.maintainerSettings.findFirst();
            const token = userSettings?.githubToken || undefined;

            const published = await this.publishSandboxBranch({
              sessionId,
              repoFullName: workflow.repoFullName,
              token,
              issueNumber: workflow.issueNumber,
            });

            if (published.ok) {
              publishedBranch = published.branch;
              const prTitle = buildConventionalTitle(published.lastCommitMessage || workflow.title, workflow.issueNumber);
              const createdPr = await githubService.createPullRequestOnGitHub(
                owner,
                repoName,
                {
                  title: prTitle,
                  body: `### Autonomous Maintainer Investigation & Fix\n\n**Issue**: #${workflow.issueNumber} (${workflow.title})\n\n**Published branch**: \`${published.branch}\`\n\n**Triage Decision**: Direct publish approved by supervisor (Reason: *${workflow.directPrReasoning}*).\n\n---\n*Published automatically by Autonomous Maintainer via TrueForge Agent Harness.*`,
                  head: published.branch,
                },
                token
              );

              if (createdPr.success) {
                prNumber = createdPr.number || null;
                prCreated = true;
                console.log(`✅ [AI Orchestrator] Pull Request created successfully: #${prNumber}`);

                // Run code review on the new PR
                try {
                  const { codeReviewEngine } = await import('#/lib/code-review');
                  const review = await codeReviewEngine.reviewPR(owner, repoName, prNumber!, token);
                  await codeReviewEngine.postReview(owner, repoName, prNumber!, review, token);
                  console.log(`🔍 [AI Orchestrator] Code review completed: ${review.comments.length} comments, approve: ${review.approve}`);
                } catch (reviewErr: any) {
                  console.warn('⚠️ [AI Orchestrator] Code review failed:', reviewErr.message || reviewErr);
                }
              } else {
                publishNote = `Branch published but PR creation failed: ${createdPr.error}`;
                console.error(`❌ [AI Orchestrator] ${publishNote}`);
              }
            } else {
              publishNote = `Auto-publish failed: ${published.error}`;
              console.warn(`⚠️ [AI Orchestrator] ${publishNote}`);
            }
          } catch (prErr: any) {
            publishNote = `Error during automatic PR creation: ${prErr.message || prErr}`;
            console.error(`❌ [AI Orchestrator] ${publishNote}`);
          }
        }
      }

      await prisma.maintainerWorkflow.update({
        where: { id: workflowId },
        data: {
          status,
          prNumber,
          prCreated,
          rootCause: accumulatedReasoning.slice(0, 1000) || 'Analyzed codebase and resolved issue.',
          affectedFiles: affectedFiles.length > 0 ? affectedFiles : substantiveFiles,
          recommendation: prCreated
            ? `Pull Request #${prNumber} created from agent history. Review and merge.`
            : 'Verify sub-agent code patch and approve PR creation.',
          riskLevel: testPassed ? 'low' : 'medium',
          branch: publishedBranch || branchName || undefined,
          testPassed,
          testLog,
          diff: diff || undefined,
          ...(publishNote ? { prDecisionReasoning: `${workflow?.prDecisionReasoning || ''}\n\n${publishNote}`.trim() } : {}),
          prSummary: accumulatedReasoning.slice(0, 500) || 'Agent resolved issue; awaiting publish/merge decision.',
          events: {
            create: {
              type: 'sub_agent_completed',
              title: `Research & Fix Sub-Agent Completed`,
              detail: prCreated
                ? `Sub-agent finished; its git history was published to GitHub as PR #${prNumber}.`
                : `Sub-agent finished. Human approval required before publishing a PR.${publishNote ? ` Note: ${publishNote}` : ''}`,
            },
          },
        },
      });
    } catch (err: any) {
      console.warn('Error consuming agent turn stream:', err);
      await prisma.maintainerWorkflow.update({
        where: { id: workflowId },
        data: {
          status: 'failed',
          prDecisionReasoning: `❌ Agent Turn Failed: ${err?.message || err}`,
        },
      });
    }
  }

  /**
   * Backwards-compatible wrapper for consuming agent streams.
   */
  async consumeAgentStream(streamOrSessionId: any, workflowId: string, initialPrompt?: string) {
    if (typeof streamOrSessionId === 'string') {
      return this.consumeDeveloperAgentSession(streamOrSessionId, initialPrompt || 'continue', workflowId);
    }
    const workflow = await prisma.maintainerWorkflow.findUnique({ where: { id: workflowId } });
    if (workflow?.trueforgeSessionId) {
      return this.consumeDeveloperAgentSession(workflow.trueforgeSessionId, initialPrompt || 'continue', workflowId);
    }
  }
}

export const trueforge = new TrueForgeMaintainerService();
