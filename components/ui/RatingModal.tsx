'use client';

import { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Star, Heart, History, Clock, Zap } from './Toast';
import { showSuccess, showRatingSubmitted } from '@/lib/useToast';

interface RatingModalProps {
  isOpen: boolean;
  agent: {
    name: string;
    avatar: string;
    specialty: string;
    color: string;
  } | null;
  duration: number;
  onClose: () => void;
  onSubmit: (rating: number, feedback?: string) => void;
}

const RATING_LABELS = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

const FEEDBACK_TAGS = [
  { icon: '👍', label: 'Helpful', value: 'helpful' },
  { icon: '🧠', label: 'Knowledgeable', value: 'knowledgeable' },
  { icon: '⏰', label: 'Quick', value: 'quick' },
  { icon: '💡', label: 'Clear', value: 'clear' },
];

export function RatingModal({ isOpen, agent, duration, onClose, onSubmit }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !agent) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API
      onSubmit(rating, selectedTags.join(', '));
      showSuccess('Rating submitted - thanks for your feedback!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full mx-4 max-w-md bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl shadow-black/50 animate-scale-in">
        {/* Header */}
        <div className={`p-6 rounded-t-2xl bg-gradient-to-br ${agent.color} text-center`}>
          <Avatar size="xl" className="mx-auto mb-3 border-4 border-white/20">
            {agent.avatar}
          </Avatar>
          <h2 className="text-xl font-bold text-white">{agent.name}</h2>
          <p className="text-white/70 text-sm">{agent.specialty}</p>
          
          {/* Call stats */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full">
              <Clock className="w-4 h-4 text-white/70" />
              <span className="text-sm text-white/80">{formatDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-white/80">x402 Payment</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rating Stars */}
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-3">How was your call?</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-2 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-yellow-400 mt-2 font-medium">
                {RATING_LABELS[rating as keyof typeof RATING_LABELS]}
              </p>
            )}
          </div>

          {/* Quick Feedback Tags */}
          {rating >= 4 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">What was great?</p>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes(tag.value)
                          ? prev.filter(t => t !== tag.value)
                          : [...prev, tag.value]
                      );
                    }}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all
                      ${selectedTags.includes(tag.value)
                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                        : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600'
                      }
                      border
                    `}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comment */}
          {rating > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <History className="w-4 h-4" />
                Comments (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="w-full h-24 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          )}

          {/* Tips */}
          {rating >= 5 && (
            <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
              <Heart className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <p className="text-xs text-gray-300">
                Your feedback helps great agents earn recognition! 🎉
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            isLoading={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Star rating component for other uses
export function StarRating({
  rating,
  onChange,
  size = 'md',
}: {
  rating: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5"
        >
          <Star
            className={`${sizes[size]} transition-colors ${
              star <= (hovered || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
