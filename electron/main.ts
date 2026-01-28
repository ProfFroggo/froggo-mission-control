import { app, BrowserWindow, ipcMain, systemPreferences, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec, execSync } from 'child_process';
import * as os from 'os';
import * as http from 'http';
import { calendarService } from './calendar-service';

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

  // SAFEGUARD: Send cleanup signal before window closes
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      console.log('[Main] Window closing - sending cleanup signal...');
      safeSend('app-closing');
      // Give renderer time to cleanup (mic/camera release)
      // The actual close happens after renderer cleanup
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Safe wrapper for webContents.send to prevent EPIPE crashes
function safeSend(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, ...args);
    } catch (e) {
      // Ignore EPIPE errors (window closing), log others
      if ((e as any).code !== 'EPIPE') {
        console.error(`[SafeSend] Error sending to ${channel}:`, e);
      }
    }
  }
}

// Task notification file watcher
let taskNotifyWatcher: fs.FSWatcher | null = null;
const taskNotifyPath = path.join(os.homedir(), 'clawd', 'data', 'task-notify.json');
let lastTaskNotifyMtime = 0;

// Schedule processor interval
let scheduleProcessorInterval: NodeJS.Timeout | null = null;
const SCHEDULE_CHECK_INTERVAL = 30000; // 30 seconds

