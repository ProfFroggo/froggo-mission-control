/**
 * Example component demonstrating help system integration
 * Shows how to use tooltips, help buttons, and tours
 */

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import Tooltip, { HelpTooltip } from './Tooltip';
import HelpPanel from './HelpPanel';
import { useTour } from './TourGuide';

export default function HelpExample() {
  const [helpOpen, setHelpOpen] = useState(false);
  const { startTour } = useTour();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Help System Demo</h1>

      {/* Basic Tooltip */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Basic Tooltip</h2>
        <Tooltip content="This is a helpful tooltip that appears on hover!">
          <button className="px-4 py-2 bg-clawd-accent text-white rounded-lg">
            Hover for help
          </button>
        </Tooltip>
      </div>

      {/* Help Icon Tooltip */}
      <div>
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          Help Icon Tooltip
          <HelpTooltip content="Small help icons are great for inline documentation" />
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label>Task Priority</label>
            <HelpTooltip content="P0 = Critical, P1 = High, P2 = Medium, P3 = Low" />
          </div>
          <div className="flex items-center gap-2">
            <label>Agent Assignment</label>
            <HelpTooltip content="Choose Coder for code, Writer for content, Researcher for analysis" />
          </div>
        </div>
      </div>

      {/* Tooltip Positions */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Tooltip Positions</h2>
        <div className="flex gap-4 items-center justify-center p-8">
          <Tooltip content="Top tooltip" position="top">
            <button className="px-3 py-2 bg-clawd-border rounded">Top</button>
          </Tooltip>
          <Tooltip content="Bottom tooltip" position="bottom">
            <button className="px-3 py-2 bg-clawd-border rounded">Bottom</button>
          </Tooltip>
          <Tooltip content="Left tooltip" position="left">
            <button className="px-3 py-2 bg-clawd-border rounded">Left</button>
          </Tooltip>
          <Tooltip content="Right tooltip" position="right">
            <button className="px-3 py-2 bg-clawd-border rounded">Right</button>
          </Tooltip>
        </div>
      </div>

      {/* Help Panel */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Help Panel</h2>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <HelpCircle size={20} />
          Open Help Panel
        </button>
        <HelpPanel
          isOpen={helpOpen}
          onClose={() => setHelpOpen(false)}
          currentPanel="dashboard"
        />
      </div>

      {/* Tours */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Interactive Tours</h2>
        <div className="flex gap-2">
          <button
            onClick={() => startTour('gettingStarted')}
            className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            Start Welcome Tour
          </button>
          <button
            onClick={() => startTour('kanbanWorkflow')}
            className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            Start Kanban Tour
          </button>
          <button
            onClick={() => startTour('voiceAssistant')}
            className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            Start Voice Tour
          </button>
        </div>
      </div>

      {/* Rich Tooltip */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Rich Tooltip Content</h2>
        <Tooltip
          content={
            <div>
              <strong>Pro Tip:</strong>
              <p className="text-xs mt-1">
                Use ⌘K for global search and ⌘H for help anytime!
              </p>
            </div>
          }
          maxWidth={300}
        >
          <button className="px-4 py-2 bg-clawd-border rounded-lg">
            Rich Content Tooltip
          </button>
        </Tooltip>
      </div>

      {/* Documentation */}
      <div className="mt-8 p-4 bg-clawd-bg border border-clawd-border rounded-lg">
        <h3 className="font-semibold mb-2">Quick Reference</h3>
        <ul className="text-sm space-y-1 text-clawd-text-dim">
          <li>• Press <kbd className="px-1 bg-clawd-border rounded">⌘H</kbd> to open help</li>
          <li>• Press <kbd className="px-1 bg-clawd-border rounded">⌘?</kbd> for keyboard shortcuts</li>
          <li>• Hover over <HelpTooltip content="Like this!" /> icons for contextual help</li>
          <li>• Start tours for guided walkthroughs</li>
        </ul>
      </div>
    </div>
  );
}
