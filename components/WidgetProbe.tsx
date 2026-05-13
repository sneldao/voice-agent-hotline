'use client';

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type VisibilityMode = 'visible' | 'offscreen' | 'transparent' | 'display-none';

type ProbeLog = {
  at: string;
  type: 'info' | 'event' | 'error';
  message: string;
  data?: unknown;
};

const DEFAULT_AGENT_ID = 'agent_2101khgsyd02fnvshvr7rzb50qj6';
const DEFAULT_INTERNAL_AGENT_ID = 'general_helper';

const EVENT_NAMES = [
  'load',
  'ready',
  'error',
  'connect',
  'connected',
  'disconnect',
  'disconnected',
  'message',
  'transcript',
  'conversation-start',
  'conversation-end',
  'conversationStarted',
  'conversationEnded',
  'status-change',
  'mode-change',
  'elevenlabs-convai:ready',
  'elevenlabs-convai:connect',
  'elevenlabs-convai:disconnect',
  'elevenlabs-convai:message',
  'elevenlabs-convai:error',
];

const START_METHODS = [
  'startConversation',
  'startSession',
  'start',
  'open',
  'connect',
];

const END_METHODS = [
  'endConversation',
  'endSession',
  'stopConversation',
  'stopSession',
  'close',
  'disconnect',
  'end',
];

const MUTE_METHODS = [
  'setMicMuted',
  'toggleMute',
  'mute',
  'unmute',
];

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function getPrototypeNames(value: unknown) {
  const names = new Set<string>();
  let cursor = value;

  while (cursor && cursor !== HTMLElement.prototype && cursor !== Element.prototype) {
    Object.getOwnPropertyNames(cursor).forEach((name) => names.add(name));
    cursor = Object.getPrototypeOf(cursor);
  }

  return [...names].sort();
}

function serializeEvent(event: Event) {
  const custom = event as CustomEvent;
  return {
    type: event.type,
    detail: custom.detail,
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
  };
}

