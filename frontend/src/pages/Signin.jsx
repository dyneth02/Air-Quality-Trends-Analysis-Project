import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import AuroraBackground from '../components/common/AuroraBackground'
import AuroraButton from '../components/common/AuroraButton'
import DarkInputField from '../components/common/DarkInputField'
import Header from '../components/Header'

export default function Signin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/workspace')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
      <div className="w-screen min-h-screen bg-gray-950 text-white relative overflow-x-hidden">
        <AuroraBackground />
        <Header />

        <div className="relative z-10 flex items-center justify-center min-h-[80vh] px-4">
          <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
          >
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  Sign In
                </h1>
                <p className="text-gray-400 mt-2">Access your AirSense workspace</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <DarkInputField
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <div className="relative">
                  <DarkInputField
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                  />
                  <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors focus:outline-none rounded-3xl border-none bg-transparent"
                  >
                    {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                    )}
                  </button>
                </div>

                {error && (
                    <div className="text-red-400 text-sm text-center">{error}</div>
                )}

                <AuroraButton
                    type="submit"
                    disabled={loading}
                    className="w-full"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </AuroraButton>
              </form>

              <div className="text-center mt-6">
                <p className="text-gray-400">
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">
                    Create account
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
  )
}