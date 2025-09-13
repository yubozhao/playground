import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import AlertCenter from './pages/AlertCenter'
import StockDetail from './pages/StockDetail'
import { useAuthStore } from './store/authStore'
import { useWebSocket } from './hooks/useWebSocket'
import ProtectedRoute from './components/auth/ProtectedRoute'

function App() {
  const { token, initializeAuth } = useAuthStore()
  const { connect, disconnect } = useWebSocket()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    if (token) {
      connect()
    } else {
      disconnect()
    }

    return () => disconnect()
  }, [token, connect, disconnect])

  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="alerts" element={<AlertCenter />} />
          <Route path="stock/:ticker" element={<StockDetail />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  )
}

export default App