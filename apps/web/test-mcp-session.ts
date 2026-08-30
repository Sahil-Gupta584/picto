import { trueforge } from '#/lib/trueforge';

async function testMcpSession() {
  console.log('1. Ensuring MCP servers registered...');
  await trueforge.ensureMcpServersRegistered();

  console.log('2. Creating test session with github + discord MCPs...');
  const session = await trueforge.createDiscordBotSession('Sahil-Gupta584/trueforge', {
    modelName: 'google-gemini/gemini-3-5-flash-lite',
    instructions: 'You are a helpful assistant with GitHub and Discord tools.',
    mcpUrl: 'http://localhost:5173/api/mcp/discord',
  });
  console.log('   Session:', session.id);

  console.log('3. Sending turn: "List the tools available to you and confirm github + discord tools are accessible"');
  const { accumulatedText } = await trueforge.streamTurnWithAutoResume(
    session.id,
    'List all MCP tools available to you. For each tool, say which MCP server it comes from. Confirm specifically whether you have access to github tools (like search_issues, create_issue) and discord tools (like send_discord_message, get_channel_messages). Just list them — do not call any tools.'
  );

  console.log('\n=== AGENT RESPONSE ===');
  console.log(accumulatedText || '(empty)');
  console.log('=== END ===');
}

testMcpSession().catch((err) => {
  console.error('Test failed:', err?.message || err);
  process.exit(1);
});
