import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, Briefcase, Map, Receipt, TrendingUp, Users, LogOut, Menu, X, Calculator, Inbox, MessageSquare, UserCircle, FileText } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useCalculator } from '@/components/Calculator'

type NavItem = { label: string; to: string; icon: any } | { section: string }

const NAV_ADMIN: NavItem[] = [
  { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard },
  { label: 'Clientes',    to: '/clients',    icon: Users },
  { label: 'Projetos',    to: '/portfolios', icon: Briefcase },
  { label: 'Imóveis',     to: '/properties', icon: Building2 },
  { label: 'Mapa',        to: '/map',        icon: Map },
  { section: 'Pedidos' },
  { label: 'Pedidos de clientes', to: '/admin/pedidos', icon: Inbox },
  { section: 'Comunicação' },
  { label: 'Mensagens',   to: '/admin/mensagens', icon: MessageSquare },
  { section: 'Financeiro' },
  { label: 'Faturação',   to: '/billing',    icon: Receipt },
  { section: 'Mercado' },
  { label: 'Prospeção',   to: '/market',     icon: TrendingUp },
]

const NAV_PERITO: NavItem[] = [
  { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard },
  { label: 'Clientes',    to: '/clients',    icon: Users },
  { label: 'Projetos',    to: '/portfolios', icon: Briefcase },
  { label: 'Imóveis',     to: '/properties', icon: Building2 },
  { label: 'Mapa',        to: '/map',        icon: Map },
  { section: 'Financeiro' },
  { label: 'Faturação',   to: '/billing',    icon: Receipt },
  { section: 'Mercado' },
  { label: 'Prospeção',   to: '/market',     icon: TrendingUp },
  { section: 'Conta' },
  { label: 'O meu perfil', to: '/perfil',     icon: UserCircle },
  { label: 'Mensagens',    to: '/mensagens',  icon: MessageSquare },
]

const NAV_CLIENTE: NavItem[] = [
  { label: 'Dashboard',   to: '/cliente/dashboard', icon: LayoutDashboard },
  { label: 'Pedidos',     to: '/cliente/pedidos',   icon: Inbox },
  { label: 'Imóveis',     to: '/cliente/imoveis',   icon: Building2 },
  { label: 'Documentos',  to: '/cliente/documentos', icon: FileText },
  { section: 'Conta' },
  { label: 'O meu perfil', to: '/cliente/perfil',   icon: UserCircle },
]

function navForRole(role: string | null): NavItem[] {
  if (role === 'admin')   return NAV_ADMIN
  if (role === 'cliente') return NAV_CLIENTE
  return NAV_PERITO
}

function NavItems({ onClose }: { onClose?: () => void }) {
  const { name, role, signOut } = useAuth()
  const { toggle, open: calcOpen, el: calcEl } = useCalculator()
  const nav = navForRole(role)
  return (
    <>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map((item, i) => {
          if ('section' in item) return (
            <p key={i} className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{item.section}</p>
          )
          const Icon = item.icon!
          return (
            <NavLink key={item.to} to={item.to!} end={item.to!.endsWith('/dashboard')}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors
                 ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }>
              <Icon size={16}/>{item.label}
            </NavLink>
          )
        })}
      </nav>
      {role !== 'cliente' && (
        <div className="px-2 pb-2">
          <button onClick={toggle} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full transition-colors ${calcOpen ? 'bg-brand-50 text-brand-600' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Calculator size={16}/>
            Calculadora
          </button>
        </div>
      )}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{name || '—'}</p>
            <p className="text-[10px] text-gray-400">
              {role === 'admin' ? 'Administrador' : role === 'cliente' ? 'Cliente' : 'Perito Avaliador'}
            </p>
          </div>
          <button onClick={signOut} title="Sair"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
            <LogOut size={14}/>
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-2">v0.7.0</p>
      </div>
      {calcEl}
    </>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-[220px] bg-white border-r border-gray-100 flex-col z-30">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-semibold text-gray-900">Add-<span className="text-brand-400">valiador</span></span>
        </div>
        <NavItems/>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-40 flex items-center justify-between px-4">
        <span className="text-base font-semibold text-gray-900">Add-<span className="text-brand-400">valiador</span></span>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
          <Menu size={20}/>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)}/>
          {/* Drawer */}
          <div className="relative w-72 bg-white h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="text-lg font-semibold text-gray-900">Add-<span className="text-brand-400">valiador</span></span>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={18}/>
              </button>
            </div>
            <NavItems onClose={() => setOpen(false)}/>
          </div>
        </div>
      )}
    </>
  )
}
