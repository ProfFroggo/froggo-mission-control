import { CheckCircle, XCircle, Clock } from 'lucide-react';
import type { XTab } from './XTwitterPage';

interface XApprovalQueuePaneProps {
  tab: XTab;
}

export default function XApprovalQueuePane({ tab }: XApprovalQueuePaneProps) {
  // TODO: Load actual approval items from database
  const items: any[] = [];

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Approval Queue</h3>
          <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
            {items.length} pending
          </span>
        </div>
      </div>

      {/* Queue Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <Clock className="w-12 h-12 text-gray-600 mb-3" />
            <p className="font-medium text-gray-300">No items pending approval</p>
            <p className="text-sm mt-1">Items will appear here when agents propose content</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">Proposed by {item.proposedBy}</p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-300 mb-3 line-clamp-3">{item.description}</p>
                
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
