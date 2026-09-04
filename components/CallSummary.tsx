'use client';

import { useState } from 'react';
import { 
  Clock, 
  DollarSign, 
  Star, 
  Download, 
  Share2, 
  Bookmark, 
  CheckCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  ThumbsUp,
  ArrowRight,
  X
} from 'lucide-react';
import { Button } from './ui/Button';
import { ShareModal } from './ShareModal';
import { PostCallPrompt } from './PostCallPrompt';
import type { PaymentState } from '@/lib/useRealPayment';
import type { AgentRecommendation } from '@/lib/agent-recommendations';
import { getExplorerTxUrl } from '@/lib/arbitrum-chain';

interface CallSummaryProps {
  isOpen: boolean;
  callId?: string;
  agent: {
    id: string;
    name: string;
    specialty: string;
    avatar?: string;
    color?: string;
  };
  duration: number;
  cost: number;
  transcripts: Array<{
    text: string;
    speaker: 'user' | 'agent';
    timestamp: number;
  }>;
  txHash?: string;
  payment?: PaymentState;
  onClose: () => void;
  onRate: (rating: number, feedback?: string) => void;
  onSave: () => void;
  onShare: () => void;
  onDownload: () => void;
  relatedAgents: AgentRecommendation[];
  onSelectRelatedAgent: (agentId: string) => void;
  /** Whether the user's wallet is connected */
  walletConnected?: boolean;
  /** Current streak count */
  streakCount?: number;
  /** Whether this was the user's first call ever */
  isFirstCall?: boolean;
  /** Callback to connect wallet (for post-call prompt) */
  onConnectWallet?: () => void;
}

