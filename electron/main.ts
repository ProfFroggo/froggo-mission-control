import { app, BrowserWindow, ipcMain, systemPreferences } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as os from 'os';

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

// ============== VOSK SETUP ==============
let vosk: any = null;
let voskModel: any = null;
let voskRecognizer: any = null;
let voskAvailable = false;

// Model path - handle both dev and packaged app
const VOSK_MODEL_PATH = isDev 
  ? path.join(__dirname, '..', 'resources', 'models', 'vosk-model-en')
  : path.join(process.resourcesPath, 'models', 'vosk-model-en');

async function initVosk() {
  try {
    console.log('Vosk: Loading module...');
    vosk = require('vosk-koffi');
    
    // Check if model exists
    if (!fs.existsSync(VOSK_MODEL_PATH)) {
      console.error('Vosk: Model not found at', VOSK_MODEL_PATH);
      return;
    }
    
    console.log('Vosk: Loading model from', VOSK_MODEL_PATH);
    vosk.setLogLevel(-1); // Quiet mode
    voskModel = new vosk.Model(VOSK_MODEL_PATH);
    voskAvailable = true;
    console.log('Vosk: Model loaded successfully!');
  } catch (err) {
    console.error('Vosk: Failed to initialize:', err);
    voskAvailable = false;
  }
}

// Initialize Vosk after app is ready
app.whenReady().then(() => {
  initVosk();
});

// Cleanup on quit
app.on('will-quit', () => {
  if (voskRecognizer) {
    try { voskRecognizer.free(); } catch {}
    voskRecognizer = null;
  }
  if (voskModel) {
    try { voskModel.free(); } catch {}
    voskModel = null;
  }
});

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============== VOSK IPC HANDLERS ==============

// Check if Vosk is available
ipcMain.handle('vosk:check', async () => {
  return { 
    available: voskAvailable, 
    modelPath: VOSK_MODEL_PATH,
    modelExists: fs.existsSync(VOSK_MODEL_PATH)
  };
});

// Start a new recognition session
ipcMain.handle('vosk:start', async (_, sampleRate: number = 16000) => {
  if (!voskAvailable || !voskModel) {
    return { error: 'Vosk not available' };
  }
  
  try {
    // Clean up previous recognizer if exists
    if (voskRecognizer) {
      try { voskRecognizer.free(); } catch {}
    }
    
    voskRecognizer = new vosk.Recognizer({ model: voskModel, sampleRate });
    voskRecognizer.setWords(true);
    voskRecognizer.setPartialWords(true);
    console.log('Vosk: Started new recognition session, sampleRate:', sampleRate);
    return { success: true };
  } catch (err: any) {
    console.error('Vosk: Failed to start session:', err);
    return { error: err.message };
  }
});

// Process audio chunk - returns partial or final result
ipcMain.handle('vosk:audio', async (_, audioData: ArrayBuffer) => {
  if (!voskRecognizer) {
    return { error: 'No active session' };
  }
  
  try {
    const buffer = Buffer.from(audioData);
    const endOfSpeech = voskRecognizer.acceptWaveform(buffer);
    
    if (endOfSpeech) {
      // Speech ended - get final result
      const result = voskRecognizer.result();
      console.log('Vosk: End of speech -', result);
      return { 
        final: true, 
        text: result.text || '',
        words: result.result || []
      };
    } else {
      // Get partial result for live display
      const partial = voskRecognizer.partialResult();
      return { 
        final: false, 
        partial: partial.partial || ''
      };
    }
  } catch (err: any) {
    console.error('Vosk: Audio processing error:', err);
    return { error: err.message };
  }
});

// Get final result and optionally reset
ipcMain.handle('vosk:final', async (_, reset: boolean = false) => {
  if (!voskRecognizer) {
    return { error: 'No active session' };
  }
  
  try {
    const result = voskRecognizer.finalResult();
    console.log('Vosk: Final result -', result);
    
    if (reset && voskModel) {
      // Reset recognizer for next utterance
      voskRecognizer.free();
      voskRecognizer = new vosk.Recognizer({ model: voskModel, sampleRate: 16000 });
      voskRecognizer.setWords(true);
      voskRecognizer.setPartialWords(true);
    }
    
    return { 
      text: result.text || '',
      words: result.result || []
    };
  } catch (err: any) {
    console.error('Vosk: Final result error:', err);
    return { error: err.message };
  }
});

// Stop and cleanup the recognizer
ipcMain.handle('vosk:stop', async () => {
  if (voskRecognizer) {
    try { 
      const result = voskRecognizer.finalResult();
      voskRecognizer.free(); 
      voskRecognizer = null;
      return { text: result.text || '' };
    } catch (err: any) {
      voskRecognizer = null;
      return { error: err.message };
    }
  }
  return { text: '' };
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
