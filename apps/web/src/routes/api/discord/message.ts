/**
 * POST /api/discord/message
 *
 * Called by the discord-bot.ts process when @Picto is mentioned in a guild.
 * This is a stateless serverless handler - all intelligence lives here.
 *
 * Flow:
 * 1. Validate DISCORD_API_SECRET header
 * 2. Look up MaintainerSettings by guildId
 * 3. Get user's first repo
 * 4. Reuse discordBotSessionId if exists, else create new TrueForge session
 * 5. Send turn: "User X in channelId Y says: <message>. Use GitHub MCP. Reply via send_discord_message."
 * 6. Agent uses GitHub MCP + Discord MCP tools to fetch data and reply
 */

import { createFileRoute } from '@tanstack/react-router';
import { prisma } from '#/db';
import { trueforge } from '#/lib/trueforge';
import { resolveModelKey } from '#/lib/models';

const DISCORD_AGENT_INSTRUCTIONS = (repoFullName: string) =>
  `You are Picto, an AI assistant for the GitHub repository ${repoFullName}.
You help the team's Discord community by answering questions about the repo,
creating issues, listing PRs, and providing status updates.

You have access to GitHub MCP tools: use them to read/create issues, list PRs, check repo state.
Just answer in plain text. Your response will be sent to Discord automatically.
Keep replies concise and formatted for Discord (no HTML, use **bold** and \`code\` sparingly).`;

async function handlePost({ request }: { request: Request }) {
  try {
    // Validate secret
    const secret = request.headers.get('x-discord-api-secret');
    if (process.env.DISCORD_API_SECRET && secret !== process.env.DISCORD_API_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { guildId, channelId, authorUsername, content } = body as {
      guildId: string;
      channelId: string;
      authorUsername: string;
      content: string; // already stripped of @Picto prefix
    };

    if (!guildId || !channelId || !content) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up user by discordGuildId
    const settings = await prisma.maintainerSettings.findFirst({
      where: { discordGuildId: guildId },
      include: { user: true },
    });

    if (!settings) {
      return new Response(
        JSON.stringify({ error: 'Guild not linked. Go to Picto dashboard → Settings and link your Discord server.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user's first active repo
    const repo = await prisma.maintainerRepo.findFirst({
      where: { userId: settings.userId, status: 'active' },
      orderBy: { connectedAt: 'asc' },
    });

    if (!repo) {
      return new Response(
        JSON.stringify({ error: 'No repos connected. Add a repo in the Picto dashboard first.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const mcpUrl = `${process.env.PICTO_API_URL || 'http://localhost:5173'}/api/mcp/discord`;

    // Reuse or create Discord bot session
    let sessionId = settings.discordBotSessionId;

    if (!sessionId) {
      // Create a new long-lived Discord bot session
      const session = await trueforge.createDiscordBotSession(repo.fullName, {
        modelName: resolveModelKey(settings.selectedModel),
        instructions: DISCORD_AGENT_INSTRUCTIONS(repo.fullName),
        mcpUrl,
      });
      sessionId = session.id;

      // Persist session ID
      await prisma.maintainerSettings.update({
        where: { id: settings.id },
        data: { discordBotSessionId: sessionId },
      });
    }

    // Build the turn prompt - agent uses GitHub MCP tools, we post its reply to Discord via REST
    const turnPrompt = `User @${authorUsername} sent this message in Discord channel ${channelId}:

> ${content}

Use your GitHub MCP tools to fetch any relevant data needed to answer.
Then answer directly in plain text. Your response will be forwarded to Discord automatically.`;

    // Fire turn - non-blocking, post agent's text reply to Discord via REST ourselves
    trueforge.streamTurnWithAutoResume(sessionId, turnPrompt)
      .then(async ({ accumulatedText }) => {
        const reply = accumulatedText?.trim();
        if (reply) {
          const discordToken = process.env.DISCORD_BOT_TOKEN;
          if (discordToken) {
            await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
              method: 'POST',
              headers: {
                Authorization: `Bot ${discordToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ content: reply.slice(0, 1800) }),
            }).catch((e) => console.error('Failed to send Discord reply:', e));
          }
        }
      })
      .catch(async (err: any) => {
        console.error('❌ Discord bot turn error:', err?.message);
        // If session is stale/expired, clear it so next message creates a fresh one
        if (err?.statusCode === 404 || err?.message?.includes('not found')) {
          await prisma.maintainerSettings.update({
            where: { id: settings.id },
            data: { discordBotSessionId: null },
          });
        }
      });

    return new Response(JSON.stringify({ ok: true, sessionId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Discord message handler error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const Route = createFileRoute('/api/discord/message')({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
});
