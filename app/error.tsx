'use client';

import { useEffect } from 'react';
import { Home, PhoneOutgoing } from 'lucide-react';
import { Mascot } from '@/components/Mascot';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 p-4 font-sans text-white">
      <div className="w-full max-w-md rounded-2xl border border-amber-100/10 bg-black/40 p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <Mascot mood="thinking" size={110} />
        </div>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-amber-100/55">
          Claflin · Broker desk
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-amber-50">
          The line went dead
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-amber-100/60">
          Something crackled and dropped the call on our end. Hetty has been
          paged — try ringing again.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[10px] text-amber-100/35">
            ref {error.digest}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:from-red-500 hover:to-amber-400 active:scale-[0.97]"
          >
            <PhoneOutgoing className="h-4 w-4" />
            Ring again
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-100/15 bg-amber-100/5 px-4 py-2.5 text-sm font-semibold text-amber-100/80 transition-colors hover:bg-amber-100/10"
          >
            <Home className="h-4 w-4" />
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
