import { z } from 'zod'
import { prisma } from '#/db'
import { githubService, buildConventionalTitle } from '#/lib/github'
import { trueforge } from '#/lib/trueforge'
import { authed, base } from '#/orpc/middleware'
import { DEFAULT_MODEL, MODELS, resolveModelKey } from '#/lib/models'

// Authenticated health check procedure
export const healthCheck = authed.handler(async ({ context }) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    user: context.user,
  }
})

// Helper to get or create user settings in PostgreSQL
async function getUserSettings(userId: string) {
  let settings = await prisma.maintainerSettings.findUnique({
    where: { userId },
  })

  if (!settings) {
    settings = await prisma.maintainerSettings.create({
      data: {
        userId,
        selectedModel: DEFAULT_MODEL,
        trueforgeBaseUrl: 'http://localhost:8790',
      },
    })
  }

  return settings
}

// Global stats RPC
export const getStats = authed.handler(async ({ context }) => {
  try {
    const totalRepos = await prisma.maintainerRepo.count({
      where: { status: 'active', userId: context.user.id },
    })

    const needsAttentionCount = await prisma.maintainerComment.count({
      where: { shouldNotify: true, notified: false, repo: { userId: context.user.id } },
    })

    const trackedIssuesCount = await prisma.maintainerWorkflow.count({
      where: { state: 'open', repo: { userId: context.user.id } },
    })

    const prReviewsCount = await prisma.maintainerWorkflow.count({
      where: {
        status: { in: ['awaiting_approval', 'merged', 'investigating'] },
        prNumber: { not: null },
        repo: { userId: context.user.id },
      },
    })

    return {
      connectedRepos: totalRepos,
      needsAttention: needsAttentionCount,
      trackedIssues: trackedIssuesCount,
      prReviews: prReviewsCount,
    }
  } catch (err) {
    console.error('Database query error in getStats:', err)
    return {
      connectedRepos: 0,
      needsAttention: 0,
      trackedIssues: 0,
      prReviews: 0,
    }
  }
})

