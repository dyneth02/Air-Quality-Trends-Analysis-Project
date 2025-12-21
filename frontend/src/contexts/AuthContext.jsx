import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../utils/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = async () => {
    try {
      const userData = await authApi.me()
      setUser(userData)
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    await authApi.login(email, password)
    await loadMe()
  }

  const signup = async (email, password) => {
    const userData = await authApi.signup(email, password)
    setUser(userData)
    await loadMe() // Ensure user state is properly updated
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }

  useEffect(() => {
    loadMe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, loadMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

