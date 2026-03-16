// Quick test: can the mission-control-db MCP server start and respond?
const { spawn } = require('child_process');
const proc = spawn('/usr/local/bin/node', [
  '/Users/kevin.macarthur/git/froggo-mission-control/tools/mission-control-db-mcp/dist/index.js'
], {
  env: { ...process.env, DB_PATH: '/Users/kevin.macarthur/mission-control/data/mission-control.db' },
  stdio: ['pipe', 'pipe', 'pipe']
});

proc.stderr.on('data', d => process.stderr.write(d));
proc.stdout.on('data', d => {
  console.log('STDOUT:', d.toString().trim());
  proc.kill();
});

// Send a valid MCP initialize request
const req = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } }
}) + '\n';

proc.stdin.write(req);

setTimeout(() => {
  console.log('TIMEOUT - no response');
  proc.kill();
}, 3000);

proc.on('error', e => console.error('SPAWN ERROR:', e.message));
proc.on('exit', (code) => console.log('EXIT:', code));