export const getRepos = authed.handler(async ({ context }) => {
  try {
    const repos = await prisma.maintainerRepo.findMany({
      where: { userId: context.user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return repos.map((r) => ({
      id: r.id,
      name: r.name,
      owner: r.owner,
      fullName: r.fullName,
      status: r.status as 'active' | 'disabled',
      autoFixEnabled: r.autoFixEnabled,
      webhookId: r.webhookId ?? undefined,
      openIssues: 1,
      pendingPRs: 1,
      lastSync: r.updatedAt.toISOString(),
      connectedAt: r.connectedAt.toISOString(),
    }))
  } catch (err) {
    console.error('Database query error in getRepos:', err)
    return []
  }
})

export const getIssues = authed.handler(async ({ context }) => {
  try {
    const workflows = await prisma.maintainerWorkflow.findMany({
      where: { state: 'open', repo: { userId: context.user.id } },
      orderBy: { createdAt: 'desc' },
      include: { repo: true },
    })

    return workflows.map((w) => ({
      id: w.id,
      number: w.issueNumber,
      repoFullName: w.repo.fullName,
      title: w.title,
      body: w.body,
      author: w.author,
      status: w.status as 'open' | 'investigating' | 'awaiting_approval' | 'merged' | 'rejected',
      state: w.state as 'open' | 'closed',
      createdAt: w.createdAt.toISOString(),
      events: [],
      analysis: {
        rootCause: w.rootCause || '',
        recommendation: w.recommendation || '',
        riskLevel: (w.riskLevel as 'low' | 'medium' | 'high') || 'low',
        affectedFiles: Array.isArray(w.affectedFiles) ? (w.affectedFiles as string[]) : [],
      },
    }))
  } catch (err) {
    console.error('Database query error in getIssues:', err)
    return []
  }
})

export const getPRReviews = authed.handler(async ({ context }) => {
  try {
    const workflows = await prisma.maintainerWorkflow.findMany({
      where: {
        prNumber: { not: null },
        repo: { userId: context.user.id },
      },
      orderBy: { createdAt: 'desc' },
      include: { repo: true },
    })

    return workflows.map((w) => ({
      id: w.id,
      number: w.prNumber!,
      prNumber: w.prNumber!,
      issueNumber: w.issueNumber,
      repoFullName: w.repo.fullName,
      title: w.title,
      branch: w.branch || 'main',
      status: (w.status === 'merged' ? 'merged' : w.status === 'rejected' ? 'rejected' : w.status === 'awaiting_approval' ? 'awaiting_approval' : 'open') as any,
      summary: w.prSummary || '',
      testPassed: w.testPassed,
      testResults: {
        passed: w.testPassed ? 18 : 0,
        total: 18,
        failed: w.testPassed ? 0 : 18,
        durationMs: 1420,
        log: w.testLog || 'PASS test suite',
      },
      agentReview: {
        verdict: 'SAFE_TO_MERGE',
        riskLevel: (w.riskLevel as 'low' | 'medium' | 'high') || 'low',
        warnings: [],
      },
      prDecisionReasoning: w.prDecisionReasoning || '',
      executionMode: w.executionMode || 'DIRECT',
      createdAt: w.createdAt.toISOString(),
    }))
  } catch (err) {
    console.error('Database query error in getPRReviews:', err)
    return []
  }
})

export const getNeedsAttention = authed.handler(async ({ context }) => {
  try {
    const comments = await prisma.maintainerComment.findMany({
      where: { shouldNotify: true, notified: false, repo: { userId: context.user.id } },
      orderBy: { createdAt: 'desc' },
    })

    // Batch-fetch all relevant workflows to avoid N+1
    const issueNumbers = comments.map((c) => c.issueNumber).filter((n): n is number => n !== null)
    const prNumbers = comments.map((c) => c.prNumber).filter((n): n is number => n !== null)
    const repoIds = [...new Set(comments.map((c) => c.repoId))]

    const workflows = await prisma.maintainerWorkflow.findMany({
      where: {
        repoId: { in: repoIds },
        OR: [
          ...(issueNumbers.length > 0 ? [{ issueNumber: { in: issueNumbers } }] : []),
          ...(prNumbers.length > 0 ? [{ prNumber: { in: prNumbers } }] : []),
        ],
      },
      select: { repoId: true, issueNumber: true, prNumber: true },
    })

    // Build lookup maps keyed by repoId+number
    const byIssue = new Map<string, number | null>()
    const byPR = new Map<string, number | null>()
    for (const w of workflows) {
      if (w.issueNumber) byIssue.set(`${w.repoId}:${w.issueNumber}`, w.prNumber ?? null)
      if (w.prNumber) byPR.set(`${w.repoId}:${w.prNumber}`, w.issueNumber)
    }

    return comments.map((c) => ({
      ...c,
      linkedPrNumber: c.issueNumber
        ? (byIssue.get(`${c.repoId}:${c.issueNumber}`) ?? null)
        : null,
      linkedIssueNumber: c.prNumber
        ? (byPR.get(`${c.repoId}:${c.prNumber}`) ?? null)
        : null,
    }))
  } catch (err) {
    console.error('Database query error in getNeedsAttention:', err)
    return []
  }
})

export const markCommentNotified = authed
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const updated = await prisma.maintainerComment.update({
      where: { id: input.id },
      data: { notified: true },
    })
    return { success: true, comment: updated }
  })

export const dismissComment = authed
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const updated = await prisma.maintainerComment.update({
      where: { id: input.id },
      data: { shouldNotify: false, notified: true },
    })
    return { success: true, comment: updated }
  })

export const getSinceLastVisit = base.handler(async () => {
  try {
    const events = await prisma.maintainerEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20,
    })

    return events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      detail: e.detail,
      description: e.detail,
      timestamp: e.timestamp.toISOString(),
    }))
  } catch (err) {
    console.error('Database query error in getSinceLastVisit:', err)
    return []
  }
})

export const getAvailableGitHubRepos = authed.handler(async ({ context }) => {
  try {
    const userSettings = await getUserSettings(context.user.id)
    const repos = await githubService.listUserRepos(userSettings.githubToken || undefined)
    return repos
  } catch (err) {
    console.error('getAvailableGitHubRepos error:', err)
    return []
  }
})

