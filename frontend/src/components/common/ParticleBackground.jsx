import { useEffect, useRef } from 'react'

export default function ParticleBackground() {
  const particlesRef = useRef(null)

  useEffect(() => {
    if (particlesRef.current) {
      const particles = particlesRef.current
      const count = 150
      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div')
        particle.className = 'absolute rounded-full bg-white'
        particle.style.width = `${Math.random() * 2 + 1}px`
        particle.style.height = particle.style.width
        particle.style.left = `${Math.random() * 100}%`
        particle.style.top = `${Math.random() * 100}%`
        particle.style.opacity = `${Math.random() * 0.5 + 0.1}`
        particle.style.animation = `float ${Math.random() * 20 + 10}s infinite ease-in-out`
        particle.style.animationDelay = `${Math.random() * 5}s`
        particles.appendChild(particle)
      }
    }
  }, [])

  return <div ref={particlesRef} className="fixed inset-0 -z-10 overflow-hidden" />
}


