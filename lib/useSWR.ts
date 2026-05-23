'use client';

import useSWR from 'swr';
import { apiUrl } from './api';
import type { Agent } from './types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    // Don't retry on 404 — user just doesn't exist yet
    if (res.status === 404) return null;
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
};

export function useUserBalance(address?: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? apiUrl(`/api/users/${address}`) : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      keepPreviousData: true,
      errorRetryCount: 2,
    }
  );

  return {
    balance: data?.balance || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

interface UseAgentsParams {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
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

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    dedupingInterval: search ? 2000 : 10000,
    staleTime: search ? 1000 : 10000,
    keepPreviousData: true,
  });

  return {
    agents: (data?.agents || []) as Agent[],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    error: error instanceof Error ? error.message : error ? 'Request failed' : null,
    mutate,
  };
}