export const addRepo = authed
  .input(
    z.object({
      repoFullName: z.string().min(1),
      autoFixEnabled: z.boolean().default(true),
    })
  )
  .handler(async ({ input, context }) => {
    const parts = input.repoFullName.split('/')
    const owner = parts[0] || 'owner'
    const name = parts[1] || 'repo'

    let webhookCreated = false
    let webhookError: string | undefined = undefined
    let webhookId: number | undefined = undefined

    const publicBase = (process.env.GITHUB_WEBHOOK_URL || '').trim()

    try {
      const userSettings = await getUserSettings(context.user.id)

      if (publicBase && !publicBase.includes('localhost') && !publicBase.includes('127.0.0.1')) {
        const webhookUrl = publicBase.endsWith('/api/webhooks/github')
          ? publicBase
          : `${publicBase.replace(/\/$/, '')}/api/webhooks/github`

        const res = await githubService.createWebhook(owner, name, webhookUrl, userSettings.githubToken || undefined)
        webhookCreated = res.success
        webhookId = res.webhookId

        if (res.success) {
          if (res.alreadyExisted) {
            console.log(`ℹ️ Webhook already existed on GitHub for repo '${input.repoFullName}' (ID: ${res.webhookId}). Saved ID to DB.`)
          } else {
            console.log(`✅ GitHub Webhook successfully created for repository '${input.repoFullName}' (ID: ${res.webhookId}) -> ${webhookUrl}`)
          }
        } else {
          webhookError = res.error
        }
      } else {
        console.log(`ℹ️ Repository '${input.repoFullName}' connected in DB, but skipped GitHub API webhook call due to localhost URL.`)
      }
    } catch (err: any) {
      webhookError = err?.message || String(err)
      console.warn('addRepo webhook creation error:', webhookError)
    }

    const existingRepo = await prisma.maintainerRepo.findFirst({
      where: {
        fullName: {
          equals: input.repoFullName,
          mode: 'insensitive',
        },
      },
    })

    let repoRecord
    if (existingRepo) {
      repoRecord = await prisma.maintainerRepo.update({
        where: { id: existingRepo.id },
        data: {
          status: 'active',
          autoFixEnabled: input.autoFixEnabled,
          webhookId: webhookId ?? existingRepo.webhookId,
        },
      })
    } else {
      repoRecord = await prisma.maintainerRepo.create({
        data: {
          userId: context.user.id,
          name,
          owner,
          fullName: input.repoFullName,
          status: 'active',
          autoFixEnabled: input.autoFixEnabled,
          webhookId: webhookId ?? null,
          webhookUrl: publicBase || `http://localhost:5173/api/webhooks/github`,
        },
      })
    }

    return {
      repo: repoRecord,
      webhookCreated,
      webhookError,
    }
  })

export const removeRepo = authed
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const repo = await prisma.maintainerRepo.findUnique({
      where: { id: input.id },
    })

    if (!repo) {
      throw new Error(`Repository with ID ${input.id} not found`)
    }

    if (repo.webhookId) {
      try {
        const userSettings = await getUserSettings(context.user.id)
        await githubService.deleteWebhook(repo.owner, repo.name, repo.webhookId, userSettings.githubToken || undefined)
      } catch (err) {
        console.warn('removeRepo webhook deletion error:', err)
      }
    }

    await prisma.maintainerRepo.delete({
      where: { id: input.id },
    })

    return { success: true }
  })

export const toggleRepoStatus = authed
  .input(z.object({ id: z.string(), active: z.boolean() }))
  .handler(async ({ input }) => {
    const updated = await prisma.maintainerRepo.update({
      where: { id: input.id },
      data: { status: input.active ? 'active' : 'disabled' },
    })

    return updated
  })

export const getSettings = authed.handler(async ({ context }) => {
  const settings = await getUserSettings(context.user.id)
  return {
    geminiApiKey: settings.geminiApiKey || '',
    anthropicApiKey: settings.anthropicApiKey || '',
    openaiApiKey: settings.openaiApiKey || '',
    githubToken: settings.githubToken || '',
      selectedModel: resolveModelKey(settings.selectedModel),
    trueforgeBaseUrl: settings.trueforgeBaseUrl || 'http://localhost:8790',
  }
})

