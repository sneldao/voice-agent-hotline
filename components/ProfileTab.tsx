'use client';

import { User, Wallet, LogOut, ExternalLink } from 'lucide-react';
import { ProfileSkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { Button, Card, Avatar } from '@/components/ui';
import { DelegationPanel } from '@/components/DelegationPanel';

interface ProfileTabProps {
  balance: number;
  address?: string | null;
  isLoading?: boolean;
  onDisconnect?: () => void;
}

export function ProfileTab({ balance, address, isLoading, onDisconnect }: ProfileTabProps) {
  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'Not connected';

  if (isLoading) return <ProfileSkeleton />;

  if (!address) {
    return (
      <EmptyState
        type="calls"
        title="Wallet Not Connected"
        description="Connect your wallet to view your profile and balance"
      />
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar size="xl" online={!!address} className="bg-gradient-to-br from-cyan-500 to-blue-500">
          <User className="w-8 h-8" />
        </Avatar>
        <div>
          <h2 className="text-xl font-bold font-mono">{displayAddress}</h2>
          <button
            onClick={() => navigator.clipboard?.writeText(address)}
            className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
          >
            Copy full address
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <Card variant="gradient" className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20" />
          <div className="relative p-6">
            <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
              <Wallet className="w-4 h-4" /> Balance
            </div>
            <div className="text-4xl font-bold text-white mb-4">${(balance || 0).toFixed(2)}</div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 bg-white/10 border-white/20 hover:bg-white/20"
                onClick={() => window.open('https://app.uniswap.org/#/swap?outputCurrency=0x765DE816845861e75A25fCA122bb6898B8B1282a&chain=celo', '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Add Funds
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Delegation Panel */}
      <DelegationPanel />

      {/* Disconnect */}
      {onDisconnect && (
        <Button
          variant="ghost"
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={onDisconnect}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect Wallet
        </Button>
      )}
    </div>
  );
}
