import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '#/components/Button';
import { LogoWithName, Logo } from '#/components/Logo';
import { SiGithub } from 'react-icons/si';
import {
  RiArrowRightLine,
  RiShieldCheckLine,
  RiRobot2Line,
  RiGitPullRequestLine,
  RiBrainLine,
  RiTimeLine,
  RiCheckDoubleLine,
  RiCodeSSlashLine,
  RiFlashlightLine,
  RiAlertLine,
} from 'react-icons/ri';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: '#010409', color: '#ffffff' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(61,68,77,0.7)', background: '#0d1117' }} className="sticky top-0 z-40 backdrop-blur-md px-4 sm:px-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <span className="flex items-center gap-2 cursor-pointer" onClick={() => navigate({ to: '/' })}>
            <LogoWithName />
          </span>
          <div className="flex items-center gap-3">
            <a href="https://github.com/Sahil-Gupta584/picto" target="_blank" rel="noreferrer" className="text-[var(--muted)] hover:text-white transition flex items-center gap-1.5 text-xs">
              <SiGithub className="text-base" /> GitHub
            </a>
            <Button onClick={() => navigate({ to: '/login' })}>Sign in</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono border rounded-full px-3 py-1 mb-6" style={{ borderColor: 'rgba(61,68,77,0.7)', background: '#0d1117', color: '#9198a1' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950] animate-pulse" />
          TrueForge Hackathon · Aug 24–30 2026
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-[1.1] mb-6 max-w-3xl mx-auto">
          Your entire repo. One screen.
        </h1>

        <p className="text-lg text-[#9198a1] max-w-xl mx-auto mb-10 leading-relaxed">
          Picto runs your maintenance so you don't have to. Watch everything, approve what matters.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate({ to: '/login' })} className="h-10 px-6 text-sm font-semibold">
            Start for free <RiArrowRightLine className="ml-1" />
          </Button>
          <a href="https://github.com/Sahil-Gupta584/picto" target="_blank" rel="noreferrer"
            className="h-10 px-6 text-sm font-medium inline-flex items-center gap-2 rounded-xl border transition"
            style={{ borderColor: 'rgba(61,68,77,0.7)', background: 'transparent', color: '#e6edf3' }}>
            <SiGithub /> View on GitHub
          </a>
        </div>

        {/* Hero visual — pipeline diagram */}
        <div className="mt-16 rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(61,68,77,0.7)', background: '#0d1117' }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b text-xs font-mono text-[#9198a1]" style={{ borderColor: 'rgba(61,68,77,0.7)' }}>
            <span className="h-2.5 w-2.5 rounded-full bg-[#f85149]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#d29922]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3fb950]" />
            <span className="ml-2">picto · autonomous-maintainer</span>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: <RiAlertLine />, label: 'Issue opened', color: '#f85149', step: '01' },
              { icon: <RiBrainLine />, label: 'Agent triages', color: '#8dd6ff', step: '02' },
              { icon: <RiCodeSSlashLine />, label: 'Fix in sandbox', color: '#d29922', step: '03' },
              { icon: <RiGitPullRequestLine />, label: 'PR created', color: '#3fb950', step: '04' },
              { icon: <RiCheckDoubleLine />, label: 'You approve', color: '#8dd6ff', step: '05' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-lg p-3 text-center" style={{ background: '#161b22', border: '1px solid rgba(61,68,77,0.5)' }}>
                <div className="text-xl" style={{ color: s.color }}>{s.icon}</div>
                <div className="text-[10px] font-mono text-[#9198a1]">{s.step}</div>
                <div className="text-xs font-medium text-white">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t" style={{ borderColor: 'rgba(61,68,77,0.3)' }}>
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Built on TrueForge harness</h2>
          <p className="text-[#9198a1] max-w-md mx-auto text-sm">The harness does the hard work — sandbox execution, MCP tool access, human checkpoint gates.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <RiRobot2Line className="text-2xl" />,
              color: '#8dd6ff',
              title: 'GitHub MCP tools',
              desc: 'Agent reads your codebase, CONTRIBUTING.md, PR templates, and existing issues — through the real GitHub MCP server, not a mock.',
            },
            {
              icon: <RiCodeSSlashLine className="text-2xl" />,
              color: '#d29922',
              title: 'Daytona sandbox',
              desc: 'All code runs in an isolated sandbox. The host filesystem is never touched. Tested with pnpm test + typecheck before the PR is opened.',
            },
            {
              icon: <RiShieldCheckLine className="text-2xl" />,
              color: '#3fb950',
              title: 'Human checkpoint',
              desc: 'The agent pauses at merge. You see the diff, sandbox test logs, and risk level. One click to approve or reject — nothing merges without you.',
            },
            {
              icon: <RiTimeLine className="text-2xl" />,
              color: '#f85149',
              title: 'Full activity log',
              desc: 'Every triage decision, sandbox run, and PR event surfaces in the dashboard as an accordion timeline. Accordion groups by type; click any row for the full detail.',
            },
            {
              icon: <RiFlashlightLine className="text-2xl" />,
              color: '#8dd6ff',
              title: 'Smart triage',
              desc: 'Supervisor agent reads your templates before deciding. If an issue asks for something that already exists in your PR template, it closes the issue automatically.',
            },
            {
              icon: <RiGitPullRequestLine className="text-2xl" />,
              color: '#3fb950',
              title: 'Qodo code review',
              desc: 'Every PR is reviewed by Qodo before merging. High severity findings are surfaced in the dashboard. You decide what merges.',
            },
          ].map((f, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid rgba(61,68,77,0.7)' }}>
              <div className="mb-3" style={{ color: f.color }}>{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-[#9198a1] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo flow */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-20 border-t" style={{ borderColor: 'rgba(61,68,77,0.3)' }}>
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">See it in action</h2>
          <p className="text-[#9198a1] text-sm">Three minutes. Spam closed in 30s. Bug fixed in 2 minutes. PR with reasoning and test results.</p>
        </div>

        <div className="space-y-4">
          {[
            {
              num: '1',
              title: 'Spam issue → closed in 30 seconds',
              desc: 'Supervisor agent detects spam via content analysis. Closes the issue with a comment and reason. No PR created. No human needed.',
              color: '#f85149',
            },
            {
              num: '2',
              title: 'Bug issue → triaged, fixed, PR in ~2 minutes',
              desc: 'Agent reads CONTRIBUTING.md and existing templates, finds the root cause in the codebase, edits files in a Daytona sandbox, runs tests, and opens a PR.',
              color: '#d29922',
            },
            {
              num: '3',
              title: 'Human checkpoint → approve or reject',
              desc: 'Dashboard shows diff, sandbox test log, and risk level. Harness pauses at merge_pull_request tool. You click Approve & Merge — harness completes.',
              color: '#3fb950',
            },
          ].map((step, i) => (
            <div key={i} className="flex gap-4 rounded-xl p-5" style={{ background: '#0d1117', border: '1px solid rgba(61,68,77,0.7)' }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono" style={{ background: step.color + '20', color: step.color, border: `1px solid ${step.color}40` }}>
                {step.num}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                <p className="text-xs text-[#9198a1] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-20 border-t text-center" style={{ borderColor: 'rgba(61,68,77,0.3)' }}>
        <div className="rounded-2xl p-10" style={{ background: '#0d1117', border: '1px solid rgba(61,68,77,0.7)' }}>
          <div className="flex justify-center mb-5">
            <Logo size="lg" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Give your repo a maintainer</h2>
          <p className="text-[#9198a1] mb-8 text-sm max-w-sm mx-auto leading-relaxed">Connect a GitHub repo in under 2 minutes. Picto handles triage, fixes, and PRs — you stay in control.</p>
          <Button onClick={() => navigate({ to: '/login' })} className="h-10 px-8 text-sm font-semibold">
            Get started free <RiArrowRightLine className="ml-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 sm:px-6 py-8" style={{ borderColor: 'rgba(61,68,77,0.3)' }}>
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9198a1]">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span>Picto · Built for WeMakeDevs × TrueForge Hackathon 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Sahil-Gupta584/picto" target="_blank" rel="noreferrer" className="hover:text-white transition flex items-center gap-1"><SiGithub /> GitHub</a>
            <a href="https://www.wemakedevs.org/hackathons/trueforge" target="_blank" rel="noreferrer" className="hover:text-white transition">Hackathon</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
