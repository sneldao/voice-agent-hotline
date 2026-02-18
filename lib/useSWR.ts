'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useUserBalance(address?: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? `/api/users/${address}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 5000,
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
  });

  return {
    agents: data?.agents || [],
    isLoading,
    error,
    mutate,
  };
}
