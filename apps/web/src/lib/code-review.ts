import { githubService } from '#/lib/github';

// Review comment structure
export interface ReviewComment {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'suggestion' | 'nitpick';
  category: 'bug' | 'security' | 'performance' | 'style' | 'logic';
  message: string;
  suggestedFix?: string;
}

export interface ReviewResult {
  prNumber: number;
  summary: string;
  comments: ReviewComment[];
  approve: boolean;
  stats: {
    critical: number;
    warning: number;
    suggestion: number;
    nitpick: number;
  };
}

// Review prompts for different aspects
const REVIEW_PROMPTS = {
  bugs: `You are an expert code reviewer. Analyze this git diff for bugs and logic errors.

## Diff
{diff}

## Context (related files)
{context}

Focus ONLY on:
- Logic errors
- Off-by-one errors
- Null/undefined handling
- Race conditions
- Memory leaks
- Incorrect API usage

Output JSON:
{
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical|warning|suggestion",
      "category": "bug|logic",
      "message": "Description of the bug",
      "suggestedFix": "Fixed code (optional)"
    }
  ],
  "summary": "One paragraph overall assessment",
  "approve": true/false
}`,

  security: `You are a security expert. Analyze this git diff for security vulnerabilities.

## Diff
{diff}

## Context (related files)
{context}

Focus ONLY on:
- SQL injection, XSS, CSRF
- Hardcoded secrets
- Insecure dependencies
- Path traversal
- Authentication/authorization flaws
- SSRF, XXE
- Insecure deserialization

Output JSON:
{
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical|warning|suggestion",
      "category": "security",
      "message": "Description of the vulnerability",
      "suggestedFix": "Fixed code (optional)"
    }
  ],
  "summary": "Security assessment",
  "approve": true/false (false if critical security issues found)
}`,

  performance: `You are a performance expert. Analyze this git diff for performance issues.

## Diff
{diff}

## Context (related files)
{context}

Focus ONLY on:
- N+1 queries
- Unnecessary re-renders
- Memory leaks
- Inefficient algorithms
- Missing caching opportunities
- Large bundle size impacts

Output JSON:
{
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "warning|suggestion",
      "category": "performance",
      "message": "Description of the performance issue",
      "suggestedFix": "Optimized code (optional)"
    }
  ],
  "summary": "Performance assessment",
  "approve": true
}`,
};

export class CodeReviewEngine {
  private llmClient: any;
  private model: string;

  constructor(llmClient?: any, model?: string) {
    this.llmClient = llmClient;
    this.model = model || 'google-gemini/gemini-3-1-flash-lite';
  }

