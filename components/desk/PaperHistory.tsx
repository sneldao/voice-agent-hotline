'use client';

import type { useTradingDesk } from '@/lib/trading/useTradingDesk';
import styles from './WorkingDesk.module.css';

export function PaperHistory({ desk }: { desk: ReturnType<typeof useTradingDesk> }) {
  const { records, historyReady, storageError, loadHistory, edit, removeRecord } = desk;
  return <section id="paper-history" className={styles.history} aria-labelledby="history-title">
    <div><p className={styles.eyebrow}>RETURN TO YOUR WORK</p><h2 id="history-title">Your paper record.</h2><p>Saved in this browser. Simulations, not live positions.</p></div>
    {storageError && <div role="alert"><p>{storageError}</p><button type="button" onClick={loadHistory}>Retry reading history</button></div>}
    {historyReady && records.length === 0 && <p className={styles.empty}>Your first paper trade will appear here when you choose to record it.</p>}
    {records.map(record => <article key={record.id} className={styles.record}>
      <div><span>PAPER TRADE · {new Date(record.createdAt).toLocaleString()}</span><h3>{record.quote.inputAmount} {record.quote.inputSymbol} → {record.quote.outputAmount} {record.quote.outputSymbol}</h3></div>
      <button type="button" onClick={() => { edit(record.quote.intent); document.getElementById('stock')?.focus(); document.getElementById('instruction')?.scrollIntoView({ block: 'start' }); }}>Use as a new draft</button>
      <details><summary>Record details</summary>
        <p>{record.quote.assumptions}</p>
        <p>Base block {record.quote.blockNumber} · Pool <code>{record.quote.poolAddress}</code> · Quote {record.id}</p>
        <button type="button" onClick={() => { if (window.confirm('Delete this paper record from this browser? This cannot be undone.')) removeRecord(record.id); }}>Delete this paper record</button>
      </details>
    </article>)}
  </section>;
}
