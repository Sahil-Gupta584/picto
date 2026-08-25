import { os } from "@orpc/server";
import { z } from "zod";
import { maintainerStore } from "../lib/maintainer-store";
import { trueforge } from "../lib/trueforge";
import { githubService } from "../lib/github";

export const getIssues = os.handler(async () => {
  return maintainerStore.getIssues();
});

export const getIssue = os
  .input(z.object({ number: z.number() }))
  .handler(async ({ input }) => {
    const issue = maintainerStore.getIssue(input.number);
    if (!issue) throw new Error("Issue not found");
    return issue;
  });

export const getPRs = os.handler(async () => {
  return maintainerStore.getPRs();
});

export const getPR = os
  .input(z.object({ number: z.number() }))
  .handler(async ({ input }) => {
    const pr = maintainerStore.getPR(input.number);
    if (!pr) throw new Error("PR not found");
    return pr;
  });

export const getNeedsAttention = os.handler(async () => {
  return maintainerStore.getNeedsAttention();
});

export const getSinceLastVisit = os.handler(async () => {
  return maintainerStore.getSinceLastVisit();
});

export const getSettings = os.handler(async () => {
  return maintainerStore.getSettings();
});

export const updateSettings = os
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
  .handler(async ({ input }) => {
    return maintainerStore.updateSettings(input);
  });

export const startWorkflow = os
  .input(z.object({ issueUrl: z.string() }))
  .handler(async ({ input }) => {
    const parsed = githubService.parseIssueUrl(input.issueUrl);
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
        // Fallback to URL details if GH API call fails or unauthenticated
      }
    }

    const issue = maintainerStore.startIssueWorkflow(input.issueUrl, issueData);

    // Call TrueForge SDK in background
    try {
      const session = await trueforge.createIssueWorkflowSession(input.issueUrl, issueData?.repoFullName || 'owner/repo');
      if (session?.id) {
        await trueforge.startInvestigationTurn(session.id, {
          issueNumber: issue.number,
          repo: issue.repoFullName,
          title: issue.title,
          body: issue.body,
        });
      }
    } catch (err) {
      console.warn('TrueForge workflow start warning:', err);
    }

    return { success: true, issue };
  });

export const approvePR = os
  .input(z.object({ number: z.number() }))
  .handler(async ({ input }) => {
    const pr = maintainerStore.getPR(input.number);
    if (!pr) throw new Error("PR not found");

    if (pr.trueforgeSessionId) {
      await trueforge.submitToolApproval(
        pr.trueforgeSessionId,
        pr.threadId || 'main',
        pr.toolCallId || 'call_merge_pr',
        true
      );
    }

    // Try executing actual GitHub merge if available
    try {
      const parts = pr.repoFullName.split('/');
      if (parts.length === 2) {
        await githubService.mergePullRequest(parts[0], parts[1], pr.number);
      }
    } catch (err) {
      console.warn('GitHub merge API call note:', err);
    }

    const updatedPr = maintainerStore.approvePR(input.number);
    return { success: true, pr: updatedPr };
  });

export const rejectPR = os
  .input(z.object({ number: z.number(), reason: z.string().optional() }))
  .handler(async ({ input }) => {
    const pr = maintainerStore.getPR(input.number);
    if (!pr) throw new Error("PR not found");

    if (pr.trueforgeSessionId) {
      await trueforge.submitToolApproval(
        pr.trueforgeSessionId,
        pr.threadId || 'main',
        pr.toolCallId || 'call_merge_pr',
        false,
        input.reason
      );
    }

    const updatedPr = maintainerStore.rejectPR(input.number, input.reason);
    return { success: true, pr: updatedPr };
  });

export const maintainerRouter = {
  getIssues,
  getIssue,
  getPRs,
  getPR,
  getNeedsAttention,
  getSinceLastVisit,
  getSettings,
  updateSettings,
  startWorkflow,
  approvePR,
  rejectPR,
};
