import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AudioLines } from 'lucide-react';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const COMMAND_SUGGESTIONS = [
  'Create task',
  'Show kanban',
  'Open inbox',
  'Run automation',
  'Add to schedule',
  'Search library',
];

export default function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const result = event.results[0][0];
        const transcript = result.transcript;
        const conf = result.confidence as number;
        setConfidence(conf);
        onTranscript(transcript);
        setListening(false);
        stopAudioAnalysis();
        // Clear confidence after 3s
        setTimeout(() => setConfidence(null), 3000);
      };

      recognition.onerror = () => {
        setListening(false);
        stopAudioAnalysis();
      };
      recognition.onend = () => {
        setListening(false);
        stopAudioAnalysis();
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.abort();
      stopAudioAnalysis();
    };
  }, [onTranscript]);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let running = true;
      const tick = () => {
        if (!running) return;
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
      (startAudioAnalysis as any)._stopFn = () => { running = false; };
    } catch {
      // mic permission denied — no waveform, still functional
    }
  };

  const stopAudioAnalysis = () => {
    if ((startAudioAnalysis as any)._stopFn) {
      (startAudioAnalysis as any)._stopFn();
      (startAudioAnalysis as any)._stopFn = undefined;
    }
    cancelAnimationFrame(animFrameRef.current);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.abort();
      setListening(false);
      stopAudioAnalysis();
    } else {
      setConfidence(null);
      recognitionRef.current.start();
      setListening(true);
      startAudioAnalysis();
    }
  };

  if (!supported) return null;

  const confidenceColor =
    confidence === null ? null
    : confidence >= 0.8 ? 'bg-green-500'
    : confidence >= 0.5 ? 'bg-amber-500'
    : 'bg-red-500';

  const confidenceWidth =
    confidence === null ? '0%' : `${Math.round(confidence * 100)}%`;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Waveform + button row */}
      <div className="flex items-center gap-2">
        {/* Waveform bars — visible while listening */}
        {listening && (
          <div className="flex items-end gap-[2px]" style={{ height: 20 }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const phase = (i * 0.7) + (Date.now() / 150);
              const height = listening
                ? Math.max(0.15, audioLevel * (0.5 + Math.sin(phase) * 0.5))
                : 0.15;
              return (
                <div
                  key={`wb-${i}`}
                  className="rounded-full bg-red-400 transition-all duration-75"
                  style={{
                    width: 2,
                    height: `${Math.max(15, height * 100)}%`,
                    opacity: 0.7 + height * 0.3,
                  }}
                />
              );
            })}
          </div>
        )}

        <button
          onClick={toggleListening}
          disabled={disabled}
          className={`p-2 rounded-lg transition-colors ${
            listening
              ? 'bg-red-500 text-white'
              : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-accent hover:text-white'
          } disabled:opacity-50`}
          title={listening ? 'Stop listening' : 'Voice input'}
        >
          {listening ? <AudioLines size={16} /> : <Mic size={16} />}
        </button>
      </div>

      {/* Listening label */}
      {listening && (
        <span className="text-[10px] text-red-400 font-medium animate-pulse select-none">
          Listening...
        </span>
      )}

      {/* Confidence indicator */}
      {confidence !== null && !listening && (
        <div className="w-16 flex flex-col items-center gap-0.5">
          <div className="w-full h-1 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${confidenceColor}`}
              style={{ width: confidenceWidth }}
            />
          </div>
          <span className="text-[9px] text-mission-control-text-dim">
            {Math.round((confidence ?? 0) * 100)}% confidence
          </span>
        </div>
      )}

      {/* Command suggestion chips — shown when idle */}
      {!listening && confidence === null && (
        <div className="flex flex-wrap gap-1 max-w-[280px] justify-center">
          {COMMAND_SUGGESTIONS.map(cmd => (
            <button
              key={cmd}
              onClick={() => onTranscript(cmd)}
              className="px-2 py-0.5 rounded-full text-[10px] bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-accent/20 hover:text-mission-control-accent transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Text-to-speech function
export function speak(text: string) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1;
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Karen') || v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    speechSynthesis.speak(utterance);
  }
}
