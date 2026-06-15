'use client';

import { memo } from 'react';
import { Star } from 'lucide-react';

const STAR_COLORS = [
  'text-yellow-400 fill-yellow-400',
  'text-yellow-400 fill-yellow-400/50',
  'text-gray-600',
];

function getStarClass(index: number, fullStars: number, hasHalfStar: boolean): string {
  if (index < fullStars) return STAR_COLORS[0];
  if (index === fullStars && hasHalfStar) return STAR_COLORS[1];
  return STAR_COLORS[2];
}

export const Stars = memo(function Stars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <Star key={i} className={`w-4 h-4 ${getStarClass(i, fullStars, hasHalfStar)}`} />
      ))}
    </div>
  );
});
