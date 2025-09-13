import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { stockApi } from '../../services/api'
import { StockSearchResult, SearchComponentProps } from '../../types'
import { clsx } from 'clsx'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function SearchComponent({
  onStockSelect,
  placeholder = 'Search for stocks...',
  className,
}: SearchComponentProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query.trim())
      } else {
        setResults([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true)
    try {
      const response = await stockApi.search(searchQuery)
      if (response.success) {
        setResults(response.data)
        setShowResults(true)
        setSelectedIndex(-1)
      } else {
        setResults([])
        setShowResults(false)
      }
    } catch (error) {
      console.error('Stock search error:', error)
      setResults([])
      setShowResults(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleStockSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleStockSelect = (stock: StockSearchResult) => {
    onStockSelect(stock)
    setQuery('')
    setResults([])
    setShowResults(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatPrice = (price?: number) => {
    if (price === undefined) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatChange = (change?: number, changePercent?: number) => {
    if (change === undefined || changePercent === undefined) return null
    
    const sign = change >= 0 ? '+' : ''
    return `${sign}${formatPrice(change)} (${sign}${changePercent.toFixed(2)}%)`
  }

  return (
    <div className={clsx('relative', className)}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Search className="h-4 w-4 text-slate-400" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true)
            }
          }}
          placeholder={placeholder}
          className="input-field pl-10 pr-10"
          autoComplete="off"
          spellCheck="false"
        />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {results.map((stock, index) => (
            <button
              key={stock.ticker}
              onClick={() => handleStockSelect(stock)}
              className={clsx(
                'w-full px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none transition-colors',
                {
                  'bg-slate-50': index === selectedIndex,
                  'border-b border-slate-100': index < results.length - 1,
                }
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900">{stock.ticker}</span>
                    <span className="text-xs text-slate-500 uppercase">{stock.exchange}</span>
                  </div>
                  <p className="text-sm text-slate-600 truncate">{stock.companyName}</p>
                  {stock.industry && (
                    <p className="text-xs text-slate-500">{stock.industry}</p>
                  )}
                </div>
                
                {stock.price !== undefined && (
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-slate-900">
                      {formatPrice(stock.price)}
                    </div>
                    {stock.change !== undefined && stock.changePercent !== undefined && (
                      <div
                        className={clsx('text-xs', {
                          'text-success-600': stock.change >= 0,
                          'text-danger-600': stock.change < 0,
                        })}
                      >
                        {formatChange(stock.change, stock.changePercent)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query.trim() && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500">
          No stocks found matching "{query}"
        </div>
      )}
    </div>
  )
}