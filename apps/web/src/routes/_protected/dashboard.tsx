import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import { Drawer, Tabs, Card, Chip, Badge, DisclosureGroup, Disclosure } from '@heroui/react';
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

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardComponent,
});

function FormattedSummaryContent({ text }: { text: string }) {
  if (!text) return null;
  const hasNumberedList = /(?:\d+\.\s+\*\*)/.test(text);
  if (hasNumberedList) {
    const parts = text.split(/(?=\d+\.\s+\*\*)/);
    const intro = parts[0]?.trim();
    const items = parts.slice(1);
    return (
      <div className="space-y-3">
        {intro && <p className="text-sm font-medium leading-relaxed opacity-90">{intro.replace(/\*\*/g, '').replace(/`/g, '')}</p>}
        <div className="grid gap-2.5">
          {items.map((item, idx) => {
            const clean = item.replace(/^\d+\.\s+/, '');
            const match = clean.match(/^\*\*([^*]+)\*\*:\s*(.*)/s);
            if (match) {
              return (
                <Card key={idx} variant="secondary">
                  <Card.Content className="flex gap-3 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold mt-0.5">{idx + 1}</span>
                    <div className="leading-relaxed text-sm"><span className="font-semibold">{match[1]}: </span><span className="text-muted">{match[2].replace(/`([^`]+)`/g, '$1').replace(/\*\*/g, '')}</span></div>
                  </Card.Content>
                </Card>
              );
            }
            return <Card key={idx} variant="secondary"><Card.Content className="text-sm p-3">{clean.replace(/\*\*/g, '').replace(/`/g, '')}</Card.Content></Card>;
          })}
        </div>
      </div>
    );
  }
  return <p className="text-sm leading-relaxed">{text.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1')}</p>;
}

type DrawerData = { kind: 'issue' | 'pr' | 'comment' | 'event'; id: string | number; prNumber?: number } | null;

function DashboardComponent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'attention' | 'logs'>('attention');
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
  const { data: events = [] } = useQuery(orpc.maintainer.getSinceLastVisit.queryOptions());
  const { data: settings = {} } = useQuery(orpc.maintainer.getSettings.queryOptions());
  const { data: attentionItems = [] } = useQuery(orpc.maintainer.getNeedsAttention.queryOptions());

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


        {/* Tab list is fit-width; panels stretch to full width via w-full on Tabs */}
        <Tabs selectedKey={activeTab} onSelectionChange={(k: any) => setActiveTab(k as any)} className="w-full">
          <Tabs.ListContainer className="w-fit bg-[#0D1117]" >
            <Tabs.List aria-label="Dashboard tabs">
              <Tabs.Tab id="attention" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <RiAlertLine className="shrink-0" />
                  <span>Needs Attention</span>
                  {(filteredAttention as any[]).length > 0 && (
                    <Chip size="sm" className="shrink-0">{(filteredAttention as any[]).length}</Chip>
                  )}
                </span>
              </Tabs.Tab>
              <Tabs.Tab id="logs" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <RiTimeLine className="shrink-0" />
                  <span>Logs</span>
                  <Chip size="sm" variant="secondary" className="shrink-0">{(events as any[]).length}</Chip>
                </span>
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="attention" className="w-full">
            <Card className="w-full">
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
                            <span className="text-muted">by @{c.author}</span>
                            {c.isPRReady && <Badge size="sm" color="success" variant="soft">PR ready for review</Badge>}
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
            <Card className="w-full">
              <DisclosureGroup defaultExpandedKeys={['issues']} allowsMultipleExpanded>
                <Disclosure id="issues">
                  <Disclosure.Heading>
                    <Button slot="trigger" variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <RiBugLine /> {(filteredIssues as any[]).length} new issues
                      </span>
                      <Disclosure.Indicator />
                    </Button>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <div className="space-y-1 px-2 pb-2">
                      {(filteredIssues as any[]).length === 0 ? (
                        <div className="text-xs text-center py-6 text-muted">No issues</div>
                      ) : (filteredIssues as any[]).slice(0, 10).map((iss: any) => (
                        <Card key={iss.id} variant="secondary" onClick={() => setDrawer({ kind: 'issue', id: iss.id })}>
                          <Card.Content>
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{iss.title}</div>
                                <div className="text-[11px] text-muted">#{iss.number} · {iss.status}</div>
                              </div>
                              <RiAddLine />
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                      {(filteredIssues as any[]).length > 10 && (
                        <div className="text-xs text-center py-1 text-muted">+ {(filteredIssues as any[]).length - 10} more</div>
                      )}
                    </div>
                  </Disclosure.Content>
                </Disclosure>

                <Disclosure id="prs">
                  <Disclosure.Heading>
                    <Button slot="trigger" variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <RiGitPullRequestLine /> {(filteredPRs as any[]).length} PRs
                      </span>
                      <Disclosure.Indicator />
                    </Button>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <div className="space-y-1 px-2 pb-2">
                      {(filteredPRs as any[]).length === 0 ? (
                        <div className="text-xs text-center py-6 text-muted">No PRs</div>
                      ) : (filteredPRs as any[]).slice(0, 10).map((pr: any) => (
                        <Card key={pr.id} variant="secondary" onClick={() => setDrawer({ kind: 'pr', id: pr.id })}>
                          <Card.Content>
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{pr.title}</div>
                                <div className="text-[11px] text-muted">PR #{pr.number} · {pr.status}</div>
                              </div>
                              <RiAddLine />
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                      {(filteredPRs as any[]).length > 10 && (
                        <div className="text-xs text-center py-1 text-muted">+ {(filteredPRs as any[]).length - 10} more</div>
                      )}
                    </div>
                  </Disclosure.Content>
                </Disclosure>

                <Disclosure id="events">
                  <Disclosure.Heading>
                    <Button slot="trigger" variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <RiTimeLine /> Activity · {(filteredEvents as any[]).length} events
                      </span>
                      <Disclosure.Indicator />
                    </Button>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <div className="space-y-2 px-2 pb-2">
                      {(filteredEvents as any[]).length === 0 ? (
                        <div className="text-xs text-center py-6 text-muted">No activity yet</div>
                      ) : (filteredEvents as any[]).slice(0, 20).map((evt: any) => (
                        <Card key={evt.id} onClick={() => setDrawer({ kind: 'event', id: evt.id })}>
                          <Card.Content>
                            <div className="flex gap-3 text-xs">
                              <span className="min-w-[60px] text-muted shrink-0">
                                {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="font-semibold">{evt.title}</span>
                                <span className="ml-2 text-muted line-clamp-1">{evt.detail}</span>
                              </span>
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                    </div>
                  </Disclosure.Content>
                </Disclosure>
              </DisclosureGroup>
            </Card>
          </Tabs.Panel>
        </Tabs>

        <Drawer>
          <Drawer.Backdrop isOpen={!!drawer} onOpenChange={(open) => { if (!open) setDrawer(null); }}>
            <Drawer.Content placement="right" className="w-[92vw] sm:w-[640px] sm:max-w-[640px] max-w-[92vw]">
              <Drawer.Dialog>
                <Drawer.Header>
                  <Drawer.Heading>
                    {drawer?.kind === 'issue' && `Issue #${selectedIssue?.number ?? ''}`}
                    {drawer?.kind === 'pr' && `PR #${selectedPR?.number ?? ''}`}
                    {drawer?.kind === 'comment' && [
                      selectedComment?.issueNumber ? `Issue #${selectedComment.issueNumber}` : '',
                      selectedComment?.prNumber ? `PR #${selectedComment.prNumber}` : '',
                    ].filter(Boolean).join(' · ')}
                    {drawer?.kind === 'event' && 'Event'}
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.CloseTrigger />
                <Drawer.Body>
                  {drawer?.kind === 'issue' && selectedIssue && (
                    <>
                      <div className="text-xs text-muted">{selectedIssue.status}</div>
                      <h2 className="text-sm font-semibold">{selectedIssue.title}</h2>
                      <Card><Card.Content><div className="text-xs whitespace-pre-wrap leading-relaxed">{selectedIssue.body}</div></Card.Content></Card>
                      {selectedIssue.analysis && (
                        <Card>
                          <Card.Content>
                            <div className="font-semibold flex items-center gap-1.5 mb-1"><RiBrainLine /> Root Cause</div>
                            <div className="text-xs">{selectedIssue.analysis.rootCause}</div>
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
                      <div className="flex items-center gap-2 text-xs"><Chip size="sm">{selectedPR.status}</Chip><span>PR #{selectedPR.number}</span></div>
                      <h2 className="text-sm font-semibold">{selectedPR.title}</h2>
                      {selectedPR.summary && <Card><Card.Content><FormattedSummaryContent text={selectedPR.summary} /></Card.Content></Card>}
                      <Card>
                        <Card.Header>
                          <span className="flex items-center gap-1.5 text-xs"><RiCodeSSlashLine /> Diff</span>
                          {liveDiff && <span className="text-xs text-muted">{(liveDiff as any).files?.length} files</span>}
                        </Card.Header>
                        <Card.Content>
                          <div className="text-xs whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
                            {liveDiff ? (liveDiff as any).diff?.slice(0, 8000) || 'No diff' : '// diff not yet generated'}
                          </div>
                        </Card.Content>
                      </Card>
                      {selectedPR.testResults && (
                        <Card>
                          <Card.Content>
                            <div className="flex justify-between mb-1">
                              <span className="font-semibold flex items-center gap-1.5"><RiShieldCheckLine /> Tests</span>
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
                        <span className="text-muted">by @{selectedComment.author}</span>
                      </div>
                      <Card>
                        <Card.Content>
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">{selectedComment.body}</div>
                          {selectedComment.aiReasoning && <p className="text-xs text-muted mt-2">AI: {selectedComment.aiReasoning}</p>}
                        </Card.Content>
                      </Card>
                      {selectedComment.prNumber && (
                        <Card>
                          <Card.Header><span className="flex items-center gap-1.5 text-xs"><RiCodeSSlashLine /> Diff</span></Card.Header>
                          <Card.Content>
                            <div className="text-xs whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
                              {liveDiff ? (liveDiff as any).diff?.slice(0, 8000) || 'No diff' : 'Loading diff…'}
                            </div>
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
                      <h2 className="text-sm font-semibold">{selectedEvent.title}</h2>
                      <p className="text-xs leading-relaxed">{selectedEvent.detail}</p>
                      <div className="text-xs text-muted">Type: {selectedEvent.type}</div>
                    </>
                  )}
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>

        <BYOKSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} initialSettings={settings} onSuccess={() => queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSettings.key() })} />
        <RunWorkflowModal isOpen={showNewWorkflowModal} onClose={() => setShowNewWorkflowModal(false)} onSuccess={(issueNum) => { if (issueNum) setDrawer({ kind: 'issue', id: issueNum }); queryClient.invalidateQueries({ queryKey: orpc.maintainer.key() }); setActiveTab('logs'); }} />
        <AddRepoModal isOpen={showAddRepoModal} onClose={() => setShowAddRepoModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() }); setSelectedRepo('all'); }} />
      </div>
    </div>
  );
}
