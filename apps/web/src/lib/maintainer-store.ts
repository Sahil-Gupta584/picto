export interface BYOKSettings {
  geminiApiKey: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  githubToken: string;
  selectedModel: string; // e.g. 'google/gemini-3.1-flash-lite', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4o'
  trueforgeBaseUrl: string;
}

export interface RepositoryConfig {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  connectedAt: string;
  webhookUrl: string;
  status: 'active' | 'pending_webhook' | 'disabled';
  sandboxProvider: string;
  autoFixEnabled: boolean;
}

export interface IssueItem {
  id: string;
  githubId: number;
  number: number;
  repoFullName: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  triaged: boolean;
  suitableForAutoFix: boolean;
  status: 'new' | 'investigating' | 'pr_created' | 'awaiting_approval' | 'merged' | 'rejected';
  analysis?: {
    rootCause: string;
    affectedFiles: string[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: string;
  };
  comments: Array<{
    id: string;
    author: string;
    body: string;
    createdAt: string;
    isAgent?: boolean;
  }>;
}

export interface PRItem {
  id: string;
  number: number;
  repoFullName: string;
  title: string;
  issueNumber: number;
  branch: string;
  diff: string;
  status: 'awaiting_approval' | 'approved' | 'merged' | 'changes_requested';
  summary: string;
  changes: string[];
  testResults: {
    passed: boolean;
    total: number;
    failed: number;
    durationMs: number;
    log: string;
  };
  agentReview: {
    verdict: string;
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
  };
  trueforgeSessionId: string;
  toolCallId?: string;
  threadId?: string;
  approvalToken?: string;
  createdAt: string;
}

export interface ActionLog {
  id: string;
  type: 'repo_connected' | 'issue_triaged' | 'sandbox_test_passed' | 'pr_created' | 'approval_requested' | 'pr_merged' | 'changes_requested';
  title: string;
  detail: string;
  timestamp: string;
  issueNumber?: number;
  prNumber?: number;
}

class MaintainerStore {
  private settings: BYOKSettings = {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    githubToken: process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '',
    selectedModel: 'google/gemini-3.1-flash-lite',
    trueforgeBaseUrl: process.env.TRUEFORGE_BASE_URL || 'http://localhost:8790',
  };

  private repos: RepositoryConfig[] = [
    {
      id: 'repo-1',
      owner: 'octocat',
      name: 'oauth-server-demo',
      fullName: 'octocat/oauth-server-demo',
      connectedAt: '2026-08-25T01:00:00.000Z',
      webhookUrl: 'http://localhost:5173/api/webhooks/github?repo=octocat/oauth-server-demo',
      status: 'active',
      sandboxProvider: 'TrueForge Harness Sandbox',
      autoFixEnabled: true,
    },
  ];

  private issues: IssueItem[] = [
    {
      id: 'iss-1',
      githubId: 101,
      number: 101,
      repoFullName: 'octocat/oauth-server-demo',
      title: 'OAuth callback rejects URLs containing encoded redirect parameter',
      body: 'When oauth callback processes redirect_uri with double encoded query params, decodeURIComponent throws Malformed URI or strips query params incorrectly.',
      state: 'open',
      author: 'octocat',
      createdAt: '2026-08-25T05:00:00.000Z',
      updatedAt: '2026-08-25T08:00:00.000Z',
      commentsCount: 2,
      triaged: true,
      suitableForAutoFix: true,
      status: 'awaiting_approval',
      analysis: {
        rootCause: 'URL decoding helper uses raw decodeURIComponent without pre-sanitizing nested percent encoding.',
        affectedFiles: ['src/oauth/callback.ts', 'tests/oauth.test.ts'],
        riskLevel: 'low',
        recommendation: 'Use safeUrlDecode utility with try/catch fallback.',
      },
      comments: [
        {
          id: 'c-1',
          author: 'octocat',
          body: 'Steps to reproduce: Visit /api/auth/callback?redirect_uri=https%3A%2F%2Fapp.com%2Fpath%3Fkey%3Dval',
          createdAt: '2026-08-25T05:00:00.000Z',
        },
        {
          id: 'c-2',
          author: 'trueforge-maintainer-agent',
          body: '🤖 TrueForge Agent Analysis: Verified bug in sandbox. Fix applied and unit tests passing (18/18). Opened PR #42.',
          createdAt: '2026-08-25T08:00:00.000Z',
          isAgent: true,
        },
      ],
    },
    {
      id: 'iss-2',
      githubId: 102,
      number: 102,
      repoFullName: 'octocat/oauth-server-demo',
      title: 'Memory leak in streaming response handler under peak SSE load',
      body: 'SSE client connections hold buffer reference after client socket disconnects prematurely.',
      state: 'open',
      author: 'dev_user',
      createdAt: '2026-08-24T22:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
      commentsCount: 1,
      triaged: true,
      suitableForAutoFix: false,
      status: 'new',
      analysis: {
        rootCause: 'Requires architectural socket lifecycle redesign.',
        affectedFiles: ['src/server/sse.ts'],
        riskLevel: 'high',
        recommendation: 'Needs maintainer architectural decision before automated PR.',
      },
      comments: [
        {
          id: 'c-3',
          author: 'dev_user',
          body: 'Noticed memory grows ~50MB/hour under load test.',
          createdAt: '2026-08-24T22:00:00.000Z',
        },
      ],
    },
  ];

