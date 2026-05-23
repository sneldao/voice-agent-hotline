import * as React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'glass';
  interactive?: boolean;
  animated?: boolean;
}

export function Card({ 
  className = '', 
  variant = 'default', 
  interactive = false,
  animated = false,
  children, 
  ...props 
}: CardProps) {
  const variants = {
    default: 'bg-gray-900/50 border border-gray-800',
    gradient: 'bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50',
    glass: 'bg-gray-900/30 backdrop-blur-xl border border-gray-700/30',
  };

  return (
    <div
      className={`
        rounded-2xl
        ${variants[variant]}
        ${interactive ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}
        ${animated ? 'animate-fade-in' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 pt-3 flex items-center gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}
