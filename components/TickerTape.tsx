'use client';

/**
 * TickerTape — an ambient stock-quote ticker in the style of a 1920s
 * brokerage tape machine. Pure CSS marquee (single transform animation,
 * duplicated content for a seamless loop). Respects prefers-reduced-motion
 * by falling back to a static strip. No data source — period quotes only.
 */

const TAPE: Array<{ sym: string; price: string; delta: string; up: boolean }> = [
  { sym: 'AERO', price: '42⅞', delta: '+0⅛', up: true },
  { sym: 'BETH STL', price: '126¼', delta: '-⅜', up: false },
  { sym: 'COAL & IRON', price: '8⅝', delta: '+¼', up: true },
  { sym: 'CLAFLIN & CO', price: '970', delta: '+2½', up: true },
  { sym: 'GOLD FLD', price: '61⅜', delta: '-1¼', up: false },
  { sym: 'MOTOR WK', price: '37¾', delta: '+⅝', up: true },
  { sym: 'PULLMAN', price: '154½', delta: '-¼', up: false },
  { sym: 'RADIO', price: '88⅞', delta: '+3⅛', up: true },
  { sym: 'STEEL', price: '212¼', delta: '+1⅜', up: true },
  { sym: 'SUGAR', price: '96⅝', delta: '-½', up: false },
  { sym: 'TELEPHONE', price: '179', delta: '+¾', up: true },
  { sym: 'WEST UNION', price: '73⅜', delta: '-⅝', up: false },
];

export interface TapeLiveQuote {
  id: string;
  name: string;
  /** Calls started in the last hour (real data from /api/activity/live). */
  calls: number;
  /** Broker currently has an active call. */
  active: boolean;
}

/**
 * OdometerText — each character flips in once on mount (CSS `odometer-flip`),
 * staggered left-to-right like a mechanical counter settling. Runs once;
 * disabled under prefers-reduced-motion via CSS.
 */
function OdometerText({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span className="tabular-nums" aria-label={text}>
      {text.split('').map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          className="odometer-digit"
          style={{ animationDelay: `${delay + i * 45}ms` }}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export function TickerTape({ live }: { live?: TapeLiveQuote[] }) {
  const liveQuotes = (live ?? []).filter(q => q.active || q.calls > 0).slice(0, 6);
  return (
    <div className="ticker-tape" role="marquee" aria-label="Yesterday's closing quotations">
      <div className="ticker-tape__track">
        {[0, 1].map((copy) => (
          <div className="ticker-tape__group" key={copy} aria-hidden={copy === 1}>
            {liveQuotes.length > 0 && (
              <span className="ticker-tape__quote ticker-tape__quote--live-header">
                <span className="ticker-tape__sym">● LIVE WIRE</span>
              </span>
            )}
            {liveQuotes.map((q) => (
              <span className="ticker-tape__quote" key={`${copy}-live-${q.id}`}>
                <span className="ticker-tape__sym">{q.name.toUpperCase()}</span>
                <span className="ticker-tape__price">
                  <OdometerText text={String(q.calls)} delay={copy === 1 ? 400 : 0} />
                </span>
                <span className={`ticker-tape__delta ${q.active ? 'is-up' : ''}`}>
                  {q.active ? '● ON THE LINE' : '/ HR'}
                </span>
              </span>
            ))}
            {TAPE.map(({ sym, price, delta, up }) => (
              <span className="ticker-tape__quote" key={`${copy}-${sym}`}>
                <span className="ticker-tape__sym">{sym}</span>
                <span className="ticker-tape__price">
                  <OdometerText text={price} delay={(copy === 1 ? 400 : 0) + 600} />
                </span>
                <span className={`ticker-tape__delta ${up ? 'is-up' : 'is-down'}`}>
                  {up ? '▲' : '▼'} {delta}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
