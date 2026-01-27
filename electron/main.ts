import { app, BrowserWindow, ipcMain, systemPreferences, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as os from 'os';
import * as http from 'http';

// Local server for serving model files in prod
let modelServer: http.Server | null = null;
let modelServerPort = 18799;

let mainWindow: BrowserWindow | null = null;

// Request microphone access on macOS
if (process.platform === 'darwin') {
  systemPreferences.askForMediaAccess('microphone').then(granted => {
    console.log('Microphone access:', granted ? 'granted' : 'denied');
  });
}

// In packaged app, __dirname is inside asar at /dist-electron
// dist folder is sibling at /dist
const distPath = path.join(__dirname, '..', 'dist', 'index.html');
const isDev = process.env.ELECTRON_DEV === '1';

console.log('App packaged:', app.isPackaged);
console.log('Dist path:', distPath);
console.log('isDev:', isDev);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    console.log('Running in dev mode, loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Running in production mode, loading from dist');
    mainWindow.loadFile(distPath);
  }

  // Handle permission requests (microphone for voice)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'microphone', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      console.log('Permission granted:', permission);
      callback(true);
    } else {
      console.log('Permission denied:', permission);
      callback(false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start local HTTP server to serve model files in prod
  if (!isDev) {
    modelServer = http.createServer((req, res) => {
      const filePath = path.join(process.resourcesPath, 'models', path.basename(req.url || ''));
      console.log('[ModelServer] Request:', req.url, '-> serving:', filePath);
      
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        console.log('[ModelServer] File not found:', filePath);
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    modelServer.listen(modelServerPort, '127.0.0.1', () => {
      console.log(`[ModelServer] Serving models on http://127.0.0.1:${modelServerPort}`);
    });
  }
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Clean up model server
  if (modelServer) {
    modelServer.close();
    modelServer = null;
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============== GATEWAY IPC HANDLERS ==============
ipcMain.handle('gateway:status', async () => {
  try {
    const response = await fetch('http://localhost:18789/api/status');
    return await response.json();
  } catch (error) {
    return { error: 'Gateway not reachable' };
  }
});

ipcMain.handle('gateway:sessions', async () => {
  try {
    const response = await fetch('http://localhost:18789/api/sessions');
    return await response.json();
  } catch (error) {
    return { error: 'Gateway not reachable' };
  }
});

// ============== WHISPER (Legacy - keeping for fallback) ==============
const WHISPER_PATH = '/opt/homebrew/bin/whisper';
const TEMP_DIR = os.tmpdir();

ipcMain.handle('whisper:transcribe', async (_, audioData: ArrayBuffer) => {
  const tempFile = path.join(TEMP_DIR, `whisper-${Date.now()}.webm`);
  const outputDir = TEMP_DIR;
  
  try {
    // Write audio data to temp file
    fs.writeFileSync(tempFile, Buffer.from(audioData));
    console.log('Whisper: Saved audio to', tempFile);
    
    // Run whisper (use "tiny" model - fastest, good enough for voice commands)
    return new Promise((resolve) => {
      const cmd = `${WHISPER_PATH} "${tempFile}" --model tiny --language en --output_format txt --output_dir "${outputDir}" 2>&1`;
      console.log('Whisper: Running', cmd);
      
      exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
        // Read the output file
        const baseName = path.basename(tempFile, '.webm');
        const outputFile = path.join(outputDir, `${baseName}.txt`);
        
        let transcript = '';
        if (fs.existsSync(outputFile)) {
          transcript = fs.readFileSync(outputFile, 'utf-8').trim();
          fs.unlinkSync(outputFile); // Cleanup
        }
        
        // Cleanup temp audio file
        try { fs.unlinkSync(tempFile); } catch {}
        
        if (error) {
          console.error('Whisper error:', error.message);
          resolve({ error: error.message, stdout, stderr });
        } else {
          console.log('Whisper transcript:', transcript);
          resolve({ transcript, stdout });
        }
      });
    });
  } catch (error: any) {
    console.error('Whisper failed:', error);
    try { fs.unlinkSync(tempFile); } catch {}
    return { error: error.message };
  }
});

ipcMain.handle('whisper:check', async () => {
  // Just check if the file exists - running --help is too slow
  const available = fs.existsSync(WHISPER_PATH);
  console.log('Whisper check:', WHISPER_PATH, 'exists:', available);
  return { available, path: WHISPER_PATH };
});

// ============== APPROVAL QUEUE ==============
const APPROVAL_QUEUE_PATH = path.join(process.env.HOME || '', 'clawd', 'approvals', 'queue.json');

ipcMain.handle('approvals:read', async () => {
  try {
    if (!fs.existsSync(APPROVAL_QUEUE_PATH)) {
      return { items: [] };
    }
    const data = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
    return data;
  } catch (error) {
    console.error('Failed to read approval queue:', error);
    return { items: [] };
  }
});

ipcMain.handle('approvals:clear', async () => {
  try {
    const data = { description: "Approval queue - Froggo adds items here, dashboard picks them up", items: [] };
    fs.writeFileSync(APPROVAL_QUEUE_PATH, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to clear approval queue:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('approvals:remove', async (_, itemId: string) => {
  try {
    if (!fs.existsSync(APPROVAL_QUEUE_PATH)) return { success: true };
    const data = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
    data.items = (data.items || []).filter((i: any) => i.id !== itemId);
    fs.writeFileSync(APPROVAL_QUEUE_PATH, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to remove approval item:', error);
    return { success: false, error: String(error) };
  }
});

// ============== VOICE IPC HANDLERS ==============
ipcMain.handle('voice:getModelUrl', async () => {
  const url = isDev 
    ? '/models/model.tar.gz'
    : `http://127.0.0.1:${modelServerPort}/model.tar.gz`;
  console.log('[Voice] getModelUrl called, isDev:', isDev, 'returning:', url);
  return url;
});

// TTS via ElevenLabs (sag CLI)
// Load ElevenLabs API key from env file if not in environment
let elevenlabsApiKey = process.env.ELEVENLABS_API_KEY || '';
try {
  const envPath = path.join(os.homedir(), '.clawdbot', 'elevenlabs.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/ELEVENLABS_API_KEY=(.+)/);
    if (match) elevenlabsApiKey = match[1].trim();
  }
} catch {}

ipcMain.handle('voice:speak', async (_, text: string, voice?: string) => {
  const outputPath = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
  const voiceArg = voice ? `-v "${voice}"` : '-v Brian';
  // Escape text for shell - use fast model for lower latency
  const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const cmd = `sag ${voiceArg} --model-id eleven_flash_v2_5 -o "${outputPath}" "${escapedText}"`;
  
  console.log('[Voice] TTS command:', cmd.slice(0, 120) + '...');
  
  return new Promise((resolve) => {
    // Pass environment variables including ELEVENLABS_API_KEY
    const env = { ...process.env };
    if (elevenlabsApiKey) env.ELEVENLABS_API_KEY = elevenlabsApiKey;
    
    exec(cmd, { timeout: 30000, env }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Voice] TTS error:', error.message);
        console.error('[Voice] TTS stderr:', stderr);
        resolve({ success: false, error: error.message });
      } else {
        console.log('[Voice] TTS generated:', outputPath);
        resolve({ success: true, path: outputPath });
      }
    });
  });
});

// froggo-db task sync
ipcMain.handle('tasks:sync', async (_, task: { id: string; title: string; status: string; project?: string; assignedTo?: string; description?: string }) => {
  console.log('[Tasks] Sync called with:', task);
  
  // Check if task exists
  return new Promise((resolve) => {
    exec(`froggo-db task-get "${task.id}"`, { timeout: 5000 }, (getError, getStdout) => {
      // If task exists (stdout has JSON), just return success
      if (!getError && getStdout && getStdout.includes('"id"')) {
        console.log('[Tasks] Task already exists:', task.id);
        resolve({ success: true });
        return;
      }
      
      // Task doesn't exist, create it
      const args = [
        `"${task.title.replace(/"/g, '\\"')}"`,
        `--id ${task.id}`,
        task.status ? `--status ${task.status}` : '',
        task.project ? `--project "${task.project.replace(/"/g, '\\"')}"` : '',
        task.assignedTo ? `--assign ${task.assignedTo}` : '',
        task.description ? `--desc "${task.description.replace(/"/g, '\\"')}"` : ''
      ].filter(Boolean).join(' ');
      
      const addCmd = `froggo-db task-add ${args}`;
      console.log('[Tasks] Creating task:', addCmd);
      
      exec(addCmd, { timeout: 10000 }, (addError, addStdout, addStderr) => {
        if (addError) {
          console.error('[Tasks] Create error:', addError.message);
          console.error('[Tasks] stderr:', addStderr);
          resolve({ success: false, error: addError.message });
        } else {
          console.log('[Tasks] Created:', task.id);
          console.log('[Tasks] stdout:', addStdout);
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('rejections:log', async (_, rejection: { type: string; title: string; content?: string; reason?: string }) => {
  const escapedTitle = rejection.title.replace(/"/g, '\\"');
  const escapedReason = (rejection.reason || '').replace(/"/g, '\\"');
  const cmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO rejected_decisions (type, title, content, reason) VALUES ('${rejection.type}', '${escapedTitle}', '', '${escapedReason}')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('tasks:update', async (_, taskId: string, updates: { status?: string; assignedTo?: string }) => {
  const args = [
    updates.status ? `--status ${updates.status}` : '',
    updates.assignedTo ? `--assign ${updates.assignedTo}` : ''
  ].filter(Boolean).join(' ');
  
  const cmd = `froggo-db task-update "${taskId}" ${args}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('tasks:list', async (_, status?: string) => {
  const statusArg = status ? `--status ${status}` : '';
  const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM tasks ${status ? `WHERE status='${status}'` : ''} ORDER BY created_at DESC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, tasks: [] });
      } else {
        try {
          const tasks = JSON.parse(stdout || '[]');
          resolve({ success: true, tasks });
        } catch {
          resolve({ success: false, tasks: [] });
        }
      }
    });
  });
});

ipcMain.handle('tasks:start', async (_, taskId: string) => {
  const cmd = `froggo-db task-start "${taskId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('tasks:complete', async (_, taskId: string, outcome?: string) => {
  const outcomeArg = outcome ? `--outcome ${outcome}` : '';
  const cmd = `froggo-db task-complete "${taskId}" ${outcomeArg}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

// ============== EXECUTION HANDLERS ==============
ipcMain.handle('execute:tweet', async (_, content: string, taskId?: string) => {
  // Actually post the tweet via bird CLI
  const escapedContent = content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const cmd = `bird tweet "${escapedContent}"`;
  
  // Log progress if taskId provided
  if (taskId) {
    exec(`froggo-db task-progress "${taskId}" "Posting tweet via bird CLI..." --step "Execution"`, () => {});
  }
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Execute] Tweet error:', error.message, stderr);
        if (taskId) {
          exec(`froggo-db task-progress "${taskId}" "Failed: ${error.message}" --step "Error"`, () => {});
          exec(`froggo-db task-update "${taskId}" --status failed`, () => {});
        }
        resolve({ success: false, error: error.message });
      } else {
        console.log('[Execute] Tweet posted:', stdout);
        if (taskId) {
          exec(`froggo-db task-progress "${taskId}" "Tweet posted successfully" --step "Complete"`, () => {});
          exec(`froggo-db task-complete "${taskId}" --outcome success`, () => {});
        }
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// ============== INBOX IPC HANDLERS (froggo-db backed) ==============
ipcMain.handle('inbox:list', async (_, status?: string) => {
  const statusArg = status ? `--status ${status}` : '';
  const cmd = `froggo-db inbox-list ${statusArg} --limit 50`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Inbox] List error:', error.message);
        resolve({ success: false, items: [] });
      } else {
        // Parse output - froggo-db outputs human-readable format, need JSON
        // For now, query directly via sqlite3
        const sqlCmd = status 
          ? `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE status='${status}' ORDER BY created DESC LIMIT 50" -json`
          : `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox ORDER BY created DESC LIMIT 50" -json`;
        
        exec(sqlCmd, (err, jsonOut) => {
          if (err) {
            resolve({ success: false, items: [] });
          } else {
            try {
              const items = JSON.parse(jsonOut || '[]');
              resolve({ success: true, items });
            } catch {
              resolve({ success: false, items: [] });
            }
          }
        });
      }
    });
  });
});

ipcMain.handle('inbox:add', async (_, item: { type: string; title: string; content: string; context?: string; channel?: string }) => {
  const escapedTitle = item.title.replace(/"/g, '\\"');
  const escapedContent = item.content.replace(/"/g, '\\"');
  const contextArg = item.context ? `--context "${item.context.replace(/"/g, '\\"')}"` : '';
  const channelArg = item.channel ? `--channel ${item.channel}` : '';
  
  const cmd = `froggo-db inbox-add --type ${item.type} --title "${escapedTitle}" --content "${escapedContent}" ${contextArg} ${channelArg}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('inbox:update', async (_, id: number, updates: { status?: string; feedback?: string }) => {
  const sets: string[] = [];
  if (updates.status) sets.push(`status='${updates.status}'`);
  if (updates.feedback) sets.push(`feedback='${updates.feedback.replace(/'/g, "''")}'`);
  if (updates.status) sets.push(`reviewed_at=datetime('now')`);
  
  if (sets.length === 0) return { success: false };
  
  const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET ${sets.join(', ')} WHERE id=${id}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('inbox:approveAll', async () => {
  return new Promise((resolve) => {
    // Count pending items first
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT COUNT(*) FROM inbox WHERE status='pending'"`, (_, countOut) => {
      const count = parseInt(countOut?.trim() || '0', 10);
      
      // Approve all pending
      const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET status='approved', reviewed_at=datetime('now') WHERE status='pending'"`;
      
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, count });
        }
      });
    });
  });
});

// ============== SCREENSHOT IPC HANDLERS ==============
ipcMain.handle('screenshot:capture', async (_, outputPath: string) => {
  return new Promise((resolve) => {
    if (mainWindow) {
      mainWindow.webContents.capturePage().then((image) => {
        const pngBuffer = image.toPNG();
        const fs = require('fs');
        fs.writeFileSync(outputPath, pngBuffer);
        resolve({ success: true, path: outputPath, size: pngBuffer.length });
      }).catch((err) => {
        resolve({ success: false, error: String(err) });
      });
    } else {
      resolve({ success: false, error: 'No main window' });
    }
  });
});

ipcMain.handle('screenshot:navigate', async (_, view: string) => {
  if (mainWindow) {
    mainWindow.webContents.send('navigate-to', view);
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

// ============== SCHEDULE IPC HANDLERS ==============
const scheduleDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');

ipcMain.handle('schedule:list', async () => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ${scheduleDbPath} "
      CREATE TABLE IF NOT EXISTS schedule (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        sent_at TEXT,
        error TEXT,
        metadata TEXT
      );
      SELECT * FROM schedule ORDER BY scheduled_for ASC;
    " -json 2>/dev/null || echo '[]'`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      try {
        // Filter out CREATE TABLE result
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.find(l => l.startsWith('['));
        const items = JSON.parse(jsonLine || '[]').map((row: any) => ({
          id: row.id,
          type: row.type,
          content: row.content,
          scheduledFor: row.scheduled_for,
          status: row.status,
          createdAt: row.created_at,
          sentAt: row.sent_at,
          error: row.error,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
        resolve({ success: true, items });
      } catch {
        resolve({ success: true, items: [] });
      }
    });
  });
});

ipcMain.handle('schedule:add', async (_, item: { type: string; content: string; scheduledFor: string; metadata?: any }) => {
  const id = `sched-${Date.now()}`;
  const metadata = item.metadata ? JSON.stringify(item.metadata).replace(/'/g, "''") : null;
  
  return new Promise((resolve) => {
    // Insert into database
    const insertCmd = `sqlite3 ${scheduleDbPath} "
      INSERT INTO schedule (id, type, content, scheduled_for, metadata)
      VALUES ('${id}', '${item.type}', '${item.content.replace(/'/g, "''")}', '${item.scheduledFor}', ${metadata ? "'" + metadata + "'" : 'NULL'});
    "`;
    
    exec(insertCmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      // Create cron job to execute at scheduled time
      const cronTime = new Date(item.scheduledFor);
      const cronText = item.type === 'tweet' 
        ? `Execute scheduled tweet: ${item.content.slice(0, 50)}...`
        : `Execute scheduled email to ${item.metadata?.recipient}: ${item.content.slice(0, 50)}...`;
      
      // Use Clawdbot cron API
      fetch('http://localhost:18789/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          job: {
            id: id,
            text: cronText,
            schedule: cronTime.toISOString(),
            enabled: true,
          }
        })
      }).then(() => {
        resolve({ success: true, id });
      }).catch((e) => {
        // Cron failed but item is in DB
        resolve({ success: true, id, warning: 'Cron job creation failed' });
      });
    });
  });
});

ipcMain.handle('schedule:cancel', async (_, id: string) => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ${scheduleDbPath} "UPDATE schedule SET status='cancelled' WHERE id='${id}'"`;
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        // Also remove cron job
        fetch('http://localhost:18789/api/cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove', jobId: id })
        }).catch(() => {});
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('schedule:update', async (_, id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: any }) => {
  const sets: string[] = [];
  if (item.type) sets.push(`type='${item.type}'`);
  if (item.content) sets.push(`content='${item.content.replace(/'/g, "''")}'`);
  if (item.scheduledFor) sets.push(`scheduled_for='${item.scheduledFor}'`);
  if (item.metadata) sets.push(`metadata='${JSON.stringify(item.metadata).replace(/'/g, "''")}'`);
  
  if (sets.length === 0) return { success: false, error: 'No updates provided' };
  
  return new Promise((resolve) => {
    const cmd = `sqlite3 ${scheduleDbPath} "UPDATE schedule SET ${sets.join(', ')} WHERE id='${id}'"`;
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('schedule:sendNow', async (_, id: string) => {
  return new Promise((resolve) => {
    // Get the scheduled item
    exec(`sqlite3 ${scheduleDbPath} "SELECT * FROM schedule WHERE id='${id}'" -json`, (_, stdout) => {
      try {
        const items = JSON.parse(stdout || '[]');
        if (items.length === 0) {
          resolve({ success: false, error: 'Item not found' });
          return;
        }
        
        const item = items[0];
        
        // Execute immediately based on type
        let execCmd = '';
        if (item.type === 'tweet') {
          execCmd = `bird tweet "${item.content.replace(/"/g, '\\"')}"`;
        } else if (item.type === 'email') {
          const meta = item.metadata ? JSON.parse(item.metadata) : {};
          execCmd = `gog gmail send --to "${meta.recipient}" --subject "${meta.subject || 'No subject'}" --body "${item.content.replace(/"/g, '\\"')}"`;
        }
        
        if (!execCmd) {
          resolve({ success: false, error: 'Unknown item type' });
          return;
        }
        
        exec(execCmd, { timeout: 30000 }, (execError) => {
          // Update status
          const status = execError ? 'failed' : 'sent';
          const errorMsg = execError ? execError.message.replace(/'/g, "''") : null;
          
          exec(`sqlite3 ${scheduleDbPath} "UPDATE schedule SET status='${status}', sent_at=datetime('now')${errorMsg ? ", error='" + errorMsg + "'" : ''} WHERE id='${id}'"`, () => {
            resolve({ success: !execError, error: execError?.message });
          });
        });
      } catch (e) {
        resolve({ success: false, error: String(e) });
      }
    });
  });
});

// ============== MESSAGING SEARCH IPC HANDLERS ==============
// NOTE: discordcli has no search command - would need to fetch recent messages and filter
// tgcli search only searches chat names, not message content
// wacli has proper FTS5 message search

ipcMain.handle('search:discord', async () => {
  // Discord CLI doesn't support search - return empty
  // Future: could fetch recent DMs and filter client-side
  return { success: false, messages: [], note: 'Discord search not available (CLI limitation)' };
});

ipcMain.handle('search:telegram', async (_, query: string) => {
  return new Promise((resolve) => {
    const escapedQuery = query.replace(/"/g, '\\"');
    // tgcli search only searches chat NAMES, not message content
    const cmd = `tgcli search "${escapedQuery}" --json 2>/dev/null || echo '{"chats":[]}'`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, chats: [], note: 'Telegram search failed' });
        return;
      }
      try {
        const result = JSON.parse(stdout || '{"chats":[]}');
        // Convert chat results to message-like format
        const chats = result.chats || result || [];
        resolve({ 
          success: true, 
          messages: Array.isArray(chats) ? chats.map((c: any) => ({
            id: c.id,
            type: 'chat',
            content: `Chat: ${c.name || c.title}`,
            from: c.name || c.title,
          })) : [],
          note: 'Searches chat names only'
        });
      } catch {
        resolve({ success: true, messages: [], raw: stdout });
      }
    });
  });
});

ipcMain.handle('search:whatsapp', async (_, query: string) => {
  return new Promise((resolve) => {
    const escapedQuery = query.replace(/"/g, '\\"');
    // wacli has proper FTS5 message search
    const cmd = `wacli messages search "${escapedQuery}" --json --limit 10`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, messages: [], error: error.message });
        return;
      }
      try {
        const result = JSON.parse(stdout || '{}');
        const messages = result.data?.messages || [];
        resolve({ 
          success: true, 
          messages: messages.map((m: any) => ({
            id: m.MsgID,
            content: m.Text || m.DisplayText,
            from: m.ChatName,
            timestamp: m.Timestamp,
            body: m.Text,
          }))
        });
      } catch {
        resolve({ success: true, messages: [], raw: stdout });
      }
    });
  });
});

