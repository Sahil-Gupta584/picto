import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import '@git-diff-view/react/styles/diff-view.css';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import { Drawer, Tabs, Card, Chip, Badge, Accordion } from '@heroui/react';
import { Button } from '#/components/Button';
import { Select, SelectItem, Separator } from '#/components/Select';
import {
  RiAlertLine,
  RiCheckDoubleLine,
  RiAddLine,
  RiBugLine,
  RiGitPullRequestLine,
  RiTimeLine,
  RiTerminalBoxLine,
  RiBrainLine,
  RiShieldCheckLine,
  RiCodeSSlashLine,
} from 'react-icons/ri';
import { GoIssueOpened, GoIssueClosed, GoGitPullRequest, GoGitPullRequestClosed, GoGitMerge } from 'react-icons/go';

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardComponent,
});

function MarkdownBody({ children }: { children: string }) {
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

function GitHubUser({ login, size = 20 }: { login: string; size?: number }) {
  if (!login) return null;
  return (
    <a
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
    >
      <img
        src={`https://github.com/${login}.png?size=${size * 2}`}
        alt={login}
        width={size}
        height={size}
        className="rounded-full"
        style={{ width: size, height: size }}
      />
      <span className="text-xs text-muted font-mono">{login}</span>
    </a>
  );
}

function IssueIcon({ status, size = 16 }: { status?: string; size?: number }) {
  const s = status?.toLowerCase() ?? '';
  if (s === 'closed' || s === 'rejected' || s === 'merged')
    return <GoIssueClosed size={size} className="text-[#8957e5] shrink-0" />;
  return <GoIssueOpened size={size} className="text-[#3fb950] shrink-0" />;
}

function PRIcon({ status, size = 16 }: { status?: string; size?: number }) {
  const s = status?.toLowerCase() ?? '';
  if (s === 'merged') return <GoGitMerge size={size} className="text-[#8957e5] shrink-0" />;
  if (s === 'closed' || s === 'rejected') return <GoGitPullRequestClosed size={size} className="text-[#f85149] shrink-0" />;
  return <GoGitPullRequest size={size} className="text-[#3fb950] shrink-0" />;
}

function DiffViewer({ diff }: { diff: string }) {
  const hunks = useMemo(() => {
    if (!diff) return [];
    // Split unified diff into per-file hunk strings
    return diff.split(/(?=^diff --git)/m).filter(Boolean);
  }, [diff]);

  if (!hunks.length) return <div className="text-xs text-muted p-4">No diff available</div>;

  return (
    <div className="overflow-auto max-h-[500px] text-xs">
      <DiffView
        data={{ hunks }}
        diffViewMode={DiffModeEnum.Unified}
        diffViewTheme="dark"
        diffViewHighlight={false}
        diffViewFontSize={12}
      />
    </div>
  );
}

type DrawerData = { kind: 'issue' | 'pr' | 'comment' | 'event'; id: string | number; prNumber?: number } | null;

function DashboardComponent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'attention' | 'logs'>('logs');
  const [showSettings, setShowSettings] = useState(false);
  const [showNewWorkflowModal, setShowNewWorkflowModal] = useState(false);
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [drawer, setDrawer] = useState<DrawerData>(null);

  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.addEventListener('open-byok-settings', handler as EventListener);
    return () => window.removeEventListener('open-byok-settings', handler as EventListener);
  }, []);

  const { data: issues = [] } = useQuery(orpc.maintainer.getIssues.queryOptions());
  const { data: prs = [] } = useQuery(orpc.maintainer.getPRReviews.queryOptions());
  const { data: repos = [] } = useQuery(orpc.maintainer.getRepos.queryOptions());

  const hasActiveWorkflow = (issues as any[]).some((i: any) => i.status === 'investigating');

  const { data: events = [] } = useQuery({
    ...orpc.maintainer.getSinceLastVisit.queryOptions(),
    refetchInterval: hasActiveWorkflow ? 3000 : false,
  } as any);
  const { data: settings = {} } = useQuery(orpc.maintainer.getSettings.queryOptions());
  const { data: attentionItems = [] } = useQuery({
    ...orpc.maintainer.getNeedsAttention.queryOptions(),
    refetchInterval: hasActiveWorkflow ? 3000 : false,
  } as any);

  // Mark visited only if last visit was more than 2 hours ago (or never)
  const markVisitedMutation = useMutation(orpc.maintainer.markVisited.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSettings.key() });
    },
  }));
  useEffect(() => {
    const lastVisitAt = (settings as any).lastVisitAt;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    if (!lastVisitAt || new Date(lastVisitAt).getTime() < twoHoursAgo) {
      markVisitedMutation.mutate(undefined as any);
    }
  }, [(settings as any).lastVisitAt]);

  const approvePRMutation = useMutation(
    orpc.maintainer.approvePR.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getPRReviews.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getNeedsAttention.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
      },
    })
  );

  const dismissMutation = useMutation(
    orpc.maintainer.dismissComment.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.maintainer.getNeedsAttention.key() }),
    })
  );

  const filteredAttention = selectedRepo === 'all' ? attentionItems : (attentionItems as any[]).filter((c: any) => c.repoId === selectedRepo);
  const filteredIssues = selectedRepo === 'all' ? issues : (issues as any[]).filter((i: any) => i.repoId === selectedRepo);
  const filteredPRs = selectedRepo === 'all' ? prs : (prs as any[]).filter((p: any) => p.repoId === selectedRepo);
  const filteredEvents = selectedRepo === 'all' ? events : (events as any[]).filter((e: any) => (e.title || '').includes(selectedRepo) || (e.detail || '').includes(selectedRepo));

  const selectedIssue = drawer?.kind === 'issue' ? (issues as any[]).find((i: any) => i.id === drawer.id) : null;
  const selectedPR = drawer?.kind === 'pr' ? (prs as any[]).find((p: any) => p.id === drawer.id) : null;
  const selectedEvent = drawer?.kind === 'event' ? (events as any[]).find((e: any) => e.id === drawer.id) : null;
  const selectedComment = drawer?.kind === 'comment' ? (attentionItems as any[]).find((c: any) => c.id === drawer.id) : null;

  const activePrNumber = selectedComment?.prNumber || selectedPR?.prNumber || null;
  const activeRepoId = selectedComment?.repoId || selectedPR?.repoId || null;
  const activeRepo = activeRepoId ? (repos as any[]).find((r: any) => r.id === activeRepoId)?.fullName : null;
  const { data: liveDiff } = useQuery({
    ...orpc.maintainer.getLivePrDiff.queryOptions({ repoFullName: activeRepo || 'owner/repo', prNumber: activePrNumber || 0 } as any),
    enabled: !!activePrNumber && !!activeRepo && (drawer?.kind === 'comment' || drawer?.kind === 'pr'),
  } as any);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex justify-end">
          <Select
            value={selectedRepo}
            onChange={(v: string) => {
              if (v === '__add__') setShowAddRepoModal(true);
              else if (v) setSelectedRepo(v);
            }}
            placeholder="All repos"
            aria-label="Repository filter"
          >
            <SelectItem value="all">All repos</SelectItem>
            {(repos as any[]).map((r: any) => (
              <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>
            ))}
            <Separator />
            <SelectItem value="__add__">+ Add new repo</SelectItem>
          </Select>
        </div>

        <Tabs selectedKey={activeTab} onSelectionChange={(k: any) => setActiveTab(k as any)} className="w-full">
          <Tabs.ListContainer className="w-fit">
            <Tabs.List aria-label="Dashboard tabs">
              <Tabs.Tab id="logs" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <RiTimeLine className="shrink-0" />
                  <span>Logs</span>
                  <Chip size="sm" variant="secondary" className="shrink-0">{(filteredEvents as any[]).length}</Chip>
                </span>
              </Tabs.Tab>
              <Tabs.Tab id="attention" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <RiAlertLine className="shrink-0" />
                  <span>Needs Attention</span>
                  {(filteredAttention as any[]).length > 0 && (
                    <Chip size="sm" className="shrink-0">{(filteredAttention as any[]).length}</Chip>
                  )}
                </span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="attention" className="w-full">
            <Card className="w-full border border-border">
              <Card.Header>
                <div className="flex items-center gap-2 text-sm font-semibold">Review & Human Sign-off Queue</div>
              </Card.Header>
              <Card.Content>
                {(filteredAttention as any[]).length === 0 ? (
                  <Card variant="tertiary">
                    <Card.Content>
                      <div className="flex flex-col items-center justify-center gap-2 text-center py-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full">
                          <RiCheckDoubleLine className="text-xl" />
                        </div>
                        <div className="text-sm font-semibold">No pending questions</div>
                        <p className="text-xs text-muted max-w-sm">No comments need your attention. New questions from contributors or PR ready notices will appear here.</p>
                      </div>
                    </Card.Content>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {(filteredAttention as any[]).map((c: any) => (
                      <Card key={c.id} variant="tertiary" className="overflow-hidden">
                        <Card.Header className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {c.issueNumber && <Badge size="sm" variant="soft">Issue #{c.issueNumber}</Badge>}
                            {c.prNumber && <Badge size="sm" color="accent" variant="soft">PR #{c.prNumber}</Badge>}
                            {c.isPRReady && <Badge size="sm" color="success" variant="soft">PR ready for review</Badge>}
                            <GitHubUser login={c.author} size={16} />
                          </div>
                          <p className="text-[13px] leading-relaxed line-clamp-3">{c.body}</p>
                          {c.aiReasoning && <p className="text-xs text-muted">AI: {c.aiReasoning}</p>}
                        </Card.Header>
                        <Card.Content className="flex flex-wrap gap-2 pt-0">
                          {c.prNumber && (
                            <Button variant="secondary" size="sm" onPress={() => setDrawer({ kind: 'comment', id: c.id, prNumber: c.prNumber })} startContent={<RiCodeSSlashLine />}>View Diff</Button>
                          )}
                          {!c.prNumber && (
                            <Button variant="secondary" size="sm" onPress={() => setDrawer({ kind: 'comment', id: c.id })} startContent={<RiTerminalBoxLine />}>View Thread</Button>
                          )}
                          {c.isPRReady && c.prNumber && (
                            <Button variant="primary" size="sm" onPress={() => approvePRMutation.mutate({ number: c.prNumber })} isLoading={approvePRMutation.isPending} startContent={<RiCheckDoubleLine />}>Approve & Merge</Button>
                          )}
                          <Button variant="ghost" size="sm" onPress={() => dismissMutation.mutate({ id: c.id })}>Dismiss</Button>
                        </Card.Content>
                      </Card>
                    ))}
                  </div>
                )}
              </Card.Content>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel id="logs" className="w-full">
            <Card className="w-full border border-border">
              <Accordion allowsMultipleExpanded defaultExpandedKeys={['events']} className="w-full">
                <Accordion.Item id="issues">
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <RiBugLine /> {(filteredIssues as any[]).length} new issues
                        <span className="text-[10px] font-normal text-muted">since last visit</span>
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                      <div className="space-y-1">
                        {(filteredIssues as any[]).length === 0 ? (
                          <div className="text-xs text-center py-6 text-muted">No new issues</div>
                        ) : (filteredIssues as any[]).slice(0, 10).map((iss: any) => (
                          <Card key={iss.id} variant="secondary" onClick={() => setDrawer({ kind: 'issue', id: iss.id })} style={{ backgroundColor: '#151b23' }} className="cursor-pointer hover:brightness-125 transition-all">
                            <Card.Content>
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 shrink-0"><IssueIcon status={iss.status} size={16} /></div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium truncate">{iss.title}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-muted">#{iss.number} · {iss.status}</span>
                                    {iss.author && <GitHubUser login={iss.author} size={14} />}
                                  </div>
                                </div>
                                <RiAddLine className="shrink-0 ml-2" />
                              </div>
                            </Card.Content>
                          </Card>
                        ))}
                        {(filteredIssues as any[]).length > 10 && (
                          <div className="text-xs text-center py-1 text-muted">+ {(filteredIssues as any[]).length - 10} more</div>
                        )}
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="prs">
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <RiGitPullRequestLine /> {(filteredPRs as any[]).length} PRs
                        <span className="text-[10px] font-normal text-muted">since last visit</span>
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                      <div className="space-y-1">
                        {(filteredPRs as any[]).length === 0 ? (
                          <div className="text-xs text-center py-6 text-muted">No new PRs</div>
                        ) : (filteredPRs as any[]).slice(0, 10).map((pr: any) => (
                          <Card key={pr.id} variant="secondary" onClick={() => setDrawer({ kind: 'pr', id: pr.id })} style={{ backgroundColor: '#151b23' }} className="cursor-pointer hover:brightness-125 transition-all">
                            <Card.Content>
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 shrink-0"><PRIcon status={pr.status} size={16} /></div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium truncate">{pr.title}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-muted">PR #{pr.number} · {pr.status}</span>
                                    {pr.author && <GitHubUser login={pr.author} size={14} />}
                                  </div>
                                </div>
                                <RiAddLine className="shrink-0 ml-2" />
                              </div>
                            </Card.Content>
                          </Card>
                        ))}
                        {(filteredPRs as any[]).length > 10 && (
                          <div className="text-xs text-center py-1 text-muted">+ {(filteredPRs as any[]).length - 10} more</div>
                        )}
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="events">
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <RiTimeLine /> Activity · {(filteredEvents as any[]).length} events
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                      <div className="space-y-2">
                        {(filteredEvents as any[]).length === 0 ? (
                          <div className="text-xs text-center py-6 text-muted">No activity yet</div>
                        ) : (filteredEvents as any[]).slice(0, 20).map((evt: any) => {
                          const typeColor: Record<string, string> = {
                            issue_rejected: 'var(--danger)',
                            clarification_requested: 'var(--warning)',
                            sub_agent_spawned: 'var(--accent)',
                            sub_agent_completed: 'var(--success)',
                            pr_created: 'var(--success)',
                            pr_merged: 'var(--success)',
                            issue_triaged: 'var(--accent)',
                          };
                          const color = typeColor[evt.type] || 'var(--muted)';
                          return (
                            <button
                              key={evt.id}
                              onClick={() => setDrawer({ kind: 'event', id: evt.id })}
                              className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[#151b23] transition-colors"
                            >
                              <div className="mt-1 shrink-0 h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                                  <span className="text-[10px] text-muted shrink-0">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{evt.detail}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Card>
          </Tabs.Panel>
        </Tabs>

        <Drawer.Backdrop isOpen={!!drawer} onOpenChange={(open) => { if (!open) setDrawer(null); }}>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="w-[92vw] sm:w-[640px] max-w-[640px]">
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>
                  {drawer?.kind === 'issue' && (selectedIssue ? (repos as any[]).find((r:any) => r.id === selectedIssue.repoId)?.fullName ?? '' : '')}
                  {drawer?.kind === 'pr' && (selectedPR ? (repos as any[]).find((r:any) => r.id === selectedPR.repoId)?.fullName ?? '' : '')}
                  {drawer?.kind === 'comment' && [
                    selectedComment?.issueNumber ? `Issue #${selectedComment.issueNumber}` : '',
                    selectedComment?.prNumber ? `PR #${selectedComment.prNumber}` : '',
                  ].filter(Boolean).join(' · ')}
                  {drawer?.kind === 'event' && 'Event'}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="space-y-3" style={{ color: 'var(--foreground)' }}>
                {drawer?.kind === 'issue' && selectedIssue && (
                  <>
                    {/* Title row — large, GitHub-style */}
                    <h2 className="text-xl font-semibold text-foreground leading-snug">
                      {selectedIssue.title}
                      <span className="ml-2 text-xl font-light text-muted">#{selectedIssue.number}</span>
                    </h2>

                    {/* Status badge pill */}
                    <div>
                      {(() => {
                        const s = selectedIssue.status?.toLowerCase() ?? '';
                        const isClosed = s === 'closed' || s === 'rejected' || s === 'merged';
                        return (
                           <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isClosed ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                            <IssueIcon status={selectedIssue.status} size={14} />
                            {isClosed ? 'Closed' : 'Open'}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Author row */}
                    {selectedIssue.author && (
                      <div className="flex items-center justify-between px-3 py-2 -mb-px rounded-t-lg bg-accent/5 border border-accent/15">
                        <GitHubUser login={selectedIssue.author} />
                        <span className="text-[10px] border border-accent/15 rounded-full px-2 py-0.5 text-muted">Owner</span>
                      </div>
                    )}

                    {/* Body */}
                    <div className="rounded-b-lg rounded-tr-lg p-4 border border-accent/15" style={{ borderTop: selectedIssue.author ? 'none' : undefined }}>
                      <MarkdownBody>{selectedIssue.body}</MarkdownBody>
                    </div>

                    {selectedIssue.analysis?.rootCause && (
                      <Card>
                        <Card.Content>
                          <div className="font-semibold flex items-center gap-1.5 mb-1 text-foreground"><RiBrainLine /> Root Cause</div>
                          <div className="text-xs text-foreground">{selectedIssue.analysis.rootCause}</div>
                          {selectedIssue.analysis.affectedFiles?.length > 0 && (
                            <div className="text-[11px] text-muted mt-1">Affected: {selectedIssue.analysis.affectedFiles.join(', ')}</div>
                          )}
                        </Card.Content>
                      </Card>
                    )}
                  </>
                )}
                {drawer?.kind === 'pr' && selectedPR && (
                  <>
                    {/* Title row */}
                    <h2 className="text-xl font-semibold text-foreground leading-snug">
                      {selectedPR.title}
                      <span className="ml-2 text-xl font-light text-muted">#{selectedPR.number}</span>
                    </h2>

                    {/* Status badge pill */}
                    <div>
                      {(() => {
                        const s = selectedPR.status?.toLowerCase() ?? '';
                        const isMerged = s === 'merged';
                        const isClosed = s === 'closed' || s === 'rejected';
                        return (
                           <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isMerged ? 'bg-accent/10 text-accent' : isClosed ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                            <PRIcon status={selectedPR.status} size={14} />
                            {isMerged ? 'Merged' : isClosed ? 'Closed' : 'Open'}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Author row */}
                    {selectedPR.author && (
                      <div className="flex items-center justify-between px-3 py-2 -mb-px rounded-t-lg bg-accent/5 border border-accent/15">
                        <GitHubUser login={selectedPR.author} />
                        <span className="text-[10px] border border-accent/15 rounded-full px-2 py-0.5 text-muted">Owner</span>
                      </div>
                    )}

                    {/* Body */}
                    {selectedPR.summary && (
                      <div className={`p-4 border border-accent/15 ${selectedPR.author ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg'}`} style={{ borderTop: selectedPR.author ? 'none' : undefined }}>
                        <MarkdownBody>{selectedPR.summary}</MarkdownBody>
                      </div>
                    )}

                    <Card>
                      <Card.Header>
                        <span className="flex items-center gap-1.5 text-xs"><RiCodeSSlashLine /> Diff</span>
                        {liveDiff && <span className="text-xs text-muted">{String((liveDiff as any).files?.length ?? '')} files</span>}
                      </Card.Header>
                      <Card.Content className="p-0">
                        {liveDiff
                          ? <DiffViewer diff={(liveDiff as any).diff || ''} />
                          : <div className="text-xs text-muted p-4">Loading diff…</div>
                        }
                      </Card.Content>
                    </Card>
                    {selectedPR.testResults && (
                      <Card>
                        <Card.Content>
                          <div className="flex justify-between mb-1">
                            <span className="font-semibold flex items-center gap-1.5 text-foreground"><RiShieldCheckLine /> Tests</span>
                            <Chip size="sm">{selectedPR.testResults.passed}/{selectedPR.testResults.total}</Chip>
                          </div>
                          <div className="text-xs whitespace-pre-wrap font-mono">{selectedPR.testResults.log}</div>
                        </Card.Content>
                      </Card>
                    )}
                    {selectedPR.status === 'awaiting_approval' && (
                      <Button variant="primary" onPress={() => approvePRMutation.mutate({ number: selectedPR.number })} isLoading={approvePRMutation.isPending}>
                        Approve & Merge
                      </Button>
                    )}
                  </>
                )}
                {drawer?.kind === 'comment' && selectedComment && (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      {selectedComment.issueNumber && <Badge size="sm">Issue #{selectedComment.issueNumber}</Badge>}
                      {selectedComment.prNumber && <Badge size="sm" color="accent">PR #{selectedComment.prNumber}</Badge>}
                      <GitHubUser login={selectedComment.author} />
                    </div>
                    <div className="border border-border rounded-lg p-4">
                      <MarkdownBody>{selectedComment.body}</MarkdownBody>
                      {selectedComment.aiReasoning && <p className="text-xs text-muted mt-2 pt-2 border-t border-border">AI: {selectedComment.aiReasoning}</p>}
                    </div>
                    {selectedComment.prNumber && (
                      <Card>
                        <Card.Header><span className="flex items-center gap-1.5 text-xs"><RiCodeSSlashLine /> Diff</span></Card.Header>
                        <Card.Content className="p-0">
                          {liveDiff
                            ? <DiffViewer diff={(liveDiff as any).diff || ''} />
                            : <div className="text-xs text-muted p-4">Loading diff…</div>
                          }
                        </Card.Content>
                      </Card>
                    )}
                    <div className="flex gap-2">
                      {selectedComment.isPRReady && selectedComment.prNumber && (
                        <Button variant="primary" onPress={() => approvePRMutation.mutate({ number: selectedComment.prNumber })} isLoading={approvePRMutation.isPending} startContent={<RiCheckDoubleLine />}>
                          Approve & Merge
                        </Button>
                      )}
                      <Button variant="secondary" onPress={() => dismissMutation.mutate({ id: selectedComment.id })}>Mark as read</Button>
                    </div>
                  </>
                )}
                {drawer?.kind === 'event' && selectedEvent && (
                  <>
                    <div className="text-xs text-muted">{new Date(selectedEvent.timestamp).toLocaleString()}</div>
                    <h2 className="text-sm font-semibold text-foreground">{selectedEvent.title}</h2>
                    <p className="text-xs leading-relaxed text-foreground">{selectedEvent.detail}</p>
                    <div className="text-xs text-muted">Type: {selectedEvent.type}</div>
                  </>
                )}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>

        <BYOKSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} initialSettings={settings} onSuccess={() => queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSettings.key() })} />
        <RunWorkflowModal isOpen={showNewWorkflowModal} onClose={() => setShowNewWorkflowModal(false)} onSuccess={(issueNum) => { if (issueNum) setDrawer({ kind: 'issue', id: issueNum }); queryClient.invalidateQueries({ queryKey: orpc.maintainer.key() }); setActiveTab('logs'); }} />
        <AddRepoModal isOpen={showAddRepoModal} onClose={() => setShowAddRepoModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() }); setSelectedRepo('all'); }} />
      </div>
    </div>
  );
}
