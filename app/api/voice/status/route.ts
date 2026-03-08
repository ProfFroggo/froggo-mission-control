import { NextResponse } from 'next/server';

const VOICE_BRIDGE_PORT = process.env.VOICE_BRIDGE_PORT || '8765';
const VOICE_BRIDGE_URL = `ws://localhost:${VOICE_BRIDGE_PORT}`;

export async function GET() {
  // Check if voice bridge is running by attempting a quick connect
  let running = false;
  let agentCount = 0;

  try {
    // Use a HEAD-style HTTP check — voice bridge doesn't have HTTP,
    // so we check the process via the port being open
    const { createConnection } = await import('net');
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ port: parseInt(VOICE_BRIDGE_PORT, 10), host: 'localhost' });
      socket.on('connect', () => { running = true; socket.destroy(); resolve(); });
      socket.on('error', () => { reject(); });
      setTimeout(() => { socket.destroy(); reject(); }, 500);
    }).catch(() => {});

    // Count agents with soul files in workspace
    const { readdirSync, existsSync: fsExists } = await import('fs');
    const { join } = await import('path');
    const { homedir } = await import('os');
    const agentsDir = join(homedir(), 'mission-control', 'agents');
    if (fsExists(agentsDir)) {
      agentCount = readdirSync(agentsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && fsExists(join(agentsDir, e.name, 'SOUL.md')))
        .length;
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    running,
    url: VOICE_BRIDGE_URL,
    model: 'gemini-2.5-flash-native-audio-preview',
    agentCount,
    port: parseInt(VOICE_BRIDGE_PORT, 10),
  });
}
