'use client';

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
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imgRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(imgRef);
    return () => observer.disconnect();
  }, [imgRef]);

  return (
    <img
      ref={setImgRef}
      src={isInView ? src : undefined}
      srcSet={isInView ? src : undefined}
      alt={alt}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      style={{ backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' }}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

export function useImagePreload(sources: string[]) {
  useEffect(() => {
    sources.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [sources]);
}
