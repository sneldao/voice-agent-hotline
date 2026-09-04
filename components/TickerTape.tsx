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

export function TickerTape() {
  return (
    <div className="ticker-tape" role="marquee" aria-label="Yesterday's closing quotations">
      <div className="ticker-tape__track">
        {[0, 1].map((copy) => (
          <div className="ticker-tape__group" key={copy} aria-hidden={copy === 1}>
            {TAPE.map(({ sym, price, delta, up }) => (
              <span className="ticker-tape__quote" key={`${copy}-${sym}`}>
                <span className="ticker-tape__sym">{sym}</span>
                <span className="ticker-tape__price">{price}</span>
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
