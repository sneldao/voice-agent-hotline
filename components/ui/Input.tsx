import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  error?: string;
}

export function Input({ 
  className = '', 
  icon,
  error,
  ...props 
}: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
          {icon}
        </span>
      )}
      <input
        className={`
          w-full
          bg-gray-800/80
          border
          border-gray-700
          rounded-xl
          px-4
          py-3
          text-sm
          text-white
          placeholder-gray-500
          transition-all
          duration-200
          outline-none
          focus:border-cyan-500
          focus:ring-1
          focus:ring-cyan-500
          ${icon ? 'pl-12' : ''}
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-400 ml-1">{error}</p>
      )}
    </div>
  );
}