// ============== FILESYSTEM IPC HANDLERS ==============
ipcMain.handle('fs:writeBase64', async (_, filePath: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error: any) {
    console.error('[FS] Write error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string, encoding?: string) => {
  try {
    const content = fs.readFileSync(filePath, encoding as BufferEncoding || 'utf8');
    return { success: true, content };
  } catch (error: any) {
    console.error('[FS] Read error:', error);
    return { success: false, error: error.message };
  }
});

// ============== LIBRARY IPC HANDLERS ==============
const libraryDir = path.join(os.homedir(), 'clawd', 'library');

ipcMain.handle('library:list', async (_, category?: string) => {
  // Ensure library directory exists
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }
  
  return new Promise((resolve) => {
    const categoryFilter = category ? `WHERE category='${category}'` : '';
    const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM library ${categoryFilter} ORDER BY updated_at DESC" -json 2>/dev/null || echo '[]'`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: true, files: [] });
        return;
      }
      try {
        const files = JSON.parse(stdout || '[]');
        resolve({ success: true, files });
      } catch {
        resolve({ success: true, files: [] });
      }
    });
  });
});

ipcMain.handle('library:upload', async () => {
  const { dialog } = require('electron');
  
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'No file selected' };
  }
  
  const sourcePath = result.filePaths[0];
  const fileName = path.basename(sourcePath);
  const fileId = `file-${Date.now()}`;
  const destPath = path.join(libraryDir, fileId + '-' + fileName);
  
  // Ensure library dir exists
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }
  
  // Copy file
  fs.copyFileSync(sourcePath, destPath);
  const stats = fs.statSync(destPath);
  
  // Determine category
  const ext = path.extname(fileName).toLowerCase();
  let category = 'other';
  if (['.md', '.txt', '.draft'].includes(ext)) category = 'draft';
  else if (['.pdf', '.doc', '.docx'].includes(ext)) category = 'document';
  else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov'].includes(ext)) category = 'media';
  
  // Insert into database
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/clawd/data/froggo.db "
      CREATE TABLE IF NOT EXISTS library (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        category TEXT DEFAULT 'other',
        size INTEGER,
        mime_type TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        linked_tasks TEXT,
        tags TEXT
      );
      INSERT INTO library (id, name, path, category, size) VALUES ('${fileId}', '${fileName.replace(/'/g, "''")}', '${destPath.replace(/'/g, "''")}', '${category}', ${stats.size});
    "`;
    
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, file: { id: fileId, name: fileName, path: destPath, category, size: stats.size } });
      }
    });
  });
});

