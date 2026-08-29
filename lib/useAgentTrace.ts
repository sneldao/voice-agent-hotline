'use client';

import useSWR from 'swr';
import { apiUrl } from '@/lib/api';
import type { TraceStep } from '@/components/AgentTrace';

/**
 * Fetch the tool-execution trace for a finished call.
 * Fails soft: any error or missing record returns an empty step list so the
 * consumer renders the honest "no trace" state instead of blocking the UI.
 */
const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return { steps: [] as TraceStep[] };
    return await res.json();
  } catch {
    return { steps: [] as TraceStep[] };
  }
};

export function useAgentTrace(callId?: string | null) {
  const key = callId ? apiUrl(`/api/calls/${encodeURIComponent(callId)}/trace`) : null;

  const { data, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    errorRetryCount: 0,
  });

  return {
    steps: (data?.steps ?? []) as TraceStep[],
    isLoading,
  };
}