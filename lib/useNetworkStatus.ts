'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
    isOnline: boolean;
    isSlowConnection: boolean;
    connectionType: string | null;
}

/**
 * PERFORMANT: Adaptive network status detection
 * Provides offline detection and connection quality monitoring
 */
export function useNetworkStatus(): NetworkStatus {
    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isSlowConnection: false,
        connectionType: null,
    });

    const updateStatus = useCallback(() => {
        const isOnline = navigator.onLine;
        let isSlowConnection = false;
        let connectionType: string | null = null;

        // Check connection quality if available
        const connection = (navigator as any).connection ||
            (navigator as any).mozConnection ||
            (navigator as any).webkitConnection;

        if (connection) {
            connectionType = connection.effectiveType || connection.type || null;
            // Consider 2G and slow-2g as slow connections
            isSlowConnection = connectionType === '2g' || connectionType === 'slow-2g';
        }

        setStatus({ isOnline, isSlowConnection, connectionType });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Initial status
        updateStatus();

        // Listen for online/offline events
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Listen for connection changes
        const connection = (navigator as any).connection;
        if (connection) {
            connection.addEventListener('change', updateStatus);
        }

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
            if (connection) {
                connection.removeEventListener('change', updateStatus);
            }
        };
    }, [updateStatus]);

    return status;
}

/**
 * Hook for retry logic with exponential backoff
 * CLEAN: Separated retry logic from network detection
 */
export function useRetryWithBackoff() {
    const retry = useCallback(async <T>(
        fn: () => Promise<T>,
        options: {
            maxRetries?: number;
            baseDelay?: number;
            maxDelay?: number;
            onRetry?: (attempt: number, error: Error) => void;
        } = {}
    ): Promise<T> => {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            onRetry,
        } = options;

        let lastError: Error;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt === maxRetries) {
                    throw lastError;
                }

                // Exponential backoff with jitter
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
                    maxDelay
                );

                onRetry?.(attempt, lastError);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }, []);

    return { retry };
}