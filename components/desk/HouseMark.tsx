export function HouseMark({ small = false, className = '', size, color }: { small?: boolean; className?: string; size?: number; color?: string }) {
  return (
    <svg className={className} width={size ?? (small ? 28 : 51)} height={size ?? (small ? 28 : 51)} color={color} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <path d="M28 4 50 17v22L28 52 6 39V17L28 4Z" stroke="currentColor" />
      <path d="M28 10 44 20v16L28 46 12 36V20L28 10Z" stroke="currentColor" opacity=".45" />
      <path d="M35 20a11 11 0 1 0 0 16M21 14v28M27 12v8m0 16v8M33 15v5m0 16v5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
