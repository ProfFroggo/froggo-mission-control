# Quick Help Integration Guide

**5-minute guide to adding help to your panel**

## Step 1: Add Help Article

Edit `src/data/helpContent.ts`:

```typescript
{
  id: 'my-panel-guide',
  title: 'My Panel Guide',
  category: 'My Category',
  content: `# My Panel

This is how to use my panel...

**Key Features:**
- Feature 1
- Feature 2

**Tips:**
Use keyboard shortcuts for speed!`,
  keywords: ['my', 'panel', 'feature'],
  relatedTo: ['mypanel'], // Panel ID - IMPORTANT for context-aware help
  lastUpdated: '2026-01-28'
}
```

## Step 2: Add Help Button (Optional)

```tsx
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import HelpPanel from '../components/HelpPanel';

function MyPanel() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div>
      {/* Header with help button */}
      <div className="flex items-center justify-between">
        <h1>My Panel</h1>
        <button 
          onClick={() => setHelpOpen(true)}
          className="p-2 hover:bg-clawd-border rounded-lg"
          title="Help (⌘H)"
        >
          <HelpCircle size={20} />
        </button>
      </div>

      {/* Panel content */}
      <div>...</div>

      {/* Help panel */}
      <HelpPanel 
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPanel="mypanel" // Shows mypanel-related help first
      />
    </div>
  );
}
```

## Step 3: Add Tooltips to Complex UI

```tsx
import { HelpTooltip } from '../components/Tooltip';

<div className="form-field">
  <label className="flex items-center gap-2">
    Complex Setting
    <HelpTooltip content="This setting controls X. Higher values = Y." />
  </label>
  <input type="range" />
</div>
```

## Step 4: Create Panel Tour (Optional)

Edit `src/components/TourGuide.tsx`, add to `tours` object:

```typescript
myPanelTour: {
  id: 'my-panel-tour',
  name: 'My Panel Tour',
  description: 'Learn to use my panel',
  steps: [
    {
      target: '[data-feature="main-button"]', // Use data attributes!
      title: 'Main Action',
      content: 'Click here to do the main thing.',
      position: 'bottom',
    },
    {
      target: '[data-feature="settings"]',
      title: 'Settings',
      content: 'Configure your preferences here.',
      position: 'left',
    },
    // More steps...
  ],
}
```

Then add data attributes to your elements:

```tsx
<button data-feature="main-button">Do Thing</button>
<div data-feature="settings">Settings panel</div>
```

## Step 5: Trigger Tour for First-Time Users

```tsx
import { useTour } from '../components/TourGuide';
import { useEffect } from 'react';

function MyPanel() {
  const { startTour, hasCompletedTour } = useTour();

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('my-panel-tour-seen');
    if (!hasSeenTour && !hasCompletedTour('my-panel-tour')) {
      // Delay to let UI render
      const timer = setTimeout(() => {
        startTour('myPanelTour');
        localStorage.setItem('my-panel-tour-seen', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return <div>...</div>;
}
```

## Done! 🎉

Your panel now has:
- ✅ Searchable help content
- ✅ Context-aware help (shows up first when users press ⌘H)
- ✅ Inline tooltips for complex UI
- ✅ Interactive tour for first-time users

## Pro Tips

### 1. Use Data Attributes for Tours
```tsx
// Good - stable selector
<button data-feature="submit">Submit</button>

// Bad - fragile, breaks if CSS changes
<button className="px-4 py-2 bg-blue-500">Submit</button>
```

### 2. Write for Skimmers
Users scan, they don't read. Use:
- **Bold for important terms**
- Lists for steps/features
- Short paragraphs (2-3 sentences max)
- Clear headings

### 3. Include Examples
```tsx
content: `**How to use:**

1. Enter your text
2. Click "Process"
3. Download results

**Example:**
Input: "Hello World"
Output: "HELLO WORLD"
`
```

### 4. Link Related Content
```tsx
{
  id: 'advanced-features',
  // ...
  relatedTo: ['mypanel', 'settings'], // Show in both panels
}
```

### 5. Keep Tours Short
- 3-5 steps max
- One workflow per tour
- Allow skip at any time

### 6. Test After UI Changes
Tours break if:
- Element selector changes
- Element is removed
- Element moves to different panel/modal

## Common Patterns

### Pattern: Help Icon Next to Label
```tsx
<label className="flex items-center gap-2">
  API Key
  <HelpTooltip content="Get your API key from settings" />
</label>
```

### Pattern: Full Tooltip on Hover
```tsx
import Tooltip from '../components/Tooltip';

<Tooltip content="Detailed explanation of this feature">
  <button>Complex Feature</button>
</Tooltip>
```

### Pattern: Context Help Button in Header
```tsx
<div className="panel-header">
  <h2>My Panel</h2>
  <button onClick={() => setHelpOpen(true)}>
    <HelpCircle size={18} />
  </button>
</div>
```

### Pattern: Tour Button in Onboarding
```tsx
import { useTour } from '../components/TourGuide';

function WelcomeMessage() {
  const { startTour } = useTour();
  
  return (
    <div className="welcome">
      <h3>New to this panel?</h3>
      <button onClick={() => startTour('myPanelTour')}>
        Take a Tour
      </button>
    </div>
  );
}
```

## FAQs

**Q: Do I need to add help for every feature?**
A: No. Focus on complex features, new workflows, and things users ask about.

**Q: How do I know what to include in help articles?**
A: Think about:
- What would confuse a new user?
- What questions do you get asked?
- What's not obvious from the UI?

**Q: Should I create a tour for my panel?**
A: If it's a core workflow or complex interface, yes. If it's simple (like settings), probably not.

**Q: Can I embed videos?**
A: Yes, add `videoUrl` to your article. It opens in new tab (embedded player coming soon).

**Q: What if my element isn't always visible?**
A: Tours work best on stable, always-visible elements. Avoid targeting elements in collapsed sections or modals.

**Q: How do I update existing help articles?**
A: Edit `src/data/helpContent.ts`, update content, and change `lastUpdated` date.

## Need More Help?

- Read full docs: [HELP_SYSTEM_README.md](./HELP_SYSTEM_README.md)
- See examples: [src/components/HelpExample.tsx](./src/components/HelpExample.tsx)
- Check summary: [HELP_SYSTEM_SUMMARY.md](./HELP_SYSTEM_SUMMARY.md)
- Ask Froggo in chat!
