
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'default' | 'green' | 'red';
}

/**
 * Toggle Switch Component
 * 
 * iOS/macOS-style toggle - pill-shaped with sliding thumb
 */
export function Toggle({ 
  checked, 
  onChange, 
  disabled = false,
  size = 'md',
  colorScheme = 'default'
}: ToggleProps) {
  
  // Size configurations
  const config = {
    sm: { trackWidth: 36, trackHeight: 20, thumbSize: 16, slideDistance: 16 },
    md: { trackWidth: 44, trackHeight: 22, thumbSize: 18, slideDistance: 22 },
    lg: { trackWidth: 52, trackHeight: 26, thumbSize: 22, slideDistance: 26 },
  }[size];
  
  // Colors
  const trackColor = checked 
    ? (colorScheme === 'green' ? 'bg-green-500' : 'bg-mission-control-accent')
    : (colorScheme === 'red' ? 'bg-red-500' : 'bg-mission-control-border');
  
  return (
    <label className="relative inline-flex flex-shrink-0 cursor-pointer" aria-label="Toggle">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
        aria-label="Toggle switch"
      />
      <div
        className={`relative rounded-full transition-colors duration-200 ${trackColor} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
          width: `${config.trackWidth}px`,
          height: `${config.trackHeight}px`,
        }}
      >
        <div
          className="absolute top-0.5 left-0.5 bg-white rounded-full shadow-md ring-1 ring-black/5 transition-transform duration-200 ease-in-out"
          style={{
            width: `${config.thumbSize}px`,
            height: `${config.thumbSize}px`,
            transform: checked ? `translateX(${config.slideDistance}px)` : 'translateX(0)',
          }}
        />
      </div>
    </label>
  );
}
