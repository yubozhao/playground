import { Search, Bell, User, LogOut } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import SearchComponent from '../stock/SearchComponent'
import { StockSearchResult } from '../../types'
import { useNavigate } from 'react-router-dom'

export default function Header() {
  const { user, logout } = useAuthStore()
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStockSelect = (stock: StockSearchResult) => {
    setShowSearch(false)
    navigate(`/stock/${stock.ticker}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleBellClick = () => {
    navigate('/alerts')
  }

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Stock Price Dashboard
        </h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Global Search */}
        <div className="relative" ref={searchRef}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Search stocks"
          >
            <Search className="w-5 h-5 text-slate-600" />
          </button>
          
          {showSearch && (
            <div className="absolute right-0 top-12 w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <div className="p-4">
                <SearchComponent
                  onStockSelect={handleStockSelect}
                  placeholder="Search for stocks..."
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          onClick={handleBellClick}
          className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="View alerts"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          {/* Notification badge - could be dynamic based on unread alerts */}
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
        </button>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {user?.email}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <div className="py-2">
                <div className="px-4 py-2 border-b border-slate-200">
                  <p className="text-sm font-medium text-slate-900">{user?.email}</p>
                  <p className="text-xs text-slate-500">Personal Account</p>
                </div>
                
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/settings')
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>Profile Settings</span>
                </button>
                
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    navigate('/alerts')
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  <span>Notification Settings</span>
                </button>

                <div className="border-t border-slate-200 mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-danger-600 hover:bg-slate-100 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}