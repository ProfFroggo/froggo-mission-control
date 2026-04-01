// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Canonical search input — icon left, clear button right.
// All search bars in the app should use this component.
import { useRef, forwardRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** 'sm' = compact toolbar (text-xs, py-1.5) · 'md' = full size (text-sm, py-2) */
  size?: 'sm' | 'md';
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Search...', onKeyDown, size = 'sm', className = '', autoFocus, disabled, 'aria-label': ariaLabel }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const resolvedRef = (ref ?? inputRef) as React.RefObject<HTMLInputElement>;

    const iconSize = size === 'sm' ? 13 : 15;
    const clearSize = size === 'sm' ? 12 : 14;
    const inputClass = size === 'sm'
      ? 'text-xs py-1.5'
      : 'text-sm py-2';

    return (
      <div className={`relative flex items-center ${className}`}>
        <Search
          size={iconSize}
          className="absolute left-2.5 text-mission-control-text-dim pointer-events-none z-10"
          aria-hidden="true"
        />
        <input
          ref={resolvedRef}
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={`w-full pl-8 ${value ? 'pr-7' : 'pr-3'} ${inputClass} rounded-lg`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              resolvedRef.current?.focus();
            }}
            className="absolute right-2 flex items-center justify-center w-4 h-4 rounded text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            aria-label="Clear search"
            tabIndex={-1}
          >
            <X size={clearSize} />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
export default SearchInput;
