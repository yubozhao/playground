import { useEffect, useRef, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartOptions,
} from 'chart.js'
import { stockApi } from '../../services/api'
import { HistoricalDataPoint } from '../../types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler)

interface MiniChartProps {
  ticker: string
  currentPrice: number
  change: number
  height?: number
}

export default function MiniChart({ ticker, currentPrice, change, height = 50 }: MiniChartProps) {
  const [data, setData] = useState<HistoricalDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const fetchMiniChartData = async () => {
      if (!ticker) return

      setIsLoading(true)
      try {
        const response = await stockApi.getHistoricalData(ticker, '1D')
        if (response.success && mountedRef.current) {
          setData(response.data.slice(-20)) // Last 20 data points for mini chart
        }
      } catch (error) {
        console.error('Error fetching mini chart data:', error)
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    fetchMiniChartData()
  }, [ticker])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="loading-shimmer w-full h-full rounded"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400" style={{ height }}>
        <span className="text-xs">No chart data</span>
      </div>
    )
  }

  const isPositive = change >= 0
  const chartColor = isPositive ? '#10b981' : '#ef4444'
  const backgroundGradient = isPositive ? 
    'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'

  const chartData = {
    labels: data.map(() => ''), // Empty labels for mini chart
    datasets: [
      {
        data: data.map(point => point.close),
        borderColor: chartColor,
        backgroundColor: backgroundGradient,
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        display: false,
        grid: {
          display: false,
        },
      },
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 0,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    animation: {
      duration: 0, // Disable animations for mini chart
    },
  }

  return (
    <div className="w-full" style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  )
}