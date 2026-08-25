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
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '',
    });
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

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const response = await this.octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return {
      number: response.data.number,
      title: response.data.title,
      body: response.data.body || '',
      state: response.data.state as 'open' | 'closed',
      html_url: response.data.html_url,
      user: {
        login: response.data.user?.login || 'unknown',
        avatar_url: response.data.user?.avatar_url || '',
      },
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
      comments: response.data.comments,
      labels: (response.data.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name || '',
        color: typeof l === 'string' ? 'gray' : l.color || 'gray',
      })),
    };
  }

  async getIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubComment[]> {
    const response = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return response.data.map((comment: any) => ({
      id: comment.id,
      user: {
        login: comment.user?.login || 'unknown',
        avatar_url: comment.user?.avatar_url || '',
      },
      body: comment.body || '',
      created_at: comment.created_at,
    }));
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPR> {
    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return {
      number: response.data.number,
      title: response.data.title,
      body: response.data.body || '',
      state: response.data.merged ? 'merged' : (response.data.state as 'open' | 'closed'),
      html_url: response.data.html_url,
      head: { ref: response.data.head.ref, sha: response.data.head.sha },
      base: { ref: response.data.base.ref },
      user: {
        login: response.data.user?.login || 'unknown',
        avatar_url: response.data.user?.avatar_url || '',
      },
      merged: response.data.merged,
      mergeable: response.data.mergeable ?? true,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
    };
  }

  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<GitHubFileDiff[]> {
    const response = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return response.data.map((file: any) => ({
      filename: file.filename,
      status: file.status as 'added' | 'modified' | 'removed' | 'renamed',
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
    }));
  }

  async mergePullRequest(owner: string, repo: string, pullNumber: number, commitTitle?: string) {
    const response = await this.octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      commit_title: commitTitle || `Merge pull request #${pullNumber} via Autonomous Maintainer`,
      merge_method: 'squash',
    });
    return response.data;
  }
}

export const githubService = new GitHubService();
