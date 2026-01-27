// Voice Service - Background preload + IndexedDB caching
// Model loads when app starts, cached for instant second load

type VoiceState = 'idle' | 'loading' | 'ready' | 'error';
type Listener = (state: VoiceState, message?: string) => void;

class VoiceService {
  private model: any = null;
  private recognizer: any = null;
  private state: VoiceState = 'idle';
  private message: string = '';
  private listeners: Set<Listener> = new Set();
  private loadPromise: Promise<void> | null = null;

  getState() {
    return { state: this.state, message: this.message };
  }

  getModel() {
    return this.model;
  }

  getRecognizer() {
    return this.recognizer;
  }

  isReady() {
    return this.state === 'ready' && this.model && this.recognizer;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    // Immediately notify of current state
    listener(this.state, this.message);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.state, this.message));
  }

  private setState(state: VoiceState, message: string) {
    this.state = state;
    this.message = message;
    this.notify();
    console.log(`[VoiceService] ${state}: ${message}`);
  }

  // Start loading model in background (call this on app start)
  async preload(): Promise<void> {
    // If already loading or ready, return existing promise
    if (this.loadPromise) return this.loadPromise;
    if (this.state === 'ready') return Promise.resolve();

    this.loadPromise = this._loadModel();
    return this.loadPromise;
  }

  private async _loadModel(): Promise<void> {
    try {
      this.setState('loading', 'Loading vosk-browser WASM...');
      
      // @ts-ignore
      const Vosk = await import('vosk-browser');
      
      this.setState('loading', 'Loading speech model (cached after first load)...');
      
      // Get correct model URL (dev vs prod) - now async
      let modelUrl = '/models/model.tar.gz'; // fallback
      try {
        if (window.clawdbot?.voice?.getModelUrl) {
          modelUrl = await window.clawdbot.voice.getModelUrl();
        }
      } catch (e) {
        console.warn('[VoiceService] Could not get model URL from main process:', e);
      }
      console.log('[VoiceService] Loading model from:', modelUrl);
      
      // vosk-browser automatically uses IndexedDB caching!
      // First load downloads from URL, subsequent loads from cache
      const model = await Vosk.createModel(modelUrl);
      this.model = model;
      
      this.setState('loading', 'Creating recognizer...');
      const recognizer = new model.KaldiRecognizer(16000);
      this.recognizer = recognizer;
      
      this.setState('ready', 'Voice ready!');
    } catch (error: any) {
      console.error('[VoiceService] Error:', error);
      this.setState('error', `Failed: ${error.message}`);
      throw error;
    }
  }

  // Create a new recognizer (for fresh sessions)
  createRecognizer(sampleRate: number = 16000) {
    if (!this.model) throw new Error('Model not loaded');
    return new this.model.KaldiRecognizer(sampleRate);
  }

  // Cleanup
  terminate() {
    if (this.recognizer) {
      try { this.recognizer.remove(); } catch {}
      this.recognizer = null;
    }
    if (this.model) {
      try { this.model.terminate(); } catch {}
      this.model = null;
    }
    this.state = 'idle';
    this.loadPromise = null;
  }
}

// Singleton instance
export const voiceService = new VoiceService();

// Auto-preload when this module is imported (app start)
if (typeof window !== 'undefined') {
  // Small delay to let app render first, then start loading
  setTimeout(() => {
    console.log('[VoiceService] Starting background preload...');
    voiceService.preload().catch(console.error);
  }, 1000);
}
