'use client';

import useSWR from 'swr';
import type { Agent } from './types';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserBalance(address?: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? `/api/users/${address}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      staleTime: 5000,
      keepPreviousData: true,
    }
  );

  return {
    balance: data?.balance || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR('/api/agents?capability=all', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    staleTime: 10000,
    keepPreviousData: true,
  });

  return {
    agents: (data?.agents || []) as Agent[],
    isLoading,
    error,
    mutate,
  };
}
