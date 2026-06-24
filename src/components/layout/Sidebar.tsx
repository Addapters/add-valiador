import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, Briefcase, Map, Receipt, TrendingUp, Users, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

const nav = [
  { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard },
  { label: 'Clientes',    to: '/clients',    icon: Users },
  { label: 'Portfólios',  to: '/portfolios', icon: Briefcase },
  { label: 'Imóveis',     to: '/properties', icon: Building2 },
  { label: 'Mapa',        to: '/map',        icon: Map },
  { section: 'Financeiro' },
  { label: 'Faturação',   to: '/billing',    icon: Receipt },
  { section: 'Mercado' },
  { label: 'Prospeção',   to: '/market',     icon: TrendingUp },
]

export default function Sidebar() {
  const { name, role, signOut } = useAuth()

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-gray-100 flex flex-col z-30">
      <div className="px-5 py-4 border-b border-gray-100">
        <span className="text-lg font-semibold text-gray-900">Add-<span className="text-brand-400">valiador</span></span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map((item, i) => {
          if ('section' in item) return (
            <p key={i} className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{item.section}</p>
          )
          const Icon = item.icon!
          return (
            <NavLink key={item.to} to={item.to!} end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors
                 ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }>
              <Icon size={16}/>{item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{name || '—'}</p>
            <p className="text-[10px] text-gray-400 capitalize">{role === 'admin' ? 'Administrador' : 'Perito Avaliador'}</p>
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <LogOut size={14}/>
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-2">v0.6.0</p>
      </div>
    </aside>
  )
}
