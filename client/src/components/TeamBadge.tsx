interface TeamBadgeProps {
  name: string
  logo?: string | null
  size?: number
  className?: string
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    || words.slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function getColor(name: string): string {
  const colors = [
    '#1d4ed8', '#0369a1', '#0f766e', '#15803d',
    '#7e22ce', '#be185d', '#b45309', '#dc2626',
    '#0891b2', '#4f46e5',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function TeamBadge({ name, logo, size = 24, className = '' }: TeamBadgeProps) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        className={`object-contain flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          const target = e.currentTarget
          const parent = target.parentElement
          if (!parent) return
          const badge = document.createElement('div')
          badge.style.cssText = `width:${size}px;height:${size}px;border-radius:${size * 0.2}px;background:${getColor(name)};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:${size * 0.38}px;font-weight:700;color:white;letter-spacing:-0.5px`
          badge.textContent = getInitials(name)
          parent.replaceChild(badge, target)
        }}
      />
    )
  }

  const bg = getColor(name)
  const initials = getInitials(name)
  const fontSize = size * 0.38

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center font-bold text-white ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.2, background: bg, fontSize, letterSpacing: '-0.5px' }}
    >
      {initials}
    </div>
  )
}
