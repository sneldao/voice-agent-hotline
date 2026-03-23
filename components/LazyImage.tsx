'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
}

export function LazyImage({ src, alt, className = '', placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="100%25" height="100%25" fill="%231f2937"/%3E%3C/svg%3E' }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(containerRef);
    return () => observer.disconnect();
  }, [containerRef]);

  return (
    <div
      ref={setContainerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' }}
    >
      {isInView && (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          loading="lazy"
          className={`${isLoaded ? 'opacity-100' : 'opacity-0'} object-cover transition-opacity duration-300`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
}

export function useImagePreload(sources: string[]) {
  useEffect(() => {
    sources.forEach(src => {
      const img = new window.Image();
      img.src = src;
    });
  }, [sources]);
}
