'use client';

import { useTheme } from './ThemeProvider';
import { useEffect, useState } from 'react';

export function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <span className="toggle-icon">
        {theme === 'light' ? '🌙' : '☀️'}
      </span>
      <span className="toggle-text">
        {theme === 'light' ? 'Dark' : 'Light'}
      </span>

      <style jsx>{`
        .theme-toggle {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--toggle-bg, #f0f0f0);
          border: 1px solid var(--toggle-border, #ddd);
          border-radius: 25px;
          cursor: pointer;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        .theme-toggle:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .toggle-icon {
          font-size: 18px;
        }
        .toggle-text {
          font-size: 13px;
          font-weight: 500;
        }
        
        :global(.dark-mode) {
          --toggle-bg: #1e293b;
          --toggle-border: #334155;
        }
        
        :global(.dark-mode) .theme-toggle {
          background: #1e293b;
          border-color: #334155;
          color: #e2e8f0;
        }
      `}</style>
    </button>
  );
}
