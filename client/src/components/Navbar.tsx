import { Link } from '@tanstack/react-router'
import { Home, Calendar, LayoutList, Users, Star, Trophy } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/fixtures', label: 'Fixtures', icon: Calendar, exact: false },
  { to: '/standings', label: 'Posiciones', icon: LayoutList, exact: false },
  { to: '/bracket', label: 'Eliminatoria', icon: Trophy, exact: false },
  { to: '/players', label: 'Estadisticas', icon: Users, exact: false },
  { to: '/favorites', label: 'Favoritos', icon: Star, exact: false },
]

function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="28" height="28">
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
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white">
            <Logo />
            <span>Fútbol AR</span>
          </Link>
          <div className="flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                activeProps={{ className: 'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-white bg-gray-800' }}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
