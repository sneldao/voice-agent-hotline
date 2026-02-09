/**
 * Accessibility utilities for voice-agent-hotline
 */
import * as React from 'react';

/**
 * Generate unique IDs for form elements
 */
let idCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Screen reader-only text for accessibility
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Live region for announcements (screen readers)
 */
export function LiveRegion({ 
  politeness = 'polite', 
  children 
}: { 
  politeness?: 'polite' | 'assertive';
  children: React.ReactNode;
}) {
  return (
    <div 
      role="status" 
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}

/**
 * Focus trap props for modals
 */
export function getFocusTrapProps() {
  return {
    role: 'dialog',
    'aria-modal': 'true',
    tabIndex: -1,
  };
}

/**
 * Button with full accessibility
 */
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: React.ReactNode;
}

export function AccessibleButton({ label, children, ...props }: AccessibleButtonProps) {
  return (
    <button aria-label={label} {...props}>
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </button>
  );
}

/**
 * Icon button with accessibility
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  icon: React.ReactNode;
}

export function IconButton({ 'aria-label': label, icon, ...props }: IconButtonProps) {
  return (
    <button aria-label={label} {...props}>
      {icon}
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  );
}

/**
 * Skip to main content link
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </a>
  );
}

/**
 * Announce to screen readers
 */
let announceQueue: string[] = [];

export function announce(message: string) {
  announceQueue = [...announceQueue, message];
  // Force re-render of LiveRegion
  setTimeout(() => {
    announceQueue = [];
  }, 1000);
}

export function Announcer() {
  const [message, setMessage] = React.useState('');
  
  React.useEffect(() => {
    if (announceQueue.length > 0) {
      setMessage(announceQueue[announceQueue.length - 1]);
    }
  }, []);
  
  return <LiveRegion>{message}</LiveRegion>;
}
