/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';

interface ScheduledPost {
  id: string;
  draft_id: string;
  scheduled_for: number;
  status: string;
  created_at: number;
  updated_at: number;
  metadata: any;
  draft_content: string;
  draft_version: string;
  draft_metadata: any;
  posted_at?: number;
  posted_id?: string;
}

interface ApprovedDraft {
  id: string;
  plan_id: string;
  version: string;
  content: string;
  status: string;
  proposed_by: string;
  approved_by: string;
  created_at: number;
  approved_at: number;
  draft_metadata?: string;
}

interface TimeSlot {
  time: number;
  reason: string;
  score: number;
}

export const XCalendarView: React.FC = () => {
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [approvedDrafts, setApprovedDrafts] = useState<ApprovedDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScheduled();
    loadApprovedDrafts();
  }, [currentDate, viewMode]);

  const loadScheduled = async () => {
    try {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      
      const result = await window.clawdbot?.xSchedule?.list({
        dateFrom: startOfWeek.getTime(),
        dateTo: endOfWeek.getTime(),
      });
      
      if (result?.success) {
        setScheduled((result.scheduled ?? []) as ScheduledPost[]);
      }
    } catch (error) {
      // 'Error loading scheduled posts:', error;
    }
  };

  const loadApprovedDrafts = async () => {
    try {
      const result = await window.clawdbot?.xDraft?.list({ status: 'approved' });
      
      if (result?.success) {
        // Filter out drafts that are already scheduled
        const scheduledDraftIds = new Set(scheduled.map(s => s.draft_id));
        const unscheduled = (result.drafts ?? []).filter((d: unknown) => !scheduledDraftIds.has((d as ApprovedDraft).id));
        setApprovedDrafts(unscheduled as ApprovedDraft[]);
      }
      setLoading(false);
    } catch (error) {
      // 'Error loading approved drafts:', error;
      setLoading(false);
    }
  };

  const calculateOptimalTimeSlots = (draft: ApprovedDraft): TimeSlot[] => {
    const now = Date.now();
    const slots: TimeSlot[] = [];
    
    const metadata = draft.draft_metadata ? JSON.parse(draft.draft_metadata) : {};
    const contentType = metadata.content_type || 'educational';
    
    // Time slot recommendations based on content type
    const recommendations = {
      'educational': [9, 13, 18], // Morning, lunch, evening
      'meme': [12, 20, 22], // Lunch, evening, late night
      'thread': [10, 15], // Mid-morning, mid-afternoon (more engagement time needed)
      'announcement': [9, 17], // Start of work day, end of work day
    };
    
    const hours = recommendations[contentType as keyof typeof recommendations] || [10, 14, 19];
    
    // Generate slots for next 7 days
    for (let day = 0; day < 7; day++) {
      for (const hour of hours) {
        const slotDate = new Date(currentDate);
        slotDate.setDate(slotDate.getDate() + day);
        slotDate.setHours(hour, 0, 0, 0);
        
        // Skip past slots
        if (slotDate.getTime() < now) continue;
        
        // Check if slot is already occupied
        const isOccupied = scheduled.some(s => {
          const scheduledDate = new Date(s.scheduled_for);
          return Math.abs(scheduledDate.getTime() - slotDate.getTime()) < 3600000; // Within 1 hour
        });
        
        if (!isOccupied) {
          slots.push({
            time: slotDate.getTime(),
            reason: `${contentType} performs best at ${hour}:00`,
            score: 100 - (day * 10), // Prefer sooner dates
          });
        }
      }
    }
    
    return slots.sort((a, b) => b.score - a.score).slice(0, 5);
  };

  const handleSchedule = async (draftId: string, scheduledFor: number, reason: string) => {
    try {
      const result = await window.clawdbot?.xSchedule?.create({
        draftId,
        scheduledFor,
        timeSlotReason: reason,
      });
      
      if (result?.success) {
        await loadScheduled();
        await loadApprovedDrafts();
        setSelectedDraft(null);
        setTimeSlots([]);
      }
    } catch (error) {
      // 'Error scheduling post:', error;
    }
  };

  const handleUnschedule = async (scheduleId: string) => {
    try {
      const result = await window.clawdbot?.xSchedule?.delete({ id: scheduleId });
      
      if (result?.success) {
        await loadScheduled();
        await loadApprovedDrafts();
      }
    } catch (error) {
      // 'Error unscheduling post:', error;
    }
  };

  const handleDraftSelect = (draftId: string) => {
    setSelectedDraft(draftId);
    const draft = approvedDrafts.find(d => d.id === draftId);
    if (draft) {
      const slots = calculateOptimalTimeSlots(draft);
      setTimeSlots(slots);
    }
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const day = new Date(currentDate);
    day.setHours(0, 0, 0, 0);
    
    // Get posts for this day
    const dayPosts = scheduled.filter(s => {
      const scheduledDate = new Date(s.scheduled_for);
      return scheduledDate.toDateString() === day.toDateString();
    });
    
    return (
      <div className="h-full flex flex-col">
        {/* Day header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold text-clawd-text">
            {day.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          <div className="text-sm text-clawd-text-dim">
            {dayPosts.length} post{dayPosts.length !== 1 ? 's' : ''} scheduled
          </div>
        </div>
        
        {/* Day timeline */}
        <div className="flex-1 overflow-auto">
          <div className="space-y-1">
            {hours.map(hour => {
              const postsInHour = dayPosts.filter(s => {
                const scheduledDate = new Date(s.scheduled_for);
                return scheduledDate.getHours() === hour;
              });
              
              return (
                <div key={hour} className="flex gap-4">
                  <div className="w-16 py-3 text-xs text-clawd-text-dim text-right">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 py-2 px-4 bg-clawd-surface rounded-lg border border-clawd-border hover:bg-clawd-bg-alt transition-colors min-h-[80px]">
                    {postsInHour.length > 0 ? (
                      <div className="space-y-2">
                        {postsInHour.map(post => {
                          let content;
                          try {
                            content = JSON.parse(post.draft_content);
                          } catch {
                            content = { tweets: [{ text: post.draft_content }] };
                          }
                          
                          const firstTweet = content.tweets?.[0]?.text || post.draft_content;
                          const preview = firstTweet.slice(0, 150) + (firstTweet.length > 150 ? '...' : '');
                          const timeStr = new Date(post.scheduled_for).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          });
                          
                          return (
                            <div 
                              key={post.id}
                              className="bg-info-subtle border border-info rounded p-3"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-info">{timeStr}</span>
                                <button
                                  onClick={() => handleUnschedule(post.id)}
                                  className="text-error hover:text-error/80 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                              <p className="text-sm text-clawd-text">{preview}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-clawd-text-dim text-sm">
                        No posts scheduled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      return day;
    });
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="overflow-auto">
        <div className="grid grid-cols-8 gap-px bg-clawd-border border border-clawd-border">
          {/* Header */}
          <div className="bg-clawd-surface p-2 text-xs font-medium text-clawd-text-dim">Time</div>
          {days.map(day => (
            <div key={day.toISOString()} className="bg-clawd-surface p-2 text-center">
              <div className="text-xs font-medium text-clawd-text-dim">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-sm font-semibold text-clawd-text">{day.getDate()}</div>
            </div>
          ))}
          
          {/* Time slots */}
          {hours.map(hour => (
            <React.Fragment key={hour}>
              <div className="bg-clawd-surface p-2 text-xs text-clawd-text-dim border-t">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {days.map(day => {
                const slotTime = new Date(day);
                slotTime.setHours(hour, 0, 0, 0);
                
                const postsInSlot = scheduled.filter(s => {
                  const scheduledDate = new Date(s.scheduled_for);
                  return scheduledDate.getHours() === hour && 
                         scheduledDate.toDateString() === day.toDateString();
                });
                
                return (
                  <div 
                    key={`${day.toISOString()}-${hour}`}
                    className="bg-clawd-surface p-1 min-h-[60px] border-t hover:bg-clawd-bg-alt cursor-pointer"
                  >
                    {postsInSlot.map(post => {
                      let content;
                      try {
                        content = JSON.parse(post.draft_content);
                      } catch {
                        content = { tweets: [{ text: post.draft_content }] };
                      }
                      
                      const firstTweet = content.tweets?.[0]?.text || post.draft_content;
                      const preview = firstTweet.slice(0, 50) + (firstTweet.length > 50 ? '...' : '');
                      
                      return (
                        <div 
                          key={post.id}
                          className="bg-info-subtle border border-info rounded p-1 mb-1 text-xs group relative"
                        >
                          <div className="font-medium text-info">{preview}</div>
                          <div className="text-info text-[10px]">
                            {new Date(post.scheduled_for).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnschedule(post.id);
                              }}
                              className="bg-error text-white text-[10px] px-1 rounded"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderDraftSelector = () => {
    if (loading) {
      return <div className="p-4 text-sm text-clawd-text-dim">Loading...</div>;
    }
    
    if (approvedDrafts.length === 0) {
      return (
        <div className="p-4 text-sm text-clawd-text-dim">
          No approved drafts available for scheduling.
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-clawd-text mb-2">
          Approved Drafts ({approvedDrafts.length})
        </div>
        {approvedDrafts.map(draft => {
          let content;
          try {
            content = JSON.parse(draft.content);
          } catch {
            content = { tweets: [{ text: draft.content }] };
          }
          
          const firstTweet = content.tweets?.[0]?.text || draft.content;
          const preview = firstTweet.slice(0, 100) + (firstTweet.length > 100 ? '...' : '');
          const isThread = content.tweets && content.tweets.length > 1;
          
          return (
            <button
              key={draft.id}
              type="button"
              className={`w-full p-3 border rounded cursor-pointer transition-colors text-left ${
                selectedDraft === draft.id
                  ? 'border-info bg-info-subtle'
                  : 'border-clawd-border hover:border-clawd-border/80'
              }`}
              onClick={() => handleDraftSelect(draft.id)}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="text-xs text-clawd-text-dim">
                  {isThread ? `🧵 Thread (${content.tweets.length} tweets)` : '📝 Single tweet'}
                </div>
                <div className="text-xs text-clawd-text-dim">v{draft.version}</div>
              </div>
              <div className="text-sm text-clawd-text">{preview}</div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderTimeSlotPicker = () => {
    if (!selectedDraft || timeSlots.length === 0) {
      return null;
    }
    
    const draft = approvedDrafts.find(d => d.id === selectedDraft);
    if (!draft) return null;
    
    return (
      <div className="mt-4 p-4 bg-clawd-surface rounded">
        <div className="text-sm font-medium text-clawd-text mb-3">
          Recommended Time Slots
        </div>
        <div className="space-y-2">
          {timeSlots.map((slot, idx) => (
            <button
              key={slot.time}
              onClick={() => handleSchedule(selectedDraft, slot.time, slot.reason)}
              className="w-full p-3 text-left border border-clawd-border rounded hover:border-info hover:bg-info-subtle transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-clawd-text">
                  {new Date(slot.time).toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                  {' '}
                  {new Date(slot.time).toLocaleTimeString('en-US', { 
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-xs font-medium text-info">
                  {idx === 0 ? '⭐ Best' : `#${idx + 1}`}
                </div>
              </div>
              <div className="text-xs text-clawd-text-dim">{slot.reason}</div>
            </button>
          ))}
        </div>
        
        <div className="mt-3 text-xs text-clawd-text-dim">
          Or click any empty time slot in the calendar to schedule manually
        </div>
      </div>
    );
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar - Draft selector */}
      <div className="w-80 border-r border-clawd-border overflow-y-auto p-4">
        {renderDraftSelector()}
        {renderTimeSlotPicker()}
      </div>
      
      {/* Main calendar */}
      <div className="flex-1 flex flex-col">
        {/* Calendar controls */}
        <div className="flex items-center justify-between p-4 border-b border-clawd-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek('prev')}
              className="px-3 py-1 border border-clawd-border rounded hover:bg-clawd-surface text-clawd-text"
            >
              ←
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="px-3 py-1 border border-clawd-border rounded hover:bg-clawd-surface text-clawd-text"
            >
              →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 border border-clawd-border rounded hover:bg-clawd-surface text-clawd-text"
            >
              Today
            </button>
          </div>
          
          <div className="text-lg font-semibold text-clawd-text">
            {currentDate.toLocaleDateString('en-US', { 
              month: 'long',
              year: 'numeric'
            })}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded ${
                viewMode === 'week'
                  ? 'bg-info text-white'
                  : 'border border-clawd-border hover:bg-clawd-surface'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded ${
                viewMode === 'day'
                  ? 'bg-info text-white'
                  : 'border border-clawd-border hover:bg-clawd-surface'
              }`}
            >
              Day
            </button>
          </div>
        </div>
        
        {/* Calendar grid */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'week' ? renderWeekView() : renderDayView()}
        </div>
      </div>
    </div>
  );
};
