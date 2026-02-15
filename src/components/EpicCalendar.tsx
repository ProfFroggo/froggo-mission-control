import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Video, Users, RefreshCw, X, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { useUserSettings } from '../store/userSettings';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    responseStatus: string;
    organizer?: boolean;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      uri: string;
      entryPointType: string;
    }>;
  };
  htmlLink?: string;
  account?: string;
}

// interface EventsData {
//   events: CalendarEvent[];
//   account: string;
// }

interface EventFormData {
  summary: string;
  start: string; // YYYY-MM-DDTHH:mm format for datetime-local input
  end: string;
  description: string;
  location: string;
  account: string;
  isAllDay: boolean;
}

export default function EpicCalendar() {
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Drag & Drop state
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [draggedOverSlot, setDraggedOverSlot] = useState<{ date: Date; hour?: number } | null>(null);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<{ event: CalendarEvent; newStart: Date; newEnd: Date } | null>(null);

  const { emailAccounts } = useUserSettings();
  const accounts = emailAccounts.map(a => a.email);

  // Open create event modal
  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setModalMode('create');
    setShowEventModal(true);
  };

  // Open edit event modal
  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalMode('edit');
    setShowEventModal(true);
  };

  // Create new event via gog CLI
  const createEvent = async (formData: EventFormData): Promise<boolean> => {
    try {
      const { summary, start, end, description, location, isAllDay } = formData;
      
      // Convert datetime-local format to ISO format for gog CLI
      const startISO = isAllDay 
        ? new Date(start).toISOString().split('T')[0]
        : new Date(start).toISOString();
      const endISO = isAllDay
        ? new Date(end).toISOString().split('T')[0]
        : new Date(end).toISOString();

      const gogAccount = formData.account || accounts[0] || '';
      let command = `GOG_ACCOUNT=${gogAccount} gog calendar events create --summary "${summary.replace(/"/g, '\\"')}" --start "${startISO}" --end "${endISO}"`;
      
      if (description) {
        command += ` --description "${description.replace(/"/g, '\\"')}"`;
      }
      if (location) {
        command += ` --location "${location.replace(/"/g, '\\"')}"`;
      }

      const response = await window.electron!.execute(command);
      
      if (response.error) {
        throw new Error(response.stderr || 'Failed to create event');
      }

      // Refresh events after successful creation
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Failed to create event:', err);
      setError(`Failed to create event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
      return false;
    }
  };

  // Update existing event via gog CLI
  const updateEvent = async (eventId: string, formData: EventFormData): Promise<boolean> => {
    try {
      const { summary, start, end, description, location, isAllDay } = formData;
      
      // Convert datetime-local format to ISO format
      const startISO = isAllDay 
        ? new Date(start).toISOString().split('T')[0]
        : new Date(start).toISOString();
      const endISO = isAllDay
        ? new Date(end).toISOString().split('T')[0]
        : new Date(end).toISOString();

      const gogAccount = formData.account || accounts[0] || '';
      let command = `GOG_ACCOUNT=${gogAccount} gog calendar events update --event-id "${eventId}" --summary "${summary.replace(/"/g, '\\"')}" --start "${startISO}" --end "${endISO}"`;
      
      if (description) {
        command += ` --description "${description.replace(/"/g, '\\"')}"`;
      }
      if (location) {
        command += ` --location "${location.replace(/"/g, '\\"')}"`;
      }

      const response = await window.electron!.execute(command);
      
      if (response.error) {
        throw new Error(response.stderr || 'Failed to update event');
      }

      // Optimistic update - update local state immediately
      setEvents(prevEvents => 
        prevEvents.map(evt => 
          evt.id === eventId 
            ? { 
                ...evt, 
                summary, 
                description,
                location,
                start: isAllDay ? { date: startISO } : { dateTime: startISO },
                end: isAllDay ? { date: endISO } : { dateTime: endISO }
              } 
            : evt
        )
      );

      // Then refresh to get server truth
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Failed to update event:', err);
      setError(`Failed to update event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
      // Rollback by refreshing
      await fetchEvents();
      return false;
    }
  };

  // Delete event via gog CLI
  const deleteEvent = async (eventId: string, account: string): Promise<boolean> => {
    try {
      const command = `GOG_ACCOUNT=${account} gog calendar events delete --event-id "${eventId}"`;
      const response = await window.electron!.execute(command);
      
      if (response.error) {
        throw new Error(response.stderr || 'Failed to delete event');
      }

      // Optimistic update - remove from local state immediately
      setEvents(prevEvents => prevEvents.filter(evt => evt.id !== eventId));
      
      // Then refresh to confirm
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError(`Failed to delete event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
      // Rollback by refreshing
      await fetchEvents();
      return false;
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDraggedOverSlot(null);
  };

  const handleDragOver = (e: React.DragEvent, date: Date, hour?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverSlot({ date, hour });
  };

  const handleDragLeave = () => {
    setDraggedOverSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, date: Date, hour?: number) => {
    e.preventDefault();
    
    if (!draggedEvent) return;

    const { start, end, isAllDay } = getEventTime(draggedEvent);

    // Calculate new start time
    let newStart: Date;
    if (isAllDay) {
      // For all-day events, just change the date
      newStart = new Date(date);
      newStart.setHours(0, 0, 0, 0);
    } else if (hour !== undefined) {
      // For timed events with hour slot (Week/Day view)
      newStart = new Date(date);
      newStart.setHours(hour, start.getMinutes(), 0, 0);
    } else {
      // For timed events without hour (Month view) - preserve time
      newStart = new Date(date);
      newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    }

    const eventDuration = end.getTime() - start.getTime();
    const newEnd = new Date(newStart.getTime() + eventDuration);

    // Show confirmation dialog
    setPendingReschedule({ event: draggedEvent, newStart, newEnd });
    setShowRescheduleConfirm(true);
    
    // Clear drag state
    setDraggedEvent(null);
    setDraggedOverSlot(null);
  };

  const confirmReschedule = async () => {
    if (!pendingReschedule) return;

    const { event, newStart, newEnd } = pendingReschedule;
    const { isAllDay } = getEventTime(event);

    try {
      const startISO = isAllDay 
        ? newStart.toISOString().split('T')[0]
        : newStart.toISOString();
      const endISO = isAllDay
        ? newEnd.toISOString().split('T')[0]
        : newEnd.toISOString();

      const command = `GOG_ACCOUNT=${event.account} gog calendar events update --event-id "${event.id}" --summary "${event.summary.replace(/"/g, '\\"')}" --start "${startISO}" --end "${endISO}"`;
      
      const response = await window.electron!.execute(command);
      
      if (response.error) {
        throw new Error(response.stderr || 'Failed to reschedule event');
      }

      // Optimistic update
      setEvents(prevEvents =>
        prevEvents.map(evt =>
          evt.id === event.id
            ? {
                ...evt,
                start: isAllDay ? { date: startISO } : { dateTime: startISO },
                end: isAllDay ? { date: endISO } : { dateTime: endISO }
              }
            : evt
        )
      );

      // Refresh to get server truth
      await fetchEvents();
      
      setShowRescheduleConfirm(false);
      setPendingReschedule(null);
    } catch (err) {
      console.error('Failed to reschedule event:', err);
      setError(`Failed to reschedule event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setError(null), 5000);
      
      // Rollback by refreshing
      await fetchEvents();
      
      setShowRescheduleConfirm(false);
      setPendingReschedule(null);
    }
  };

  const cancelReschedule = () => {
    setShowRescheduleConfirm(false);
    setPendingReschedule(null);
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the new calendar aggregation service
      if (!window.clawdbot?.calendar?.aggregate) {
        throw new Error('Calendar service not available — running outside Electron?');
      }
      const response = await window.clawdbot?.calendar?.aggregate({
        days: 30,
        includeGoogle: true,
        includeMissionControl: true,
        accounts
      });

      if (response.success) {
        if (response.errors && response.errors.length > 0) {
          console.warn('[EpicCalendar] Some sources had errors:', response.errors);
        }

        setEvents(response.events);
      } else {
        throw new Error(response.error || 'Failed to aggregate events');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to fetch calendar events';
      setError(errorMsg);
      console.error('[EpicCalendar] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    const offset = direction === 'prev' ? -1 : 1;

    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + offset);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (7 * offset));
    } else {
      newDate.setDate(newDate.getDate() + offset);
    }

    setCurrentDate(newDate);
  };

  const getDateRangeText = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      return 'Upcoming Events';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Calendar size={24} className="text-clawd-accent" />
              Epic Calendar
            </h1>
            <div className="text-sm text-clawd-text-dim">
              {getDateRangeText()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
              title="Refresh events"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => navigateDate('today')}
                className="px-3 py-1.5 text-sm bg-clawd-bg hover:bg-clawd-border rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 bg-clawd-bg rounded-lg p-1">
              {(['month', 'week', 'day', 'agenda'] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    view === v
                      ? 'bg-clawd-accent text-white'
                      : 'hover:bg-clawd-border'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Create Event Button */}
            <button 
              onClick={handleCreateEvent}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
            >
              <Plus size={16} />
              New Event
            </button>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          mode={modalMode}
          event={selectedEvent}
          accounts={accounts}
          onClose={() => setShowEventModal(false)}
          onCreate={createEvent}
          onUpdate={updateEvent}
          onDelete={(_eventId, _account) => {
            setShowDeleteConfirm(true);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && selectedEvent && (
        <DeleteConfirmDialog
          eventTitle={selectedEvent.summary}
          onConfirm={async () => {
            const success = await deleteEvent(selectedEvent.id, selectedEvent.account!);
            if (success) {
              setShowDeleteConfirm(false);
              setShowEventModal(false);
              setSelectedEvent(null);
            }
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Reschedule Confirmation Dialog */}
      {showRescheduleConfirm && pendingReschedule && (
        <RescheduleConfirmDialog
          event={pendingReschedule.event}
          newStart={pendingReschedule.newStart}
          newEnd={pendingReschedule.newEnd}
          onConfirm={confirmReschedule}
          onCancel={cancelReschedule}
        />
      )}

      {/* Calendar View */}
      <div className="flex-1 overflow-auto">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-clawd-accent" />
              <p className="text-clawd-text-dim">Loading calendar events...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Calendar size={32} className="mx-auto mb-4 text-red-500" />
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchEvents}
                className="mt-4 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === 'month' && (
              <MonthView 
                currentDate={currentDate} 
                events={events} 
                onEventClick={handleEditEvent}
                draggedEvent={draggedEvent}
                draggedOverSlot={draggedOverSlot}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            )}
            {view === 'week' && (
              <WeekView 
                currentDate={currentDate} 
                events={events} 
                onEventClick={handleEditEvent}
                draggedEvent={draggedEvent}
                draggedOverSlot={draggedOverSlot}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            )}
            {view === 'day' && (
              <DayView 
                currentDate={currentDate} 
                events={events} 
                onEventClick={handleEditEvent}
                draggedEvent={draggedEvent}
                draggedOverSlot={draggedOverSlot}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            )}
            {view === 'agenda' && <AgendaView currentDate={currentDate} events={events} onEventClick={handleEditEvent} />}
          </>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday as first day
  return new Date(d.setDate(diff));
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getEventTime(event: CalendarEvent): { start: Date; end: Date; isAllDay: boolean } {
  const isAllDay = !event.start.dateTime;
  const start = new Date(event.start.dateTime || event.start.date!);
  const end = new Date(event.end.dateTime || event.end.date!);
  return { start, end, isAllDay };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Event Card Component
function EventCard({ 
  event, 
  compact = false, 
  onClick,
  onDragStart,
  onDragEnd,
  isDragging = false
}: { 
  event: CalendarEvent; 
  compact?: boolean; 
  onClick?: (event: CalendarEvent) => void;
  onDragStart?: (e: React.DragEvent, event: CalendarEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  const { start, end, isAllDay } = getEventTime(event);
  const meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
  const primaryEmail = useUserSettings.getState().email;
  const accountColor = event.account === primaryEmail ? 'bg-blue-500' : 'bg-purple-500';

  if (compact) {
    return (
      <div 
        draggable
        onDragStart={onDragStart ? (e) => onDragStart(e, event) : undefined}
        onDragEnd={onDragEnd}
        className={`text-xs px-2 py-1 ${accountColor} text-white rounded mb-1 truncate cursor-move hover:opacity-80 transition-all ${
          isDragging ? 'opacity-50 scale-95' : ''
        }`}
        title={event.summary}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(event);
        }}
      >
        {!isAllDay && <span className="font-medium">{formatTime(start)} </span>}
        {event.summary}
      </div>
    );
  }

  return (
    <div 
      draggable
      onDragStart={onDragStart ? (e) => onDragStart(e, event) : undefined}
      onDragEnd={onDragEnd}
      className={`bg-clawd-surface rounded-lg border border-clawd-border p-4 hover:border-clawd-accent transition-all cursor-move ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold flex-1">{event.summary}</h3>
        <div className={`w-2 h-2 rounded-full ${accountColor} ml-2 mt-1`} title={event.account} />
      </div>

      <div className="space-y-1.5 text-sm text-clawd-text-dim">
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>
            {isAllDay ? 'All day' : `${formatTime(start)} - ${formatTime(end)}`}
          </span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {meetLink && (
          <div className="flex items-center gap-2">
            <Video size={14} />
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-clawd-accent hover:underline truncate">
              Google Meet
            </a>
          </div>
        )}

        {event.attendees && event.attendees.length > 1 && (
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span>{event.attendees.length} attendees</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="mt-3 text-sm text-clawd-text-dim line-clamp-2"
           dangerouslySetInnerHTML={{ __html: event.description.replace(/<[^>]*>/g, '') }} />
      )}
    </div>
  );
}

// Month View
function MonthView({ 
  currentDate, 
  events, 
  onEventClick,
  draggedEvent,
  draggedOverSlot,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}: { 
  currentDate: Date; 
  events: CalendarEvent[]; 
  onEventClick: (event: CalendarEvent) => void;
  draggedEvent: CalendarEvent | null;
  draggedOverSlot: { date: Date; hour?: number } | null;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, date: Date, hour?: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date, hour?: number) => void;
}) {
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDate = getWeekStart(firstDay);
  
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  const iterDate = new Date(startDate);

  // Build 6 weeks (42 days)
  for (let i = 0; i < 42; i++) {
    currentWeek.push(new Date(iterDate));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    iterDate.setDate(iterDate.getDate() + 1);
  }

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const { start, end } = getEventTime(event);
      return date >= new Date(start.setHours(0, 0, 0, 0)) && 
             date <= new Date(end.setHours(23, 59, 59, 999));
    });
  };

  const today = new Date();
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  return (
    <div className="h-full p-6">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border h-full flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-clawd-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center py-3 text-sm font-semibold text-clawd-text-dim">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-rows-6">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b border-clawd-border last:border-b-0">
              {week.map((date, dayIdx) => {
                const dayEvents = getEventsForDay(date);
                const isToday = isSameDay(date, today);
                const inCurrentMonth = isCurrentMonth(date);
                const isDragOver = draggedOverSlot && isSameDay(draggedOverSlot.date, date) && draggedOverSlot.hour === undefined;

                return (
                  <div
                    key={dayIdx}
                    className={`border-r border-clawd-border last:border-r-0 p-2 transition-all overflow-hidden ${
                      !inCurrentMonth ? 'bg-clawd-bg opacity-50' : ''
                    } ${
                      isDragOver 
                        ? 'bg-clawd-accent/10 border-2 border-dashed border-clawd-accent' 
                        : 'hover:bg-clawd-border/30 cursor-pointer'
                    }`}
                    onDragOver={(e) => onDragOver(e, date)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, date)}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'bg-clawd-accent text-white w-6 h-6 rounded-full flex items-center justify-center' : ''
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map(event => (
                        <EventCard 
                          key={event.id} 
                          event={event} 
                          compact 
                          onClick={onEventClick}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          isDragging={draggedEvent?.id === event.id}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-clawd-text-dim pl-2">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Week View
function WeekView({ 
  currentDate, 
  events, 
  onEventClick,
  draggedEvent,
  draggedOverSlot,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}: { 
  currentDate: Date; 
  events: CalendarEvent[]; 
  onEventClick: (event: CalendarEvent) => void;
  draggedEvent: CalendarEvent | null;
  draggedOverSlot: { date: Date; hour?: number } | null;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, date: Date, hour?: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date, hour?: number) => void;
}) {
  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();

  const getEventsForDayAndHour = (date: Date, hour: number) => {
    return events.filter(event => {
      const { start, end } = getEventTime(event);
      const eventStart = new Date(start);
      const eventEnd = new Date(end);
      
      if (!isSameDay(eventStart, date) && !isSameDay(eventEnd, date)) return false;
      
      const hourStart = new Date(date);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(date);
      hourEnd.setHours(hour, 59, 59, 999);

      return eventStart <= hourEnd && eventEnd >= hourStart;
    });
  };

  return (
    <div className="h-full p-6">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border h-full flex flex-col overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b border-clawd-border flex-shrink-0">
          <div className="p-3 text-sm font-semibold text-clawd-text-dim border-r border-clawd-border">
            Time
          </div>
          {weekDays.map(date => {
            const isToday = isSameDay(date, today);
            return (
              <div
                key={date.toISOString()}
                className={`text-center p-3 border-r border-clawd-border last:border-r-0 ${
                  isToday ? 'bg-clawd-accent/10' : ''
                }`}
              >
                <div className="text-xs text-clawd-text-dim">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-semibold ${
                  isToday ? 'text-clawd-accent' : ''
                }`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-auto">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-clawd-border min-h-[60px]">
              <div className="p-2 text-xs text-clawd-text-dim border-r border-clawd-border">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {weekDays.map(date => {
                const dayEvents = getEventsForDayAndHour(date, hour);
                const isToday = isSameDay(date, today);
                const isDragOver = draggedOverSlot && 
                                  isSameDay(draggedOverSlot.date, date) && 
                                  draggedOverSlot.hour === hour;
                
                return (
                  <div
                    key={`${date.toISOString()}-${hour}`}
                    className={`border-r border-clawd-border last:border-r-0 p-1 transition-all ${
                      isToday ? 'bg-clawd-accent/5' : ''
                    } ${
                      isDragOver 
                        ? 'bg-clawd-accent/10 border-2 border-dashed border-clawd-accent' 
                        : 'hover:bg-clawd-border/30 cursor-pointer'
                    }`}
                    onDragOver={(e) => onDragOver(e, date, hour)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, date, hour)}
                  >
                    {dayEvents.map(event => (
                      <EventCard 
                        key={event.id} 
                        event={event} 
                        compact 
                        onClick={onEventClick}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        isDragging={draggedEvent?.id === event.id}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Day View
function DayView({ 
  currentDate, 
  events, 
  onEventClick,
  draggedEvent,
  draggedOverSlot,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop
}: { 
  currentDate: Date; 
  events: CalendarEvent[]; 
  onEventClick: (event: CalendarEvent) => void;
  draggedEvent: CalendarEvent | null;
  draggedOverSlot: { date: Date; hour?: number } | null;
  onDragStart: (e: React.DragEvent, event: CalendarEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, date: Date, hour?: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date, hour?: number) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);

  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      const { start, end } = getEventTime(event);
      const eventStart = new Date(start);
      const eventEnd = new Date(end);
      
      if (!isSameDay(eventStart, currentDate) && !isSameDay(eventEnd, currentDate)) return false;
      
      const hourStart = new Date(currentDate);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(currentDate);
      hourEnd.setHours(hour, 59, 59, 999);

      return eventStart <= hourEnd && eventEnd >= hourStart;
    });
  };

  const allDayEvents = events.filter(event => {
    const { start, isAllDay } = getEventTime(event);
    return isAllDay && isSameDay(start, currentDate);
  });

  return (
    <div className="h-full p-6">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border h-full flex flex-col overflow-hidden">
        {/* All-day events */}
        {allDayEvents.length > 0 && (
          <div className="border-b border-clawd-border p-4 space-y-2 flex-shrink-0">
            <div className="text-xs font-semibold text-clawd-text-dim mb-2">ALL DAY</div>
            {allDayEvents.map(event => (
              <EventCard 
                key={event.id} 
                event={event} 
                compact 
                onClick={onEventClick}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggedEvent?.id === event.id}
              />
            ))}
          </div>
        )}

        {/* Time slots */}
        <div className="flex-1 overflow-auto">
          {hours.map(hour => {
            const hourEvents = getEventsForHour(hour);
            const currentHour = isToday && new Date().getHours() === hour;
            const isDragOver = draggedOverSlot && 
                              isSameDay(draggedOverSlot.date, currentDate) && 
                              draggedOverSlot.hour === hour;

            return (
              <div
                key={hour}
                className={`border-b border-clawd-border min-h-[80px] flex ${
                  currentHour ? 'bg-clawd-accent/5' : ''
                }`}
              >
                <div className="w-24 p-3 text-sm text-clawd-text-dim border-r border-clawd-border flex-shrink-0">
                  {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                </div>
                <div 
                  className={`flex-1 p-3 space-y-2 transition-all ${
                    isDragOver 
                      ? 'bg-clawd-accent/10 border-2 border-dashed border-clawd-accent' 
                      : 'hover:bg-clawd-border/30 cursor-pointer'
                  }`}
                  onDragOver={(e) => onDragOver(e, currentDate, hour)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, currentDate, hour)}
                >
                  {hourEvents.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onClick={onEventClick}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      isDragging={draggedEvent?.id === event.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Agenda View
function AgendaView({ currentDate, events, onEventClick }: { currentDate: Date; events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void }) {
  // Group events by date, starting from currentDate
  const upcomingEvents = events
    .filter(event => {
      const { start } = getEventTime(event);
      return start >= currentDate;
    })
    .sort((a, b) => {
      const aStart = getEventTime(a).start;
      const bStart = getEventTime(b).start;
      return aStart.getTime() - bStart.getTime();
    });

  const eventsByDate = upcomingEvents.reduce((acc, event) => {
    const { start } = getEventTime(event);
    const dateKey = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const today = new Date();

  if (upcomingEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
          <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
          <p className="text-sm text-clawd-text-dim">Your calendar is clear!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-8xl mx-auto space-y-6">
        {Object.entries(eventsByDate).map(([dateStr, dateEvents]) => {
          const eventDate = getEventTime(dateEvents[0]).start;
          const isToday = isSameDay(eventDate, today);
          const isTomorrow = isSameDay(eventDate, new Date(today.getTime() + 86400000));

          return (
            <div key={dateStr} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dateStr}
                </h2>
                <div className="h-px flex-1 bg-clawd-border" />
                <span className="text-sm text-clawd-text-dim">
                  {dateEvents.length} {dateEvents.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              <div className="space-y-3">
                {dateEvents.map(event => (
                  <EventCard key={event.id} event={event} onClick={onEventClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Event Modal Component
function EventModal({
  mode,
  event,
  accounts,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}: {
  mode: 'create' | 'edit';
  event: CalendarEvent | null;
  accounts: string[];
  onClose: () => void;
  onCreate: (data: EventFormData) => Promise<boolean>;
  onUpdate: (eventId: string, data: EventFormData) => Promise<boolean>;
  onDelete: (eventId: string, account: string) => void;
}) {
  const [formData, setFormData] = useState<EventFormData>(() => {
    if (mode === 'edit' && event) {
      const { start, end, isAllDay } = getEventTime(event);
      return {
        summary: event.summary || '',
        start: isAllDay 
          ? start.toISOString().split('T')[0] 
          : formatDateTimeLocal(start),
        end: isAllDay 
          ? end.toISOString().split('T')[0] 
          : formatDateTimeLocal(end),
        description: event.description || '',
        location: event.location || '',
        account: event.account || accounts[0],
        isAllDay
      };
    }
    
    // Default for create mode: tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);
    
    return {
      summary: '',
      start: formatDateTimeLocal(tomorrow),
      end: formatDateTimeLocal(endTime),
      description: '',
      location: '',
      account: accounts[0],
      isAllDay: false
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.summary.trim()) {
      newErrors.summary = 'Title is required';
    }

    const startDate = new Date(formData.start);
    const endDate = new Date(formData.end);

    if (endDate <= startDate) {
      newErrors.end = 'End time must be after start time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    try {
      let success = false;
      
      if (mode === 'create') {
        success = await onCreate(formData);
      } else if (event) {
        success = await onUpdate(event.id, formData);
      }

      if (success) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (event) {
      onDelete(event.id, formData.account);
    }
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-clawd-border sticky top-0 bg-clawd-surface z-10">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <Plus size={20} className="text-clawd-accent" />
                Create Event
              </>
            ) : (
              <>
                <Edit2 size={20} className="text-clawd-accent" />
                Edit Event
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className={`w-full px-4 py-2 bg-clawd-bg border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent ${
                errors.summary ? 'border-red-500' : 'border-clawd-border'
              }`}
              placeholder="Event title"
              autoFocus
            />
            {errors.summary && (
              <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.summary}
              </p>
            )}
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Calendar Account <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.account}
              onChange={(e) => setFormData({ ...formData, account: e.target.value })}
              className="w-full px-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent"
            >
              {accounts.map(acc => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.isAllDay}
              onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              className="w-4 h-4 text-clawd-accent"
            />
            <label htmlFor="allDay" className="text-sm font-medium cursor-pointer">
              All-day event
            </label>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Start {formData.isAllDay ? 'Date' : 'Date & Time'} <span className="text-red-500">*</span>
              </label>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.start}
                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                className="w-full px-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                End {formData.isAllDay ? 'Date' : 'Date & Time'} <span className="text-red-500">*</span>
              </label>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.end}
                onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                className={`w-full px-4 py-2 bg-clawd-bg border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent ${
                  errors.end ? 'border-red-500' : 'border-clawd-border'
                }`}
              />
              {errors.end && (
                <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {errors.end}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <MapPin size={16} />
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent"
              placeholder="Add location"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent resize-none"
              rows={4}
              placeholder="Add description"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-clawd-border">
            <div>
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-error-subtle rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  Delete Event
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 hover:bg-clawd-border rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  mode === 'create' ? 'Create Event' : 'Save Changes'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Dialog
function DeleteConfirmDialog({
  eventTitle,
  onConfirm,
  onCancel
}: {
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-[60] p-4">
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-error-subtle rounded-full">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Delete Event</h3>
            <p className="text-sm text-clawd-text-dim">
              Are you sure you want to delete "<strong>{eventTitle}</strong>"? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 hover:bg-clawd-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete Event
          </button>
        </div>
      </div>
    </div>
  );
}

// Reschedule Confirmation Dialog
function RescheduleConfirmDialog({
  event,
  newStart,
  onConfirm,
  onCancel
}: {
  event: CalendarEvent;
  newStart: Date;
  newEnd: Date;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { start: oldStart, isAllDay } = getEventTime(event);
  
  const formatDateTime = (date: Date) => {
    if (isAllDay) {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    return date.toLocaleString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-[60] p-4">
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-clawd-accent/10 rounded-full">
            <Calendar size={24} className="text-clawd-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Reschedule Event?</h3>
            <p className="text-sm text-clawd-text-dim mb-3">
              <strong className="text-clawd-text">{event.summary}</strong>
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-clawd-text-dim">From:</span>
                <div className="text-clawd-text font-medium">{formatDateTime(oldStart)}</div>
              </div>
              <div className="flex items-center gap-2 text-clawd-accent">
                <ChevronRight size={16} />
              </div>
              <div>
                <span className="text-clawd-text-dim">To:</span>
                <div className="text-clawd-text font-medium">{formatDateTime(newStart)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 hover:bg-clawd-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function for datetime-local input format
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
