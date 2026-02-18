import type { XTab } from './XTwitterPage';
import { XAnalyticsView } from './XAnalyticsView';
import { XEnhancedAnalyticsView } from './XEnhancedAnalyticsView';
import XResearchView from './XResearchView';
import XPlanListView from './XPlanListView';
import XDraftListView from './XDraftListView';
import { XCalendarView } from './XCalendarView';
import { XMentionsView } from './XMentionsView';
import { XReplyGuyView } from './XReplyGuyView';
import { XContentMixTracker } from './XContentMixTracker';
import XAutomationsTab from './XAutomationsTab';
import { XRedditView } from './XRedditView';

interface XContentEditorPaneProps {
  tab: XTab;
}

export default function XContentEditorPane({ tab }: XContentEditorPaneProps) {
  if (tab === 'reddit') {
    return <XRedditView />;
  }

  if (tab === 'research') {
    return <XResearchView />;
  }

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
    return <XEnhancedAnalyticsView />;
  }

  return null;
}
