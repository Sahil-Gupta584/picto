import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import '@git-diff-view/react/styles/diff-view.css';
import { Card, Chip, Badge } from '@heroui/react';
import { Button } from '#/components/Button';
import { orpc } from '#/orpc/client';
import { RiBrainLine, RiCodeSSlashLine, RiShieldCheckLine, RiCheckDoubleLine } from 'react-icons/ri';
import { GoIssueOpened, GoIssueClosed, GoGitPullRequest, GoGitPullRequestClosed, GoGitMerge } from 'react-icons/go';

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function MarkdownBody({ children }: { children: string }) {
  if (!children) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 text-foreground border-b border-border pb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2 text-foreground border-b border-border pb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-medium mt-2 mb-1 text-foreground">{children}</h4>,
        p: ({ children }) => <p className="text-sm leading-relaxed mb-3 text-foreground">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-6 text-sm space-y-1 mb-3 text-foreground">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-6 text-sm space-y-1 mb-3 text-foreground">{children}</ol>,
        li: ({ children }) => <li className="text-sm leading-relaxed text-foreground">{children}</li>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          return isBlock
            ? <code className="block bg-[#161b22] border border-[#30363d] rounded-md p-4 text-[13px] font-mono whitespace-pre-wrap overflow-auto mb-3 text-foreground">{children}</code>
            : <code className="bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5 text-[12px] font-mono text-foreground">{children}</code>;
        },
        pre: ({ children }) => <pre className="mb-3">{children}</pre>,
        blockquote: ({ children }) => <blockquote className="border-l-4 border-[#30363d] pl-4 text-sm text-muted italic mb-3">{children}</blockquote>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#58a6ff] underline underline-offset-2 text-sm hover:text-[#79c0ff]">{children}</a>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        hr: () => <hr className="border-[#30363d] my-4" />,
        table: ({ children }) => <table className="w-full text-sm border-collapse mb-3">{children}</table>,
        th: ({ children }) => <th className="border border-[#30363d] px-3 py-1.5 text-left font-semibold bg-[#161b22] text-foreground">{children}</th>,
        td: ({ children }) => <td className="border border-[#30363d] px-3 py-1.5 text-foreground">{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export function GitHubUser({ login, size = 20 }: { login: string; size?: number }) {
  if (!login) return null;
  return (
    <a href={`https://github.com/${login}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
      <img src={`https://github.com/${login}.png?size=${size * 2}`} alt={login} width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
      <span className="text-xs text-muted font-mono">{login}</span>
    </a>
  );
}

export function IssueIcon({ status, size = 16 }: { status?: string; size?: number }) {
  const s = status?.toLowerCase() ?? '';
  if (s === 'closed' || s === 'rejected' || s === 'merged')
    return <GoIssueClosed size={size} className="text-[#8957e5] shrink-0" />;
  return <GoIssueOpened size={size} className="text-[#3fb950] shrink-0" />;
}

export function PRIcon({ status, size = 16 }: { status?: string; size?: number }) {
  const s = status?.toLowerCase() ?? '';
  if (s === 'merged') return <GoGitMerge size={size} className="text-[#8957e5] shrink-0" />;
  if (s === 'closed' || s === 'rejected') return <GoGitPullRequestClosed size={size} className="text-[#f85149] shrink-0" />;
  return <GoGitPullRequest size={size} className="text-[#3fb950] shrink-0" />;
}

export function DiffViewer({ diff }: { diff: string }) {
  const hunks = useMemo(() => {
    if (!diff) return [];
    return diff.split(/(?=^diff --git)/m).filter(Boolean);
  }, [diff]);
  if (!hunks.length) return <div className="text-xs text-muted p-4">No diff available</div>;
  return (
    <div className="overflow-auto max-h-[500px] text-xs">
      <DiffView data={{ hunks }} diffViewMode={DiffModeEnum.Unified} diffViewTheme="dark" diffViewHighlight={false} diffViewFontSize={12} />
    </div>
  );
}

function IssueReplyBox({ workflowId }: { workflowId: string }) {
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.maintainer.postIssueComment.mutationOptions({
      onSuccess: () => {
        setBody('');
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
      },
    })
  );
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="text-xs font-semibold text-foreground">Reply on GitHub</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment..."
        rows={3}
        className="w-full rounded-lg border border-border bg-[var(--surface-secondary)] text-sm text-foreground placeholder:text-muted px-3 py-2 resize-none focus:outline-none focus:border-[var(--accent)]"
      />
      <button
        onClick={() => mutation.mutate({ workflowId, body })}
        disabled={!body.trim() || mutation.isPending}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-40 hover:opacity-90 transition"
      >
        {mutation.isPending ? 'Posting…' : 'Comment'}
      </button>
    </div>
  );
}

// ─── IssueDrawer ──────────────────────────────────────────────────────────────

export interface IssueDrawerProps {
  issue: any;
  onClose: () => void;
}

