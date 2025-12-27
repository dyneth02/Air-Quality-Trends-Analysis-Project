import { useEffect } from 'react'
import { useMotionTemplate, useMotionValue, motion, animate } from 'framer-motion'
import ParticleBackground from './ParticleBackground'
import { COLORS_TOP } from '../../utils/formatters'

export default function AuroraBackground() {
  const color = useMotionValue(COLORS_TOP[0])

  useEffect(() => {
    animate(color, COLORS_TOP, {
      ease: 'easeInOut',
      duration: 10,
      repeat: Infinity,
      repeatType: 'mirror',
    })
  }, [color])

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`

  return (
    <motion.div className="fixed inset-0 -z-10" style={{ backgroundImage }}>
      <ParticleBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950/80 to-gray-950" />
    </motion.div>
  )
}


