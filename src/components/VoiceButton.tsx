import { useState, useEffect, useRef } from 'react';
import { Mic, AudioLines } from 'lucide-react';
import { Badge, Flex, Text } from '@radix-ui/themes';
import { GeminiStt } from '../lib/globalStt';
import MicSelector from './MicSelector';

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
  const [audioLevel, setAudioLevel] = useState(0);
  const [micDeviceId, setMicDeviceId] = useState('');
  const sttRef = useRef<GeminiStt | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      sttRef.current?.stop();
      stopAudioAnalysis();
    };
  }, []);

  const startAudioAnalysis = async () => {
    try {
      const constraints: MediaStreamConstraints = micDeviceId
        ? { audio: { deviceId: { exact: micDeviceId } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
    } catch (err) {
      console.warn('[VoiceButton] Non-critical:', err);
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
    audioCtxRef.current?.close().catch(err => console.warn('[VoiceButton] Non-critical:', err));
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const toggleListening = () => {
    if (listening && sttRef.current) {
      sttRef.current.stop();
      setListening(false);
      stopAudioAnalysis();
      return;
    }

    // Stop any lingering audio analysis first to avoid double-getUserMedia
    stopAudioAnalysis();

    const stt = new GeminiStt({
      deviceId: micDeviceId || undefined,
      continuous: true,
      onPartialTranscript: (text) => {
        onTranscript(text);
      },
      onTranscript: (text) => {
        onTranscript(text);
      },
      onError: () => {
        setListening(false);
        stopAudioAnalysis();
      },
      onEnd: () => {
        setListening(false);
        stopAudioAnalysis();
      },
    });
    sttRef.current = stt;
    stt.start();
    setListening(true);
    startAudioAnalysis();
  };

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
                  className="rounded-full bg-error transition-colors duration-75"
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
          type="button"
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

        <MicSelector value={micDeviceId} onChange={setMicDeviceId} compact />
      </Flex>

      {/* Listening label */}
      {listening && (
        <Text size="1" color="red" className="animate-pulse select-none">
          Listening...
        </Text>
      )}

      {/* Command suggestion chips — shown when idle */}
      {!listening && (
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

// Text-to-speech function — delegates to Gemini Chirp 3 via globalTts
export function speak(text: string) {
  import('../lib/globalTts').then(({ speak: globalSpeak }) => {
    globalSpeak(text);
  }).catch(() => { /* globalTts unavailable */ });
}