ipcMain.handle('library:delete', async (_, fileId: string) => {
  return new Promise((resolve) => {
    // Get file path first
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT path FROM library WHERE id='${fileId}'" -json`, (_, stdout) => {
      try {
        const rows = JSON.parse(stdout || '[]');
        if (rows.length > 0 && rows[0].path) {
          // Delete file
          if (fs.existsSync(rows[0].path)) {
            fs.unlinkSync(rows[0].path);
          }
        }
      } catch {}
      
      // Delete from database
      exec(`sqlite3 ~/clawd/data/froggo.db "DELETE FROM library WHERE id='${fileId}'"`, (error) => {
        resolve({ success: !error });
      });
    });
  });
});

ipcMain.handle('library:link', async (_, fileId: string, taskId: string) => {
  return new Promise((resolve) => {
    // Get current linked tasks
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT linked_tasks FROM library WHERE id='${fileId}'"`, (_, stdout) => {
      let linkedTasks: string[] = [];
      try {
        const current = stdout?.trim();
        if (current) linkedTasks = JSON.parse(current);
      } catch {}
      
      if (!linkedTasks.includes(taskId)) {
        linkedTasks.push(taskId);
      }
      
      const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE library SET linked_tasks='${JSON.stringify(linkedTasks)}', updated_at=datetime('now') WHERE id='${fileId}'"`;
      exec(cmd, (error) => {
        resolve({ success: !error });
      });
    });
  });
});

