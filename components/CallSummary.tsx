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
  MessageSquare,
  ThumbsUp,
  ArrowRight,
  X
} from 'lucide-react';
import { Button } from './ui/Button';

interface CallSummaryProps {
  isOpen: boolean;
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
  onClose: () => void;
  onRate: (rating: number, feedback?: string) => void;
  onSave: () => void;
  onShare: () => void;
  onDownload: () => void;
  relatedAgents: Array<{
    id: string;
    name: string;
    specialty: string;
    rate: number;
    reason: string;
  }>;
  onSelectRelatedAgent: (agentId: string) => void;
}

export function CallSummary({
  isOpen,
  agent,
  duration,
  cost,
  transcripts,
  txHash,
  onClose,
  onRate,
  onSave,
  onShare,
  onDownload,
  relatedAgents,
  onSelectRelatedAgent,
}: CallSummaryProps) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript'>('overview');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm overflow-y-auto">
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
                <p className="text-sm text-gray-400">with {agent.name}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Success Banner */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Payment Successful</p>
              {txHash && (
                <a 
                  href={`https://celoscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
                >
                  View on CeloScan →
                </a>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'transcript' 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Transcript ({transcripts.length})
            </button>
          </div>

          {activeTab === 'overview' ? (
            <>
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
                  value={`$${cost.toFixed(2)}`}
                  color="green"
                />
                <StatCard
                  icon={<MessageSquare className="w-5 h-5" />}
                  label="Messages"
                  value={transcripts.length.toString()}
                  color="purple"
                />
              </div>

              {/* Rating Section */}
              <div className="bg-gray-900 rounded-xl p-6 mb-6">
                {!hasRated ? (
                  <>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      How was your call?
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Your feedback helps improve our agents
                    </p>
                    
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRate(star)}
                          className={`p-2 rounded-lg transition-colors ${
                            rating >= star 
                              ? 'bg-yellow-500/20 text-yellow-400' 
                              : 'bg-gray-800 text-gray-600 hover:bg-gray-700'
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
                          className="w-full p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
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
                  onClick={onShare}
                />
                <ActionButton
                  icon={<Download className="w-5 h-5" />}
                  label="Download"
                  onClick={onDownload}
                />
              </div>

              {/* Related Agents */}
              {relatedAgents.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    You might also like
                  </h3>
                  <div className="space-y-3">
                    {relatedAgents.map((relatedAgent) => (
                      <button
                        key={relatedAgent.id}
                        onClick={() => onSelectRelatedAgent(relatedAgent.id)}
                        className="w-full flex items-center gap-4 p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors text-left group"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                          <span className="text-xl">{relatedAgent.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">{relatedAgent.name}</p>
                          <p className="text-sm text-cyan-400">{relatedAgent.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">${relatedAgent.rate}/min</p>
                          <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors inline-block mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Transcript Tab */
            <div className="bg-gray-900 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Conversation Transcript
              </h3>
              {transcripts.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
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
                            ? 'bg-cyan-500 text-white rounded-br-md'
                            : 'bg-gray-800 text-gray-200 rounded-bl-md'
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
  color: 'cyan' | 'green' | 'purple';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="bg-gray-900 rounded-xl p-4 text-center">
      <div className={`w-10 h-10 mx-auto rounded-lg ${colorClasses[color]} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
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
          ? 'bg-cyan-500/20 text-cyan-400' 
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }
      `}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
