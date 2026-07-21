import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import Layout         from '@/components/layout/Layout'
import Login          from '@/components/modules/Login'
import Dashboard      from '@/components/modules/Dashboard'
import Clients        from '@/components/modules/Clients'
import Portfolios     from '@/components/modules/Portfolios'
import Properties     from '@/components/modules/Properties'
import PropertyDetail from '@/components/modules/PropertyDetail'
import PropertyMap    from '@/components/modules/PropertyMap'
import Billing        from '@/components/modules/Billing'
import MarketSearch   from '@/components/modules/MarketSearch'
import PropertyCreate from '@/components/modules/PropertyCreate'

// Admin
import AdminRequests  from '@/components/modules/admin/AdminRequests'
import AdminMessages  from '@/components/modules/admin/AdminMessages'
import AdminPeritos   from '@/components/modules/admin/AdminPeritos'

// Perito
import PeritoProfile  from '@/components/modules/perito/PeritoProfile'

// Cliente
import ClienteDashboard  from '@/components/modules/cliente/ClienteDashboard'
import ClienteRequests   from '@/components/modules/cliente/ClienteRequests'
import ClienteProperties from '@/components/modules/cliente/ClienteProperties'
import ClienteDocuments  from '@/components/modules/cliente/ClienteDocuments'
import ClienteProfile    from '@/components/modules/cliente/ClienteProfile'

// Rota inicial consoante o papel de quem faz login
function homeFor(role: string | null) {
  if (role === 'cliente') return '/cliente/dashboard'
  return '/dashboard'
}

// Bloqueia o acesso a um grupo de rotas a quem não tem o papel certo,
// redireccionando para a página inicial do seu próprio papel.
function RoleGate({ allow }: { allow: string[] }) {
  const { role } = useAuth()
  if (role && !allow.includes(role)) return <Navigate to={homeFor(role)} replace />
  return <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

function AppRoutes() {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">A carregar…</p>
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(role)} replace /> : <Login />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to={homeFor(role)} replace />} />

        {/* Admin + Perito — ferramentas internas de gestão de imóveis */}
        <Route element={<RoleGate allow={['admin','perito']} />}>
          <Route path="dashboard"      element={<Dashboard />} />
          <Route path="clients"        element={<Clients />} />
          <Route path="portfolios"     element={<Portfolios />} />
          <Route path="properties"     element={<Properties />} />
          <Route path="properties/new" element={<PropertyCreate />} />
          <Route path="properties/:id" element={<PropertyDetail />} />
          <Route path="map"            element={<PropertyMap />} />
          <Route path="billing"        element={<Billing />} />
          <Route path="market"         element={<MarketSearch />} />
        </Route>

        {/* Perito — perfil (inclui mensagens com o Admin como separador) */}
        <Route element={<RoleGate allow={['perito']} />}>
          <Route path="perfil" element={<PeritoProfile />} />
        </Route>

        {/* Admin — pedidos de clientes e mensagens com peritos */}
        <Route element={<RoleGate allow={['admin']} />}>
          <Route path="admin/pedidos"   element={<AdminRequests />} />
          <Route path="admin/mensagens" element={<AdminMessages />} />
          <Route path="admin/peritos"   element={<AdminPeritos />} />
        </Route>

        {/* Cliente — área dedicada */}
        <Route element={<RoleGate allow={['cliente']} />}>
          <Route path="cliente/dashboard"  element={<ClienteDashboard />} />
          <Route path="cliente/pedidos"    element={<ClienteRequests />} />
          <Route path="cliente/imoveis"    element={<ClienteProperties />} />
          <Route path="cliente/documentos" element={<ClienteDocuments />} />
          <Route path="cliente/perfil"     element={<ClienteProfile />} />
        </Route>
      </Route>
    </Routes>
  )
}
