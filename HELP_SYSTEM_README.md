# Froggo Dashboard Help System

Comprehensive help and documentation system for the Froggo Dashboard.

## Overview

The help system provides:
- **In-app help panel** - Searchable documentation, context-aware
- **Feature tooltips** - Inline contextual help on hover
- **Interactive tours** - Step-by-step guided walkthroughs
- **Keyboard shortcuts reference** - Quick reference for power users
- **FAQ section** - Common questions and answers
- **Video tutorial placeholders** - Links to video content

## Components

### 1. HelpPanel (`src/components/HelpPanel.tsx`)

Main help interface with multiple views:

**Usage:**
```tsx
import HelpPanel from './components/HelpPanel';

<HelpPanel 
  isOpen={helpPanelOpen}
  onClose={() => setHelpPanelOpen(false)}
  currentPanel={currentView} // For context-aware help
/>
```

**Features:**
- Searchable help articles
- Context-aware recommendations
- FAQ with expandable answers
- Quick tips
- Keyboard shortcuts reference
- Category-based browsing

**Keyboard Shortcut:** ⌘H

---

### 2. Tooltip (`src/components/Tooltip.tsx`)

Inline contextual help tooltips.

**Basic Usage:**
```tsx
import Tooltip from './components/Tooltip';

<Tooltip content="This explains the feature">
  <button>Hover me</button>
</Tooltip>
```

**With Help Icon:**
```tsx
import { HelpTooltip } from './components/Tooltip';

<label>
  Task Priority
  <HelpTooltip content="P0 = Critical, P1 = High, P2 = Medium, P3 = Low" />
</label>
```

**Props:**
- `content` - String or React node to display
- `position` - 'top' | 'bottom' | 'left' | 'right'
- `delay` - Milliseconds before showing (default: 500)
- `maxWidth` - Max width in pixels (default: 250)
- `disabled` - Disable tooltip
- `showArrow` - Show/hide arrow (default: true)

---

### 3. TourGuide (`src/components/TourGuide.tsx`)

Interactive feature tours with UI highlighting.

**Usage:**
```tsx
import TourGuide, { useTour } from './components/TourGuide';

function App() {
  const { activeTour, startTour, completeTour, skipTour } = useTour();

  return (
    <>
      <button onClick={() => startTour('gettingStarted')}>
        Start Tour
      </button>
      
      <TourGuide 
        tour={activeTour}
        onComplete={completeTour}
        onSkip={skipTour}
      />
    </>
  );
}
```

**Creating Custom Tours:**
```tsx
import { Tour } from './components/TourGuide';

const myTour: Tour = {
  id: 'my-feature-tour',
  name: 'My Feature Tour',
  description: 'Learn how to use my feature',
  steps: [
    {
      target: '#my-button', // CSS selector
      title: 'Click This Button',
      content: 'This button does something cool!',
      position: 'bottom',
      action: () => {
        // Optional: Execute code when step starts
        console.log('Step started');
      }
    },
    // More steps...
  ]
};
```

**Built-in Tours:**
- `gettingStarted` - Dashboard overview
- `kanbanWorkflow` - Task management
- `voiceAssistant` - Voice features

**useTour Hook:**
```tsx
const {
  activeTour,          // Currently active tour (or null)
  startTour,           // (tourId: string) => void
  completeTour,        // () => void
  skipTour,            // () => void
  hasCompletedTour,    // (tourId: string) => boolean
} = useTour();
```

---

## Help Content Management

### Adding Help Articles

Edit `src/data/helpContent.ts`:

```tsx
{
  id: 'my-article',
  title: 'How to Use My Feature',
  category: 'Features',
  content: `Detailed explanation...
  
  **Subheading:**
  More content here.`,
  keywords: ['feature', 'how', 'use'],
  relatedTo: ['dashboard', 'kanban'], // Panel IDs
  videoUrl: 'https://youtube.com/watch?v=...', // Optional
  lastUpdated: '2026-01-28'
}
```

### Adding FAQs

```tsx
{
  id: 'faq-my-question',
  question: 'How do I do X?',
  answer: 'You can do X by...',
  category: 'General',
  keywords: ['how', 'do', 'x']
}
```

### Adding Quick Tips

```tsx
{
  id: 'tip-my-tip',
  title: 'Pro Tip',
  description: 'Use this shortcut to save time!',
  icon: '💡'
}
```

---

## Integration Examples

### Context-Aware Help Button

```tsx
import { HelpCircle } from 'lucide-react';

function MyPanel() {
  const [helpOpen, setHelpOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setHelpOpen(true)}>
        <HelpCircle size={20} />
        Help
      </button>
      
      <HelpPanel 
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPanel="kanban" // Shows kanban-related help first
      />
    </>
  );
}
```

### First-Time User Welcome Tour

```tsx
import { useFirstTimeUser } from './hooks/useFirstTimeUser';

function App() {
  useFirstTimeUser(); // Automatically shows welcome tour
  
  return <div>...</div>;
}
```

### Panel-Specific Tours

```tsx
function KanbanPanel() {
  const { startTour } = useTour();
  
  useEffect(() => {
    const hasSeenKanbanTour = localStorage.getItem('kanban-tour-seen');
    if (!hasSeenKanbanTour) {
      startTour('kanbanWorkflow');
      localStorage.setItem('kanban-tour-seen', 'true');
    }
  }, []);
  
  return <div>...</div>;
}
```

