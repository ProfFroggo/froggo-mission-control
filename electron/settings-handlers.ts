/**
 * Settings Handlers Module
 * 
 * All settings-related IPC handlers:
 * - settings:getApiKey, settings:storeApiKey
 * - settings:hasApiKey, settings:deleteApiKey
 * - screen:getSources
 * - media:checkPermissions, media:requestPermission
 * - whisper:transcribe, whisper:check
 * - voice:getModelUrl, voice:speak
 */
import { ipcMain, desktopCapturer, systemPreferences } from 'electron';
import { exec } from 'child_process';
import { safeLog } from './logger';
import { getSecret, storeSecret, hasSecret, deleteSecret } from './secret-store';

export function registerSettingsHandlers(): void {
  // API Key Management
  ipcMain.handle('settings:getApiKey', handleSettingsGetApiKey);
  ipcMain.handle('settings:storeApiKey', handleSettingsStoreApiKey);
  ipcMain.handle('settings:hasApiKey', handleSettingsHasApiKey);
  ipcMain.handle('settings:deleteApiKey', handleSettingsDeleteApiKey);
  
  // Screen Capture
  ipcMain.handle('screen:getSources', handleScreenGetSources);
  
  // Media Permissions
  ipcMain.handle('media:checkPermissions', handleMediaCheckPermissions);
  ipcMain.handle('media:requestPermission', handleMediaRequestPermission);
  
  // Voice/Whisper
  ipcMain.handle('whisper:transcribe', handleWhisperTranscribe);
  ipcMain.handle('whisper:check', handleWhisperCheck);
  ipcMain.handle('voice:getModelUrl', handleVoiceGetModelUrl);
  ipcMain.handle('voice:speak', handleVoiceSpeak);
}

// ============ SETTINGS HANDLERS ============

async function handleSettingsGetApiKey(
  _: Electron.IpcMainInvokeEvent, 
  keyName: string
): Promise<{ success: boolean; value?: string; error?: string }> {
  try {
    const value = getSecret(keyName);
    return { success: true, value: value || '' };
  } catch (error: any) {
    safeLog.error('[Settings] Get API key error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleSettingsStoreApiKey(
  _: Electron.IpcMainInvokeEvent, 
  keyName: string, 
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    storeSecret(keyName, value);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Settings] Store API key error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleSettingsHasApiKey(
  _: Electron.IpcMainInvokeEvent, 
  keyName: string
): Promise<{ success: boolean; has: boolean; error?: string }> {
  try {
    const has = hasSecret(keyName);
    return { success: true, has };
  } catch (error: any) {
    safeLog.error('[Settings] Has API key error:', error.message);
    return { success: false, has: false, error: error.message };
  }
}

async function handleSettingsDeleteApiKey(
  _: Electron.IpcMainInvokeEvent, 
  keyName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    deleteSecret(keyName);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Settings] Delete API key error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============ SCREEN CAPTURE HANDLERS ============

async function handleScreenGetSources(
  _: Electron.IpcMainInvokeEvent, 
  opts?: { types?: string[]; thumbnailSize?: { width: number; height: number } }
): Promise<{ success: boolean; sources?: any[]; error?: string }> {
  try {
    const sources = await desktopCapturer.getSources({
      types: opts?.types as any || ['window', 'screen'],
      thumbnailSize: opts?.thumbnailSize || { width: 150, height: 150 },
    });
    
    return { 
      success: true, 
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
      }))
    };
  } catch (error: any) {
    safeLog.error('[Screen] Get sources error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============ MEDIA PERMISSION HANDLERS ============

async function handleMediaCheckPermissions(): Promise<{ 
  success: boolean; 
  camera?: string; 
  microphone?: string; 
  error?: string 
}> {
  try {
    const camera = systemPreferences.getMediaAccessStatus('camera');
    const microphone = systemPreferences.getMediaAccessStatus('microphone');
    
    return { success: true, camera, microphone };
  } catch (error: any) {
    safeLog.error('[Media] Check permissions error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleMediaRequestPermission(
  _: Electron.IpcMainInvokeEvent, 
  mediaType: 'camera' | 'microphone'
): Promise<{ success: boolean; granted: boolean; error?: string }> {
  try {
    const granted = await systemPreferences.askForMediaAccess(mediaType);
    return { success: true, granted };
  } catch (error: any) {
    safeLog.error('[Media] Request permission error:', error.message);
    return { success: false, granted: false, error: error.message };
  }
}

// ============ WHISPER HANDLERS ============

async function handleWhisperTranscribe(
  _: Electron.IpcMainInvokeEvent, 
  audioData: ArrayBuffer
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    // Save audio to temp file
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.webm`);
    fs.writeFileSync(tempFile, Buffer.from(audioData));
    
    // Call whisper CLI
    return new Promise((resolve) => {
      exec(`whisper "${tempFile}" --model tiny --language en --output_format txt`, {
        timeout: 30000,
      }, (error, stdout, stderr) => {
        // Cleanup temp file
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
        
        if (error) {
          safeLog.error('[Whisper] Transcribe error:', error.message);
          resolve({ success: false, error: error.message });
          return;
        }
        
        resolve({ success: true, text: stdout.trim() });
      });
    });
  } catch (error: any) {
    safeLog.error('[Whisper] Transcribe error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleWhisperCheck(): Promise<{ success: boolean; available: boolean }> {
  try {
    return new Promise((resolve) => {
      exec('which whisper', { timeout: 5000 }, (error) => {
        resolve({ success: true, available: !error });
      });
    });
  } catch {
    return { success: true, available: false };
  }
}

// ============ VOICE HANDLERS ============

async function handleVoiceGetModelUrl(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Return local model URL or fetch from config
    const url = process.env.VITE_GEMINI_API_KEY 
      ? `wss://generativelanguage.googleapis.com/ws?key=${process.env.VITE_GEMINI_API_KEY}`
      : null;
    
    return { success: true, url: url || '' };
  } catch (error: any) {
    safeLog.error('[Voice] Get model URL error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleVoiceSpeak(
  _: Electron.IpcMainInvokeEvent, 
  text: string, 
  voice?: string
): Promise<{ success: boolean; audioPath?: string; error?: string }> {
  try {
    // Use say command or similar TTS
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    
    const outputPath = path.join(os.tmpdir(), `tts-${Date.now()}.aiff`);
    const voiceArg = voice ? `-v "${voice}"` : '';
    
    return new Promise((resolve) => {
      exec(`say ${voiceArg} -o "${outputPath}" "${text.replace(/"/g, '\\"')}"`, {
        timeout: 30000,
      }, (error) => {
        if (error) {
          safeLog.error('[Voice] Speak error:', error.message);
          resolve({ success: false, error: error.message });
          return;
        }
        
        resolve({ success: true, audioPath: outputPath });
      });
    });
  } catch (error: any) {
    safeLog.error('[Voice] Speak error:', error.message);
    return { success: false, error: error.message };
  }
}
