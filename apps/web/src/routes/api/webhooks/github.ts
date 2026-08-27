import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "#/db";
import { trueforge } from "#/lib/trueforge";

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
    });

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
