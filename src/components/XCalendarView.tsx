import { useState, useEffect, useCallback } from 'react';
import EpicCalendar from './EpicCalendar';

function eventColorResolver(event: CalendarEvent): string | undefined {
  const colorId = (event as any).colorId || '';
  if (colorId === 'research')  return 'bg-purple-500';
  if (colorId === 'plan')      return 'bg-blue-500';
  if (colorId === 'draft')     return 'bg-amber-500';
  if (colorId === 'scheduled') return 'bg-emerald-500';
  return undefined;
}

function mapResearchToEvents(ideas: any[]): CalendarEvent[] {
  return ideas.map(idea => {
    const d = new Date(idea.created_at);
    return {
      id: `research-${idea.id}`,
      summary: `[Research] ${idea.title || 'Untitled'}`,
      description: idea.description || '',
      start: { date: d.toISOString().split('T')[0] },
      end: { date: d.toISOString().split('T')[0] },
      colorId: 'research',
      source: 'x-pipeline' as any,
    } as CalendarEvent;
  });
}

function mapPlansToEvents(plans: any[]): CalendarEvent[] {
  return plans.map(plan => {
    const d = new Date(plan.created_at);
    return {
      id: `plan-${plan.id}`,
      summary: `[Plan] ${plan.title || 'Untitled'}`,
      description: plan.description || '',
      start: { date: d.toISOString().split('T')[0] },
      end: { date: d.toISOString().split('T')[0] },
      colorId: 'plan',
      source: 'x-pipeline' as any,
    } as CalendarEvent;
  });
}

function mapDraftsToEvents(drafts: any[]): CalendarEvent[] {
  return drafts.map(draft => {
    const d = new Date(draft.created_at);
    let title = 'Untitled Draft';
    try {
      const parsed = typeof draft.content === 'string' ? JSON.parse(draft.content) : draft.content;
      title = parsed?.tweets?.[0]?.text?.slice(0, 60) || draft.content?.slice?.(0, 60) || title;
    } catch {
      title = typeof draft.content === 'string' ? draft.content.slice(0, 60) : title;
    }
    return {
      id: `draft-${draft.id}`,
      summary: `[Draft] ${title}`,
      description: draft.content || '',
      start: { date: d.toISOString().split('T')[0] },
      end: { date: d.toISOString().split('T')[0] },
      colorId: 'draft',
      source: 'x-pipeline' as any,
    } as CalendarEvent;
  });
}

function mapScheduledToEvents(scheduled: any[]): CalendarEvent[] {
  return scheduled.map(s => {
    const startDate = new Date(s.scheduled_for);
    const endDate = new Date(s.scheduled_for + 3600000);
    let title = 'Scheduled Tweet';
    try {
      const parsed = typeof s.draft_content === 'string' ? JSON.parse(s.draft_content) : s.draft_content;
      title = parsed?.tweets?.[0]?.text?.slice(0, 60) || s.draft_content?.slice?.(0, 60) || title;
    } catch {
      title = typeof s.draft_content === 'string' ? s.draft_content.slice(0, 60) : title;
    }
    return {
      id: `scheduled-${s.id}`,
      summary: title,
      description: s.draft_content || '',
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      colorId: 'scheduled',
      source: 'x-pipeline' as any,
    } as CalendarEvent;
  });
}

function isEventDraggable(event: CalendarEvent): boolean {
  return (event as any).colorId === 'scheduled';
}

export function XCalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const loadPipelineAsEvents = useCallback(async () => {
    try {
      const [researchResult, planResult, draftResult, scheduleResult] = await Promise.all([
        window.clawdbot?.xResearch?.list({}),
        window.clawdbot?.xPlan?.list({}),
        window.clawdbot?.xDraft?.list({}),
        window.clawdbot?.xSchedule?.list({}),
      ]);

      const mapped: CalendarEvent[] = [
        ...mapResearchToEvents((researchResult as any)?.ideas || []),
        ...mapPlansToEvents((planResult as any)?.plans || []),
        ...mapDraftsToEvents((draftResult as any)?.drafts || []),
        ...mapScheduledToEvents((scheduleResult as any)?.scheduled || []),
      ];

      setEvents(mapped);
    } catch (err) {
      console.error('[XCalendarView] Failed to load pipeline events:', err);
    }
  }, []);

  useEffect(() => {
    loadPipelineAsEvents();
  }, [loadPipelineAsEvents]);

  const handleCreateTweet = useCallback(() => {
    window.dispatchEvent(new CustomEvent('x-tab-change', { detail: 'drafts' }));
  }, []);

  const handleExternalDrop = useCallback(async (
    event: CalendarEvent,
    newStart: Date,
    _newEnd: Date,
  ): Promise<boolean> => {
    if ((event as any).colorId !== 'scheduled') return false;
    try {
      const realId = event.id.replace('scheduled-', '');
      const result = await window.clawdbot?.xSchedule?.update({
        id: realId,
        scheduledFor: newStart.getTime(),
      });
      if ((result as any)?.success) {
        await loadPipelineAsEvents();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [loadPipelineAsEvents]);

  return (
    <EpicCalendar
      externalEvents={events}
      createButtonLabel="Create Tweet"
      onCreateClick={handleCreateTweet}
      onExternalDrop={handleExternalDrop}
      eventColorResolver={eventColorResolver}
      isEventDraggable={isEventDraggable}
    />
  );
}
