import type { XTab } from './XTwitterPage';
import XResearchIdeaEditor from './XResearchIdeaEditor';
import XPlanThreadComposer from './XPlanThreadComposer';
import XDraftComposer from './XDraftComposer';

interface XContentEditorPaneProps {
  tab: XTab;
}

export default function XContentEditorPane({ tab }: XContentEditorPaneProps) {
  // Research tab has full editor
  if (tab === 'research') {
    return <XResearchIdeaEditor />;
  }
  
  // Plan tab has thread composer
  if (tab === 'plan') {
    return <XPlanThreadComposer />;
  }
  
  // Drafts tab has draft composer
  if (tab === 'drafts') {
    return <XDraftComposer />;
  }

  // Other tabs: placeholder
  return (
    <div className="flex flex-col h-full bg-gray-900 p-4">
      <h3 className="text-lg font-semibold text-white mb-4">
        {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')} Content
      </h3>
      
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-sm">Content editor for {tab} tab</p>
          <p className="text-xs mt-2">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
