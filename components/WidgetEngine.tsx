'use client';

import { createContext, useContext, useRef, useEffect, useState, useCallback, createElement } from 'react';
import type { ReactNode } from 'react';

// ============================================
// Widget Engine — Global ElevenLabs Widget Controller
// ============================================
// Mounts a single <elevenlabs-convai> element in the DOM and exposes
// imperative control to the rest of the app via React context.
//
// The widget is visually suppressed (offscreen) so our custom switchboard
// UI remains the visible experience. The widget handles WebRTC negotiation,
// audio capture, and agent dispatch internally.

export interface WidgetEngineState {
  /** Whether the widget custom element is defined and mounted */
  isReady: boolean;
  /** Whether a conversation is currently active */
  isActive: boolean;
  /** The agent-id currently set on the widget */
  currentAgentId: string | null;
}

export interface WidgetEngineAPI {
  state: WidgetEngineState;
  /** Get a direct reference to the widget DOM element */
  getElement: () => HTMLElement | null;
  /** Set the agent-id attribute and prepare for a conversation */
  setAgentId: (agentId: string) => void;
  /** Set the signed-url attribute (clears agent-id) */
  setSignedUrl: (url: string) => void;
  /** Attempt to start a conversation via the widget */
  startConversation: () => Promise<boolean>;
  /** Attempt to end the current conversation */
  endConversation: () => void;
  /** Subscribe to widget events */
  addEventListener: (event: string, handler: EventListener) => () => void;
}

const WidgetEngineContext = createContext<WidgetEngineAPI | null>(null);

export function useWidgetEngine(): WidgetEngineAPI {
  const ctx = useContext(WidgetEngineContext);
  if (!ctx) {
    throw new Error('useWidgetEngine must be used within <WidgetEngineProvider>');
  }
  return ctx;
}

// Known methods the widget may expose
const START_CANDIDATES = ['startConversation', 'startSession', 'start', 'open', 'connect'];
const END_CANDIDATES = ['endConversation', 'endSession', 'stopConversation', 'close', 'disconnect', 'end'];

export function WidgetEngineProvider({ children }: { children: ReactNode }) {
  const widgetRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);

  // Load the widget script once
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    // Check if script already exists
    const existing = document.querySelector('script[src*="convai-widget-embed"]');
    if (existing) return;

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Wait for the custom element to be defined
  useEffect(() => {
    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      if (customElements.get('elevenlabs-convai')) {
        setIsReady(true);
      } else {
        requestAnimationFrame(check);
      }
    };

    // Also use whenDefined for a clean async path
    customElements.whenDefined('elevenlabs-convai').then(() => {
      if (!cancelled) setIsReady(true);
    });

    // Fallback polling in case whenDefined doesn't fire quickly
    const timer = setTimeout(check, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const getElement = useCallback(() => widgetRef.current, []);

  const setAgentIdAttr = useCallback((agentId: string) => {
    const el = widgetRef.current;
    if (!el) return;
    el.removeAttribute('signed-url');
    el.setAttribute('agent-id', agentId);
    setCurrentAgentId(agentId);
  }, []);

  const setSignedUrl = useCallback((url: string) => {
    const el = widgetRef.current;
    if (!el) return;
    el.removeAttribute('agent-id');
    el.setAttribute('signed-url', url);
    setCurrentAgentId(null);
  }, []);

  const startConversation = useCallback(async (): Promise<boolean> => {
    const el = widgetRef.current as any;
    if (!el) return false;

    // Strategy based on probe results (2026-05-13):
    // The widget does NOT expose startConversation/endConversation on the host
    // element. It uses a Lit VDOM internally. The only reliable entry point is
    // clicking the button inside the open shadowRoot.
    //
    // However, the button only renders once the widget has a valid agent-id or
    // signed-url attribute. So we wait briefly for the shadow DOM to populate.

    // First try imperative methods (in case a future widget version exposes them)
    for (const method of START_CANDIDATES) {
      if (typeof el[method] === 'function') {
        try {
          await el[method]();
          setIsActive(true);
          return true;
        } catch (err) {
          console.warn(`[WidgetEngine] ${method}() failed:`, err);
        }
      }
    }

    // Primary strategy: click the shadow DOM button
    const clickShadowButton = (): boolean => {
      const shadowRoot = el.shadowRoot;
      if (!shadowRoot) return false;
      const button = shadowRoot.querySelector('button') as HTMLButtonElement | null;
      if (!button) return false;
      button.click();
      setIsActive(true);
      return true;
    };

    if (clickShadowButton()) return true;

    // The button may not be rendered yet — wait for the widget to initialize
    // with the new agent-id/signed-url attribute, then retry
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (clickShadowButton()) return true;
    }

    console.error('[WidgetEngine] No start method or shadow button available after retries');
    return false;
  }, []);

  const endConversation = useCallback(() => {
    const el = widgetRef.current as any;
    if (!el) return;

    // Try imperative methods first
    for (const method of END_CANDIDATES) {
      if (typeof el[method] === 'function') {
        try {
          el[method]();
          setIsActive(false);
          return;
        } catch (err) {
          console.warn(`[WidgetEngine] ${method}() failed:`, err);
        }
      }
    }

    // Primary strategy: click the shadow button again (toggles conversation)
    const shadowRoot = el.shadowRoot;
    if (shadowRoot) {
      const button = shadowRoot.querySelector('button') as HTMLButtonElement | null;
      if (button) {
        button.click();
        setIsActive(false);
        return;
      }
    }

    // Last resort: remove the source attribute to force disconnect
    el.removeAttribute('agent-id');
    el.removeAttribute('signed-url');
    setIsActive(false);
  }, []);

  const addEventListenerFn = useCallback((event: string, handler: EventListener) => {
    const el = widgetRef.current;
    if (!el) return () => {};
    el.addEventListener(event, handler);
    return () => el.removeEventListener(event, handler);
  }, []);

  const api: WidgetEngineAPI = {
    state: { isReady, isActive, currentAgentId },
    getElement,
    setAgentId: setAgentIdAttr,
    setSignedUrl,
    startConversation,
    endConversation,
    addEventListener: addEventListenerFn,
  };

  return (
    <WidgetEngineContext.Provider value={api}>
      {children}
      {/* 
        The widget element — mounted offscreen so it can capture audio
        and maintain WebRTC connections without being visible.
        We avoid display:none because that may prevent audio/media lifecycle.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] top-0 h-0 w-0 overflow-hidden"
      >
        {createElement('elevenlabs-convai', {
          id: 'voisss-widget-engine',
          ref: (node: HTMLElement | null) => { widgetRef.current = node; },
          'agent-id': '',
        })}
      </div>
    </WidgetEngineContext.Provider>
  );
}
