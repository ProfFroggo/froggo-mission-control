/**
 * BaseModal - Standardized modal component with consistent behavior
 * 
 * Features:
 * - ESC key handling (always works, even when typing)
 * - Consistent animations (fade in/out + scale)
 * - Backdrop click to close
 * - Focus trapping
 * - Accessibility (ARIA roles, labels)
 * - Proper close button placement
 * - Customizable size and styling
 */

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

export interface BaseModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  
  /** Callback when modal should close */
  onClose: () => void;
  
  /** Modal content */
  children: ReactNode;
  
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  
  /** Custom max width (overrides size) */
  maxWidth?: string;
  
  /** Custom max height */
  maxHeight?: string;
  
  /** Whether to show close button */
  showCloseButton?: boolean;
  
  /** Close button position */
  closeButtonPosition?: 'header' | 'floating';
  
  /** Custom close button label for accessibility */
  closeButtonLabel?: string;
  
  /** Prevent closing on backdrop click */
  preventBackdropClose?: boolean;
  
  /** Prevent closing on ESC key */
  preventEscClose?: boolean;
  
  /** Additional classes for modal container */
  className?: string;
  
  /** Additional classes for backdrop */
  backdropClassName?: string;
  
  /** ARIA label for the modal */
  ariaLabel?: string;
  
  /** ARIA describedby for the modal */
  ariaDescribedby?: string;
  
  /** Modal title */
  title?: string;
  
  /** Modal subtitle */
  subtitle?: string;
  
  /** Modal icon */
  icon?: any;
  
  /** Animation duration in ms */
  animationDuration?: number;
  
  /** Whether the modal is currently closing */
  isClosing?: boolean;
  
  /** Callback when closing animation starts */
  onClosingStart?: () => void;
  
  /** Callback when closing animation completes */
  onClosingComplete?: () => void;
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',     // 384px
  md: 'max-w-md',     // 448px
  lg: 'max-w-2xl',    // 672px
  xl: 'max-w-4xl',    // 896px
  '2xl': 'max-w-6xl', // 1152px
  full: 'max-w-[95vw]',
};

export default function BaseModal({
  isOpen,
  onClose,
  children,
  size = 'md',
  maxWidth,
  maxHeight = '90vh',
  showCloseButton = true,
  closeButtonPosition = 'header',
  closeButtonLabel = 'Close modal',
  preventBackdropClose = false,
  preventEscClose = false,
  className = '',
  backdropClassName = '',
  ariaLabel,
  ariaDescribedby,
  animationDuration = 200,
  isClosing: externalIsClosing,
  onClosingStart,
  onClosingComplete,
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Track focus for focus trapping
  useEffect(() => {
    if (isOpen) {
      // Store the element that had focus before modal opened
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the modal container after a brief delay (for animation)
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen || preventEscClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    // Use capture phase to ensure we catch ESC before any child handlers
    window.addEventListener('keydown', handleEscape, { capture: true });
    return () => window.removeEventListener('keydown', handleEscape, { capture: true });
  }, [isOpen, preventEscClose]);

  // Focus trap handler
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        // Shift+Tab on first element -> focus last
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        // Tab on last element -> focus first
        e.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    onClosingStart?.();
    
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
      onClosingComplete?.();
    }, animationDuration);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !preventBackdropClose) {
      handleClose();
    }
  };

  if (!isOpen && !externalIsClosing) return null;

  const isClosing = externalIsClosing ?? false;
  const sizeClass = maxWidth ? '' : SIZE_CLASSES[size];

  return (
    <>
      {/* Backdrop - Enhanced blur and consistent styling */}
      <div
        className={`fixed inset-0 modal-backdrop z-[100] ${
          isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
        } ${backdropClassName}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Container - Proper z-index layering and responsive padding */}
      <div
        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
        onClick={handleBackdropClick}
      >
        {/* Modal Content - Enhanced responsive sizing and transitions */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedby}
          tabIndex={-1}
          className={`
            glass-modal rounded-xl w-full pointer-events-auto
            overflow-hidden flex flex-col shadow-2xl
            ${sizeClass}
            ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}
            ${className}
          `}
          style={{
            maxWidth: maxWidth || undefined,
            maxHeight,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Floating Close Button - Enhanced visibility and responsive positioning */}
          {showCloseButton && closeButtonPosition === 'floating' && (
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2 bg-clawd-surface/90 hover:bg-clawd-border rounded-lg transition-all duration-200 shadow-lg backdrop-blur-sm hover:scale-105"
              aria-label={closeButtonLabel}
              type="button"
            >
              <X size={16} className="text-clawd-text hover:text-clawd-accent" />
            </button>
          )}

          {children}
        </div>
      </div>
    </>
  );
}

/**
 * BaseModalHeader - Standardized modal header with close button
 */
interface BaseModalHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  closeButtonLabel?: string;
  className?: string;
}

export function BaseModalHeader({
  title,
  subtitle,
  icon,
  onClose,
  showCloseButton = true,
  closeButtonLabel = 'Close modal',
  className = '',
}: BaseModalHeaderProps) {
  return (
    <div className={`flex items-start gap-3 p-6 border-b border-clawd-border ${className}`}>
      {icon && (
        <div className="flex-shrink-0 mt-0.5">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg sm:text-xl font-semibold text-clawd-text">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-clawd-text-dim mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="p-2 hover:bg-clawd-border rounded-lg transition-colors flex-shrink-0"
          aria-label={closeButtonLabel}
          type="button"
        >
          <X size={16} className="text-clawd-text-dim hover:text-clawd-text" />
        </button>
      )}
    </div>
  );
}

/**
 * BaseModalBody - Standardized modal body with scrolling
 */
interface BaseModalBodyProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  /** Set max height for body (useful for very tall content) */
  maxHeight?: string;
}

export function BaseModalBody({ 
  children, 
  className = '', 
  noPadding = false,
  maxHeight,
}: BaseModalBodyProps) {
  return (
    <div 
      className={`overflow-y-auto ${noPadding ? '' : 'p-6'} ${className}`}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}

/**
 * BaseModalFooter - Standardized modal footer with actions
 */
interface BaseModalFooterProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function BaseModalFooter({ children, className = '', align = 'right' }: BaseModalFooterProps) {
  const alignClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[align];

  return (
    <div className={`flex flex-wrap items-center gap-3 p-6 border-t border-clawd-border ${alignClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * BaseModalButton - Standardized button for modal actions
 */
interface BaseModalButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BaseModalButton({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  type = 'button',
  icon,
  loading = false,
  className = '',
  size = 'md',
}: BaseModalButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  }[size];
  
  const variantStyles = {
    primary: 'bg-clawd-accent text-white hover:bg-clawd-accent-dim',
    secondary: 'bg-clawd-surface border border-clawd-border hover:bg-clawd-border',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'hover:bg-clawd-border',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  );
}
