/**
 * Discord bot service for Picto.
 * Listens for @picto mentions in any channel and responds using:
 * 1. GitHub API (list/create/view issues & PRs)
 * 2. TrueForge agent session (if a workflow session exists for the repo/issue)
 *
 * Setup: Set DISCORD_BOT_TOKEN in env. The bot must be invited to the server
 * with MESSAGE_CONTENT intent enabled.
 *
 * Install URL (replace CLIENT_ID):
 * https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=2048&scope=bot
 */

import { Client, Events, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import { prisma } from '#/db';
import { githubService } from '#/lib/github';
import { trueforge } from '#/lib/trueforge';

const MENTION_PREFIX = /^@picto\s*/i;

// ── Command parsing ──────────────────────────────────────────────────────────

type ParsedCommand =
  | { action: 'list_issues'; repo: string }
  | { action: 'list_prs'; repo: string }
  | { action: 'view_issue'; repo: string; number: number }
  | { action: 'view_pr'; repo: string; number: number }
  | { action: 'create_issue'; repo: string; title: string; body: string }
  | { action: 'ask'; repo: string | null; question: string };

function parseCommand(text: string): ParsedCommand {
  const t = text.trim();

  // list issues in owner/repo
  const listIssues = t.match(/^list issues(?:\s+(?:in|for|on))?\s+([\w.-]+\/[\w.-]+)/i);
  if (listIssues) return { action: 'list_issues', repo: listIssues[1] };

  // list prs in owner/repo
  const listPRs = t.match(/^list\s+(?:prs?|pull\s*requests?)(?:\s+(?:in|for|on))?\s+([\w.-]+\/[\w.-]+)/i);
  if (listPRs) return { action: 'list_prs', repo: listPRs[1] };

  // view issue #N in owner/repo  OR  show issue owner/repo#N
  const viewIssue = t.match(/^(?:view|show|get)\s+issue\s+#?(\d+)(?:\s+(?:in|on)\s+([\w.-]+\/[\w.-]+))?/i)
    || t.match(/^issue\s+([\w.-]+\/[\w.-]+)?#(\d+)/i);
  if (viewIssue) {
    const num = parseInt(viewIssue[1] || viewIssue[2], 10);
    const repo = viewIssue[2] || viewIssue[1] || '';
    if (!isNaN(num)) return { action: 'view_issue', repo, number: num };
  }

  // view pr #N in owner/repo
  const viewPR = t.match(/^(?:view|show|get)\s+(?:pr|pull\s*request)\s+#?(\d+)(?:\s+(?:in|on)\s+([\w.-]+\/[\w.-]+))?/i);
  if (viewPR) {
    const num = parseInt(viewPR[1], 10);
    const repo = viewPR[2] || '';
    if (!isNaN(num)) return { action: 'view_pr', repo, number: num };
  }

  // create issue in owner/repo: <title> | <body>
  const createIssue = t.match(/^create\s+issue(?:\s+(?:in|on)\s+([\w.-]+\/[\w.-]+))?[:\s]+(.+?)(?:\s*\|\s*(.+))?$/i);
  if (createIssue) {
    return {
      action: 'create_issue',
      repo: createIssue[1] || '',
      title: createIssue[2].trim(),
      body: createIssue[3]?.trim() || '',
    };
  }

  // fallback - treat as a free-form question
  // try to extract repo if mentioned
  const repoMatch = t.match(/([\w.-]+\/[\w.-]+)/);
  return { action: 'ask', repo: repoMatch?.[1] ?? null, question: t };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function getTokenForRepo(repoFullName: string): Promise<string | undefined> {
  const repo = await prisma.maintainerRepo.findFirst({
    where: { fullName: { equals: repoFullName, mode: 'insensitive' } },
  });
  if (!repo) return undefined;
  const settings = await prisma.maintainerSettings.findUnique({ where: { userId: repo.userId } });
  return settings?.githubToken || undefined;
}

async function handleListIssues(repo: string, token?: string): Promise<string> {
  try {
    const [owner, repoName] = repo.split('/');
    const octokit = (githubService as any).getOctokit(token);
    const { data } = await octokit.rest.issues.listForRepo({
      owner, repo: repoName, state: 'open', per_page: 10,
    });
    if (!data.length) return `No open issues in **${repo}**.`;
    return `**Open issues in ${repo}:**\n` + data.map((i: any) =>
      `• #${i.number} - ${i.title} (by @${i.user?.login})`
    ).join('\n');
  } catch (err: any) {
    return `❌ Failed to list issues: ${err?.message}`;
  }
}

async function handleListPRs(repo: string, token?: string): Promise<string> {
  try {
    const [owner, repoName] = repo.split('/');
    const octokit = (githubService as any).getOctokit(token);
    const { data } = await octokit.rest.pulls.list({
      owner, repo: repoName, state: 'open', per_page: 10,
    });
    if (!data.length) return `No open PRs in **${repo}**.`;
    return `**Open PRs in ${repo}:**\n` + data.map((p: any) =>
      `• #${p.number} - ${p.title} (by @${p.user?.login})`
    ).join('\n');
  } catch (err: any) {
    return `❌ Failed to list PRs: ${err?.message}`;
  }
}

async function handleViewIssue(repo: string, number: number, token?: string): Promise<string> {
  try {
    const [owner, repoName] = repo.split('/');
    const issue = await githubService.getIssue(owner, repoName, number);
    const body = issue.body?.slice(0, 400) || '_No description_';
    return [
      `**${issue.title}** - #${number} (${issue.state})`,
      `> ${body.replace(/\n/g, '\n> ')}`,
      `🔗 ${issue.html_url}`,
    ].join('\n');
  } catch (err: any) {
    return `❌ Issue not found: ${err?.message}`;
  }
}

async function handleViewPR(repo: string, number: number, token?: string): Promise<string> {
  try {
    const [owner, repoName] = repo.split('/');
    const pr = await githubService.getPullRequest(owner, repoName, number);
    if (!pr) return `❌ PR #${number} not found in ${repo}.`;
    return [
      `**${pr.title}** - PR #${number} (${pr.state})`,
      `Branch: \`${pr.head?.ref}\` → \`${pr.base?.ref}\``,
      `By @${pr.user?.login} · +${pr.additions} -${pr.deletions}`,
      `🔗 ${pr.html_url}`,
    ].join('\n');
  } catch (err: any) {
    return `❌ Failed to get PR: ${err?.message}`;
  }
}

async function handleCreateIssue(repo: string, title: string, body: string, token?: string): Promise<string> {
  try {
    const [owner, repoName] = repo.split('/');
    const octokit = (githubService as any).getOctokit(token);
    const { data } = await octokit.rest.issues.create({
      owner, repo: repoName, title, body,
    });
    return `✅ Created issue **#${data.number}** - ${data.title}\n🔗 ${data.html_url}`;
  } catch (err: any) {
    return `❌ Failed to create issue: ${err?.message}`;
  }
}

async function handleAsk(repo: string | null, question: string): Promise<string> {
  // If a repo is mentioned, check if there's an active workflow session
  if (repo) {
    const workflow = await prisma.maintainerWorkflow.findFirst({
      where: { repo: { fullName: { equals: repo, mode: 'insensitive' } } },
      orderBy: { updatedAt: 'desc' },
    });

    if (workflow?.trueforgeSessionId) {
      try {
        const { accumulatedText } = await trueforge.streamTurnWithAutoResume(
          workflow.trueforgeSessionId,
          `A user on Discord is asking about the repo ${repo}:\n\n> ${question}\n\nAnswer concisely in plain text (no markdown code fences, keep it under 300 words).`
        );
        return accumulatedText
          ? `🤖 ${accumulatedText.slice(0, 1800)}`
          : `I looked into it but couldn't generate a response. Try asking differently.`;
      } catch (err: any) {
        // fall through to generic response
        console.warn('Discord ask turn error:', err?.message);
      }
    }
  }

  return [
    `I'm **Picto**, an autonomous GitHub maintainer. Here's what I can do:`,
    ``,
    `• \`@picto list issues in owner/repo\``,
    `• \`@picto list prs in owner/repo\``,
    `• \`@picto show issue #3 in owner/repo\``,
    `• \`@picto show pr #5 in owner/repo\``,
    `• \`@picto create issue in owner/repo: Title | Body\``,
    `• \`@picto <question about owner/repo>\``,
  ].join('\n');
}

// ── Message handler ──────────────────────────────────────────────────────────

async function onMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  // Check for @picto mention - either as text prefix or Discord mention of the bot
  const botId = message.client.user?.id;
  const isMentioned = botId
    ? message.mentions.users.has(botId)
    : MENTION_PREFIX.test(message.content.trim());

  if (!isMentioned) return;

  // Strip the mention to get the actual command
  const text = message.content
    .replace(/<@!?[\d]+>/g, '')   // strip Discord mention
    .replace(MENTION_PREFIX, '')   // strip @picto text
    .trim();

  if (!text) {
    await message.reply('Hi! Ask me anything about your repo, e.g. `@picto list issues in owner/repo`');
    return;
  }

  // Show typing indicator
  if (message.channel instanceof TextChannel) {
    message.channel.sendTyping().catch(() => {});
  }

  const cmd = parseCommand(text);
  const token = cmd.action !== 'ask' && cmd.repo
    ? await getTokenForRepo(cmd.repo)
    : undefined;

  let reply: string;
  switch (cmd.action) {
    case 'list_issues':  reply = await handleListIssues(cmd.repo, token); break;
    case 'list_prs':     reply = await handleListPRs(cmd.repo, token); break;
    case 'view_issue':   reply = await handleViewIssue(cmd.repo, cmd.number, token); break;
    case 'view_pr':      reply = await handleViewPR(cmd.repo, cmd.number, token); break;
    case 'create_issue': reply = await handleCreateIssue(cmd.repo, cmd.title, cmd.body, token); break;
    case 'ask':          reply = await handleAsk(cmd.repo, cmd.question); break;
    default:             reply = 'I didn\'t understand that. Try `@picto list issues in owner/repo`.';
  }

  // Discord messages have a 2000 char limit
  await message.reply(reply.slice(0, 2000));
}

// ── Bot lifecycle ─────────────────────────────────────────────────────────────

let client: Client | null = null;

export function startDiscordBot(): void {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log('ℹ️  DISCORD_BOT_TOKEN not set - Discord bot disabled.');
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,    // required for reading message content
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`🤖 Discord bot ready - logged in as ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, (msg) => {
    onMessage(msg).catch((err) => console.error('Discord message handler error:', err?.message));
  });

  client.login(token).catch((err) => {
    console.error('❌ Discord bot login failed:', err?.message);
  });
}

export function stopDiscordBot(): void {
  client?.destroy();
  client = null;
}
