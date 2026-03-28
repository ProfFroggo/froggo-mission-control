'use client';

import { useState, useCallback, useRef } from 'react';
import { Flex, IconButton, Tooltip } from '@radix-ui/themes';
import { Workflow, RefreshCw, ExternalLink, Wifi, WifiOff } from 'lucide-react';

const WORKFLOW_STUDIO_URL = 'http://localhost:4000/workspace/local/w/demo';

export default function WorkflowStudioPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(false);
    if (iframeRef.current) {
      iframeRef.current.src = WORKFLOW_STUDIO_URL;
    }
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    window.open(WORKFLOW_STUDIO_URL, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <Flex direction="column" className="h-full w-full bg-mission-control-surface">
      {/* Toolbar */}
      <Flex
        align="center"
        justify="between"
        px="3"
        py="2"
        className="border-b border-mission-control-border shrink-0"
      >
        <Flex align="center" gap="2">
          <Workflow size={16} className="text-mission-control-text-dim" />
          <span className="text-sm font-medium text-mission-control-text">
            Workflow Studio
          </span>
        </Flex>

        <Flex align="center" gap="1">
          {/* Connection status */}
          <Tooltip content={error ? 'Disconnected' : loading ? 'Connecting...' : 'Connected'}>
            <Flex
              align="center"
              justify="center"
              className="w-7 h-7 rounded-md"
            >
              {error ? (
                <WifiOff size={14} className="text-[var(--color-danger)]" />
              ) : (
                <Wifi
                  size={14}
                  className={loading ? 'text-mission-control-text-dim animate-pulse' : 'text-[var(--color-success)]'}
                />
              )}
            </Flex>
          </Tooltip>

          {/* Refresh */}
          <Tooltip content="Refresh">
            <IconButton
              size="1"
              variant="ghost"
              onClick={handleRefresh}
              aria-label="Refresh Workflow Studio"
            >
              <RefreshCw size={14} />
            </IconButton>
          </Tooltip>

          {/* Open in new tab */}
          <Tooltip content="Open in new tab">
            <IconButton
              size="1"
              variant="ghost"
              onClick={handleOpenInNewTab}
              aria-label="Open Workflow Studio in new tab"
            >
              <ExternalLink size={14} />
            </IconButton>
          </Tooltip>
        </Flex>
      </Flex>

      {/* Content area */}
      <div className="relative flex-1 min-h-0">
        {/* Loading skeleton */}
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-mission-control-surface z-10">
            <div className="w-8 h-8 border-2 border-mission-control-border border-t-mission-control-accent rounded-full animate-spin" />
            <span className="text-sm text-mission-control-text-dim">
              Connecting to Workflow Studio...
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-mission-control-surface z-10">
            <WifiOff size={32} className="text-mission-control-text-dim" />
            <div className="text-center">
              <p className="text-sm font-medium text-mission-control-text">
                Unable to connect to Workflow Studio
              </p>
              <p className="text-xs text-mission-control-text-dim mt-1">
                Make sure it is running on port 4000
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-mission-control-accent text-white hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        )}

        {/* Iframe */}
        <iframe
          key="stable-workflow-iframe"
          ref={iframeRef}
          src={WORKFLOW_STUDIO_URL}
          title="Workflow Studio"
          className="w-full h-full border-0"
          onLoad={handleLoad}
          onError={handleError}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </Flex>
  );
}
