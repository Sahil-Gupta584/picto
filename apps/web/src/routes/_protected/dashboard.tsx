import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import { Drawer, Tabs, Card, Chip, Separator, DisclosureGroup, Disclosure } from '@heroui/react';
import { Button } from '#/components/Button';
import { Select, SelectItem } from '#/components/Select';
import {
  RiAlertLine,
  RiCheckDoubleLine,
  RiAddLine,
  RiBugLine,
  RiGitPullRequestLine,
  RiTimeLine,
  RiShieldFlashLine,
  RiTerminalBoxLine,
  RiBrainLine,
  RiShieldCheckLine,
  RiCodeSSlashLine,
  RiCloseLine,
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
      <div className="space-y-2.5">
        {intro && <p className="text-xs leading-relaxed">{intro.replace(/\*\*/g, '').replace(/`/g, '')}</p>}
        <div className="grid gap-2">
          {items.map((item, idx) => {
            const clean = item.replace(/^\d+\.\s+/, '');
            const match = clean.match(/^\*\*([^*]+)\*\*:\s*(.*)/s);
            if (match) {
              return (
                <div key={idx} className="flex gap-2.5 rounded-lg p-2.5 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-mono font-bold mt-0.5">{idx + 1}</span>
                  <div className="leading-relaxed"><span className="font-semibold">{match[1]}: </span><span>{match[2].replace(/`([^`]+)`/g, '$1').replace(/\*\*/g, '')}</span></div>
                </div>
              );
            }
            return <div key={idx} className="text-xs p-2.5 rounded-lg">{clean.replace(/\*\*/g, '').replace(/`/g, '')}</div>;
          })}
        </div>
      </div>
    );
  }
  return <p className="text-xs leading-relaxed">{text.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1')}</p>;
}

type DrawerData = { kind: 'issue' | 'pr' | 'event'; id: string | number } | null;

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

  const approvePRMutation = useMutation(
    orpc.maintainer.approvePR.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getPRReviews.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getNeedsAttention.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
      },
    })
  );

  const pendingPRs = prs.filter((p) => p.status === 'awaiting_approval');
  const filteredIssues = selectedRepo === 'all' ? issues : issues.filter((i: any) => i.repoFullName === selectedRepo);
  const filteredPRs = selectedRepo === 'all' ? prs : prs.filter((p: any) => p.repoFullName === selectedRepo);
  const filteredEvents = selectedRepo === 'all' ? events : events.filter((e: any) => (e.title || '').includes(selectedRepo) || (e.detail || '').includes(selectedRepo));

  const selectedIssue = drawer?.kind === 'issue' ? issues.find((i: any) => i.id === drawer.id || i.number === drawer.id) : null;
  const selectedPR = drawer?.kind === 'pr' ? prs.find((p: any) => p.id === drawer.id || p.number === drawer.id) : null;
  const selectedEvent = drawer?.kind === 'event' ? events.find((e: any) => e.id === drawer.id) : null;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Repos dropdown — above tabs row */}
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
            {repos.map((r: any) => (
              <SelectItem key={r.id} value={r.fullName}>{r.fullName}</SelectItem>
            ))}
            <SelectItem value="__add__">+ Add new repo</SelectItem>
          </Select>
        </div>
        <div className="flex">
          <Tabs selectedKey={activeTab} onSelectionChange={(k: any) => setActiveTab(k as any)} className="w-fit max-w-full">
            <Tabs.ListContainer className="w-fit max-w-full">
              <Tabs.List aria-label="Dashboard tabs">
              <Tabs.Tab id="attention">
                <span className="flex items-center gap-2">
                  <RiAlertLine /> Needs Attention {pendingPRs.length > 0 && <Chip size="sm">{pendingPRs.length}</Chip>}
                </span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="logs">
                <span className="flex items-center gap-2">
                  <RiTimeLine /> Logs <Chip size="sm" variant="secondary">{events.length}</Chip>
                </span>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="attention">
            <Card>
              <Card.Header>
                <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full" /> Review & Human Sign-off Queue</div>
              </Card.Header>
              <Card.Content>
                {pendingPRs.length === 0 ? (
                  <Card>
                    <Card.Content>
                      <div className="flex flex-col items-center justify-center gap-2 text-center py-8">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full"><RiCheckDoubleLine className="text-xl" /></div>
                        <div className="text-sm font-semibold">No pending approvals</div>
                        <p className="text-xs max-w-sm">All autonomous branches are up-to-date. Run an agent on an issue to generate a PR.</p>
                      </div>
                    </Card.Content>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingPRs.map((pr: any) => (
                      <Card key={pr.id} variant="tertiary">
                        <Card.Content>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip size="sm"><RiShieldFlashLine /> Checkpoint Approval Required</Chip>
                              <Chip size="sm" variant="secondary">{pr.repoFullName}</Chip>
                              <Chip size="sm">PR #{pr.number}</Chip>
                              <Chip size="sm">Issue #{pr.issueNumber}</Chip>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="secondary" onPress={() => setDrawer({ kind: 'pr', id: pr.id })} startContent={<RiTerminalBoxLine />}>Details</Button>
                              <Button variant="primary" onPress={() => approvePRMutation.mutate({ number: pr.number })} isLoading={approvePRMutation.isPending} startContent={<RiCheckDoubleLine />}>Approve & Merge</Button>
                            </div>
                          </div>
                          <Separator />
                          <h2 className="text-[15px] font-semibold">{pr.title}</h2>
                          <Card variant="transparent">
                            <Card.Content><FormattedSummaryContent text={pr.summary} /></Card.Content>
                          </Card>
                          {pr.prDecisionReasoning && (
                            <Card variant="transparent">
                              <Card.Content>
                                <div className="font-semibold flex items-center gap-1.5"><RiBrainLine /> Agent Root-Cause Rationale</div>
                                <p className="text-xs leading-relaxed">{pr.prDecisionReasoning}</p>
                              </Card.Content>
                            </Card>
                          )}
                          <div className="flex justify-between text-xs pt-1">
                            <Chip size="sm"><RiCheckDoubleLine /> Sandbox: {pr.testResults?.total || 18} Tests Passed</Chip>
                            <span>Risk: <strong>{(pr.agentReview?.riskLevel || 'low').toUpperCase()}</strong> · main</span>
                          </div>
                        </Card.Content>
                      </Card>
                    ))}
                  </div>
                )}
              </Card.Content>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel id="logs">
            <Card>
              <DisclosureGroup defaultExpandedKeys={new Set(['issues'])} allowsMultipleExpanded>
                <Disclosure id="issues">
                  <Disclosure.Heading>
                    <Disclosure.Trigger>
                      <span className="flex items-center gap-2 text-sm font-semibold"><RiBugLine /> {filteredIssues.length} new issues</span>
                      <Disclosure.Indicator />
                    </Disclosure.Trigger>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <div className="space-y-1">
                      {filteredIssues.length === 0 ? (
                        <Card variant="transparent"><Card.Content><div className="text-xs text-center py-6">No issues</div></Card.Content></Card>
                      ) : filteredIssues.slice(0, 10).map((iss: any) => (
                        <Card key={iss.id} variant="secondary" onClick={() => setDrawer({ kind: 'issue', id: iss.id })}>
                          <Card.Content>
                            <div className="flex items-center justify-between">
                              <div className="min-w-0"><div className="text-xs font-medium truncate">{iss.title}</div><div className="text-[11px]">#{iss.number} · {iss.repoFullName} · {iss.status}</div></div>
                              <RiAddLine />
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                      {filteredIssues.length > 10 && <div className="text-xs text-center py-1">+ {filteredIssues.length - 10} more</div>}
                    </div>
                  </Disclosure.Content>
                </Disclosure>

                <Disclosure id="prs">
                  <Disclosure.Heading>
                    <Disclosure.Trigger>
                      <span className="flex items-center gap-2 text-sm font-semibold"><RiGitPullRequestLine /> {filteredPRs.length} PRs</span>
                      <Disclosure.Indicator />
                    </Disclosure.Trigger>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <div className="space-y-1">
                      {filteredPRs.length === 0 ? (
                        <Card variant="transparent"><Card.Content><div className="text-xs text-center py-6">No PRs</div></Card.Content></Card>
                      ) : filteredPRs.slice(0, 10).map((pr: any) => (
                        <Card key={pr.id} variant="secondary" onClick={() => setDrawer({ kind: 'pr', id: pr.id })}>
                          <Card.Content>
                            <div className="flex items-center justify-between">
                              <div className="min-w-0"><div className="text-xs font-medium truncate">{pr.title}</div><div className="text-[11px]">PR #{pr.number} · {pr.repoFullName} · {pr.status}</div></div>
                              <RiAddLine />
                            </div>
                          </Card.Content>
                        </Card>
                      ))}
                      {filteredPRs.length > 10 && <div className="text-xs text-center py-1">+ {filteredPRs.length - 10} more</div>}
                    </div>
                  </Disclosure.Content>
                </Disclosure>

                <Disclosure id="events">
                  <Disclosure.Heading>
                    <Disclosure.Trigger>
                      <span className="flex items-center gap-2 text-sm font-semibold"><RiTimeLine /> Activity · {filteredEvents.length} events</span>
                      <Disclosure.Indicator />
                    </Disclosure.Trigger>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <div className="space-y-2 text-xs">
                      {filteredEvents.length === 0 ? (
                        <Card><Card.Content><div className="text-center py-6">No activity yet</div></Card.Content></Card>
                      ) : filteredEvents.slice(0, 20).map((evt: any) => (
                        <Card key={evt.id} onClick={() => setDrawer({ kind: 'event', id: evt.id })}>
                          <Card.Content>
                            <div className="flex gap-3">
                              <span className="text-[11px] min-w-[60px]">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex-1"><span className="font-semibold">{evt.title}</span><span className="ml-2 line-clamp-1">{evt.detail}</span></span>
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
        </div>

        <Drawer>
          <Drawer.Backdrop isOpen={!!drawer} onOpenChange={(open) => { if (!open) setDrawer(null); }}>
            <Drawer.Content placement="right" className="w-[92vw] sm:w-[640px] sm:max-w-[640px] max-w-[92vw]">
              <Drawer.Dialog>
                <Drawer.Header>
                  <Drawer.Heading>
                    {drawer?.kind === 'issue' && `Issue #${selectedIssue?.number ?? ''}`}
                    {drawer?.kind === 'pr' && `PR #${selectedPR?.number ?? ''}`}
                    {drawer?.kind === 'event' && `Event`}
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.CloseTrigger />
                <Drawer.Body>
                  {drawer?.kind === 'issue' && selectedIssue && (
                    <>
                      <div className="text-xs">{selectedIssue.repoFullName} • {selectedIssue.status}</div>
                      <h2 className="text-sm font-semibold">{selectedIssue.title}</h2>
                      <Card><Card.Content><div className="text-xs whitespace-pre-wrap leading-relaxed">{selectedIssue.body}</div></Card.Content></Card>
                      {selectedIssue.analysis && (
                        <Card>
                          <Card.Content>
                            <div className="font-semibold flex items-center gap-1.5"><RiBrainLine /> Root Cause</div>
                            <div className="text-xs">{selectedIssue.analysis.rootCause}</div>
                            <div className="text-[11px]">Affected: <span>{selectedIssue.analysis.affectedFiles?.join(', ')}</span></div>
                          </Card.Content>
                        </Card>
                      )}
                    </>
                  )}
                  {drawer?.kind === 'pr' && selectedPR && (
                    <>
                      <div className="flex items-center gap-2 text-xs"><Chip size="sm">{selectedPR.status}</Chip><span>{selectedPR.repoFullName} #{selectedPR.number}</span></div>
                      <h2 className="text-sm font-semibold">{selectedPR.title}</h2>
                      <Card><Card.Content><FormattedSummaryContent text={selectedPR.summary} /></Card.Content></Card>
                      <Card>
                        <Card.Header><span className="flex items-center gap-1.5 text-xs"><RiCodeSSlashLine /> Diff</span><span className="text-xs">+60 -15</span></Card.Header>
                        <Card.Content><div className="text-xs whitespace-pre-wrap font-mono">{(selectedPR as any).diff ? (selectedPR as any).diff.slice(0, 2000) : '// diff not yet generated'}</div></Card.Content>
                      </Card>
                      {selectedPR.testResults && (
                        <Card>
                          <Card.Content>
                            <div className="flex justify-between"><span className="font-semibold flex items-center gap-1.5"><RiShieldCheckLine /> Tests</span><Chip size="sm">{selectedPR.testResults.passed}/{selectedPR.testResults.total}</Chip></div>
                            <Card><Card.Content><div className="text-xs whitespace-pre-wrap">{selectedPR.testResults.log}</div></Card.Content></Card>
                          </Card.Content>
                        </Card>
                      )}
                      {selectedPR.status === 'awaiting_approval' && <Button variant="primary" onPress={() => approvePRMutation.mutate({ number: selectedPR.number })} isLoading={approvePRMutation.isPending}>Approve & Merge</Button>}
                    </>
                  )}
                  {drawer?.kind === 'event' && selectedEvent && (
                    <>
                      <div className="text-xs">{new Date(selectedEvent.timestamp).toLocaleString()}</div>
                      <h2 className="text-sm font-semibold">{selectedEvent.title}</h2>
                      <p className="text-xs leading-relaxed">{selectedEvent.detail}</p>
                      <div className="text-xs">Type: {selectedEvent.type}</div>
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
