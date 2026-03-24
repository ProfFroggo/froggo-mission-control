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

import { useEffect, useRef, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton, Button } from '@radix-ui/themes';
import { useFocusTrap } from '../hooks/useKeyboardNav';

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

  /** ARIA labelledby - references a heading element ID for screen readers */
  ariaLabelledby?: string;

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
  ariaLabelledby,
  ariaDescribedby,
  animationDuration = 200,
  isClosing: externalIsClosing,
  onClosingStart,
  onClosingComplete,
}: BaseModalProps) {
  const trapRef = useFocusTrap(isOpen);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Callback ref that merges trapRef and modalRef
  const modalRef = useRef<HTMLDivElement>(null);
  const setModalRef = useCallback((node: HTMLDivElement | null) => {
    (modalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (trapRef as React.MutableRefObject<HTMLElement | null>).current = node;
  }, [trapRef]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Track focus for restore-on-close
  useEffect(() => {
    if (isOpen) {
      // Store the element that had focus before modal opened
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Auto-focus first focusable element when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const focusable = modalRef.current?.querySelector<HTMLElement>(
        'a[href]:not([disabled]), button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      focusable?.focus();
    }, 80);
    return () => clearTimeout(timer);
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

  const handleClose = useCallback(() => {
    onClosingStart?.();
    
    // Wait for animation to complete before calling onClose
    timeoutRef.current = setTimeout(() => {
      onClose();
      onClosingComplete?.();
    }, animationDuration);
  }, [onClose, onClosingStart, onClosingComplete, animationDuration]);

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
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleBackdropClick(e as any);
        }}
        role="presentation"
      >
        {/* Modal Content - Enhanced responsive sizing and transitions */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={setModalRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabelledby ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledby}
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
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* Floating Close Button - Enhanced visibility and responsive positioning */}
          {showCloseButton && closeButtonPosition === 'floating' && (
            <IconButton
              onClick={handleClose}
              size="2"
              variant="soft"
             
              aria-label={closeButtonLabel}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 shadow-lg"
            >
              <X size={16} />
            </IconButton>
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
  /** ID for the heading element, used with ariaLabelledby on BaseModal */
  titleId?: string;
}

export function BaseModalHeader({
  title,
  subtitle,
  icon,
  onClose,
  showCloseButton = true,
  closeButtonLabel = 'Close modal',
  className = '',
  titleId,
}: BaseModalHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 id={titleId} className="text-lg font-semibold text-mission-control-text">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-mission-control-text-dim mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {showCloseButton && onClose && (
        <IconButton
          onClick={onClose}
          size="2"
          variant="ghost"
         
          aria-label={closeButtonLabel}
          className="flex-shrink-0"
        >
          <X size={16} />
        </IconButton>
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
      className={`flex-1 overflow-y-auto ${noPadding ? '' : 'px-6 py-4'} ${className}`}
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
    <div className={`flex flex-wrap items-center gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0 ${alignClass} ${className}`}>
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
  const radixVariant: 'solid' | 'soft' | 'ghost' =
    variant === 'primary' ? 'solid' :
    variant === 'ghost' ? 'ghost' :
    'soft';

  const radixColor: 'red' | undefined =
    variant === 'danger' ? 'red' : undefined;

  const radixSize: '1' | '2' | '3' =
    size === 'sm' ? '1' : size === 'lg' ? '3' : '2';

  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      variant={radixVariant}
      color={radixColor}
      size={radixSize}
     
      className={className}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </Button>
  );
}