export function IssueDrawer({ issue, onClose }: IssueDrawerProps) {
  const queryClient = useQueryClient();
  const s = issue.status?.toLowerCase() ?? '';
  const isClosed = s === 'closed' || s === 'rejected' || s === 'merged';

  const closeMutation = useMutation(
    orpc.maintainer.closeIssue.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getIssues.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
        onClose();
      },
    })
  );

  return (
    <>
      <h2 className="text-xl font-semibold text-foreground leading-snug">
        {issue.title}
        <span className="ml-2 text-xl font-light text-muted">#{issue.number}</span>
      </h2>

      <div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isClosed ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
          <IssueIcon status={issue.status} size={14} />
          {isClosed ? 'Closed' : 'Open'}
        </span>
      </div>

      {issue.author && (
        <div className="flex items-center justify-between px-3 py-2 -mb-px rounded-t-lg bg-accent/5 border border-accent/15">
          <GitHubUser login={issue.author} />
          <span className="text-[10px] border border-accent/15 rounded-full px-2 py-0.5 text-muted">Owner</span>
        </div>
      )}

      <div className="rounded-b-lg rounded-tr-lg p-4 border border-accent/15" style={{ borderTop: issue.author ? 'none' : undefined }}>
        <MarkdownBody>{issue.body}</MarkdownBody>
      </div>

      {issue.analysis?.rootCause && (
        <Card>
          <Card.Content>
            <div className="font-semibold flex items-center gap-1.5 mb-1 text-foreground"><RiBrainLine /> Root Cause</div>
            <div className="text-xs text-foreground">{issue.analysis.rootCause}</div>
            {issue.analysis.affectedFiles?.length > 0 && (
              <div className="text-[11px] text-muted mt-1">Affected: {issue.analysis.affectedFiles.join(', ')}</div>
            )}
          </Card.Content>
        </Card>
      )}

      <IssueReplyBox workflowId={issue.id} />

      {!isClosed && (
        <Button variant="ghost" className="text-danger text-xs w-full justify-start" onPress={() => closeMutation.mutate({ workflowId: issue.id })} isLoading={closeMutation.isPending}>
          Close issue
        </Button>
      )}
    </>
  );
}

// ─── PrDrawer ─────────────────────────────────────────────────────────────────

export interface PrDrawerProps {
  pr: any;
  liveDiff?: any;
  onClose: () => void;
}

export function PrDrawer({ pr, liveDiff, onClose }: PrDrawerProps) {
  const queryClient = useQueryClient();
  const s = pr.status?.toLowerCase() ?? '';
  const isMerged = s === 'merged';
  const isClosed = s === 'closed' || s === 'rejected';

  const approveMutation = useMutation(
    orpc.maintainer.approvePR.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getPRReviews.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getNeedsAttention.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
      },
    })
  );

  const closeMutation = useMutation(
    orpc.maintainer.closePR.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getPRReviews.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getNeedsAttention.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
        onClose();
      },
    })
  );

  return (
    <>
      <h2 className="text-xl font-semibold text-foreground leading-snug">
        {pr.title}
        <span className="ml-2 text-xl font-light text-muted">#{pr.number}</span>
      </h2>

      <div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isMerged ? 'bg-accent/10 text-accent' : isClosed ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
          <PRIcon status={pr.status} size={14} />
          {isMerged ? 'Merged' : isClosed ? 'Closed' : 'Open'}
        </span>
      </div>

      {pr.author && (
        <div className="flex items-center justify-between px-3 py-2 -mb-px rounded-t-lg bg-accent/5 border border-accent/15">
          <GitHubUser login={pr.author} />
          <span className="text-[10px] border border-accent/15 rounded-full px-2 py-0.5 text-muted">Owner</span>
        </div>
      )}

      {pr.summary && (
        <div className={`p-4 border border-accent/15 ${pr.author ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg'}`} style={{ borderTop: pr.author ? 'none' : undefined }}>
          <MarkdownBody>{pr.summary}</MarkdownBody>
        </div>
      )}

      <Card>
        <Card.Header>
          <span className="flex items-center gap-1.5 text-xs"><RiCodeSSlashLine /> Diff</span>
          {liveDiff && <span className="text-xs text-muted">{String(liveDiff.files?.length ?? '')} files</span>}
        </Card.Header>
        <Card.Content className="p-0">
          {liveDiff
            ? <DiffViewer diff={liveDiff.diff || ''} />
            : <div className="text-xs text-muted p-4">Loading diff…</div>
          }
        </Card.Content>
      </Card>

      {pr.testResults && (
        <Card>
          <Card.Content>
            <div className="flex justify-between mb-1">
              <span className="font-semibold flex items-center gap-1.5 text-foreground"><RiShieldCheckLine /> Tests</span>
              <Chip size="sm">{pr.testResults.passed}/{pr.testResults.total}</Chip>
            </div>
            <div className="text-xs whitespace-pre-wrap font-mono">{pr.testResults.log}</div>
          </Card.Content>
        </Card>
      )}

      {s === 'awaiting_approval' && (
        <div className="flex gap-2">
          <Button variant="primary" onPress={() => approveMutation.mutate({ number: pr.number })} isLoading={approveMutation.isPending} startContent={<RiCheckDoubleLine />}>
            Approve & Merge
          </Button>
          <Button variant="ghost" className="text-danger text-xs" onPress={() => closeMutation.mutate({ workflowId: pr.id })} isLoading={closeMutation.isPending}>
            Close PR
          </Button>
        </div>
      )}
      {!isMerged && !isClosed && s !== 'awaiting_approval' && (
        <Button variant="ghost" className="text-danger text-xs w-full justify-start" onPress={() => closeMutation.mutate({ workflowId: pr.id })} isLoading={closeMutation.isPending}>
          Close PR
        </Button>
      )}
    </>
  );
}
