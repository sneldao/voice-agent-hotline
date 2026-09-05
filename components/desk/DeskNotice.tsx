import type { ReactNode } from 'react';
import Link from 'next/link';
import { HouseMark } from './HouseMark';
import styles from './WorkingDesk.module.css';

export function DeskNotice({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <main id="main-content" className={`${styles.workspace} ${styles.noticePage}`}>
    <div><Link href="/" className={styles.brand}><HouseMark className={styles.houseMark} /><span><strong>CLAFLIN</strong><small>A CONSIDERED APPROACH</small></span></Link>
      <h1>{title}</h1><div className={styles.noticeCopy}>{children}</div>
      <div className={styles.noticeActions}>{action}<Link href="/">Return to the desk</Link></div>
    </div>
  </main>;
}