  private prs: PRItem[] = [
    {
      id: 'pr-1',
      number: 42,
      repoFullName: 'octocat/oauth-server-demo',
      title: 'fix(oauth): safe decode redirect_uri query parameters',
      issueNumber: 101,
      branch: 'trueforge/fix-oauth-redirect-decoding',
      diff: `--- a/src/oauth/callback.ts
+++ b/src/oauth/callback.ts
@@ -14,5 +14,9 @@ export function parseRedirectUrl(rawUrl: string): string {
-  return decodeURIComponent(rawUrl);
+  try {
+    return decodeURIComponent(rawUrl);
+  } catch {
+    return encodeURI(rawUrl);
+  }
 }`,
      status: 'awaiting_approval',
      summary: 'Fixes URI decoding crash on nested encoded parameters during OAuth authentication handshake.',
      changes: [
        'Added safe URI decoding fallback in src/oauth/callback.ts',
        'Added regression test for double-encoded redirect_uri in tests/oauth.test.ts',
      ],
      testResults: {
        passed: true,
        total: 18,
        failed: 0,
        durationMs: 1420,
        log: 'PASS oauth.test.ts\nPASS auth-flow.test.ts\n\nTest Suites: 2 passed, 2 total\nTests:       18 passed, 18 total',
      },
      agentReview: {
        verdict: 'SAFE_TO_MERGE',
        riskLevel: 'low',
        warnings: [
          'Ensure downstream identity providers handle normalized redirect URLs.',
        ],
      },
      trueforgeSessionId: 'tf-session-101',
      toolCallId: 'call_merge_github_42',
      threadId: 'main',
      approvalToken: 'token-approve-pr-42',
      createdAt: '2026-08-25T08:00:00.000Z',
    },
  ];

  private logs: ActionLog[] = [
    {
      id: 'l-1',
      type: 'issue_triaged',
      title: 'Triaged Issue #101',
      detail: 'Marked suitable for automated fix (low risk)',
      timestamp: '2026-08-25T06:00:00.000Z',
      issueNumber: 101,
    },
    {
      id: 'l-2',
      type: 'sandbox_test_passed',
      title: 'TrueForge Sandbox Tests Passed',
      detail: '18/18 tests passed in 1.42s',
      timestamp: '2026-08-25T07:30:00.000Z',
      issueNumber: 101,
    },
    {
      id: 'l-3',
      type: 'pr_created',
      title: 'Created PR #42',
      detail: 'Branch trueforge/fix-oauth-redirect-decoding',
      timestamp: '2026-08-25T08:00:00.000Z',
      prNumber: 42,
    },
    {
      id: 'l-4',
      type: 'approval_requested',
      title: 'TrueForge Human Checkpoint Reached',
      detail: 'PR #42 paused at merge_pull_request gate. Awaiting maintainer approval.',
      timestamp: '2026-08-25T08:00:00.000Z',
      prNumber: 42,
    },
  ];

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings: Partial<BYOKSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    return this.settings;
  }

  getRepos() { return this.repos; }
  getIssues() { return this.issues; }
  getIssue(n: number) { return this.issues.find(i => i.number === n); }
  getPRs() { return this.prs; }
  getPR(n: number) { return this.prs.find(p => p.number === n); }
  getLogs() { return this.logs; }

