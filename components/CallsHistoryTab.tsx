'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Phone, Clock, Wallet, Bookmark, Star } from 'lucide-react';
import { CallHistorySkeleton } from './Skeletons';
import { EmptyState } from './EmptyState';
import { useLocalCallHistory, CallRecord } from '@/lib/useCallHistory';
import { RefreshButton, Card, Avatar, TranscriptModal, ShareModal, ExportModal, EmptyHistoryState, showError } from '@/components/ui';

interface CallsHistoryTabProps {
  localHistory: ReturnType<typeof useLocalCallHistory>;
  address?: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void>;
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

export function CallsHistoryTab({
  localHistory,
  address,
  isLoading,
  error,
  onRefresh,
  agents,
  onSelectAgent,
}: CallsHistoryTabProps) {
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shareCall, setShareCall] = useState<CallRecord | null>(null);
  const [exportCall, setExportCall] = useState<CallRecord | null>(null);
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [serverCalls, setServerCalls] = useState<CallRecord[]>([]);

  // Fetch server history on mount
  useEffect(() => {
    if (!address) return;
    fetch(`/api/calls?caller_address=${encodeURIComponent(address)}`)
      .then(r => r.ok ? r.json() : { calls: [] })
      .then(data => {
        const calls: CallRecord[] = (data.calls || [])
          .filter((c: any) => c.status === 'completed')
          .map((c: any) => ({
            id: c.id,
            agentId: c.agent_id,
            agentName: c.agent_name || c.agent_id,
            agentSpecialty: c.agent_specialty || '',
            duration: parseInt(c.duration_seconds) || 0,
            cost: parseFloat(c.total_cost) || 0,
            timestamp: new Date(c.ended_at || c.started_at).getTime(),
            transcripts: Array.isArray(c.transcripts) ? c.transcripts : [],
            isSaved: false,
          }));
        setServerCalls(calls);
      })
      .catch(() => {});
  }, [address]);

  // Merge: local calls are source of truth, server fills gaps
  const allCalls = useMemo(() => {
    const localIds = new Set(localHistory.calls.map(c => c.id));
    const merged = [...localHistory.calls];
    for (const sc of serverCalls) {
      if (!localIds.has(sc.id)) merged.push(sc);
    }
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [localHistory.calls, serverCalls]);

  const displayCalls = filter === 'saved' ? localHistory.getSavedCalls() : allCalls;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleCallAgain = (call: CallRecord) => {
    const agent = agents.find(a => a.id === call.agentId);
    if (agent) onSelectAgent(agent);
    else showError('Agent not available');
  };

  // Loading state
  if (isLoading) return <CallHistorySkeleton />;

  // Error state
  if (error) {
    return (
      <EmptyState
        type="calls"
        title="Failed to load calls"
        description={error}
      />
    );
  }

  // Empty state
  if (allCalls.length === 0) {
    return (
      <EmptyState
        type="calls"
        title="No calls yet"
        description="Start your first voice call with an AI agent"
        actionLabel="Browse Agents"
        onAction={() => {
          window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'discover' }));
        }}
      />
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Call History</h2>
          <p className="text-sm text-gray-400">
            {allCalls.length} calls • {formatDuration(allCalls.reduce((s, c) => s + c.duration, 0))} total
          </p>
        </div>
        <RefreshButton variant="full" onRefresh={onRefresh || (async () => {})} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Phone className="w-4 h-4" />} value={allCalls.length.toString()} label="Calls" />
        <StatCard icon={<Clock className="w-4 h-4" />} value={formatDuration(allCalls.reduce((s, c) => s + c.duration, 0))} label="Duration" />
        <StatCard icon={<Wallet className="w-4 h-4" />} value={`$${allCalls.reduce((s, c) => s + c.cost, 0).toFixed(2)}`} label="Spent" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All Calls</FilterButton>
        <FilterButton active={filter === 'saved'} onClick={() => setFilter('saved')}>
          Saved ({localHistory.getSavedCalls().length})
        </FilterButton>
        {displayCalls.length > 0 && (
          <button
            onClick={() => setShowBulkExport(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
          >
            Export
          </button>
        )}
      </div>

      {/* Call List */}
      {displayCalls.length > 0 ? (
        <div className="space-y-3">
          {displayCalls.map(call => (
            <CallHistoryCard
              key={call.id}
              call={call}
              isSaved={call.isSaved}
              onToggleSave={() => localHistory.toggleSaveCall(call.id)}
              onViewTranscript={() => { setSelectedCall(call); setShowTranscript(true); }}
              onDownload={() => setExportCall(call)}
              onShare={() => setShareCall(call)}
              onCallAgain={() => handleCallAgain(call)}
              onRate={(r) => localHistory.rateCall(call.id, r)}
              formatDate={formatDate}
              formatDuration={formatDuration}
            />
          ))}
        </div>
      ) : (
        <EmptyHistoryState 
          onBrowseAgents={() => {
            window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'discover' }));
          }}
        />
      )}

      {/* Modals */}
      {selectedCall && (
        <TranscriptModal
          call={selectedCall}
          isOpen={showTranscript}
          onClose={() => setShowTranscript(false)}
          formatDate={formatDate}
          formatDuration={formatDuration}
        />
      )}
      {shareCall && (
        <ShareModal
          isOpen={!!shareCall}
          onClose={() => setShareCall(null)}
          title={`Call with ${shareCall.agentName}`}
          description={`I had a ${formatDuration(shareCall.duration)} voice call with ${shareCall.agentName}! 🎙️`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          callData={{ agentName: shareCall.agentName, duration: shareCall.duration, cost: shareCall.cost, rating: shareCall.rating }}
        />
      )}
      <ExportModal isOpen={!!exportCall} onClose={() => setExportCall(null)} call={exportCall || undefined} />
      <ExportModal isOpen={showBulkExport} onClose={() => setShowBulkExport(false)} calls={displayCalls} />
    </div>
  );
}

