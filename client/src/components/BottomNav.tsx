import { Link } from '@tanstack/react-router'
import { Home, Calendar, LayoutList, Users, Trophy } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/fixtures', label: 'Fixtures', icon: Calendar, exact: false },
  { to: '/standings', label: 'Tabla', icon: LayoutList, exact: false },
  { to: '/bracket', label: 'Eliminatoria', icon: Trophy, exact: false },
  { to: '/players', label: 'Estadisticas', icon: Users, exact: false },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800">
      <div className="flex items-center justify-around h-16 pb-safe">
        {navItems.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-500 hover:text-white transition-colors"
            activeProps={{ className: 'flex flex-col items-center justify-center gap-1 flex-1 h-full text-[#74ACDF]' }}
          >
            <Icon size={22} strokeWidth={1.75} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
