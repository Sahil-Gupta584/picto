import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "#/db";
import { trueforge } from "#/lib/trueforge";
import { githubService } from "#/lib/github";

async function verifyGitHubSignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // permissive in dev when secret not configured
  const sig = request.headers.get("x-hub-signature-256");
  if (!sig) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function isPRReadyComment(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("pr is ready for review") ||
    lower.includes("ready for review") ||
    lower.includes("please review") ||
    lower.includes("ready to merge") ||
    lower.includes("ptal")
  );
}

async function classifyCommentWithAI(params: {
  issueTitle: string;
  issueBody: string;
  commentBody: string;
  commentAuthor: string;
  repoFullName: string;
}): Promise<{ isQuestion: boolean; shouldNotify: boolean; isPRReady: boolean; reason: string }> {
  const isPRReady = isPRReadyComment(params.commentBody);
  const lower = params.commentBody.toLowerCase();
  const hasQuestion = lower.includes("?") || lower.includes("how ") || lower.includes("what ") || lower.includes("why ") || lower.includes("can you") || lower.includes("could you") || lower.includes("help");
  const isQuestion = hasQuestion || lower.includes("clarify") || lower.includes("question");
  const shouldNotify = isQuestion || isPRReady;
  return {
    isQuestion,
    shouldNotify,
    isPRReady,
    reason: isPRReady ? "PR ready for review detected" : isQuestion ? "Question detected" : "No action needed",
  };
}

// Simple spam detection patterns for PRs
const SPAM_PATTERNS = [
  /\b(crypto|bitcoin|ethereum|nft|token|airdrop|free money|earn money|make money)\b/i,
  /\b(buy now|click here|limited time|act now|special offer|discount)\b/i,
  /\b(viagra|cialis|pharmacy|pill|medication)\b/i,
  /\b(porn|xxx|adult|sex)\b/i,
  /\b(hack|crack|warez|pirate)\b/i,
  /https?:\/\/[^\s]+\.(ru|cn|tk|ml|ga|cf)\b/i, // Suspicious TLDs
  /(.)\1{5,}/, // Repeated characters
  /^[a-z]{20,}$/i, // Random long strings
];

function isSpamPR(title: string, body: string): { isSpam: boolean; reason: string } {
  const text = `${title} ${body}`;
  
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { isSpam: true, reason: `Matches spam pattern: ${pattern.source}` };
    }
  }
  
  // Check for very short title with spammy body
  if (title.length < 5 && body.length > 500) {
    return { isSpam: true, reason: 'Suspicious: very short title with long body' };
  }
  
  return { isSpam: false, reason: '' };
}

async function handleGet() {
  return new Response(JSON.stringify({ status: "GitHub Webhook Receiver Ready" }), {
    headers: { "Content-Type": "application/json" }
  });
}

