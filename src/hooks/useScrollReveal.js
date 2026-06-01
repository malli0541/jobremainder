import { useEffect } from 'react'

export default function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.reveal'))

    if (!elements.length) return

    if (!('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('revealed'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          observer.unobserve(entry.target)
        }
      })
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    })

    elements.forEach(element => observer.observe(element))

    return () => observer.disconnect()
  })
}
