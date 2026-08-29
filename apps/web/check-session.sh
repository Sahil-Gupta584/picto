#!/bin/bash
# Usage: bash check-session.sh [session_id]
# If no session_id, checks the latest session

SESSION_ID="${1:-}"

if [ -z "$SESSION_ID" ]; then
  echo "Fetching latest session..."
  SESSION_ID=$(curl -s "http://localhost:8790/api/v1/sessions?limit=1" | node -e "
    const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
      const d=JSON.parse(Buffer.concat(c));
      console.log(d.data[0].id);
    });")
  echo "Session: $SESSION_ID"
fi

echo ""
echo "============================================"
echo "  SESSION DETAILS: $SESSION_ID"
echo "============================================"

curl -s "http://localhost:8790/api/v1/sessions/$SESSION_ID/turns" | node -e "
const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{
  const d=JSON.parse(Buffer.concat(c));
  const turns = d.data || [];

  console.log('Total turns:', turns.length);
  console.log('');

  for(const t of turns){
    const tid = t.id || '';
    const status = t.state?.status || 'unknown';
    const input = t.input?.[0];
    const output = t.state?.output;
    const error = t.state?.error;
    const events = t.events || [];
    const metrics = t.metrics || {};

    console.log('='.repeat(60));
    console.log('TURN:', tid.slice(0,40));
    console.log('Status:', status);
    console.log('Created:', t.created_at);
    console.log('Completed:', t.state?.completed_at);

    // Input
    if(input?.content) {
      console.log('');
      console.log('INPUT:');
      console.log(input.content.toString().slice(0,500));
    }

    // Output
    if(output?.content) {
      console.log('');
      console.log('OUTPUT:');
      console.log(output.content.toString().slice(0,800));
    }

    // Error
    if(error) {
      console.log('');
      console.log('ERROR:', JSON.stringify(error).slice(0,500));
    }
    if(status === 'error' && t.state?.message) {
      console.log('');
      console.log('ERROR MESSAGE:', t.state.message.slice(0,500));
    }

    // Tool calls from events
    const toolEvents = events.filter(e => e.type && (e.type.includes('tool') || e.type.includes('approval')));
    if(toolEvents.length > 0) {
      console.log('');
      console.log('TOOL CALLS (' + toolEvents.length + '):');
      for(const te of toolEvents) {
        const name = te.name || te.tool_name || te.type;
        const args = te.arguments || te.input || '';
        const result = te.result || te.output || '';
        console.log('  -', name);
        if(args) console.log('    Args:', JSON.stringify(args).slice(0,200));
        if(result) console.log('    Result:', JSON.stringify(result).slice(0,200));
      }
    }

    // Metrics
    if(metrics.total_tokens) {
      console.log('');
      console.log('Tokens:', metrics.total_input_tokens, 'in /', metrics.total_output_tokens, 'out /', metrics.total_tokens, 'total');
    }

    console.log('');
  }
});"