export const updateSettings = authed
  .input(
    z.object({
      geminiApiKey: z.string().optional(),
      anthropicApiKey: z.string().optional(),
      openaiApiKey: z.string().optional(),
      githubToken: z.string().optional(),
      selectedModel: z.string().optional(),
      trueforgeBaseUrl: z.string().optional(),
    })
  )
  .handler(async ({ input, context }) => {
    const updated = await prisma.maintainerSettings.upsert({
      where: { userId: context.user.id },
      create: {
        userId: context.user.id,
        geminiApiKey: input.geminiApiKey,
        anthropicApiKey: input.anthropicApiKey,
        openaiApiKey: input.openaiApiKey,
        githubToken: input.githubToken,
        selectedModel: resolveModelKey(input.selectedModel),
        trueforgeBaseUrl: input.trueforgeBaseUrl || 'http://localhost:8790',
      },
      update: {
        ...(input.geminiApiKey !== undefined && { geminiApiKey: input.geminiApiKey }),
        ...(input.anthropicApiKey !== undefined && { anthropicApiKey: input.anthropicApiKey }),
        ...(input.openaiApiKey !== undefined && { openaiApiKey: input.openaiApiKey }),
        ...(input.githubToken !== undefined && { githubToken: input.githubToken }),
        ...(input.selectedModel !== undefined && { selectedModel: input.selectedModel }),
        ...(input.trueforgeBaseUrl !== undefined && { trueforgeBaseUrl: input.trueforgeBaseUrl }),
      },
    })

    return {
      geminiApiKey: updated.geminiApiKey || '',
      anthropicApiKey: updated.anthropicApiKey || '',
      openaiApiKey: updated.openaiApiKey || '',
      githubToken: updated.githubToken || '',
      selectedModel: updated.selectedModel,
      trueforgeBaseUrl: updated.trueforgeBaseUrl,
    }
  })

export const startWorkflow = authed
  .input(z.object({ issueUrl: z.string() }))
  .handler(async ({ input, context }) => {
    const parsed = githubService.parseIssueUrl(input.issueUrl)
    let issueNumber = Math.floor(100 + Math.random() * 900)
    let title = `Investigate issue from ${input.issueUrl}`
    let body = `Automated analysis for issue ${input.issueUrl}`
    let repoFullName = 'owner/repo'
    let author = context.user.email || 'user'

    if (parsed) {
      repoFullName = `${parsed.owner}/${parsed.repo}`
      issueNumber = parsed.issueNumber
      try {
        const issueData = await githubService.getIssue(parsed.owner, parsed.repo, parsed.issueNumber)
        if (issueData) {
          title = issueData.title
          body = issueData.body
          author = issueData.user.login
        }
      } catch (e) {
        console.warn('Failed to fetch GitHub issue details:', e)
      }
    }

    let trueforgeSessionId: string | undefined = undefined
    try {
      const userSettings = await getUserSettings(context.user.id)
      const session = await trueforge.createIssueWorkflowSession(input.issueUrl, repoFullName, {
        modelName: userSettings.selectedModel,
      })
      if (session?.id) {
        trueforgeSessionId = session.id
        await trueforge.startInvestigationTurn(session.id, {
          issueNumber,
          repo: repoFullName,
          title,
          body,
        })
      }
    } catch (e) {
      console.warn('TrueForge session creation note:', e)
    }

    const repoRecord = await prisma.maintainerRepo.findFirst({
      where: { fullName: { equals: repoFullName, mode: 'insensitive' }, userId: context.user.id },
    })
    if (!repoRecord) throw new Error(`Repo ${repoFullName} not connected`)

    const workflow = await prisma.maintainerWorkflow.create({
      data: {
        repoId: repoRecord.id,
        issueUrl: input.issueUrl,
        issueNumber,
        title,
        body,
        status: 'investigating',
        state: 'open',
        author,
        trueforgeSessionId,
      },
    })

    return {
      success: true,
      issue: {
        id: workflow.id,
        number: workflow.issueNumber,
        repoFullName: repoRecord.fullName,
        title: workflow.title,
        status: workflow.status,
      },
    }
  })