### Tooltips on Form Fields

```tsx
import { HelpTooltip } from './components/Tooltip';

function TaskForm() {
  return (
    <div>
      <label className="flex items-center gap-2">
        Priority
        <HelpTooltip content="P0 = Critical (fix ASAP), P1 = High (this week), P2 = Medium (this month), P3 = Low (backlog)" />
      </label>
      
      <select name="priority">
        <option value="p0">P0 - Critical</option>
        <option value="p1">P1 - High</option>
        <option value="p2">P2 - Medium</option>
        <option value="p3">P3 - Low</option>
      </select>
    </div>
  );
}
```

---

## Search Functionality

### Search Help Articles

```tsx
import { searchHelp } from '../data/helpContent';

const results = searchHelp('keyboard shortcuts');
// Returns articles matching query
```

### Search FAQs

```tsx
import { searchFAQs } from '../data/helpContent';

const results = searchFAQs('voice not working');
// Returns FAQ items matching query
```

### Context-Aware Help

```tsx
import { getContextHelp } from '../data/helpContent';

const relevantArticles = getContextHelp('kanban');
// Returns articles related to kanban panel
```

---

## Keyboard Shortcuts

The help system integrates with keyboard shortcuts:

- **⌘H** - Open help panel
- **⌘?** - Keyboard shortcuts reference
- **Esc** - Close help panel / tour
- **Arrow keys** - Navigate tour steps (when tour active)
- **Enter** - Complete tour (on last step)

---

## Accessibility

All components are fully accessible:

- **Keyboard navigation** - Full keyboard support
- **ARIA labels** - Screen reader friendly
- **Focus management** - Proper focus trapping in modals
- **Semantic HTML** - Proper heading structure
- **High contrast** - Works in dark/light themes

---

## Video Tutorials

Video links can be added to help articles:

```tsx
{
  id: 'my-article',
  // ...
  videoUrl: 'https://youtube.com/watch?v=...'
}
```

Videos appear as prominent links in the article view. Clicking opens in new tab.

**Recommended video topics:**
- Getting started walkthrough
- Kanban workflow demo
- Voice assistant guide
- Agent system overview
- Advanced features

---

## Customization

### Theming

Tooltips and help panels respect the global theme (dark/light/system).

### Positioning

Tours and tooltips automatically adjust position to stay within viewport bounds.

### Timing

- Tooltip delay: 500ms (configurable per tooltip)
- Welcome tour: 2s after app load
- Tour completion tracked in localStorage

---

## Best Practices

### Help Articles

- **Clear titles** - Descriptive, searchable
- **Structured content** - Use headings, lists, code blocks
- **Rich keywords** - Include synonyms and variations
- **Keep updated** - Set lastUpdated date
- **Link videos** - When available

### Tooltips

- **Brief** - One or two sentences max
- **Specific** - Explain the exact feature
- **Helpful** - Don't just repeat the label
- **Consistent** - Similar features use similar wording

### Tours

- **Short** - 5-7 steps max per tour
- **Focused** - One workflow or feature
- **Clear targets** - Use stable selectors (IDs, data attributes)
- **Test thoroughly** - Tours break if UI changes
- **Provide exit** - Always allow skip

---

## Troubleshooting

### Tour Not Showing

- Check selector: `document.querySelector(step.target)`
- Verify element is visible and not in collapsed section
- Check tour hasn't been completed (localStorage)

### Tooltip Not Appearing

- Check `disabled` prop
- Verify element is hoverable
- Check z-index conflicts

### Search Not Finding Articles

- Check keywords array includes search terms
- Verify article content has expected text
- Check spelling and casing

---

## Future Enhancements

Planned features:

- [ ] Video player embedded in help panel
- [ ] Interactive examples with live preview
- [ ] User-contributed help articles
- [ ] Context-sensitive help button on every panel
- [ ] AI-powered help search
- [ ] Multilingual support
- [ ] Offline help content caching
- [ ] Help analytics (most searched topics)

---

## Files Reference

```
src/
├── components/
│   ├── HelpPanel.tsx          # Main help interface
│   ├── Tooltip.tsx            # Tooltip component
│   ├── TourGuide.tsx          # Interactive tours
│   └── KeyboardShortcuts.tsx  # Shortcuts reference
├── data/
│   └── helpContent.ts         # All help articles, FAQs, tips
├── hooks/
│   └── useFirstTimeUser.ts    # First-time user detection
└── App.tsx                    # Help integration
```

---

## Contributing

To add new help content:

1. Edit `src/data/helpContent.ts`
2. Add article/FAQ/tip
3. Include rich keywords for search
4. Link related panels with `relatedTo`
5. Test search functionality
6. Update lastUpdated date

For tours:

1. Edit `src/components/TourGuide.tsx`
2. Add tour to `tours` object
3. Use stable selectors (data attributes preferred)
4. Test all steps thoroughly
5. Consider triggering automatically for first-time users

---

## Support

For questions or issues:
- Check FAQ section in help panel
- Search existing help articles
- Ask Froggo in chat panel
- Report bugs via Settings > Support
