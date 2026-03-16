// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * LiveRegion — ARIA live region components for announcing dynamic changes to screen readers.
 *
 * Usage:
 *   <LiveRegion message="Item saved" />       — polite announcement (does not interrupt)
 *   <AlertRegion message="Error occurred" />  — assertive announcement (interrupts immediately)
 */

interface LiveRegionProps {
  message: string;
}

/**
 * LiveRegion — polite aria-live region.
 * Screen readers announce the message after the current speech finishes.
 */
export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * AlertRegion — assertive aria-live region.
 * Screen readers interrupt current speech to announce the message immediately.
 * Use for errors and critical status changes only.
 */
export function AlertRegion({ message }: LiveRegionProps) {
  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      role="alert"
      className="sr-only"
    >
      {message}
    </div>
  );
}
