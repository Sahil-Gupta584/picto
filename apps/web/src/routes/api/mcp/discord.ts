/**
 * GET/POST /api/mcp/discord
 *
 * A minimal MCP server over HTTP/SSE exposing Discord tools to TrueForge agents.
 * Register in TrueForge UI: Settings → Connectors → Add MCP Server
 *   Name: discord
 *   URL: http://localhost:5173/api/mcp/discord
 *   Auth: None (or API Key with DISCORD_MCP_SECRET)
 *
 * Tools exposed:
 *   - send_discord_message(channelId, content)
 *   - get_channel_messages(channelId, limit?)
 *   - list_guild_channels(guildId)
 */

import { createFileRoute } from '@tanstack/react-router';

// --- Discord REST helpers (no discord.js needed - pure fetch) ----------------

const DISCORD_API = 'https://discord.com/api/v10';

function discordHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN not set');
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  };
}

async function sendDiscordMessage(channelId: string, content: string) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: discordHeaders(),
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });
  if (!res.ok) throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function getChannelMessages(channelId: string, limit = 10) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=${Math.min(limit, 50)}`, {
    headers: discordHeaders(),
  });
  if (!res.ok) throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
  const msgs = await res.json() as any[];
  return msgs.map((m: any) => ({
    id: m.id,
    author: m.author?.username,
    content: m.content,
    timestamp: m.timestamp,
  }));
}

async function listGuildChannels(guildId: string) {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: discordHeaders(),
  });
  if (!res.ok) throw new Error(`Discord API error: ${res.status} ${await res.text()}`);
  const channels = await res.json() as any[];
  return channels
    .filter((c: any) => c.type === 0) // text channels only
    .map((c: any) => ({ id: c.id, name: c.name }));
}

// --- MCP tool definitions ----------------------------------------------------

const TOOLS = [
  {
    name: 'send_discord_message',
    description: 'Send a message to a Discord channel. Use this to reply to the user.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'The Discord channel ID to send the message to' },
        content: { type: 'string', description: 'The message content (max 2000 chars)' },
      },
      required: ['channelId', 'content'],
    },
  },
  {
    name: 'get_channel_messages',
    description: 'Read recent messages from a Discord channel.',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'The Discord channel ID' },
        limit: { type: 'number', description: 'Number of messages to fetch (max 50)', default: 10 },
      },
      required: ['channelId'],
    },
  },
  {
    name: 'list_guild_channels',
    description: 'List all text channels in a Discord server.',
    inputSchema: {
      type: 'object',
      properties: {
        guildId: { type: 'string', description: 'The Discord guild (server) ID' },
      },
      required: ['guildId'],
    },
  },
];

// --- JSON-RPC handler --------------------------------------------------------

async function handleJsonRpc(body: any): Promise<any> {
  const { id, method, params } = body;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'picto-discord-mcp', version: '1.0.0' },
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      let result: any;
      if (name === 'send_discord_message') {
        result = await sendDiscordMessage(args.channelId, args.content);
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `Message sent to channel ${args.channelId}` }] },
        };
      }
      if (name === 'get_channel_messages') {
        result = await getChannelMessages(args.channelId, args.limit);
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      }
      if (name === 'list_guild_channels') {
        result = await listGuildChannels(args.guildId);
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
    } catch (err: any) {
      return {
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true },
      };
    }
  }

  if (method === 'notifications/initialized') {
    return { jsonrpc: '2.0', id: null, result: {} };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// --- HTTP handlers -----------------------------------------------------------

async function handleGet() {
  // SSE endpoint - sends endpoint event pointing back to this URL for POST
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Send endpoint event as per MCP SSE spec
      controller.enqueue(encoder.encode(`event: endpoint\ndata: /api/mcp/discord\n\n`));
      // Keep connection alive briefly then close (TrueForge will POST)
      setTimeout(() => controller.close(), 30000);
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handlePost({ request }: { request: Request }) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body = await request.json();
    // Handle batch (array) or single request
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map(handleJsonRpc));
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const result = await handleJsonRpc(body);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const Route = createFileRoute('/api/mcp/discord')({
  server: {
    handlers: {
      GET: handleGet,
      POST: handlePost,
    },
  },
});
