'use client';

import useSWR from 'swr';
import { apiUrl } from './api';
import { apiFetch, ApiError, type ApiErrorKind } from './api-client';
import type { Agent } from './types';

/**
 * Shared fetcher: routes every request through the resilient api client
 * (timeout + backoff retries + typed errors). A 404 means "does not exist
 * yet" for several of our resources, so it resolves to null instead of
 * throwing — callers treat it as empty state, not failure.
 */
const fetcher = async <T = unknown>(url: string): Promise<T | null> => {
  try {
    return await apiFetch<T>(url);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

/**
 * Outer retry loop (apiFetch already retried internally). Capped, gently
 * backed-off, and never for 4xxs that won't heal themselves.
 */
function onErrorRetry(
  error: unknown,
  _key: string,
  _config: unknown,
  revalidate: (opts?: { retryCount?: number }) => void,
  { retryCount }: { retryCount: number },
) {
  if (error instanceof ApiError && error.kind === 'http' && !error.retryable) return;
  if (retryCount >= 5) return;
  const delay = Math.min(1000 * 2 ** retryCount, 15_000);
  setTimeout(() => revalidate({ retryCount }), delay);
}

interface HookError {
  message: string;
  kind: ApiErrorKind | null;
}

function toHookError(error: unknown): HookError | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    return { message: error.friendlyMessage, kind: error.kind };
  }
  return {
    message: error instanceof Error ? error.message : 'Request failed',
    kind: null,
  };
}

export function useUserBalance(address?: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    address ? apiUrl(`/api/users/${address}`) : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      keepPreviousData: true,
      onErrorRetry,
    }
  );

  const hookError = toHookError(error);

  return {
    balance: (data as { balance?: number } | null)?.balance || 0,
    isLoading,
    isError: hookError,
    isRetrying: Boolean(error) && isValidating,
    mutate,
  };
}

interface UseAgentsParams {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface AgentsResponse {
  agents?: Agent[];
  total?: number;
  hasMore?: boolean;
}

export function useAgents(params?: UseAgentsParams) {
  const search = params?.search || '';
  const category = params?.category || '';
  const page = params?.page || 1;
  const limit = params?.limit || 20;

  const queryParts: string[] = ['capability=all'];
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
  if (category && category !== 'all') queryParts.push(`category=${encodeURIComponent(category)}`);
  queryParts.push(`page=${page}`);
  queryParts.push(`limit=${limit}`);

  const key = apiUrl(`/api/agents?${queryParts.join('&')}`);

  const { data, error, isLoading, isValidating, mutate } = useSWR<AgentsResponse | null>(key, fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    dedupingInterval: search ? 2000 : 10000,
    keepPreviousData: true,
    onErrorRetry,
  });

  const hookError = toHookError(error);

  return {
    agents: data?.agents || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    /** Friendly, product-voice message — safe to render directly. */
    error: hookError?.message ?? null,
    /** Structured failure mode so the UI can adapt (offline vs server snag). */
    errorKind: hookError?.kind ?? null,
    /** True while a retry/background revalidation is in flight after an error. */
    isRetrying: Boolean(error) && isValidating,
    mutate,
  };
}
