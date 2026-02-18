import type { XTab } from './XTwitterPage';
import XPlanListView from './XPlanListView';
import XDraftListView from './XDraftListView';
import { XCalendarView } from './XCalendarView';
import { XMentionsView } from './XMentionsView';
import { XReplyGuyView } from './XReplyGuyView';
import { XContentMixTracker } from './XContentMixTracker';
import XAutomationsTab from './XAutomationsTab';

interface XContentEditorPaneProps {
  tab: XTab;
}

export default function XContentEditorPane({ tab }: XContentEditorPaneProps) {
  if (tab === 'plan') {
    return <XPlanListView />;
  }

  if (tab === 'drafts') {
    return <XDraftListView />;
  }

  if (tab === 'calendar') {
    return <XCalendarView />;
  }

  if (tab === 'mentions') {
    return <XMentionsView />;
  }

  if (tab === 'reply-guy') {
    return <XReplyGuyView />;
  }

  if (tab === 'content-mix') {
    return <XContentMixTracker />;
  }

  if (tab === 'automations') {
    return <XAutomationsTab />;
  }

  if (tab === 'analytics') {
    return (
      <div className="flex flex-col h-full bg-clawd-surface p-6">
        <h3 className="text-lg font-semibold text-clawd-text mb-2">X Analytics</h3>
        <p className="text-sm text-clawd-text-dim mb-6">Track your X/Twitter performance and engagement metrics.</p>
        <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
          <div className="text-center">
            <p className="text-sm">Analytics dashboard coming soon</p>
            <p className="text-xs mt-2">Posts, engagement, reach, and top content breakdown</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
