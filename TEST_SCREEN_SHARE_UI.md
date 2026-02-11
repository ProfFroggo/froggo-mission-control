# Screen Share UI Testing Guide

## What Was Fixed

### Issue
- Task 20977600 changes weren't reflected because the video preview was hardcoded inline
- No movable pop-out functionality
- No full-width video format option
- "Switch Source" button was just a static button on the video

### Solution Implemented

#### 1. Created `DraggableVideoWindow` Component
A new draggable, resizable video window with:
- **Drag functionality**: Click and drag the header bar to reposition
- **Resize functionality**: Drag the bottom-right corner to resize (min 240x135)
- **Three view modes**:
  - **Compact**: Default draggable window (400x225)
  - **Full-width**: Full screen mode (100vw x 100vh)
  - **Minimized**: Small collapsed bar that can be clicked to restore
- **Controls**:
  - Minimize button (collapses to small bar)
  - Maximize/Exit full-width toggle
  - Close button
  - Switch Source button (for screen share only)

#### 2. Integrated into VoiceChatPanel
- Replaced inline video preview with DraggableVideoWindow
- Video now appears as a floating window when active
- Can be moved anywhere on screen
- Can be resized as needed
- Can toggle to full-width for better screen viewing

## Testing Steps

### 1. Start Voice Chat
1. Open the dashboard
2. Go to Voice Chat panel
3. Select an agent (e.g., Froggo)
4. Press "Call" button to connect

### 2. Test Camera Mode
1. In settings (before calling), select "📹 Camera" mode
2. Start call
3. Toggle camera button
4. Verify:
   - Draggable video window appears
   - Can drag window around screen
   - Can resize from corner
   - Can minimize to small bar
   - Can maximize to full-width
   - Close button stops video

### 3. Test Screen Share Mode
1. In settings, select "🖥️ Screen share" mode
2. Start call
3. Click screen share button
4. Select a screen/window from picker
5. Verify:
   - Draggable video window appears with screen content
   - "Switch Source" button is visible in header
   - Can drag window around
   - Can resize window
   - Can maximize to full-width (important for screen sharing!)
   - Clicking "Switch Source" reopens picker
   - Can minimize and restore
   - Close button stops screen share

### 4. Test View Mode Transitions
1. Start with compact mode
2. Click maximize → should go full-width
3. Click maximize again → should return to compact
4. Click minimize → should collapse to bar
5. Click minimized bar → should restore to compact

### 5. Test During Active Call
1. Start call with video
2. Verify video window doesn't interfere with:
   - Message scrolling
   - Text input
   - Call controls
   - Audio visualizer

## Expected Behavior

### Compact Mode
- Draggable window positioned at (20, 20) by default
- Size: 400x225 pixels
- Can be repositioned anywhere on screen
- Can be resized (min 240x135)
- Header bar shows video type and controls

### Full-Width Mode
- Takes entire screen (100vw x 100vh)
- Cannot drag or resize in this mode
- Positioned at (0, 0)
- Best for detailed screen viewing
- Border changes to accent color

### Minimized Mode
- Small collapsed bar with video type icon
- Shows just the mode and close button
- Click anywhere to restore

## Technical Details

### Component Files
- `src/components/DraggableVideoWindow.tsx` - New draggable window component
- `src/components/VoiceChatPanel.tsx` - Updated to use DraggableVideoWindow

### Key Features
- Uses React refs to avoid re-renders during drag/resize
- Bounds checking to keep window on screen
- State management for three view modes
- Smooth transitions between modes
- Video srcObject handled by component
- Mirror effect for camera (scaleX(-1))

### Styling
- z-index: 50 (floats above chat content)
- Black background for video
- Semi-transparent header with backdrop blur
- Smooth transitions and hover effects
- Accent color for full-width mode border

## Known Limitations
- Cannot drag when in full-width mode (by design)
- Cannot resize when in full-width mode (by design)
- Window bounds checked but doesn't prevent off-screen completely if screen resized

## Success Criteria
✅ Video window is movable (drag from header)
✅ Video window is resizable (drag from corner)
✅ Full-width mode implemented and working
✅ Switch Source button accessible in pop-out
✅ Minimize/restore functionality works
✅ Video plays correctly in all modes
✅ Camera mirror effect applied correctly
✅ No interference with chat functionality

## Future Enhancements
- [ ] Save window position/size to localStorage
- [ ] Double-click header to maximize
- [ ] Keyboard shortcuts (ESC to minimize, F to full-width)
- [ ] Picture-in-picture mode using browser API
- [ ] Multi-window support (multiple video sources)