  getNeedsAttention() {
    const pendingPRs = this.prs.filter(p => p.status === 'awaiting_approval');
    const pendingIssues = this.issues.filter(i => i.status === 'awaiting_approval' || i.status === 'new');
    return {
      pendingPRs,
      pendingIssues,
      totalCount: pendingPRs.length + pendingIssues.length,
    };
  }

  getSinceLastVisit() {
    const totalIssues = this.issues.length;
    const triagedCount = this.issues.filter(i => i.triaged).length;
    const prsCreated = this.prs.length;
    const mergedCount = this.prs.filter(p => p.status === 'merged').length;
    const passedTestsCount = this.prs.filter(p => p.testResults.passed).length;

    return {
      stats: {
        triagedCount,
        prsCreated,
        passedTestsCount,
        mergedCount,
        totalIssues,
      },
      recentLogs: this.logs.slice(0, 10),
    };
  }

  connectRepo(owner: string, name: string) {
    const fullName = `${owner}/${name}`;
    const newRepo: RepositoryConfig = {
      id: `repo-${Date.now()}`,
      owner,
      name,
      fullName,
      connectedAt: new Date().toISOString(),
      webhookUrl: `http://localhost:5173/api/webhooks/github?repo=${encodeURIComponent(fullName)}`,
      status: 'active',
      sandboxProvider: 'TrueForge Harness Sandbox',
      autoFixEnabled: true,
    };
    this.repos.push(newRepo);
    this.logs.unshift({
      id: 'l-' + Date.now(),
      type: 'repo_connected',
      title: `Connected Repository ${fullName}`,
      detail: 'Registered TrueForge maintainer agent and configured webhook monitoring.',
      timestamp: new Date().toISOString(),
    });
    return newRepo;
  }

  startIssueWorkflow(issueUrl: string, issueDetails?: { number: number; title: string; body: string; repoFullName: string }) {
    const issueNum = issueDetails?.number || Math.floor(100 + Math.random() * 900);
    const repoName = issueDetails?.repoFullName || 'octocat/oauth-server-demo';

    const newIssue: IssueItem = {
      id: `iss-${Date.now()}`,
      githubId: issueNum,
      number: issueNum,
      repoFullName: repoName,
      title: issueDetails?.title || `Issue #${issueNum} investigation`,
      body: issueDetails?.body || `Reported via ${issueUrl}`,
      state: 'open',
      author: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      commentsCount: 1,
      triaged: true,
      suitableForAutoFix: true,
      status: 'investigating',
      comments: [
        {
          id: `c-${Date.now()}`,
          author: 'trueforge-maintainer-agent',
          body: '🤖 TrueForge Autonomous Maintainer has launched investigation session in sandbox.',
          createdAt: new Date().toISOString(),
          isAgent: true,
        },
      ],
    };

    this.issues.unshift(newIssue);

    this.logs.unshift({
      id: 'l-' + Date.now(),
      type: 'issue_triaged',
      title: `Launched Agent for Issue #${issueNum}`,
      detail: `TrueForge session started. Analyzing codebase for fix.`,
      timestamp: new Date().toISOString(),
      issueNumber: issueNum,
    });

    return newIssue;
  }

  approvePR(n: number) {
    const pr = this.getPR(n);
    if (!pr) return null;
    pr.status = 'merged';
    const issue = this.getIssue(pr.issueNumber);
    if (issue) {
      issue.status = 'merged';
      issue.state = 'closed';
    }
    this.logs.unshift({
      id: 'l-' + Date.now(),
      type: 'pr_merged',
      title: `Merged PR #${pr.number} via TrueForge Approval`,
      detail: `PR merged into main. Linked issue #${pr.issueNumber} marked closed.`,
      timestamp: new Date().toISOString(),
      prNumber: pr.number,
      issueNumber: pr.issueNumber,
    });
    return pr;
  }

  rejectPR(n: number, reason?: string) {
    const pr = this.getPR(n);
    if (!pr) return null;
    pr.status = 'changes_requested';
    const issue = this.getIssue(pr.issueNumber);
    if (issue) {
      issue.status = 'rejected';
    }
    this.logs.unshift({
      id: 'l-' + Date.now(),
      type: 'changes_requested',
      title: `Requested Changes on PR #${pr.number}`,
      detail: reason || 'Maintainer requested revisions before merge approval.',
      timestamp: new Date().toISOString(),
      prNumber: pr.number,
      issueNumber: pr.issueNumber,
    });
    return pr;
  }
}

export const maintainerStore = new MaintainerStore();
