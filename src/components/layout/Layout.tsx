import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar/>
      {/* Desktop: offset for sidebar. Mobile: offset for top bar */}
      <main className="md:ml-[220px] pt-14 md:pt-0 min-h-screen">
        <Outlet/>
      </main>
    </div>
  )
}
