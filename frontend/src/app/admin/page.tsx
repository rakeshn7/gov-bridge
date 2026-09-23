'use client'
import { useState, useEffect } from 'react'
import { toggleFailure, getManualReview, resolveReview, updateConsent, login, ManualReviewItem } from '@/lib/api'

const SYSTEMS = ['employment', 'skill']
const CITIZENS = [
  { id: 'MAHA-2024-001', name: 'Priya Sharma' },
  { id: 'MAHA-2024-002', name: 'Rahul Deshmukh' },
]

export default function AdminPage() {
  const [token, setToken] = useState('')
  const [failureStates, setFailureStates] = useState<Record<string, boolean>>({})
  const [reviewItems, setReviewItems] = useState<ManualReviewItem[]>([])
  const [reviewCount, setReviewCount] = useState(0)
  const [loadingToggle, setLoadingToggle] = useState<Record<string, boolean>>({})
  const [consentState, setConsentState] = useState<Record<string, boolean>>({})
  const [loadingConsent, setLoadingConsent] = useState<Record<string, boolean>>({})
  const [resolving, setResolving] = useState<Record<string, boolean>>({})
  const [msgs, setMsgs] = useState<string[]>([])
  const [authLoading, setAuthLoading] = useState(false)

  const addMsg = (m: string) => setMsgs(prev => [m, ...prev.slice(0, 9)])

  const authenticate = async () => {
    setAuthLoading(true)
    try {
      const r = await login('MAHA-2024-001', 'GILService')
      setToken(r.access_token)
      addMsg('✅ Authenticated successfully as GILService')
      fetchReview(r.access_token)
    } catch {
      addMsg('❌ Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const fetchReview = async (t?: string) => {
    const tk = t || token
    if (!tk) return
    try {
      const r = await getManualReview(tk)
      setReviewItems(r.items)
      setReviewCount(r.count)
    } catch {}
  }

  useEffect(() => {
    if (token) fetchReview()
  }, [token])

  const handleToggle = async (system: string) => {
    if (!token) {
      addMsg('⚠️ Please authenticate as administrator first')
      return
    }
    setLoadingToggle(p => ({ ...p, [system]: true }))
    try {
      const r = await toggleFailure(token, system)
      setFailureStates(p => ({ ...p, [system]: r.failure_mode }))
      addMsg(`${r.failure_mode ? '🔴' : '🟢'} ${system} system: fault simulation mode ${r.failure_mode ? 'ENABLED (ON)' : 'DISABLED (OFF)'}`)
    } catch (e) {
      addMsg(`❌ Fault toggle failed: ${e}`)
    } finally {
      setLoadingToggle(p => ({ ...p, [system]: false }))
    }
  }

  const handleConsent = async (citizenId: string, revoke: boolean) => {
    if (!token) {
      addMsg('⚠️ Please authenticate as administrator first')
      return
    }
    setLoadingConsent(p => ({ ...p, [citizenId]: true }))
    try {
      await updateConsent(token, citizenId, ['employment', 'skills', 'revenue'], revoke)
      setConsentState(p => ({ ...p, [citizenId]: !revoke }))
      addMsg(`${revoke ? '🚫' : '✅'} Citizen ${citizenId}: consent ${revoke ? 'REVOKED' : 'GRANTED'}`)
    } catch (e) {
      addMsg(`❌ Consent update failed: ${e}`)
    } finally {
      setLoadingConsent(p => ({ ...p, [citizenId]: false }))
    }
  }

  const handleResolve = async (item: ManualReviewItem) => {
    if (!token) return
    setResolving(p => ({ ...p, [item.id]: true }))
    try {
      await resolveReview(token, item.id, 'admin-officer', 'Manually verified via dashboard')
      addMsg(`✅ Resolved manual review item: ${item.system_name}`)
      await fetchReview()
    } catch (e) {
      addMsg(`❌ Resolve failed: ${e}`)
    } finally {
      setResolving(p => ({ ...p, [item.id]: false }))
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">⚙️ Administrative Console</h1>
        <p className="page-subtitle">
          Government of Maharashtra · System Health Monitoring, Fault Injection Testing & Manual Review Queue
        </p>
      </div>

      {/* Auth Box */}
      {!token ? (
        <div className="card">
          <div className="card-title">
            <span>🔑 Officer Security Login</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
            System configuration controls and Tier-2 review queues require an active GILService administrator session.
          </p>
          <button className="btn btn-primary" onClick={authenticate} disabled={authLoading}>
            {authLoading ? <><span className="spinner" /> Verifying Credentials...</> : '🔐 Authenticate as GILService'}
          </button>
        </div>
      ) : (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <span>✅ Authorized Administrative Session Active: <strong>GILService Root</strong></span>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Failure Toggles */}
        <div className="card">
          <div className="card-title">
            <span>🔴 Fault Injection Testing</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Inject controlled HTTP 503 outages into legacy mock systems. GIL retry logic kicks in automatically. If 3 exponential retries fail, requests are routed to the PostgreSQL Tier-2 Manual Review Queue.
          </p>
          {SYSTEMS.map(sys => (
            <div key={sys} className={`toggle-row ${failureStates[sys] ? 'danger' : ''}`}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gov-navy)' }}>
                  {sys === 'employment' ? 'Employment System (REST API / JWT)' : 'Vocational Skill System (SOAP / XML Service)'}
                </div>
                <div style={{ fontSize: 11.5, color: failureStates[sys] ? 'var(--error)' : 'var(--success)', marginTop: 2, fontWeight: 600 }}>
                  {failureStates[sys] ? '⚠️ Outage Active (HTTP 503 Service Unavailable Simulated)' : '🟢 Operating Normally'}
                </div>
              </div>
              <button
                className={`toggle ${failureStates[sys] ? 'on' : ''}`}
                onClick={() => handleToggle(sys)}
                disabled={loadingToggle[sys]}
                title={`Toggle ${sys} failure simulation`}
              />
            </div>
          ))}
        </div>

        {/* Consent Management */}
        <div className="card">
          <div className="card-title">
            <span>🔒 DPDP Consent Management</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Directly revoke or grant citizen data-sharing consent. When revoked, GIL actively rejects departmental fetches at the gateway stage and logs a ConsentDenied security event.
          </p>
          {CITIZENS.map(c => (
            <div key={c.id} className="toggle-row">
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gov-navy)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="mono">{c.id}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleConsent(c.id, false)}
                  disabled={loadingConsent[c.id]}
                >
                  Grant
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleConsent(c.id, true)}
                  disabled={loadingConsent[c.id]}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Review Queue */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span>🔔 Manual Review Queue (PostgreSQL Tier-2)</span>
          <span className="badge badge-warning" style={{ marginLeft: 8 }}>
            {reviewCount} Pending
          </span>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => fetchReview()}
          >
            🔄 Refresh
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Failed queries that exhausted all Redis Tier-1 automatic retries (attempts ≥ 3) are securely isolated here for official administrative adjudication.
        </p>

        {reviewItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-subtle)', borderRadius: 4, border: '1px dashed var(--border)' }}>
            No items currently pending manual review.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>System</th>
                  <th>Request ID</th>
                  <th>Retries</th>
                  <th>Error Trace</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviewItems.map(item => (
                  <tr key={item.id}>
                    <td><span className="badge badge-purple">{item.system_name}</span></td>
                    <td><span className="mono">{item.request_id.slice(0, 12)}…</span></td>
                    <td><span className="badge badge-error">{item.retry_count}×</span></td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                      {item.error_trace || '—'}
                    </td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleResolve(item)}
                        disabled={resolving[item.id]}
                      >
                        {resolving[item.id] ? '...' : '✅ Resolve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity log */}
      {msgs.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>📋 Administrative Activity Log</span>
          </div>
          {msgs.map((m, i) => (
            <div key={i} className="pipeline-stage fade-in" style={{ padding: '8px 0' }}>
              <div className="stage-dot success" />
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
