// Notification utilities

// Play notification sound
export function playNotificationSound(type: 'approval' | 'message' | 'alert' = 'message') {
  // Use Web Audio API for notification sounds
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return; // Not available in test/SSR environments
  const audioContext = new AudioCtx();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Different sounds for different notification types
  switch (type) {
    case 'approval':
      // Two-tone chime
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'alert': {
      // Urgent double beep
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);

      // Second beep
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
      gain2.gain.setValueAtTime(0.15, audioContext.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
      osc2.start(audioContext.currentTime + 0.2);
      osc2.stop(audioContext.currentTime + 0.35);
      break;
    }
    default:
      // Gentle pop
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
  }
}

// Show desktop notification
export async function showDesktopNotification(title: string, body: string, options?: { 
  icon?: string; 
  sound?: boolean;
  onClick?: () => void;
}) {
  // Check permission - guard for test/SSR environments
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: options?.icon || '🐸',
      silent: !options?.sound,
    });

    if (options?.onClick) {
      notification.onclick = options.onClick;
    }

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }

  // Play sound if enabled
  if (options?.sound !== false) {
    playNotificationSound('message');
  }
}

// Notify on new approval
export function notifyNewApproval(title: string) {
  playNotificationSound('approval');
  showDesktopNotification('New Approval Request', title, { sound: false });
}

// Notify on important message
export function notifyImportantMessage(from: string, preview: string) {
  playNotificationSound('message');
  showDesktopNotification(`Message from ${from}`, preview, { sound: false });
}
