'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DEPARTMENTS, MASTER_CITIZENS, getConsentState, updateConsent } from '@/lib/api'

export default function ConsentPage() {
  const [selectedCitizen, setSelectedCitizen] = useState('MAHA-2024-001')
  const [activeConsent, setActiveConsent] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getConsentState(selectedCitizen).then(setActiveConsent)
  }, [selectedCitizen])

  const handleToggleConsent = async (deptId: string) => {
    const isCurrentlyGranted = activeConsent.includes(deptId)
    setLoading(true)
    setMessage('')
    try {
      const res = await updateConsent('mock-token', selectedCitizen, [deptId], isCurrentlyGranted)
      setActiveConsent(res.active_categories)
      setMessage(isCurrentlyGranted 
        ? `🔒 Access consent for '${DEPARTMENTS[deptId].name}' successfully REVOKED under DPDP Act 2023.` 
        : `✅ Access consent for '${DEPARTMENTS[deptId].name}' successfully GRANTED.`
      )
    } catch {
      setMessage('Failed to update consent status')
    } finally {
      setLoading(false)
    }
  }

  const citizenObj = MASTER_CITIZENS.find(c => c.id === selectedCitizen) || MASTER_CITIZENS[0]

  return (
    <div className="fade-in">
      {/* Hero Banner styled like data.gov.in */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0284c7 100%)',
        color: '#ffffff',
        padding: '28px 24px',
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.15)',
      }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 700 }}>
          Digital Personal Data Protection (DPDP) Act 2023 Compliance
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
          🛡️ Citizen Privacy & Consent Management Portal
        </h1>
        <p style={{ fontSize: 13.5, opacity: 0.9, marginTop: 6, maxWidth: 800, lineHeight: 1.5 }}>
          As a citizen, you hold full legal authority to grant, inspect, or revoke real-time data access permissions to government departments. GIL enforces <strong>consent-gated adapter execution</strong> — if consent is revoked, department adapters are blocked prior to data retrieval.
        </p>
      </div>

      {/* Citizen Switcher */}
      <div className="card">
        <div className="card-title">
          <span>👤 Select Citizen Mandate Account</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {MASTER_CITIZENS.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCitizen(c.id)}
              className={`btn ${selectedCitizen === c.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px' }}
            >
              <span>{selectedCitizen === c.id ? '✓' : '👤'}</span>
              <span>{c.name} ({c.id})</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          Currently managing consent profile for <strong>{citizenObj.name}</strong> · Aadhaar: <span className="mono">{citizenObj.systems.aadhaar}</span>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('REVOKED') ? 'alert-error' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {/* Consent Grid across all 8 Departments */}
      <div className="card">
        <div className="card-title">
          <span>🏛️ Active Consent Mandates across 8 State & Central Registries</span>
          <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
            {activeConsent.length} OF {Object.keys(DEPARTMENTS).length} GRANTED
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {Object.values(DEPARTMENTS).map(dept => {
            const isGranted = activeConsent.includes(dept.id)
            return (
              <div
                key={dept.id}
                style={{
                  background: isGranted ? '#ffffff' : '#fef2f2',
                  border: `1px solid ${isGranted ? 'var(--border)' : '#fecaca'}`,
                  borderRadius: 6,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderLeft: `5px solid ${isGranted ? dept.color : '#dc2626'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gov-navy)' }}>
                      <span>{dept.icon}</span> <span style={{ marginLeft: 6 }}>{dept.name}</span>
                    </div>
                    <span className={`badge ${isGranted ? 'badge-success' : 'badge-error'}`}>
                      {isGranted ? 'CONSENT GRANTED' : 'REVOKED / BLOCKED'}
                    </span>
                  </div>

                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    <strong>Agency:</strong> {dept.agency}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    <strong>Protocol:</strong> {dept.protocol} · <strong>Dataset:</strong> {dept.datasetSource}
                  </div>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: isGranted ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                    {isGranted ? '✓ GIL Adapter Authorized' : '⛔ Adapter Blocked at Gate'}
                  </span>
                  <button
                    disabled={loading}
                    onClick={() => handleToggleConsent(dept.id)}
                    className={`btn btn-sm ${isGranted ? 'btn-danger' : 'btn-success'}`}
                  >
                    {isGranted ? '🚫 Revoke Consent' : '✅ Grant Consent'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Statutory DPDP Compliance Info */}
      <div className="card">
        <div className="card-title">
          <span>📜 Statutory Mandate & Technical Guarantees</span>
        </div>
        <div className="grid-2" style={{ gap: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>1. Pre-Fetch Gate Enforcer:</strong>
            <p style={{ marginTop: 4, lineHeight: 1.5 }}>
              Unlike traditional API portals that filter data after fetching, GIL checks the citizen consent ledger <em>prior</em> to calling the adapter endpoint. If consent is revoked, <code>ConsentDeniedError</code> is thrown immediately and zero payload is requested.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>2. Cryptographic Audit Auditability:</strong>
            <p style={{ marginTop: 4, lineHeight: 1.5 }}>
              Every consent state modification (grant or revocation) is signed and committed to the immutable audit log with a SHA-256 digital hash, providing legally admissible proof under India's IT Act 2000.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
