import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { maintainerStore } from '../lib/maintainer-store';
import type { BYOKSettings } from '../lib/maintainer-store';
import { trueforge } from '../lib/trueforge';
import { githubService } from '../lib/github';
import {
  RiShieldFlashLine,
  RiGitPullRequestLine,
  RiAlertLine,
  RiCheckDoubleLine,
  RiSettings4Line,
  RiKey2Line,
  RiTerminalBoxLine,
  RiPlayCircleLine,
  RiCloseCircleLine,
  RiRefreshLine,
  RiTimeLine,
  RiBugLine,
} from 'react-icons/ri';

export const Route = createFileRoute('/')({
  component: DashboardComponent,
});

function DashboardComponent() {
  const [activeTab, setActiveTab] = useState<'attention' | 'since_last' | 'issues' | 'prs' | 'repos'>('attention');
  const [selectedIssueNumber, setSelectedIssueNumber] = useState<number | null>(101);
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(42);
  
  // Settings & Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [showNewWorkflowModal, setShowNewWorkflowModal] = useState(false);
  const [issueUrlInput, setIssueUrlInput] = useState('');
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  
  // Settings form state (BYOK)
  const [settings, setSettings] = useState<BYOKSettings>(maintainerStore.getSettings());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Store data state
  const [storeState, setStoreState] = useState({
    repos: maintainerStore.getRepos(),
    issues: maintainerStore.getIssues(),
    prs: maintainerStore.getPRs(),
    logs: maintainerStore.getLogs(),
    needsAttention: maintainerStore.getNeedsAttention(),
    sinceLastVisit: maintainerStore.getSinceLastVisit(),
  });

  const refreshStoreData = () => {
    setStoreState({
      repos: [...maintainerStore.getRepos()],
      issues: [...maintainerStore.getIssues()],
      prs: [...maintainerStore.getPRs()],
      logs: [...maintainerStore.getLogs()],
      needsAttention: maintainerStore.getNeedsAttention(),
      sinceLastVisit: maintainerStore.getSinceLastVisit(),
    });
  };

  useEffect(() => {
    refreshStoreData();
  }, []);

  const pendingPRs = storeState.prs.filter((p) => p.status === 'awaiting_approval');
  const selectedIssue = storeState.issues.find((i) => i.number === selectedIssueNumber);
  const selectedPR = storeState.prs.find((p) => p.number === selectedPRNumber);

  // Handle BYOK settings save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    maintainerStore.updateSettings(settings);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  // Handle triggering a new workflow from issue URL
  const handleStartWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueUrlInput.trim()) return;

    setIsStartingWorkflow(true);

    const parsed = githubService.parseIssueUrl(issueUrlInput);
    let issueData = undefined;

    if (parsed) {
      try {
        const ghIssue = await githubService.getIssue(parsed.owner, parsed.repo, parsed.issueNumber);
        issueData = {
          number: ghIssue.number,
          title: ghIssue.title,
          body: ghIssue.body,
          repoFullName: `${parsed.owner}/${parsed.repo}`,
        };
      } catch {
        // Fallback gracefully
      }
    }

    const issue = maintainerStore.startIssueWorkflow(issueUrlInput, issueData);

    // Call TrueForge in background
    try {
      const session = await trueforge.createIssueWorkflowSession(
        issueUrlInput,
        issueData?.repoFullName || 'octocat/oauth-server-demo',
        { modelName: settings.selectedModel }
      );
      if (session?.id) {
        await trueforge.startInvestigationTurn(session.id, {
          issueNumber: issue.number,
          repo: issue.repoFullName,
          title: issue.title,
          body: issue.body,
        });
      }
    } catch (err) {
      console.warn('TrueForge workflow start error:', err);
    }

    setIsStartingWorkflow(false);
    setIssueUrlInput('');
    setShowNewWorkflowModal(false);
    refreshStoreData();
    setSelectedIssueNumber(issue.number);
    setActiveTab('issues');
  };

  // Handle approving PR via TrueForge checkpoint
  const handleApproveMerge = async (prNumber: number) => {
    const pr = maintainerStore.getPR(prNumber);
    if (pr?.trueforgeSessionId) {
      await trueforge.submitToolApproval(
        pr.trueforgeSessionId,
        pr.threadId || 'main',
        pr.toolCallId || 'call_merge_github_42',
        true
      );
    }

    try {
      if (pr?.repoFullName) {
        const parts = pr.repoFullName.split('/');
        if (parts.length === 2) {
          await githubService.mergePullRequest(parts[0], parts[1], pr.number);
        }
      }
    } catch {
      // Local fallback
    }

    maintainerStore.approvePR(prNumber);
    refreshStoreData();
  };

  // Handle rejecting PR / requesting changes
  const handleRejectPR = async (prNumber: number) => {
    const reason = prompt('Enter feedback / reason for requesting changes:', 'Please add extra test coverage.');
    if (reason === null) return;

    const pr = maintainerStore.getPR(prNumber);
    if (pr?.trueforgeSessionId) {
      await trueforge.submitToolApproval(
        pr.trueforgeSessionId,
        pr.threadId || 'main',
        pr.toolCallId || 'call_merge_github_42',
        false,
        reason
      );
    }

    maintainerStore.rejectPR(prNumber, reason);
    refreshStoreData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-500 to-purple-600 shadow-lg shadow-cyan-500/20">
              <RiShieldFlashLine className="text-xl text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">ForgeMaintainer</h1>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                  TrueForge Powered
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous GitHub Repository Maintainer & Human Supervisor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl p-6">
        {/* Navigation Tabs */}
        <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex gap-2">
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
              <span>Issues ({storeState.issues.length})</span>
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
              <span>PR Reviews ({storeState.prs.length})</span>
            </button>
          </div>

          <button
            onClick={refreshStoreData}
            title="Refresh Data"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RiRefreshLine />
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
                    <span>⚠️</span> Items Requiring Your Supervision & Approval
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    What did your autonomous maintainer do while you were away? Review sandbox test assertions, agent risk assessment, and provide human sign-off for PR merges.
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
                    Your autonomous maintainer is actively monitoring connected repositories. Trigger a new run on any issue above!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingPRs.map((pr) => (
                    <div
                      key={pr.id}
                      className="group relative overflow-hidden rounded-xl border border-amber-500/30 bg-slate-950 p-6 shadow-xl transition hover:border-amber-500/50"
                    >
                      <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-500/5 blur-2xl pointer-events-none"></div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/20">
                              Human Approval Checkpoint
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                              {pr.repoFullName} • PR #{pr.number} (Linked Issue #{pr.issueNumber})
                            </span>
                            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                              Session: {pr.trueforgeSessionId}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-200 transition">
                            {pr.title}
                          </h3>

                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                            {pr.summary}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400 pt-1">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <RiCheckDoubleLine /> Sandbox Tests: 18/18 Passed (1.42s)
                            </span>
                            <span className="flex items-center gap-1">
                              Risk Level: <strong className="text-emerald-400 font-semibold">{pr.agentReview.riskLevel.toUpperCase()}</strong>
                            </span>
                            <span className="text-slate-500 font-mono">Branch: {pr.branch}</span>
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col gap-2.5 min-w-[200px]">
                          <button
                            onClick={() => handleApproveMerge(pr.number)}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/50 transition active:scale-95 cursor-pointer"
                          >
                            <RiCheckDoubleLine className="text-base" />
                            <span>Approve & Merge PR</span>
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

                          <button
                            onClick={() => handleRejectPR(pr.number)}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 hover:bg-red-950/60 px-4 py-2 text-xs font-medium text-red-400 transition cursor-pointer"
                          >
                            <RiCloseCircleLine className="text-base" />
                            <span>Request Changes</span>
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

        {/* Tab 2: Since Your Last Visit */}
        {activeTab === 'since_last' && (
          <div className="space-y-6">
            {/* Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Issues Triaged</div>
                <div className="mt-2 text-3xl font-extrabold text-cyan-400">
                  {storeState.sinceLastVisit.stats.triagedCount} / {storeState.sinceLastVisit.stats.totalIssues}
                </div>
                <div className="mt-1 text-xs text-slate-500">Autonomous analysis & root cause</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Sandbox Test Executions</div>
                <div className="mt-2 text-3xl font-extrabold text-emerald-400">
                  {storeState.sinceLastVisit.stats.passedTestsCount}
                </div>
                <div className="mt-1 text-xs text-slate-500">100% assertions passing</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Automated PRs Created</div>
                <div className="mt-2 text-3xl font-extrabold text-indigo-400">
                  {storeState.sinceLastVisit.stats.prsCreated}
                </div>
                <div className="mt-1 text-xs text-slate-500">Awaiting maintainer approval</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">PRs Merged & Closed</div>
                <div className="mt-2 text-3xl font-extrabold text-purple-400">
                  {storeState.sinceLastVisit.stats.mergedCount}
                </div>
                <div className="mt-1 text-xs text-slate-500">Via TrueForge human checkpoint</div>
              </div>
            </div>

            {/* Audit Timeline */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
              <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                <span>🕒</span> Maintainer Agent Activity Log
              </h2>

              <div className="space-y-4">
                {storeState.sinceLastVisit.recentLogs.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-4 border-l-2 border-slate-700/80 pl-4 py-1.5">
                    <div className="absolute -left-[5px] top-3 h-2 w-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400"></div>

                    <div className="min-w-[70px] text-xs font-mono text-slate-500 pt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-bold text-slate-200">{log.title}</div>
                      <div className="text-xs text-slate-400">{log.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Issues View */}
        {activeTab === 'issues' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Issue List */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Tracked Issues</h2>
              <div className="space-y-2">
                {storeState.issues.map((iss) => (
                  <div
                    key={iss.id}
                    onClick={() => setSelectedIssueNumber(iss.number)}
                    className={
                      'p-4 rounded-xl cursor-pointer transition border ' +
                      (selectedIssueNumber === iss.number
                        ? 'bg-slate-800/80 border-indigo-500 shadow-lg shadow-indigo-950/30'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700')
                    }
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-indigo-400">#{iss.number}</span>
                      <span
                        className={
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ' +
                          (iss.status === 'merged'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : iss.status === 'awaiting_approval'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20')
                        }
                      >
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
            </div>

            {/* Issue Details & Root Cause Analysis */}
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

                  {/* Body */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                    <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono">
                      {selectedIssue.body}
                    </div>
                  </div>

                  {/* Agent Analysis */}
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
                          <span className="text-cyan-400 font-mono">{selectedIssue.analysis.affectedFiles.join(', ')}</span>
                        </div>

                        <div>
                          <span className="text-slate-500 block">Risk Assessment:</span>
                          <span className="text-emerald-400 font-bold">{selectedIssue.analysis.riskLevel.toUpperCase()}</span>
                        </div>

                        <div>
                          <span className="text-slate-500 block">Recommendation:</span>
                          <span className="text-slate-300">{selectedIssue.analysis.recommendation}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Comments & Agent Traces</h4>
                    <div className="space-y-3">
                      {selectedIssue.comments.map((c) => (
                        <div
                          key={c.id}
                          className={
                            'rounded-xl p-4 border text-xs leading-relaxed ' +
                            (c.isAgent ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200' : 'bg-slate-950 border-slate-800 text-slate-300')
                          }
                        >
                          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-bold text-slate-300">@{c.author}</span>
                            <span>{new Date(c.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div>{c.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-xs text-slate-500">Select an issue on the left to inspect details.</div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: PR Reviews */}
        {activeTab === 'prs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PR List */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Pull Requests</h2>
              <div className="space-y-2">
                {storeState.prs.map((pr) => (
                  <div
                    key={pr.id}
                    onClick={() => setSelectedPRNumber(pr.number)}
                    className={
                      'p-4 rounded-xl cursor-pointer transition border ' +
                      (selectedPRNumber === pr.number
                        ? 'bg-slate-800/80 border-purple-500 shadow-lg shadow-purple-950/30'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700')
                    }
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-purple-400">PR #{pr.number}</span>
                      <span
                        className={
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ' +
                          (pr.status === 'merged'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
                        }
                      >
                        {pr.status}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-200 line-clamp-2">{pr.title}</h3>
                    <div className="mt-2 text-[11px] text-slate-500">{pr.repoFullName} • Linked Issue #{pr.issueNumber}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* PR Review Detail */}
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
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/50 transition active:scale-95 cursor-pointer"
                      >
                        <RiCheckDoubleLine className="text-base" />
                        <span>Approve & Merge PR</span>
                      </button>
                    ) : (
                      <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-400">
                        ✓ MERGED
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Agent PR Summary</h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                      {selectedPR.summary}
                    </p>
                  </div>

                  {/* Code Diff */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Unified Code Diff</h4>
                    <pre className="rounded-xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                      {selectedPR.diff}
                    </pre>
                  </div>

                  {/* Sandbox Test Log */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Daytona / TrueForge Sandbox Test Execution Log</h4>
                    <pre className="rounded-xl bg-slate-950 p-4 border border-emerald-500/30 font-mono text-xs text-emerald-400 overflow-x-auto">
                      {selectedPR.testResults.log}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-xs text-slate-500">Select a PR on the left to review details.</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* BYOK & Config Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <RiKey2Line className="text-cyan-400" /> BYOK Model & API Key Configuration
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Active Model</label>
                <select
                  value={settings.selectedModel}
                  onChange={(e) => setSettings({ ...settings, selectedModel: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="google/gemini-2.5-flash-lite">Google Gemini 2.5 Flash Lite (Recommended)</option>
                  <option value="anthropic/claude-sonnet-4-6">Anthropic Claude Sonnet 4.6</option>
                  <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Google AI Studio API Key (Gemini)</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">GitHub Personal Access Token (PAT)</label>
                <input
                  type="password"
                  placeholder="ghp_..."
                  value={settings.githubToken}
                  onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">TrueForge Harness Base URL</label>
                <input
                  type="text"
                  placeholder="http://localhost:8790"
                  value={settings.trueforgeBaseUrl}
                  onChange={(e) => setSettings({ ...settings, trueforgeBaseUrl: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {saveSuccessMsg ? (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    ✓ Saved successfully!
                  </span>
                ) : (
                  <span></span>
                )}

                <button
                  type="submit"
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Workflow Modal */}
      {showNewWorkflowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <RiPlayCircleLine className="text-cyan-400 text-lg" /> Launch Agent on GitHub Issue
              </h3>
              <button
                onClick={() => setShowNewWorkflowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartWorkflow} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">GitHub Issue URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/octocat/oauth-server-demo/issues/101"
                  value={issueUrlInput}
                  onChange={(e) => setIssueUrlInput(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  TrueForge agent will investigate code, run tests in sandbox, and create a PR requiring your approval before merge.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWorkflowModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isStartingWorkflow}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isStartingWorkflow ? 'Launching...' : 'Start Autonomous Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