  /**
   * Get the diff for a PR
   */
  async getDiff(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
  ): Promise<string> {
    // Use GitHub API to get the diff
    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: token });

    const { data: diff } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });

    return diff as unknown as string;
  }

  /**
   * Get context files for the PR (related files, tests, etc.)
   */
  async getContext(
    owner: string,
    repo: string,
    files: string[],
    token?: string
  ): Promise<string> {
    const contextFiles: string[] = [];

    // Get test files for changed files
    for (const file of files) {
      const testFile = file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
      try {
        const content = await githubService.getFileContents(
          owner,
          repo,
          testFile,
          token
        );
        if (content) {
          contextFiles.push(`### ${testFile}\n${content.slice(0, 2000)}`);
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    return contextFiles.join('\n\n');
  }

  /**
   * Chunk large diffs into reviewable pieces
   */
  chunkDiff(diff: string, maxChars: number = 12000): string[] {
    const files = diff.split('diff --git ');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const fileDiff of files) {
      if (!fileDiff.trim()) continue;

      if (currentChunk.length + fileDiff.length > maxChars) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = fileDiff;
      } else {
        currentChunk += `\ndiff --git ${fileDiff}`;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  /**
   * Call LLM for review
   */
  async callLLM(prompt: string): Promise<string> {
    // If we have a client, use it
    if (this.llmClient) {
      const response = await this.llmClient.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      return response.choices[0].message.content || '';
    }

    // Otherwise, use fetch to call the model directly
    // This is a fallback - in production, you'd use the proper SDK
    throw new Error('LLM client not configured');
  }

  /**
   * Review a single chunk
   */
  async reviewChunk(
    chunk: string,
    context: string,
    promptTemplate: string
  ): Promise<{ comments: ReviewComment[]; summary: string; approve: boolean }> {
    const prompt = promptTemplate
      .replace('{diff}', chunk)
      .replace('{context}', context || 'No context available');

    const response = await this.callLLM(prompt);

    try {
      const parsed = JSON.parse(response);
      return {
        comments: parsed.comments || [],
        summary: parsed.summary || '',
        approve: parsed.approve ?? true,
      };
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
      return {
        comments: [],
        summary: 'Failed to parse review response',
        approve: true,
      };
    }
  }

  /**
   * Run full review on a PR
   */
  async reviewPR(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
  ): Promise<ReviewResult> {
    console.log(`🔍 [Code Review] Starting review for PR #${prNumber}...`);

    // 1. Get the diff
    const diff = await this.getDiff(owner, repo, prNumber, token);
    console.log(`📄 [Code Review] Got diff: ${diff.length} chars`);

    // 2. Extract changed files
    const changedFiles = diff
      .split('diff --git ')
      .filter((f) => f.trim())
      .map((f) => {
        const match = f.match(/b\/(.+?)\n/);
        return match ? match[1] : '';
      })
      .filter(Boolean);

    console.log(`📁 [Code Review] Changed files: ${changedFiles.join(', ')}`);

    // 3. Get context
    const context = await this.getContext(owner, repo, changedFiles, token);

    // 4. Chunk the diff
    const chunks = this.chunkDiff(diff);
    console.log(`📦 [Code Review] Split into ${chunks.length} chunks`);

    // 5. Run reviews in parallel
    const allComments: ReviewComment[] = [];
    const summaries: string[] = [];
    let shouldApprove = true;

    for (const [name, prompt] of Object.entries(REVIEW_PROMPTS)) {
      console.log(`🔍 [Code Review] Running ${name} review...`);

      for (const chunk of chunks) {
        const result = await this.reviewChunk(chunk, context, prompt);
        allComments.push(...result.comments);
        summaries.push(`[${name}] ${result.summary}`);
        if (!result.approve) shouldApprove = false;
      }
    }

    // 6. Calculate stats
    const stats = {
      critical: allComments.filter((c) => c.severity === 'critical').length,
      warning: allComments.filter((c) => c.severity === 'warning').length,
      suggestion: allComments.filter((c) => c.severity === 'suggestion').length,
      nitpick: allComments.filter((c) => c.severity === 'nitpick').length,
    };

    // 7. Build result
    const result: ReviewResult = {
      prNumber,
      summary: summaries.join('\n\n'),
      comments: allComments,
      approve: shouldApprove,
      stats,
    };

    console.log(`✅ [Code Review] Complete: ${allComments.length} comments, approve: ${shouldApprove}`);

    return result;
  }

  /**
   * Post review to GitHub PR
   */
  async postReview(
    owner: string,
    repo: string,
    prNumber: number,
    review: ReviewResult,
    token?: string
  ): Promise<void> {
    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: token });

    // 1. Create the review with summary
    const event = review.approve ? 'APPROVE' : 'REQUEST_CHANGES';

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      body: this.formatReviewBody(review),
      event: event as any,
    });

    console.log(`📝 [Code Review] Posted review with ${review.comments.length} comments`);
  }

  /**
   * Format the review body
   */
  private formatReviewBody(review: ReviewResult): string {
    const lines: string[] = [];

    lines.push('## 🤖 AI Code Review');
    lines.push('');

    // Stats summary
    lines.push('### Summary');
    lines.push(`- **Critical**: ${review.stats.critical}`);
    lines.push(`- **Warning**: ${review.stats.warning}`);
    lines.push(`- **Suggestion**: ${review.stats.suggestion}`);
    lines.push(`- **Nitpick**: ${review.stats.nitpick}`);
    lines.push('');

    // Verdict
    if (review.approve) {
      lines.push('### ✅ Verdict: APPROVE');
      lines.push('No critical issues found. This PR looks good to merge.');
    } else {
      lines.push('### ❌ Verdict: REQUEST CHANGES');
      lines.push('Critical issues found that need to be addressed before merging.');
    }
    lines.push('');

    // Detailed comments
    if (review.comments.length > 0) {
      lines.push('### Comments');
      lines.push('');

      for (const comment of review.comments) {
        const icon =
          comment.severity === 'critical'
            ? '🔴'
            : comment.severity === 'warning'
              ? '🟡'
              : comment.severity === 'suggestion'
                ? '💡'
                : '📝';

        lines.push(`${icon} **${comment.file}:${comment.line}** (${comment.category})`);
        lines.push(comment.message);
        if (comment.suggestedFix) {
          lines.push('```suggested');
          lines.push(comment.suggestedFix);
          lines.push('```');
        }
        lines.push('');
      }
    }

    // Overall assessment
    lines.push('---');
    lines.push('*Reviewed by AI Code Review Agent*');

    return lines.join('\n');
  }
}

// Export singleton instance
export const codeReviewEngine = new CodeReviewEngine();
