'use client';

import { useReducer } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, FileText, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { deskStudyReducer, initialDeskStudy, isStudyQuantityValid, type DeskStudyStage } from '@/lib/desk-study';
import { DeskInstrument } from './DeskInstrument';
import styles from './DeskStudy.module.css';
import { HouseMark as SharedHouseMark } from './HouseMark';

const STAGES: { id: DeskStudyStage; label: string; number: string }[] = [
  { id: 'arrival', label: 'Arrival', number: '01' },
  { id: 'conversation', label: 'Conversation', number: '02' },
  { id: 'confirmation', label: 'Confirmation', number: '03' },
];

function HouseMark({ small = false }: { small?: boolean }) {
  return <SharedHouseMark small={small} className={small ? styles.smallMark : styles.houseMark} />;
}

export function DeskStudy() {
  const [state, dispatch] = useReducer(deskStudyReducer, initialDeskStudy);
  const { stage, quantity, side, acknowledged } = state;
  const validQuantity = isStudyQuantityValid(quantity);
  const arrival = stage === 'arrival';
  const conversation = stage === 'conversation';
  const stageLabel = STAGES.find(item => item.id === stage)!.label;

  return (
    <div className={styles.study} data-stage={stage}>
      <div className={styles.room} aria-hidden="true">
        <div className={styles.window}><i /><i /><i /><i /><i /></div>
        <div className={styles.wallLines} />
        <div className={styles.lightPool} />
      </div>

      <header className={styles.masthead}>
        <button type="button" onClick={() => dispatch({ type: 'reset' })} className={styles.brand} aria-label="Claflin desk study, start again">
          <HouseMark />
          <span><strong>CLAFLIN</strong><small>THE PRIVATE DESK</small></span>
        </button>
        <div className={styles.headerNote}><span />Independent thinking.<br />A direct line.</div>
        <Link href="/" prefetch={false} className={styles.currentApp}>Current app <ArrowUpRight size={15} /></Link>
      </header>

      <div className={styles.studyBar}>
        <div className={styles.studyLabel}><span className={styles.previewDot} />DESIGN STUDY <span> / </span> NOT A LIVE SERVICE</div>
        <nav className={styles.stageNav} aria-label="Explore design study states">
          {STAGES.map(item => (
            <button key={item.id} type="button" aria-pressed={stage === item.id} onClick={() => dispatch({ type: 'stage', stage: item.id })}>
              <span>{item.number}</span>{item.label}
            </button>
          ))}
        </nav>
      </div>

      <main id="main-content" className={styles.main}>
        <p className={styles.srOnly} role="status">{stageLabel} preview. No microphone, live data, orders, or payments.</p>
        <section className={styles.composition} aria-labelledby="desk-heading">
          <div className={styles.ghostWord} aria-hidden="true">C &amp; Co.</div>
          <div className={styles.introduction} key={stage}>
            <div className={styles.eyebrow}><span className={styles.shortRule} />{arrival ? 'YOUR SEAT AT THE DESK' : conversation ? 'A CONVERSATION WITH HETTY' : 'BEFORE ANYTHING IS RECORDED'}</div>
            <h1 id="desk-heading" className={styles.headline}>
              {arrival ? <>Good judgment.<br /><span>On the line.</span></> : conversation ? <>Let’s look<br /><span>closer.</span></> : <>Your instruction.<br /><span>Your decision.</span></>}
            </h1>
            <p className={styles.description}>
              {arrival
                ? 'A little perspective before your next move. Bring Hetty a stock, a question, or a decision worth thinking through.'
                : conversation
                  ? 'Not another stream of signals. A considered exchange, with room for questions and a clear account of what comes next.'
                  : 'Nothing assumed. Nothing rushed. Review the details, make a correction, and decide for yourself.'}
            </p>

            {arrival ? (
              <>
                <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'stage', stage: 'conversation' })}>
                  <Phone size={17} strokeWidth={1.5} /><span>Meet Hetty <small>Preview the conversation</small></span><ArrowRight size={18} />
                </button>
                <p className={styles.actionNote}>An AI broker. A human pace.<br />This study is silent and does not open your microphone.</p>
              </>
            ) : conversation ? (
              <>
                <div className={styles.dialogue}>
                  <span className={styles.dialogueLabel}>HETTY <span> / SCRIPTED EXCERPT</span></span>
                  <blockquote>“Before we talk about upside, let’s consider what you can afford to lose.”</blockquote>
                  <div className={styles.voiceTrace} aria-hidden="true">
                    {[8, 14, 24, 12, 30, 19, 36, 23, 14, 28, 18, 11, 21, 9, 16, 7].map((height, index) => <i key={index} style={{ height }} />)}
                    <span>ILLUSTRATIVE · NO AUDIO</span>
                  </div>
                </div>
                <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'stage', stage: 'confirmation' })}>
                  <FileText size={18} strokeWidth={1.5} /><span>Review an instruction <small>Open the example paper ticket</small></span><ArrowRight size={18} />
                </button>
                <button type="button" className={styles.textAction} onClick={() => dispatch({ type: 'reset' })}><ArrowLeft size={14} />Leave the preview</button>
              </>
            ) : (
              <div className={styles.confirmationAside}>
                <ShieldCheck size={24} strokeWidth={1.25} />
                <div><strong>Deliberate by design.</strong><p>This is an editable example, not an order form connected to a broker. Acknowledging it changes this preview only.</p></div>
                <button type="button" className={styles.textAction} onClick={() => dispatch({ type: 'stage', stage: 'conversation' })}><ArrowLeft size={14} />Back to the conversation</button>
              </div>
            )}
          </div>

          <DeskInstrument stage={stage} label="DESIGN PREVIEW / NO LIVE CONNECTION" />
          <div className={styles.instrumentCaption} aria-hidden="true"><span>CLAFLIN / DESK INSTRUMENT</span><i />ENAMEL · BRASS · LIGHT</div>

          <aside className={styles.paperPosition} aria-label={arrival ? 'Meet your broker' : conversation ? 'Working note preview' : 'Example paper instruction'}>
            <div className={styles.paper} data-acknowledged={acknowledged}>
              <div className={styles.paperTop}><HouseMark small /><span>CLAFLIN &amp; CO.<small>{arrival ? 'A NOTE OF INTRODUCTION' : conversation ? 'FROM THE WORKING DESK' : 'PAPER INSTRUCTION / EXAMPLE'}</small></span><span className={styles.paperNumber}>{arrival ? 'I' : conversation ? 'II' : 'III'}</span></div>

              {arrival ? (
                <div className={styles.introNote}>
                  <p className={styles.paperKicker}>YOUR AI BROKER</p>
                  <h2>Hetty.</h2>
                  <p>Independent in thought.<br />Conservative with your capital.</p>
                  <div className={styles.noteRule} />
                  <p className={styles.paperSmall}>Research first. Questions welcome.<br />Every paper instruction is yours to confirm.</p>
                  <span className={styles.signature}>At your service.</span>
                </div>
              ) : conversation ? (
                <div className={styles.workingNote}>
                  <p className={styles.paperKicker}>THE QUESTION BEFORE US</p>
                  <h2>Conviction is not<br />a position size.</h2>
                  <p className={styles.paperSmall}>A fictional discussion about Example Co., used only to explore the desk experience.</p>
                  <dl className={styles.noteEntries}>
                    <div><dt>Consider</dt><dd>How much risk belongs in one idea?</dd></div>
                    <div><dt>Establish</dt><dd>The evidence behind the thesis.</dd></div>
                    <div><dt>Decide</dt><dd>Whether a paper instruction is useful.</dd></div>
                  </dl>
                  <div className={styles.sourceNote}><span>INFORMATION STATUS</span>No market data loaded. Sources and retrieval times belong here when connected.</div>
                </div>
              ) : (
                <form className={styles.ticket} onSubmit={event => { event.preventDefault(); dispatch({ type: 'acknowledge' }); }}>
                  <div className={styles.ticketTitle}><h2>For your review.</h2><span>ILLUSTRATIVE ONLY</span></div>
                  <div className={styles.security}><strong>Example Co.</strong><span>FICTIONAL INSTRUMENT · EXMPL</span></div>
                  <div className={styles.ticketInputs}>
                    <fieldset><legend>Instruction</legend><div className={styles.sideSelector}>
                      {(['buy', 'sell'] as const).map(option => <label key={option}><input type="radio" name="side" value={option} checked={side === option} onChange={() => dispatch({ type: 'side', side: option })} /><span>{option === 'buy' ? 'Buy' : 'Sell'}</span></label>)}
                    </div></fieldset>
                    <label className={styles.quantityLabel}>Shares<input type="text" inputMode="numeric" pattern="[1-9][0-9]{0,3}" maxLength={4} value={quantity} onChange={event => dispatch({ type: 'quantity', quantity: event.target.value })} aria-invalid={!validQuantity} aria-describedby={!validQuantity ? 'quantity-error' : 'quantity-hint'} required /></label>
                  </div>
                  <p id="quantity-hint" className={styles.quantityHint}>Example quantity: 1–1,000 whole shares.</p>
                  {!validQuantity && <p id="quantity-error" className={styles.inputError}>Enter a whole number from 1 to 1,000.</p>}
                  <dl className={styles.ticketFacts}><div><dt>Price</dt><dd>Not quoted</dd></div><div><dt>Execution</dt><dd>None — preview only</dd></div><div><dt>Call charge</dt><dd>No call. No charge.</dd></div></dl>
                  <button type="submit" className={styles.paperAction} disabled={!validQuantity || acknowledged}>{acknowledged ? <Check size={17} /> : <ShieldCheck size={17} />}<span>{acknowledged ? 'Preview acknowledged' : 'Acknowledge preview'}</span>{!acknowledged && <ArrowRight size={17} />}</button>
                  <p className={styles.receiptStatus} role="status">{acknowledged ? `${side === 'buy' ? 'Buy' : 'Sell'} ${quantity} shares acknowledged in this preview only. Nothing saved or submitted.` : 'No order will be placed. Nothing is saved. Editing any detail resets the acknowledgement.'}</p>
                </form>
              )}
              <div className={styles.paperFoot}><span>{arrival ? 'PERSPECTIVE, NOT PRESSURE.' : conversation ? 'A NOTE, NOT A RECOMMENDATION.' : 'YOUR WORK ≠ YOUR CALL RECEIPT.'}</span><span className={styles.tinyDiamond} /></div>
            </div>
          </aside>
        </section>

        <section className={styles.housePrinciples} aria-label="The Claflin approach">
          <div className={styles.principleLead}><ArrowDown size={16} /><span>A considered approach</span></div>
          <p><span>01 / THE RELATIONSHIP</span>A familiar voice. Independent thought.</p>
          <p><span>02 / THE WORK</span>Evidence before conviction.</p>
          <p><span>03 / THE BOUNDARY</span>Paper trading. Explicit decisions.</p>
        </section>
      </main>

      <footer className={styles.footer}>
        <details className={styles.studyDetails}><summary>About this study</summary><p>An original Deco-futurist composition exploring arrival, conversation, and confirmation. All dialogue and instruments are fictional. No live quotes, microphone access, wallet connection, persistence, or transactions. Three.js enhances the desk instrument; all controls remain standard HTML. Reduced motion is supported.</p></details>
        <span>FORM FOLLOWS JUDGMENT.</span>
        <button type="button" onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={13} />Reset study</button>
      </footer>
    </div>
  );
}
