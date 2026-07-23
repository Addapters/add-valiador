import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Building2, Briefcase, Map, Receipt, TrendingUp, Users, LogOut, Menu, X, Calculator, Inbox, MessageSquare, UserCircle, FileText, BadgeCheck, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useCalculator } from '@/components/Calculator'

type NavItem = { label: string; to: string; icon: any; sub?: boolean; badge?: 'messages' } | { section: string }

// "Imóveis" passou a ser um grupo colapsável — Prospeção, Mapa e Calculadora
// ficam lá dentro como sub-entradas, fechado por defeito.
const IMOVEIS_GROUP_PATHS = ['/properties', '/market', '/map']

const NAV_ADMIN: NavItem[] = [
  { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard },
  { label: 'Clientes',    to: '/clients',    icon: Users },
  { label: 'Projetos',    to: '/portfolios', icon: Briefcase },
  { label: 'Imóveis',     to: '/properties', icon: Building2 },
  { section: 'Pedidos' },
  { label: 'Pedidos de clientes', to: '/admin/pedidos', icon: Inbox },
  { section: 'Peritos' },
  { label: 'Gestão de peritos', to: '/admin/peritos', icon: BadgeCheck },
  { section: 'Comunicação' },
  { label: 'Mensagens',   to: '/admin/mensagens', icon: MessageSquare, badge: 'messages' },
  { section: 'Financeiro' },
  { label: 'Faturação',   to: '/billing',    icon: Receipt },
]

const NAV_PERITO: NavItem[] = [
  { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard },
  { label: 'Imóveis',     to: '/properties', icon: Building2 },
  { section: 'Conta' },
  { label: 'O meu perfil', to: '/perfil',     icon: UserCircle },
  { label: 'Mensagens',   to: '/mensagens',  icon: MessageSquare, sub: true, badge: 'messages' },
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
  const { name, role, user, signOut } = useAuth()
  const { toggle, open: calcOpen, el: calcEl } = useCalculator()
  const nav = navForRole(role)
  const location = useLocation()
  const [imoveisOpen, setImoveisOpen] = useState(() => IMOVEIS_GROUP_PATHS.some(p => location.pathname.startsWith(p)))

  // Mensagens novas — mostra o número de conversas por ler junto ao item Mensagens.
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['sidebar-unread-messages', role, user?.id],
    queryFn: async () => {
      if (!user || role === 'cliente') return 0
      let q = supabase.from('messages').select('id', { count: 'exact', head: true }).neq('remetente_id', user.id).is('lida_at', null)
      if (role === 'perito') q = q.eq('perito_id', user.id)
      const { count } = await q
      return count || 0
    },
    enabled: !!user && role !== 'cliente',
    refetchInterval: 30000,
  })

  return (
    <>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map((item, i) => {
          if ('section' in item) return (
            <p key={i} className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{item.section}</p>
          )
          const Icon = item.icon!
          const showBadge = item.badge === 'messages' && unreadCount > 0

          // "Imóveis" é um grupo colapsável — Prospeção, Mapa e Calculadora ficam
          // dentro dele como sub-entradas, fechado por defeito.
          if (item.to === '/properties') {
            const groupActive = IMOVEIS_GROUP_PATHS.some(p => location.pathname.startsWith(p))
            return (
              <div key={item.to} className="mb-0.5">
                <div className={`flex items-center rounded-lg text-sm transition-colors ${groupActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                  <button onClick={() => setImoveisOpen(o => !o)} title={imoveisOpen ? 'Fechar' : 'Abrir'}
                    className="pl-3 pr-1 py-2.5 text-gray-400 hover:text-gray-600">
                    {imoveisOpen ? <ChevronDown size={14}/> : <ChevronRightIcon size={14}/>}
                  </button>
                  <NavLink to={item.to!} onClick={onClose} className="flex items-center gap-2.5 pr-3 py-2.5 flex-1 min-w-0">
                    <Icon size={16}/>
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                </div>
                {imoveisOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    <NavLink to="/market" onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg text-[13px] ml-4 pl-2.5 pr-3 py-2 transition-colors
                         ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
                      }>
                      <TrendingUp size={14}/>
                      <span className="flex-1">Prospeção</span>
                    </NavLink>
                    <NavLink to="/map" onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg text-[13px] ml-4 pl-2.5 pr-3 py-2 transition-colors
                         ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
                      }>
                      <Map size={14}/>
                      <span className="flex-1">Mapa</span>
                    </NavLink>
                    <button onClick={toggle}
                      className={`flex items-center gap-2.5 rounded-lg text-[13px] ml-4 pl-2.5 pr-3 py-2 w-[calc(100%-1rem)] transition-colors ${calcOpen ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                      <Calculator size={14}/>
                      <span className="flex-1 text-left">Calculadora</span>
                    </button>
                  </div>
                )}
              </div>
            )
          }

          return (
            <NavLink key={item.to} to={item.to!} end={item.to!.endsWith('/dashboard')}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg text-sm mb-0.5 transition-colors
                 ${item.sub ? 'ml-4 pl-2.5 pr-3 py-2 text-[13px]' : 'pl-3 pr-3 py-2.5'}
                 ${isActive ? 'bg-brand-50 text-brand-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
              }>
              {/* Espaçador que reproduz a largura da seta do grupo "Imóveis", para que
                  todas as entradas fiquem alinhadas com o ícone desse grupo. */}
              {!item.sub && <span className="w-2 flex-shrink-0" />}
              <Icon size={item.sub ? 14 : 16}/>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-blue-500 text-white">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
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
