/**
 * ARTIFACT PANEL INTEGRATION EXAMPLE
 * 
 * This file demonstrates how to integrate the Artifact Panel System
 * into an existing chat component.
 * 
 * Prerequisites:
 * - artifactStore.ts
 * - artifactExtractor.ts
 * - useArtifactExtraction.ts
 * - ArtifactPanel.tsx
 */

import React from 'react';
import ArtifactPanel from '../components/ArtifactPanel';
import { useArtifactExtraction, useArtifactDetection } from '../hooks/useArtifactExtraction';
import { useArtifactStore } from '../store/artifactStore';

// Example: Your existing chat store interface
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ExistingChatStore {
  messages: ChatMessage[];
  currentSessionId: string;
  // ... other properties
}

// Mock for demonstration - replace with your actual store
declare const useChatStore: () => ExistingChatStore;

/**
 * INTEGRATION OPTION 1: Basic Integration
 * 
 * Simply add ArtifactPanel beside your chat and use the extraction hook.
 * This is the simplest approach.
 */
export function BasicChatWithArtifacts() {
  const { messages, currentSessionId } = useChatStore();
  
  // Auto-extract artifacts from assistant messages
  useArtifactExtraction(messages, currentSessionId, {
    autoExtract: true,
    extractFromAssistant: true,
    extractFromUser: false,
  });

  return (
    <div className="flex h-screen">
      {/* Your existing chat UI */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-4">
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <input type="text" placeholder="Type a message..." className="w-full" />
        </div>
      </div>
      
      {/* Add the artifact panel */}
      <ArtifactPanel />
    </div>
  );
}

/**
 * INTEGRATION OPTION 2: With Artifact Indicators
 * 
 * Show indicators on messages that contain artifacts.
 * Users can see which messages have extractable content.
 */
export function ChatWithArtifactIndicators() {
  const { messages, currentSessionId } = useChatStore();
  
  useArtifactExtraction(messages, currentSessionId);

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg) => (
            <MessageWithIndicator key={msg.id} message={msg} />
          ))}
        </div>
        <div className="p-4 border-t">
          <input type="text" placeholder="Type a message..." className="w-full" />
        </div>
      </div>
      <ArtifactPanel />
    </div>
  );
}

function MessageWithIndicator({ message }: { message: ChatMessage }) {
  const { hasArtifacts, count } = useArtifactDetection(message);

  return (
    <div className="mb-4 p-3 rounded-lg bg-white shadow">
      <div className="flex items-start justify-between mb-2">
        <strong className="text-sm font-semibold">{message.role}</strong>
        {hasArtifacts && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            📎 {count} artifact{count > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
    </div>
  );
}

/**
 * INTEGRATION OPTION 3: Manual Extraction Controls
 * 
 * Give users a button to manually extract artifacts from specific messages.
 * Useful when you want more control over when extraction happens.
 */
export function ChatWithManualExtraction() {
  const { messages, currentSessionId } = useChatStore();
  
  // Don't auto-extract, only manual
  const { extractManually } = useArtifactExtraction(messages, currentSessionId, {
    autoExtract: false,
  });

  const handleExtractClick = (messageId: string) => {
    const extracted = extractManually(messageId);
    console.log(`Extracted ${extracted.length} artifacts from message ${messageId}`);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg) => (
            <MessageWithExtractButton
              key={msg.id}
              message={msg}
              onExtract={handleExtractClick}
            />
          ))}
        </div>
        <div className="p-4 border-t">
          <input type="text" placeholder="Type a message..." className="w-full" />
        </div>
      </div>
      <ArtifactPanel />
    </div>
  );
}

function MessageWithExtractButton({
  message,
  onExtract,
}: {
  message: ChatMessage;
  onExtract: (id: string) => void;
}) {
  const { hasArtifacts, count } = useArtifactDetection(message);

  return (
    <div className="mb-4 p-3 rounded-lg bg-white shadow">
      <div className="flex items-start justify-between mb-2">
        <strong className="text-sm font-semibold">{message.role}</strong>
        {hasArtifacts && (
          <button
            onClick={() => onExtract(message.id)}
            className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            Extract {count} artifact{count > 1 ? 's' : ''}
          </button>
        )}
      </div>
      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
    </div>
  );
}

