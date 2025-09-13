import { useState, useEffect } from 'react'
import { Bell, Plus, Settings, Trash2, Edit, AlertCircle } from 'lucide-react'
import { useStockStore } from '../store/stockStore'
import { alertApi } from '../services/api'
import { PriceAlert, AlertNotification } from '../types'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function AlertCenter() {
  const { alerts, addAlert, updateAlert, removeAlert } = useStockStore()
  const [alertHistory, setAlertHistory] = useState<AlertNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAlert, setNewAlert] = useState({
    ticker: '',
    alertType: 'PERCENT_CHANGE' as const,
    thresholdPercent: 5,
    thresholdValue: 0,
  })

  useEffect(() => {
    loadAlertHistory()
  }, [])

  const loadAlertHistory = async () => {
    setIsLoading(true)
    try {
      const response = await alertApi.getHistory(1, 50)
      if (response.success) {
        setAlertHistory(response.data.items)
      }
    } catch (error) {
      console.error('Error loading alert history:', error)
      toast.error('Failed to load alert history')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newAlert.ticker.trim()) {
      toast.error('Please enter a stock ticker')
      return
    }

    try {
      const alertData = {
        ticker: newAlert.ticker.toUpperCase(),
        alertType: newAlert.alertType,
        isActive: true,
        ...(newAlert.alertType === 'PERCENT_CHANGE' 
          ? { thresholdPercent: newAlert.thresholdPercent }
          : { thresholdValue: newAlert.thresholdValue }
        ),
      }

      const response = await alertApi.create(alertData)
      if (response.success) {
        addAlert(response.data)
        setNewAlert({
          ticker: '',
          alertType: 'PERCENT_CHANGE',
          thresholdPercent: 5,
          thresholdValue: 0,
        })
        setShowCreateForm(false)
        toast.success('Alert created successfully')
      } else {
        toast.error(response.error || 'Failed to create alert')
      }
    } catch (error) {
      console.error('Error creating alert:', error)
      toast.error('Failed to create alert')
    }
  }

  const handleToggleAlert = async (alert: PriceAlert) => {
    try {
      const response = await alertApi.update(alert.id, { isActive: !alert.isActive })
      if (response.success) {
        updateAlert(alert.id, { isActive: !alert.isActive })
        toast.success(`Alert ${!alert.isActive ? 'enabled' : 'disabled'}`)
      } else {
        toast.error(response.error || 'Failed to update alert')
      }
    } catch (error) {
      console.error('Error updating alert:', error)
      toast.error('Failed to update alert')
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const response = await alertApi.delete(alertId)
      if (response.success) {
        removeAlert(alertId)
        toast.success('Alert deleted successfully')
      } else {
        toast.error(response.error || 'Failed to delete alert')
      }
    } catch (error) {
      console.error('Error deleting alert:', error)
      toast.error('Failed to delete alert')
    }
  }

  const formatAlertThreshold = (alert: PriceAlert) => {
    if (alert.thresholdPercent) {
      return `±${alert.thresholdPercent}%`
    } else if (alert.thresholdValue) {
      return alert.alertType === 'ABOVE' ? `>$${alert.thresholdValue}` : `<$${alert.thresholdValue}`
    }
    return 'N/A'
  }

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'PERCENT_CHANGE':
        return 'Price Change'
      case 'ABOVE':
        return 'Price Above'
      case 'BELOW':
        return 'Price Below'
      default:
        return type
    }
  }

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'PRICE_UP':
        return '📈'
      case 'PRICE_DOWN':
        return '📉'
      default:
        return '🔔'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alert Center</h1>
          <p className="text-slate-600">Manage your price alerts and notifications</p>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Alert</span>
        </button>
      </div>

      {/* Create Alert Form */}
      {showCreateForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New Alert</h3>
          
          <form onSubmit={handleCreateAlert} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stock Ticker
                </label>
                <input
                  type="text"
                  value={newAlert.ticker}
                  onChange={(e) => setNewAlert({ ...newAlert, ticker: e.target.value.toUpperCase() })}
                  placeholder="e.g., AAPL"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Alert Type
                </label>
                <select
                  value={newAlert.alertType}
                  onChange={(e) => setNewAlert({ ...newAlert, alertType: e.target.value as any })}
                  className="input-field"
                >
                  <option value="PERCENT_CHANGE">Price Change (%)</option>
                  <option value="ABOVE">Price Above</option>
                  <option value="BELOW">Price Below</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {newAlert.alertType === 'PERCENT_CHANGE' ? 'Percentage Threshold' : 'Price Threshold'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={newAlert.alertType === 'PERCENT_CHANGE' ? '0.1' : '0.01'}
                  min={newAlert.alertType === 'PERCENT_CHANGE' ? '0.1' : '0.01'}
                  value={newAlert.alertType === 'PERCENT_CHANGE' ? newAlert.thresholdPercent : newAlert.thresholdValue}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    if (newAlert.alertType === 'PERCENT_CHANGE') {
                      setNewAlert({ ...newAlert, thresholdPercent: value })
                    } else {
                      setNewAlert({ ...newAlert, thresholdValue: value })
                    }
                  }}
                  className="input-field pr-8"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-slate-500 text-sm">
                    {newAlert.alertType === 'PERCENT_CHANGE' ? '%' : '$'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <button type="submit" className="btn-primary">
                Create Alert
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Alerts */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Active Alerts</h2>
        </div>

        {alerts.length === 0 ? (
          <div className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No alerts configured</h3>
            <p className="text-slate-600 mb-4">
              Create your first alert to get notified about significant price movements.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary"
            >
              Create Your First Alert
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-6 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-slate-900">{alert.ticker}</span>
                    <span className="text-sm text-slate-600">
                      {getAlertTypeLabel(alert.alertType)}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatAlertThreshold(alert)}
                    </span>
                    <span
                      className={clsx(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        alert.isActive
                          ? 'bg-success-100 text-success-800'
                          : 'bg-slate-100 text-slate-800'
                      )}
                    >
                      {alert.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Created {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleAlert(alert)}
                    className={clsx(
                      'p-2 rounded hover:bg-slate-100 transition-colors',
                      alert.isActive ? 'text-success-600' : 'text-slate-400'
                    )}
                    title={alert.isActive ? 'Disable alert' : 'Enable alert'}
                  >
                    <Bell className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="p-2 rounded hover:bg-slate-100 text-slate-400 hover:text-danger-600 transition-colors"
                    title="Delete alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Recent Notifications</h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : alertHistory.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No notifications yet. Your alerts will appear here once triggered.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {alertHistory.map((notification) => (
              <div key={notification.id} className="p-6 flex items-start space-x-4">
                <div className="text-2xl">
                  {getNotificationTypeIcon(notification.alertType)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {notification.ticker} Alert Triggered
                  </p>
                  <p className="text-sm text-slate-600">
                    {notification.message}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDistanceToNow(new Date(notification.triggeredAt), { addSuffix: true })} •{' '}
                    Delivered via {notification.deliveredVia.toLowerCase()}
                  </p>
                </div>

                <div
                  className={clsx(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                    {
                      'bg-success-100 text-success-800': notification.deliveryStatus === 'DELIVERED',
                      'bg-yellow-100 text-yellow-800': notification.deliveryStatus === 'PENDING',
                      'bg-danger-100 text-danger-800': notification.deliveryStatus === 'FAILED',
                    }
                  )}
                >
                  {notification.deliveryStatus.toLowerCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}