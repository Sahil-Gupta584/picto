export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 16, md: 24, lg: 32 }
  const px = dims[size]
  return (
    <img
      src="/favicon.ico"
      alt="Picto logo"
      width={px}
      height={px}
      style={{ width: px, height: px, imageRendering: 'auto' }}
    />
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