// Process scheduled items that are overdue
async function processScheduledItems() {
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  
  // Query for pending items where scheduled_for <= now
  // Fetch all pending and filter in JS (handles various datetime formats)
  const query = `SELECT * FROM schedule WHERE status='pending'`;
  
  exec(`sqlite3 "${dbPath}" "${query}" -json`, { timeout: 10000 }, async (error, stdout) => {
    if (error) {
      console.error('[ScheduleProcessor] Query error:', error.message);
      return;
    }
    
    let items: any[] = [];
    try {
      const trimmed = stdout.trim();
      if (trimmed && trimmed !== '[]') {
        items = JSON.parse(trimmed);
      }
    } catch (e) {
      // No items or parse error - that's fine
      return;
    }
    
    if (items.length === 0) return;
    
    // Filter for overdue items (scheduled_for <= now) handling various datetime formats
    const now = new Date();
    items = items.filter(item => {
      if (!item.scheduled_for) return false;
      const scheduledTime = new Date(item.scheduled_for);
      return scheduledTime <= now;
    });
    
    if (items.length === 0) return;
    
    console.log(`[ScheduleProcessor] Found ${items.length} overdue item(s) to process`);
    
    for (const item of items) {
      console.log(`[ScheduleProcessor] Processing ${item.type}: ${item.id}`);
      
      let execCmd = '';
      let metadata: any = {};
      
      try {
        if (item.metadata) {
          metadata = JSON.parse(item.metadata);
        }
      } catch (e) {
        console.error(`[ScheduleProcessor] Failed to parse metadata for ${item.id}:`, e);
      }
      
      // Build command based on type
      if (item.type === 'tweet') {
        const escapedContent = item.content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        execCmd = `bird tweet "${escapedContent}"`;
      } else if (item.type === 'email') {
        const recipient = (metadata.recipient || metadata.to || '').replace(/"/g, '\\"');
        const account = metadata.account || '';
        
        // GUARD: Skip emails with missing recipient or account (prevents gog auth loops)
        if (!recipient || !recipient.trim()) {
          console.error(`[ScheduleProcessor] Email ${item.id} has no recipient - marking as failed`);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='Missing recipient' WHERE id='${item.id}'"`, () => {});
          continue;
        }
        if (!account || !account.trim()) {
          console.error(`[ScheduleProcessor] Email ${item.id} has no account configured - marking as failed`);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='Missing GOG account' WHERE id='${item.id}'"`, () => {});
          continue;
        }
        
        const subject = (metadata.subject || 'No subject').replace(/"/g, '\\"');
        const body = item.content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        execCmd = `GOG_ACCOUNT="${account}" gog gmail send --to "${recipient}" --subject "${subject}" --body "${body}"`;
      } else {
        console.warn(`[ScheduleProcessor] Unknown type: ${item.type}`);
        // Mark as failed with unknown type error
        exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='Unknown type: ${item.type}' WHERE id='${item.id}'"`, () => {});
        continue;
      }
      
      console.log(`[ScheduleProcessor] Executing: ${execCmd.slice(0, 100)}...`);
      
      // Execute the command
      exec(execCmd, { timeout: 60000 }, (execError, execStdout, execStderr) => {
        if (execError) {
          console.error(`[ScheduleProcessor] Failed to send ${item.id}:`, execError.message);
          const errorMsg = (execError.message || '').replace(/'/g, "''").slice(0, 500);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='${errorMsg}' WHERE id='${item.id}'"`, () => {});
          
          // Notify renderer of failure
          safeSend('schedule-processed', { 
            id: item.id, 
            type: item.type, 
            success: false, 
            error: execError.message 
          });
        } else {
          console.log(`[ScheduleProcessor] Successfully sent ${item.id}`);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='sent', sent_at=datetime('now') WHERE id='${item.id}'"`, () => {});
          
          // Notify renderer of success
          safeSend('schedule-processed', { 
            id: item.id, 
            type: item.type, 
            success: true 
          });
        }
      });
    }
  });
}

function startScheduleProcessor() {
  console.log('[ScheduleProcessor] Starting schedule processor (every 30s)');
  // Run immediately on start
  processScheduledItems();
  // Then run every 30 seconds
  scheduleProcessorInterval = setInterval(processScheduledItems, SCHEDULE_CHECK_INTERVAL);
}

function stopScheduleProcessor() {
  if (scheduleProcessorInterval) {
    clearInterval(scheduleProcessorInterval);
    scheduleProcessorInterval = null;
    console.log('[ScheduleProcessor] Stopped');
  }
}

function startTaskNotifyWatcher() {
  // Ensure parent directory exists
  const dir = path.dirname(taskNotifyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Watch for changes to the notification file
  try {
    taskNotifyWatcher = fs.watch(path.dirname(taskNotifyPath), (eventType, filename) => {
      if (filename === 'task-notify.json' && mainWindow && !mainWindow.isDestroyed()) {
        try {
          const stat = fs.statSync(taskNotifyPath);
          // Only process if file was modified after last check
          if (stat.mtimeMs > lastTaskNotifyMtime) {
            lastTaskNotifyMtime = stat.mtimeMs;
            const content = fs.readFileSync(taskNotifyPath, 'utf-8');
            const notification = JSON.parse(content);
            console.log('[TaskNotify] New task notification:', notification);
            // Send to renderer with error handling
            try {
              mainWindow.webContents.send('task-notification', notification);
            } catch (sendError) {
              // Window might be closing, ignore EPIPE errors
              if ((sendError as any).code !== 'EPIPE') {
                console.error('[TaskNotify] Send error:', sendError);
              }
            }
          }
        } catch (e) {
          // File might not exist or be invalid, ignore
        }
      }
    });
    console.log('[TaskNotify] Watching for task notifications at:', taskNotifyPath);
  } catch (e) {
    console.error('[TaskNotify] Failed to start watcher:', e);
  }
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
  
  // Start task notification watcher
  startTaskNotifyWatcher();
  
  // Start schedule processor (auto-send overdue items)
  startScheduleProcessor();
  
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
  // Clean up task notify watcher
  if (taskNotifyWatcher) {
    taskNotifyWatcher.close();
    taskNotifyWatcher = null;
  }
  // Clean up schedule processor
  stopScheduleProcessor();
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

// Get real sessions from Clawdbot CLI (more reliable than HTTP API)
ipcMain.handle('gateway:sessions:list', async () => {
  return new Promise((resolve) => {
    exec('clawdbot sessions list --json', { timeout: 10000 }, (error, stdout) => {
      if (error) {
        console.error('[Gateway] Sessions list error:', error);
        resolve({ success: false, sessions: [], error: error.message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({ success: true, sessions: data.sessions || [], count: data.count || 0 });
      } catch (e) {
        console.error('[Gateway] Sessions parse error:', e);
        resolve({ success: false, sessions: [], error: 'Parse error' });
      }
    });
  });
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
ipcMain.handle('tasks:sync', async (_, task: { 
  id: string; 
  title: string; 
  status: string; 
  project?: string; 
  assignedTo?: string; 
  description?: string;
  priority?: string;
  dueDate?: number;
}) => {
  console.log('[Tasks] Sync called with:', JSON.stringify(task));
  console.log('[Tasks] Status being set:', task.status);
  
  // Check if task exists
  return new Promise((resolve) => {
    exec(`froggo-db task-get "${task.id}"`, { timeout: 5000 }, (getError, getStdout) => {
      // If task exists (stdout has JSON), just return success
      if (!getError && getStdout && getStdout.includes('"id"')) {
        console.log('[Tasks] Task already exists:', task.id);
        resolve({ success: true });
        return;
      }
      
      // Task doesn't exist, create it via direct SQL for more control
      const title = task.title.replace(/'/g, "''");
      const desc = (task.description || '').replace(/'/g, "''");
      const project = (task.project || 'Default').replace(/'/g, "''");
      const dueStr = task.dueDate ? new Date(task.dueDate).toISOString() : null;
      const nowMs = Date.now();
      
      const insertCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT OR REPLACE INTO tasks (id, title, description, status, project, assigned_to, priority, due_date, created_at, updated_at) VALUES ('${task.id}', '${title}', '${desc}', '${task.status || 'todo'}', '${project}', '${task.assignedTo || ''}', '${task.priority || ''}', ${dueStr ? `'${dueStr}'` : 'NULL'}, ${nowMs}, ${nowMs})"`;
      
      console.log('[Tasks] Creating task via SQL');
      
      exec(insertCmd, { timeout: 10000 }, (addError, addStdout, addStderr) => {
        if (addError) {
          console.error('[Tasks] Create error:', addError.message);
          console.error('[Tasks] stderr:', addStderr);
          resolve({ success: false, error: addError.message });
        } else {
          console.log('[Tasks] Created:', task.id);
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

ipcMain.handle('tasks:update', async (_, taskId: string, updates: { status?: string; assignedTo?: string; planningNotes?: string }) => {
  // Handle planningNotes directly via SQL since froggo-db CLI doesn't support it yet
  if (updates.planningNotes !== undefined) {
    const escapedNotes = updates.planningNotes.replace(/'/g, "''"); // SQL escape
    const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE tasks SET planning_notes='${escapedNotes}', updated_at=strftime('%s','now')*1000 WHERE id='${taskId}'"`;
    
    return new Promise((resolve) => {
      exec(sqlCmd, { timeout: 10000 }, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
  
  // For other fields, use froggo-db CLI
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

// Poke a task - send message to Gateway main session asking for status update
ipcMain.handle('tasks:poke', async (_, taskId: string, title: string) => {
  console.log(`[Tasks] Poke: ${taskId} - ${title}`);
  
  const pokeMessage = `🫵 Poke: What's the status of "${title}"? (${taskId})`;
  
  return new Promise((resolve) => {
    // Send poke message to Discord channel where Brain listens
    // Using clawdbot message send which is quick and async
    const escapedMessage = pokeMessage.replace(/"/g, '\\"').replace(/`/g, '\\`');
    const discordChannelId = '1465351776759975977';  // #get_shit_done channel
    const cmd = `/opt/homebrew/bin/clawdbot message send --target ${discordChannelId} --message "${escapedMessage}" --channel discord`;
    
    exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Tasks] Poke error:', error.message, stderr);
        resolve({ success: false, error: error.message });
        return;
      }
      
      console.log('[Tasks] Poke sent to Discord:', stdout.trim());
      resolve({ success: true, message: pokeMessage });
    });
  });
});

// ============== SUBTASKS IPC HANDLERS ==============
const froggoDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');

ipcMain.handle('subtasks:list', async (_, taskId: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM subtasks WHERE task_id='${taskId}' ORDER BY position, created_at" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        console.error('[Subtasks] List error:', error);
        resolve({ success: false, subtasks: [] });
        return;
      }
      try {
        const subtasks = JSON.parse(stdout || '[]').map((st: any) => ({
          id: st.id,
          taskId: st.task_id,
          title: st.title,
          description: st.description,
          completed: st.completed === 1,
          completedAt: st.completed_at,
          completedBy: st.completed_by,
          assignedTo: st.assigned_to,
          position: st.position,
          createdAt: st.created_at,
        }));
        resolve({ success: true, subtasks });
      } catch {
        resolve({ success: true, subtasks: [] });
      }
    });
  });
});

ipcMain.handle('subtasks:add', async (_, taskId: string, subtask: { id: string; title: string; description?: string; assignedTo?: string }) => {
  console.log('[Subtasks] Add called:', { taskId, subtask });
  
  // Validate inputs
  if (!taskId || !subtask?.id || !subtask?.title) {
    console.error('[Subtasks] Invalid input:', { taskId, subtask });
    return { success: false, error: 'Invalid input: taskId, subtask.id, and subtask.title are required' };
  }
  
  const now = Date.now();
  const escapedTitle = subtask.title.replace(/'/g, "''");
  const escapedDesc = (subtask.description || '').replace(/'/g, "''");
  
  // Get next position
  return new Promise((resolve) => {
    exec(`sqlite3 "${froggoDbPath}" "SELECT COALESCE(MAX(position), -1) + 1 FROM subtasks WHERE task_id='${taskId}'"`, (posError, posOut, posStderr) => {
      if (posError) {
        console.error('[Subtasks] Position query error:', posError.message, posStderr);
        // Continue with position 0 even if query fails
      }
      const position = parseInt(posOut?.trim() || '0', 10) || 0;
      console.log('[Subtasks] Position:', position);
      
      const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO subtasks (id, task_id, title, description, assigned_to, position, created_at, updated_at) VALUES ('${subtask.id}', '${taskId}', '${escapedTitle}', '${escapedDesc}', ${subtask.assignedTo ? "'" + subtask.assignedTo + "'" : 'NULL'}, ${position}, ${now}, ${now})"`;
      console.log('[Subtasks] Insert command:', cmd.slice(0, 200) + '...');
      
      exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Subtasks] Add error:', error.message);
          console.error('[Subtasks] stderr:', stderr);
          resolve({ success: false, error: error.message });
        } else {
          console.log('[Subtasks] Insert success:', subtask.id);
          // Also log activity (fire and forget)
          exec(`sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, action, message, timestamp) VALUES ('${taskId}', 'subtask_added', 'Added subtask: ${escapedTitle}', ${now})"`, () => {});
          resolve({ success: true, id: subtask.id });
        }
      });
    });
  });
});

ipcMain.handle('subtasks:update', async (_, subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => {
  const now = Date.now();
  const sets: string[] = [`updated_at=${now}`];
  
  if (updates.completed !== undefined) {
    sets.push(`completed=${updates.completed ? 1 : 0}`);
    if (updates.completed) {
      sets.push(`completed_at=${now}`);
      if (updates.completedBy) sets.push(`completed_by='${updates.completedBy}'`);
    } else {
      sets.push(`completed_at=NULL`);
      sets.push(`completed_by=NULL`);
    }
  }
  if (updates.title) sets.push(`title='${updates.title.replace(/'/g, "''")}'`);
  if (updates.assignedTo !== undefined) {
    sets.push(updates.assignedTo ? `assigned_to='${updates.assignedTo}'` : `assigned_to=NULL`);
  }
  
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE subtasks SET ${sets.join(', ')} WHERE id='${subtaskId}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        console.error('[Subtasks] Update error:', error);
        resolve({ success: false, error: error.message });
      } else {
        // Log activity for completion changes
        if (updates.completed !== undefined) {
          exec(`sqlite3 "${froggoDbPath}" "SELECT task_id, title FROM subtasks WHERE id='${subtaskId}'"`, (_, stOut) => {
            try {
              const [taskId, title] = stOut?.trim().split('|') || [];
              if (taskId) {
                const action = updates.completed ? 'subtask_completed' : 'subtask_uncompleted';
                const message = updates.completed 
                  ? `Completed: ${title}${updates.completedBy ? ' by ' + updates.completedBy : ''}`
                  : `Reopened: ${title}`;
                exec(`sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) VALUES ('${taskId}', '${action}', '${message.replace(/'/g, "''")}', ${updates.completedBy ? "'" + updates.completedBy + "'" : 'NULL'}, ${now})"`, () => {});
              }
            } catch {}
          });
        }
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('subtasks:delete', async (_, subtaskId: string) => {
  return new Promise((resolve) => {
    // Get task_id and title first for activity log
    exec(`sqlite3 "${froggoDbPath}" "SELECT task_id, title FROM subtasks WHERE id='${subtaskId}'"`, (_, stOut) => {
      const [taskId, title] = stOut?.trim().split('|') || [];
      
      const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM subtasks WHERE id='${subtaskId}'"`;
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          if (taskId) {
            exec(`sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, action, message, timestamp) VALUES ('${taskId}', 'subtask_deleted', 'Deleted subtask: ${(title || '').replace(/'/g, "''")}', ${Date.now()})"`, () => {});
          }
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('subtasks:reorder', async (_, subtaskIds: string[]) => {
  const now = Date.now();
  const updates = subtaskIds.map((id, idx) => 
    `UPDATE subtasks SET position=${idx}, updated_at=${now} WHERE id='${id}';`
  ).join(' ');
  
  const cmd = `sqlite3 "${froggoDbPath}" "${updates}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

// ============== TASK ACTIVITY IPC HANDLERS ==============
ipcMain.handle('activity:list', async (_, taskId: string, limit?: number) => {
  const lim = limit || 50;
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM task_activity WHERE task_id='${taskId}' ORDER BY timestamp DESC LIMIT ${lim}" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        console.error('[Activity] List error:', error);
        resolve({ success: false, activities: [] });
        return;
      }
      try {
        const activities = JSON.parse(stdout || '[]').map((a: any) => ({
          id: a.id,
          taskId: a.task_id,
          agentId: a.agent_id,
          action: a.action,
          message: a.message,
          details: a.details,
          timestamp: a.timestamp,
        }));
        resolve({ success: true, activities });
      } catch {
        resolve({ success: true, activities: [] });
      }
    });
  });
});

ipcMain.handle('activity:add', async (_, taskId: string, entry: { action: string; message: string; agentId?: string; details?: string }) => {
  const now = Date.now();
  const escapedMessage = entry.message.replace(/'/g, "''");
  const escapedDetails = entry.details ? entry.details.replace(/'/g, "''") : null;
  
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, agent_id, action, message, details, timestamp) VALUES ('${taskId}', ${entry.agentId ? "'" + entry.agentId + "'" : 'NULL'}, '${entry.action}', '${escapedMessage}', ${escapedDetails ? "'" + escapedDetails + "'" : 'NULL'}, ${now})"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
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

// ============== EMAIL IPC HANDLERS ==============
ipcMain.handle('email:send', async (_, options: { to: string; subject: string; body: string; account?: string }) => {
  console.log('[Email:send] Sending email to:', options.to);
  
  // GUARD: Require recipient and account to prevent auth loops
  if (!options.to || !options.to.trim()) {
    console.error('[Email:send] Missing recipient');
    return { success: false, error: 'Missing email recipient' };
  }
  if (!options.account || !options.account.trim()) {
    console.error('[Email:send] Missing account - cannot send without GOG_ACCOUNT');
    return { success: false, error: 'Missing account - please specify which email account to send from' };
  }
  
  return new Promise((resolve) => {
    // Escape for shell
    const escapedTo = options.to.replace(/"/g, '\\"');
    const escapedSubject = (options.subject || 'No Subject').replace(/"/g, '\\"');
    const escapedBody = options.body.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    const cmd = `GOG_ACCOUNT="${options.account}" gog gmail send --to "${escapedTo}" --subject "${escapedSubject}" --body "${escapedBody}"`;
    console.log('[Email:send] Command:', cmd.slice(0, 100) + '...');
    
    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Email:send] Error:', error.message, stderr);
        resolve({ success: false, error: error.message });
      } else {
        console.log('[Email:send] Sent successfully:', stdout);
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// ============== INBOX IPC HANDLERS (froggo-db backed) ==============
// Add inbox item with custom metadata (used for Stage 2 email items)
ipcMain.handle('inbox:addWithMetadata', async (_, item: { 
  type: string; 
  title: string; 
  content: string; 
  context?: string; 
  channel?: string;
  metadata?: string;
}) => {
  console.log('[Inbox:addWithMetadata] Adding item:', item.title);
  
  return new Promise((resolve) => {
    const now = Date.now();
    const escapedTitle = item.title.replace(/'/g, "''");
    const escapedContent = item.content.replace(/'/g, "''");
    const escapedContext = (item.context || '').replace(/'/g, "''");
    const escapedMetadata = (item.metadata || '{}').replace(/'/g, "''");
    
    const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, metadata, created) VALUES ('${item.type}', '${escapedTitle}', '${escapedContent}', '${escapedContext}', 'pending', '${item.channel || 'system'}', '${escapedMetadata}', datetime('now'))"`;
    
    exec(sqlCmd, { timeout: 10000 }, (error) => {
      if (error) {
        console.error('[Inbox:addWithMetadata] Error:', error);
        resolve({ success: false, error: error.message });
      } else {
        console.log('[Inbox:addWithMetadata] Added successfully');
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('inbox:list', async (_, status?: string) => {
  // Default to 'pending' if no status specified - we only want pending items in the inbox
  const effectiveStatus = status || 'pending';
  
  return new Promise((resolve) => {
    // Query directly via sqlite3
    const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE status='${effectiveStatus}' ORDER BY created DESC LIMIT 50" -json`;
    
    console.log('[Inbox:list] Executing query for status:', effectiveStatus);
    console.log('[Inbox:list] Command:', sqlCmd);
    
    exec(sqlCmd, { timeout: 5000 }, (err, jsonOut, stderr) => {
      if (err) {
        console.error('[Inbox:list] Exec error:', err);
        console.error('[Inbox:list] Stderr:', stderr);
        resolve({ success: false, items: [], error: err.message });
      } else {
        try {
          console.log('[Inbox:list] Raw output length:', jsonOut?.length || 0);
          const items = JSON.parse(jsonOut || '[]');
          console.log('[Inbox:list] SUCCESS - Parsed', items.length, 'items with status:', effectiveStatus);
          console.log('[Inbox:list] First item:', items[0] ? JSON.stringify(items[0]).substring(0, 100) : 'none');
          resolve({ success: true, items });
        } catch (e) {
          console.error('[Inbox:list] JSON Parse error:', e);
          console.error('[Inbox:list] Raw output:', jsonOut);
          resolve({ success: false, items: [], error: (e as Error).message });
        }
      }
    });
  });
});

ipcMain.handle('inbox:add', async (_, item: { type: string; title: string; content: string; context?: string; channel?: string }) => {
  const escapedTitle = item.title.replace(/"/g, '\\"');
  const escapedContent = item.content.replace(/"/g, '\\"');
  const contextArg = item.context ? `--context "${item.context.replace(/"/g, '\\"')}"` : '';
  const channelArg = item.channel ? `--channel ${item.channel}` : '';
  
  // Run injection detection on content
  const injectionScriptPath = path.join(os.homedir(), 'clawd', 'scripts', 'injection-detect.sh');
  
  return new Promise((resolve) => {
    // Escape content for shell - use base64 to avoid shell injection issues
    const contentBase64 = Buffer.from(item.content).toString('base64');
    const detectCmd = `echo "${contentBase64}" | base64 -d | ${injectionScriptPath}`;
    
    exec(detectCmd, { timeout: 5000 }, (detectError, detectStdout) => {
      let injectionResult = null;
      
      try {
        if (detectStdout) {
          injectionResult = JSON.parse(detectStdout.trim());
          console.log('[Inbox] Injection detection result:', injectionResult);
        }
      } catch (e) {
        console.error('[Inbox] Failed to parse injection detection result:', e);
      }
      
      // Build metadata with injection detection result
      let metadata: any = {};
      if (injectionResult && injectionResult.detected) {
        metadata.injectionWarning = {
          detected: true,
          type: injectionResult.type,
          pattern: injectionResult.pattern,
          risk: injectionResult.risk,
        };
        console.log(`[Inbox] ⚠️ INJECTION DETECTED: ${injectionResult.type} (${injectionResult.risk}) - pattern: "${injectionResult.pattern}"`);
      }
      
      // Add to inbox via direct SQL to include metadata
      const now = Date.now();
      const metadataJson = JSON.stringify(metadata).replace(/'/g, "''");
      const escapedTitleSql = item.title.replace(/'/g, "''");
      const escapedContentSql = item.content.replace(/'/g, "''");
      const escapedContextSql = (item.context || '').replace(/'/g, "''");
      
      const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, metadata, created) VALUES ('${item.type}', '${escapedTitleSql}', '${escapedContentSql}', '${escapedContextSql}', 'pending', '${item.channel || 'unknown'}', '${metadataJson}', datetime('now'))"`;
      
      exec(sqlCmd, { timeout: 10000 }, (error) => {
        if (error) {
          console.error('[Inbox] Add error:', error);
          resolve({ success: false, error: error.message });
        } else {
          resolve({ 
            success: true, 
            injectionWarning: injectionResult?.detected ? injectionResult : null 
          });
        }
      });
    });
  });
});

ipcMain.handle('inbox:update', async (_, id: number | string, updates: { status?: string; feedback?: string }) => {
  console.log('[Inbox:update] Called with id:', id, 'type:', typeof id, 'updates:', updates);
  
  // Skip if it's a task-review item (those should go through tasks:update)
  if (typeof id === 'string' && id.startsWith('task-review-')) {
    console.log('[Inbox:update] Skipping task-review item');
    return { success: true, skipped: true };
  }
  
  const sets: string[] = [];
  if (updates.status) sets.push(`status='${updates.status}'`);
  if (updates.feedback) sets.push(`feedback='${updates.feedback.replace(/'/g, "''")}'`);
  if (updates.status) sets.push(`reviewed_at=datetime('now')`);
  
  if (sets.length === 0) return { success: false };
  
  const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET ${sets.join(', ')} WHERE id=${id}"`;
  console.log('[Inbox:update] Running:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      console.log('[Inbox:update] Result - error:', error, 'stdout:', stdout, 'stderr:', stderr);
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

// ============== INBOX REVISION HANDLERS ==============
// List items that need revision (for agents to process)
ipcMain.handle('inbox:listRevisions', async () => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE status='needs-revision' ORDER BY created DESC" -json`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        console.error('[Inbox] List revisions error:', error);
        resolve({ success: false, items: [] });
        return;
      }
      try {
        const items = JSON.parse(stdout || '[]');
        resolve({ success: true, items });
      } catch {
        resolve({ success: true, items: [] });
      }
    });
  });
});

// Submit revised content for an inbox item
// This creates a new pending item with the revised content and marks the original as 'revised'
ipcMain.handle('inbox:submitRevision', async (_, originalId: number, revisedContent: string, revisedTitle?: string) => {
  console.log(`[Inbox] Submit revision for item ${originalId}`);
  
  return new Promise((resolve) => {
    // First, get the original item
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE id=${originalId}" -json`, (getErr, getOut) => {
      if (getErr) {
        console.error('[Inbox] Get original error:', getErr);
        resolve({ success: false, error: 'Failed to get original item' });
        return;
      }
      
      try {
        const items = JSON.parse(getOut || '[]');
        if (items.length === 0) {
          resolve({ success: false, error: 'Original item not found' });
          return;
        }
        
        const original = items[0];
        const newTitle = revisedTitle || `[Revised] ${original.title}`;
        const escapedTitle = newTitle.replace(/'/g, "''");
        const escapedContent = revisedContent.replace(/'/g, "''");
        const context = `Revision of inbox item #${originalId}. Original feedback: ${(original.feedback || 'none').replace(/'/g, "''")}`;
        
        // Create new pending item with revised content
        const insertCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, created) VALUES ('${original.type}', '${escapedTitle}', '${escapedContent}', '${context}', 'pending', '${original.source_channel || 'revision'}', datetime('now'))"`;
        
        exec(insertCmd, { timeout: 5000 }, (insertErr) => {
          if (insertErr) {
            console.error('[Inbox] Insert revision error:', insertErr);
            resolve({ success: false, error: insertErr.message });
            return;
          }
          
          // Mark original as 'revised' (completed state)
          const updateCmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET status='revised', reviewed_at=datetime('now') WHERE id=${originalId}"`;
          
          exec(updateCmd, { timeout: 5000 }, (updateErr) => {
            if (updateErr) {
              console.error('[Inbox] Update original error:', updateErr);
              // Still return success since the revision was created
            }
            
            console.log(`[Inbox] Revision submitted: original #${originalId} -> new pending item`);
            
            // Notify frontend of inbox update
            safeSend('inbox-updated', { revision: true, originalId });
            
            resolve({ success: true, message: 'Revision submitted for approval' });
          });
        });
      } catch (e: any) {
        console.error('[Inbox] Parse error:', e);
        resolve({ success: false, error: e.message });
      }
    });
  });
});

// Get revision details for a specific item (includes original content and feedback)
ipcMain.handle('inbox:getRevisionContext', async (_, itemId: number) => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE id=${itemId} AND status='needs-revision'" -json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      try {
        const items = JSON.parse(stdout || '[]');
        if (items.length === 0) {
          resolve({ success: false, error: 'Item not found or not in needs-revision status' });
          return;
        }
        
        const item = items[0];
        resolve({
          success: true,
          item: {
            id: item.id,
            type: item.type,
            title: item.title,
            originalContent: item.content,
            feedback: item.feedback,
            context: item.context,
            created: item.created,
            sourceChannel: item.source_channel,
          }
        });
      } catch {
        resolve({ success: false, error: 'Failed to parse item' });
      }
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    safeSend('navigate-to', view);
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

// ============== SCHEDULE IPC HANDLERS ==============
const scheduleDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');

ipcMain.handle('schedule:list', async () => {
  console.log('[Schedule:list] Called');
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
      console.log('[Schedule:list] Raw output:', stdout?.slice(0, 200));
      try {
        // JSON output may span multiple lines - find [ and take everything from there
        const trimmed = stdout.trim();
        const jsonStart = trimmed.indexOf('[');
        const jsonStr = jsonStart >= 0 ? trimmed.slice(jsonStart) : '[]';
        console.log('[Schedule:list] JSON extracted, length:', jsonStr.length);
        const items = JSON.parse(jsonStr).map((row: any) => ({
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
        console.log('[Schedule:list] Parsed', items.length, 'items');
        resolve({ success: true, items });
      } catch (e) {
        console.error('[Schedule:list] Error:', e);
        resolve({ success: true, items: [] });
      }
    });
  });
});

ipcMain.handle('schedule:add', async (_, item: { type: string; content: string; scheduledFor: string; metadata?: any }) => {
  console.log('[Schedule:add] Received:', JSON.stringify(item, null, 2));
  
  const id = `sched-${Date.now()}`;
  // Escape for SQL single-quoted strings: double the single quotes
  const escapedContent = item.content.replace(/'/g, "''");
  const escapedMetadata = item.metadata 
    ? JSON.stringify(item.metadata).replace(/'/g, "''")
    : null;
  
  console.log('[Schedule:add] Escaped metadata:', escapedMetadata);
  
  return new Promise((resolve) => {
    // First ensure the schedule table exists
    const createTableSql = `
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
    `;
    
    exec(`sqlite3 "${scheduleDbPath}" "${createTableSql}"`, { timeout: 5000 }, (createError) => {
      if (createError) {
        console.error('[Schedule:add] Failed to create table:', createError.message);
        resolve({ success: false, error: 'Failed to initialize schedule table: ' + createError.message });
        return;
      }
      
      // Build SQL and write to temp file to avoid shell escaping nightmares
      const metadataVal = escapedMetadata ? `'${escapedMetadata}'` : 'NULL';
      const sql = `INSERT INTO schedule (id, type, content, scheduled_for, metadata) VALUES ('${id}', '${item.type}', '${escapedContent}', '${item.scheduledFor}', ${metadataVal});`;
      const tmpFile = `/tmp/schedule-${id}.sql`;
      
      console.log('[Schedule:add] SQL:', sql);
      console.log('[Schedule:add] Writing to:', tmpFile);
      
      fs.writeFileSync(tmpFile, sql);
      const insertCmd = `sqlite3 "${scheduleDbPath}" < "${tmpFile}"`;
      
      exec(insertCmd, { timeout: 5000 }, (error) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}
      
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      // ADD TO APPROVAL QUEUE
      try {
        let queueData: { description: string; items: any[] } = { 
          description: "Approval queue - Froggo adds items here, dashboard picks them up", 
          items: [] 
        };
        if (fs.existsSync(APPROVAL_QUEUE_PATH)) {
          queueData = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
        }
        
        const approvalEntry = {
          id: `approval-${id}`,
          type: 'scheduled-post',
          platform: item.type,
          content: item.content,
          scheduledFor: item.scheduledFor,
          createdAt: new Date().toISOString(),
          status: 'pending',
          scheduleId: id,
          metadata: item.metadata || {}
        };
        
        queueData.items.push(approvalEntry);
        fs.writeFileSync(APPROVAL_QUEUE_PATH, JSON.stringify(queueData, null, 2));
        console.log('[Schedule:add] Added to approval queue:', approvalEntry.id);
      } catch (queueError) {
        console.error('[Schedule:add] Failed to add to approval queue:', queueError);
        // Non-fatal, continue with scheduling
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
    }); // Close createTableSql exec callback
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
          const recipient = meta.recipient || meta.to || '';
          const account = meta.account || '';
          
          // GUARD: Require recipient and account for email sends
          if (!recipient || !recipient.trim()) {
            resolve({ success: false, error: 'Missing email recipient' });
            return;
          }
          if (!account || !account.trim()) {
            resolve({ success: false, error: 'Missing GOG account - cannot send email without account' });
            return;
          }
          
          // Create draft instead of sending directly (requires approval)
          execCmd = `GOG_ACCOUNT="${account}" gog gmail drafts create --to "${recipient}" --subject "${meta.subject || 'No subject'}" --body "${item.content.replace(/"/g, '\\"')}"`;
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

// Append to file
ipcMain.handle('fs:append', async (_, filePath: string, content: string) => {
  try {
    // Resolve ~ to home directory if present
    const resolvedPath = filePath.startsWith('~') 
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;
    
    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.appendFileSync(resolvedPath, content);
    return { success: true, path: resolvedPath };
  } catch (error: any) {
    console.error('[FS] Append error:', error);
    return { success: false, error: error.message };
  }
});

// Execute SQL against froggo.db
ipcMain.handle('db:exec', async (_, query: string, params?: any[]) => {
  return new Promise((resolve) => {
    const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
    
    // For safety, only allow SELECT and INSERT statements from the renderer
    const queryLower = query.trim().toLowerCase();
    if (!queryLower.startsWith('select') && !queryLower.startsWith('insert')) {
      resolve({ success: false, error: 'Only SELECT and INSERT queries are allowed from renderer' });
      return;
    }
    
    // Escape params and build command
    let finalQuery = query;
    if (params && params.length > 0) {
      // Simple param substitution (replace ? with escaped values)
      params.forEach(param => {
        const escaped = String(param).replace(/'/g, "''");
        finalQuery = finalQuery.replace('?', `'${escaped}'`);
      });
    }
    
    const cmd = `sqlite3 "${dbPath}" "${finalQuery.replace(/"/g, '\\"')}" -json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[DB] Exec error:', error, stderr);
        resolve({ success: false, error: error.message });
        return;
      }
      
      try {
        // For INSERT, stdout might be empty
        if (queryLower.startsWith('insert')) {
          resolve({ success: true, result: [] });
        } else {
          const result = JSON.parse(stdout || '[]');
          resolve({ success: true, result });
        }
      } catch (parseError: any) {
        console.error('[DB] Parse error:', parseError);
        resolve({ success: false, error: 'Failed to parse database result' });
      }
    });
  });
});

// ============== MEDIA UPLOAD IPC HANDLERS ==============
const uploadsDir = path.join(os.homedir(), 'clawd', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload media file (returns file path for scheduling)
ipcMain.handle('media:upload', async (_, fileName: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueFileName = `${timestamp}-${baseName}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    fs.writeFileSync(filePath, buffer);
    const stats = fs.statSync(filePath);
    
    console.log('[Media] Uploaded:', uniqueFileName, 'size:', stats.size);
    
    return { 
      success: true, 
      path: filePath,
      fileName: uniqueFileName,
      size: stats.size 
    };
  } catch (error: any) {
    console.error('[Media] Upload error:', error);
    return { success: false, error: error.message };
  }
});

// Delete media file
ipcMain.handle('media:delete', async (_, filePath: string) => {
  try {
    // Verify file is in uploads directory (security check)
    if (!filePath.startsWith(uploadsDir)) {
      return { success: false, error: 'Invalid file path' };
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[Media] Deleted:', filePath);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[Media] Delete error:', error);
    return { success: false, error: error.message };
  }
});

// Clean up old uploads (7 days)
ipcMain.handle('media:cleanup', async () => {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log('[Media] Cleaned up old file:', file);
      }
    }
    
    console.log('[Media] Cleanup complete:', deletedCount, 'files deleted');
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('[Media] Cleanup error:', error);
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

// ============== AI CONTENT GENERATION ==============
// Load Anthropic API key from environment or config
let anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
try {
  const keyPath = path.join(os.homedir(), '.clawdbot', 'anthropic.key');
  if (!anthropicApiKey && fs.existsSync(keyPath)) {
    anthropicApiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  }
} catch {}

ipcMain.handle('ai:generate-content', async (_, prompt: string, type: 'ideas' | 'draft' | 'cleanup' | 'chat') => {
  console.log('[AI] Generate content called:', { type, promptLength: prompt.length, hasKey: !!anthropicApiKey });
  
  if (!anthropicApiKey) {
    console.error('[AI] No Anthropic API key configured!');
    return { success: false, error: 'No API key' };
  }
  
  let systemPrompt: string;
  let maxTokens = 1024;
  
  if (type === 'cleanup') {
    // Fast cleanup for transcription errors - very concise prompt
    systemPrompt = `Fix transcription errors in the text. Only correct obvious mistakes, preserve meaning. Return ONLY the corrected text.`;
    maxTokens = 256;
  } else if (type === 'chat') {
    // Chat mode for research/planning agents
    systemPrompt = prompt.includes('[RESEARCH]') 
      ? `You are an X/Twitter research agent. Help research trends, competitors, topics, and content strategies. Be concise and actionable.`
      : `You are an X/Twitter content planning agent. Help plan, strategize, and create engaging content. Be concise and actionable.`;
  } else if (type === 'ideas') {
    systemPrompt = `You are a social media content strategist for X (Twitter). Generate 5 unique post ideas/angles based on the given topic. Each idea should:
- Be engaging and suitable for X/Twitter
- Have a different angle or approach
- Be concise (can fit in 280 characters)
- Include relevant hashtag suggestions where appropriate

Format your response as a JSON array of objects with "idea" and "hook" fields. Example:
[{"idea": "Post idea text here", "hook": "Why this works: explanation"}]`;
  } else {
    systemPrompt = `You are a social media copywriter for X (Twitter). Write a compelling post draft based on the given topic. The post should:
- Be under 280 characters
- Be engaging and shareable
- Include relevant hashtags if appropriate
- Have a strong hook

Return just the tweet text, nothing else.`;
  }

  // Use Anthropic API directly via fetch
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] API error:', response.status, errText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    console.log('[AI] Response length:', content.length);

    if (type === 'cleanup') {
      // Return cleaned text directly
      return { success: true, cleaned: content.trim() };
    } else if (type === 'chat') {
      // Return chat response
      return { success: true, response: content.trim() };
    } else if (type === 'ideas') {
      try {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const ideas = JSON.parse(jsonMatch[0]);
          return { success: true, ideas };
        } else {
          // Fallback: split by newlines
          const ideas = content.trim().split('\n').filter((l: string) => l.trim()).map((line: string) => ({
            idea: line.replace(/^\d+\.\s*/, '').trim(),
            hook: ''
          }));
          return { success: true, ideas };
        }
      } catch (e) {
        console.error('[AI] Parse error:', e);
        return { success: true, ideas: [{ idea: content.trim(), hook: '' }] };
      }
    } else {
      return { success: true, draft: content.trim() };
    }
  } catch (e: any) {
    console.error('[AI] Error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============== TWITTER IPC HANDLERS ==============
const BIRD_PATH = '/opt/homebrew/bin/bird';
const execEnv = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` };

// Startup test: verify bird CLI is available
exec(`${BIRD_PATH} --version`, { timeout: 5000, env: execEnv }, (error, stdout, stderr) => {
  if (error) {
    console.error('[Twitter] STARTUP TEST FAILED: bird CLI not available!', error.message);
    console.error('[Twitter] stderr:', stderr);
  } else {
    console.log('[Twitter] STARTUP TEST OK: bird version:', stdout.trim());
  }
});

ipcMain.handle('twitter:mentions', async () => {
  console.log('[Twitter] Mentions handler called');
  
  return new Promise((resolve) => {
    try {
      // Use JSON output from bird with full path and extended PATH
      exec(`${BIRD_PATH} mentions --json`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: execEnv }, (error, stdout, stderr) => {
        console.log('[Twitter] exec completed, error:', !!error, 'stdout length:', stdout?.length || 0);
        
        if (error) {
          console.error('[Twitter] Mentions error:', error.message);
          console.error('[Twitter] stderr:', stderr);
          // Return error immediately instead of fallback to avoid double-exec issues
          resolve({ success: false, mentions: [], error: error.message, stderr });
          return;
        }
        
        try {
          const mentions = JSON.parse(stdout || '[]');
          console.log('[Twitter] Parsed', Array.isArray(mentions) ? mentions.length : 0, 'mentions');
          resolve({ success: true, mentions: Array.isArray(mentions) ? mentions : [] });
        } catch (e: any) {
          console.error('[Twitter] JSON parse error:', e.message);
          console.error('[Twitter] Raw stdout:', stdout?.slice(0, 200));
          resolve({ success: true, mentions: [], raw: stdout || '', parseError: e.message });
        }
      });
    } catch (e: any) {
      console.error('[Twitter] Handler exception:', e);
      resolve({ success: false, mentions: [], error: e.message });
    }
  });
});

ipcMain.handle('twitter:home', async (_, limit?: number) => {
  console.log('[Twitter] Home handler called, limit:', limit);
  const countArg = limit ? `--count ${limit}` : '--count 20';
  
  return new Promise((resolve) => {
    try {
      exec(`${BIRD_PATH} home ${countArg} --json`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: execEnv }, (error, stdout, stderr) => {
        console.log('[Twitter] Home exec completed, error:', !!error, 'stdout length:', stdout?.length || 0);
        
        if (error) {
          console.error('[Twitter] Home error:', error.message);
          console.error('[Twitter] stderr:', stderr);
          resolve({ success: false, tweets: [], error: error.message, stderr });
          return;
        }
        
        try {
          const tweets = JSON.parse(stdout || '[]');
          console.log('[Twitter] Parsed', Array.isArray(tweets) ? tweets.length : 0, 'home tweets');
          resolve({ success: true, tweets: Array.isArray(tweets) ? tweets : [] });
        } catch (e: any) {
          console.error('[Twitter] Home JSON parse error:', e.message);
          console.error('[Twitter] Raw stdout:', stdout?.slice(0, 200));
          resolve({ success: true, tweets: [], raw: stdout || '', parseError: e.message });
        }
      });
    } catch (e: any) {
      console.error('[Twitter] Home handler exception:', e);
      resolve({ success: false, tweets: [], error: e.message });
    }
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

// ============== MESSAGES IPC HANDLERS ==============

// Comms cache configuration
const COMMS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FROGGO_DB_PATH = '/Users/worker/.local/bin/froggo-db';

// Helper to run command and return promise (shared)
const runMsgCmd = (cmd: string, timeout = 10000): Promise<string> => {
  return new Promise((resolve) => {
    const fullPath = `/opt/homebrew/bin:/usr/bin:/bin:/Users/worker/.local/bin:${process.env.PATH || ''}`;
    exec(cmd, { timeout, env: { ...process.env, PATH: fullPath } }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Messages] Command error: ${cmd.slice(0, 100)}...`, error.message);
        if (stderr) console.error(`[Messages] stderr: ${stderr}`);
        resolve('');
      } else {
        resolve(stdout);
      }
    });
  });
};

// Check comms cache freshness
const getCommsCacheAge = async (): Promise<number> => {
  try {
    const raw = await runMsgCmd(`sqlite3 ~/clawd/data/froggo.db "SELECT MAX(fetched_at) FROM comms_cache"`, 2000);
    if (raw && raw.trim()) {
      const lastFetch = new Date(raw.trim()).getTime();
      return Date.now() - lastFetch;
    }
  } catch (e) {
    console.error('[Messages] Cache age check error:', e);
  }
  return Infinity;
};

// Get messages from froggo-db cache
const getCommsFromCache = async (limit: number): Promise<any[] | null> => {
  try {
    const raw = await runMsgCmd(`${FROGGO_DB_PATH} comms-recent --limit ${limit}`, 3000);
    if (raw && raw.trim().startsWith('[')) {
      const cached = JSON.parse(raw);
      // Transform to match expected format
      return cached.map((m: any) => ({
        id: m.external_id,
        platform: m.platform,
        name: m.sender_name || m.sender,
        from: m.sender,
        preview: m.preview,
        timestamp: m.timestamp,
        relativeTime: m.relativeTime || '',
        hasReply: !!m.has_reply,
        isUrgent: !!m.is_urgent,
      }));
    }
  } catch (e) {
    console.error('[Messages] Cache read error:', e);
  }
  return null;
};

// Write messages to froggo-db cache
const writeCommsToCache = async (messages: any[]): Promise<void> => {
  try {
    // Transform to froggo-db format
    const cacheData = messages.map(m => ({
      platform: m.platform,
      external_id: m.id,
      sender: m.from || m.name,
      sender_name: m.name,
      preview: m.preview,
      timestamp: m.timestamp,
      is_urgent: m.isUrgent || false,
    }));
    
    // Write via stdin to comms-bulk
    const tmpFile = path.join(os.tmpdir(), `comms-cache-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(cacheData));
    await runMsgCmd(`${FROGGO_DB_PATH} comms-bulk --file "${tmpFile}"`, 5000);
    fs.unlinkSync(tmpFile);
    console.log(`[Messages] Cached ${messages.length} messages to froggo-db`);
  } catch (e) {
    console.error('[Messages] Cache write error:', e);
  }
};

ipcMain.handle('messages:recent', async (_, limit?: number) => {
  console.log('[Messages] Handler called, limit:', limit);
  const lim = limit || 10;
  
  // Check cache freshness
  const cacheAge = await getCommsCacheAge();
  console.log(`[Messages] Cache age: ${Math.round(cacheAge / 1000)}s`);
  
  // If cache is fresh (< TTL), return cached data
  if (cacheAge < COMMS_CACHE_TTL_MS) {
    const cached = await getCommsFromCache(lim);
    if (cached && cached.length > 0) {
      console.log(`[Messages] Returning ${cached.length} messages from cache`);
      return { success: true, chats: cached, fromCache: true, cacheAge: Math.round(cacheAge / 1000) };
    }
  }
  
  // Cache miss or stale - fetch fresh data
  const allMessages: any[] = [];
  
  // Full paths for CLIs (Electron GUI apps don't inherit terminal PATH)
  const WACLI_PATH = '/opt/homebrew/bin/wacli';
  const TGCLI_PATH = '/Users/worker/.local/bin/tgcli';
  
  // Helper to run command and return promise
  const runCmd = (cmd: string, timeout = 10000): Promise<string> => {
    return runMsgCmd(cmd, timeout);
  };
  
  // Helper to format relative time
  const relativeTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  
  try {
    // ===== WHATSAPP (direct DB query - wacli CLI has bugs) =====
    console.log('[Messages] Fetching WhatsApp messages from DB...');
    const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
    // Get recent INCOMING messages from DM chats (not groups)
    const waQuery = `
      SELECT m.chat_jid, m.chat_name, m.text, m.ts, COALESCE(c.push_name, c.full_name, c.business_name) as contact_name
      FROM messages m
      LEFT JOIN contacts c ON m.chat_jid = c.jid
      WHERE m.from_me = 0 
        AND m.chat_jid LIKE '%@s.whatsapp.net'
        AND m.text IS NOT NULL AND m.text != ''
      GROUP BY m.chat_jid
      ORDER BY m.ts DESC
      LIMIT 10
    `;
    const waRaw = await runCmd(`sqlite3 "${waDbPath}" "${waQuery.replace(/\n/g, ' ')}" -json`, 10000);
    console.log('[Messages] WhatsApp DB result:', waRaw ? `${waRaw.length} chars` : 'EMPTY');
    if (waRaw && waRaw.length > 10) {
      try {
        const waMessages = JSON.parse(waRaw);
        for (const msg of waMessages) {
          let name = msg.contact_name || msg.chat_name || msg.chat_jid || 'Unknown';
          // Clean up JID-style names
          if (name.includes('@')) {
            name = name.split('@')[0];
          }
          if (/^\d+$/.test(name)) {
            name = `+${name}`;
          }
          
          const timestamp = new Date(msg.ts * 1000).toISOString(); // Convert seconds to ms
          allMessages.push({
            id: `wa-${msg.chat_jid}`,
            platform: 'whatsapp',
            name: name,
            preview: (msg.text || '').slice(0, 100),
            timestamp: timestamp,
            relativeTime: relativeTime(timestamp),
            fromMe: false,
          });
        }
      } catch (e) {
        console.error('[Messages] WhatsApp DB parse error:', e);
      }
    }
    
    // ===== TELEGRAM (from cache - tgcli is slow) =====
    console.log('[Messages] Fetching Telegram from cache...');
    const tgCachePath = path.join(os.homedir(), 'clawd', 'data', 'telegram-cache.json');
    try {
      if (fs.existsSync(tgCachePath)) {
        const tgCacheRaw = fs.readFileSync(tgCachePath, 'utf-8');
        const tgCache = JSON.parse(tgCacheRaw);
        
        // Check staleness (warn if > 15 min old)
        const cacheAge = Date.now() - new Date(tgCache.lastUpdated).getTime();
        const isStale = cacheAge > 15 * 60 * 1000;
        
        console.log(`[Messages] Telegram cache: ${tgCache.chats?.length || 0} chats, age: ${Math.round(cacheAge / 60000)}min${isStale ? ' (STALE)' : ''}`);
        
        for (const chat of (tgCache.chats || [])) {
          if (!chat.lastMessage?.text || chat.lastMessage.text === '(no recent messages)') continue;
          
          // Build timestamp
          let timestamp = chat.lastMessage.timestamp;
          if (timestamp && !timestamp.includes('Z')) {
            timestamp = timestamp + 'Z'; // Assume UTC if no timezone
          }
          
          allMessages.push({
            id: `tg-${chat.id}`,
            platform: 'telegram',
            name: chat.name || 'Unknown',
            preview: (chat.lastMessage.text || '').slice(0, 100),
            timestamp: timestamp,
            relativeTime: relativeTime(timestamp),
            fromMe: false,
            isStale: isStale,
            chatType: chat.type,
          });
        }
      } else {
        console.log('[Messages] Telegram cache not found, run telegram-cache.js to populate');
      }
    } catch (e) {
      console.error('[Messages] Telegram cache read error:', e);
    }
    
    // ===== DISCORD DMs =====
    console.log('[Messages] Fetching Discord DMs...');
    const DISCORDCLI_PATH = '/Users/worker/.local/bin/discordcli';
    const discordDmsRaw = await runCmd(`${DISCORDCLI_PATH} dms`, 10000);
    if (discordDmsRaw && !discordDmsRaw.includes('Invalid token')) {
      const dmLines = discordDmsRaw.split('\n').filter(l => l.trim() && !l.startsWith('ID') && !l.startsWith('---'));
      const dms = dmLines.slice(0, 5).map(line => {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (match) return { id: match[1], name: match[2].trim() };
        return null;
      }).filter(Boolean);
      
      for (const dm of dms as any[]) {
        const msgRaw = await runCmd(`${DISCORDCLI_PATH} messages ${dm.id} --limit 5`, 5000);
        if (msgRaw) {
          // Parse: [2026-01-24 09:47] username: message
          const msgLines = msgRaw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
          // Find first message NOT from prof_froggo (Kevin's account)
          for (const line of msgLines) {
            const msgMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
            if (msgMatch && msgMatch[2].trim() !== 'prof_froggo') {
              const timestamp = new Date(msgMatch[1].replace(' ', 'T') + ':00Z');
              allMessages.push({
                id: `discord-${dm.id}`,
                platform: 'discord',
                name: dm.name.split(',')[0].trim(), // First username in the DM
                preview: msgMatch[3].trim().slice(0, 100),
                timestamp: timestamp.toISOString(),
                relativeTime: relativeTime(timestamp.toISOString()),
                fromMe: false,
              });
              break;
            }
          }
        }
      }
    }
    
    // ===== EMAIL (via gog gmail) =====
    console.log('[Messages] Fetching emails...');
    const emailAccounts = ['kevin.macarthur@bitso.com', 'kevin@carbium.io'];
    for (const acct of emailAccounts) {
      const emailRaw = await runCmd(`GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread" --json --limit 5`, 15000);
      if (emailRaw) {
        try {
          const emailData = JSON.parse(emailRaw);
          const emails = emailData.threads || emailData || [];
          console.log(`[Messages] Email account ${acct}: ${emails.length} threads`);
          for (const email of emails.slice(0, 3)) {
            allMessages.push({
              id: `email-${email.id || email.ID}`,
              platform: 'email',
              name: email.from?.split('<')[0]?.trim() || email.From?.split('<')[0]?.trim() || 'Unknown',
              preview: email.subject || email.Subject || email.snippet || '',
              timestamp: email.date || email.Date || new Date().toISOString(),
              relativeTime: relativeTime(email.date || email.Date || new Date().toISOString()),
              fromMe: false,
            });
          }
        } catch (e) {
          console.error('[Messages] Email parse error:', e);
        }
      }
    }
    
    // ===== X/Twitter DMs (via bird) =====
    // bird doesn't have DM support yet - skip for now
    
    // Sort by timestamp (most recent first)
    allMessages.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
    
    const result = allMessages.slice(0, lim);
    
    // Write to froggo-db cache (async, don't wait)
    writeCommsToCache(result).catch(e => console.error('[Messages] Cache write failed:', e));
    
    return { success: true, chats: result, fromCache: false };
  } catch (e: any) {
    console.error('[Messages] Error:', e);
    
    // On error, try to return stale cache if available
    const staleCache = await getCommsFromCache(lim);
    if (staleCache && staleCache.length > 0) {
      console.log('[Messages] Returning stale cache due to fetch error');
      return { success: true, chats: staleCache, fromCache: true, stale: true, error: e.message };
    }
    
    return { success: false, chats: [], error: e.message };
  }
});

// ============== MESSAGE CONTEXT HANDLER ==============
ipcMain.handle('messages:context', async (_, messageId: string, platform: string, limit?: number) => {
  const lim = limit || 5;
  const messages: any[] = [];
  
  const runCmd = (cmd: string, timeout = 10000): Promise<string> => {
    return new Promise((resolve) => {
      exec(cmd, { timeout, env: { ...process.env, PATH: `/opt/homebrew/bin:/Users/worker/.local/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error) resolve('');
        else resolve(stdout);
      });
    });
  };
  
  try {
    if (platform === 'whatsapp') {
      // Extract JID from messageId (wa-JID format)
      const jid = messageId.replace('wa-', '');
      const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
      // Get contact name first
      const nameQuery = `SELECT COALESCE(c.push_name, c.full_name, m.chat_name, 'Unknown') as name FROM messages m LEFT JOIN contacts c ON m.chat_jid = c.jid WHERE m.chat_jid='${jid}' LIMIT 1`;
      const nameRaw = await runCmd(`sqlite3 "${waDbPath}" "${nameQuery}"`, 3000);
      const contactName = nameRaw?.trim() || 'Unknown';
      
      const query = `SELECT text, from_me, datetime(ts, 'unixepoch', 'localtime') as time FROM messages WHERE chat_jid='${jid}' ORDER BY ts DESC LIMIT ${lim}`;
      const raw = await runCmd(`sqlite3 "${waDbPath}" "${query}" -json`, 5000);
      if (raw) {
        const rows = JSON.parse(raw);
        for (const row of rows.reverse()) {
          messages.push({
            sender: row.from_me ? 'You' : contactName,
            text: row.text || '',
            timestamp: row.time || '',
            fromMe: !!row.from_me,
          });
        }
      }
    } else if (platform === 'telegram') {
      const chatId = messageId.replace('tg-', '');
      const raw = await runCmd(`/opt/homebrew/bin/tgcli messages ${chatId} --limit ${lim}`, 5000);
      if (raw) {
        const lines = raw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
        for (const line of lines.reverse()) {
          const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
          if (match) {
            messages.push({
              sender: match[2].trim(),
              text: match[3].trim(),
              timestamp: match[1],
              fromMe: match[2].trim() === 'You',
            });
          }
        }
      }
    } else if (platform === 'discord') {
      const channelId = messageId.replace('discord-', '');
      const raw = await runCmd(`/Users/worker/.local/bin/discordcli messages ${channelId} --limit ${lim}`, 5000);
      if (raw) {
        const lines = raw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
        for (const line of lines.reverse()) {
          const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
          if (match) {
            messages.push({
              sender: match[2].trim(),
              text: match[3].trim(),
              timestamp: match[1],
              fromMe: match[2].trim() === 'prof_froggo',
            });
          }
        }
      }
    }
    
    return { success: true, messages };
  } catch (e: any) {
    console.error('[Messages:Context] Error:', e);
    return { success: false, messages: [], error: e.message };
  }
});

// ============== MESSAGE SEND HANDLER ==============
ipcMain.handle('messages:send', async (_, { platform, to, message }: { platform: string; to: string; message: string }) => {
  const PATHS = {
    wacli: '/opt/homebrew/bin/wacli',
    tgcli: '~/.local/bin/tgcli',
    gog: '/opt/homebrew/bin/gog'
  };
  
  // Escape message for shell
  const escapeShell = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
  
  try {
    let result: string;
    
    switch (platform) {
      case 'whatsapp':
        result = execSync(`${PATHS.wacli} send ${escapeShell(to)} ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      case 'telegram':
        result = execSync(`${PATHS.tgcli} send ${escapeShell(to)} ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      case 'email':
        result = execSync(`${PATHS.gog} gmail send --to ${escapeShell(to)} --body ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      case 'discord':
        // Use clawdbot message tool
        result = execSync(`clawdbot message send --channel discord --to ${escapeShell(to)} --message ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      default:
        return { success: false, error: `Unknown platform: ${platform}` };
    }
    
    console.log(`[Messages:Send] Sent to ${platform}:${to}:`, result);
    return { success: true, result };
  } catch (e: any) {
    console.error('[Messages:Send] Error:', e);
    return { success: false, error: e.message };
  }
});

// ============== EMAIL IPC HANDLERS ==============
ipcMain.handle('email:unread', async (_, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread" --json --limit 20`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
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

ipcMain.handle('email:body', async (_, emailId: string, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail read ${emailId}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }, (error, stdout) => {
      if (error) {
        console.error('[Email] Body error:', error);
        resolve({ success: false, body: '', error: error.message });
        return;
      }
      resolve({ success: true, body: stdout, emailId });
    });
  });
});

ipcMain.handle('email:search', async (_, query: string, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const escapedQuery = query.replace(/"/g, '\\"');
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "${escapedQuery}" --json --limit 20`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
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
  const cmd = `/opt/homebrew/bin/froggo-db inbox-add --type email --title "${title.replace(/"/g, '\\"')}" --content "${content.replace(/"/g, '\\"')}" --channel dashboard`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error) => {
      if (error) {
        console.error('[Email] Queue error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, message: 'Email queued for approval in Inbox' });
    });
  });
});

// ============== EMAIL AUTO-DETECT IMPORTANT ==============

// Track processed email IDs to avoid duplicates
const processedEmailIds = new Set<string>();
const processedEmailsFile = path.join(os.homedir(), 'clawd', 'data', 'processed-emails.json');

// Load processed emails on startup
try {
  if (fs.existsSync(processedEmailsFile)) {
    const data = JSON.parse(fs.readFileSync(processedEmailsFile, 'utf-8'));
    data.forEach((id: string) => processedEmailIds.add(id));
    console.log(`[Email] Loaded ${processedEmailIds.size} processed email IDs`);
  }
} catch (e) {
  console.error('[Email] Failed to load processed emails:', e);
}

function saveProcessedEmails() {
  try {
    const data = Array.from(processedEmailIds).slice(-500); // Keep last 500
    fs.writeFileSync(processedEmailsFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Email] Failed to save processed emails:', e);
  }
}

interface ImportantEmailResult {
  id: string;
  from: string;
  subject: string;
  reason: string;
  priority: 'urgent' | 'high' | 'medium';
  amount?: string;
}

function detectImportantEmail(email: any): ImportantEmailResult | null {
  const id = email.id || email.ID || email.threadId;
  const from = email.from || email.From || '';
  const subject = email.subject || email.Subject || '';
  const labels = email.labels || email.Labels || [];
  const snippet = email.snippet || '';
  
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();
  const combined = `${subjectLower} ${snippet.toLowerCase()}`;
  
  // Extract amounts (e.g., $1,500 or €500 or £1000)
  const amountMatch = combined.match(/[\$€£]\s?[\d,]+(?:\.\d{2})?/);
  const amount = amountMatch ? amountMatch[0] : undefined;
  
  // Priority: Urgent
  const urgentPatterns = [
    /urgent/i,
    /immediate action/i,
    /action required/i,
    /expires? (today|soon|in \d)/i,
    /deadline/i,
    /asap/i,
  ];
  
  for (const pattern of urgentPatterns) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return { id, from, subject, reason: 'Urgent action required', priority: 'urgent', amount };
    }
  }
  
  // Priority: High - Financial
  const financialPatterns = [
    /invoice/i,
    /payment (due|received|failed|declined)/i,
    /billing/i,
    /receipt/i,
    /transaction/i,
    /wire transfer/i,
    /bank (statement|alert|notification)/i,
  ];
  
  const financialSenders = [
    /revolut/i,
    /stripe/i,
    /paypal/i,
    /wise\.com/i,
    /mercury/i,
    /brex/i,
    /@.*bank/i,
  ];
  
  for (const pattern of financialPatterns) {
    if (pattern.test(subject)) {
      return { id, from, subject, reason: 'Financial notification', priority: 'high', amount };
    }
  }
  
  for (const pattern of financialSenders) {
    if (pattern.test(from)) {
      return { id, from, subject, reason: `From ${from.split('<')[0].trim()}`, priority: 'high', amount };
    }
  }
  
  // Priority: High - Meeting/Calendar
  const meetingPatterns = [
    /meeting (request|invite|invitation)/i,
    /calendar invite/i,
    /event invitation/i,
    /interview scheduled/i,
    /you('ve| have) been invited/i,
  ];
  
  for (const pattern of meetingPatterns) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return { id, from, subject, reason: 'Meeting invitation', priority: 'high' };
    }
  }
  
  // Priority: Medium - Gmail IMPORTANT label
  if (labels.includes('IMPORTANT')) {
    return { id, from, subject, reason: 'Marked important by Gmail', priority: 'medium', amount };
  }
  
  // Priority: Medium - Large amounts (>$500)
  if (amount) {
    const numericAmount = parseFloat(amount.replace(/[\$€£,]/g, ''));
    if (numericAmount >= 500) {
      return { id, from, subject, reason: `Contains amount: ${amount}`, priority: 'high', amount };
    }
  }
  
  return null;
}

ipcMain.handle('email:checkImportant', async () => {
  return runImportantEmailCheck();
});

// Auto-check for important emails every 10 minutes
let emailCheckInterval: NodeJS.Timeout | null = null;

async function runImportantEmailCheck() {
  console.log('[Email] Checking for important emails...');
  const results: ImportantEmailResult[] = [];
  const newInboxItems: string[] = [];
  
  const emailAccounts = ['kevin.macarthur@bitso.com', 'kevin@carbium.io'];
  
  for (const acct of emailAccounts) {
    try {
      const output = await new Promise<string>((resolve) => {
        exec(
          `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread newer_than:1d" --json --limit 20`,
          { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } },
          (error, stdout) => {
            if (error) resolve('[]');
            else resolve(stdout);
          }
        );
      });
      
      const emails = JSON.parse(output) || [];
      console.log(`[Email] Checking ${emails.length} emails from ${acct}`);
      
      for (const email of emails) {
        const id = email.id || email.ID || email.threadId;
        if (!id || processedEmailIds.has(id)) continue;
        
        const important = detectImportantEmail(email);
        if (important) {
          results.push(important);
          processedEmailIds.add(id);
          
          // Create inbox item
          const title = important.amount 
            ? `${important.subject.slice(0, 50)} (${important.amount})`
            : important.subject.slice(0, 60);
          const content = `From: ${important.from}\nReason: ${important.reason}\nAccount: ${acct}`;
          const escapedTitle = title.replace(/"/g, '\\"').replace(/'/g, "''");
          const escapedContent = content.replace(/"/g, '\\"').replace(/'/g, "''");
          
          const insertCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, created) VALUES ('email', '${escapedTitle}', '${escapedContent}', '${important.priority} priority', 'pending', 'email', datetime('now'))"`;
          
          exec(insertCmd, { timeout: 5000 }, (err) => {
            if (err) console.error('[Email] Failed to create inbox item:', err);
            else console.log(`[Email] Created inbox item: ${title}`);
          });
          
          newInboxItems.push(title);
        }
      }
    } catch (e) {
      console.error(`[Email] Error checking ${acct}:`, e);
    }
  }
  
  // Save processed IDs
  saveProcessedEmails();
  
  // Notify frontend if new items were added
  if (newInboxItems.length > 0) {
    safeSend('inbox-updated', { newItems: newInboxItems.length });
  }
  
  console.log(`[Email] Found ${results.length} important emails, created ${newInboxItems.length} inbox items`);
  return { success: true, found: results.length, created: newInboxItems.length, items: results };
}

function startEmailAutoCheck() {
  if (emailCheckInterval) clearInterval(emailCheckInterval);
  
  // Initial check after 30 seconds (let app settle)
  setTimeout(() => {
    console.log('[Email] Running initial important email check...');
    runImportantEmailCheck();
  }, 30000);
  
  // Then every 10 minutes
  emailCheckInterval = setInterval(() => {
    console.log('[Email] Running periodic important email check...');
    runImportantEmailCheck();
  }, 10 * 60 * 1000);
}

// Start auto-check when app is ready
app.on('ready', () => {
  setTimeout(startEmailAutoCheck, 5000);
});

// ============== CALENDAR IPC HANDLERS ==============
ipcMain.handle('calendar:events', async (_, account?: string, days?: number) => {
  const acct = account || 'kevin.macarthur@bitso.com';
  const daysArg = days ? `--days ${days}` : '--days 7';
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar events ${daysArg} --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
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

ipcMain.handle('calendar:createEvent', async (_, params: any) => {
  const { account, title, start, end, location, description, attendees, isAllDay, recurrence, timeZone } = params;
  const acct = account || 'kevin.macarthur@bitso.com';
  const calendarId = 'primary'; // Use primary calendar
  
  // Build gog calendar create command
  let cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar create ${calendarId}`;
  cmd += ` --summary "${title.replace(/"/g, '\\"')}"`;
  
  // Format dates for gog CLI (RFC3339 format or date-only for all-day)
  if (isAllDay) {
    cmd += ` --from "${start}"`;
    cmd += ` --to "${end || start}"`;
    cmd += ` --all-day`;
  } else {
    cmd += ` --from "${start}"`;
    cmd += ` --to "${end || start}"`;
  }
  
  if (location) cmd += ` --location "${location.replace(/"/g, '\\"')}"`;
  if (description) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
  
  if (attendees && attendees.length > 0) {
    const attendeeEmails = attendees.map((a: any) => a.email).join(',');
    cmd += ` --attendees "${attendeeEmails}"`;
  }
  
  if (recurrence && recurrence !== 'none') {
    const rrule = recurrence === 'daily' ? 'RRULE:FREQ=DAILY' :
                   recurrence === 'weekly' ? 'RRULE:FREQ=WEEKLY' :
                   recurrence === 'monthly' ? 'RRULE:FREQ=MONTHLY' : '';
    if (rrule) cmd += ` --rrule "${rrule}"`;
  }
  
  console.log('[Calendar] Create event command:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Calendar] Create event error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      console.log('[Calendar] Create event result:', stdout);
      resolve({ success: true, result: stdout });
    });
  });
});

ipcMain.handle('calendar:updateEvent', async (_, params: any) => {
  const { account, eventId, title, start, end, location, description, attendees, isAllDay, timeZone } = params;
  const acct = account || 'kevin.macarthur@bitso.com';
  const calendarId = 'primary';
  
  // Build gog calendar update command
  let cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar update ${calendarId} "${eventId}"`;
  
  if (title) cmd += ` --summary "${title.replace(/"/g, '\\"')}"`;
  
  if (start) {
    if (isAllDay) {
      cmd += ` --from "${start}"`;
      cmd += ` --to "${end || start}"`;
      cmd += ` --all-day`;
    } else {
      cmd += ` --from "${start}"`;
      cmd += ` --to "${end || start}"`;
    }
  }
  
  if (location !== undefined) cmd += ` --location "${location.replace(/"/g, '\\"')}"`;
  if (description !== undefined) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
  
  if (attendees && attendees.length > 0) {
    const attendeeEmails = attendees.map((a: any) => a.email).join(',');
    cmd += ` --attendees "${attendeeEmails}"`;
  }
  
  console.log('[Calendar] Update event command:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Calendar] Update event error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      console.log('[Calendar] Update event result:', stdout);
      resolve({ success: true, result: stdout });
    });
  });
});

ipcMain.handle('calendar:deleteEvent', async (_, params: any) => {
  const { account, eventId } = params;
  const acct = account || 'kevin.macarthur@bitso.com';
  const calendarId = 'primary';
  
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar delete ${calendarId} "${eventId}"`;
  
  console.log('[Calendar] Delete event command:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Calendar] Delete event error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      console.log('[Calendar] Delete event result:', stdout);
      resolve({ success: true, result: stdout });
    });
  });
});

// List available calendars for an account
ipcMain.handle('calendar:listCalendars', async (_, account: string) => {
  const cmd = `GOG_ACCOUNT=${account} /opt/homebrew/bin/gog calendar calendars --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Calendar] List calendars error:', error, stderr);
        resolve({ success: false, calendars: [], error: error.message || stderr });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const calendars = data.calendars || data || [];
        resolve({ success: true, calendars, account });
      } catch (parseError) {
        console.error('[Calendar] Parse calendars error:', parseError);
        resolve({ success: false, calendars: [], error: 'Failed to parse calendar list' });
      }
    });
  });
});

// List authenticated accounts (check which accounts have valid credentials)
ipcMain.handle('calendar:listAccounts', async () => {
  const knownAccounts = [
    'kevin.macarthur@bitso.com',
    'kevin@carbium.io',
    'kmacarthur.gpt@gmail.com'
  ];
  
  // Test each account to see if it's authenticated
  const accountPromises = knownAccounts.map(async (email) => {
    const cmd = `GOG_ACCOUNT=${email} /opt/homebrew/bin/gog calendar calendars --json`;
    
    return new Promise<{ email: string; authenticated: boolean; calendarsCount?: number }>((resolve) => {
      exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error) {
          resolve({ email, authenticated: false });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          const calendars = data.calendars || data || [];
          resolve({ email, authenticated: true, calendarsCount: calendars.length });
        } catch {
          resolve({ email, authenticated: false });
        }
      });
    });
  });
  
  try {
    const accounts = await Promise.all(accountPromises);
    return { success: true, accounts };
  } catch (error) {
    console.error('[Calendar] List accounts error:', error);
    return { success: false, accounts: [], error: String(error) };
  }
});

// Add/authenticate new account
ipcMain.handle('calendar:addAccount', async () => {
  // Launch gog auth flow in terminal
  // This will prompt the user in the terminal to authenticate
  const cmd = `/opt/homebrew/bin/gog auth`;
  
  return new Promise((resolve) => {
    // Run in a new terminal window so user can see the auth flow
    const terminalCmd = `osascript -e 'tell application "Terminal" to do script "${cmd}"'`;
    
    exec(terminalCmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Calendar] Add account error:', error, stderr);
        resolve({ success: false, error: 'Failed to launch authentication. Please run "gog auth" manually in Terminal.' });
        return;
      }
      
      // Return success - the actual auth happens in the terminal
      resolve({ 
        success: true, 
        message: 'Authentication started in Terminal. Please follow the prompts to complete authentication.' 
      });
    });
  });
});

// Remove account credentials
ipcMain.handle('calendar:removeAccount', async (_, account: string) => {
  // gog stores credentials in ~/Library/Application Support/gogcli/
  const credPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'gogcli', `${account}.json`);
  
  return new Promise((resolve) => {
    fs.unlink(credPath, (error) => {
      if (error) {
        console.error('[Calendar] Remove account error:', error);
        resolve({ success: false, error: `Failed to remove credentials: ${error.message}` });
        return;
      }
      console.log('[Calendar] Removed credentials for:', account);
      resolve({ success: true });
    });
  });
});

// Test account connection
ipcMain.handle('calendar:testConnection', async (_, account: string) => {
  const cmd = `GOG_ACCOUNT=${account} /opt/homebrew/bin/gog calendar calendars --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Calendar] Test connection error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const calendars = data.calendars || data || [];
        resolve({ success: true, calendarsCount: calendars.length, account });
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

// ============== CALENDAR AGGREGATION IPC HANDLERS ==============
ipcMain.handle('calendar:aggregate', async (_, options?: {
  days?: number;
  includeGoogle?: boolean;
  includeMissionControl?: boolean;
  accounts?: string[];
}) => {
  try {
    console.log('[Calendar:aggregate] Aggregating events with options:', options);
    const result = await calendarService.aggregateEvents(options || {});
    console.log(`[Calendar:aggregate] Success: ${result.events.length} events from ${Object.keys(result.sources.google).length} sources`);
    return { success: true, ...result };
  } catch (error: any) {
    console.error('[Calendar:aggregate] Error:', error);
    return { success: false, error: error.message, events: [], sources: { google: {}, missionControl: 0 }, errors: [] };
  }
});

ipcMain.handle('calendar:clearCache', async (_, source?: 'google' | 'mission-control' | 'all') => {
  try {
    calendarService.clearCache(source);
    console.log(`[Calendar:clearCache] Cleared cache for: ${source || 'all'}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Calendar:clearCache] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calendar:cacheStats', async () => {
  try {
    const stats = calendarService.getCacheStats();
    console.log('[Calendar:cacheStats] Stats:', stats);
    return { success: true, stats };
  } catch (error: any) {
    console.error('[Calendar:cacheStats] Error:', error);
    return { success: false, error: error.message };
  }
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

ipcMain.handle('sessions:send', async (_, sessionKey: string, message: string) => {
  try {
    console.log(`[Sessions] Sending to ${sessionKey}:`, message.slice(0, 100));
    const response = await fetch('http://localhost:18789/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        sessionKey,
        source: 'dashboard-chat-agent'
      }),
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[Sessions] Send error:', error);
    return { success: false, error: String(error) };
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
        if (data.items?.length > 0) {
          safeSend('approvals:updated', data.items);
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

// ============== CHAT MESSAGES IPC HANDLERS (froggo-db backed) ==============
ipcMain.handle('chat:saveMessage', async (_, msg: { role: string; content: string; timestamp: number; sessionKey?: string }) => {
  const session = msg.sessionKey || 'dashboard';
  const escapedContent = msg.content.replace(/'/g, "''");
  const ts = new Date(msg.timestamp).toISOString();
  
  const cmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO messages (timestamp, session_key, channel, role, content) VALUES ('${ts}', '${session}', 'dashboard', '${msg.role}', '${escapedContent}')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('chat:loadMessages', async (_, limit: number = 50, sessionKey?: string) => {
  const session = sessionKey || 'dashboard';
  const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT id, timestamp, role, content FROM messages WHERE session_key='${session}' AND channel='dashboard' ORDER BY timestamp DESC LIMIT ${limit}" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, messages: [] });
        return;
      }
      try {
        const rows = JSON.parse(stdout || '[]');
        const messages = rows.reverse().map((r: any) => ({
          id: `db-${r.id}`,
          role: r.role,
          content: r.content,
          timestamp: new Date(r.timestamp).getTime(),
        }));
        resolve({ success: true, messages });
      } catch {
        resolve({ success: true, messages: [] });
      }
    });
  });
});

ipcMain.handle('chat:clearMessages', async (_, sessionKey?: string) => {
  const session = sessionKey || 'dashboard';
  const cmd = `sqlite3 ~/clawd/data/froggo.db "DELETE FROM messages WHERE session_key='${session}' AND channel='dashboard'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
});
