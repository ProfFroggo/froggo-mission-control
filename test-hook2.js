const { spawnSync } = require('child_process');

const input = JSON.stringify({
  tool_name: 'mcp__mission-control-db__task_add_activity',
  tool_input: { taskId: 'task-1773524459577-twssq2', agentId: 'coder', action: 'started', message: 'test' }
}) + '\n';

const r1 = spawnSync('/usr/local/bin/node', [
  '/Users/kevin.macarthur/git/froggo-mission-control/tools/hooks/approval-hook.js'
], { input, encoding: 'utf8' });

console.log('Project hook stdout:', r1.stdout.trim());
console.log('Project hook stderr:', r1.stderr.trim());

const r2 = spawnSync('/opt/homebrew/bin/node', [
  '/Users/kevin.macarthur/.npm-global/lib/node_modules/froggo-mission-control/tools/hooks/approval-hook.js'
], { input, encoding: 'utf8' });

console.log('Global hook stdout:', r2.stdout.trim());
console.log('Global hook stderr:', r2.stderr.trim());
