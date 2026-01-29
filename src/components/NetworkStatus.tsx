/**
 * NetworkStatus - Shows a banner when user is offline
 */

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showOnlineBriefly, setShowOnlineBriefly] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setShowOnlineBriefly(true);
      
      // Hide "back online" message after 3 seconds
      setTimeout(() => setShowOnlineBriefly(false), 3000);
    };

    const handleOffline = () => {
      setOnline(false);
      setShowOnlineBriefly(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show offline banner
  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 px-4 z-[100] shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <WifiOff size={16} />
          <span className="font-medium">You're offline</span>
          <span className="text-sm opacity-90">- Some features may not work</span>
        </div>
      </div>
    );
  }

  // Briefly show "back online" message
  if (showOnlineBriefly) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-green-500 text-white text-center py-2 px-4 z-[100] shadow-lg animate-slide-down">
        <div className="flex items-center justify-center gap-2">
          <Wifi size={16} />
          <span className="font-medium">Back online</span>
        </div>
      </div>
    );
  }

  return null;
}
