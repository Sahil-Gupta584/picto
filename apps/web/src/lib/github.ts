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

  private getHeaders(token?: string) {
    const activeToken = token || this.defaultToken;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Autonomous-Maintainer-App',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }
    return headers;
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
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: this.getHeaders(token),
      });

      if (!res.ok) {
        console.warn('GitHub listUserRepos note:', await res.text());
        return [];
      }

      const repos = (await res.json()) as any[];
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
      const headers = this.getHeaders(token);

      const existingRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, { headers });
      let existingWebhooks: any[] = [];
      if (existingRes.ok) {
        existingWebhooks = (await existingRes.json()) as any[];
      }

      const matched = existingWebhooks.find(
        (w: any) => w.config?.url === webhookUrl || w.config?.url?.replace(/\/$/, '') === webhookUrl.replace(/\/$/, '')
      );

      if (matched) {
        console.log(`ℹ️ Webhook already exists on GitHub for ${owner}/${repo} (ID: ${matched.id})`);
        return { success: true, webhookId: matched.id, alreadyExisted: true };
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            url: webhookUrl,
            content_type: 'json',
            insecure_ssl: '0',
          },
          events: ['issues'],
          active: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('GitHub createWebhook note:', errText);
        return { success: false, error: errText };
      }

      const data = (await res.json()) as any;
      return { success: true, webhookId: data.id, alreadyExisted: false };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async deleteWebhook(owner: string, repo: string, hookId: number, token?: string) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`, {
        method: 'DELETE',
        headers: this.getHeaders(token),
      });
      console.log(`🗑️ Deleted webhook (ID: ${hookId}) from ${owner}/${repo}`);
      return { success: res.ok };
    } catch (err: any) {
      console.warn(`⚠️ Failed to delete webhook (ID: ${hookId}) from ${owner}/${repo}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  async addIssueLabels(owner: string, repo: string, issueNumber: number, labels: string[], token?: string) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels }),
      });
      if (!res.ok) {
        console.warn('addIssueLabels note:', await res.text());
        return false;
      }
      console.log(`🏷️ Added labels [${labels.join(', ')}] to GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('addIssueLabels warning:', err);
      return false;
    }
  }

  async assignIssue(owner: string, repo: string, issueNumber: number, assignees: string[], token?: string) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees }),
      });
      if (!res.ok) {
        console.warn('assignIssue note:', await res.text());
        return false;
      }
      console.log(`👤 Assigned [${assignees.join(', ')}] to GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('assignIssue warning:', err);
      return false;
    }
  }

  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string, token?: string) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        console.warn('addIssueComment note:', await res.text());
        return false;
      }
      console.log(`💬 Posted AI Maintainer comment on GitHub Issue #${issueNumber}`);
      return true;
    } catch (err) {
      console.warn('addIssueComment warning:', err);
      return false;
    }
  }

  async createPullRequestOnGitHub(
    owner: string,
    repo: string,
    options: { title: string; body: string; head: string; base?: string; fileEdits?: Array<{ path: string; content: string }> },
    token?: string
  ): Promise<{ success: boolean; number?: number; html_url?: string; error?: string; status?: number }> {
    try {
      const headers = { ...this.getHeaders(token), 'Content-Type': 'application/json' };
      
      // 1. Get default branch
      let baseBranch = options.base || 'main';
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (repoRes.ok) {
          const repoData = (await repoRes.json()) as any;
          baseBranch = options.base || repoData.default_branch || 'main';
        }
      } catch {}

      // 2. Get ref SHA of base branch
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, { headers });
      if (!refRes.ok) {
        const refErr = await refRes.text();
        console.warn('Failed to fetch base branch ref:', refErr);
        return { success: false, error: `Failed to fetch base branch '${baseBranch}': ${refErr}`, status: refRes.status };
      }
      const refData = (await refRes.json()) as any;
      const baseSha = refData.object?.sha;

      // 3. Create branch ref if not existing
      const createRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${options.head}`,
          sha: baseSha,
        }),
      });

      if (!createRefRes.ok) {
        const createRefErrText = await createRefRes.text();
        console.warn(`⚠️ Branch 'refs/heads/${options.head}' ref note:`, createRefErrText);
        if (createRefRes.status === 403) {
          return {
            success: false,
            error: `GitHub API 403 Forbidden: Personal Access Token is missing 'repo' or 'contents: write' scope permissions.`,
            status: 403,
          };
        }
      }

      // 4. Commit File Changes to Branch
      if (options.fileEdits && options.fileEdits.length > 0) {
        for (const edit of options.fileEdits) {
          try {
            let existingSha: string | undefined = undefined;
            const fileCheckRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${edit.path}?ref=${options.head}`,
              { headers }
            );
            if (fileCheckRes.ok) {
              const fileData = (await fileCheckRes.json()) as any;
              existingSha = fileData.sha;
            }

            const contentBase64 = Buffer.from(edit.content, 'utf-8').toString('base64');
            const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${edit.path}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                message: `fix: ${options.title}`,
                content: contentBase64,
                branch: options.head,
                ...(existingSha ? { sha: existingSha } : {}),
              }),
            });

            if (putRes.ok) {
              console.log(`✅ Committed agent file edit to '${edit.path}' on branch '${options.head}' on GitHub.`);
            } else {
              console.warn(`File commit note for '${edit.path}':`, await putRes.text());
            }
          } catch (fileErr) {
            console.warn(`Error committing file '${edit.path}':`, fileErr);
          }
        }
      } else {
        // Maintainer patch metadata commit for branch creation
        const patchContent = Buffer.from(
          `# Autonomous Maintainer Fix\n\n**Title**: ${options.title}\n\n${options.body}\n\n*Generated by TrueForge Agent Harness*`
        ).toString('base64');

        try {
          let fileSha: string | undefined = undefined;
          const fileCheckRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/.maintainer-patch.md?ref=${options.head}`,
            { headers }
          );
          if (fileCheckRes.ok) {
            const fileData = (await fileCheckRes.json()) as any;
            fileSha = fileData.sha;
          }

          await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.maintainer-patch.md`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              message: `fix: maintainer patch for ${options.head}`,
              content: patchContent,
              branch: options.head,
              ...(fileSha ? { sha: fileSha } : {}),
            }),
          });
        } catch (commitErr) {
          console.warn('Maintainer commit error:', commitErr);
        }
      }

      // 5. Create Pull Request via GitHub REST API
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: options.title,
          body: options.body,
          head: options.head,
          base: baseBranch,
        }),
      });

      if (!prRes.ok) {
        const prErrText = await prRes.text();
        console.warn('GitHub createPullRequest note:', prErrText);
        return {
          success: false,
          error: `GitHub API ${prRes.status}: ${prErrText}`,
          status: prRes.status,
        };
      }

      const prData = (await prRes.json()) as any;
      console.log(`🎉 Created REAL Pull Request #${prData.number} on GitHub: ${prData.html_url}`);
      return { success: true, number: prData.number, html_url: prData.html_url };
    } catch (err: any) {
      console.warn('createPullRequestOnGitHub error:', err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: this.getHeaders(),
    });
    const data = (await res.json()) as any;
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
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    const comments = (await res.json()) as any[];
    return comments.map((c) => ({
      id: c.id,
      user: { login: c.user?.login || 'unknown', avatar_url: c.user?.avatar_url || '' },
      body: c.body || '',
      created_at: c.created_at,
    }));
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPR | null> {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
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
        mergeable: data.mergeable,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch {
      return null;
    }
  }

  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFileDiff[]> {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const files = (await res.json()) as any[];
      return files.map((f) => ({
        filename: f.filename,
        status: f.status as any,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
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
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit_title: commitTitle || `Merge pull request #${prNumber}`,
          merge_method: 'squash',
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, message: errorText };
      }

      const data = (await res.json()) as any;
      return { success: true, message: data.message || 'Pull Request merged successfully' };
    } catch (err: any) {
      return { success: false, message: err?.message || String(err) };
    }
  }
}

export const githubService = new GitHubService();