// ============== SEARCH IPC HANDLERS ==============
ipcMain.handle('search:local', async (_, query: string) => {
  const escapedQuery = query.replace(/'/g, "''");
  
  return new Promise((resolve) => {
    // Search froggo-db for tasks, facts, and messages
    const cmd = `froggo-db search "${escapedQuery}" --limit 20 --json 2>/dev/null || froggo-db search "${escapedQuery}" --limit 20`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        console.error('[Search] Local search error:', error);
        resolve({ success: false, results: [] });
        return;
      }
      
      try {
        // Try to parse JSON output
        const results = JSON.parse(stdout);
        resolve({ success: true, results });
      } catch {
        // Parse text output into results
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        const results = lines.slice(0, 10).map((line, i) => ({
          id: `search-${i}`,
          type: 'message',
          title: line.slice(0, 50),
          text: line,
        }));
        resolve({ success: true, results });
      }
    });
  });
});

// ============== SYSTEM STATUS IPC HANDLERS ==============
ipcMain.handle('system:status', async () => {
  return new Promise((resolve) => {
    // Check watcher status
    exec('pgrep -f task-watcher.sh', (watcherErr) => {
      const watcherRunning = !watcherErr;
      
      // Check kill switch from env file
      exec('grep EXTERNAL_ACTIONS_ENABLED ~/clawd/config/env.sh 2>/dev/null || echo "false"', (_, envOut) => {
        const killSwitchOn = !envOut?.includes('true');
        
        // Count pending inbox items
        exec('froggo-db inbox-list 2>/dev/null | grep -c "pending" || echo 0', (_, inboxOut) => {
          const pendingInbox = parseInt(inboxOut?.trim() || '0', 10);
          
          // Count in-progress tasks
          exec('froggo-db task-list --status in-progress 2>/dev/null | wc -l || echo 0', (_, taskOut) => {
            const inProgressTasks = parseInt(taskOut?.trim() || '0', 10);
            
            resolve({
              success: true,
              status: {
                watcherRunning,
                killSwitchOn,
                pendingInbox,
                inProgressTasks,
              }
            });
          });
        });
      });
    });
  });
});

