import { Link } from '@tanstack/react-router'
import { Home, Calendar, LayoutList, Users, Trophy } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/fixtures', label: 'Fixtures', icon: Calendar, exact: false },
  { to: '/standings', label: 'Posiciones', icon: LayoutList, exact: false },
  { to: '/bracket', label: 'Eliminatoria', icon: Trophy, exact: false },
  { to: '/players', label: 'Estadísticas', icon: Users, exact: false },
]

function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="30" height="30">
      <circle cx="60" cy="60" r="58" fill="#0f172a" stroke="#74ACDF" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="#74ACDF" strokeWidth="0.5" opacity="0.3" />
      <polygon points="60,37 75,47 70,63 50,63 45,47" fill="white" />
      <polygon points="60,37 75,47 80,33 67,23 50,27" fill="#74ACDF" />
      <polygon points="75,47 80,63 94,58 94,42 80,33" fill="#F6B40E" />
      <polygon points="70,63 75,79 60,85 45,79 50,63" fill="#74ACDF" />
      <polygon points="45,47 40,63 26,58 26,42 40,33" fill="#F6B40E" />
      <polygon points="50,27 40,33 26,42 26,27 40,17 55,17" fill="#74ACDF" />
    </svg>
  )
}

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="flex h-20 items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:opacity-90"
          >
            <Logo />
            <span className="text-xl font-bold tracking-tight text-white">
              Fútbol AR
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {navLinks.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition-all duration-150 hover:bg-white/[0.05] hover:text-white"
                activeProps={{
                  className:
                    'flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(255,255,255,0.04)]',
                }}
              >
                <Icon size={17} strokeWidth={1.85} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}