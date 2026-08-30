/**
 * discord-bot.ts — Persistent Discord Gateway bot
 *
 * Runs as a separate process alongside the Picto web server:
 *   npx tsx apps/web/src/discord-bot.ts
 *
 * Connects to Discord's WebSocket Gateway, listens for @Picto mentions,
 * and forwards them to /api/discord/message for processing.
 *
 * Environment variables needed (same .env as the web app):
 *   DISCORD_BOT_TOKEN  — Bot token from Discord Developer Portal
 *   PICTO_API_URL      — URL of the running Picto server (default: http://localhost:5173)
 *   DISCORD_API_SECRET — Shared secret to authenticate bot → API calls
 */

import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load .env from apps/web/
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const PICTO_API_URL = process.env.PICTO_API_URL || 'http://localhost:5173';
const DISCORD_API_SECRET = process.env.DISCORD_API_SECRET || '';

if (!BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set. Add it to apps/web/.env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers, // needed to resolve mentions in threads
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 Picto Discord bot ready — logged in as ${c.user.tag}`);
  console.log(`📡 Forwarding all @Picto mentions to: ${PICTO_API_URL}/api/discord/message`);
});

client.on(Events.MessageCreate, async (message: Message) => {
  // Debug: log ALL incoming messages to verify events are arriving
  console.log(`📨 MessageCreate: author=${message.author.username} bot=${message.author.bot} channelType=${message.channel.type} mentions=${[...message.mentions.users.keys()].join(',')}`);

  // Ignore messages from bots (including ourselves)
  if (message.author.bot) return;f

  // Check if bot is mentioned
  const botId = client.user?.id;
  if (!botId || !message.mentions.users.has(botId)) return;

  // Strip the bot mention + any leading/trailing whitespace
  const content = message.content
    .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
    .trim();

  if (!content) {
    await message.reply('Hi! Mention me with a question, e.g. `@Picto what are the open issues?`');
    return;
  }

  // Show typing indicator
  message.channel.sendTyping().catch(() => {});

  const payload = {
    guildId: message.guildId,
    channelId: message.channelId,
    authorUsername: message.author.username,
    authorId: message.author.id,
    content,
    messageId: message.id,
  };

  try {
    const res = await fetch(`${PICTO_API_URL}/api/discord/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-discord-api-secret': DISCORD_API_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      // Surface error back to Discord so user knows what happened
      const errorMsg = data?.error || `Error ${res.status}`;
      await message.reply(`❌ ${errorMsg}`);
      return;
    }

    // Success — agent is processing, will reply via Discord MCP send_discord_message tool
    // No need to reply here — the agent will send the message itself
    console.log(`✅ Forwarded message: ${content} from @${message.author.username} in guild ${message.guildId}, session: ${data.sessionId}`);
  } catch (err: any) {
    console.error('❌ Failed to forward to Picto API:', err.message);
    await message.reply('❌ Could not reach Picto server. Is it running?');
  }
});

client.on(Events.Error, (err) => {
  console.error('Discord client error:', err.message);
});

client.login(BOT_TOKEN);