// ============== SETTINGS IPC HANDLERS ==============
ipcMain.handle('settings:get', async () => {
  const configPath = path.join(os.homedir(), 'clawd', 'config', 'settings.json');
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return { success: true, settings: JSON.parse(content) };
  } catch {
    return { success: true, settings: {} };
  }
});

ipcMain.handle('settings:save', async (_, settings: any) => {
  const configDir = path.join(os.homedir(), 'clawd', 'config');
  const configPath = path.join(configDir, 'settings.json');
  
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
    
    // Also update environment for task-helpers.sh
    const envLine = settings.externalActionsEnabled 
      ? 'export EXTERNAL_ACTIONS_ENABLED=true'
      : 'export EXTERNAL_ACTIONS_ENABLED=false';
    const envPath = path.join(os.homedir(), 'clawd', 'config', 'env.sh');
    fs.writeFileSync(envPath, `# Auto-generated by Froggo Dashboard\n${envLine}\nexport RATE_LIMIT_TWEETS=${settings.rateLimitTweets || 10}\nexport RATE_LIMIT_EMAILS=${settings.rateLimitEmails || 20}\n`);
    
    return { success: true };
  } catch (error: any) {
    console.error('[Settings] Save error:', error);
    return { success: false, error: error.message };
  }
});

// ============== TWITTER IPC HANDLERS ==============
ipcMain.handle('twitter:mentions', async () => {
  return new Promise((resolve) => {
    exec('bird mentions --json 2>/dev/null || bird mentions', { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.error('[Twitter] Mentions error:', error);
        resolve({ success: false, mentions: [], error: error.message });
        return;
      }
      try {
        // Try to parse as JSON
        const mentions = JSON.parse(stdout);
        resolve({ success: true, mentions });
      } catch {
        // Return raw text if not JSON
        resolve({ success: true, mentions: [], raw: stdout });
      }
    });
  });
});

