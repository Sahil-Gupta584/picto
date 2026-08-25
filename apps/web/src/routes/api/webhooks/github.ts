import { createAPIFileRoute } from "@tanstack/react-start/api";
import { maintainerStore } from "../../../lib/maintainer-store";
import { trueforge } from "../../../lib/trueforge";

export const Route = createAPIFileRoute("/api/webhooks/github")({
  GET: async () => {
    return new Response(JSON.stringify({ status: "GitHub Webhook Endpoint Ready" }), {
      headers: { "Content-Type": "application/json" }
    });
  },
  POST: async ({ request }) => {
    try {
      const payload = await request.json();
      const event = request.headers.get("x-github-event");

      if (event === "issues" && payload.action === "opened") {
        const issue = payload.issue;
        const repo = payload.repository;

        const newIssue = {
          id: `iss-${Date.now()}`,
          githubId: issue.id,
          number: issue.number,
          repoFullName: repo.full_name,
          title: issue.title,
          body: issue.body || "",
          state: "open" as const,
          author: issue.user.login,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          commentsCount: 0,
          triaged: true,
          suitableForAutoFix: true,
          status: "investigating" as const,
          comments: []
        };

        maintainerStore.getIssues().push(newIssue);

        const session = await trueforge.createIssueWorkflowSession(issue.html_url, repo.full_name);
        if (session?.id) {
          await trueforge.startInvestigationTurn(session.id, {
            issueNumber: issue.number,
            repo: repo.full_name,
            title: issue.title,
            body: issue.body || '',
          });
        }

        return new Response(JSON.stringify({ success: true, sessionId: session?.id }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ message: "Ignored event action" }), { status: 200 });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
});
