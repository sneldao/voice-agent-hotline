'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { intentFromSpeech } from '@/lib/trading/workflow';
import type { TradeIntent } from '@/lib/trading/domain';
import styles from './WorkingDesk.module.css';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export const VoiceIntent = memo(function VoiceIntent({ onApply, disabled }: { onApply(intent: TradeIntent): void; disabled: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  /* Browser speech recognition support is only available client-side. */
  useEffect(() => {
    const speech = window as SpeechWindow;
    setSupported(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    return () => {
      if (recognition.current) {
        recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.onend = null;
        recognition.current.abort();
      }
    };
  }, []);
  useEffect(() => { if (disabled) recognition.current?.abort(); }, [disabled]);
  function start() {
    const speech = window as SpeechWindow;
    const Constructor = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Constructor || listening) return;
    const input = new Constructor();
    input.lang = 'en-US'; input.continuous = false; input.interimResults = false;
    input.onresult = event => { setText(event.results[0]?.[0]?.transcript || ''); };
    input.onerror = () => { setError('Dictation was unavailable or permission was denied. Type your instruction instead.'); setListening(false); };
    input.onend = () => { setListening(false); recognition.current = null; };
    recognition.current = input;
    setError(null);
    try { input.start(); setListening(true); } catch { setError('Could not start dictation. Type your instruction instead.'); }
  }
  function apply() {
    try { onApply(intentFromSpeech(text)); setText(''); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Instruction not understood.'); }
  }
  return <details className={styles.voice}>
    <summary>Prefer to say it?</summary>
    <p>Dictate an instruction or write it below. This updates your draft; it is not a live conversation with Hetty.</p>
    <p>Microphone access starts only when you choose “Start dictation”. Your browser may send audio to its speech provider.</p>
    <p>Try “buy NVIDIA for 100 USDC” or “sell 0.5 NVIDIA tokens”.</p>
    {supported ? <button type="button" disabled={disabled} onClick={() => listening ? recognition.current?.abort() : start()}>{listening ? 'Stop dictation' : 'Start dictation'}</button> : <p>Voice dictation isn’t available in this browser. You can type the same instruction below.</p>}
    <label>Your instruction<textarea maxLength={160} value={text} onChange={e => setText(e.target.value)} disabled={disabled || listening} /></label>
    <button type="button" onClick={apply} disabled={disabled || listening || !text.trim()}>Use this instruction</button>
    <p>This replaces your draft and clears any previous estimate. Check the details before requesting a new estimate.</p>
    {error && <p role="alert">{error}</p>}
  </details>;
});