async function handlePost({ request }: { request: Request }) {
  try {
    const rawBody = await request.text();

    if (!await verifyGitHubSignature(request, rawBody)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const event = request.headers.get("x-github-event");

    console.log("📩 GitHub Webhook Received:", {
      event,
      action: payload?.action,
      repo: payload?.repository?.full_name,
      issue: payload?.issue?.number,
      pr: payload?.pull_request?.number,
    });

    // Handle PR events for spam detection
    if (event === "pull_request" && (payload.action === "opened" || payload.action === "reopened")) {
      const pr = payload.pull_request;
      const repo = payload.repository;
      const repoFullName = repo.full_name;

      // Check if repository is connected
      const configuredRepo = await prisma.maintainerRepo.findFirst({
        where: {
          fullName: {
            equals: repoFullName,
            mode: "insensitive",
          },
        },
      });

      if (!configuredRepo) {
        console.warn(`⚠️ Ignored PR webhook: Repository '${repoFullName}' is not connected.`);
        return new Response(
          JSON.stringify({ status: "ignored", message: `Repository not connected.` }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Fetch GitHub token - scoped to the repo owner (fixes cross-user credential leak)
      const userSettings = await prisma.maintainerSettings.findUnique({
        where: { userId: configuredRepo.userId },
      });
      const githubToken = userSettings?.githubToken || process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || undefined;

      // Check for spam
      const spamCheck = isSpamPR(pr.title, pr.body || "");
      if (spamCheck.isSpam) {
        console.log(`🚨 Spam PR detected: #${pr.number} - ${spamCheck.reason}`);
        const comment = `🤖 **Maintainer Update**: This pull request has been identified as spam and has been closed.\n\n**Reason**: ${spamCheck.reason}`;
        await githubService.closePR(repo.owner.login, repo.name, pr.number, comment, githubToken);
        
        return new Response(
          JSON.stringify({ success: true, action: 'spam_closed', pr: pr.number }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log(`ℹ️ PR #${pr.number} passed spam check`);
      return new Response(
        JSON.stringify({ success: true, action: 'passed_spam_check', pr: pr.number }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (event === "issues" && (payload.action === "opened" || payload.action === "reopened")) {
      const issue = payload.issue;
      const repo = payload.repository;
      const repoFullName = repo.full_name;

      // 1. Check if repository is connected in Maintainer database
      const configuredRepo = await prisma.maintainerRepo.findFirst({
        where: {
          fullName: {
            equals: repoFullName,
            mode: "insensitive",
          },
        },
      });

      if (!configuredRepo) {
        console.warn(`⚠️ Ignored webhook: Repository '${repoFullName}' is not connected in Maintainer database.`);
        return new Response(
          JSON.stringify({
            status: "ignored",
            message: `Repository '${repoFullName}' is not connected in Maintainer app. Please add it in the dashboard.`,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 2. Fetch User Settings - scoped to the repo owner (fixes cross-user credential leak)
      const userSettings = await prisma.maintainerSettings.findUnique({
        where: { userId: configuredRepo.userId },
      });
      const githubToken = userSettings?.githubToken || process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || undefined;

      console.log(`🚀 Matched connected repo '${repoFullName}'! Initiating AI Orchestrator for Issue #${issue.number}...`);

      // 3. Delegate to Single-Prompt AI Maintainer Orchestrator asynchronously in background
      trueforge.runAutonomousMaintainerOrchestrator({
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        repoFullName: configuredRepo.fullName,
        title: issue.title,
        body: issue.body || "",
        author: issue.user?.login || "user",
        githubToken,
        modelName: userSettings?.selectedModel,
      }).catch(err => console.error("❌ Error running AI Maintainer Orchestrator in background:", err));

      return new Response(
        JSON.stringify({
          success: true,
          action: payload.action,
          matchedRepo: configuredRepo.fullName,
          message: "AI Maintainer Orchestrator initiated in background.",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle issue_comment events for Needs Attention inbox
    if (event === "issue_comment" && payload.action === "created") {
      const repoFullName = payload.repository.full_name as string;
      // For issue_comment, GitHub always sends payload.issue regardless of issue or PR.
      // Detect if it's a PR by presence of payload.issue.pull_request.
      const isPRContext = !!payload.issue?.pull_request;
      const issueNumber: number | null = isPRContext ? null : (payload.issue?.number ?? null);
      const prNumber: number | null = isPRContext ? (payload.issue?.number ?? null) : null;
      const comment = payload.comment;
      const commentAuthor = comment?.user?.login || "unknown";
      const commentBody: string = comment?.body || "";
      const githubCommentId = String(comment?.id || `${Date.now()}`);

      const configuredRepo = await prisma.maintainerRepo.findFirst({
        where: { fullName: { equals: repoFullName, mode: "insensitive" } },
      });

      if (!configuredRepo) {
        return new Response(JSON.stringify({ status: "ignored", message: "Repo not connected" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Dedupe
      const existing = await prisma.maintainerComment.findUnique({ where: { githubCommentId } });
      if (existing) {
        return new Response(JSON.stringify({ status: "duplicate", id: existing.id }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const isFromMaintainer = commentAuthor.toLowerCase() === payload.repository.owner.login.toLowerCase();

      // If from maintainer, skip entirely - no store, no notify
      if (isFromMaintainer) {
        return new Response(JSON.stringify({ status: "ignored", reason: "maintainer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // ── @picto conversation trigger ──────────────────────────────────────
      // If the comment starts with @picto (trimmed), resume the issue's agent session
      const isPictoMention = commentBody.trim().toLowerCase().startsWith('@picto');
      if (isPictoMention) {
        const contextNumber = issueNumber ?? prNumber;
        const workflow = contextNumber
          ? await prisma.maintainerWorkflow.findFirst({
              where: {
                repoId: configuredRepo.id,
                ...(issueNumber ? { issueNumber } : { prNumber: prNumber! }),
              },
              include: { repo: true },
            })
          : null;

        if (workflow?.trueforgeSessionId) {
          const userSettings = await prisma.maintainerSettings.findUnique({
            where: { userId: configuredRepo.userId },
          });
          const githubToken = userSettings?.githubToken || process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || undefined;
          const [owner, repoName] = repoFullName.split('/');

          // Post acknowledgement comment
          await githubService.addIssueComment(
            owner, repoName, contextNumber!,
            `🤖 **@${commentAuthor}** - got it, I'm on it...`,
            githubToken
          );

          // Strip the @picto prefix and send the rest as a turn
          const userPrompt = commentBody.replace(/^@picto\s*/i, '').trim() ||
            `The user @${commentAuthor} mentioned you. Please help with the issue.`;

          const turnPrompt = `The user @${commentAuthor} is asking you via a GitHub comment:\n\n> ${userPrompt}\n\nRespond helpfully and concisely. If you need to make code changes, do so in the sandbox. Post your response as a GitHub comment on issue #${contextNumber}.`;

          // Fire and forget - don't block the webhook response
          trueforge.streamTurnWithAutoResume(workflow.trueforgeSessionId, turnPrompt)
            .then(async ({ accumulatedText }) => {
              if (accumulatedText) {
                await githubService.addIssueComment(
                  owner, repoName, contextNumber!,
                  `🤖 **Picto:** ${accumulatedText}`,
                  githubToken
                );
              }
            })
            .catch((err: any) => console.error('❌ @picto turn error:', err?.message));

          return new Response(JSON.stringify({ success: true, action: 'picto_mention_triggered' }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } else {
          // No active session - notify user
          const contextN = contextNumber;
          if (contextN) {
            const userSettings = await prisma.maintainerSettings.findUnique({
              where: { userId: configuredRepo.userId },
            });
            const githubToken = userSettings?.githubToken || process.env.GITHUB_PAT || undefined;
            const [owner, repoName] = repoFullName.split('/');
            await githubService.addIssueComment(
              owner, repoName, contextN,
              `🤖 **@${commentAuthor}** - I don't have an active session for this issue yet. Open a new issue or reopen this one to start an investigation.`,
              githubToken
            );
          }
          return new Response(JSON.stringify({ status: "no_session", reason: "no active workflow session" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
      }
      // ────────────────────────────────────────────────────────────────────

      // Classify comment via AI/heuristic
      const issue = payload.issue || payload.pull_request;
      const classification = await classifyCommentWithAI({
        issueTitle: issue?.title || "",
        issueBody: issue?.body || "",
        commentBody,
        commentAuthor,
        repoFullName,
      });

      // Try to discover the opposite number from existing workflow rows
      let resolvedPrNumber = prNumber;
      let resolvedIssueNumber = issueNumber;
      if (issueNumber && !prNumber) {
        const workflow = await prisma.maintainerWorkflow.findFirst({
          where: { repoId: configuredRepo.id, issueNumber },
          select: { prNumber: true },
        });
        resolvedPrNumber = workflow?.prNumber ?? null;
      } else if (prNumber && !issueNumber) {
        const workflow = await prisma.maintainerWorkflow.findFirst({
          where: { repoId: configuredRepo.id, prNumber },
          select: { issueNumber: true },
        });
        resolvedIssueNumber = workflow?.issueNumber ?? null;
      }

      await prisma.maintainerComment.create({
        data: {
          repoId: configuredRepo.id,
          issueNumber: resolvedIssueNumber,
          prNumber: resolvedPrNumber,
          githubCommentId,
          author: commentAuthor,
          body: commentBody,
          isPRReady: classification.isPRReady,
          shouldNotify: classification.shouldNotify,
          notified: false,
          aiReasoning: classification.reason,
        },
      });

      return new Response(JSON.stringify({ success: true, shouldNotify: classification.shouldNotify, reason: classification.reason }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: `Event '${event}' action '${payload.action}' ignored` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/webhooks/github")({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
