import { TrueForge } from '@truefoundry/trueforge-sdk';

export interface MaintainerAgentOptions {
  modelName?: string; // e.g. 'google/gemini-2.5-flash-lite', 'anthropic/claude-sonnet-4-6'
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
      token: options?.token || process.env.TRUEFORGE_TOKEN,
      timeoutInSeconds: 600,
    });
  }

  /**
   * Helper to create or ensure the GitHub Maintainer agent spec.
   */
  getAgentManifest(options?: MaintainerAgentOptions) {
    const modelName = options?.modelName || process.env.DEFAULT_LLM_MODEL || 'google/gemini-2.5-flash-lite';
    
    return {
      model: {
        name: modelName,
        params: { max_tokens: 4096, temperature: 0.1 },
      },
      instructions: options?.instructions || `You are an Autonomous GitHub Repository Maintainer.
Your goal is to inspect reported GitHub issues, investigate the codebase, apply bug fixes or features, verify with test execution, create a Pull Request, and request Maintainer approval before merging.

Follow these strict maintainer workflow rules:
1. Always analyze root causes thoroughly and provide a structured investigation summary.
2. Ensure changes are minimal, safe, and adhere to repo conventions.
3. Pause for human approval before calling any PR merge tool (\`github_merge_pr\` or \`request_maintainer_merge_approval\`).
4. Generate clear risk assessments and test logs for the maintainer dashboard review.`,
      mcp_servers: [
        {
          name: 'github',
          enable_tools: ['@all'],
          require_approval_for_tools: ['merge_pull_request', 'github_merge_pr'],
        },
      ],
      config: {
        ask_user_questions: { enabled: true },
        dynamic_sub_agents: { enabled: true },
        context_management: {
          compaction: { enabled: true },
          large_tool_response: { enabled: true },
        },
      },
    };
  }

  /**
   * Start a new session for a GitHub Issue investigation workflow
   */
  async createIssueWorkflowSession(issueUrl: string, repoFullName: string, options?: MaintainerAgentOptions) {
    try {
      const manifest = this.getAgentManifest({ ...options, githubRepo: repoFullName });
      const { data: session } = await this.client.sessions.create({
        agent: {
          spec: manifest,
        },
        title: `Workflow: ${issueUrl}`,
      });
      return session;
    } catch (error) {
      console.warn('TrueForge API server not reachable, creating fallback session ID for local dev:', error);
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
Step 3: Create a git branch, commit the changes, and open a Pull Request.
Step 4: Execute test suite and report results.
Step 5: Request maintainer approval before final merge!`;

    try {
      const stream = await this.client.sessions.createTurnStream(sessionId, {
        input: [{ type: 'user.message', content: prompt }],
      });
      return stream;
    } catch (error) {
      console.warn('TrueForge SDK createTurnStream fallback for local mock:', error);
      return null;
    }
  }

  /**
   * Submit human-in-the-loop approval or rejection for a paused tool call (e.g. merge_pull_request)
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
}

export const trueforge = new TrueForgeMaintainerService();
