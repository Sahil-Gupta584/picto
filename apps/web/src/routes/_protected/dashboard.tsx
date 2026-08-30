import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import { IssueDrawer, PrDrawer, IssueIcon, PRIcon, GitHubUser, MarkdownBody } from '#/components/maintainer/IssueDrawer';
import { Drawer, Tabs, Card, Chip, Badge, Accordion, Pagination } from '@heroui/react';
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
} from 'react-icons/ri';

function formatTs(ts: string | Date): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const under24h = diffMs < 24 * 60 * 60 * 1000;
  if (under24h) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardComponent,
});

type DrawerData = { kind: 'issue' | 'pr' | 'comment' | 'event'; id: string | number; prNumber?: number } | null;

function DashboardComponent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'attention' | 'logs'>('logs');
  const [showSettings, setShowSettings] = useState(false);
  const [showNewWorkflowModal, setShowNewWorkflowModal] = useState(false);
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [drawer, setDrawer] = useState<DrawerData>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const EVENTS_PER_PAGE = 10;

  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.addEventListener('open-byok-settings', handler as EventListener);
    return () => window.removeEventListener('open-byok-settings', handler as EventListener);
  }, []);

  const { data: issues = [] } = useQuery(orpc.maintainer.getIssues.queryOptions());
  const { data: prs = [] } = useQuery(orpc.maintainer.getPRReviews.queryOptions());
  const { data: repos = [] } = useQuery(orpc.maintainer.getRepos.queryOptions());

  const hasActiveWorkflow = (issues as any[]).some((i: any) => i.status === 'investigating');

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
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
                            <Button variant="secondary" size="sm" onPress={() => setDrawer({ kind: 'comment', id: c.id, prNumber: c.prNumber })} startContent={<RiTerminalBoxLine />}>View Diff</Button>
                          )}
                          {!c.prNumber && (
                            <Button variant="secondary" size="sm" onPress={() => setDrawer({ kind: 'comment', id: c.id })} startContent={<RiTerminalBoxLine />}>View Thread</Button>
                          )}
                          {c.isPRReady && c.prNumber && (
                            <Button variant="primary" size="sm" onPress={() => setDrawer({ kind: 'comment', id: c.id, prNumber: c.prNumber })} startContent={<RiCheckDoubleLine />}>Review & Approve</Button>
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
                        {(filteredIssues as any[]).length > 0 && <span className="text-[10px] font-normal text-muted">since last visit</span>}
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
                        {(filteredPRs as any[]).length > 0 && <span className="text-[10px] font-normal text-muted">since last visit</span>}
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
                        <RiTimeLine /> Picto's Activity
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body>
                      <div className="space-y-2">
                        {isLoadingEvents ? (
                          <div className="space-y-3 px-3 py-2">
                            {[1,2,3].map(i => (
                              <div key={i} className="flex items-start gap-3 animate-pulse">
                                <div className="mt-1.5 shrink-0 h-2.5 w-2.5 rounded-full bg-[var(--surface-tertiary)]" />
                                <div className="flex-1 space-y-1.5">
                                  <div className="h-3.5 w-2/3 rounded bg-[var(--surface-tertiary)]" />
                                  <div className="h-2.5 w-16 rounded bg-[var(--surface-tertiary)]" />
                                  <div className="h-3 w-full rounded bg-[var(--surface-tertiary)]" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (filteredEvents as any[]).length === 0 ? (
                          <div className="text-xs text-center py-6 text-muted">No activity yet</div>
                        ) : (filteredEvents as any[]).slice((eventsPage - 1) * EVENTS_PER_PAGE, eventsPage * EVENTS_PER_PAGE).map((evt: any) => {
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
                              className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-none hover:bg-[#151b23] transition-colors cursor-pointer border-b border-[var(--border)]"
                            >
                              <div className="mt-1.5 shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                              <div className="min-w-0 flex-1">
                                <span className="text-base font-semibold text-foreground">{evt.title}</span>
                                <div className="text-[10px] text-muted mt-0.5">{formatTs(evt.timestamp)}</div>
                                <p className="text-sm text-muted line-clamp-2 mt-1.5 leading-relaxed">{evt.detail}</p>
                              </div>
                            </button>
                          );
                        })}
                        {(filteredEvents as any[]).length > EVENTS_PER_PAGE && (
                          <div className="px-3 pt-2 pb-1">
                            <Pagination size="sm" className="justify-center">
                              <Pagination.Content>
                                <Pagination.Item>
                                  <Pagination.Previous isDisabled={eventsPage === 1} onPress={() => setEventsPage(p => p - 1)}>
                                    <Pagination.PreviousIcon />
                                  </Pagination.Previous>
                                </Pagination.Item>
                                {Array.from({ length: Math.ceil((filteredEvents as any[]).length / EVENTS_PER_PAGE) }, (_, i) => i + 1).map(p => (
                                  <Pagination.Item key={p}>
                                    <Pagination.Link isActive={p === eventsPage} onPress={() => setEventsPage(p)}>{p}</Pagination.Link>
                                  </Pagination.Item>
                                ))}
                                <Pagination.Item>
                                  <Pagination.Next isDisabled={eventsPage === Math.ceil((filteredEvents as any[]).length / EVENTS_PER_PAGE)} onPress={() => setEventsPage(p => p + 1)}>
                                    <Pagination.NextIcon />
                                  </Pagination.Next>
                                </Pagination.Item>
                              </Pagination.Content>
                            </Pagination>
                          </div>
                        )}
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
                  {drawer?.kind === 'issue' && (selectedIssue ? (repos as any[]).find((r: any) => r.id === selectedIssue.repoId)?.fullName ?? '' : '')}
                  {drawer?.kind === 'pr' && (selectedPR ? (repos as any[]).find((r: any) => r.id === selectedPR.repoId)?.fullName ?? '' : '')}
                  {drawer?.kind === 'comment' && [
                    selectedComment?.issueNumber ? `Issue #${selectedComment.issueNumber}` : '',
                    selectedComment?.prNumber ? `PR #${selectedComment.prNumber}` : '',
                  ].filter(Boolean).join(' · ')}
                  {drawer?.kind === 'event' && (selectedEvent ? selectedEvent.title : 'Event')}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="space-y-3" style={{ color: 'var(--foreground)' }}>
                {drawer?.kind === 'issue' && selectedIssue && (
                  <IssueDrawer issue={selectedIssue} onClose={() => setDrawer(null)} />
                )}
                {drawer?.kind === 'pr' && selectedPR && (
                  <PrDrawer pr={selectedPR} liveDiff={liveDiff} onClose={() => setDrawer(null)} />
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
                    <div className="flex gap-2">
                      {selectedComment.isPRReady && selectedComment.prNumber && (
                        <Button variant="primary" onPress={() => dismissMutation.mutate({ id: selectedComment.id })} startContent={<RiCheckDoubleLine />}>
                          Approve & Merge
                        </Button>
                      )}
                      <Button variant="secondary" onPress={() => dismissMutation.mutate({ id: selectedComment.id })}>Mark as read</Button>
                    </div>
                  </>
                )}
                {drawer?.kind === 'event' && selectedEvent && (() => {
                  const linkedIssue = (selectedEvent as any).issueNumber
                    ? (issues as any[]).find((i: any) => i.number === (selectedEvent as any).issueNumber)
                    : null;
                  const linkedPR = (selectedEvent as any).prNumber
                    ? (prs as any[]).find((p: any) => p.prNumber === (selectedEvent as any).prNumber)
                    : null;
                  if (linkedIssue) return <IssueDrawer issue={linkedIssue} onClose={() => setDrawer(null)} />;
                  if (linkedPR) return <PrDrawer pr={linkedPR} liveDiff={liveDiff} onClose={() => setDrawer(null)} />;
                  return (
                    <>
                      <div className="text-xs text-muted">{formatTs(selectedEvent.timestamp)}</div>
                      <p className="text-sm leading-relaxed text-foreground">{selectedEvent.detail}</p>
                    </>
                  );
                })()}
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
