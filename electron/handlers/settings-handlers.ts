/**
 * Settings & Voice Handlers Module
 *
 * Channels: settings:getApiKey/storeApiKey/hasApiKey/deleteApiKey,
 * screen:getSources, media:checkPermissions/requestPermission,
 * whisper:transcribe/check, voice:getModelUrl/speak
 *
 * 11 registerHandler calls total.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { desktopCapturer, systemPreferences } from 'electron';
import { registerModuleHandler } from '../ipc-registry';
import { getSecret, storeSecret, hasSecret, deleteSecret } from '../secret-store';
import { safeLog } from '../logger';

// isDev detection
const isDev = process.env.ELECTRON_DEV === '1';
const modelServerPort = 18799;

// Whisper config
const WHISPER_PATH = '/opt/homebrew/bin/whisper';
const TEMP_DIR = os.tmpdir();

export function registerSettingsHandlers(): void {
  registerModuleHandler('froggo-settings', 'settings:getApiKey', async (_event, keyName: string) => {
    try { return getSecret(keyName); } catch (err: any) { safeLog.error('[Settings] getApiKey error:', err.message); return null; }
  });

  registerModuleHandler('froggo-settings', 'settings:storeApiKey', async (_event, keyName: string, value: string) => {
    try { storeSecret(keyName, value); return { success: true }; } catch (err: any) { safeLog.error('[Settings] storeApiKey error:', err.message); return { success: false, error: err.message }; }
  });

  registerModuleHandler('froggo-settings', 'settings:hasApiKey', async (_event, keyName: string) => {
    try { return hasSecret(keyName); } catch (err: any) { safeLog.error('[Settings] hasApiKey error:', err.message); return false; }
  });

  registerModuleHandler('froggo-settings', 'settings:deleteApiKey', async (_event, keyName: string) => {
    try { deleteSecret(keyName); return { success: true }; } catch (err: any) { safeLog.error('[Settings] deleteApiKey error:', err.message); return { success: false, error: err.message }; }
  });

  registerModuleHandler('froggo-settings', 'screen:getSources', async (_event, opts?: { types?: string[]; thumbnailSize?: { width: number; height: number } }) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: (opts?.types as any) || ['window', 'screen'],
        thumbnailSize: opts?.thumbnailSize || { width: 320, height: 180 },
      });
      return sources.map(source => ({
        id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL(),
        display_id: source.display_id, appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      }));
    } catch (error: any) {
      safeLog.error('[ScreenCapture] Failed to get sources:', error);
      return [];
    }
  });

  registerModuleHandler('froggo-settings', 'media:checkPermissions', async () => {
    if (process.platform === 'darwin') {
      const camera = systemPreferences.getMediaAccessStatus('camera');
      const microphone = systemPreferences.getMediaAccessStatus('microphone');
      const screen = systemPreferences.getMediaAccessStatus('screen');
      return { camera, microphone, screen };
    }
    return { camera: 'granted', microphone: 'granted', screen: 'granted' };
  });

  registerModuleHandler('froggo-settings', 'media:requestPermission', async (_event, mediaType: 'camera' | 'microphone') => {
    if (process.platform === 'darwin') return await systemPreferences.askForMediaAccess(mediaType);
    return true;
  });

  registerModuleHandler('froggo-settings', 'whisper:transcribe', async (_event, audioData: ArrayBuffer) => {
    const tempFile = path.join(TEMP_DIR, `whisper-${Date.now()}.webm`);
    try {
      fs.writeFileSync(tempFile, Buffer.from(audioData));
      safeLog.log('Whisper: Saved audio to', tempFile);
      return new Promise((resolve) => {
        const cmd = `${WHISPER_PATH} "${tempFile}" --model tiny --language en --output_format txt --output_dir "${TEMP_DIR}" 2>&1`;
        exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
          const baseName = path.basename(tempFile, '.webm');
          const outputFile = path.join(TEMP_DIR, `${baseName}.txt`);
          let transcript = '';
          if (fs.existsSync(outputFile)) { transcript = fs.readFileSync(outputFile, 'utf-8').trim(); fs.unlinkSync(outputFile); }
          try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
          if (error) { safeLog.error('Whisper error:', error.message); resolve({ error: error.message, stdout, stderr }); }
          else { safeLog.log('Whisper transcript:', transcript); resolve({ transcript, stdout }); }
        });
      });
    } catch (error: any) {
      safeLog.error('Whisper failed:', error);
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
      return { error: error.message };
    }
  });

  registerModuleHandler('froggo-settings', 'whisper:check', async () => {
    const available = fs.existsSync(WHISPER_PATH);
    safeLog.log('Whisper check:', WHISPER_PATH, 'exists:', available);
    return { available, path: WHISPER_PATH };
  });

  registerModuleHandler('froggo-settings', 'voice:getModelUrl', async () => {
    const url = isDev ? '/models/model.tar.gz' : `http://127.0.0.1:${modelServerPort}/model.tar.gz`;
    safeLog.log('[Voice] getModelUrl called, isDev:', isDev, 'returning:', url);
    return url;
  });

  registerModuleHandler('froggo-settings', 'voice:speak', async (_event, text: string, voice?: string) => {
    // Read ElevenLabs API key at invocation time
    let elevenlabsApiKey = process.env.ELEVENLABS_API_KEY || '';
    try {
      const envPath = path.join(os.homedir(), '.openclaw', 'elevenlabs.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/ELEVENLABS_API_KEY=(.+)/);
        if (match) elevenlabsApiKey = match[1].trim();
      }
    } catch (err) { safeLog.debug('[TTS] Failed to load ElevenLabs API key:', err); }

    const outputPath = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
    const voiceArg = voice ? `-v "${voice}"` : '-v Brian';
    const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const cmd = `sag ${voiceArg} --model-id eleven_flash_v2_5 -o "${outputPath}" "${escapedText}"`;
    safeLog.log('[Voice] TTS command:', cmd.slice(0, 120) + '...');
    return new Promise((resolve) => {
      const env = { ...process.env };
      if (elevenlabsApiKey) env.ELEVENLABS_API_KEY = elevenlabsApiKey;
      exec(cmd, { timeout: 30000, env }, (error, _stdout, stderr) => {
        if (error) { safeLog.error('[Voice] TTS error:', error.message); safeLog.error('[Voice] TTS stderr:', stderr); resolve({ success: false, error: error.message }); }
        else { safeLog.log('[Voice] TTS generated:', outputPath); resolve({ success: true, path: outputPath }); }
      });
    });
  });
}
