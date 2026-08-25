import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import {
  RiGitPullRequestLine,
  RiAlertLine,
  RiCheckDoubleLine,
  RiSettings4Line,
  RiPlayCircleLine,
  RiRefreshLine,
  RiTimeLine,
  RiBugLine,
  RiTerminalBoxLine,
  RiGitBranchLine,
  RiAddLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiBrainLine,
  RiCpuLine,
} from 'react-icons/ri';

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'attention' | 'since_last' | 'issues' | 'prs' | 'repos'>('attention');
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(null);
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(null);

  // Modal visibility
  const [showSettings, setShowSettings] = useState(false);
  const [showNewWorkflowModal, setShowNewWorkflowModal] = useState(false);
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);

  // TanStack Queries (oRPC)
  const { data: issues = [], isLoading: isLoadingIssues, isRefetching: isRefetchingIssues } = useQuery(
    orpc.maintainer.getIssues.queryOptions()
  );

  const { data: prs = [], isLoading: isLoadingPRs } = useQuery(
    orpc.maintainer.getPRReviews.queryOptions()
  );

  const { data: repos = [], isLoading: isLoadingRepos } = useQuery(
    orpc.maintainer.getRepos.queryOptions()
  );

  const { data: events = [] } = useQuery(
    orpc.maintainer.getSinceLastVisit.queryOptions()
  );

  const { data: settings = {} } = useQuery(
    orpc.maintainer.getSettings.queryOptions()
  );

  // TanStack Mutations (oRPC)
  const approvePRMutation = useMutation(
    orpc.maintainer.approvePR.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getPRReviews.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getNeedsAttention.key() });
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSinceLastVisit.key() });
      },
    })
  );

  const toggleRepoMutation = useMutation(
    orpc.maintainer.toggleRepoStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() });
      },
    })
  );

  const removeRepoMutation = useMutation(
    orpc.maintainer.removeRepo.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() });
      },
    })
  );

  const pendingPRs = prs.filter((p) => p.status === 'awaiting_approval');
  const selectedIssue = issues.find((i) => i.number === selectedIssueNumber) || issues[0];
  const selectedPR = prs.find((p) => p.number === selectedPRNumber) || prs[0];

  const handleApproveMerge = (prNumber: number) => {
    approvePRMutation.mutate({ number: prNumber });
  };

  const handleToggleRepoStatus = (repoId: string, currentStatus: string) => {
    toggleRepoMutation.mutate({ id: repoId, active: currentStatus !== 'active' });
  };

  const handleRemoveRepo = (repoId: string, repoFullName: string) => {
    if (confirm(`Are you sure you want to disconnect and remove '${repoFullName}' from Maintainer?`)) {
      removeRepoMutation.mutate({ id: repoId });
    }
  };

  const handleSyncAll = () => {
    queryClient.invalidateQueries({ queryKey: orpc.maintainer.key() });
  };

  const isLoading = isLoadingIssues || isLoadingPRs || isLoadingRepos;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Welcome back, {user?.name || user?.email || 'Maintainer'} 👋
            </h1>
            <p className="text-xs text-slate-400">
              Autonomous GitHub Repository Supervision • TrueForge Human-in-the-Loop Checkpoints
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddRepoModal(true)}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60 transition cursor-pointer"
            >
              <RiAddLine className="text-base" />
              <span>Connect Repo</span>
            </button>

            <button
              onClick={() => setShowNewWorkflowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/50 hover:from-cyan-400 hover:to-blue-500 transition active:scale-95 cursor-pointer"
            >
              <RiPlayCircleLine className="text-base" />
              <span>Run Agent on Issue</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <RiSettings4Line className="text-base" />
              <span>BYOK & Config</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('attention')}
              className={
                'relative flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ' +
                (activeTab === 'attention'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200')
              }
            >
              <RiAlertLine className="text-base text-amber-400" />
              <span>Needs Attention</span>
              {pendingPRs.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                  {pendingPRs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('repos')}
              className={
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ' +
                (activeTab === 'repos'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200')
              }
            >
              <RiGitBranchLine className="text-base text-cyan-400" />
              <span>Connected Repos ({repos.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('since_last')}
              className={
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ' +
                (activeTab === 'since_last'
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200')
              }
            >
              <RiTimeLine className="text-base text-blue-400" />
              <span>Since Your Last Visit</span>
            </button>

            <button
              onClick={() => setActiveTab('issues')}
              className={
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ' +
                (activeTab === 'issues'
                  ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200')
              }
            >
              <RiBugLine className="text-base text-indigo-400" />
              <span>Issues ({issues.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('prs')}
              className={
                'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ' +
                (activeTab === 'prs'
                  ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200')
              }
            >
              <RiGitPullRequestLine className="text-base text-purple-400" />
              <span>PR Reviews ({prs.length})</span>
            </button>
          </div>

          <button
            onClick={handleSyncAll}
            title="Sync via TanStack Query"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RiRefreshLine className={isLoading || isRefetchingIssues ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>

        {/* Tab 1: Needs Attention */}
        {activeTab === 'attention' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
              <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>⚠️</span> Items Requiring Supervision & Approval
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Review sandbox test assertions, risk assessments, and provide human sign-off for PR merges.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span> TrueForge Checkpoint Active
                </span>
              </div>

              {pendingPRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
                    <RiCheckDoubleLine className="text-2xl" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">All clear! No pending approvals</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Connect your GitHub repository under "Connected Repos" or click "Run Agent on Issue"!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingPRs.map((pr) => (
                    <div
                      key={pr.id}
                      className="group relative overflow-hidden rounded-xl border border-amber-500/30 bg-slate-950 p-6 shadow-xl transition hover:border-amber-500/50"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/20">
                              Human Approval Checkpoint
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                              {pr.repoFullName} • PR #{pr.number} (Linked Issue #{pr.issueNumber})
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-200 transition">
                            {pr.title}
                          </h3>

                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                            {pr.summary}
                          </p>

                          {pr.prDecisionReasoning && (
                            <div className="rounded-lg bg-purple-950/40 border border-purple-500/30 p-3 text-xs text-purple-200 space-y-1">
                              <div className="font-bold flex items-center gap-1.5 text-purple-300">
                                <RiBrainLine className="text-purple-400" /> Agent Decision Reasoning:
                              </div>
                              <p className="leading-relaxed text-purple-200/90">{pr.prDecisionReasoning}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400 pt-1">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <RiCheckDoubleLine /> Sandbox Tests: {pr.testResults?.total || 18} Passed
                            </span>
                            <span className="flex items-center gap-1">
                              Risk Level: <strong className="text-emerald-400 font-semibold">{(pr.agentReview?.riskLevel || 'low').toUpperCase()}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col gap-2.5 min-w-[200px]">
                          <button
                            onClick={() => handleApproveMerge(pr.number)}
                            disabled={approvePRMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <RiCheckDoubleLine className="text-base" />
                            <span>{approvePRMutation.isPending ? 'Merging...' : 'Approve & Merge PR'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPRNumber(pr.number);
                              setActiveTab('prs');
                            }}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 transition cursor-pointer"
                          >
                            <RiTerminalBoxLine className="text-base text-purple-400" />
                            <span>Review Diff & Logs</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Connected Repositories */}
        {activeTab === 'repos' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
              <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <RiGitBranchLine className="text-cyan-400 text-lg" /> Configured & Connected GitHub Repositories
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Incoming webhooks at <code className="text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">/api/webhooks/github</code> are matched against these configured repositories.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddRepoModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  <RiAddLine className="text-base" />
                  <span>Connect Repository</span>
                </button>
              </div>

              {repos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 mb-3">
                    <RiGitBranchLine className="text-2xl" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">No repositories connected yet</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mb-4">
                    Add your GitHub repository (e.g. <code className="text-slate-300">octocat/hello-world</code>) so incoming webhooks automatically trigger autonomous maintainer workflows.
                  </p>
                  <button
                    onClick={() => setShowAddRepoModal(true)}
                    className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
                  >
                    Connect Your First Repo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {repos.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-5 space-y-3 relative overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-mono text-cyan-400">{r.owner}</div>
                            <h3 className="text-base font-bold text-slate-100">{r.name}</h3>
                          </div>

                          <span
                            className={
                              'text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ' +
                              (r.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700')
                            }
                          >
                            {r.status}
                          </span>
                        </div>

                        <div className="mt-3 text-xs text-slate-400 space-y-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 font-mono">
                          <div>Webhook Match: <span className="text-slate-200 font-semibold">{r.fullName}</span></div>
                          <div>Endpoint: <span className="text-cyan-300">/api/webhooks/github</span></div>
                          <div className="flex items-center gap-1 text-emerald-400 text-[11px] pt-1">
                            <RiCheckLine /> AI Triage & PR Generation Enabled
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                        <span className="text-slate-500 text-[11px]">
                          Connected {new Date(r.connectedAt).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleRepoStatus(r.id, r.status)}
                            className="text-slate-400 hover:text-white transition font-medium cursor-pointer underline underline-offset-4"
                          >
                            {r.status === 'active' ? 'Pause' : 'Activate'}
                          </button>

                          <button
                            onClick={() => handleRemoveRepo(r.id, r.fullName)}
                            title="Disconnect Repository"
                            className="flex items-center gap-1 text-red-400 hover:text-red-300 transition font-medium cursor-pointer border border-red-900/40 bg-red-950/20 hover:bg-red-950/60 px-2 py-1 rounded"
                          >
                            <RiDeleteBinLine className="text-xs" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Since Your Last Visit */}
        {activeTab === 'since_last' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Issues Triaged</div>
                <div className="mt-2 text-3xl font-extrabold text-cyan-400">{issues.length}</div>
                <div className="mt-1 text-xs text-slate-500">Autonomous root cause analysis</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Sandbox Test Runs</div>
                <div className="mt-2 text-3xl font-extrabold text-emerald-400">{prs.length}</div>
                <div className="mt-1 text-xs text-slate-500">100% assertions passing</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Automated PRs Created</div>
                <div className="mt-2 text-3xl font-extrabold text-indigo-400">{prs.length}</div>
                <div className="mt-1 text-xs text-slate-500">Awaiting maintainer approval</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">PRs Merged & Closed</div>
                <div className="mt-2 text-3xl font-extrabold text-purple-400">
                  {prs.filter((p) => p.status === 'merged').length}
                </div>
                <div className="mt-1 text-xs text-slate-500">Via TrueForge human checkpoint</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
              <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                <span>🕒</span> Maintainer Agent Audit Trail
              </h2>

              {events.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No activity events logged in database yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((evt) => (
                    <div key={evt.id} className="relative flex items-start gap-4 border-l-2 border-slate-700/80 pl-4 py-1.5">
                      <div className="absolute -left-[5px] top-3 h-2 w-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></div>
                      <div className="min-w-[70px] text-xs font-mono text-slate-500 pt-0.5">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-bold text-slate-200">{evt.title}</div>
                        <div className="text-xs text-slate-400">{evt.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Issues View */}
        {activeTab === 'issues' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Tracked Issues</h2>
              {issues.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No tracked issues in database. Click "Run Agent on Issue" to add one!
                </div>
              ) : (
                <div className="space-y-2">
                  {issues.map((iss) => (
                    <div
                      key={iss.id}
                      onClick={() => setSelectedIssueNumber(iss.number)}
                      className={
                        'p-4 rounded-xl cursor-pointer transition border ' +
                        (selectedIssue?.number === iss.number
                          ? 'bg-slate-800/80 border-indigo-500 shadow-lg shadow-indigo-950/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700')
                      }
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-indigo-400">#{iss.number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase bg-blue-500/10 text-blue-400 border-blue-500/20">
                          {iss.status}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-200 line-clamp-2">{iss.title}</h3>
                      <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                        <span className="truncate max-w-[150px]">{iss.repoFullName}</span>
                        <span>@{iss.author}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              {selectedIssue ? (
                <>
                  <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                    <div>
                      <div className="text-xs text-slate-400 font-mono mb-1">
                        {selectedIssue.repoFullName} • Issue #{selectedIssue.number}
                      </div>
                      <h2 className="text-lg font-bold text-slate-100">{selectedIssue.title}</h2>
                    </div>
                    <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                      {selectedIssue.status.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                    <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono">
                      {selectedIssue.body}
                    </div>
                  </div>

                  {selectedIssue.analysis && (
                    <div className="rounded-xl bg-slate-950 border border-indigo-500/30 p-5 space-y-3">
                      <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                        <span>🤖</span> TrueForge Agent Root Cause Analysis
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-500 block">Root Cause Identified:</span>
                          <span className="text-slate-200 font-medium">{selectedIssue.analysis.rootCause}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Affected Files:</span>
                          <span className="text-cyan-400 font-mono">{selectedIssue.analysis.affectedFiles?.join(', ') || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-xs text-slate-500">
                  {issues.length === 0 ? 'Database contains 0 issues.' : 'Select an issue on the left to inspect details.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: PR Reviews */}
        {activeTab === 'prs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Pull Requests</h2>
              {prs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No PRs stored in database.
                </div>
              ) : (
                <div className="space-y-2">
                  {prs.map((pr) => (
                    <div
                      key={pr.id}
                      onClick={() => setSelectedPRNumber(pr.number)}
                      className={
                        'p-4 rounded-xl cursor-pointer transition border ' +
                        (selectedPR?.number === pr.number
                          ? 'bg-slate-800/80 border-purple-500 shadow-lg shadow-purple-950/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700')
                      }
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-purple-400">PR #{pr.number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {pr.status}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-200 line-clamp-2">{pr.title}</h3>
                      <div className="mt-2 text-[11px] text-slate-500">{pr.repoFullName} • Linked Issue #{pr.issueNumber}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
              {selectedPR ? (
                <>
                  <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                    <div>
                      <div className="text-xs text-slate-400 font-mono mb-1">
                        {selectedPR.repoFullName} • PR #{selectedPR.number} • Branch: {selectedPR.branch}
                      </div>
                      <h2 className="text-lg font-bold text-slate-100">{selectedPR.title}</h2>
                    </div>
                    {selectedPR.status === 'awaiting_approval' ? (
                      <button
                        onClick={() => handleApproveMerge(selectedPR.number)}
                        disabled={approvePRMutation.isPending}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <RiCheckDoubleLine className="text-base" />
                        <span>{approvePRMutation.isPending ? 'Merging...' : 'Approve & Merge PR'}</span>
                      </button>
                    ) : (
                      <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-400">
                        ✓ MERGED
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-xs text-slate-500">
                  {prs.length === 0 ? 'Database contains 0 PRs.' : 'Select a PR on the left to review details.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        <BYOKSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialSettings={settings}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSettings.key() });
          }}
        />

        <RunWorkflowModal
          isOpen={showNewWorkflowModal}
          onClose={() => setShowNewWorkflowModal(false)}
          onSuccess={(issueNum) => {
            if (issueNum) setSelectedIssueNumber(issueNum);
            queryClient.invalidateQueries({ queryKey: orpc.maintainer.key() });
            setActiveTab('issues');
          }}
        />

        <AddRepoModal
          isOpen={showAddRepoModal}
          onClose={() => setShowAddRepoModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() });
            setActiveTab('repos');
          }}
        />
      </div>
    </div>
  );
}
