/**
 * Overflow & Truncation Test Panel
 * 
 * Demonstrates proper text truncation and overflow handling
 * with various edge cases and content lengths.
 */

import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function OverflowTestPanel() {
  // Test content - various lengths
  const shortText = "Short task";
  const mediumText = "Medium length task title for testing";
  const longText = "This is an extremely long task title that should truncate properly with ellipsis and not break the card layout even with very long content";
  const veryLongText = "This is an extraordinarily long task title that goes on and on and on to test the absolute limits of text truncation and ensure that even with massive amounts of text the card layout remains stable and the ellipsis works correctly without any layout breaks or overflow issues whatsoever";
  
  const shortMessage = "Quick update";
  const longMessage = "This is a longer message preview that should show two lines of text before truncating with an ellipsis to demonstrate multi-line truncation behavior";
  const veryLongMessage = "This is an extremely long message that contains multiple sentences and should demonstrate how the message preview component handles very long content by truncating after two lines and adding an ellipsis to indicate there is more content available which can be viewed by clicking or hovering over the element";

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-clawd-surface rounded-xl border border-clawd-border p-6">
          <h1 className="text-2xl font-bold mb-2">Overflow & Truncation Test Panel</h1>
          <p className="text-clawd-text-dim">
            This panel demonstrates the text truncation and overflow handling fixes.
            Resize your browser window to see responsive behavior.
          </p>
        </div>

        {/* Single-line Truncation Tests */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info size={20} className="text-blue-400" />
            Single-line Truncation (.text-truncate)
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Short text */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Short Text</div>
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="text-green-400 no-shrink" size={16} />
                  <div className="text-truncate flex-fill">{shortText}</div>
                  <span className="badge-text no-shrink px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                    Badge
                  </span>
                </div>
              </div>
            </div>

            {/* Medium text */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Medium Text</div>
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="text-green-400 no-shrink" size={16} />
                  <div className="text-truncate flex-fill">{mediumText}</div>
                  <span className="badge-text no-shrink px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                    Badge
                  </span>
                </div>
              </div>
            </div>

            {/* Long text */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Long Text</div>
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="text-green-400 no-shrink" size={16} />
                  <div className="text-truncate flex-fill" title={longText}>{longText}</div>
                  <span className="badge-text no-shrink px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                    Badge
                  </span>
                </div>
              </div>
            </div>

            {/* Very long text */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Very Long Text</div>
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="text-orange-400 no-shrink" size={16} />
                  <div className="text-truncate flex-fill" title={veryLongText}>{veryLongText}</div>
                  <span className="badge-text no-shrink px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
                    Long Badge Text
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-line Truncation Tests */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info size={20} className="text-purple-400" />
            Multi-line Truncation (.text-truncate-2)
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {/* Short message */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Short Message</div>
                <div className="message-preview text-sm">{shortMessage}</div>
              </div>
            </div>

            {/* Long message */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Long Message</div>
                <div className="message-preview text-sm">{longMessage}</div>
              </div>
            </div>

            {/* Very long message */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="card-spacing">
                <div className="text-xs text-clawd-text-dim mb-2">Very Long Message</div>
                <div className="message-preview text-sm">{veryLongMessage}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Card Simulation */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info size={20} className="text-green-400" />
            Task Card Layout (Real-world Example)
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Normal task card */}
            <div className="bg-clawd-bg rounded-xl border border-clawd-border overflow-hidden card-layout">
              <div className="card-header">
                <div className="w-2 h-2 rounded-full bg-blue-400 no-shrink" />
                <div className="task-title flex-fill">{mediumText}</div>
                <span className="badge-text no-shrink px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                  In Progress
                </span>
              </div>
              <div className="card-body">
                <div className="task-description">{longMessage}</div>
              </div>
              <div className="card-footer">
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  <span className="badge-text no-shrink px-2 py-1 bg-clawd-surface rounded text-xs">
                    📁 Project Alpha
                  </span>
                  <span className="badge-text no-shrink px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                    📅 Due Today
                  </span>
                </div>
                <span className="badge-text no-shrink px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                  🤖 Coder
                </span>
              </div>
            </div>

            {/* Overflow stress test card */}
            <div className="bg-clawd-bg rounded-xl border border-red-500/30 overflow-hidden card-layout">
              <div className="card-header">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse no-shrink" />
                <div className="task-title flex-fill" title={veryLongText}>{veryLongText}</div>
                <span className="badge-text no-shrink px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                  P0 Urgent
                </span>
              </div>
              <div className="card-body">
                <div className="task-description">{veryLongMessage}</div>
              </div>
              <div className="card-footer">
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  <span className="badge-text no-shrink px-2 py-1 bg-clawd-surface rounded text-xs">
                    📁 Very Long Project Name Here
                  </span>
                  <span className="badge-text no-shrink px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                    📅 Overdue
                  </span>
                </div>
                <span className="badge-text no-shrink px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                  🤖 Chief
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Agent/Session Card Tests */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info size={20} className="text-yellow-400" />
            Agent/Session Cards
          </h2>

          <div className="space-y-2">
            {/* Normal session */}
            <div className="bg-clawd-surface rounded-lg border border-clawd-border p-3 flex items-center gap-3 overflow-hidden">
              <span className="no-shrink">💬</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 no-shrink" />
              <span className="session-name flex-fill">whatsapp:kevin:session-123456</span>
              <span className="badge-text no-shrink px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                Active
              </span>
              <span className="text-xs text-clawd-text-dim no-shrink no-wrap">2m ago</span>
            </div>

            {/* Long session key */}
            <div className="bg-clawd-surface rounded-lg border border-clawd-border p-3 flex items-center gap-3 overflow-hidden">
              <span className="no-shrink">🤖</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse no-shrink" />
              <span className="session-name flex-fill" title="agent:chat-agent:subagent:coder-task-extremely-long-identifier-1234567890-abcdefghijklmnop">
                agent:chat-agent:subagent:coder-task-extremely-long-identifier-1234567890-abcdefghijklmnop
              </span>
              <span className="badge-text no-shrink px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                Working
              </span>
              <span className="text-xs text-clawd-text-dim no-shrink no-wrap">12.5k tokens</span>
            </div>

            {/* Agent with long task */}
            <div className="bg-clawd-surface rounded-lg border border-clawd-border p-3 flex items-center gap-2 overflow-hidden">
              <span className="no-shrink text-xl">🧑‍💻</span>
              <div className="flex-fill">
                <div className="agent-name font-medium flex-shrink">Coder Agent</div>
                <div className="text-xs text-clawd-text-dim text-truncate">
                  Working on: {veryLongText}
                </div>
              </div>
              <span className="badge-text no-shrink px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                Busy
              </span>
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <div className="bg-clawd-surface rounded-xl border border-clawd-border p-6">
          <h3 className="text-sm font-semibold mb-4">Test Results Legend</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>Text truncates properly with CSS ellipsis (...)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>Icons and badges never shrink or wrap</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>Card layouts remain stable with any content length</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <span>Full text available on hover (title attribute)</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-400" />
              <span>Red border cards = stress tests with extreme content</span>
            </div>
          </div>
        </div>

        {/* Resize Instructions */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-2 text-blue-400">Testing Instructions</h3>
          <ol className="space-y-1 text-sm text-clawd-text-dim list-decimal list-inside">
            <li>Resize your browser window to test responsive behavior</li>
            <li>Verify all text truncates cleanly with ellipsis (...)</li>
            <li>Check that badges and icons never shrink or disappear</li>
            <li>Hover over truncated text to see full content (title attribute)</li>
            <li>Confirm no horizontal scrolling within cards</li>
            <li>Look for any layout breaks or overflow</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
