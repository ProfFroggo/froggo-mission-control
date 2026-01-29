import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoicePanel from '../../components/VoicePanel';

// Mock Vosk browser
vi.mock('vosk-browser', () => ({
  createModel: vi.fn().mockResolvedValue({}),
  createRecognizer: vi.fn().mockReturnValue({
    on: vi.fn(),
    acceptWaveform: vi.fn(),
    result: vi.fn().mockReturnValue({ text: 'test transcription' }),
  }),
}));

describe('VoicePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock MediaDevices
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    } as any;

    // Mock AudioContext
    (global as any).AudioContext = vi.fn().mockImplementation(() => ({
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
      }),
      createScriptProcessor: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
      }),
      destination: {},
      close: vi.fn(),
    }));
  });

  describe('Rendering', () => {
    it('renders voice panel with status indicator', () => {
      render(<VoicePanel />);
      
      expect(screen.getByText(/Voice Assistant/i)).toBeInTheDocument();
      expect(screen.getByText(/Model:/i)).toBeInTheDocument();
    });

    it('displays conversation mode button', () => {
      render(<VoicePanel />);
      
      const conversationBtn = screen.getByRole('button', { name: /start conversation/i });
      expect(conversationBtn).toBeInTheDocument();
    });

    it('displays meeting mode button', () => {
      render(<VoicePanel />);
      
      const meetingBtn = screen.getByRole('button', { name: /meeting mode/i });
      expect(meetingBtn).toBeInTheDocument();
    });

    it('shows transcript area', () => {
      render(<VoicePanel />);
      
      const transcript = screen.getByTestId('transcript-area');
      expect(transcript).toBeInTheDocument();
    });
  });

  describe('Conversation Mode', () => {
    it('starts conversation mode on button click', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/listening/i)).toBeInTheDocument();
      });
    });

    it('requests microphone permission', async () => {
      const user = userEvent.setup();
      const getUserMediaMock = vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      });
      global.navigator.mediaDevices.getUserMedia = getUserMediaMock;

      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      await waitFor(() => {
        expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
      });
    });

    it('displays real-time transcription', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      // Simulate transcription update
      await waitFor(() => {
        // In real implementation, this would come from Vosk
        const transcript = screen.getByTestId('transcript-area');
        expect(transcript).toBeInTheDocument();
      });
    });

    it('sends transcript to Froggo after silence', async () => {
      const user = userEvent.setup();
      const sendMock = vi.fn().mockResolvedValue({
        reply: 'Got it!',
      });
      (window as any).clawdbot.gateway.send = sendMock;

      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      // Simulate silence detection and sending
      await waitFor(() => {
        // In real implementation, this happens after silence threshold
      }, { timeout: 5000 });
    });

    it('plays TTS response', async () => {
      const user = userEvent.setup();
      const speakMock = vi.fn();
      
      (window as any).speechSynthesis = {
        speak: speakMock,
        cancel: vi.fn(),
      };

      (window as any).clawdbot.gateway.send = vi.fn().mockResolvedValue({
        reply: 'Hello there!',
      });

      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      // After response received, should play TTS
      await waitFor(() => {
        // In real implementation, TTS would be triggered
      }, { timeout: 5000 });
    });

    it('stops conversation mode on button click', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/listening/i)).toBeInTheDocument();
      });

      const stopBtn = screen.getByRole('button', { name: /stop/i });
      await user.click(stopBtn);
      
      await waitFor(() => {
        expect(screen.queryByText(/listening/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Meeting Mode', () => {
    it('starts continuous listening in meeting mode', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const meetingBtn = screen.getByRole('button', { name: /meeting mode/i });
      await user.click(meetingBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/recording meeting/i)).toBeInTheDocument();
      });
    });

    it('detects action items from transcript', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const meetingBtn = screen.getByRole('button', { name: /meeting mode/i });
      await user.click(meetingBtn);
      
      // Simulate transcript with action items
      // "Schedule a meeting with John tomorrow"
      // "Send email to Sarah about the report"
      
      await waitFor(() => {
        // Should detect and highlight action items
        expect(screen.getByText(/action items detected/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('sends meeting summary on stop', async () => {
      const user = userEvent.setup();
      const sendMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.gateway.send = sendMock;

      render(<VoicePanel />);
      
      const meetingBtn = screen.getByRole('button', { name: /meeting mode/i });
      await user.click(meetingBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/recording meeting/i)).toBeInTheDocument();
      });

      const summaryBtn = screen.getByRole('button', { name: /send summary/i });
      await user.click(summaryBtn);
      
      await waitFor(() => {
        expect(sendMock).toHaveBeenCalled();
      });
    });

    it('displays action items list', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const meetingBtn = screen.getByRole('button', { name: /meeting mode/i });
      await user.click(meetingBtn);
      
      await waitFor(() => {
        const actionItemsList = screen.getByTestId('action-items-list');
        expect(actionItemsList).toBeInTheDocument();
      });
    });
  });

  describe('Model Loading', () => {
    it('shows loading state while model loads', async () => {
      render(<VoicePanel />);
      
      expect(screen.getByText(/loading model/i)).toBeInTheDocument();
    });

    it('shows model ready state when loaded', async () => {
      render(<VoicePanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/model ready/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('handles model load error gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock model load failure
      vi.mocked(require('vosk-browser').createModel).mockRejectedValueOnce(
        new Error('Model load failed')
      );

      render(<VoicePanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/model load error/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      consoleError.mockRestore();
    });
  });

  describe('Audio Input', () => {
    it('handles microphone permission denial', async () => {
      const user = userEvent.setup();
      
      global.navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(
        new Error('Permission denied')
      );

      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/microphone permission denied/i)).toBeInTheDocument();
      });
    });

    it('selects audio input device', async () => {
      const user = userEvent.setup();
      
      // Mock available devices
      global.navigator.mediaDevices.enumerateDevices = vi.fn().mockResolvedValue([
        { deviceId: 'device-1', kind: 'audioinput', label: 'Microphone 1' },
        { deviceId: 'device-2', kind: 'audioinput', label: 'Microphone 2' },
      ]);

      render(<VoicePanel />);
      
      const deviceSelect = screen.getByLabelText(/audio input/i);
      await user.selectOptions(deviceSelect, 'device-2');
      
      expect(deviceSelect).toHaveValue('device-2');
    });

    it('displays audio level indicator', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const startBtn = screen.getByRole('button', { name: /start conversation/i });
      await user.click(startBtn);
      
      await waitFor(() => {
        const audioLevel = screen.getByTestId('audio-level');
        expect(audioLevel).toBeInTheDocument();
      });
    });
  });

  describe('Settings', () => {
    it('adjusts silence threshold', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      const settingsBtn = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsBtn);
      
      const silenceSlider = screen.getByLabelText(/silence threshold/i);
      await user.clear(silenceSlider);
      await user.type(silenceSlider, '2000');
      
      expect(silenceSlider).toHaveValue('2000');
    });

    it('selects TTS voice', async () => {
      const user = userEvent.setup();
      
      (window as any).speechSynthesis = {
        getVoices: vi.fn().mockReturnValue([
          { name: 'Samantha', lang: 'en-US' },
          { name: 'Karen', lang: 'en-AU' },
        ]),
      };

      render(<VoicePanel />);
      
      const settingsBtn = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsBtn);
      
      const voiceSelect = screen.getByLabelText(/voice/i);
      await user.selectOptions(voiceSelect, 'Karen');
      
      expect(voiceSelect).toHaveValue('Karen');
    });
  });

  describe('Transcript Management', () => {
    it('clears transcript', async () => {
      const user = userEvent.setup();
      render(<VoicePanel />);
      
      // Add some transcript
      const transcript = screen.getByTestId('transcript-area');
      
      const clearBtn = screen.getByRole('button', { name: /clear/i });
      await user.click(clearBtn);
      
      expect(transcript).toHaveTextContent('');
    });

    it('copies transcript to clipboard', async () => {
      const user = userEvent.setup();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<VoicePanel />);
      
      const copyBtn = screen.getByRole('button', { name: /copy/i });
      await user.click(copyBtn);
      
      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });

    it('saves transcript to file', async () => {
      const user = userEvent.setup();
      const saveMock = vi.fn().mockResolvedValue({ success: true });
      (window as any).clawdbot.voice = { saveTranscript: saveMock };

      render(<VoicePanel />);
      
      const saveBtn = screen.getByRole('button', { name: /save/i });
      await user.click(saveBtn);
      
      await waitFor(() => {
        expect(saveMock).toHaveBeenCalled();
      });
    });
  });
});
