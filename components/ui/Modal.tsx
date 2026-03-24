'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  description,
  children,
  size = 'md',
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<Element | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // Focus trap
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTabKey);
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element in the modal
    setTimeout(() => {
      if (modalRef.current) {
        const focusableElement = modalRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        if (focusableElement) {
          focusableElement.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTabKey);
      document.body.style.overflow = '';

      // Restore focus to the previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return createPortal(
    <>
      {/* Styles for animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      ` }} />
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/80 animate-fade-in"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          aria-describedby={description ? "modal-description" : undefined}
          tabIndex={-1}
          className={`
            relative
            w-full
            mx-4
            ${sizes[size]}
            bg-gray-900
            rounded-2xl
            border
            border-gray-700/50
            shadow-2xl
            shadow-black/50
            animate-scale-in
            focus:outline-none
            overflow-hidden
            flex
            flex-col
            max-h-[85vh]
          `}
        >
          {/* Header */}
          {(title || description) && (
            <div className="p-6 pb-4 border-b border-gray-800 flex-shrink-0">
              {title && (
                <h2 id="modal-title" className="text-xl font-bold text-white">{title}</h2>
              )}
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-gray-400">{description}</p>
              )}
            </div>
          )}
          
          {/* Content - scrollable, no padding to allow full-width headers */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
