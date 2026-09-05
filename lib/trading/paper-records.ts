import { z } from 'zod';
import { estimateUsable, parseEstimate, sameIntent, type DeskState } from './workflow';
import type { QuoteEstimate } from './domain';

export interface PaperRecord {
  version: 1;
  id: string;
  mode: 'paper';
  createdAt: number;
  quote: QuoteEstimate;
}
export interface PaperStorage {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const PREFIX = 'claflin.paper.v1.';
const schema = z.object({ version: z.literal(1), id: z.string().min(1).max(100), mode: z.literal('paper'), createdAt: z.number().int().positive(), quote: z.unknown() }).strict();

function parseRecord(raw: string): PaperRecord {
  if (raw.length > 20000) throw new Error('Invalid paper record.');
  const parsed = schema.parse(JSON.parse(raw));
  const quote = parseEstimate(parsed.quote);
  if (parsed.id !== quote.id || !estimateUsable(quote, parsed.createdAt)) throw new Error('Invalid paper record.');
  return { ...parsed, quote };
}

export function loadPaperRecords(storage: PaperStorage): PaperRecord[] {
  const result: PaperRecord[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const raw = storage.getItem(key);
    if (!raw) throw new Error('Paper record unavailable.');
    const record = parseRecord(raw);
    if (key !== PREFIX + record.id) throw new Error('Paper record identity mismatch.');
    result.push(record);
    if (result.length > 100) throw new Error('Paper history exceeds the supported limit.');
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function deletePaperRecord(storage: PaperStorage & { removeItem(key: string): void }, id: string): void {
  if (!/^[\w-]{1,100}$/.test(id)) throw new Error('Invalid record ID.');
  storage.removeItem(PREFIX + id);
  if (storage.getItem(PREFIX + id) !== null) throw new Error('Could not delete the paper record.');
}

export function savePaperRecord(storage: PaperStorage, state: DeskState, now: number): PaperRecord {
  if (state.stage !== 'review' || !state.quote || !sameIntent(state.draft, state.quote.intent) || !estimateUsable(state.quote, now)) throw new Error('Request and review a fresh estimate before recording.');
  const quote = parseEstimate(state.quote);
  const key = PREFIX + quote.id;
  const existing = storage.getItem(key);
  if (existing) {
    const record = parseRecord(existing);
    if (JSON.stringify(record.quote) !== JSON.stringify(quote)) throw new Error('Paper record identity conflict.');
    return record;
  }
  if (loadPaperRecords(storage).length >= 100) throw new Error('Paper history is full. Export or clear records before adding more.');
  const record: PaperRecord = { version: 1, mode: 'paper', id: quote.id, createdAt: now, quote };
  const serialized = JSON.stringify(record);
  storage.setItem(key, serialized);
  if (storage.getItem(key) !== serialized) throw new Error('Paper record could not be verified after saving.');
  return record;
}
