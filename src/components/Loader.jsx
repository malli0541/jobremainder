import React from 'react'

export default function Loader({ className='' }){
  return (
    <span className={`loader ${className}`} aria-hidden>
      <span className="dot" style={{background:'currentColor'}} />
      <span className="dot" style={{background:'currentColor'}} />
      <span className="dot" style={{background:'currentColor'}} />
    </span>
  )
}
