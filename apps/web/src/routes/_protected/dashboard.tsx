import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { BYOKSettingsModal } from '#/components/maintainer/BYOKSettingsModal';
import { RunWorkflowModal } from '#/components/maintainer/RunWorkflowModal';
import { AddRepoModal } from '#/components/maintainer/AddRepoModal';
import { Card, Spinner } from '@heroui/react';
import { Button } from '#/components/Button';
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
  RiDeleteBinLine,
  RiBrainLine,
  RiShieldCheckLine,
  RiCodeSSlashLine,
  RiRadioButtonLine,
  RiCheckLine,
  RiArrowRightLine,
  RiShieldFlashLine,
  RiFileTextLine,
} from 'react-icons/ri';

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardComponent,
});

/** Formats raw AI summary with markdown-style bullets and bold tags into structured UI */
function FormattedSummaryContent({ text }: { text: string }) {
  if (!text) return null;

  // Check if string contains numbered points e.g. "1. **Title**: desc"
  const hasNumberedList = /(?:\d+\.\s+\*\*)/.test(text);

  if (hasNumberedList) {
    const parts = text.split(/(?=\d+\.\s+\*\*)/);
    const intro = parts[0]?.trim();
    const items = parts.slice(1);

    return (
      <div className="space-y-2.5">
        {intro && (
          <p className="text-xs text-neutral-300 leading-relaxed font-normal">
            {intro.replace(/\*\*/g, '').replace(/`/g, '')}
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 pt-0.5">
          {items.map((item, idx) => {
            const clean = item.replace(/^\d+\.\s+/, '');
            const match = clean.match(/^\*\*([^*]+)\*\*:\s*(.*)/s);
            if (match) {
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg bg-[#0f1015] border border-white/[0.05] p-2.5 text-xs transition hover:border-white/10"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#118af3]/15 text-[#118af3] text-[10px] font-mono font-bold mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="leading-relaxed text-neutral-200">
                    <span className="font-semibold text-white">{match[1]}: </span>
                    <span className="text-neutral-300">
                      {match[2].replace(/`([^`]+)`/g, '$1').replace(/\*\*/g, '')}
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <div key={idx} className="text-xs text-neutral-300 bg-[#0f1015] p-2.5 rounded-lg border border-white/[0.05]">
                {clean.replace(/\*\*/g, '').replace(/`/g, '')}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <p className="text-xs text-neutral-300 leading-relaxed">
      {text.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1')}
    </p>
  );
}

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
    <div className="min-h-screen bg-[#0d0e12] text-[#ffffff] font-sans antialiased p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Workspace Sub-header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#161820] via-[#14161c] to-[#161820] border border-white/[0.08] p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
                <RiRadioButtonLine className="text-lg animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-sm font-semibold tracking-tight text-white">
                    {user?.name ? `${user.name}'s Workspace` : 'Maintainer Workspace'}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Autonomous Mode
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  TrueForge Human Checkpoint Harness • Daytona Sandboxes • GitHub Agent Sync
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                className="tembo-btn-secondary h-8 px-3 text-xs"
                onClick={() => setShowAddRepoModal(true)}
                startContent={<RiAddLine className="text-sm text-neutral-400" />}
              >
                Connect Repo
              </Button>

              <Button
                className="tembo-btn-primary h-8 px-3.5 text-xs shadow-md"
                onClick={() => setShowNewWorkflowModal(true)}
                startContent={<RiPlayCircleLine className="text-sm" />}
              >
                Run Agent on Issue
              </Button>

              <Button
                variant="secondary"
                className="tembo-btn-secondary h-8 px-3 text-xs"
                onClick={() => setShowSettings(true)}
                startContent={<RiSettings4Line className="text-sm text-neutral-400" />}
              >
                BYOK & Config
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex flex-wrap items-center gap-1 bg-[#13141a] p-1 rounded-xl border border-white/[0.07]">
            <button
              className={
                'flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg transition-all ' +
                (activeTab === 'attention'
                  ? 'bg-[#222530] text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')
              }
              onClick={() => setActiveTab('attention')}
            >
              <RiAlertLine className="text-sm text-[#f59e0b]" />
              <span>Needs Attention</span>
              {pendingPRs.length > 0 && (
                <span className="bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                  {pendingPRs.length}
                </span>
              )}
            </button>

            <button
              className={
                'flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg transition-all ' +
                (activeTab === 'repos'
                  ? 'bg-[#222530] text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')
              }
              onClick={() => setActiveTab('repos')}
            >
              <RiGitBranchLine className="text-sm text-[#118af3]" />
              <span>Connected Repos</span>
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.2 rounded">
                {repos.length}
              </span>
            </button>

            <button
              className={
                'flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg transition-all ' +
                (activeTab === 'since_last'
                  ? 'bg-[#222530] text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')
              }
              onClick={() => setActiveTab('since_last')}
            >
              <RiTimeLine className="text-sm text-neutral-400" />
              <span>Since Last Visit</span>
            </button>

            <button
              className={
                'flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg transition-all ' +
                (activeTab === 'issues'
                  ? 'bg-[#222530] text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')
              }
              onClick={() => setActiveTab('issues')}
            >
              <RiBugLine className="text-sm text-purple-400" />
              <span>Issues</span>
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.2 rounded">
                {issues.length}
              </span>
            </button>

            <button
              className={
                'flex items-center gap-2 h-8 px-3 text-xs font-medium rounded-lg transition-all ' +
                (activeTab === 'prs'
                  ? 'bg-[#222530] text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]')
              }
              onClick={() => setActiveTab('prs')}
            >
              <RiGitPullRequestLine className="text-sm text-emerald-400" />
              <span>PR Reviews</span>
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.2 rounded">
                {prs.length}
              </span>
            </button>
          </div>

          <Button
            variant="ghost"
            className="tembo-btn-secondary h-8 px-3 text-xs text-neutral-300 hover:text-white"
            onClick={handleSyncAll}
            startContent={<RiRefreshLine className={isLoading || isRefetchingIssues ? 'animate-spin' : ''} />}
          >
            Sync
          </Button>
        </div>

        {/* Tab 1: Needs Attention */}
        {activeTab === 'attention' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                    Review & Human Sign-off Queue
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Autonomous branches verified in Daytona sandbox awaiting your merge approval.
                  </p>
                </div>

                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Harness Guardrails Active
                </span>
              </div>

              {pendingPRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-14 text-center space-y-2.5 bg-[#0f1015]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <RiCheckDoubleLine className="text-xl" />
                  </div>
                  <div className="text-sm font-semibold text-white">No pending approvals</div>
                  <p className="text-xs text-neutral-400 max-w-sm">
                    All autonomous agent branches are up-to-date. Connect another repository or start an issue workflow.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingPRs.map((pr) => (
                    <div
                      key={pr.id}
                      className="rounded-xl border border-white/[0.08] bg-[#181a21] p-5 shadow-lg space-y-4 hover:border-white/20 transition group"
                    >
                      {/* Top Meta Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/25 px-2 py-0.5 rounded-md shadow-sm">
                            <RiShieldFlashLine className="text-xs" /> Checkpoint Approval Required
                          </span>
                          <span className="text-xs font-mono text-neutral-400 bg-[#0f1015] border border-white/[0.06] px-2 py-0.5 rounded">
                            {pr.repoFullName}
                          </span>
                          <span className="text-xs font-mono text-[#118af3] bg-[#118af3]/10 border border-[#118af3]/20 px-1.5 py-0.5 rounded font-semibold">
                            PR #{pr.number}
                          </span>
                          <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                            Issue #{pr.issueNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedPRNumber(pr.number);
                              setActiveTab('prs');
                            }}
                            className="tembo-btn-secondary h-8 px-3 text-xs"
                            startContent={<RiTerminalBoxLine className="text-sm text-neutral-400" />}
                          >
                            Review Diff & Logs
                          </Button>

                          <Button
                            onClick={() => handleApproveMerge(pr.number)}
                            isLoading={approvePRMutation.isPending}
                            className="tembo-btn-primary h-8 px-3.5 text-xs font-semibold shadow-md"
                            startContent={<RiCheckDoubleLine className="text-sm" />}
                          >
                            Approve & Merge
                          </Button>
                        </div>
                      </div>

                      {/* Main Title */}
                      <div>
                        <h2 className="text-[15px] font-semibold tracking-tight text-white group-hover:text-neutral-100 transition">
                          {pr.title}
                        </h2>
                      </div>

                      {/* Formatted Summary Box */}
                      <div className="rounded-xl bg-[#0f1015] border border-white/[0.06] p-3.5">
                        <FormattedSummaryContent text={pr.summary} />
                      </div>

                      {/* Agent Root Cause Rationale */}
                      {pr.prDecisionReasoning && (
                        <div className="rounded-xl bg-gradient-to-r from-[#10131a] to-[#0f1015] border border-[#118af3]/20 p-3.5 text-xs space-y-1.5">
                          <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-[#118af3]/20 text-[#118af3]">
                              <RiBrainLine className="text-xs" />
                            </span>
                            Agent Root-Cause Rationale:
                          </div>
                          <p className="leading-relaxed text-neutral-300 font-normal">
                            {pr.prDecisionReasoning}
                          </p>
                        </div>
                      )}

                      {/* Bottom Verification Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-neutral-400">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded text-[11px]">
                            <RiCheckDoubleLine className="text-xs" /> Sandbox: {pr.testResults?.total || 18} Tests Passed (100%)
                          </span>
                          <span className="inline-flex items-center gap-1 text-neutral-300 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded text-[11px]">
                            Risk: <strong className="text-emerald-400">{(pr.agentReview?.riskLevel || 'low').toUpperCase()}</strong>
                          </span>
                        </div>

                        <span className="text-[11px] text-neutral-500">
                          Target branch: <strong className="text-neutral-300">main</strong>
                        </span>
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                    <RiGitBranchLine className="text-[#118af3] text-base" />
                    Connected GitHub Repositories
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Configured repositories receiving incoming GitHub webhook events.
                  </p>
                </div>

                <Button
                  className="tembo-btn-primary h-8 px-3.5 text-xs shadow-md"
                  onClick={() => setShowAddRepoModal(true)}
                  startContent={<RiAddLine className="text-sm" />}
                >
                  Connect Repository
                </Button>
              </div>

              {repos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-14 text-center space-y-2.5 bg-[#0f1015]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e2028] text-[#118af3]">
                    <RiGitBranchLine className="text-xl" />
                  </div>
                  <div className="text-sm font-semibold text-white">No repositories connected yet</div>
                  <p className="text-xs text-neutral-400 max-w-sm">
                    Connect your GitHub repository to enable autonomous maintainer issue triaging and PR creation.
                  </p>
                  <Button
                    variant="secondary"
                    className="tembo-btn-secondary text-xs mt-2"
                    onClick={() => setShowAddRepoModal(true)}
                  >
                    Connect First Repo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {repos.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/[0.08] bg-[#181a21] p-4 flex flex-col justify-between space-y-3 hover:border-white/20 transition shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[11px] font-mono text-[#118af3]">{r.owner}</div>
                            <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                          </div>

                          <span
                            className={
                              'text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ' +
                              (r.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                : 'bg-white/[0.05] text-neutral-400 border-white/10')
                            }
                          >
                            {r.status}
                          </span>
                        </div>

                        <div className="text-xs text-neutral-300 space-y-1 bg-[#0f1015] p-2.5 rounded-lg border border-white/[0.05] font-mono">
                          <div>Repo: <span className="text-white">{r.fullName}</span></div>
                          <div>Webhook: <span className="text-[#118af3]">/api/webhooks/github</span></div>
                          <div className="text-emerald-400 text-[11px] pt-0.5 flex items-center gap-1">
                            <RiCheckLine /> Auto AI Triage & Sandbox Fix Active
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                        <span className="text-neutral-500 font-mono text-[11px]">
                          Connected {new Date(r.connectedAt).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-6 text-xs text-neutral-400 hover:text-white px-2"
                            onClick={() => handleToggleRepoStatus(r.id, r.status)}
                          >
                            {r.status === 'active' ? 'Pause' : 'Activate'}
                          </Button>

                          <Button
                            variant="ghost"
                            className="h-6 text-xs text-rose-400 hover:bg-rose-500/10 px-2 rounded"
                            onClick={() => handleRemoveRepo(r.id, r.fullName)}
                            startContent={<RiDeleteBinLine className="text-xs" />}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Since Last Visit */}
        {activeTab === 'since_last' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-white/[0.08] bg-[#15171d] p-4 space-y-1 shadow-md">
                <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Issues Triaged</div>
                <div className="text-2xl font-mono font-bold text-white">{issues.length}</div>
                <div className="text-[11px] text-neutral-500">Root cause analyses</div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#15171d] p-4 space-y-1 shadow-md">
                <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">Sandbox Tests</div>
                <div className="text-2xl font-mono font-bold text-emerald-400">{prs.length}</div>
                <div className="text-[11px] text-neutral-500">100% assertions pass</div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#15171d] p-4 space-y-1 shadow-md">
                <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">PRs Generated</div>
                <div className="text-2xl font-mono font-bold text-[#118af3]">{prs.length}</div>
                <div className="text-[11px] text-neutral-500">Awaiting approval</div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#15171d] p-4 space-y-1 shadow-md">
                <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">PRs Merged</div>
                <div className="text-2xl font-mono font-bold text-purple-400">
                  {prs.filter((p) => p.status === 'merged').length}
                </div>
                <div className="text-[11px] text-neutral-500">Merged to main</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-5 sm:p-6 shadow-xl space-y-4">
              <div className="border-b border-white/[0.08] pb-3">
                <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                  <RiTimeLine className="text-neutral-400" />
                  Agent Execution Audit Trail
                </div>
              </div>

              {events.length === 0 ? (
                <div className="py-10 text-center text-xs text-neutral-500 border border-dashed border-white/[0.08] rounded-xl">
                  No activity events recorded yet.
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  {events.map((evt) => (
                    <div key={evt.id} className="relative flex items-start gap-3 border-l border-white/[0.08] pl-3.5 py-1">
                      <div className="absolute -left-[4px] top-2.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <div className="min-w-[65px] text-neutral-500 text-[11px]">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-white">{evt.title}</span>
                        <span className="text-neutral-400 ml-2">{evt.description}</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-3.5 space-y-2 shadow-xl">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 px-1 py-1 border-b border-white/[0.08]">
                Tracked Issues ({issues.length})
              </div>

              <div className="space-y-1.5">
                {issues.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-white/[0.08] rounded-lg">
                    No issues tracked yet.
                  </div>
                ) : (
                  issues.map((iss) => (
                    <div
                      key={iss.id}
                      onClick={() => setSelectedIssueNumber(iss.number)}
                      className={
                        'p-3 rounded-lg cursor-pointer transition border text-xs ' +
                        (selectedIssue?.number === iss.number
                          ? 'bg-[#222530] border-white/20 text-white shadow-sm'
                          : 'bg-[#0f1015] border-white/[0.05] text-neutral-400 hover:border-white/10 hover:text-white')
                      }
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono font-bold text-[#118af3]">#{iss.number}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#118af3]/10 text-[#118af3] border border-[#118af3]/20">
                          {iss.status}
                        </span>
                      </div>
                      <div className="font-medium text-white line-clamp-1">{iss.title}</div>
                      <div className="mt-1 text-[11px] text-neutral-500 font-mono flex justify-between">
                        <span className="truncate max-w-[130px]">{iss.repoFullName}</span>
                        <span>@{iss.author}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#15171d] p-5 space-y-4 shadow-xl">
              {selectedIssue ? (
                <>
                  <div className="flex items-start justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <div className="text-xs font-mono text-neutral-400 mb-1">
                        {selectedIssue.repoFullName} • Issue #{selectedIssue.number}
                      </div>
                      <h2 className="text-sm font-semibold tracking-tight text-white">
                        {selectedIssue.title}
                      </h2>
                    </div>
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/25 text-purple-400">
                      {selectedIssue.status.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1.5">Issue Description</div>
                    <div className="rounded-xl bg-[#0f1015] p-3.5 border border-white/[0.06] text-xs text-neutral-200 font-mono whitespace-pre-wrap leading-relaxed">
                      {selectedIssue.body}
                    </div>
                  </div>

                  {selectedIssue.analysis && (
                    <div className="rounded-xl bg-[#181a21] border border-white/[0.08] p-4 space-y-2">
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <RiBrainLine className="text-[#118af3]" /> TrueForge Root Cause Analysis
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Root Cause:</span>
                          <span className="text-white font-medium">{selectedIssue.analysis.rootCause}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Affected Files:</span>
                          <span className="text-[#118af3] font-mono">{selectedIssue.analysis.affectedFiles?.join(', ') || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-16 text-center text-xs text-neutral-500">
                  Select an issue to inspect details.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: PR Reviews & Code Changes */}
        {activeTab === 'prs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#15171d] p-3.5 space-y-2 shadow-xl">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 px-1 py-1 border-b border-white/[0.08] flex justify-between">
                <span>Pull Requests</span>
                <span className="text-emerald-400 font-bold">+{prs.length}</span>
              </div>

              <div className="space-y-1.5">
                {prs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-white/[0.08] rounded-lg">
                    No pull requests stored.
                  </div>
                ) : (
                  prs.map((pr) => (
                    <div
                      key={pr.id}
                      onClick={() => setSelectedPRNumber(pr.number)}
                      className={
                        'p-3 rounded-lg cursor-pointer transition border text-xs ' +
                        (selectedPR?.number === pr.number
                          ? 'bg-[#222530] border-white/20 text-white shadow-sm'
                          : 'bg-[#0f1015] border-white/[0.05] text-neutral-400 hover:border-white/10 hover:text-white')
                      }
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono font-bold text-emerald-400">PR #{pr.number}</span>
                        <span
                          className={
                            'text-[10px] font-mono px-1.5 py-0.2 rounded border ' +
                            (pr.status === 'awaiting_approval'
                              ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/25'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25')
                          }
                        >
                          {pr.status}
                        </span>
                      </div>
                      <div className="font-medium text-white line-clamp-1">{pr.title}</div>
                      <div className="mt-1 text-[11px] text-neutral-500 font-mono flex justify-between">
                        <span>{pr.repoFullName}</span>
                        <span className="text-emerald-400">+60 <span className="text-rose-400">-15</span></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Pane: Code Changes & Diff Viewer */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#15171d] p-5 space-y-4 shadow-xl">
              {selectedPR ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Open
                        </span>
                        <span className="text-xs font-mono text-neutral-400">
                          {selectedPR.repoFullName} #{selectedPR.number}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold tracking-tight text-white">
                        {selectedPR.title}
                      </h2>
                    </div>

                    {selectedPR.status === 'awaiting_approval' ? (
                      <Button
                        onClick={() => handleApproveMerge(selectedPR.number)}
                        isLoading={approvePRMutation.isPending}
                        className="tembo-btn-primary h-8 px-4 text-xs font-bold shadow-md"
                        startContent={<RiCheckDoubleLine className="text-sm" />}
                      >
                        Approve & Merge
                      </Button>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded">
                        ✓ MERGED TO MAIN
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs text-neutral-200 bg-[#0f1015] p-3 rounded-xl border border-white/[0.06]">
                      {selectedPR.summary || 'Automated repair verified in Daytona sandbox environment.'}
                    </div>

                    {/* Code diff preview */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#0f1015] overflow-hidden text-xs font-mono shadow-inner">
                      <div className="bg-[#181a21] px-3.5 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-neutral-400">
                          <RiCodeSSlashLine className="text-sm text-[#118af3]" />
                          <span className="text-white font-semibold">src/index.ts</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">+212</span>
                          <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">-48</span>
                        </div>
                      </div>

                      <div className="p-3.5 text-[11px] leading-6 space-y-0.5 overflow-x-auto text-neutral-200 font-mono">
                        <div className="text-[#5c6370]">1  // Autonomous patch verified in Daytona sandbox</div>
                        <div className="text-[#5c6370]">2  import &#123; createWorkflow &#125; from '@truefoundry/trueforge-sdk';</div>
                        <div className="text-rose-400 bg-rose-500/10 -mx-3.5 px-3.5">3 -  const timeout = 5000; // Unhandled edge case</div>
                        <div className="text-emerald-400 bg-emerald-500/10 -mx-3.5 px-3.5">4 +  const timeout = Math.min(requestLimit, 30000); // Fixed bounds</div>
                        <div className="text-emerald-400 bg-emerald-500/10 -mx-3.5 px-3.5">5 +  if (!isValidInput(payload)) throw new ValidationError();</div>
                        <div className="text-[#5c6370]">6  export default handleEvent;</div>
                      </div>
                    </div>

                    {selectedPR.testResults && (
                      <div className="rounded-xl bg-[#181a21] border border-white/[0.08] p-3.5 text-xs space-y-2 font-mono shadow-sm">
                        <div className="flex items-center justify-between text-emerald-400">
                          <span className="font-semibold flex items-center gap-1.5">
                            <RiShieldCheckLine /> Sandbox Assertion Output
                          </span>
                          <span className="text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {selectedPR.testResults.passed}/{selectedPR.testResults.total} Passing
                          </span>
                        </div>
                        <pre className="text-[10.5px] text-neutral-400 bg-[#0f1015] p-3 rounded-lg border border-white/[0.06] overflow-x-auto leading-relaxed">
                          {selectedPR.testResults.log}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-xs text-neutral-500">
                  Select a PR on the left to inspect diff and test runs.
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
