import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  className = '',
  variant = 'default',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    active:scale-[0.98]
  `;
  
  const variants = {
    default: `
      bg-gradient-to-r from-cyan-500 to-blue-500 text-white
      hover:from-cyan-400 hover:to-blue-400
      shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40
    `,
    secondary: `
      bg-gray-800 text-white border border-gray-700
      hover:bg-gray-700 hover:border-gray-600
    `,
    destructive: `
      bg-gradient-to-r from-red-500 to-rose-500 text-white
      shadow-lg shadow-red-500/25 hover:shadow-red-500/40
    `,
    outline: `
      border border-gray-700 bg-transparent text-gray-300
      hover:bg-gray-800 hover:border-gray-600 hover:text-white
    `,
    ghost: `
      bg-transparent text-gray-400
      hover:text-white hover:bg-gray-800/50
    `,
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-sm min-h-[44px]',
    lg: 'px-6 py-4 text-base min-h-[52px]',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg 
          className="animate-spin h-4 w-4" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4" 
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
          />
        </svg>
      )}
      {children}
    </button>
  );
}
