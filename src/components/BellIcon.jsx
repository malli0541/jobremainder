import React from 'react'

export default function BellIcon({ className = '' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15.5 18.5a3.5 3.5 0 0 1-7 0M18 9.6c0-3.35-2.15-5.85-5.15-6.35a1 1 0 0 0-1.7 0C8.15 3.75 6 6.25 6 9.6v2.75c0 .76-.3 1.49-.84 2.03L4 15.54V17h16v-1.46l-1.16-1.16A2.87 2.87 0 0 1 18 12.35V9.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
