'use client';

import { motion } from 'framer-motion';

type MascotMood = 'idle' | 'happy' | 'waving' | 'thinking' | 'talking' | 'celebrating';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  className?: string;
}

/**
 * Vox — the VOISSS mascot.
 * A retro rotary telephone character with expressive eyes and a coiled cord tail.
 * Rendered as inline SVG so it can be animated with framer-motion.
 */
export function Mascot({ mood = 'idle', size = 120, className = '' }: MascotProps) {
  const eyeVariants: Record<MascotMood, { leftY: number; rightY: number; blink: boolean }> = {
    idle: { leftY: 0, rightY: 0, blink: false },
    happy: { leftY: -1, rightY: -1, blink: false },
    waving: { leftY: 0, rightY: -1, blink: false },
    thinking: { leftY: -2, rightY: 2, blink: false },
    talking: { leftY: 0, rightY: 0, blink: false },
    celebrating: { leftY: -2, rightY: -2, blink: false },
  };

  const bodyAnimation = {
    idle: { rotate: [0, -1, 0, 1, 0], transition: { repeat: Infinity, duration: 4, ease: 'easeInOut' } },
    happy: { rotate: [0, -2, 0, 2, 0], scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' } },
    waving: { rotate: [0, -3, 0], transition: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } },
    thinking: { rotate: [0, 2, 0], y: [0, -2, 0], transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' } },
    talking: { scale: [1, 1.01, 1, 1.02, 1], transition: { repeat: Infinity, duration: 0.6, ease: 'easeInOut' } },
    celebrating: { rotate: [0, -5, 5, -5, 0], y: [0, -8, 0], transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } },
  };

  const eyes = eyeVariants[mood];

  return (
    <motion.div
      className={`inline-flex items-center justify-center ${className}`}
      animate={bodyAnimation[mood]}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Vox the VOISSS mascot"
        role="img"
      >
        {/* Body — rotary phone base */}
        <ellipse cx="60" cy="72" rx="38" ry="28" fill="url(#bodyGradient)" />
        <ellipse cx="60" cy="72" rx="38" ry="28" fill="url(#bodyShine)" opacity="0.4" />
        
        {/* Rotary dial circle */}
        <circle cx="60" cy="76" r="18" fill="#1a0f0a" stroke="#edd698" strokeWidth="1.5" opacity="0.8" />
        <circle cx="60" cy="76" r="12" fill="none" stroke="#edd698" strokeWidth="0.5" opacity="0.4" />
        
        {/* Dial holes */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
          const angle = (i * 36 - 90) * (Math.PI / 180);
          const x = 60 + Math.cos(angle) * 14;
          const y = 76 + Math.sin(angle) * 14;
          return <circle key={i} cx={x} cy={y} r="2" fill="#2a1510" stroke="#edd698" strokeWidth="0.3" opacity="0.6" />;
        })}

        {/* Head — handset */}
        <motion.g
          animate={mood === 'talking' ? { y: [0, -1, 0, 1, 0] } : { y: 0 }}
          transition={mood === 'talking' ? { repeat: Infinity, duration: 0.4 } : {}}
        >
          {/* Handset body */}
          <path
            d="M30 38 C30 28, 40 20, 60 20 C80 20, 90 28, 90 38 L88 44 C88 46, 86 48, 84 48 L36 48 C34 48, 32 46, 32 44 Z"
            fill="url(#handsetGradient)"
          />
          <path
            d="M30 38 C30 28, 40 20, 60 20 C80 20, 90 28, 90 38 L88 44 C88 46, 86 48, 84 48 L36 48 C34 48, 32 46, 32 44 Z"
            fill="url(#handsetShine)"
            opacity="0.3"
          />
          
          {/* Earpiece (left) */}
          <rect x="28" y="30" width="14" height="18" rx="5" fill="#1a0f0a" stroke="#edd698" strokeWidth="0.8" />
          <rect x="31" y="33" width="8" height="12" rx="3" fill="#0d0705" />
          
          {/* Mouthpiece (right) */}
          <rect x="78" y="30" width="14" height="18" rx="5" fill="#1a0f0a" stroke="#edd698" strokeWidth="0.8" />
          <circle cx="85" cy="39" r="3" fill="#0d0705" />
          <circle cx="85" cy="39" r="1.5" fill="none" stroke="#edd698" strokeWidth="0.3" opacity="0.5" />

          {/* Eyes */}
          <motion.g animate={{ y: eyes.leftY }}>
            <ellipse cx="48" cy="36" rx="5" ry="5.5" fill="white" />
            <motion.circle
              cx="48"
              cy="36"
              r="2.5"
              fill="#1a0f0a"
              animate={mood === 'happy' || mood === 'celebrating' ? { scaleY: [1, 0.3, 1] } : {}}
              transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}
            />
            <circle cx="47" cy="35" r="1" fill="white" opacity="0.8" />
          </motion.g>
          
          <motion.g animate={{ y: eyes.rightY }}>
            <ellipse cx="72" cy="36" rx="5" ry="5.5" fill="white" />
            <motion.circle
              cx="72"
              cy="36"
              r="2.5"
              fill="#1a0f0a"
              animate={mood === 'happy' || mood === 'celebrating' ? { scaleY: [1, 0.3, 1] } : {}}
              transition={{ repeat: Infinity, duration: 3, repeatDelay: 2, delay: 0.1 }}
            />
            <circle cx="71" cy="35" r="1" fill="white" opacity="0.8" />
          </motion.g>

          {/* Mouth */}
          {mood === 'happy' || mood === 'celebrating' ? (
            <path d="M54 42 Q60 47 66 42" stroke="#edd698" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          ) : mood === 'talking' ? (
            <motion.ellipse
              cx="60"
              cy="43"
              rx="4"
              ry="3"
              fill="#1a0f0a"
              stroke="#edd698"
              strokeWidth="0.5"
              animate={{ ry: [2, 4, 2, 3, 2] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            />
          ) : mood === 'thinking' ? (
            <circle cx="64" cy="43" r="2" fill="#1a0f0a" stroke="#edd698" strokeWidth="0.5" />
          ) : (
            <path d="M55 43 Q60 44 65 43" stroke="#edd698" strokeWidth="1" fill="none" strokeLinecap="round" />
          )}
        </motion.g>

        {/* Coiled cord (tail) */}
        <path
          d="M60 100 C60 104, 58 106, 56 108 C54 110, 56 112, 58 112 C60 112, 62 110, 60 108 C58 106, 56 108, 58 110"
          stroke="#edd698"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
          strokeLinecap="round"
        />

        {/* Waving hand (only when waving) */}
        {mood === 'waving' && (
          <motion.g
            animate={{ rotate: [0, 20, -10, 20, 0] }}
            transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
            style={{ originX: '92px', originY: '55px' }}
          >
            <path
              d="M90 52 L98 46 L100 48 L93 55 Z"
              fill="url(#bodyGradient)"
              stroke="#edd698"
              strokeWidth="0.5"
            />
          </motion.g>
        )}

        {/* Celebration sparkles */}
        {mood === 'celebrating' && (
          <>
            <motion.circle
              cx="30" cy="20" r="2" fill="#f7d27a"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
            />
            <motion.circle
              cx="90" cy="15" r="1.5" fill="#ef4444"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
            />
            <motion.circle
              cx="20" cy="50" r="1.5" fill="#06b6d4"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }}
            />
            <motion.circle
              cx="100" cy="45" r="2" fill="#f7d27a"
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.9 }}
            />
          </>
        )}

        {/* Gradients */}
        <defs>
          <linearGradient id="bodyGradient" x1="22" y1="44" x2="98" y2="100">
            <stop offset="0%" stopColor="#d50000" />
            <stop offset="50%" stopColor="#b71c1c" />
            <stop offset="100%" stopColor="#5f1410" />
          </linearGradient>
          <radialGradient id="bodyShine" cx="40%" cy="30%">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="handsetGradient" x1="30" y1="20" x2="90" y2="48">
            <stop offset="0%" stopColor="#d50000" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <radialGradient id="handsetShine" cx="35%" cy="25%">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
      </svg>
    </motion.div>
  );
}
