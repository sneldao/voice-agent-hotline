import * as React from 'react';
import Image from 'next/image';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  status?: 'online' | 'offline' | 'busy';
}

export function Avatar({ 
  className = '', 
  src,
  alt = 'Avatar',
  size = 'md',
  online,
  status,
  children,
  ...props 
}: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-xl',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-24 h-24 text-4xl',
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    busy: 'bg-red-500',
  };

  const statusSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
  };

  return (
    <div className={`relative inline-flex ${className}`} {...props}>
      <div
        className={`
          ${sizes[size]}
          rounded-full
          bg-gradient-to-br from-gray-700 to-gray-800
          flex
          items-center
          justify-center
          overflow-hidden
          border-2
          border-gray-800
        `}
      >
        {src ? (
          <Image src={src} alt={alt} fill unoptimized sizes="96px" className="object-cover" />
        ) : (
          <span className="select-none">{children}</span>
        )}
      </div>
      {(online !== undefined || status) && (
        <span
          className={`
            absolute
            bottom-0
            right-0
            rounded-full
            border-2
            border-gray-900
            ${statusColors[status || (online ? 'online' : 'offline')]}
            ${statusSizes[size]}
          `}
        />
      )}
    </div>
  );
}
