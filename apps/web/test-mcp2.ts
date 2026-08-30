import { trueforge } from '#/lib/trueforge';

const sid = '01m19v26ez8prsrydjkqvvya1a';

console.log('Sending turn 2: try github tool...');
const r2 = await trueforge.streamTurnWithAutoResume(sid,
  'Use the github MCP to search for open issues. Call the search_issues tool.',
  (e) => {
    if (e.type && e.type.includes('tool')) console.log('EVENT:', JSON.stringify(e).slice(0, 600));
  }
);
console.log('ACC:', r2.accumulatedText.slice(0, 1500));
