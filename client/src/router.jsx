import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import Login from '@/pages/Auth/Login'
import Register from '@/pages/Auth/Register'
import Dashboard from '@/pages/Dashboard'
import BankAccounts from '@/pages/BankAccounts'
import MutualFunds from '@/pages/MutualFunds'
import Stocks from '@/pages/Stocks'
import Gold from '@/pages/Gold'
import GovtSchemes from '@/pages/GovtSchemes'
import Loans from '@/pages/Loans'
import Bonds from '@/pages/Bonds'
import Insurance from '@/pages/Insurance'
import RealEstate from '@/pages/RealEstate'
import Goals from '@/pages/Goals'
import Tax from '@/pages/Tax'
import Analytics from '@/pages/Analytics'
import PlaceholderPage from '@/pages/PlaceholderPage'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'assets/bank-accounts', element: <BankAccounts /> },
      { path: 'assets/mutual-funds', element: <MutualFunds /> },
      { path: 'assets/stocks', element: <Stocks /> },
      { path: 'assets/gold', element: <Gold /> },
      { path: 'assets/bonds', element: <Bonds /> },
      { path: 'assets/govt-schemes', element: <GovtSchemes /> },
      { path: 'assets/insurance', element: <Insurance /> },
      { path: 'assets/real-estate', element: <RealEstate /> },
      { path: 'assets/loans', element: <Loans /> },
      { path: 'assets/alternatives', element: <PlaceholderPage title="Alternatives" /> },
      { path: 'goals', element: <Goals /> },
      { path: 'tax', element: <Tax /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'reports', element: <PlaceholderPage title="Reports" /> },
      { path: 'family', element: <PlaceholderPage title="Family" /> },
      { path: 'alerts', element: <PlaceholderPage title="Alerts" /> },
      { path: 'settings', element: <PlaceholderPage title="Settings" /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default router
