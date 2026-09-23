import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Government Interoperability Layer (GIL) — Government of Maharashtra',
  description: 'Government of Maharashtra — Department of Skills, Employment, Entrepreneurship & Innovation (SIH26129)',
  keywords: ['Government of Maharashtra', 'Interoperability', 'GIL', 'SIH26129', 'Citizen Portal'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        {/* National Tricolor Accent Strip */}
        <div className="gov-tricolor-strip" />

        {/* Top Government Utility Bar */}
        <div className="gov-topbar">
          <div className="gov-topbar-inner">
            <div className="gov-topbar-left">
              <span>Government of Maharashtra</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span>Department of Skills, Employment, Entrepreneurship and Innovation</span>
            </div>
            <div className="gov-topbar-right">
              <span>Screen Reader Access</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <button className="gov-topbar-btn" title="Decrease font size">A-</button>
              <button className="gov-topbar-btn" title="Standard font size">A</button>
              <button className="gov-topbar-btn" title="Increase font size">A+</button>
              <span style={{ opacity: 0.5 }}>|</span>
              <span style={{ fontWeight: 600 }}>English</span>
            </div>
          </div>
        </div>

        {/* Government Portal Masthead */}
        <header className="gov-header">
          <div className="gov-header-inner">
            <Link href="/" className="gov-brand">
              <div className="gov-emblem-badge" aria-label="Government of Maharashtra Seal">
                🏛️
              </div>
              <div>
                <div className="gov-title-marathi" style={{ textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Government of Maharashtra
                </div>
                <div className="gov-title-english">
                  Government Interoperability Layer (GIL)
                </div>
                <div className="gov-subtitle-dept">
                  Department of Skills, Employment, Entrepreneurship & Innovation
                </div>
              </div>
            </Link>

            <div className="gov-header-right">
              <div className="gov-badge-seal">
                <div style={{ fontSize: 20 }}>🇮🇳</div>
                <div>
                  <div className="gov-badge-seal-title">SIH26129 PROTOTYPE</div>
                  <div className="gov-badge-seal-sub">Smart India Hackathon · GenZCoders</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Official Navigation Bar */}
        <nav className="gov-navbar">
          <div className="gov-navbar-inner">
            <Link href="/" className="gov-nav-link">
              <span>🏛️</span> Citizen Services
            </Link>
            <Link href="/audit" className="gov-nav-link">
              <span>📋</span> Audit Register
            </Link>
            <Link href="/admin" className="gov-nav-link">
              <span>⚙️</span> Admin Console
            </Link>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="gov-main">
          {/* Important Public Notice */}
          <div className="gov-notice-banner">
            <span className="gov-notice-tag">IMPORTANT NOTICE</span>
            <span>
              This is the official demonstration platform for the Government Interoperability Layer (GIL) brownfield integration between Employment, Skill Development, and Land Revenue registries.
            </span>
          </div>

          {children}
        </main>

        {/* Official Government Footer */}
        <footer className="gov-footer">
          <div className="gov-footer-inner">
            <div className="gov-footer-grid">
              <div>
                <div className="gov-footer-title">Government Interoperability Layer (GIL)</div>
                <p style={{ lineHeight: 1.6, color: '#94a3b8', fontSize: 12 }}>
                  A unified middleware platform built for the Government of Maharashtra, Department of Skills, Employment, Entrepreneurship & Innovation to integrate siloed legacy departmental registries using federated identity (MDM), citizen consent management, and RBAC security enforcement.
                </p>
                <div style={{ marginTop: 12, fontSize: 11.5, color: '#64748b' }}>
                  Smart India Hackathon 2026 (SIH26129) · Developed by Team GenZCoders
                </div>
              </div>

              <div>
                <div className="gov-footer-title">Official Portals</div>
                <ul className="gov-footer-links">
                  <li><a href="https://maharashtra.gov.in" target="_blank" rel="noopener noreferrer">Maharashtra State Portal</a></li>
                  <li><a href="https://rojgar.mahaswayam.gov.in" target="_blank" rel="noopener noreferrer">MahaSwayam Employment Portal</a></li>
                  <li><a href="https://aaplesarkar.mahaonline.gov.in" target="_blank" rel="noopener noreferrer">Aaple Sarkar Citizen Services</a></li>
                  <li><a href="https://india.gov.in" target="_blank" rel="noopener noreferrer">National Portal of India</a></li>
                </ul>
              </div>

              <div>
                <div className="gov-footer-title">Policies & Statutory Info</div>
                <ul className="gov-footer-links">
                  <li><a href="#terms">Terms & Conditions</a></li>
                  <li><a href="#privacy">Privacy & Consent Policy</a></li>
                  <li><a href="#hyperlink">Hyperlinking Policy</a></li>
                  <li><a href="#audit">Immutable Audit Trail Compliance</a></li>
                  <li><a href="#helpdesk">Support & Grievance Redressal</a></li>
                </ul>
              </div>
            </div>

            <div className="gov-footer-bottom">
              <div>
                © 2026 Government of Maharashtra. All rights reserved. Content owned & maintained by Dept. of Skills, Employment, Entrepreneurship & Innovation.
              </div>
              <div>
                Website Compliance: Guidelines for Indian Government Websites (GIGW 3.0)
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
