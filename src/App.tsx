import { Routes, Route, Navigate } from 'react-router-dom'
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

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">A carregar…</p>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return (
    <Route path="/" element={<Layout />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard"      element={<Dashboard />} />
      <Route path="clients"        element={<Clients />} />
      <Route path="portfolios"     element={<Portfolios />} />
      <Route path="properties"     element={<Properties />} />
      <Route path="properties/:id" element={<PropertyDetail />} />
      <Route path="map"            element={<PropertyMap />} />
      <Route path="billing"        element={<Billing />} />
      <Route path="market"         element={<MarketSearch />} />
    </Route>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">A carregar…</p>
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<Dashboard />} />
        <Route path="clients"        element={<Clients />} />
        <Route path="portfolios"     element={<Portfolios />} />
        <Route path="properties"     element={<Properties />} />
        <Route path="properties/:id" element={<PropertyDetail />} />
        <Route path="map"            element={<PropertyMap />} />
        <Route path="billing"        element={<Billing />} />
        <Route path="market"         element={<MarketSearch />} />
      </Route>
    </Routes>
  )
}
