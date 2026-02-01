import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * MicTestPanel - Dedicated microphone testing harness
 * 
 * Purpose: Isolate mic access from all app complexity (Gemini, WebSocket, etc.)
 * to determine if getUserMedia works at all in production.
 */

export function MicTestPanel() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userActivation, setUserActivation] = useState({ isActive: false, hasBeenActive: false });
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
    console.log(`[MicTest] ${msg}`);
  };

  useEffect(() => {
    addLog('MicTestPanel mounted');
    return () => addLog('MicTestPanel unmounted');
  }, []);

  const updateUserActivation = () => {
    if ('userActivation' in navigator) {
      const ua = (navigator as any).userActivation;
      setUserActivation({
        isActive: ua?.isActive ?? false,
        hasBeenActive: ua?.hasBeenActive ?? false,
      });
    }
  };

  const startMic = async () => {
    if (isRequesting) {
      addLog('⚠️ Start blocked - already requesting');
      return;
    }

    setIsRequesting(true);
    setError(null);
    
    addLog('▶️ Start button clicked');
    updateUserActivation();
    addLog(`UserActivation at click: isActive=${userActivation.isActive}, hasBeenActive=${userActivation.hasBeenActive}`);

    try {
      addLog('Requesting getUserMedia({ audio: true })...');
      updateUserActivation();
      addLog(`UserActivation before gUM: isActive=${userActivation.isActive}, hasBeenActive=${userActivation.hasBeenActive}`);
      
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      addLog(`✅ getUserMedia SUCCESS - stream.id=${micStream.id}`);
      
      const audioTrack = micStream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      const info = {
        streamId: micStream.id,
        streamActive: micStream.active,
        trackId: audioTrack.id,
        trackLabel: audioTrack.label,
        trackReadyState: audioTrack.readyState,
        trackEnabled: audioTrack.enabled,
        settings: settings,
      };
      
      setStreamInfo(info);
      setStream(micStream);
      addLog(`Track settings: ${JSON.stringify(settings)}`);
      addLog(`Track state: ${audioTrack.readyState}, enabled: ${audioTrack.enabled}`);
      
    } catch (err: any) {
      const errMsg = `${err.name}: ${err.message}`;
      addLog(`❌ getUserMedia FAILED - ${errMsg}`);
      setError(errMsg);
      console.error('[MicTest] Error:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  const stopMic = () => {
    if (!stream) {
      addLog('⚠️ Stop called but no stream');
      return;
    }
    
    addLog(`⏹️ Stopping stream ${stream.id}`);
    stream.getTracks().forEach(track => {
      addLog(`Stopping track ${track.id} (${track.label})`);
      track.stop();
    });
    
    setStream(null);
    setStreamInfo(null);
    addLog('✅ Stream stopped and cleared');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  return (
    <div className="flex flex-col h-full bg-clawd-bg text-clawd-text p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">🎙️ Microphone Test Harness</h1>
        <p className="text-sm text-clawd-text-secondary">
          Isolated mic testing - no Gemini, no WebSocket, no complex pipelines.
          This tests raw <code>getUserMedia()</code> only.
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={startMic}
          disabled={!!stream || isRequesting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition"
        >
          <Mic className="w-4 h-4" />
          {isRequesting ? 'Requesting...' : 'Start Mic'}
        </button>
        
        <button
          onClick={stopMic}
          disabled={!stream}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition"
        >
          <MicOff className="w-4 h-4" />
          Stop Mic
        </button>

        <button
          onClick={clearLogs}
          className="ml-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
        >
          Clear Logs
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Current State */}
        <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            {stream ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-gray-500" />}
            Current State
          </h3>
          <div className="space-y-2 text-sm font-mono">
            <div>Stream: <span className={stream ? 'text-green-400' : 'text-gray-500'}>{stream ? stream.id : 'null'}</span></div>
            <div>Active: <span className={stream?.active ? 'text-green-400' : 'text-gray-500'}>{stream?.active ? 'true' : 'false'}</span></div>
            <div>Requesting: <span className={isRequesting ? 'text-yellow-400' : 'text-gray-500'}>{isRequesting ? 'true' : 'false'}</span></div>
          </div>
        </div>

        {/* User Activation */}
        <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
          <h3 className="font-semibold mb-3">User Activation</h3>
          <div className="space-y-2 text-sm font-mono">
            <div>isActive: <span className={userActivation.isActive ? 'text-green-400' : 'text-gray-500'}>{String(userActivation.isActive)}</span></div>
            <div>hasBeenActive: <span className={userActivation.hasBeenActive ? 'text-green-400' : 'text-gray-500'}>{String(userActivation.hasBeenActive)}</span></div>
          </div>
          <button
            onClick={updateUserActivation}
            className="mt-3 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <h3 className="font-semibold text-red-400 mb-2">❌ Error</h3>
          <pre className="text-sm font-mono text-red-300 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {/* Stream Info */}
      {streamInfo && (
        <div className="mb-6 bg-green-900/20 border border-green-500/50 rounded-lg p-4">
          <h3 className="font-semibold text-green-400 mb-2">✅ Stream Info</h3>
          <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap overflow-auto max-h-40">
            {JSON.stringify(streamInfo, null, 2)}
          </pre>
        </div>
      )}

      {/* Logs */}
      <div className="flex-1 bg-clawd-surface border border-clawd-border rounded-lg p-4 overflow-hidden flex flex-col">
        <h3 className="font-semibold mb-3">Event Logs</h3>
        <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">No logs yet. Click "Start Mic" to begin.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-clawd-text-secondary">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-400 mb-2">📋 Test Instructions</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside text-blue-300">
          <li>Click "Start Mic" and watch the logs</li>
          <li>If it fails, check the error message (DOMException name/message)</li>
          <li>If it succeeds, verify stream ID and track settings appear</li>
          <li>Click "Stop Mic" and verify tracks stop cleanly</li>
          <li>Try multiple start/stop cycles</li>
          <li>Compare behavior in dev vs packaged production</li>
        </ol>
      </div>
    </div>
  );
}
