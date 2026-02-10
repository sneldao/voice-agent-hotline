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

// Export toast for components
export { toast };

// Convenience toast functions
export function showSuccess(message: string) {
  toast.success(message);
}

export function showError(message: string) {
  toast.error(message);
}

export function showInfo(message: string) {
  toast.info(message);
}

export function showWarning(message: string) {
  toast.warning(message);
}

export function showLoading(message: string) {
  return toast.loading(message);
}

export function showDismiss(id?: string | number) {
  toast.dismiss(id);
}

export function showCopied() {
  toast.success('Copied to clipboard!', {
    description: 'Address copied successfully',
  });
}

export function showRatingSubmitted() {
  toast.success('Rating submitted!', {
    description: 'Thanks for your feedback',
  });
}

export function showAgentCreated(name: string) {
  toast.success('Agent created!', {
    description: `${name} is now live`,
  });
}

export function showWalletConnected(address: string) {
  toast.success('Wallet connected!', {
    description: `${address.slice(0, 6)}...${address.slice(-4)}`,
  });
}

export function showCallStarted(agentName: string) {
  toast.info('Connecting...', {
    description: `Starting call with ${agentName}`,
  });
}

export function showCallEnded(duration: string, cost: string) {
  toast.success('Call ended', {
    description: `${duration} • ${cost}`,
  });
}

export function showInsufficientFunds() {
  toast.error('Insufficient balance', {
    description: 'Please add funds to continue',
  });
}

export function showPaymentPending() {
  toast.loading('Processing payment...');
}

export function showPaymentComplete(amount: string) {
  toast.success('Payment complete!', {
    description: `Sent ${amount}`,
  });
}

// Convenience hooks for specific actions
export function useNotifications() {
  const { success, error, info, warning, loading, dismiss } = useToast();

  return {
    // Call notifications
    callStarted: () => showCallStarted('agent'),
    callConnected: () => success('Connected!'),
    callEnded: () => info('Call ended'),
    callFailed: (reason?: string) => error(reason || 'Call failed'),

    // Payment notifications
    paymentProcessing: () => showPaymentPending(),
    paymentSuccess: (amount: string) => showPaymentComplete(amount),
    paymentFailed: (reason?: string) => error(reason || 'Payment failed'),
    insufficientFunds: () => showInsufficientFunds(),

    // Agent notifications
    agentOnline: (name: string) => success(`${name} is now online`),
    agentOffline: (name: string) => info(`${name} went offline`),

    // General
    copiedToClipboard: () => showCopied(),
    refreshComplete: () => success('List refreshed'),
    agentCreated: (name: string) => showAgentCreated(name),
    walletConnected: (address: string) => showWalletConnected(address),
    
    error: error,
    success: success,
    warning: warning,
    info: info,
    loading: loading,
    dismiss: dismiss,
  };
}
