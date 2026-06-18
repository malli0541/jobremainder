import React from 'react'

const CONTACT_EMAIL = 'challa.nagamallikarjunarao@gmail.com'

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <p className="app-footer-copy">App Mallikarjuna &copy; 2026</p>
        <span className="app-footer-divider" aria-hidden="true">·</span>
        <p className="app-footer-text">For any issue, enquiry, or collaboration</p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Job%20Tracker%20Enquiry`}
          className="magnetic app-footer-contact glass-button"
        >
          Contact
        </a>
      </div>
    </footer>
  )
}
