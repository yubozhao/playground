import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp, Check } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { clsx } from 'clsx'

export default function Register() {
  const navigate = useNavigate()
  const { register, isLoading, isAuthenticated } = useAuthStore()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const passwordStrength = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  }

  const passwordStrengthScore = Object.values(passwordStrength).filter(Boolean).length
  const passwordStrengthLabel = {
    0: 'Very Weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
    5: 'Very Strong',
  }[passwordStrengthScore] as string

  const passwordStrengthColor = {
    0: 'bg-danger-500',
    1: 'bg-danger-500',
    2: 'bg-yellow-500',
    3: 'bg-yellow-500',
    4: 'bg-success-500',
    5: 'bg-success-500',
  }[passwordStrengthScore] as string

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (passwordStrengthScore < 3) {
      newErrors.password = 'Password is too weak. Please use a stronger password.'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const success = await register(formData.email, formData.password)
    if (success) {
      navigate('/dashboard', { replace: true })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center space-x-2 mb-6">
          <TrendingUp className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gradient">StockTracker</h1>
        </div>
        
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:text-primary-500"
          >
            Sign in here
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input-field ${errors.email ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-danger-600">{errors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input-field pr-10 ${errors.password ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div
                        className={clsx('h-2 rounded-full transition-all', passwordStrengthColor)}
                        style={{ width: `${(passwordStrengthScore / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-600">{passwordStrengthLabel}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={clsx('flex items-center space-x-1', passwordStrength.length ? 'text-success-600' : 'text-slate-400')}>
                      <Check className="w-3 h-3" />
                      <span>8+ characters</span>
                    </div>
                    <div className={clsx('flex items-center space-x-1', passwordStrength.uppercase ? 'text-success-600' : 'text-slate-400')}>
                      <Check className="w-3 h-3" />
                      <span>Uppercase</span>
                    </div>
                    <div className={clsx('flex items-center space-x-1', passwordStrength.lowercase ? 'text-success-600' : 'text-slate-400')}>
                      <Check className="w-3 h-3" />
                      <span>Lowercase</span>
                    </div>
                    <div className={clsx('flex items-center space-x-1', passwordStrength.number ? 'text-success-600' : 'text-slate-400')}>
                      <Check className="w-3 h-3" />
                      <span>Number</span>
                    </div>
                  </div>
                </div>
              )}

              {errors.password && (
                <p className="mt-1 text-sm text-danger-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`input-field pr-10 ${errors.confirmPassword ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-danger-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full justify-center"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="btn-secondary w-full justify-center"
            >
              Back to sign in
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-slate-700">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="underline hover:text-slate-700">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}