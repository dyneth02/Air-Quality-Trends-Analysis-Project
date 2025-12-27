import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'

export default function ValidationModal({ isOpen, onClose, title, message, currentValue, maxValue, plan, fieldName }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getPlanLimits = (plan) => {
    const limits = {
      free: {
        'Days to Scrape': 7,
        'Analysis Period (days)': 7,
        'Forecast Horizon (days)': 7,
        'Training Window (days)': 7
      },
      pro: {
        'Days to Scrape': 30,
        'Analysis Period (days)': 30,
        'Forecast Horizon (days)': 7,
        'Training Window (days)': 30
      },
      enterprise: {
        'Days to Scrape': 90,
        'Analysis Period (days)': 90,
        'Forecast Horizon (days)': 30,
        'Training Window (days)': 90
      }
    }
    return limits[plan?.toLowerCase()] || limits.free
  }

  const limits = getPlanLimits(plan)
  const maxAllowed = limits[fieldName] || 7

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 300,
              duration: 0.3
            }}
            className="relative w-full max-w-md mt-[20rem] bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors duration-200"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="space-y-4">
                <div className="text-gray-300 leading-relaxed">
                  {message}
                </div>

                {/* Current vs Allowed Values */}
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Your {fieldName}:</span>
                      <span className="text-red-400 font-medium">{currentValue} days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Maximum allowed for {plan?.toLowerCase() || 'free'} plan:</span>
                      <span className="text-emerald-400 font-medium">{maxAllowed} days</span>
                    </div>
                  </div>
                </div>

                {/* Plan Benefits */}
                <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl p-4 border border-cyan-500/20">
                  <div className="text-sm text-cyan-200">
                    <div className="font-medium mb-2">Upgrade benefits:</div>
                    <ul className="space-y-1 text-xs">
                      {plan?.toLowerCase() === 'free' && (
                        <>
                          <li>• Pro: Up to 30 days for most features</li>
                          <li>• Enterprise: Up to 90 days for all features</li>
                        </>
                      )}
                      {plan?.toLowerCase() === 'pro' && (
                        <>
                          <li>• Enterprise: Up to 90 days for all features</li>
                          <li>• Advanced AI Assistant access</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-xl font-medium transition-all duration-200 border border-gray-700/50"
                  >
                    Got it
                  </button>
                  <button
                    onClick={() => {
                      // This would typically navigate to upgrade page
                      console.log('Navigate to upgrade page')
                      onClose()
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
