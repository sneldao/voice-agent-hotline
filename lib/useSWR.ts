'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserBalance(address?: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? `/api/users/${address}` : null,
    fetcher,
    {
      refreshInterval: 30000, // 30 seconds
      revalidateOnFocus: false, // Don't revalidate on focus (saves requests)
      dedupingInterval: 10000, // 10 seconds deduplication
      staleTime: 5000, // Consider data fresh for 5 seconds
      keepPreviousData: true, // Show previous data while loading
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
    refreshInterval: 60000, // 60 seconds
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    staleTime: 10000, // 10 seconds fresh
    keepPreviousData: true,
  });

  return {
    agents: data?.agents || [],
    isLoading,
    error,
    mutate,
  };
}
