// NAZAR AI product mark — the same eye-and-zones drawing as favicon.svg.

export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1e293b" />
      <ellipse cx="32" cy="29" rx="19" ry="12.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle cx="32" cy="29" r="6.5" fill="#dc2626" />
      <circle cx="21" cy="51" r="3" fill="#dc2626" />
      <circle cx="32" cy="51" r="3" fill="#f59e0b" />
      <circle cx="43" cy="51" r="3" fill="#16a34a" />
    </svg>
  )
}

export function Wordmark({ subtitle, tone = 'dark' }: { subtitle?: string; tone?: 'dark' | 'light' }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className={`text-lg font-bold tracking-tight ${tone === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        NAZAR AI
      </div>
      {subtitle ? (
        <div className={`truncate text-sm ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</div>
      ) : null}
    </div>
  )
}
