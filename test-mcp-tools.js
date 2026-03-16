// Get the tool list from the mission-control-db MCP server
const { spawn } = require('child_process');
const proc = spawn('/usr/local/bin/node', [
  '/Users/kevin.macarthur/git/froggo-mission-control/tools/mission-control-db-mcp/dist/index.js'
], {
  env: { ...process.env, DB_PATH: '/Users/kevin.macarthur/mission-control/data/mission-control.db' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let buf = '';
proc.stdout.on('data', d => {
  buf += d.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.result?.tools) {
        console.log('Tool names:');
        msg.result.tools.forEach(t => console.log(' -', t.name));
        proc.kill();
      } else if (msg.result?.protocolVersion) {
        // Initialized, now request tools list
        proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
      }
    } catch(e) {}
  }
});
proc.stderr.on('data', d => process.stderr.write(d));

// Initialize
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } }
}) + '\n');

setTimeout(() => { console.log('TIMEOUT'); proc.kill(); }, 5000);
proc.on('error', e => console.error('ERROR:', e.message));
