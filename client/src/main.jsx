import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import Login from './pages/Auth/Login'
import Dashboard from './pages/Dashboard'
import NewRequest from './pages/StoreManager/NewRequest'
import MyRequests from './pages/StoreManager/MyRequests'
import RequestDetail from './pages/StoreManager/RequestDetail'
import PendingRequests from './pages/RunnerBoy/PendingRequests'
import CreatePurchase from './pages/RunnerBoy/CreatePurchase'
import MyPurchases from './pages/RunnerBoy/MyPurchases'
import PurchasesReview from './pages/Accountant/PurchasesReview'
import PurchaseDetail from './pages/Accountant/PurchaseDetail'
import Payments from './pages/Accountant/Payments'
import Reports from './pages/Accountant/Reports'
import MasterData from './pages/Accountant/MasterData'
import Users from './pages/Accountant/Users'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner-wrap"><div className="spinner"></div></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  const isAccountantOrCeo = user?.role === 'ACCOUNTANT' || user?.role === 'CEO'
  const isAccountant = user?.role === 'ACCOUNTANT'

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/* Store Manager */}
      <Route path="/requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
      <Route path="/requests/new" element={<ProtectedRoute roles={['STORE_MANAGER', 'ACCOUNTANT']}><NewRequest /></ProtectedRoute>} />
      <Route path="/requests/:id" element={<ProtectedRoute><RequestDetail /></ProtectedRoute>} />
      <Route path="/requests/:id/edit" element={<ProtectedRoute roles={['STORE_MANAGER', 'ACCOUNTANT']}><NewRequest /></ProtectedRoute>} />

      {/* Runner Boy */}
      <Route path="/pending-requests" element={<ProtectedRoute roles={['RUNNER_BOY', 'ACCOUNTANT']}><PendingRequests /></ProtectedRoute>} />
      <Route path="/pending-requests/:id/purchase" element={<ProtectedRoute roles={['RUNNER_BOY', 'ACCOUNTANT']}><CreatePurchase /></ProtectedRoute>} />
      <Route path="/my-purchases" element={<ProtectedRoute roles={['RUNNER_BOY', 'ACCOUNTANT']}><MyPurchases /></ProtectedRoute>} />

      {/* Accountant & CEO */}
      <Route path="/purchases" element={<ProtectedRoute roles={['ACCOUNTANT', 'CEO']}><PurchasesReview /></ProtectedRoute>} />
      <Route path="/purchases/:id" element={<ProtectedRoute roles={['ACCOUNTANT', 'CEO', 'RUNNER_BOY', 'STORE_MANAGER']}><PurchaseDetail /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute roles={['ACCOUNTANT']}><Payments /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={['ACCOUNTANT', 'CEO']}><Reports /></ProtectedRoute>} />
      <Route path="/master" element={<ProtectedRoute roles={['ACCOUNTANT']}><MasterData /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['ACCOUNTANT']}><Users /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { background: '#21262d', color: '#e6edf3', border: '1px solid #30363d' },
          success: { iconTheme: { primary: '#3fb950', secondary: '#000' } },
          error: { iconTheme: { primary: '#f85149', secondary: '#000' } },
        }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