export function CallSummary({
  isOpen,
  callId,
  agent,
  duration,
  cost,
  transcripts,
  txHash,
  payment,
  onClose,
  onRate,
  onSave,
  onShare,
  onDownload,
  relatedAgents,
  onSelectRelatedAgent,
  walletConnected = true,
  streakCount = 0,
  isFirstCall = false,
  onConnectWallet,
}: CallSummaryProps) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript'>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  if (!isOpen) return null;

  const resolvedTx = payment?.txHash || txHash;
  const explorerUrl = payment?.explorerUrl || (resolvedTx ? getExplorerTxUrl(resolvedTx) : undefined);
  // Settled only with a real tx hash — never invent success
  const status: 'settled' | 'processing' | 'pending' | 'error' | 'free' = payment?.isProcessing
    ? 'processing'
    : payment?.error
      ? 'error'
      : resolvedTx
        ? 'settled'
        : payment?.isSettled && (payment?.amountUsdc === 0 || cost === 0)
          ? 'free'
          : 'pending';

  const statusConfig = {
    settled: {
      label: 'Payment settled on Arbitrum',
      className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      icon: <CheckCircle className="w-6 h-6 text-emerald-400" />,
    },
    processing: {
      label: 'Settling payment on Arbitrum',
      className: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
      icon: <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />,
    },
    pending: {
      label: 'Payment not settled yet',
      className: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
      icon: <Clock className="w-6 h-6 text-slate-400" />,
    },
    error: {
      label: payment?.error || 'Payment failed',
      className: 'bg-red-500/10 border-red-500/30 text-red-400',
      icon: <AlertCircle className="w-6 h-6 text-red-400" />,
    },
    free: {
      label: 'No charge for this call',
      className: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      icon: <CheckCircle className="w-6 h-6 text-amber-400" />,
    },
  }[status];

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleRate = (stars: number) => {
    setRating(stars);
    setShowFeedback(true);
  };

  const submitRating = () => {
    onRate(rating, feedback);
    setHasRated(true);
    setShowFeedback(false);
  };

  const handleSave = () => {
    onSave();
    setIsSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0806]/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${agent.color || 'from-cyan-500 to-blue-500'} flex items-center justify-center`}>
                <span className="text-2xl">{agent.avatar || agent.name.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Call Complete</h2>
                <p className="text-sm text-amber-100/50">with {agent.name}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-amber-100/50 hover:text-amber-50 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Payment Status Banner */}
          <div className={`border rounded-xl p-4 mb-6 flex items-center gap-3 ${statusConfig.className}`}>
            {statusConfig.icon}
            <div className="flex-1">
              <p className="font-medium">{statusConfig.label}</p>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-100/50 hover:text-amber-300 transition-colors"
                >
                  View on Arbiscan →
                </a>
              )}
            </div>
          </div>

          {/* Post-call Vox prompt — wallet connect + streak celebration */}
          <PostCallPrompt
            showWalletPrompt={!walletConnected}
            streakCount={streakCount}
            isFirstCall={isFirstCall}
            onConnect={onConnectWallet || (() => {})}
            onDismiss={() => {}}
          />

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-red-500/20 text-amber-50 border border-red-400/50' 
                  : 'bg-black/25 text-amber-100/50 hover:bg-amber-100/10'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'transcript' 
                  ? 'bg-red-500/20 text-amber-50 border border-red-400/50' 
                  : 'bg-black/25 text-amber-100/50 hover:bg-amber-100/10'
              }`}
            >
              Transcript ({transcripts.length})
            </button>
          </div>

          {activeTab === 'overview' ? (
            <>
              {/* Receipt */}
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d]/85 p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-amber-100/45">Receipt</p>
                    <p className="text-white font-semibold">Call settlement</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusConfig.className}`}>
                    {status === 'settled' ? 'On-chain' : status === 'free' ? 'Free' : status === 'processing' ? 'Settling' : status === 'error' ? 'Failed' : 'Pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/25 rounded-lg p-3">
                    <p className="text-xs text-amber-100/45">Total Cost</p>
                    <p className="text-lg font-semibold text-amber-50">${(cost || 0).toFixed(4)}</p>
                  </div>
                  <div className="bg-black/25 rounded-lg p-3">
                    <p className="text-xs text-amber-100/45">Duration</p>
                    <p className="text-lg font-semibold text-amber-50">{formatDuration(duration)}</p>
                  </div>
                  <div className="bg-black/25 rounded-lg p-3">
                    <p className="text-xs text-amber-100/45">Token</p>
                    <p className="text-lg font-semibold text-amber-50">USDC</p>
                  </div>
                  <div className="bg-black/25 rounded-lg p-3">
                    <p className="text-xs text-amber-100/45">Call ID</p>
                    <p className="text-sm text-amber-100/70 font-mono truncate">{callId || '—'}</p>
                  </div>
                </div>
                {(payment?.agentShareUsdc != null || payment?.platformShareUsdc != null) && status === 'settled' && (
                  <div className="mt-3 rounded-lg border border-amber-100/10 bg-black/20 p-3 text-xs text-amber-100/70">
                    <p className="font-medium text-amber-100/90 mb-1">Marketplace ledger (not a second on-chain transfer)</p>
                    <p>Broker share: ${(payment.agentShareUsdc ?? 0).toFixed(4)} · Platform: ${(payment.platformShareUsdc ?? 0).toFixed(4)}</p>
                    <p className="mt-1 text-amber-100/45">Atomic 80/20 on-chain split ships with PaymentRouter.</p>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  {explorerUrl ? (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 text-sm font-medium hover:text-amber-200 transition-colors"
                    >
                      Open Arbiscan →
                    </a>
                  ) : (
                    <span className="text-xs text-amber-100/45">
                      {status === 'free'
                        ? 'No on-chain transfer for zero-cost calls.'
                        : 'Approve the exact USDC amount in your wallet to settle.'}
                    </span>
                  )}
                  {payment?.error && (
                    <span className="text-xs text-red-400">{payment.error}</span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Duration"
                  value={formatDuration(duration)}
                  color="cyan"
                />
                <StatCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label="Total Cost"
                  value={`$${(cost || 0).toFixed(2)}`}
                  color="green"
                />
                <StatCard
                  icon={<MessageSquare className="w-5 h-5" />}
                  label="Messages"
                  value={transcripts.length.toString()}
                  color="amber"
                />
              </div>

              {/* Rating Section */}
              <div className="rounded-xl border border-amber-100/15 bg-[#17100d]/85 p-6 mb-6">
                {!hasRated ? (
                  <>
                    <h3 className="text-lg font-semibold text-amber-50 mb-2">
                      How was your call?
                    </h3>
                    <p className="text-amber-100/50 text-sm mb-4">
                      Your feedback helps improve our brokers
                    </p>
                    
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRate(star)}
                          className={`p-2 rounded-lg transition-colors ${
                            rating >= star 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : 'bg-black/25 text-amber-100/25 hover:bg-amber-100/10'
                          }`}
                        >
                          <Star className={`w-6 h-6 ${rating >= star ? 'fill-current' : ''}`} />
                        </button>
                      ))}
                    </div>

                    {showFeedback && (
                      <div className="space-y-3">
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="What went well? What could be better?"
                          className="w-full p-3 bg-black/25 rounded-lg text-amber-50 placeholder-amber-100/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button onClick={submitRating} className="flex-1">
                            Submit Rating
                          </Button>
                          <Button 
                            onClick={() => setShowFeedback(false)} 
                            variant="ghost"
                          >
                            Skip
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <ThumbsUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-white font-medium">Thanks for your feedback!</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <ActionButton
                  icon={<Bookmark className="w-5 h-5" />}
                  label={isSaved ? 'Saved' : 'Save'}
                  onClick={handleSave}
                  active={isSaved}
                />
                <ActionButton
                  icon={<Share2 className="w-5 h-5" />}
                  label="Share"
                  onClick={() => setShowShareModal(true)}
                />
                <ActionButton
                  icon={<Download className="w-5 h-5" />}
                  label="Download"
                  onClick={onDownload}
                />
              </div>

              {/* Related Brokers */}
              {relatedAgents.length > 0 && (
                <div className="rounded-xl border border-amber-100/15 bg-[#17100d]/85 p-6">
                  <h3 className="text-lg font-semibold text-amber-50 mb-4">
                    You might also like
                  </h3>
                  <div className="space-y-3">
                    {relatedAgents.map((relatedAgent) => (
                      <button
                        key={relatedAgent.id}
                        onClick={() => onSelectRelatedAgent(relatedAgent.id)}
                        className="w-full flex items-center gap-4 p-4 bg-black/25 rounded-xl hover:bg-amber-100/10 transition-colors text-left group"
                      >
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${relatedAgent.color || 'from-amber-600 to-red-600'} flex items-center justify-center`}>
                          <span className="text-xl">{relatedAgent.avatar || relatedAgent.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-amber-50">{relatedAgent.name}</p>
                          <p className="text-sm text-amber-100/50">{relatedAgent.specialty}</p>
                          <p className="text-sm text-red-400">{relatedAgent.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-amber-100/50">${relatedAgent.rate}/min</p>
                          <ArrowRight className="w-4 h-4 text-amber-100/25 group-hover:text-red-400 transition-colors inline-block mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Transcript Tab */
            <div className="rounded-xl border border-amber-100/15 bg-[#17100d]/85 p-6">
              <h3 className="text-lg font-semibold text-amber-50 mb-4">
                Conversation Transcript
              </h3>
              {transcripts.length === 0 ? (
                <p className="text-amber-100/50 text-center py-8">
                  No transcript available for this call
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {transcripts.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          msg.speaker === 'user'
                            ? 'bg-red-500/20 text-red-100 rounded-br-md'
                            : 'bg-amber-100/10 text-amber-100/75 rounded-bl-md'
                        }`}
                      >
                        <p>{msg.text}</p>
                        <span className="text-xs opacity-60 mt-1 block">
                          {new Date(msg.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <Button onClick={onClose} variant="ghost" className="w-full">
              Close Summary
            </Button>
          </div>
        </div>

        {/* Share Modal */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title={`Call with ${agent.name}`}
          description={`I just had a ${formatDuration(duration)} voice call with ${agent.name} on Claflin! 🎙️`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          callData={{
            agentName: agent.name,
            duration,
            cost,
            rating: hasRated ? rating : undefined,
          }}
        />
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  color: 'cyan' | 'green' | 'amber';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    green: 'bg-green-500/10 text-green-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };

  return (
    <div className="rounded-xl border border-amber-100/15 bg-[#17100d]/85 p-4 text-center">
      <div className={`w-10 h-10 mx-auto rounded-lg ${colorClasses[color]} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-amber-50">{value}</p>
      <p className="text-xs text-amber-100/45">{label}</p>
    </div>
  );
}

function ActionButton({ 
  icon, 
  label, 
  onClick, 
  active 
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-xl transition-colors
        ${active 
          ? 'bg-red-500/20 text-red-400' 
          : 'bg-black/25 text-amber-100/50 hover:bg-amber-100/10'
        }
      `}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