/**
 * INTEGRATION OPTION 4: Session-Aware with Filtering
 * 
 * Filter artifacts by current session and provide clear/filter controls.
 * Good for multi-session chat applications.
 */
export function ChatWithSessionFiltering() {
  const { messages, currentSessionId } = useChatStore();
  const { setFilterBySession, clearSessionArtifacts } = useArtifactStore();

  useArtifactExtraction(messages, currentSessionId);

  // Filter to current session when session changes
  React.useEffect(() => {
    setFilterBySession(currentSessionId);
  }, [currentSessionId, setFilterBySession]);

  const handleClearSession = () => {
    clearSessionArtifacts(currentSessionId);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Session: {currentSessionId}</h2>
          <button
            onClick={handleClearSession}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Clear Session Artifacts
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-4">
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <input type="text" placeholder="Type a message..." className="w-full" />
        </div>
      </div>
      <ArtifactPanel />
    </div>
  );
}

/**
 * INTEGRATION OPTION 5: Programmatic Artifact Creation
 * 
 * Create artifacts programmatically from custom actions,
 * not just from message extraction.
 */
export function ChatWithProgrammaticArtifacts() {
  const { messages, currentSessionId } = useChatStore();
  const { addArtifact } = useArtifactStore();

  useArtifactExtraction(messages, currentSessionId);

  // Example: User uploads a file
  const handleFileUpload = async (file: File) => {
    const content = await file.text();
    
    addArtifact({
      type: 'file',
      title: file.name,
      content,
      messageId: `upload-${Date.now()}`,
      sessionId: currentSessionId,
      timestamp: Date.now(),
      metadata: {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
      },
      tags: ['user-upload'],
    });
  };

  // Example: Generate code snippet
  const handleGenerateSnippet = () => {
    const code = `function example() {
  return "Generated at ${new Date().toISOString()}";
}`;

    addArtifact({
      type: 'code',
      title: 'Generated Example',
      content: code,
      messageId: `generated-${Date.now()}`,
      sessionId: currentSessionId,
      timestamp: Date.now(),
      metadata: {
        language: 'javascript',
      },
      tags: ['generated', 'example'],
    });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex gap-2">
          <label className="px-3 py-2 bg-blue-500 text-white text-sm rounded cursor-pointer hover:bg-blue-600">
            Upload File
            <input
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>
          <button
            onClick={handleGenerateSnippet}
            className="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600"
          >
            Generate Snippet
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-4">
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <input type="text" placeholder="Type a message..." className="w-full" />
        </div>
      </div>
      <ArtifactPanel />
    </div>
  );
}

/**
 * INTEGRATION OPTION 6: Artifact Panel Toggle
 * 
 * Add a toggle button in your chat header to show/hide the panel.
 */
export function ChatWithToggleablePanel() {
  const { messages, currentSessionId } = useChatStore();
  const { isCollapsed, toggleCollapse } = useArtifactStore();

  useArtifactExtraction(messages, currentSessionId);

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Chat</h2>
          <button
            onClick={toggleCollapse}
            className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
          >
            {isCollapsed ? 'Show' : 'Hide'} Artifacts
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-4">
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <input type="text" placeholder="Type a message..." className="w-full" />
        </div>
      </div>
      <ArtifactPanel />
    </div>
  );
}

/**
 * MIGRATION GUIDE: Adding to Existing Chat Component
 * 
 * 1. Import dependencies:
 *    import ArtifactPanel from './components/ArtifactPanel';
 *    import { useArtifactExtraction } from './hooks/useArtifactExtraction';
 * 
 * 2. Add the hook to your component:
 *    useArtifactExtraction(messages, sessionId);
 * 
 * 3. Add ArtifactPanel to your layout:
 *    <div className="flex">
 *      <div className="flex-1">{/* existing chat */}</div>
 *      <ArtifactPanel />
 *    </div>
 * 
 * 4. Optional enhancements:
 *    - Add artifact indicators to messages
 *    - Add manual extraction buttons
 *    - Add session filtering
 *    - Add toggle controls
 */

export default BasicChatWithArtifacts;
