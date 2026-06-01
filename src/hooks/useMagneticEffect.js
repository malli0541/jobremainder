import { useEffect } from 'react'

export default function useMagneticEffect() {
  useEffect(() => {
    const strength = 0.18

    const reset = (element) => {
      element.style.setProperty('--mag-x', '0px')
      element.style.setProperty('--mag-y', '0px')
    }

    const handlePointerMove = (event) => {
      const element = event.target.closest('.magnetic')
      if (!element) return

      const rect = element.getBoundingClientRect()
      const x = (event.clientX - rect.left - rect.width / 2) * strength
      const y = (event.clientY - rect.top - rect.height / 2) * strength

      element.style.setProperty('--mag-x', `${x.toFixed(2)}px`)
      element.style.setProperty('--mag-y', `${y.toFixed(2)}px`)
    }

    const handlePointerOut = (event) => {
      const element = event.target.closest('.magnetic')
      if (!element || element.contains(event.relatedTarget)) return
      reset(element)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerout', handlePointerOut)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerout', handlePointerOut)
    }
  }, [])
}
