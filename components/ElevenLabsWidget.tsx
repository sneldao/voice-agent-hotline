'use client';

import { useEffect, useRef } from 'react';

interface ElevenLabsWidgetProps {
  agentId: string;
}

/**
 * ElevenLabs Conversational AI Widget
 * 
 * Uses the official ElevenLabs widget embed which handles WebRTC
 * connection, negotiation, and audio reliably — the same way
 * the ElevenLabs dashboard does it.
 */
export function ElevenLabsWidget({ agentId }: ElevenLabsWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load the widget script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div ref={containerRef}>
      {/* @ts-ignore - custom element */}
      <elevenlabs-convai agent-id={agentId} />
    </div>
  );
}
