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
