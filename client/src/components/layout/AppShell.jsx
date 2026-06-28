import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import useUiStore from '@/store/uiStore'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

export default function AppShell() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const initTheme = useUiStore((state) => state.initTheme)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    initTheme(user?.id)
  }, [user?.id, initTheme])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col flex-1 overflow-hidden transition-all duration-200',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
