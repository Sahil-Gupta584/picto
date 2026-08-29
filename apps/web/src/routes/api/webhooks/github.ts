import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { trueforge } from "#/lib/trueforge";
import { githubService } from "#/lib/github";

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
    const payload = await request.json();
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

      // Fetch GitHub token
      const userSettings = await prisma.maintainerSettings.findFirst();
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

      // 2. Fetch User Settings for GitHub PAT authentication & active model selection
      const userSettings = await prisma.maintainerSettings.findFirst();
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
