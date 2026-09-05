'use client';

import { DeskNotice } from '@/components/desk/DeskNotice';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DeskNotice title="The desk couldn’t load." action={<button type="button" onClick={reset}>Try again</button>}>
    <p>Please try again. If you were preparing a paper trade, review a fresh estimate before recording it.</p>
    {error.digest && <p>Reference: {error.digest}</p>}
  </DeskNotice>;
}
