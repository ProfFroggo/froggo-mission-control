/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: TourGuide uses file-level suppression for intentional stable ref patterns.
// Tour/guide component with careful lifecycle management - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

export interface TourStep {
  target: string; // CSS selector for element to highlight
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void; // Optional action to perform when step starts
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
}

interface TourGuideProps {
  tour: Tour | null;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Interactive tour guide for feature walkthroughs
 * Highlights UI elements and provides step-by-step guidance
 */
export default function TourGuide({ tour, onComplete, onSkip }: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = tour?.steps[currentStep];

  // Update highlight and tooltip position
  useEffect(() => {
    if (!tour || !step) return;

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      setHighlightRect(rect);

      // Calculate tooltip position
      const tooltipWidth = 400;
      const tooltipHeight = 200; // Approximate
      const gap = 20;

      let top = 0;
      let left = 0;

      const position = step.position || 'bottom';

      switch (position) {
        case 'top':
          top = rect.top - tooltipHeight - gap;
          left = rect.left + (rect.width - tooltipWidth) / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + (rect.width - tooltipWidth) / 2;
          break;
        case 'left':
          top = rect.top + (rect.height - tooltipHeight) / 2;
          left = rect.left - tooltipWidth - gap;
          break;
        case 'right':
          top = rect.top + (rect.height - tooltipHeight) / 2;
          left = rect.right + gap;
          break;
      }

      // Keep within viewport
      const padding = 20;
      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (top < padding) top = padding;

      setTooltipPosition({ top, left });

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Execute step action if defined
    if (step.action) {
      step.action();
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [tour, step]);

  // Keyboard navigation
  useEffect(() => {
    if (!tour) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' && currentStep < tour.steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setCurrentStep(prev => prev - 1);
      } else if (e.key === 'Enter' && currentStep === tour.steps.length - 1) {
        handleComplete();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tour, currentStep]);

  const handleNext = () => {
    if (!tour) return;
    if (currentStep < tour.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    // Mark tour as completed in localStorage
    try {
      const completed = JSON.parse(localStorage.getItem('mission-control-tours-completed') || '[]');
      if (tour && !completed.includes(tour.id)) {
        completed.push(tour.id);
        localStorage.setItem('mission-control-tours-completed', JSON.stringify(completed));
      }
    } catch {
      // Ignore localStorage errors
    }
    onComplete();
  };

  if (!tour || !step) return null;

  return (
    <div className="tour-guide-overlay fixed inset-0 z-[100]">
      {/* Dimmed overlay with hole for highlighted element */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/70"
        style={{
          clipPath: highlightRect
            ? `polygon(
                0% 0%, 
                0% 100%, 
                ${highlightRect.left - 4}px 100%, 
                ${highlightRect.left - 4}px ${highlightRect.top - 4}px, 
                ${highlightRect.right + 4}px ${highlightRect.top - 4}px, 
                ${highlightRect.right + 4}px ${highlightRect.bottom + 4}px, 
                ${highlightRect.left - 4}px ${highlightRect.bottom + 4}px, 
                ${highlightRect.left - 4}px 100%, 
                100% 100%, 
                100% 0%
              )`
            : undefined,
        }}
      />

      {/* Highlight border */}
      {highlightRect && (
        <div
          className="absolute border-2 border-mission-control-accent rounded-lg animate-pulse"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            boxShadow: 'var(--shadow-glow-lg)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="absolute w-[400px] bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="text-xs text-mission-control-text-dim mt-0.5">
              Step {currentStep + 1} of {tour.steps.length}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="p-1 hover:bg-mission-control-border rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-mission-control-text leading-relaxed">{step.content}</p>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full bg-mission-control-accent transition-all duration-300"
              style={{ width: `${((currentStep + 1) / tour.steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-mission-control-border flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            Skip Tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="p-2 rounded-lg hover:bg-mission-control-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
            >
              {currentStep === tour.steps.length - 1 ? (
                <>
                  <Check size={16} />
                  <span className="text-sm font-medium">Complete</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">Next</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dispatch a navigate event so App.tsx can switch the active panel
 * without coupling TourGuide to the view state directly.
 */
function navigateTo(view: string) {
  window.dispatchEvent(new CustomEvent('tour-navigate', { detail: { view } }));
}

/**
 * Predefined tours for common workflows
 */
export const tours: Record<string, Tour> = {
  /** 8-stop platform tour launched from the onboarding wizard */
  platformTour: {
    id: 'platform-tour',
    name: 'Platform Tour',
    description: 'An 8-stop guided tour of Mission Control',
    steps: [
      {
        target: '[data-view="dashboard"]',
        title: 'Dashboard',
        content: 'Your command center. Agent status cards give you a live health snapshot, the activity feed shows recent events, and quick-action buttons let you jump straight into work.',
        position: 'right',
        action: () => navigateTo('dashboard'),
      },
      {
        target: '[data-view="kanban"]',
        title: 'Tasks',
        content: 'The Kanban board tracks every piece of work. Create a task, assign it to an agent, and watch it move through Todo → In Progress → Review → Done automatically.',
        position: 'right',
        action: () => navigateTo('kanban'),
      },
      {
        target: '[data-view="agents"]',
        title: 'Agents',
        content: 'All your AI agents live here. Start a chat, check their status indicators, or hire new specialists from the catalog — each agent has a defined role and skill set.',
        position: 'right',
        action: () => navigateTo('agents'),
      },
      {
        target: '[data-view="inbox"]',
        title: 'Inbox',
        content: 'Agents send messages, approval requests, and notifications here. Review their output, approve actions, or send them back with feedback — all in one place.',
        position: 'right',
        action: () => navigateTo('inbox'),
      },
      {
        target: '[data-view="memory"]',
        title: 'Memory',
        content: 'The shared knowledge base your agents read and write. Browse session history, search the vault, and open notes directly in Obsidian for deeper editing.',
        position: 'right',
        action: () => navigateTo('memory'),
      },
      {
        target: '[data-view="library"]',
        title: 'Library',
        content: 'Every file, code snippet, and document your agents produce lands here. Organized by category so you can find and share outputs without digging through file systems.',
        position: 'right',
        action: () => navigateTo('library'),
      },
      {
        target: '[data-view="analytics"]',
        title: 'Analytics',
        content: 'Token usage charts, per-agent activity breakdowns, and cost tracking. See exactly how your AI budget is being spent and which agents are doing the heavy lifting.',
        position: 'right',
        action: () => navigateTo('analytics'),
      },
      {
        target: '[data-view="settings"]',
        title: 'Settings',
        content: 'API keys, permissions, connected accounts, and theme preferences all live here. You can also restart this tour at any time from the General tab.',
        position: 'right',
        action: () => navigateTo('settings'),
      },
    ],
  },

  gettingStarted: {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of Mission Control Dashboard',
    steps: [
      {
        target: 'nav[role="navigation"]',
        title: 'Welcome to Mission Control!',
        content: 'This sidebar is your navigation hub. Use ⌘1-9 to quickly jump between panels.',
        position: 'right',
      },
      {
        target: 'button[aria-label*="Search"], button:has(svg[data-icon="search"])',
        title: 'Global Search',
        content: 'Press ⌘K to search across tasks, contacts, messages, and more. It\'s the fastest way to find anything.',
        position: 'bottom',
      },
      {
        target: '[data-view="inbox"]',
        title: 'Approval Inbox',
        content: 'Review tweets, emails, and other content before they go out. Your safety net for AI-generated content.',
        position: 'right',
        action: () => {
          // Optional: Navigate to inbox
        },
      },
      {
        target: '[data-view="kanban"]',
        title: 'Task Management',
        content: 'Manage your work with the Kanban board. Assign tasks to AI agents and watch them execute.',
        position: 'right',
      },
      {
        target: '[data-view="voice"]',
        title: 'Voice Assistant',
        content: 'Real-time voice transcription and conversation. Perfect for meetings and hands-free work.',
        position: 'right',
      },
    ],
  },
  
  kanbanWorkflow: {
    id: 'kanban-workflow',
    name: 'Task Workflow',
    description: 'Master the Kanban board and agent assignment',
    steps: [
      {
        target: 'button[aria-label="New Task"], button:contains("New Task")',
        title: 'Creating Tasks',
        content: 'Press N or click here to create a new task. Give it a title, description, and priority.',
        position: 'bottom',
      },
      {
        target: '[data-column="todo"]',
        title: 'Todo Column',
        content: 'New tasks start here. Assign them to an agent (Coder, Writer, Researcher, Chief) to begin work.',
        position: 'right',
      },
      {
        target: '[data-column="in-progress"]',
        title: 'In Progress',
        content: 'When an agent starts working, the task moves here. You can monitor real-time progress.',
        position: 'right',
      },
      {
        target: '[data-column="review"]',
        title: 'Review',
        content: 'Completed tasks land here for your review. Check the deliverables and approve or request changes.',
        position: 'right',
      },
      {
        target: '[data-column="done"]',
        title: 'Done',
        content: 'Approved tasks move to Done. Celebrate your wins! 🎉',
        position: 'right',
      },
    ],
  },

  voiceAssistant: {
    id: 'voice-assistant',
    name: 'Voice Assistant',
    description: 'Learn to use voice transcription and conversation mode',
    steps: [
      {
        target: '[data-voice-orb]',
        title: 'Start Conversation',
        content: 'Click the frog orb to start voice conversation mode. Speak naturally and watch real-time transcription.',
        position: 'top',
      },
      {
        target: '[data-voice-transcript]',
        title: 'Live Transcription',
        content: 'Your speech appears here in real-time. After a pause, it automatically sends to Mission Control.',
        position: 'top',
      },
      {
        target: '[data-voice-meeting]',
        title: 'Meeting Mode',
        content: 'Click the phone icon for continuous transcription without auto-send. Perfect for meetings!',
        position: 'top',
      },
      {
        target: '[data-voice-settings]',
        title: 'Voice Settings',
        content: 'Customize TTS voice, silence detection, and other preferences here.',
        position: 'left',
      },
    ],
  },
};

/** localStorage key for tour completion */
export const TOUR_COMPLETED_KEY = 'mission-control:tour-completed';

/**
 * Hook to manage tour state
 */
export function useTour() {
  const [activeTour, setActiveTour] = useState<Tour | null>(null);

  const startTour = (tourId: keyof typeof tours) => {
    const tour = tours[tourId];
    if (!tour) {
      return;
    }
    setActiveTour(tour);
  };

  const startPlatformTour = () => {
    setActiveTour(tours.platformTour);
  };

  const completeTour = () => {
    // Mark platform tour as completed when it finishes
    if (activeTour?.id === 'platform-tour') {
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    }
    setActiveTour(null);
  };

  const skipTour = () => {
    setActiveTour(null);
  };

  const hasCompletedTour = (tourId: string): boolean => {
    try {
      const completed = JSON.parse(localStorage.getItem('mission-control-tours-completed') || '[]');
      return completed.includes(tourId);
    } catch {
      return false;
    }
  };

  return {
    activeTour,
    startTour,
    startPlatformTour,
    completeTour,
    skipTour,
    hasCompletedTour,
  };
}
