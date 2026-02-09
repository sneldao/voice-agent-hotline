'use client';

import { toast } from 'sonner';

// Toast hooks for easy usage
export function useToast() {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
    loading: (message: string) => toast.loading(message),
    dismiss: (id?: string | number) => toast.dismiss(id),
  };
}

// Convenience hooks for specific actions
export function useNotifications() {
  const { success, error, info, warning, loading, dismiss } = useToast();

  return {
    // Call notifications
    callStarted: () => info('Connecting to agent...'),
    callConnected: () => success('Connected!'),
    callEnded: () => info('Call ended'),
    callFailed: (reason?: string) => error(reason || 'Call failed'),

    // Payment notifications
    paymentProcessing: () => loading('Processing payment...'),
    paymentSuccess: () => success('Payment complete!'),
    paymentFailed: (reason?: string) => error(reason || 'Payment failed'),
    insufficientFunds: () => warning('Insufficient balance'),

    // Agent notifications
    agentOnline: (name: string) => success(`${name} is now online`),
    agentOffline: (name: string) => info(`${name} went offline`),

    // General
    copiedToClipboard: () => success('Copied to clipboard'),
    refreshComplete: () => success('List refreshed'),
    error: error,
    success: success,
    warning: warning,
    info: info,
    loading: loading,
    dismiss: dismiss,
  };
}
