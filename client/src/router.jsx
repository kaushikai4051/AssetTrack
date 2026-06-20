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
      { path: 'assets/bonds', element: <PlaceholderPage title="Bonds" /> },
      { path: 'assets/govt-schemes', element: <GovtSchemes /> },
      { path: 'assets/insurance', element: <PlaceholderPage title="Insurance" /> },
      { path: 'assets/real-estate', element: <PlaceholderPage title="Real Estate" /> },
      { path: 'assets/loans', element: <PlaceholderPage title="Loans" /> },
      { path: 'assets/alternatives', element: <PlaceholderPage title="Alternatives" /> },
      { path: 'goals', element: <PlaceholderPage title="Goals" /> },
      { path: 'tax', element: <PlaceholderPage title="Tax" /> },
      { path: 'reports', element: <PlaceholderPage title="Reports" /> },
      { path: 'family', element: <PlaceholderPage title="Family" /> },
      { path: 'alerts', element: <PlaceholderPage title="Alerts" /> },
      { path: 'settings', element: <PlaceholderPage title="Settings" /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default router