ipcMain.handle('twitter:home', async (_, limit?: number) => {
  const countArg = limit ? `--count ${limit}` : '--count 20';
  return new Promise((resolve) => {
    exec(`bird home ${countArg} --json 2>/dev/null || bird home ${countArg}`, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.error('[Twitter] Home error:', error);
        resolve({ success: false, tweets: [], error: error.message });
        return;
      }
      try {
        const tweets = JSON.parse(stdout);
        resolve({ success: true, tweets });
      } catch {
        resolve({ success: true, tweets: [], raw: stdout });
      }
    });
  });
});

ipcMain.handle('twitter:queue-post', async (_, text: string, context?: string) => {
  // Queue tweet for approval via inbox
  const title = text.length > 50 ? `${text.slice(0, 47)}...` : text;
  const cmd = `froggo-db inbox-add --type tweet --title "${title.replace(/"/g, '\\"')}" --content "${text.replace(/"/g, '\\"')}" --channel dashboard`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        console.error('[Twitter] Queue error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, message: 'Tweet queued for approval in Inbox' });
    });
  });
});

// ============== EMAIL IPC HANDLERS ==============
ipcMain.handle('email:unread', async (_, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const cmd = `GOG_ACCOUNT=${acct} gog gmail search "is:unread" --json --limit 20`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.error('[Email] Unread error:', error);
        resolve({ success: false, emails: [], error: error.message });
        return;
      }
      try {
        const emails = JSON.parse(stdout);
        resolve({ success: true, emails, account: acct });
      } catch {
        resolve({ success: true, emails: [], raw: stdout, account: acct });
      }
    });
  });
});

