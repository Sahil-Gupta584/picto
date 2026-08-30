import { SiDuckduckgo } from 'react-icons/si'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }
  return (
    <span className={`flex items-center justify-center text-white ${dims[size]}`}>
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