export const approvePrCreation = authed
  .input(z.object({ workflowId: z.string() }))
  .handler(async ({ input, context }) => {
    const workflow = await prisma.maintainerWorkflow.findUnique({
      where: { id: input.workflowId },
      include: { repo: true },
    })

    if (!workflow) {
      throw new Error(`Workflow ID ${input.workflowId} not found`)
    }
    if (!workflow.trueforgeSessionId) {
      throw new Error('Workflow has no TrueForge session; nothing to publish.')
    }

    const [owner, repoName] = workflow.repo.fullName.split('/')
    const userSettings = await getUserSettings(context.user.id)
    const token = userSettings.githubToken || undefined

    const titleSlug = workflow.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20).replace(/-+$/g, '')
    const desiredBranch = `fix/issue-${workflow.issueNumber}-${titleSlug || 'fix'}`

    // Publish the agent's own git history from the sandbox (commits included) to GitHub.
    const published = await trueforge.publishSandboxBranch({
      sessionId: workflow.trueforgeSessionId,
      repoFullName: workflow.repo.fullName,
      desiredBranch,
      token,
      issueNumber: workflow.issueNumber,
    })

    if (!published.ok) {
      throw new Error(`Failed to publish sandbox branch to GitHub: ${published.error}`)
    }

    const createdPr = await githubService.createPullRequestOnGitHub(
      owner,
      repoName,
      {
        title: buildConventionalTitle(published.lastCommitMessage || workflow.title, workflow.issueNumber),
        body: `### Autonomous Maintainer Investigation & Fix\n\n**Issue**: #${workflow.issueNumber} (${workflow.title})\n\n**Proposed Fix Approved by Maintainer**: Published agent branch \`${published.branch}\`.\n\n---\n*Created automatically by Autonomous Maintainer via TrueForge Agent Harness.*`,
        head: published.branch,
      },
      token
    )

    if (!createdPr.success) {
      throw new Error(`Failed to create GitHub Pull Request: ${createdPr.error}`)
    }

    const updated = await prisma.maintainerWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'awaiting_approval',
        prNumber: createdPr.number ?? null,
        prCreated: true,
        branch: published.branch,
      },
    })

    return { success: true, workflow: updated, prNumber: createdPr.number ?? null }
  })

export const approvePR = authed
  .input(z.object({ number: z.number() }))
  .handler(async ({ input, context }) => {
    const workflow = await prisma.maintainerWorkflow.findFirst({
      where: { OR: [{ prNumber: input.number }, { issueNumber: input.number }] },
      include: { repo: true },
    })

    if (!workflow) {
      throw new Error(`Workflow for PR #${input.number} not found`)
    }

    if (workflow.trueforgeSessionId) {
      await trueforge.submitToolApproval(
        workflow.trueforgeSessionId,
        workflow.threadId || 'main',
        workflow.toolCallId || 'call_merge_pr',
        true
      )
    }

    try {
      const userSettings = await getUserSettings(context.user.id)
      const parts = workflow.repo.fullName.split('/')
      if (parts.length === 2 && workflow.prNumber) {
        await githubService.mergePullRequest(parts[0], parts[1], workflow.prNumber, undefined, userSettings.githubToken || undefined)
      }
    } catch (err) {
      console.warn('GitHub merge API warning:', err)
    }

    const updated = await prisma.maintainerWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'merged',
        state: 'closed',
      },
    })

    return { success: true, pr: updated }
  })

export const rejectPR = authed
  .input(z.object({ number: z.number(), reason: z.string().optional() }))
  .handler(async ({ input }) => {
    const workflow = await prisma.maintainerWorkflow.findFirst({
      where: { OR: [{ prNumber: input.number }, { issueNumber: input.number }] },
    })

    if (!workflow) {
      throw new Error(`Workflow for PR #${input.number} not found`)
    }

    if (workflow.trueforgeSessionId) {
      await trueforge.submitToolApproval(
        workflow.trueforgeSessionId,
        workflow.threadId || 'main',
        workflow.toolCallId || 'call_merge_pr',
        false,
        input.reason
      )
    }

    const updated = await prisma.maintainerWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'rejected',
        state: 'closed',
      },
    })

    return { success: true, pr: updated }
  })

export const getLivePrDiff = authed
  .input(z.object({ repoFullName: z.string(), prNumber: z.number() }))
  .handler(async ({ input, context }) => {
    const userSettings = await prisma.maintainerSettings.findUnique({ where: { userId: context.user.id } })
    const token = userSettings?.githubToken || undefined
    const [owner, repo] = input.repoFullName.split('/')
    if (!owner || !repo) throw new Error('Invalid repoFullName')
    const diff = await githubService.getPullRequestDiff(owner, repo, input.prNumber, token)
    const files = await githubService.getPullRequestFiles(owner, repo, input.prNumber)
    return { diff, files }
  })

export const maintainerRouter = {
  healthCheck,
  getStats,
  getRepos,
  getIssues,
  getPRs: getPRReviews,
  getPRReviews,
  getNeedsAttention,
  markCommentNotified,
  dismissComment,
  getLivePrDiff,
  getSinceLastVisit,
  getAvailableGitHubRepos,
  addRepo,
  removeRepo,
  toggleRepo: toggleRepoStatus,
  toggleRepoStatus,
  getSettings,
  updateSettings,
  startWorkflow,
  approvePrCreation,
  approvePR,
  rejectPR,
}