export function WidgetProbe() {
  const widgetRef = useRef<HTMLElement | null>(null);
  const [agentId, setAgentId] = useState(DEFAULT_AGENT_ID);
  const [internalAgentId, setInternalAgentId] = useState(DEFAULT_INTERNAL_AGENT_ID);
  const [signedUrl, setSignedUrl] = useState('');
  const [useSignedUrl, setUseSignedUrl] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('visible');
  const [methodNames, setMethodNames] = useState<string[]>([]);
  const [ownKeys, setOwnKeys] = useState<string[]>([]);
  const [shadowInfo, setShadowInfo] = useState('Not inspected');
  const [selectedStartMethod, setSelectedStartMethod] = useState('');
  const [selectedEndMethod, setSelectedEndMethod] = useState('');
  const [selectedMuteMethod, setSelectedMuteMethod] = useState('');
  const [logs, setLogs] = useState<ProbeLog[]>([]);

  const addLog = useCallback((type: ProbeLog['type'], message: string, data?: unknown) => {
    setLogs((current) => [
      { at: nowLabel(), type, message, data },
      ...current,
    ].slice(0, 80));
  }, []);

  const widgetProps = useMemo(() => {
    const props: Record<string, unknown> = {
      id: 'voisss-widget-probe',
      ref: (node: HTMLElement | null) => {
        widgetRef.current = node;
      },
    };

    if (useSignedUrl && signedUrl.trim()) {
      props['signed-url'] = signedUrl.trim();
    } else {
      props['agent-id'] = agentId.trim();
    }

    return props;
  }, [agentId, signedUrl, useSignedUrl]);

  const refreshIntrospection = useCallback(() => {
    const widget = widgetRef.current;
    if (!widget) {
      addLog('error', 'Widget element is not mounted yet.');
      return;
    }

    const prototypes = getPrototypeNames(widget);
    const callable = prototypes.filter((name) => typeof (widget as any)[name] === 'function');
    setMethodNames(callable);
    setOwnKeys(Object.keys(widget).sort());

    const firstStart = START_METHODS.find((name) => callable.includes(name)) || '';
    const firstEnd = END_METHODS.find((name) => callable.includes(name)) || '';
    const firstMute = MUTE_METHODS.find((name) => callable.includes(name)) || '';
    setSelectedStartMethod((current) => current || firstStart);
    setSelectedEndMethod((current) => current || firstEnd);
    setSelectedMuteMethod((current) => current || firstMute);

    const shadowRoot = (widget as HTMLElement).shadowRoot;
    if (!shadowRoot) {
      setShadowInfo('No open shadowRoot exposed.');
    } else {
      const buttons = shadowRoot.querySelectorAll('button').length;
      const inputs = shadowRoot.querySelectorAll('input,textarea').length;
      setShadowInfo(`Open shadowRoot: ${buttons} button(s), ${inputs} input(s).`);
    }

    addLog('info', 'Introspection refreshed.', {
      tagName: widget.tagName,
      customElementDefined: !!customElements.get('elevenlabs-convai'),
      attributes: Object.fromEntries(Array.from(widget.attributes).map((attr) => [attr.name, attr.value])),
      callable,
    });
  }, [addLog]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    const listeners = EVENT_NAMES.map((eventName) => {
      const handler = (event: Event) => {
        addLog('event', `Widget event: ${event.type}`, serializeEvent(event));
      };
      widget.addEventListener(eventName, handler);
      return () => widget.removeEventListener(eventName, handler);
    });

    const timer = window.setTimeout(refreshIntrospection, 750);
    addLog('info', 'Widget probe mounted.');

    return () => {
      window.clearTimeout(timer);
      listeners.forEach((remove) => remove());
    };
  }, [addLog, refreshIntrospection, useSignedUrl, signedUrl, agentId]);

  const callMethod = useCallback(async (methodName: string, args: unknown[] = []) => {
    const widget = widgetRef.current as any;
    if (!widget) {
      addLog('error', 'Widget element is not mounted.');
      return;
    }

    if (!methodName || typeof widget[methodName] !== 'function') {
      addLog('error', `Method not available: ${methodName || '(none selected)'}`);
      return;
    }

    try {
      addLog('info', `Calling ${methodName}()`, { args });
      const result = await widget[methodName](...args);
      addLog('info', `${methodName}() resolved.`, result);
      refreshIntrospection();
    } catch (error) {
      addLog('error', `${methodName}() failed.`, error instanceof Error ? error.message : error);
    }
  }, [addLog, refreshIntrospection]);

  const clickShadowButton = useCallback(() => {
    const widget = widgetRef.current;
    const shadowRoot = widget?.shadowRoot;
    if (!shadowRoot) {
      addLog('error', 'No open shadowRoot is available for button fallback.');
      return;
    }

    const button = shadowRoot.querySelector('button') as HTMLButtonElement | null;
    if (!button) {
      addLog('error', 'Open shadowRoot has no button to click.');
      return;
    }

    button.click();
    addLog('info', 'Clicked first button inside open shadowRoot.');
  }, [addLog]);

  const fetchSignedUrl = useCallback(async () => {
    const callId = `widget_probe_${Date.now()}`;
    try {
      addLog('info', 'Requesting signed URL through /api/webrtc/signal.', { internalAgentId, callId });
      const response = await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'get-token',
          callId,
          agentId: internalAgentId,
          userId: 'widget-probe',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        addLog('error', 'Signed URL request failed.', data);
        return;
      }

      setSignedUrl(data.signedUrl || '');
      if (data.elevenLabsAgentId) {
        setAgentId(data.elevenLabsAgentId);
      }
      addLog('info', 'Signed URL received.', {
        hasSignedUrl: Boolean(data.signedUrl),
        elevenLabsAgentId: data.elevenLabsAgentId,
        agentName: data.agentName,
      });
    } catch (error) {
      addLog('error', 'Signed URL request crashed.', error instanceof Error ? error.message : error);
    }
  }, [addLog, internalAgentId]);

  const containerClass = {
    visible: 'relative rounded-xl border border-amber-100/20 bg-black/25 p-4',
    offscreen: 'pointer-events-auto absolute -left-[10000px] top-0 h-[640px] w-[420px]',
    transparent: 'relative rounded-xl border border-amber-100/20 bg-black/25 p-4 opacity-0',
    'display-none': 'hidden',
  }[visibilityMode];

  const widgetElement = useMemo(() => {
    return createElement('elevenlabs-convai', widgetProps);
  }, [widgetProps]);

  return (
    <div className="switchboard-shell min-h-screen px-4 py-8 text-amber-50">
      <main className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[380px_1fr]">
        <section className="operator-panel rounded-[1.5rem] p-5">
          <div className="operator-label mb-4 inline-flex rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wide">
            Widget Probe
          </div>
          <h1 className="text-2xl font-bold">ElevenLabs widget control spike</h1>
          <p className="mt-2 text-sm leading-6 text-amber-100/65">
            This page tests what the real custom element exposes at runtime before we wire it into ActiveCall.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-100/45">Public agent ID</span>
              <input
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className="paper-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-100/45">Internal agent key for signed URL</span>
              <input
                value={internalAgentId}
                onChange={(event) => setInternalAgentId(event.target.value)}
                className="paper-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-100/45">Signed URL</span>
              <textarea
                value={signedUrl}
                onChange={(event) => setSignedUrl(event.target.value)}
                rows={4}
                className="paper-input mt-1 w-full rounded-lg border px-3 py-2 text-xs"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fetchSignedUrl}
                className="rounded-lg border border-amber-100/15 bg-amber-100/10 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-100/15"
              >
                Fetch Signed URL
              </button>
              <button
                type="button"
                onClick={() => setUseSignedUrl((current) => !current)}
                className="rounded-lg border border-amber-100/15 bg-amber-100/10 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-100/15"
              >
                {useSignedUrl ? 'Using Signed URL' : 'Using Agent ID'}
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-100/45">Visibility mode</span>
              <select
                value={visibilityMode}
                onChange={(event) => setVisibilityMode(event.target.value as VisibilityMode)}
                className="paper-input mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="visible">visible</option>
                <option value="offscreen">offscreen</option>
                <option value="transparent">transparent</option>
                <option value="display-none">display:none</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-5">
          <div className="operator-panel rounded-[1.5rem] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Mounted widget</h2>
                <p className="text-sm text-amber-100/55">
                  Current source: {useSignedUrl && signedUrl.trim() ? 'signed-url' : 'agent-id'}
                </p>
              </div>
              <button
                type="button"
                onClick={refreshIntrospection}
                className="rounded-lg border border-amber-100/15 bg-amber-100/10 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-100/15"
              >
                Refresh Introspection
              </button>
            </div>

            <div className={containerClass}>
              <div>
                {widgetElement}
              </div>
            </div>
          </div>

          <div className="operator-panel rounded-[1.5rem] p-5">
            <h2 className="mb-4 text-lg font-bold">Controls</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <ControlBlock
                title="Start"
                value={selectedStartMethod}
                methods={methodNames}
                candidates={START_METHODS}
                onChange={setSelectedStartMethod}
                onRun={() => callMethod(selectedStartMethod)}
              />
              <ControlBlock
                title="End"
                value={selectedEndMethod}
                methods={methodNames}
                candidates={END_METHODS}
                onChange={setSelectedEndMethod}
                onRun={() => callMethod(selectedEndMethod)}
              />
              <ControlBlock
                title="Mute"
                value={selectedMuteMethod}
                methods={methodNames}
                candidates={MUTE_METHODS}
                onChange={setSelectedMuteMethod}
                onRun={() => {
                  if (selectedMuteMethod === 'setMicMuted') {
                    void callMethod(selectedMuteMethod, [true]);
                  } else {
                    void callMethod(selectedMuteMethod);
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={clickShadowButton}
              className="mt-3 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-500/15"
            >
              Fallback: click first shadow button
            </button>
          </div>

          <div className="operator-panel rounded-[1.5rem] p-5">
            <h2 className="mb-3 text-lg font-bold">Runtime contract</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoList title="Callable methods" items={methodNames} />
              <InfoList title="Own keys" items={ownKeys} />
              <div className="rounded-xl border border-amber-100/10 bg-black/25 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-100/45">Shadow DOM</p>
                <p className="mt-2 text-sm text-amber-100/70">{shadowInfo}</p>
              </div>
            </div>
          </div>

          <div className="operator-panel rounded-[1.5rem] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Event log</h2>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="rounded-lg border border-amber-100/15 bg-black/20 px-3 py-1.5 text-xs font-bold text-amber-100/65 hover:text-amber-50"
              >
                Clear
              </button>
            </div>
            <div className="max-h-96 space-y-2 overflow-auto rounded-xl border border-amber-100/10 bg-black/30 p-3">
              {logs.length === 0 ? (
                <p className="text-sm text-amber-100/45">No events yet.</p>
              ) : logs.map((log, index) => (
                <div key={`${log.at}-${index}`} className="rounded-lg border border-amber-100/10 bg-[#17100d]/85 p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-amber-100/40">{log.at}</span>
                    <span className={log.type === 'error' ? 'text-red-300' : log.type === 'event' ? 'text-emerald-300' : 'text-amber-200'}>
                      {log.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-amber-50">{log.message}</p>
                  {log.data !== undefined && (
                    <pre className="mt-2 overflow-auto rounded-md bg-black/35 p-2 text-xs text-amber-100/65">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ControlBlock({
  title,
  value,
  methods,
  candidates,
  onChange,
  onRun,
}: {
  title: string;
  value: string;
  methods: string[];
  candidates: string[];
  onChange: (value: string) => void;
  onRun: () => void;
}) {
  const options = [...new Set([...candidates, ...methods])];

  return (
    <div className="rounded-xl border border-amber-100/10 bg-black/25 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-100/45">{title}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="paper-input mt-2 w-full rounded-lg border px-3 py-2 text-xs"
      >
        <option value="">No method detected</option>
        {options.map((method) => (
          <option key={method} value={method}>
            {method}{methods.includes(method) ? '' : ' (candidate)'}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRun}
        className="mt-2 w-full rounded-lg border border-amber-100/15 bg-amber-100/10 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-100/15"
      >
        Run
      </button>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-amber-100/10 bg-black/25 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-100/45">{title}</p>
      <div className="mt-2 max-h-40 overflow-auto text-xs text-amber-100/65">
        {items.length === 0 ? (
          <p>None detected.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
