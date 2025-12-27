import { motion, AnimatePresence } from 'framer-motion'
import CloudIcon from './icons/CloudIcon'
import BarChartIcon from './icons/BarChartIcon'
import CpuIcon from './icons/CpuIcon'
import MessageIcon from './icons/MessageIcon'

export default function FloatingNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'data', label: 'Data Collection', icon: CloudIcon },
    { id: 'compare', label: 'City Analysis', icon: BarChartIcon },
    { id: 'forecast', label: 'AI Forecast', icon: CpuIcon },
    { id: 'assistant', label: 'AI Assistant', icon: MessageIcon },
  ]

  return (
    <motion.nav 
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        duration: 0.6, 
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: 0.3
      }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-2 shadow-2xl">
        <div className="flex gap-1">
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 rounded-xl font-medium text-sm flex items-center gap-2 relative overflow-hidden ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.4, 
                  ease: [0.25, 0.46, 0.45, 0.94],
                  delay: 0.1 + index * 0.05
                }}
                whileHover={{ 
                  scale: 1.02,
                  transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }
                }}
                whileTap={{ 
                  scale: 0.98,
                  transition: { duration: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }
                }}
              >
                {/* Active background with smooth animation */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 rounded-xl"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        duration: 0.3, 
                        ease: [0.25, 0.46, 0.45, 0.94]
                      }}
                      layoutId="activeTab"
                    />
                  )}
                </AnimatePresence>
                
                {/* Hover background */}
                <motion.div
                  className="absolute inset-0 bg-gray-800/50 rounded-xl"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
                
                {/* Content */}
                <div className="relative z-10 flex items-center gap-2">
                  <motion.div
                    animate={{ 
                      scale: isActive ? 1.1 : 1,
                      rotate: isActive ? 5 : 0
                    }}
                    transition={{ 
                      duration: 0.3, 
                      ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                  >
                    <Icon />
                  </motion.div>
                  <motion.span
                    animate={{ 
                      fontWeight: isActive ? 600 : 500
                    }}
                    transition={{ 
                      duration: 0.3, 
                      ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                  >
                    {tab.label}
                  </motion.span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}


