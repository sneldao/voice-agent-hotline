'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import {
  Wallet,
  Phone,
  User,
  Search,
  Star,
  Clock,
  CreditCard,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Menu,
  MoreVertical,
  Heart,
  Share2,
  History,
  LogOut,
  HelpCircle,
  Shield,
  Zap,
  Sparkles,
  Bookmark,
  Download,
} from 'lucide-react';

// Toast configuration
export function ToastProvider() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <Toaster
      position="bottom-center"
      theme={theme === 'dark' ? 'dark' : 'light'}
      toastOptions={{
        className: 'bg-gray-900 text-white border border-gray-800',
        duration: 3000,
      }}
    />
  );
}

// Toast helpers
export { toast };

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

// Loading toast
export function showLoading(message: string): string | number {
  return toast.loading(message);
}

export function dismissToast(id: string | number) {
  toast.dismiss(id);
}

// Icon exports
export {
  Wallet,
  Phone,
  User,
  Search,
  Star,
  Clock,
  CreditCard,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Menu,
  MoreVertical,
  Heart,
  Share2,
  History,
  LogOut,
  HelpCircle,
  Shield,
  Zap,
  Sparkles,
  Bookmark,
  Download,
};