ipcMain.handle('email:search', async (_, query: string, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const escapedQuery = query.replace(/"/g, '\\"');
  const cmd = `GOG_ACCOUNT=${acct} gog gmail search "${escapedQuery}" --json --limit 20`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.error('[Email] Search error:', error);
        resolve({ success: false, emails: [], error: error.message });
        return;
      }
      try {
        const emails = JSON.parse(stdout);
        resolve({ success: true, emails, account: acct });
      } catch {
        resolve({ success: true, emails: [], raw: stdout, account: acct });
      }
    });
  });
});

ipcMain.handle('email:queue-send', async (_, to: string, subject: string, body: string, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const title = `Email to ${to}: ${subject.slice(0, 30)}`;
  const content = `To: ${to}\nSubject: ${subject}\nAccount: ${acct}\n\n${body}`;
  const cmd = `froggo-db inbox-add --type email --title "${title.replace(/"/g, '\\"')}" --content "${content.replace(/"/g, '\\"')}" --channel dashboard`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        console.error('[Email] Queue error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, message: 'Email queued for approval in Inbox' });
    });
  });
});

// ============== CALENDAR IPC HANDLERS ==============
ipcMain.handle('calendar:events', async (_, account?: string, days?: number) => {
  const acct = account || 'kevin.macarthur@bitso.com';
  const daysArg = days ? `--days ${days}` : '--days 7';
  const cmd = `GOG_ACCOUNT=${acct} gog calendar events ${daysArg} --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.error('[Calendar] Events error:', error);
        resolve({ success: false, events: [], error: error.message });
        return;
      }
      try {
        const events = JSON.parse(stdout);
        resolve({ success: true, events, account: acct });
      } catch {
        resolve({ success: true, events: [], raw: stdout, account: acct });
      }
    });
  });
});

// ============== SESSIONS IPC HANDLERS ==============
ipcMain.handle('sessions:list', async () => {
  try {
    const response = await fetch('http://localhost:18789/api/sessions');
    const data = await response.json();
    return { success: true, sessions: data.sessions || [] };
  } catch (error) {
    console.error('[Sessions] List error:', error);
    return { success: false, sessions: [] };
  }
});

ipcMain.handle('sessions:history', async (_, sessionKey: string, limit?: number) => {
  try {
    const limitParam = limit ? `?limit=${limit}` : '';
    const response = await fetch(`http://localhost:18789/api/sessions/${sessionKey}/history${limitParam}`);
    const data = await response.json();
    return { success: true, messages: data.messages || [] };
  } catch (error) {
    console.error('[Sessions] History error:', error);
    return { success: false, messages: [] };
  }
});