// Helper Components
function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 text-center">
      <div className="text-gray-400 mb-1">{icon}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function CallHistoryCard({
  call,
  isSaved,
  onToggleSave,
  onViewTranscript,
  onDownload,
  onShare,
  onCallAgain,
  onRate,
  formatDate,
  formatDuration,
}: {
  call: CallRecord;
  isSaved: boolean;
  onToggleSave: () => void;
  onViewTranscript: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCallAgain: () => void;
  onRate: (rating: number) => void;
  formatDate: (ts: number) => string;
  formatDuration: (s: number) => string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  const handleRate = (r: number) => {
    setPendingRating(r);
    onRate(r);
  };

  const displayRating = pendingRating ?? call.rating ?? 0;
  const isRated = displayRating > 0;

  return (
    <Card variant="default" className="p-4 animate-fadeIn">
      <div className="flex items-start gap-3">
        <Avatar size="md">{call.agentName.charAt(0)}</Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="font-semibold truncate">{call.agentName}</div>
            <button onClick={onToggleSave} className={`p-1 rounded ${isSaved ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}>
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
          <div className="text-sm text-gray-400 mb-2">{call.agentSpecialty}</div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatDuration(call.duration)}
            </span>
            <span>{formatDate(call.timestamp)}</span>
            <span className="text-cyan-400">${(call.cost || 0).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                disabled={isRated}
                onMouseEnter={() => !isRated && setHoverRating(i + 1)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => !isRated && handleRate(i + 1)}
                className={`transition-transform ${!isRated ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}`}
              >
                <Star className={`w-3.5 h-3.5 ${i < (hoverRating || displayRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
              </button>
            ))}
            {!isRated && <span className="text-xs text-gray-600 ml-1">Tap to rate</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
        <button onClick={onViewTranscript} className="flex-1 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700">
          Transcript
        </button>
        <button onClick={() => setShowActions(!showActions)} className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700">
          {showActions ? 'Less' : 'More'}
        </button>
      </div>
      {showActions && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
          <button onClick={onDownload} className="flex-1 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700">
            Download
          </button>
          <button onClick={onShare} className="flex-1 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700">
            Share
          </button>
          <button onClick={onCallAgain} className="flex-1 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700">
            Call Again
          </button>
        </div>
      )}
    </Card>
  );
}
