import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Globe,
  CheckCircle,
  Mail,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { showToast } from './Toast';
import { getUserFriendlyError, getErrorTitle } from '../utils/errorMessages';
import CalendarFilterModal from './CalendarFilterModal';
import TaskModal from './TaskModal';
import { TaskPriority } from '../store/store';
import { useUserSettings } from '../store/userSettings';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Unified event type
type UnifiedEventType = 'calendar' | 'post' | 'task';
type ScheduledPostType = 'tweet' | 'email' | 'message';

interface UnifiedEvent {
  id: string;
  type: UnifiedEventType;
  title: string;
  start: string;
  end?: string;
  
  // Calendar-specific
  location?: string;
  attendees?: { email: string; displayName?: string }[];
  description?: string;
  isAllDay?: boolean;
  recurring?: boolean;
  account?: string;
  timeZone?: string;
  
  // Post-specific
  postType?: ScheduledPostType;
  content?: string;
  status?: 'pending' | 'sent' | 'cancelled' | 'failed';
  
  // Task-specific
  taskId?: string;
  project?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

interface CalendarAccount {
  email: string;
  label: string;
}

type ViewMode = 'month' | 'week' | 'day';

// Calendar accounts derived from user settings - see useUserSettings store
const ACCOUNTS: CalendarAccount[] = useUserSettings.getState().emailAccounts.map(a => ({ email: a.email, label: a.label }));

const TIMEZONES = [
  'Europe/Gibraltar',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'UTC',
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function CalendarPanel() {
  // State
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, _setSelectedAccount] = useState(ACCOUNTS[0].email);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<UnifiedEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskInitialData, setTaskInitialData] = useState<{
    title?: string;
    description?: string;
    project?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assignedTo?: string;
  } | undefined>(undefined);
  