// Shell execution for Code Agent Dashboard, Context Control Board
ipcMain.handle('exec:run', async (_, command: string) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  // Use the clawd workspace as default cwd for git commands
  const workDir = path.join(process.env.HOME || '', 'clawd');
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024, // 1MB buffer
      timeout: 30000, // 30s timeout
      cwd: workDir,
    });
    return { success: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (error: any) {
    console.error('[Exec] Run error:', error.message);
    return { success: false, stdout: error.stdout || '', stderr: error.stderr || error.message };
  }
});

// Watch for changes to the approval queue
let queueWatcher: fs.FSWatcher | null = null;
let lastQueueContent = '';

function startQueueWatcher() {
  if (queueWatcher) return;
  
  const queueDir = path.dirname(APPROVAL_QUEUE_PATH);
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }
  
  // Initial content
  try {
    if (fs.existsSync(APPROVAL_QUEUE_PATH)) {
      lastQueueContent = fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8');
    }
  } catch {}
  
  // Watch for changes
  queueWatcher = fs.watch(queueDir, (eventType, filename) => {
    if (filename !== 'queue.json') return;
    
    try {
      const newContent = fs.existsSync(APPROVAL_QUEUE_PATH) 
        ? fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8')
        : '';
      
      if (newContent !== lastQueueContent) {
        lastQueueContent = newContent;
        const data = newContent ? JSON.parse(newContent) : { items: [] };
        
        // Notify renderer of new items
        if (mainWindow && data.items?.length > 0) {
          mainWindow.webContents.send('approvals:updated', data.items);
        }
      }
    } catch (error) {
      console.error('Error watching queue:', error);
    }
  });
  
  console.log('Approval queue watcher started:', APPROVAL_QUEUE_PATH);
}

// Start watcher after window is created
app.whenReady().then(() => {
  setTimeout(startQueueWatcher, 1000);
});
