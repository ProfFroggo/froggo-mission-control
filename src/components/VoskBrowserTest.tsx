// VoskBrowserTest.tsx - WASM-based speech recognition
// Uses voiceService for background preload + caching
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { voiceService } from '../lib/voiceService';

export default function VoskBrowserTest() {
  const [status, setStatus] = useState('Initializing...');
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const recognizerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    // Subscribe to voice service state
    const unsubscribe = voiceService.subscribe((state, message) => {
      setStatus(message || state);
      
      if (state === 'ready') {
        setIsReady(true);
        setIsLoading(false);
        setupRecognizer();
      } else if (state === 'loading') {
        setIsLoading(true);
        setIsReady(false);
      } else if (state === 'error') {
        setIsLoading(false);
        setIsReady(false);
      }
    });

    // If service already ready, set up immediately
    if (voiceService.isReady()) {
      setIsReady(true);
      setIsLoading(false);
      setStatus('Voice ready!');
      setupRecognizer();
    }

    return () => {
      unsubscribe();
      stopListening();
    };
  }, []);

  const setupRecognizer = () => {
    try {
      // Create fresh recognizer for this session
      const recognizer = voiceService.createRecognizer(16000);
      recognizerRef.current = recognizer;
      
      recognizer.on('partialresult', (message: any) => {
        console.log('[Vosk] partialresult event:', JSON.stringify(message));
        const partial = message.result?.partial || '';
        if (partial) {
          console.log('[Vosk] Partial text:', partial);
          setPartialTranscript(partial);
        }
      });
      
      recognizer.on('result', (message: any) => {
        console.log('[Vosk] result event:', JSON.stringify(message));
        const text = message.result?.text || '';
        if (text) {
          console.log('[Vosk] Final text:', text);
          setTranscript(prev => (prev ? prev + ' ' : '') + text);
          setPartialTranscript('');
        }
      });
    } catch (error) {
      console.error('[Vosk] Recognizer setup error:', error);
    }
  };

  const startListening = async () => {
    console.log('[Voice] startListening called, recognizer:', !!recognizerRef.current, 'isReady:', isReady);
    if (!recognizerRef.current || !isReady) {
      console.log('[Voice] Not ready, aborting');
      return;
    }
    
    try {
      setStatus('Starting microphone...');
      console.log('[Voice] Requesting microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });
      console.log('[Voice] Got media stream:', stream);
      streamRef.current = stream;
      
      console.log('[Voice] Creating AudioContext...');
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      console.log('[Voice] AudioContext state:', audioContextRef.current.state, 'sampleRate:', audioContextRef.current.sampleRate);
      
      console.log('[Voice] Creating media stream source...');
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      isListeningRef.current = true;
      let audioChunkCount = 0;
      
      // Use AudioWorkletNode (modern replacement for ScriptProcessorNode)
      console.log('[Voice] Loading AudioWorklet module...');
      try {
        // Inline the worklet code as a blob URL (avoids file:// loading issues in packaged app)
        const workletCode = `
          class VoiceProcessor extends AudioWorkletProcessor {
            constructor() {
              super();
              this.bufferSize = 4096;
              this.buffer = new Float32Array(this.bufferSize);
              this.bufferIndex = 0;
            }
            process(inputs) {
              const input = inputs[0];
              if (input && input[0]) {
                const inputData = input[0];
                for (let i = 0; i < inputData.length; i++) {
                  this.buffer[this.bufferIndex++] = inputData[i];
                  if (this.bufferIndex >= this.bufferSize) {
                    this.port.postMessage({ type: 'audio', data: this.buffer.slice() });
                    this.bufferIndex = 0;
                  }
                }
              }
              return true;
            }
          }
          registerProcessor('voice-processor', VoiceProcessor);
        `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await audioContextRef.current.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);
        console.log('[Voice] AudioWorklet module loaded');
        
        const workletNode = new AudioWorkletNode(audioContextRef.current, 'voice-processor');
        
        workletNode.port.onmessage = (event) => {
          if (!recognizerRef.current || !isListeningRef.current) return;
          
          if (event.data.type === 'audio') {
            try {
              audioChunkCount++;
              if (audioChunkCount <= 3 || audioChunkCount % 100 === 0) {
                console.log('[Voice] Audio chunk #', audioChunkCount);
              }
              // Create AudioBuffer from Float32Array (vosk expects AudioBuffer)
              const audioBuffer = audioContextRef.current!.createBuffer(1, event.data.data.length, 16000);
              audioBuffer.copyToChannel(event.data.data, 0);
              recognizerRef.current.acceptWaveform(audioBuffer);
            } catch (e: any) {
              console.error('[Voice] ERROR in audio processing:', e?.message || e);
            }
          }
        };
        
        console.log('[Voice] Connecting audio nodes...');
        source.connect(workletNode);
        // AudioWorkletNode doesn't need destination connection to process
      } catch (workletError) {
        console.error('[Voice] AudioWorklet failed, falling back to ScriptProcessor:', workletError);
        
        // Fallback to ScriptProcessorNode
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        processorRef.current.onaudioprocess = (event) => {
          if (!recognizerRef.current || !isListeningRef.current) return;
          try {
            audioChunkCount++;
            if (audioChunkCount <= 3 || audioChunkCount % 100 === 0) {
              console.log('[Voice] Audio chunk #', audioChunkCount);
            }
            recognizerRef.current.acceptWaveform(event.inputBuffer.getChannelData(0));
          } catch (e: any) {
            console.error('[Voice] ERROR:', e?.message || e);
          }
        };
        source.connect(processorRef.current);
        const silentGain = audioContextRef.current.createGain();
        silentGain.gain.value = 0;
        processorRef.current.connect(silentGain);
        silentGain.connect(audioContextRef.current.destination);
      }
      
      console.log('[Voice] Audio setup complete!');
      setIsListening(true);
      setStatus('Listening... Speak now!');
    } catch (error: any) {
      console.error('[Voice] startListening error:', error);
      console.error('[Voice] Error stack:', error.stack);
      setStatus(`Microphone error: ${error.message}`);
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    if (isReady) {
      setStatus('Stopped. Click microphone to start again.');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-clawd-bg">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-clawd-text mb-2">🐸 Voice (WASM)</h2>
        <p className="text-clawd-text-dim text-sm">{status}</p>
        {isLoading && (
          <p className="text-clawd-accent text-xs mt-1">
            First load downloads model. Cached for instant future loads.
          </p>
        )}
      </div>

      {/* Microphone Button */}
      <div className="flex justify-center mb-8">
        <button
          onClick={toggleListening}
          disabled={!isReady || isLoading}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            isLoading 
              ? 'bg-clawd-surface cursor-wait'
              : isListening 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : isReady
                  ? 'bg-clawd-accent hover:bg-clawd-accent-hover cursor-pointer'
                  : 'bg-clawd-surface cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <Loader2 size={40} className="text-clawd-text-dim animate-spin" />
          ) : isListening ? (
            <MicOff size={40} className="text-white" />
          ) : (
            <Mic size={40} className="text-white" />
          )}
        </button>
      </div>

      {/* Partial Transcript (real-time) */}
      <div className="mb-4">
        <label className="text-sm text-clawd-text-dim mb-1 block">Live (partial):</label>
        <div className="bg-clawd-surface rounded-lg p-4 min-h-[60px] border border-clawd-border">
          <span className="text-green-400 italic">
            {partialTranscript || '...'}
          </span>
        </div>
      </div>

      {/* Final Transcript */}
      <div className="flex-1">
        <label className="text-sm text-clawd-text-dim mb-1 block">Final transcript:</label>
        <div className="bg-clawd-surface rounded-lg p-4 min-h-[120px] border border-clawd-border overflow-y-auto">
          <span className="text-clawd-text">
            {transcript || '(Start speaking to see transcription)'}
          </span>
        </div>
      </div>

      {/* Clear Button */}
      {transcript && (
        <button
          onClick={() => setTranscript('')}
          className="mt-4 px-4 py-2 bg-clawd-surface hover:bg-clawd-border rounded text-clawd-text-dim"
        >
          Clear Transcript
        </button>
      )}
    </div>
  );
}
