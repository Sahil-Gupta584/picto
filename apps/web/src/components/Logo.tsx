import { SiDuckduckgo } from 'react-icons/si'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-5 w-5 text-[10px]', md: 'h-7 w-7 text-sm', lg: 'h-10 w-10 text-lg' }
  return (
    <span className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#ea580c] text-white shadow-[0_0_12px_rgba(245,158,11,0.4)] ${dims[size]}`}>
      <SiDuckduckgo />
    </span>
  )
}

export function LogoWithName({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} />
      <span className="font-semibold tracking-tight text-[var(--foreground)]" style={{ fontSize: size === 'lg' ? '1.125rem' : size === 'sm' ? '0.75rem' : '0.875rem' }}>
        Picto
      </span>
    </span>
  )
}
