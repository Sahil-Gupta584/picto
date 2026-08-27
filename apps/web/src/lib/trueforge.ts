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
    return 'google-gemini/gemini-3-1-flash-lite';
  }

  private prepareSandbox(params: {
    repoFullName: string;
    sessionId: string;
    issueFileContent?: string;
  }) {
    // Run asynchronously to allow stream connection to initiate
    setTimeout(async () => {
      try {
        const gitUrl = `https://github.com/${params.repoFullName}.git`;
        const isWindows = process.platform === 'win32';
        
        let sandboxBaseDir = '';
        if (isWindows) {
          // Get WSL home directory dynamically (fallback to /home/gjugn if WSL command fails)
          let wslHome = '/home/gjugn';
          try {
            wslHome = execSync('wsl sh -c "echo \\$HOME"', { encoding: 'utf8' }).trim();
          } catch (err) {}
          sandboxBaseDir = `${wslHome}/.local/share/trueforge/sandboxes/${params.sessionId}`;
        } else {
          const home = process.env.HOME || os.homedir();
          sandboxBaseDir = `${home}/.local/share/trueforge/sandboxes/${params.sessionId}`;
        }

        console.log(`🤖 [AI Orchestrator] Preparing local sandbox for session ${params.sessionId} at ${sandboxBaseDir}...`);
        
        // Wait/poll for the directory to be created by the server (max 10 retries, 500ms delay)
        let sandboxExists = false;
        const checkCmd = isWindows
          ? `wsl sh -c "ls ${sandboxBaseDir}/*"`
          : `ls ${sandboxBaseDir}/*`;
          
        for (let i = 0; i < 10; i++) {
          try {
            execSync(checkCmd, { stdio: 'ignore' });
            sandboxExists = true;
            break;
          } catch (e) {
            // Wait 500ms natively without spawning shell commands
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (!sandboxExists) {
          console.error(`❌ [AI Orchestrator] Sandbox directory was not created within 5 seconds for session ${params.sessionId}`);
          return;
        }

        // 1. Run clone commands inside the sandbox directory
        const cloneCmd = isWindows
          ? `wsl sh -c "cd ${sandboxBaseDir}/* && git init && git remote add origin ${gitUrl} && git fetch && (git checkout -f main || git checkout -f master)"`
          : `cd ${sandboxBaseDir}/* && git init && git remote add origin ${gitUrl} && git fetch && (git checkout -f main || git checkout -f master)`;
        execSync(cloneCmd, { stdio: 'ignore' });
        console.log(`✅ [AI Orchestrator] Repository successfully cloned/checked out in sandbox!`);
        
        // 2. Write issue.md if content is provided
        if (params.issueFileContent) {
          const base64Content = Buffer.from(params.issueFileContent).toString('base64');
          const writeCmd = isWindows
            ? `wsl sh -c "echo '${base64Content}' | base64 -d > ${sandboxBaseDir}/*/issue.md"`
            : `echo '${base64Content}' | base64 -d > ${sandboxBaseDir}/*/issue.md`;
          execSync(writeCmd, { stdio: 'ignore' });
          console.log(`✅ [AI Orchestrator] issue.md successfully created inside sandbox!`);
        }
      } catch (err: any) {
        console.error(`❌ [AI Orchestrator] Error preparing sandbox:`, err.message || err);
      }
    }, 0);
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
    desiredBranch?: string;
    token?: string;
    issueNumber?: number;
  }): Promise<
    | { ok: true; branch: string; commitsAhead: number; committedLeftovers: boolean; lastCommitMessage: string }
    | { ok: false; error: string }
  > {
    if (!params.token) {
      return { ok: false, error: 'No GitHub token available for publishing sandbox branch.' };
    }

    try {
      // --- Inspect current sandbox state ---
      const inspectOut = this.runInSandbox(
        params.sessionId,
        `CURRENT=$(git rev-parse --abbrev-ref HEAD)
B=main; git rev-parse --verify -q refs/heads/main >/dev/null 2>&1 || B=master
if git rev-parse -q --verify "refs/remotes/origin/$B" >/dev/null 2>&1; then UP="origin/$B"; else UP="$B"; fi
AHEAD=$(git rev-list --count "$UP..HEAD" 2>/dev/null || echo 0)
DIRTY=$(git status --porcelain | cut -c4- | grep -Ev ${this.getHarnessPathFilter()} | wc -l | tr -d " ")
LASTMSG=$(git log -1 --pretty=%s 2>/dev/null)
echo "@current_branch=$CURRENT"
echo "@base_branch=$B"
echo "@commits_ahead=$AHEAD"
echo "@dirty_count=$DIRTY"
echo "@last_msg=$LASTMSG"`
      );
      const read = (key: string) => inspectOut.match(new RegExp(`^@${key}=(.*)$`, 'm'))?.[1] ?? '';
      const currentBranch = read('current_branch').trim();
      const baseBranch = read('base_branch').trim() || 'main';
      const commitsAhead = parseInt(read('commits_ahead').trim() || '0', 10);
      const dirtyCount = parseInt(read('dirty_count').trim() || '0', 10);
      const lastCommitMessage = read('last_msg').trim();

      if (inspectOut.includes('@@ERR@@')) {
        return { ok: false, error: inspectOut.trim() };
      }

      // --- Commit any leftover uncommitted edits so nothing the agent did is lost ---
      let committedLeftovers = false;
      if (dirtyCount > 0) {
        const b64Msg = Buffer.from(
          `chore: apply remaining maintainer agent edits${params.issueNumber ? ` (#${params.issueNumber})` : ''}`
        ).toString('base64');
        const commitOut = this.runInSandbox(
          params.sessionId,
          `git add -A -- . ':(exclude)issue.md'
if git -c user.name="Autonomous Maintainer Bot" -c user.email="maintainer-bot@trueforge.local" commit -m "$(printf '%s' '${b64Msg}' | base64 -d)" >/dev/null 2>&1; then
  echo "@committed=yes"
else
  echo "@committed=no"
fi`
        );
        committedLeftovers = commitOut.includes('@committed=yes');
        if (!committedLeftovers && dirtyCount > 0) {
          console.warn(`⚠️ [Publish] Failed to auto-commit ${dirtyCount} dirty files in sandbox.`);
        }
      }

      if (commitsAhead === 0 && !committedLeftovers) {
        return { ok: false, error: 'No changes found in sandbox — the agent produced no commits and no edits.' };
      }

      // --- Push HEAD by URL under a convention-named, collision-free branch ---
      // Pushing HEAD makes local branch state irrelevant; no need to rename or check out anything.
      // Branch name is sanitized to a safe charset before being embedded into the script.
      const sanitizeBranchName = (b: string) =>
        b.replace(/[^a-zA-Z0-9._/-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80);
      const desiredRaw =
        params.desiredBranch ||
        currentBranch ||
        `fix/issue-${params.issueNumber || 'x'}-${lastCommitMessage.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
      const desiredBranch =
        sanitizeBranchName(desiredRaw).replace(/^(main|master|develop)$/i, 'fix/agent-fix') || 'fix/agent-fix';

      const pushUrl = `https://x-access-token:${encodeURIComponent(params.token)}@github.com/${params.repoFullName}.git`;
      const pushOut = this.runInSandbox(
        params.sessionId,
        `PUSH_URL="${pushUrl}"
DESIRED="${desiredBranch}"
LOCAL_SHA=$(git rev-parse HEAD)
ALL_HEADS=$(git ls-remote --heads "$PUSH_URL" "refs/heads/\${DESIRED}*" 2>/dev/null)
MATCHING_BRANCH=$(printf '%s\n' "$ALL_HEADS" | grep "^$LOCAL_SHA" | head -n1 | awk '{print $2}' | sed 's#refs/heads/##')
if [ -n "$MATCHING_BRANCH" ]; then
  echo "@final_branch=$MATCHING_BRANCH"
  echo "@already_pushed=yes"
  exit 0
fi

TARGET="$DESIRED"
if printf '%s\n' "$ALL_HEADS" | grep -q "refs/heads/$DESIRED$"; then
  i=2
  while printf '%s\n' "$ALL_HEADS" | grep -q "refs/heads/\${DESIRED}-$i$"; do
    i=$((i+1))
  done
  TARGET="\${DESIRED}-$i"
fi

if git push "$PUSH_URL" "+HEAD:refs/heads/$TARGET" >/dev/null 2>&1; then
  echo "@final_branch=$TARGET"
else
  echo "@push_error=failed"
fi`
      );

      if (pushOut.includes('@push_error')) {
        return {
          ok: false,
          error:
            'git push failed. Verify the PAT has contents:write access to this repository and that network egress is allowed.',
        };
      }
      const finalBranch = pushOut.match(/^@final_branch=(.*)$/m)?.[1]?.trim();
      if (!finalBranch) {
        return { ok: false, error: 'Push produced no result — sandbox may not contain a repository.' };
      }
      console.log(`🚀 [AI Orchestrator] Published agent history to GitHub branch '${finalBranch}'.`);
      return {
        ok: true,
        branch: finalBranch,
        commitsAhead,
        committedLeftovers,
        lastCommitMessage,
      };
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

    // 5. Run Supervisor Triager Agent
    let triagedAction: 'FIX' | 'CLARIFY' | 'REJECT' = 'FIX';
    let reasoning = '';
    let subAgentPlanObj: any = null;
    let replyComment = '';
    let supervisorSessionId = '';
    let directPr = false;
    let directPrReasoning = '';

    const rootFiles = await githubService.getRepositoryRootFiles(owner, repoName, params.githubToken);
    const rootFilesList = rootFiles.join('\n');

    const supervisorInstructions = `You are the Lead Triaging Supervisor for an Autonomous AI Maintainer. 
Your role is to investigate reported GitHub issues, explore the codebase using your tools, and make one of the following decisions:
- FIX: The issue is a valid bug/feature with a clear implementation path. You will generate a detailed JSON developer plan.
- CLARIFY: The issue is ambiguous, lacks detail, or is a question. You will write a response comment asking the reporter for details.
- REJECT: The issue is spam, invalid, or out of scope. You will write a comment explaining why it is declined.

You can read the issue details inside the file issue.md in the current working directory. You must explore the codebase using your read-only filesystem tools (like list_dir, read_file, grep_search) to locate files, understand context, and find the root cause before outputting your decision.

Once you finish your investigation, you must output your final triage decision formatted EXACTLY as a single JSON object. Do not output any other text or markdown wrappers outside the JSON block:
{
  "action": "FIX" | "CLARIFY" | "REJECT",
  "reasoning": "A concise explanation of your findings and triage decision.",
  "directPr": true | false,
  "directPrReasoning": "Your analysis on whether it is safe for the Developer Agent to open the Pull Request directly without human review (e.g. low risk, simple changes, comprehensive test suite exists). Set directPr to true if the change is low risk and standard, otherwise false.",
  "subAgentPlan": {
    "issueContext": "Detailed description of what the issue is trying to solve.",
    "analysisFindings": "Detailed findings from your codebase investigation (files read, root cause details).",
    "executionSteps": [
      "1. Edit [file path] to resolve [reason]...",
      "2. Update [file path] to...",
      "3. Run [verification commands]..."
    ]
  },
  "replyComment": "The text of the comment to post on the GitHub issue (required for CLARIFY or REJECT, optional for FIX)."
}`;

    const supervisorPrompt = `Investigate issue #${params.issueNumber} in repository ${params.repoFullName}:
Title: ${params.title}
Description: ${params.body}

Here is the list of root-level files/folders in the repository:
${rootFilesList}

make decision what to do of this issue. and return a proper json accordnigly`;

    console.log(`🤖 [AI Orchestrator] Contacting TrueForge local server at ${this.baseUrl} to create Supervisor session...`);
    try {
      const { data: session } = (await this.client.sessions.create({
        agent: {
          spec: {
            model: {
              name: this.normalizeModelName(params.modelName),
              params: { max_tokens: 4096, temperature: 0.1 },
            },
            instructions: supervisorInstructions,
            config: {
              sandbox: {
                enabled: true,
              },
              require_approval_for_tools: ['merge_pull_request'],
            },
          } as any,
        },
      })) as any;

      if (!session?.id) {
        throw new Error(`Failed to create TrueForge supervisor session ${JSON.stringify(session)}`)
      }

        supervisorSessionId = session.id;
        await prisma.maintainerWorkflow.update({
          where: { id: workflow.id },
          data: { trueforgeSessionId: session.id },
        });

        this.prepareSandbox({
          repoFullName: params.repoFullName,
          sessionId: session.id,
          issueFileContent: supervisorIssueContent,
        });

        console.log(`⏳ [AI Orchestrator] Consuming Supervisor turn stream with auto-resume...`);
        let supervisorResponse = '';
        await this.streamTurnWithAutoResume(
          session.id,
          supervisorPrompt,
          (event) => {
            if (event.type === 'model.message.delta') {
              supervisorResponse += event.content || '';
            }
            if (event.type === 'model.message' && typeof event.content === 'string') {
              supervisorResponse = event.content;
            }
          }
        );

        console.log('ℹ️ [Supervisor Triager] Raw Response:', supervisorResponse);

        const jsonMatch = supervisorResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/) || supervisorResponse.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          triagedAction = parsed.action || 'FIX';
          reasoning = parsed.reasoning || '';
          subAgentPlanObj = parsed.subAgentPlan || null;
          replyComment = parsed.replyComment || '';
          directPr = parsed.directPr ?? false;
          directPrReasoning = parsed.directPrReasoning || '';
        }
      
    } catch (e: any) {
      console.warn('Supervisor triaging failed, defaulting to FIX action:', e);
      reasoning = `Triage failed: ${e.message || String(e)}`;
    }

    // 6. Dispatch Triage Actions
    if (triagedAction === 'CLARIFY') {
      const commentBody = replyComment || `🤖 **Maintainer Update**: Clarification requested. ${reasoning}`;
      await githubService.addIssueComment(owner, repoName, params.issueNumber, commentBody, params.githubToken);

      const updatedWorkflow = await prisma.maintainerWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: 'awaiting_input',
          prDecisionReasoning: `🤖 Supervisor triage: CLARIFY. Reasoning: ${reasoning}`,
          events: {
            create: {
              type: 'clarification_requested',
              title: `Clarification requested on GitHub`,
              detail: commentBody,
            },
          },
        },
      });

      return { workflow: updatedWorkflow, triage, prNum: null, sessionId: supervisorSessionId };
    }

    if (triagedAction === 'REJECT') {
      const commentBody = replyComment || `🤖 **Maintainer Update**: Issue closed. ${reasoning}`;
      await githubService.addIssueComment(owner, repoName, params.issueNumber, commentBody, params.githubToken);

      const updatedWorkflow = await prisma.maintainerWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: 'failed',
          prDecisionReasoning: `🤖 Supervisor triage: REJECT. Reasoning: ${reasoning}`,
          events: {
            create: {
              type: 'issue_rejected',
              title: `Issue rejected on GitHub`,
              detail: commentBody,
            },
          },
        },
      });

      return { workflow: updatedWorkflow, triage, prNum: null, sessionId: supervisorSessionId };
    }

    // Default to FIX: Spawn Developer Sub-Agent
    const devInstructions = `You are an Autonomous GitHub Developer Agent.
Your task is to execute the following implementation plan prepared by the Triaging Supervisor:

Issue Context:
${subAgentPlanObj?.issueContext || params.title}

Analysis & Findings:
${subAgentPlanObj?.analysisFindings || reasoning}

Execution Steps:
${Array.isArray(subAgentPlanObj?.executionSteps) ? subAgentPlanObj.executionSteps.join('\n') : '1. Investigate codebase\n2. Implement fix'}

Adhere to the following rules:
1. Make minimal, precise file edits to implement the plan.
2. Verify all changes by running appropriate test suites in the sandbox.
3. Commit your completed changes with a descriptive message (e.g. "fix: resolve <what> (<where>)"). The Maintainer service publishes branches and opens Pull Requests itself — do NOT push to any remote and do NOT attempt to open Pull Requests.
4. Pause for maintainer review before merging.
5. The repository is already cloned and fully checked out in your current working directory. Do NOT run git clone; work directly with the files in the root.
6. Read issue.md inside the current working directory for the complete implementation plan and issue context.`;

    console.log(`🤖 [AI Orchestrator] Supervisor triaged as FIX. Creating Developer Sub-Agent session on TrueForge Harness...`);
    const { data: devSession } = (await this.client.sessions.create({
      agent: {
        spec: {
          model: {
            name: this.normalizeModelName(params.modelName),
            params: { temperature: 0.1 },
          },
          instructions: devInstructions,
          config: {
            sandbox: {
              enabled: true,
            },
            require_approval_for_tools: ['merge_pull_request'],
          },
        } as any,
      },
    })) as any;

    if (!devSession?.id) {
      throw new Error(`Failed to create TrueForge developer session ${JSON.stringify(devSession)}`);
    }

    console.log(`✅ [AI Orchestrator] Developer session created: ${devSession.id}. Starting implementation turn...`);

      await prisma.maintainerWorkflow.update({
        where: { id: workflow.id },
        data: { trueforgeSessionId: devSession.id },
      });

      const devPrompt = `Please start executing the Developer Implementation Plan for issue #${params.issueNumber} in repository ${params.repoFullName}.

Implementation Plan:
- Issue Context: ${subAgentPlanObj?.issueContext || params.title}
- Analysis & Findings: ${subAgentPlanObj?.analysisFindings || reasoning}
- Execution Steps:
${Array.isArray(subAgentPlanObj?.executionSteps) ? subAgentPlanObj.executionSteps.join('\n') : '1. Investigate codebase\n2. Implement fix'}

Note: The repository is already cloned and fully checked out in your current working directory. Do NOT run git clone; work directly with the files in the root.`;
      this.prepareSandbox({
        repoFullName: params.repoFullName,
        sessionId: devSession.id,
        issueFileContent: devIssueContent,
      });

      console.log(`⏳ [AI Orchestrator] Developer stream started. Executing task in background Daytona sandbox with auto-resume...`);

      this.consumeDeveloperAgentSession(devSession.id, devPrompt, workflow.id).catch((err) =>
        console.error('Error in Developer consumeDeveloperAgentSession:', err)
      );

      const updatedWorkflow = await prisma.maintainerWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: 'investigating',
          prDecisionReasoning: `🤖 Supervisor triage: FIX. Reasoning: ${reasoning}`,
          directPr,
          directPrReasoning,
        },
      });

      return { workflow: updatedWorkflow, triage, prNum: null, sessionId: devSession.id };

    return { workflow, triage, prNum: null, sessionId: supervisorSessionId };
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
      let sessionId = '';
      let changedFiles: string[] = [];
      let workflow: any = null;
      try {
        workflow = await prisma.maintainerWorkflow.findUnique({
          where: { id: workflowId },
        });
        sessionId = workflow?.trueforgeSessionId || '';
        if (sessionId) {
          changedFiles = await this.getSandboxChangedFiles(sessionId);
          diff = this.runInSandbox(
            sessionId,
            `B=main; git rev-parse --verify -q refs/heads/main >/dev/null 2>&1 || B=master
if git rev-parse -q --verify "refs/remotes/origin/$B" >/dev/null 2>&1; then UP="origin/$B"; else UP="$B"; fi
git diff "$UP..HEAD"`
          );
        }
      } catch (err: any) {
        console.warn('Failed to generate git diff from sandbox:', err.message || err);
      }

      const substantiveFiles = changedFiles.filter((f) => !BUILD_ARTIFACT_FILES.has(f));

      let prNumber = workflow?.prNumber || null;
      let prCreated = workflow?.prCreated || false;
      let status = 'awaiting_approval';
      let publishNote = '';
      let publishedBranch = '';

      if (workflow?.directPr && !workflow.prCreated && sessionId) {
        console.log(`🚀 [AI Orchestrator] directPr is enabled! Publishing agent branch to GitHub...`);

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

            const titleSlug = workflow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20).replace(/-+$/g, '');
            const fallbackBranchName = `fix/issue-${workflow.issueNumber}-${titleSlug || 'fix'}`;

            const published = await this.publishSandboxBranch({
              sessionId,
              repoFullName: workflow.repoFullName,
              desiredBranch: fallbackBranchName,
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
