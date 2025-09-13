import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useStockStore } from '../store/stockStore'
import { PriceUpdate, AlertNotification } from '../types'
import toast from 'react-hot-toast'

interface UseWebSocketReturn {
  socket: Socket | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  subscribe: (tickers: string[]) => void
  unsubscribe: (tickers: string[]) => void
}

export function useWebSocket(): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const { token } = useAuthStore()
  const { handlePriceUpdate, setMarketStatus } = useStockStore()

  const connect = useCallback(() => {
    if (socketRef.current?.connected || !token) {
      return
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const socket = io('/', {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('WebSocket connected')
      isConnectedRef.current = true
      reconnectAttempts.current = 0
      toast.success('Real-time connection established')
    })

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      isConnectedRef.current = false
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't auto-reconnect
        toast.error('Connection terminated by server')
      } else {
        // Client or network issue, will auto-reconnect
        toast.error('Connection lost. Attempting to reconnect...')
      }
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      reconnectAttempts.current++
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        toast.error('Failed to establish connection. Please refresh the page.')
      }
    })

    socket.on('price_update', (data: PriceUpdate) => {
      try {
        handlePriceUpdate(data)
      } catch (error) {
        console.error('Error handling price update:', error)
      }
    })

    socket.on('alert', (data: AlertNotification) => {
      try {
        // Show alert notification to user
        const message = `${data.ticker} alert: ${data.message}`
        
        if (data.alertType === 'PRICE_UP') {
          toast.success(message, {
            duration: 6000,
            icon: '📈',
          })
        } else {
          toast.error(message, {
            duration: 6000,
            icon: '📉',
          })
        }

        // Play notification sound if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Stock Alert: ${data.ticker}`, {
            body: data.message,
            icon: '/favicon.ico',
            tag: `alert-${data.ticker}`,
          })
        }
      } catch (error) {
        console.error('Error handling alert notification:', error)
      }
    })

    socket.on('market_status', (data: { status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS' }) => {
      try {
        setMarketStatus(data.status)
      } catch (error) {
        console.error('Error handling market status update:', error)
      }
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log(`WebSocket reconnected after ${attemptNumber} attempts`)
      toast.success('Connection restored')
    })

    socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed')
      toast.error('Unable to restore connection. Please refresh the page.')
    })

  }, [token, handlePriceUpdate, setMarketStatus])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    
    isConnectedRef.current = false
    reconnectAttempts.current = 0
  }, [])

  const subscribe = useCallback((tickers: string[]) => {
    if (socketRef.current?.connected && tickers.length > 0) {
      socketRef.current.emit('subscribe', { tickers })
    }
  }, [])

  const unsubscribe = useCallback((tickers: string[]) => {
    if (socketRef.current?.connected && tickers.length > 0) {
      socketRef.current.emit('unsubscribe', { tickers })
    }
  }, [])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('Notification permission granted')
        }
      })
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  }
}