  // Filter toggles
  const [showCalendarEvents, setShowCalendarEvents] = useState(true);
  const [showScheduledPosts, setShowScheduledPosts] = useState(true);
  const [showTaskDeadlines, setShowTaskDeadlines] = useState(true);
  const [enabledCalendarSources, setEnabledCalendarSources] = useState<string[]>([]);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAttendees, setFormAttendees] = useState('');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formRecurrence, setFormRecurrence] = useState('none');
  const [formTimeZone, setFormTimeZone] = useState('Europe/Gibraltar');

  // Load enabled calendar sources on mount
  useEffect(() => {
    const saved = localStorage.getItem('calendar-filter-preferences');
    if (saved) {
      setEnabledCalendarSources(JSON.parse(saved));
    }
  }, []);

  // Check if a calendar source is enabled
  const isSourceEnabled = useCallback((sourceId: string) => {
    if (enabledCalendarSources.length === 0) return true; // If no filters saved, show all
    return enabledCalendarSources.includes(sourceId);
  }, [enabledCalendarSources]);

  // Fetch events from all sources
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const daysToFetch = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
      const allEvents: UnifiedEvent[] = [];

      // 1. Fetch Google Calendar events from all accounts
      if (showCalendarEvents) {
        for (const account of ACCOUNTS) {
          const sourceId = `google:${account.email}`;
          if (!isSourceEnabled(sourceId)) continue;

          try {
            const calResult = await (window as any).clawdbot?.calendar?.events(account.email, daysToFetch);
            if (calResult?.success && calResult.events?.events) {
              const calEvents: UnifiedEvent[] = calResult.events.events.map((e: any) => ({
                id: `cal_${account.email}_${e.id}`,
                type: 'calendar' as UnifiedEventType,
                title: e.summary || 'Untitled',
                start: e.start?.dateTime || e.start?.date || '',
                end: e.end?.dateTime || e.end?.date || '',
                location: e.location || '',
                attendees: e.attendees || [],
                description: e.description || '',
                isAllDay: !!e.start?.date && !e.start?.dateTime,
                recurring: !!e.recurrence,
                account: account.email,
                timeZone: e.start?.timeZone || 'Europe/Gibraltar',
              }));
              allEvents.push(...calEvents);
            }
          } catch (e) {
            console.error(`Failed to fetch calendar events for ${account.email}:`, e);
          }
        }
      }

      // 2. Fetch scheduled posts
      if (showScheduledPosts && isSourceEnabled('social:twitter')) {
        try {
          const scheduleResult = await (window as any).clawdbot?.schedule?.list();
          if (scheduleResult?.success && scheduleResult.items) {
            const postEvents: UnifiedEvent[] = scheduleResult.items
              .filter((item: any) => item.status === 'pending')
              .map((item: any) => ({
                id: `post_${item.id}`,
                type: 'post' as UnifiedEventType,
                title: item.type === 'tweet' ? `Tweet: ${item.content.substring(0, 50)}...` :
                       item.type === 'email' ? `Email: ${item.metadata?.subject || 'No subject'}` :
                       `Message: ${item.content.substring(0, 50)}...`,
                start: item.scheduledFor,
                content: item.content,
                postType: item.type,
                status: item.status,
                description: item.content,
              }));
            allEvents.push(...postEvents);
          }
        } catch (e) {
          console.error('Failed to fetch scheduled posts:', e);
        }
      }

      // 3. Fetch tasks with due dates
      if (showTaskDeadlines && isSourceEnabled('mission-control:tasks')) {
        try {
          const tasksResult = await (window as any).clawdbot?.tasks?.list();
          if (tasksResult?.success && tasksResult.tasks) {
            const taskEvents: UnifiedEvent[] = tasksResult.tasks
              .filter((task: any) => task.dueDate && task.status !== 'done')
              .map((task: any) => ({
                id: `task_${task.id}`,
                type: 'task' as UnifiedEventType,
                title: `📋 ${task.title}`,
                start: task.dueDate,
                taskId: task.id,
                project: task.project,
                assignee: task.assignee,
                priority: task.priority,
                tags: task.tags,
                description: task.description,
              }));
            allEvents.push(...taskEvents);
          }
        } catch (e) {
          console.error('Failed to fetch tasks:', e);
        }
      }

      // Sort all events by start time
      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      
      setEvents(allEvents);
    } catch (e: any) {
      console.error('Failed to fetch unified events:', e);
      setError('Could not load calendar');
    } finally {
      setLoading(false);
    }
  }, [viewMode, showCalendarEvents, showScheduledPosts, showTaskDeadlines, isSourceEnabled]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Event CRUD operations
  const createEvent = async () => {
    if (!formTitle.trim() || !formStartDate) {
      showToast('error', 'Missing fields', 'Please fill in required fields (title, date)');
      return;
    }

    const startDateTime = formIsAllDay
      ? formStartDate
      : `${formStartDate}T${formStartTime || '09:00'}`;
    const endDateTime = formIsAllDay
      ? (formEndDate || formStartDate)
      : `${formEndDate || formStartDate}T${formEndTime || '10:00'}`;

    const attendeesList = formAttendees
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    try {
      setLoading(true);
      const result = await (window as any).clawdbot?.calendar?.createEvent({
        account: selectedAccount,
        title: formTitle,
        start: startDateTime,
        end: endDateTime,
        location: formLocation,
        description: formDescription,
        attendees: attendeesList,
        isAllDay: formIsAllDay,
        recurrence: formRecurrence !== 'none' ? formRecurrence : undefined,
        timeZone: formTimeZone,
      });

      if (result?.success) {
        showToast('success', 'Event created', `"${formTitle}" added to calendar`);
        resetForm();
        fetchEvents();
      } else {
        showToast('error', 'Failed', result?.error || 'Could not create event');
      }
    } catch (e: any) {
      const friendlyMessage = getUserFriendlyError(e, {
        action: 'create the event',
        resource: 'calendar event'
      });
      showToast('error', getErrorTitle(e), friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateEvent = async () => {
    if (!editingEvent || !formTitle.trim()) return;

    const startDateTime = formIsAllDay
      ? formStartDate
      : `${formStartDate}T${formStartTime}`;
    const endDateTime = formIsAllDay
      ? (formEndDate || formStartDate)
      : `${formEndDate || formStartDate}T${formEndTime}`;

    const attendeesList = formAttendees
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    try {
      setLoading(true);
      // Remove the 'cal_' prefix from the ID
      const eventId = editingEvent.id.replace('cal_', '');
      const result = await (window as any).clawdbot?.calendar?.updateEvent({
        account: selectedAccount,
        eventId,
        title: formTitle,
        start: startDateTime,
        end: endDateTime,
        location: formLocation,
        description: formDescription,
        attendees: attendeesList,
        isAllDay: formIsAllDay,
        timeZone: formTimeZone,
      });

      if (result?.success) {
        showToast('success', 'Event updated', `"${formTitle}" has been updated`);
        resetForm();
        fetchEvents();
      } else {
        showToast('error', 'Failed', result?.error || 'Could not update event');
      }
    } catch (e: any) {
      const friendlyMessage = getUserFriendlyError(e, {
        action: 'update the event',
        resource: 'calendar event'
      });
      showToast('error', getErrorTitle(e), friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (event: UnifiedEvent) => {
    if (event.type !== 'calendar') {
      showToast('info', 'Not supported', 'Only calendar events can be deleted here');
      return;
    }

    if (!confirm(`Delete "${event.title}"?`)) return;

    try {
      setLoading(true);
      // Remove the 'cal_' prefix from the ID
      const eventId = event.id.replace('cal_', '');
      const result = await (window as any).clawdbot?.calendar?.deleteEvent({
        account: selectedAccount,
        eventId,
      });

      if (result?.success) {
        showToast('success', 'Event deleted', `"${event.title}" removed from calendar`);
        setSelectedEvent(null);
        fetchEvents();
      } else {
        showToast('error', 'Failed', result?.error || 'Could not delete event');
      }
    } catch (e: any) {
      const friendlyMessage = getUserFriendlyError(e, {
        action: 'delete the event',
        resource: 'calendar event'
      });
      showToast('error', getErrorTitle(e), friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Form helpers
  const openCreateModal = () => {
    resetForm();
    setEditingEvent(null);
    setShowEventModal(true);

    // Set defaults
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    startTime.setMinutes(0, 0, 0);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    setFormStartDate(startTime.toISOString().split('T')[0]);
    setFormStartTime(startTime.toTimeString().slice(0, 5));
    setFormEndDate(endTime.toISOString().split('T')[0]);
    setFormEndTime(endTime.toTimeString().slice(0, 5));
  };

  const handleEventClick = (event: UnifiedEvent) => {
    setSelectedEvent(event);
    setShowEventDetailModal(true);
  };

  const openEditModal = (event: UnifiedEvent) => {
    if (event.type !== 'calendar') return;
    
    setEditingEvent(event);
    setShowEventModal(true);

    setFormTitle(event.title);
    setFormLocation(event.location || '');
    setFormDescription(event.description || '');
    setFormIsAllDay(event.isAllDay || false);
    setFormTimeZone(event.timeZone || 'Europe/Gibraltar');

    const startDate = new Date(event.start);
    setFormStartDate(startDate.toISOString().split('T')[0]);
    setFormStartTime(event.isAllDay ? '' : startDate.toTimeString().slice(0, 5));

    if (event.end) {
      const endDate = new Date(event.end);
      setFormEndDate(endDate.toISOString().split('T')[0]);
      setFormEndTime(event.isAllDay ? '' : endDate.toTimeString().slice(0, 5));
    }

    setFormAttendees(event.attendees?.map((a) => a.email).join(', ') || '');
  };

  const resetForm = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setFormTitle('');
    setFormStartDate('');
    setFormStartTime('');
    setFormEndDate('');
    setFormEndTime('');
    setFormLocation('');
    setFormDescription('');
    setFormAttendees('');
    setFormIsAllDay(false);
    setFormRecurrence('none');
    setFormTimeZone('Europe/Gibraltar');
  };

  // Export meeting as Markdown
  const exportMeetingAsMarkdown = (event: UnifiedEvent) => {
    if (event.type !== 'calendar') {
      showToast('info', 'Not supported', 'Only calendar events can be exported');
      return;
    }

    const startDate = new Date(event.start);
    const endDate = event.end ? new Date(event.end) : null;
    
    let markdown = `# ${event.title}\n\n`;
    markdown += `## Meeting Details\n\n`;
    markdown += `**Date:** ${startDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    markdown += `**Time:** ${formatTime(event.start, event.isAllDay)}`;
    if (endDate && !event.isAllDay) {
      markdown += ` - ${formatTime(event.end)}`;
    }
    markdown += `\n`;
    
    if (event.timeZone) {
      markdown += `**Time Zone:** ${event.timeZone}\n`;
    }
    
    if (event.location) {
      markdown += `**Location:** ${event.location}\n`;
    }
    
    if (event.recurring) {
      markdown += `**Recurring:** Yes\n`;
    }
    
    markdown += `\n`;
    
    if (event.attendees && event.attendees.length > 0) {
      markdown += `## Attendees\n\n`;
      event.attendees.forEach(attendee => {
        const name = attendee.displayName || attendee.email;
        markdown += `- ${name}${attendee.displayName ? ` (${attendee.email})` : ''}\n`;
      });
      markdown += `\n`;
    }
    
    if (event.description) {
      markdown += `## Description\n\n${event.description}\n\n`;
    }
    
    markdown += `## Notes\n\n_Add your meeting notes here_\n\n`;
    markdown += `## Action Items\n\n- [ ] \n\n`;
    markdown += `## Links\n\n`;
    
    // Create and download the file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${startDate.toISOString().split('T')[0]}.md`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('success', 'Exported', `Downloaded ${filename}`);
  };

  // Create task from meeting
  const createTaskFromMeeting = (event: UnifiedEvent) => {
    if (event.type !== 'calendar') {
      showToast('info', 'Not supported', 'Only calendar events can be converted to tasks');
      return;
    }

    const startDate = new Date(event.start);
    const taskTitle = `Follow up: ${event.title}`;
    let taskDescription = `Meeting: ${event.title}\n`;
    taskDescription += `Date: ${startDate.toLocaleDateString('en-GB')}\n`;
    taskDescription += `Time: ${formatTime(event.start, event.isAllDay)}`;
    
    if (event.location) {
      taskDescription += `\nLocation: ${event.location}`;
    }
    
    if (event.attendees && event.attendees.length > 0) {
      taskDescription += `\n\nAttendees:\n`;
      event.attendees.forEach(a => {
        taskDescription += `- ${a.displayName || a.email}\n`;
      });
    }
    
    if (event.description) {
      taskDescription += `\n\nMeeting Description:\n${event.description}`;
    }
    
    taskDescription += `\n\n---\n\nAction items and follow-up notes:`;

    // Set initial data and open task modal
    setTaskInitialData({
      title: taskTitle,
      description: taskDescription,
      project: 'Default',
    });
    
    // Close detail modal and open task modal
    setShowEventDetailModal(false);
    setShowTaskModal(true);
    
    showToast('success', 'Task Modal Opened', 'Meeting context has been pre-filled');
  };

  // Date navigation
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Event type styling
  const getEventStyle = (event: UnifiedEvent) => {
    switch (event.type) {
      case 'calendar':
        return {
          borderColor: 'border-l-blue-500',
          icon: Calendar,
          iconColor: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
        };
      case 'post':
        return {
          borderColor: 'border-l-purple-500',
          icon: event.postType === 'tweet' ? XIcon : Mail,
          iconColor: event.postType === 'tweet' ? 'text-white' : 'text-purple-400',
          bgColor: 'bg-purple-500/10',
        };
      case 'task':
        return {
          borderColor: 'border-l-green-500',
          icon: CheckCircle,
          iconColor: 'text-green-400',
          bgColor: 'bg-green-500/10',
        };
      default:
        return {
          borderColor: 'border-l-gray-500',
          icon: Calendar,
          iconColor: 'text-clawd-text-dim',
          bgColor: 'bg-clawd-bg0/10',
        };
    }
  };

  // Formatting helpers
  const formatTime = (iso: string, isAllDay?: boolean) => {
    if (isAllDay) return 'All day';
    const date = new Date(iso);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getTimeUntil = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return '';
  };

  const isUrgent = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    return diff > 0 && diff < 3600000; // Within 1 hour
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = formatDate(event.start);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, UnifiedEvent[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Calendar size={24} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Unified Calendar</h1>
              <p className="text-sm text-clawd-text-dim">
                {events.length} items • {ACCOUNTS.find((a) => a.email === selectedAccount)?.label}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilterModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-clawd-border rounded-xl hover:bg-clawd-border/80 transition-colors"
              title="Filter calendar sources"
            >
              <SlidersHorizontal size={14} />
              Calendars
            </button>
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-clawd-border rounded-xl hover:bg-clawd-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              <Plus size={16} />
              New Event
            </button>
          </div>
        </div>

        {/* Filter Toggles */}
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-clawd-text-dim" />
          <span className="text-sm text-clawd-text-dim mr-2">Show:</span>
          <button
            onClick={() => setShowCalendarEvents(!showCalendarEvents)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showCalendarEvents
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-clawd-border text-clawd-text-dim'
            }`}
          >
            <Calendar size={14} />
            Calendar
            <span className="text-xs opacity-70">
              ({events.filter((e) => e.type === 'calendar').length})
            </span>
          </button>
          <button
            onClick={() => setShowScheduledPosts(!showScheduledPosts)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showScheduledPosts
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-clawd-border text-clawd-text-dim'
            }`}
          >
            <XIcon size={14} />
            Posts
            <span className="text-xs opacity-70">
              ({events.filter((e) => e.type === 'post').length})
            </span>
          </button>
          <button
            onClick={() => setShowTaskDeadlines(!showTaskDeadlines)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showTaskDeadlines
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-clawd-border text-clawd-text-dim'
            }`}
          >
            <CheckCircle size={14} />
            Tasks
            <span className="text-xs opacity-70">
              ({events.filter((e) => e.type === 'task').length})
            </span>
          </button>
        </div>

        {/* View controls */}
        <div className="flex items-center justify-end">

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors text-sm"
            >
              Today
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            >
              <ChevronRight size={16} />
            </button>

            <div className="ml-2 flex gap-1 bg-clawd-border rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    viewMode === mode
                      ? 'bg-clawd-surface text-clawd-text'
                      : 'text-clawd-text-dim hover:text-clawd-text'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Filter Modal */}
      {showFilterModal && (
        <CalendarFilterModal
          onClose={() => setShowFilterModal(false)}
          onFilterChange={(enabledIds) => {
            setEnabledCalendarSources(enabledIds);
            fetchEvents();
          }}
        />
      )}

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {loading && events.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <Calendar size={48} className="mx-auto mb-4 opacity-50 animate-pulse" />
            <p>Loading calendar...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <p>{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-4 text-sm text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No events found</p>
            <p className="text-sm mb-4">Your calendar is clear</p>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              <Plus size={16} />
              Create First Event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="px-6 py-3 text-sm font-medium text-clawd-text-dim bg-clawd-bg/50 sticky top-0">
                  {date}
                </div>
                {dateEvents.map((event) => {
                  const style = getEventStyle(event);
                  const EventIcon = style.icon;
                  
                  return (
                    <div
                      key={event.id}
                      className={`p-6 hover:bg-clawd-bg/50 transition-colors border-l-4 cursor-pointer ${
                        isUrgent(event.start) ? 'border-l-yellow-500' : style.borderColor
                      } ${selectedEvent?.id === event.id ? 'bg-clawd-bg/50' : ''}`}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Event Type Icon */}
                        <div className={`p-2 rounded-lg ${style.bgColor}`}>
                          <EventIcon size={16} className={style.iconColor} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-lg">{event.title}</span>
                            {event.recurring && (
                              <Repeat size={14} className="text-clawd-text-dim" />
                            )}
                            {event.type === 'task' && event.priority && (
                              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${
                                event.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                event.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-clawd-bg0/20 text-clawd-text-dim'
                              }`}>
                                {event.priority}
                              </span>
                            )}
                            {event.type === 'post' && event.status && (
                              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${
                                event.status === 'pending' ? 'bg-purple-500/20 text-purple-400' :
                                event.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                                'bg-clawd-bg0/20 text-clawd-text-dim'
                              }`}>
                                {event.status}
                              </span>
                            )}
                            {isUrgent(event.start) && (
                              <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                                {getTimeUntil(event.start)}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-clawd-text-dim mb-2">
                            <span className="flex items-center gap-1.5">
                              <Clock size={14} />
                              {formatTime(event.start, event.isAllDay)}
                              {event.end && !event.isAllDay && ` - ${formatTime(event.end)}`}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1.5 truncate">
                                <MapPin size={14} />
                                {event.location}
                              </span>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <span className="flex items-center gap-1.5">
                                <Users size={14} />
                                {event.attendees.length}
                              </span>
                            )}
                            {event.type === 'task' && event.project && (
                              <span className="text-xs px-1.5 py-0.5 bg-clawd-border rounded flex-shrink-0 whitespace-nowrap">
                                {event.project}
                              </span>
                            )}
                          </div>
                          
                          {event.description && (
                            <p className="text-sm text-clawd-text-dim line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>

                        {/* Actions - only for calendar events */}
                        {event.type === 'calendar' && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(event);
                              }}
                              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                              title="Edit event"
                            >
                              <Edit2 size={16} className="text-clawd-text-dim" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEvent(event);
                              }}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Delete event"
                            >
                              <Trash2 size={16} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Modal (Create/Edit) */}
      {showEventModal && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-clawd-surface border border-clawd-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-clawd-border flex items-center justify-between sticky top-0 bg-clawd-surface">
              <h3 className="font-semibold text-lg">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={formIsAllDay}
                  onChange={(e) => setFormIsAllDay(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="allDay" className="text-sm">
                  All day event
                </label>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                {!formIsAllDay && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Start Time</label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    min={formStartDate}
                    className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                {!formIsAllDay && (
                  <div>
                    <label className="block text-sm font-medium mb-2">End Time</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Recurrence (only for create) */}
              {!editingEvent && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Repeat size={14} className="inline mr-1" />
                    Recurrence
                  </label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value)}
                    className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Location */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin size={14} className="inline mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Add location"
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Add description"
                  rows={3}
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Users size={14} className="inline mr-1" />
                  Attendees
                </label>
                <input
                  type="text"
                  value={formAttendees}
                  onChange={(e) => setFormAttendees(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-clawd-text-dim mt-1">
                  Comma-separated email addresses
                </p>
              </div>

              {/* Time Zone */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Globe size={14} className="inline mr-1" />
                  Time Zone
                </label>
                <select
                  value={formTimeZone}
                  onChange={(e) => setFormTimeZone(e.target.value)}
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-blue-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-clawd-border flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingEvent ? updateEvent : createEvent}
                disabled={!formTitle.trim() || !formStartDate || loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Check size={16} />
                {editingEvent ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal (View/Export/Create Task) */}
      {showEventDetailModal && selectedEvent && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-clawd-surface border border-clawd-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-clawd-border flex items-center justify-between sticky top-0 bg-clawd-surface">
              <div className="flex items-center gap-3">
                {(() => {
                  const style = getEventStyle(selectedEvent);
                  const EventIcon = style.icon;
                  return (
                    <div className={`p-2 rounded-lg ${style.bgColor}`}>
                      <EventIcon size={20} className={style.iconColor} />
                    </div>
                  );
                })()}
                <h3 className="font-semibold text-lg">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setShowEventDetailModal(false)}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Time & Date */}
              <div className="flex items-start gap-3">
                <Clock size={20} className="text-clawd-text-dim mt-0.5" />
                <div>
                  <div className="font-medium mb-1">{formatDate(selectedEvent.start)}</div>
                  <div className="text-sm text-clawd-text-dim">
                    {formatTime(selectedEvent.start, selectedEvent.isAllDay)}
                    {selectedEvent.end && !selectedEvent.isAllDay && ` - ${formatTime(selectedEvent.end)}`}
                    {selectedEvent.isAllDay && ' (All day)'}
                  </div>
                  {selectedEvent.timeZone && (
                    <div className="text-xs text-clawd-text-dim mt-1 flex items-center gap-1">
                      <Globe size={14} />
                      {selectedEvent.timeZone}
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-clawd-text-dim mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">Location</div>
                    <div className="text-sm text-clawd-text-dim">{selectedEvent.location}</div>
                  </div>
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="flex items-start gap-3">
                  <Users size={20} className="text-clawd-text-dim mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium mb-2">Attendees ({selectedEvent.attendees.length})</div>
                    <div className="space-y-1">
                      {selectedEvent.attendees.map((attendee, idx) => (
                        <div key={idx} className="text-sm text-clawd-text-dim">
                          {attendee.displayName || attendee.email}
                          {attendee.displayName && (
                            <span className="text-xs ml-2 opacity-70">({attendee.email})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="flex items-start gap-3">
                  <Edit2 size={20} className="text-clawd-text-dim mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium mb-2">Description</div>
                    <div className="text-sm text-clawd-text-dim whitespace-pre-wrap">
                      {selectedEvent.description}
                    </div>
                  </div>
                </div>
              )}

              {/* Recurring */}
              {selectedEvent.recurring && (
                <div className="flex items-center gap-3 text-sm text-clawd-text-dim">
                  <Repeat size={20} />
                  <span>Recurring event</span>
                </div>
              )}

              {/* Task-specific info */}
              {selectedEvent.type === 'task' && (
                <>
                  {selectedEvent.project && (
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="text-clawd-text-dim">Project:</span>{' '}
                        <span className="px-2 py-1 bg-clawd-border rounded text-clawd-text">
                          {selectedEvent.project}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedEvent.assignee && (
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="text-clawd-text-dim">Assigned to:</span>{' '}
                        <span className="text-clawd-text">{selectedEvent.assignee}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Post-specific info */}
              {selectedEvent.type === 'post' && selectedEvent.content && (
                <div className="flex items-start gap-3">
                  <Edit2 size={20} className="text-clawd-text-dim mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium mb-2">Content</div>
                    <div className="text-sm text-clawd-text-dim bg-clawd-bg p-3 rounded-lg whitespace-pre-wrap">
                      {selectedEvent.content}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-clawd-border flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {selectedEvent.type === 'calendar' && (
                  <>
                    <button
                      onClick={() => exportMeetingAsMarkdown(selectedEvent)}
                      className="flex items-center gap-2 px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
                      title="Export as Markdown"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export MD
                    </button>
                    <button
                      onClick={() => createTaskFromMeeting(selectedEvent)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
                      title="Create task from meeting"
                    >
                      <Plus size={16} />
                      Create Task
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                {selectedEvent.type === 'calendar' && (
                  <button
                    onClick={() => {
                      setShowEventDetailModal(false);
                      openEditModal(selectedEvent);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setShowEventDetailModal(false)}
                  className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskInitialData(undefined);
        }}
        initialData={taskInitialData}
      />
    </div>
  );
}
