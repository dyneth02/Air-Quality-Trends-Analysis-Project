import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuroraButton from './common/AuroraButton'
import CloudIcon from './common/icons/CloudIcon'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/signin')
  }

  return (
    <motion.header
      className="w-full bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-700/50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/home" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center">
            <CloudIcon />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mr-[19.25rem]">
            AirSense
          </h1>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          {["Home", "Workspace", "About", "FAQ"].map((item) => (
            <Link
              key={item}
              to={item === "Home" ? "/home" : item === "Workspace" ? "/workspace" : `/${item.toLowerCase()}`}
              className="text-gray-300 hover:text-white transition-colors duration-200 font-medium"
            >
              {item}
            </Link>
          ))}
        </nav>
        
        <div className="ml-auto">
          {!user ? (
            <div className="flex items-center gap-3">
              <Link to="/signin" className="text-gray-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link to="/signup">
                <AuroraButton variant="primary">
                  Get Started
                </AuroraButton>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                Plan: <span className="text-cyan-400 font-medium">{user.plan}</span>
              </div>
              <div className="relative group">
                <button className="text-gray-300 hover:text-white transition-colors">
                  {user.email}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="py-2">
                    <Link to="/workspace" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50">
                      Workspace
                    </Link>
                    <div className="px-4 py-2 text-xs text-gray-500">
                      Account: {user.plan}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/50"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  )
}

