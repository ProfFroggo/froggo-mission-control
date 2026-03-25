import { useState, useEffect, useRef } from 'react';
import { Mic, AudioLines } from 'lucide-react';
import { IconButton, Badge, Flex, Text } from '@radix-ui/themes';

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
    confidence === null ? undefined
    : confidence >= 0.8 ? 'grass'
    : confidence >= 0.5 ? 'orange'
    : 'red';

  const confidenceWidth =
    confidence === null ? '0%' : `${Math.round(confidence * 100)}%`;

  return (
    <Flex direction="column" align="center" gap="1">
      {/* Waveform + button row */}
      <Flex align="center" gap="2">
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
                  className="rounded-full bg-[var(--color-error)] transition-colors duration-75"
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
          title={listening ? 'Stop listening' : 'Voice input'}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
            listening
              ? 'bg-destructive/10 border border-destructive/30 text-destructive'
              : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          {listening ? <AudioLines size={16} /> : <Mic size={16} />}
        </button>
      </Flex>

      {/* Listening label */}
      {listening && (
        <Text size="1" color="red" className="animate-pulse select-none">
          Listening...
        </Text>
      )}

      {/* Confidence indicator */}
      {confidence !== null && !listening && (
        <Flex direction="column" align="center" gap="1" style={{ width: 64 }}>
          <div className="w-full h-1 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-colors duration-300 ${
                confidenceColor === 'grass' ? 'bg-[var(--color-success)]' :
                confidenceColor === 'orange' ? 'bg-[var(--color-warning)]' :
                'bg-[var(--color-error)]'
              }`}
              style={{ width: confidenceWidth }}
            />
          </div>
          <Text size="1" color="gray">
            {Math.round((confidence ?? 0) * 100)}% confidence
          </Text>
        </Flex>
      )}

      {/* Command suggestion chips — shown when idle */}
      {!listening && confidence === null && (
        <Flex wrap="wrap" gap="1" justify="center" style={{ maxWidth: 280 }}>
          {COMMAND_SUGGESTIONS.map(cmd => (
            <Badge
              key={cmd}
              color="gray"
              variant="soft"
              radius="full"
              size="1"
              className="cursor-pointer hover:bg-mission-control-accent/20 transition-colors"
              onClick={() => onTranscript(cmd)}
            >
              {cmd}
            </Badge>
          ))}
        </Flex>
      )}
    </Flex>
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
