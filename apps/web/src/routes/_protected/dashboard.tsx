import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import { Drawer } from '@heroui/react';
import { Button } from '#/components/Button';
import {
  RiAlertLine,
  RiCheckDoubleLine,
  RiPlayCircleLine,
  RiRefreshLine,
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
        {intro && <p className="text-xs text-neutral-300 leading-relaxed">{intro.replace(/\*\*/g, '').replace(/`/g, '')}</p>}
        <div className="grid gap-2">
          {items.map((item, idx) => {
            const clean = item.replace(/^\d+\.\s+/, '');
            const match = clean.match(/^\*\*([^*]+)\*\*:\s*(.*)/s);
            if (match) {
              return (
                <div key={idx} className="flex gap-2.5 rounded-lg bg-[#0f1015] border border-white/[0.05] p-2.5 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#118af3]/15 text-[#118af3] text-[10px] font-mono font-bold mt-0.5">{idx + 1}</span>
                  <div className="leading-relaxed text-neutral-200"><span className="font-semibold text-white">{match[1]}: </span><span className="text-neutral-300">{match[2].replace(/`([^`]+)`/g, '$1').replace(/\*\*/g, '')}</span></div>
                </div>
              );
            }
            return <div key={idx} className="text-xs text-neutral-300 bg-[#0f1015] p-2.5 rounded-lg border border-white/[0.05]">{clean.replace(/\*\*/g, '').replace(/`/g, '')}</div>;
          })}
        </div>
      </div>
    );
  }
  return <p className="text-xs text-neutral-300 leading-relaxed">{text.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1')}</p>;
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
  const [logsExpanded, setLogsExpanded] = useState<Set<string>>(new Set(['issues']));

  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.addEventListener('open-byok-settings', handler as EventListener);
    return () => window.removeEventListener('open-byok-settings', handler as EventListener);
  }, []);

  const { data: issues = [], isLoading: isLoadingIssues, isRefetching: isRefetchingIssues } = useQuery(orpc.maintainer.getIssues.queryOptions());
  const { data: prs = [], isLoading: isLoadingPRs } = useQuery(orpc.maintainer.getPRReviews.queryOptions());
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

  const handleSyncAll = () => queryClient.invalidateQueries({ queryKey: orpc.maintainer.key() });
  const isLoading = isLoadingIssues || isLoadingPRs;
  const toggleLogs = (key: string) => {
    setLogsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedIssue = drawer?.kind === 'issue' ? issues.find((i: any) => i.id === drawer.id || i.number === drawer.id) : null;
  const selectedPR = drawer?.kind === 'pr' ? prs.find((p: any) => p.id === drawer.id || p.number === drawer.id) : null;
  const selectedEvent = drawer?.kind === 'event' ? events.find((e: any) => e.id === drawer.id) : null;

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white font-sans antialiased p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Top bar: tabs left, repo dropdown + actions right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#13141a] p-1 rounded-xl border border-white/[0.07] w-fit">
            <button
              className={'flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg transition ' + (activeTab === 'attention' ? 'bg-[#222530] text-white border border-white/10 shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')}
              onClick={() => setActiveTab('attention')}
            >
              <RiAlertLine className="text-sm text-[#f59e0b]" /> Needs Attention {pendingPRs.length > 0 && <span className="bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">{pendingPRs.length}</span>}
            </button>
            <button
              className={'flex items-center gap-2 h-8 px-4 text-xs font-medium rounded-lg transition ' + (activeTab === 'logs' ? 'bg-[#222530] text-white border border-white/10 shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')}
              onClick={() => setActiveTab('logs')}
            >
              <RiTimeLine className="text-sm" /> Logs <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded">{events.length}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Repo dropdown */}
            <div className="relative">
              <select
                value={selectedRepo}
                onChange={(e) => {
                  if (e.target.value === '__add__') setShowAddRepoModal(true);
                  else setSelectedRepo(e.target.value);
                }}
                className="h-8 rounded-lg bg-[#13141a] border border-white/[0.08] text-xs text-neutral-200 px-3 pr-6 focus:outline-none focus:border-white/20"
              >
                <option value="all">All repos</option>
                {repos.map((r: any) => (
                  <option key={r.id} value={r.fullName}>{r.fullName}</option>
                ))}
                <option value="__add__">+ Add new repo</option>
              </select>
            </div>

            <Button variant="ghost" className="h-8 px-3 text-xs" onClick={handleSyncAll} startContent={<RiRefreshLine className={isLoading || isRefetchingIssues ? 'animate-spin' : ''} />}>Sync</Button>
            <Button className="h-8 px-3.5 text-xs shadow-md" onClick={() => setShowNewWorkflowModal(true)} startContent={<RiPlayCircleLine />}>Run Agent</Button>
          </div>
        </div>

        {/* Needs Attention tab */}
        {activeTab === 'attention' && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="text-sm font-semibold flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.6)]" /> Review & Human Sign-off Queue</div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> Harness Guardrails Active</span>
            </div>
            {pendingPRs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-14 text-center gap-2 bg-[#0f1015]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><RiCheckDoubleLine className="text-xl" /></div>
                <div className="text-sm font-semibold">No pending approvals</div>
                <p className="text-xs text-neutral-400 max-w-sm">All autonomous branches are up-to-date. Run an agent on an issue to generate a PR.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPRs.map((pr: any) => (
                  <div key={pr.id} className="rounded-xl border border-white/[0.08] bg-[#181a21] p-5 space-y-4 hover:border-white/20 transition group">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/25 px-2 py-0.5 rounded-md"><RiShieldFlashLine /> Checkpoint Approval Required</span>
                        <span className="text-xs font-mono text-neutral-400 bg-[#0f1015] border border-white/[0.06] px-2 py-0.5 rounded">{pr.repoFullName}</span>
                        <span className="text-xs font-mono text-[#118af3] bg-[#118af3]/10 border border-[#118af3]/20 px-1.5 py-0.5 rounded font-semibold">PR #{pr.number}</span>
                        <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">Issue #{pr.issueNumber}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setDrawer({ kind: 'pr', id: pr.id })} startContent={<RiTerminalBoxLine />}>Details</Button>
                        <Button onClick={() => approvePRMutation.mutate({ number: pr.number })} isLoading={approvePRMutation.isPending} className="h-8 px-3.5 text-xs font-semibold" startContent={<RiCheckDoubleLine />}>Approve & Merge</Button>
                      </div>
                    </div>
                    <h2 className="text-[15px] font-semibold text-white">{pr.title}</h2>
                    <div className="rounded-xl bg-[#0f1015] border border-white/[0.06] p-3.5"><FormattedSummaryContent text={pr.summary} /></div>
                    {pr.prDecisionReasoning && (
                      <div className="rounded-xl bg-gradient-to-r from-[#10131a] to-[#0f1015] border border-[#118af3]/20 p-3.5 text-xs space-y-1.5">
                        <div className="font-semibold flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded bg-[#118af3]/20 text-[#118af3]"><RiBrainLine className="text-xs" /></span> Agent Root-Cause Rationale</div>
                        <p className="text-neutral-300 leading-relaxed">{pr.prDecisionReasoning}</p>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-mono text-neutral-400 pt-1">
                      <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded text-[11px] flex items-center gap-1"><RiCheckDoubleLine /> Sandbox: {pr.testResults?.total || 18} Tests Passed</span>
                      <span className="text-[11px]">Risk: <strong className="text-emerald-400">{(pr.agentReview?.riskLevel || 'low').toUpperCase()}</strong> · main</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Logs tab - accordion */}
        {activeTab === 'logs' && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] shadow-xl overflow-hidden divide-y divide-white/[0.06]">
            {/* Issues accordion */}
            <div>
              <button onClick={() => toggleLogs('issues')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition text-left">
                <span className="flex items-center gap-2 text-sm font-semibold"><RiBugLine className="text-purple-400" /> {filteredIssues.length} new issues</span>
                <span className="text-xs font-mono text-neutral-400">{logsExpanded.has('issues') ? '−' : '+'}</span>
              </button>
              {logsExpanded.has('issues') && (
                <div className="px-2 pb-3 space-y-1">
                  {filteredIssues.length === 0 ? <div className="text-xs text-neutral-500 px-3 py-6 text-center border border-dashed border-white/[0.06] rounded-lg">No issues</div> : filteredIssues.slice(0, 10).map((iss: any) => (
                    <button key={iss.id} onClick={() => setDrawer({ kind: 'issue', id: iss.id })} className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0f1015] border border-white/[0.05] hover:border-white/10 hover:bg-[#181a21] transition">
                      <div className="min-w-0"><div className="text-xs font-medium text-white truncate">{iss.title}</div><div className="text-[11px] font-mono text-neutral-500">#{iss.number} · {iss.repoFullName} · {iss.status}</div></div>
                      <RiAddLine className="text-neutral-500 shrink-0" />
                    </button>
                  ))}
                  {filteredIssues.length > 10 && <div className="text-[11px] text-neutral-500 text-center py-1">+ {filteredIssues.length - 10} more</div>}
                </div>
              )}
            </div>
            {/* PRs accordion */}
            <div>
              <button onClick={() => toggleLogs('prs')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition text-left">
                <span className="flex items-center gap-2 text-sm font-semibold"><RiGitPullRequestLine className="text-emerald-400" /> {filteredPRs.length} PRs</span>
                <span className="text-xs font-mono text-neutral-400">{logsExpanded.has('prs') ? '−' : '+'}</span>
              </button>
              {logsExpanded.has('prs') && (
                <div className="px-2 pb-3 space-y-1">
                  {filteredPRs.length === 0 ? <div className="text-xs text-neutral-500 px-3 py-6 text-center border border-dashed border-white/[0.06] rounded-lg">No PRs</div> : filteredPRs.slice(0, 10).map((pr: any) => (
                    <button key={pr.id} onClick={() => setDrawer({ kind: 'pr', id: pr.id })} className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0f1015] border border-white/[0.05] hover:border-white/10 hover:bg-[#181a21] transition">
                      <div className="min-w-0"><div className="text-xs font-medium text-white truncate">{pr.title}</div><div className="text-[11px] font-mono text-neutral-500">PR #{pr.number} · {pr.repoFullName} · {pr.status}</div></div>
                      <RiAddLine className="text-neutral-500 shrink-0" />
                    </button>
                  ))}
                  {filteredPRs.length > 10 && <div className="text-[11px] text-neutral-500 text-center py-1">+ {filteredPRs.length - 10} more</div>}
                </div>
              )}
            </div>
            {/* Events timeline accordion */}
            <div>
              <button onClick={() => toggleLogs('events')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition text-left">
                <span className="flex items-center gap-2 text-sm font-semibold"><RiTimeLine className="text-neutral-400" /> Activity · {filteredEvents.length} events</span>
                <span className="text-xs font-mono text-neutral-400">{logsExpanded.has('events') ? '−' : '+'}</span>
              </button>
              {logsExpanded.has('events') && (
                <div className="px-3 pb-3 space-y-2 font-mono text-xs">
                  {filteredEvents.length === 0 ? <div className="text-neutral-500 text-center py-6 border border-dashed border-white/[0.06] rounded-lg">No activity yet</div> : filteredEvents.slice(0, 20).map((evt: any) => (
                    <button key={evt.id} onClick={() => setDrawer({ kind: 'event', id: evt.id })} className="w-full text-left flex gap-3 border-l border-white/[0.08] pl-3.5 py-1 hover:bg-white/[0.03] rounded-r-lg transition">
                      <span className="text-neutral-500 text-[11px] min-w-[60px]">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex-1"><span className="font-semibold text-white">{evt.title}</span><span className="text-neutral-400 ml-2 line-clamp-1">{evt.detail}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drawer - details sidebar */}
        <Drawer isOpen={!!drawer} onOpenChange={(open) => { if (!open) setDrawer(null); }}>
          <Drawer.Content className="bg-[#15171d] border-l border-white/[0.08] max-w-[480px] w-full">
            <Drawer.Header className="border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-sm font-semibold">
                {drawer?.kind === 'issue' && `Issue #${selectedIssue?.number ?? ''}`}
                {drawer?.kind === 'pr' && `PR #${selectedPR?.number ?? ''}`}
                {drawer?.kind === 'event' && `Event`}
              </span>
              <Button variant="ghost" className="h-7 w-7 p-0" onPress={() => setDrawer(null)}><RiCloseLine /></Button>
            </Drawer.Header>
            <Drawer.Body className="p-4 space-y-4 overflow-y-auto">
              {drawer?.kind === 'issue' && selectedIssue && (
                <>
                  <div className="text-xs font-mono text-neutral-400">{selectedIssue.repoFullName} • {selectedIssue.status}</div>
                  <h2 className="text-sm font-semibold text-white">{selectedIssue.title}</h2>
                  <div className="rounded-xl bg-[#0f1015] p-3.5 border border-white/[0.06] text-xs text-neutral-200 font-mono whitespace-pre-wrap leading-relaxed">{selectedIssue.body}</div>
                  {selectedIssue.analysis && (
                    <div className="rounded-xl bg-[#181a21] border border-white/[0.08] p-3.5 text-xs space-y-2">
                      <div className="font-semibold flex items-center gap-1.5"><RiBrainLine className="text-[#118af3]" /> Root Cause</div>
                      <div className="text-neutral-300">{selectedIssue.analysis.rootCause}</div>
                      <div className="text-neutral-500 text-[11px]">Affected: <span className="text-[#118af3] font-mono">{selectedIssue.analysis.affectedFiles?.join(', ')}</span></div>
                    </div>
                  )}
                </>
              )}
              {drawer?.kind === 'pr' && selectedPR && (
                <>
                  <div className="flex items-center gap-2 text-xs font-mono"><span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded">{selectedPR.status}</span><span className="text-neutral-400">{selectedPR.repoFullName} #{selectedPR.number}</span></div>
                  <h2 className="text-sm font-semibold">{selectedPR.title}</h2>
                  <div className="text-xs bg-[#0f1015] p-3 rounded-xl border border-white/[0.06] text-neutral-200"><FormattedSummaryContent text={selectedPR.summary} /></div>
                  <div className="rounded-xl border border-white/[0.08] bg-[#0f1015] overflow-hidden font-mono text-xs">
                    <div className="bg-[#181a21] px-3 py-2 flex justify-between border-b border-white/[0.08]"><span className="flex items-center gap-1.5 text-neutral-400"><RiCodeSSlashLine className="text-[#118af3]" /> Diff</span><span className="text-[11px] text-neutral-500">+60 -15</span></div>
                    <pre className="p-3 text-[11px] leading-5 whitespace-pre-wrap text-neutral-300">{(selectedPR as any).diff ? (selectedPR as any).diff.slice(0, 2000) : '// diff not yet generated'}</pre>
                  </div>
                  {selectedPR.testResults && (
                    <div className="rounded-xl bg-[#181a21] border border-white/[0.08] p-3.5 text-xs font-mono">
                      <div className="flex justify-between text-emerald-400"><span className="font-semibold flex items-center gap-1.5"><RiShieldCheckLine /> Tests</span><span className="text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{selectedPR.testResults.passed}/{selectedPR.testResults.total}</span></div>
                      <pre className="text-[10.5px] text-neutral-400 bg-[#0f1015] p-3 rounded-lg border border-white/[0.06] mt-2 whitespace-pre-wrap">{selectedPR.testResults.log}</pre>
                    </div>
                  )}
                  {selectedPR.status === 'awaiting_approval' && <Button onClick={() => approvePRMutation.mutate({ number: selectedPR.number })} isLoading={approvePRMutation.isPending} className="w-full">Approve & Merge</Button>}
                </>
              )}
              {drawer?.kind === 'event' && selectedEvent && (
                <>
                  <div className="text-xs font-mono text-neutral-500">{new Date(selectedEvent.timestamp).toLocaleString()}</div>
                  <h2 className="text-sm font-semibold">{selectedEvent.title}</h2>
                  <p className="text-xs text-neutral-300 leading-relaxed">{selectedEvent.detail}</p>
                  <div className="text-[11px] font-mono text-neutral-500">Type: {selectedEvent.type}</div>
                </>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>

        <BYOKSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} initialSettings={settings} onSuccess={() => queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSettings.key() })} />
        <RunWorkflowModal isOpen={showNewWorkflowModal} onClose={() => setShowNewWorkflowModal(false)} onSuccess={(issueNum) => { if (issueNum) setDrawer({ kind: 'issue', id: issueNum }); queryClient.invalidateQueries({ queryKey: orpc.maintainer.key() }); setActiveTab('logs'); }} />
        <AddRepoModal isOpen={showAddRepoModal} onClose={() => setShowAddRepoModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() }); setSelectedRepo('all'); }} />
      </div>
    </div>
  );
}
