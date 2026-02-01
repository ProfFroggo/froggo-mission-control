import React from 'react';

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
 * iOS/macOS-style toggle using checkbox + label pattern
 * Works with @tailwindcss/forms plugin
 */
export function Toggle({ 
  checked, 
  onChange, 
  disabled = false,
  size = 'md',
  colorScheme = 'default'
}: ToggleProps) {
  const id = React.useId();
  
  // Size variants - pill-shaped (2:1 width:height ratio)
  const sizes = {
    sm: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'peer-checked:translate-x-5' },
    md: { track: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'peer-checked:translate-x-6' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'peer-checked:translate-x-7' },
  };
  
  // Color schemes (for track when checked)
  const trackColors = {
    default: 'peer-checked:bg-clawd-accent',
    green: 'peer-checked:bg-green-500',
    red: 'peer-checked:bg-green-500', // green when ON even for "red" scheme
  };
  
  // Unchecked track color
  const uncheckedColor = colorScheme === 'red' ? 'bg-red-500' : 'bg-gray-400';
  
  const { track, thumb, translate } = sizes[size];
  const checkedColor = trackColors[colorScheme];
  
  return (
    <div className="relative inline-flex flex-shrink-0">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="peer sr-only unstyled"
      />
      <label
        htmlFor={id}
        className={`
          relative inline-block ${track} ${uncheckedColor} rounded-full ${checkedColor}
          cursor-pointer transition-colors duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            inline-block ${thumb} bg-white rounded-full shadow
            transform transition-transform duration-200 translate-x-0.5 translate-y-0.5
            ${translate}
          `}
        />
      </label>
    </div>
  );
}
