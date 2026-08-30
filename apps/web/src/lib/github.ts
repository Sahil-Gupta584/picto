import { Octokit } from 'octokit';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  comments: number;
  labels: Array<{ name: string; color: string }>;
}

export interface GitHubComment {
  id: number;
  user: { login: string; avatar_url: string };
  body: string;
  created_at: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string; avatar_url: string };
  merged: boolean;
  mergeable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubFileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export class GitHubService {
  private defaultToken: string;

  constructor(token?: string) {
    this.defaultToken = token || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
  }

  private getOctokit(token?: string) {
    const activeToken = token || this.defaultToken;
    return new Octokit({ auth: activeToken });
  }

  parseIssueUrl(url: string): { owner: string; repo: string; issueNumber: number } | null {
    try {
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/i);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          issueNumber: parseInt(match[3], 10),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async listUserRepos(token?: string) {
    try {
      const octokit = this.getOctokit(token);
      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
      });

      return repos.map((r) => ({
        id: r.id,
        name: r.name,
        owner: r.owner?.login || '',
        fullName: r.full_name,
        private: r.private,
        htmlUrl: r.html_url,
        description: r.description || '',
        defaultBranch: r.default_branch || 'main',
      }));
    } catch (err: any) {
      console.warn('listUserRepos error:', err?.message || err);
      return [];
    }
  }

  async createWebhook(owner: string, repo: string, webhookUrl: string, token?: string) {
    try {
      const octokit = this.getOctokit(token);

      let existingWebhooks: any[] = [];
      try {
        const hooksRes = await octokit.rest.repos.listWebhooks({ owner, repo });
        existingWebhooks = hooksRes.data;
      } catch {}

      const matched = existingWebhooks.find(
        (w: any) => w.config?.url === webhookUrl || w.config?.url?.replace(/\/$/, '') === webhookUrl.replace(/\/$/, '')
      );

      if (matched) {
        console.log(`ℹ️ Webhook already exists on GitHub for ${owner}/${repo} (ID: ${matched.id})`);
        return { success: true, webhookId: matched.id, alreadyExisted: true };
      }

      const { data } = await octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          insecure_ssl: '0',
        },
        events: ['issues', 'issue_comment', 'pull_request', 'pull_request_review_comment'],
        active: true,
      });

      return { success: true, webhookId: data.id, alreadyExisted: false };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async deleteWebhook(owner: string, repo: string, hookId: number, token?: string) {
    try {
      const octokit = this.getOctokit(token);
      await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: hookId });
      console.log(`🗑️ Deleted webhook (ID: ${hookId}) from ${owner}/${repo}`);
      return { success: true };
    } catch (err: any) {
      console.warn(`⚠️ Failed to delete webhook (ID: ${hookId}) from ${owner}/${repo}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  async addIssueLabels(owner: string, repo: string, issueNumber: number, labels: string[], token?: string) {
    try {
      const octokit = this.getOctokit(token);
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });
      console.log(`🏷️ Added labels [${labels.join(', ')}] to GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('addIssueLabels warning:', err);
      return false;
    }
  }

  async assignIssue(owner: string, repo: string, issueNumber: number, assignees: string[], token?: string) {
    try {
      const octokit = this.getOctokit(token);
      await octokit.rest.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees,
      });
      console.log(`👤 Assigned [${assignees.join(', ')}] to GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('assignIssue warning:', err);
      return false;
    }
  }

  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string, token?: string) {
    try {
      const octokit = this.getOctokit(token);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
      console.log(`💬 Posted AI Maintainer comment on GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('addIssueComment warning:', err);
      return false;
    }
  }

  async closeIssue(owner: string, repo: string, issueNumber: number, comment: string, token?: string) {
    try {
      const octokit = this.getOctokit(token);
      // Post closing comment first
      if (comment) {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body: comment,
        });
      }
      // Close the issue
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed',
        state_reason: 'not_planned',
      });
      console.log(`🔒 Closed GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('closeIssue warning:', err);
      return false;
    }
  }

  async closePR(owner: string, repo: string, prNumber: number, comment: string, token?: string) {
    try {
      const octokit = this.getOctokit(token);
      // Post closing comment first
      if (comment) {
        await octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          body: comment,
          event: 'COMMENT',
        });
      }
      // Close the PR
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        state: 'closed',
      });
      console.log(`🔒 Closed GitHub PR #${prNumber}`);
      return true;
    } catch (err) {
      console.warn('closePR warning:', err);
      return false;
    }
  }

  /**
   * Open a PR for an already-published head branch. The head branch (with its full git
   * history authored by the sandbox agent) must have been pushed beforehand via
   * TrueForgeMaintainerService.publishSandboxBranch — this method only creates the PR.
   */
  async createPullRequestOnGitHub(
    owner: string,
    repo: string,
    options: { title: string; body: string; head: string; base?: string },
    token?: string
  ): Promise<{ success: boolean; number?: number; html_url?: string; error?: string; status?: number }> {
    try {
      const octokit = this.getOctokit(token);

      // 1. Resolve base branch (defaults to the repo's default branch)
      let baseBranch = options.base || 'main';
      try {
        const repoInfo = await octokit.rest.repos.get({ owner, repo });
        baseBranch = options.base || repoInfo.data.default_branch || 'main';
      } catch {}

      // 2. Create Pull Request
      try {
        const { data: prData } = await octokit.rest.pulls.create({
          owner,
          repo,
          title: options.title,
          body: options.body,
          head: options.head,
          base: baseBranch,
        });
        console.log(`🎉 Created REAL Pull Request #${prData.number} on GitHub: ${prData.html_url}`);
        return { success: true, number: prData.number, html_url: prData.html_url };
      } catch (prErr: any) {
        console.warn('GitHub createPullRequest note:', prErr.message || prErr);
        if (prErr.status === 403) {
          return {
            success: false,
            error: `GitHub API 403 Forbidden: Personal Access Token is missing 'repo' or 'contents: write' scope permissions.`,
            status: 403,
          };
        }
        if (prErr.status === 422 && (prErr.message?.includes('already exists') || JSON.stringify(prErr.response?.data)?.includes('already exists'))) {
          console.log(`ℹ️ PR already exists for branch '${options.head}'. Fetching existing PR details...`);
          try {
            const prList = await octokit.rest.pulls.list({
              owner,
              repo,
              head: `${owner}:${options.head}`,
            });
            if (prList.data.length > 0) {
              const existingPr = prList.data[0];
              console.log(`🎉 Found existing Pull Request #${existingPr.number} on GitHub: ${existingPr.html_url}`);
              return { success: true, number: existingPr.number, html_url: existingPr.html_url };
            }
          } catch (listErr) {
            console.warn('Failed to fetch existing PR:', listErr);
          }
        }
        return {
          success: false,
          error: `GitHub API ${prErr.status}: ${prErr.message || prErr}`,
          status: prErr.status,
        };
      }
    } catch (err: any) {
      console.warn('createPullRequestOnGitHub error:', err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const octokit = this.getOctokit();
    const { data } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return {
      number: data.number,
      title: data.title,
      body: data.body || '',
      state: data.state as 'open' | 'closed',
      html_url: data.html_url,
      user: {
        login: data.user?.login || 'unknown',
        avatar_url: data.user?.avatar_url || '',
      },
      created_at: data.created_at,
      updated_at: data.updated_at,
      comments: data.comments,
      labels: (data.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name || '',
        color: typeof l === 'string' ? 'gray' : l.color || 'gray',
      })),
    };
  }

  async getIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubComment[]> {
    try {
      const octokit = this.getOctokit();
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
      });
      return comments.map((c) => ({
        id: c.id,
        user: { login: c.user?.login || 'unknown', avatar_url: c.user?.avatar_url || '' },
        body: c.body || '',
        created_at: c.created_at,
      }));
    } catch {
      return [];
    }
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPR | null> {
    try {
      const octokit = this.getOctokit();
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      return {
        number: data.number,
        title: data.title,
        body: data.body || '',
        state: data.state as any,
        html_url: data.html_url,
        head: { ref: data.head?.ref || '', sha: data.head?.sha || '' },
        base: { ref: data.base?.ref || '' },
        user: { login: data.user?.login || 'unknown', avatar_url: data.user?.avatar_url || '' },
        merged: data.merged || false,
        mergeable: data.mergeable ?? undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch {
      return null;
    }
  }

  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFileDiff[]> {
    try {
      const octokit = this.getOctokit();
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });
      return files.map((f) => ({
        filename: f.filename,
        status: f.status as any,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch || undefined,
      }));
    } catch {
      return [];
    }
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    commitTitle?: string,
    token?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const octokit = this.getOctokit(token);
      const { data } = await octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        commit_title: commitTitle || `Merge pull request #${prNumber}`,
        merge_method: 'squash',
      });
      return { success: true, message: data.message || 'Pull Request merged successfully' };
    } catch (err: any) {
      return { success: false, message: err?.message || String(err) };
    }
  }

  async getFileContents(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    token?: string
  ): Promise<string | null> {
    try {
      const octokit = this.getOctokit(token);
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: ref || 'HEAD',
      });

      if (Array.isArray(data)) {
        return null; // It's a directory
      }

      if (data.type === 'file' && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (err) {
      // File not found or other error
      return null;
    }
  }

  async getPullRequestDiff(owner: string, repo: string, prNumber: number, token?: string): Promise<string> {
    try {
      const octokit = this.getOctokit(token);
      const { data } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        headers: {
          accept: 'application/vnd.github.diff',
        },
      });
      return typeof data === 'string' ? data : '';
    } catch {
      return '';
    }
  }

  async getRepositoryRootFiles(owner: string, repo: string, token?: string): Promise<string[]> {
    try {
      const octokit = this.getOctokit(token);
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: '',
      });
      if (Array.isArray(data)) {
        return data.map((item) => `${item.name}${item.type === 'dir' ? '/' : ''}`);
      }
      return [];
    } catch {
      return [];
    }
  }
}

export const githubService = new GitHubService();

/**
 * Build a clean conventional-commit style title. Collapses duplicated prefixes
 * (e.g. "fix: fix: something") into one, and guarantees the issue number is
 * referenced so GitHub links the PR back to the issue.
 */
export function buildConventionalTitle(raw: string, issueNumber?: number): string {
  // Strip every leading "type(scope): " segment, then re-apply a single one.
  const stripped = raw.trim().replace(/^(?:[a-zA-Z]+(?:\([^)]*\))?\s*:\s*)+/, '').trim();
  let subject = stripped;
  if (!subject && issueNumber) subject = `resolve issue #${issueNumber}`;
  if (issueNumber && !/#\d+/.test(subject)) {
    subject = `${subject} (#${issueNumber})`;
  }
  return `fix: ${subject}`;
}
