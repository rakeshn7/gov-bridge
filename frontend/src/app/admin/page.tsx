'use client'
import { useState, useEffect } from 'react'
import { toggleFailure, getManualReview, resolveReview, updateConsent, login, ManualReviewItem, DEPARTMENTS, MASTER_CITIZENS } from '@/lib/api'

export default function AdminPage() {
  const [token, setToken] = useState('mock-admin-token')
  const [failureStates, setFailureStates] = useState<Record<string, boolean>>({
    employment: false,
    skills: false,
    aadhaar: false,
    pan: false,
    udid: false,
    digilocker: false,
    education: false,
    revenue: false,
  })
  const [reviewItems, setReviewItems] = useState<ManualReviewItem[]>([])
  const [reviewCount, setReviewCount] = useState(0)
  const [loadingToggle, setLoadingToggle] = useState<Record<string, boolean>>({})
  const [resolving, setResolving] = useState<Record<string, boolean>>({})
  const [selectedReviewItem, setSelectedReviewItem] = useState<ManualReviewItem | null>(null)
  const [officerNotes, setOfficerNotes] = useState('')
  const [msgs, setMsgs] = useState<string[]>([
    '✅ Authenticated as Senior Governance Officer (GIL Root Administrator)',
    '🟢 All 8 departmental adapters connected and healthy',
  ])

  const addMsg = (m: string) => setMsgs(prev => [m, ...prev.slice(0, 9)])

  const fetchReview = async () => {
    try {
      const r = await getManualReview(token)
      setReviewItems(r.items)
      setReviewCount(r.count)
    } catch {}
  }

  useEffect(() => {
    fetchReview()
  }, [])

  const handleToggle = async (system: string) => {
    setLoadingToggle(p => ({ ...p, [system]: true }))
    try {
      const r = await toggleFailure(token, system)
      setFailureStates(p => ({ ...p, [system]: r.failure_mode }))
      addMsg(`${r.failure_mode ? '🔴' : '🟢'} ${DEPARTMENTS[system]?.name || system}: fault simulation ${r.failure_mode ? 'ENABLED (Simulating HTTP 503 Outage)' : 'DISABLED (Normal Operations)'}`)
    } catch (e) {
      addMsg(`❌ Fault toggle failed: ${e}`)
    } finally {
      setLoadingToggle(p => ({ ...p, [system]: false }))
    }
  }

  const handleOpenResolveModal = (item: ManualReviewItem) => {
    setSelectedReviewItem(item)
    setOfficerNotes(`Manually verified by officer during governance audit ref: ${item.request_id}`)
  }

  const handleConfirmResolve = async () => {
    if (!selectedReviewItem) return
    const id = selectedReviewItem.id
    setResolving(p => ({ ...p, [id]: true }))
    try {
      await resolveReview(token, id, 'SeniorOfficer-001', officerNotes)
      addMsg(`✅ Manually resolved review item #${id} (${selectedReviewItem.system_name})`)
      setSelectedReviewItem(null)
      await fetchReview()
    } catch (e) {
      addMsg(`❌ Resolution failed: ${e}`)
    } finally {
      setResolving(p => ({ ...p, [id]: false }))
    }
  }

  return (
    <div className="fade-in">
      {/* Hero Banner data.gov.in style */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2e59 0%, #1e3a8a 50%, #475569 100%)',
        color: '#ffffff',
        padding: '26px 24px',
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: '0 4px 12px rgba(15, 46, 89, 0.15)',
      }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 700 }}>
          System Administration & Governance Console
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
          ⚙️ Operations, Circuit Breaker & Manual Review Queue
        </h1>
        <p style={{ fontSize: 13, opacity: 0.9, marginTop: 6, maxWidth: 850, lineHeight: 1.5 }}>
          Monitor system health across 8 state & national registries, inject fault simulation modes for resiliency testing, and adjudicate Tier-2 failed jobs that exhausted automatic retries.
        </p>
      </div>

      {/* System Metrics Overview Cards */}
      <div className="grid-3" style={{ gap: 16, marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--success)' }}>8 / 8</div>
          <div className="metric-label">Active Departmental Adapters</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: reviewCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {reviewCount}
          </div>
          <div className="metric-label">Tier-2 Review Queue Depth</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--gov-navy)' }}>0.84s</div>
          <div className="metric-label">Avg Orchestration Latency</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Fault Injection Circuit Breaker Controls */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">
            <span>🔴 Failure Injection & Circuit Breaker Simulator</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Toggle fault injection per department to test exponential backoff retries and manual review routing.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(DEPARTMENTS).map(dept => {
              const isFailing = failureStates[dept.id]
              return (
                <div key={dept.id} className={`toggle-row ${isFailing ? 'danger' : ''}`} style={{ padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gov-navy)' }}>
                      <span>{dept.icon}</span> <span style={{ marginLeft: 4 }}>{dept.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: isFailing ? 'var(--error)' : 'var(--success)', marginTop: 1, fontWeight: 600 }}>
                      {isFailing ? '⚠️ Fault Active (Simulating HTTP 503)' : '🟢 Operating Normally'}
                    </div>
                  </div>
                  <button
                    className={`toggle ${isFailing ? 'on' : ''}`}
                    onClick={() => handleToggle(dept.id)}
                    disabled={loadingToggle[dept.id]}
                    title={`Toggle failure simulation for ${dept.name}`}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* System Activity & Architecture Log */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">
            <span>📋 Real-Time Operations Activity Log</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            {msgs.map((m, i) => (
              <div key={i} className="pipeline-stage fade-in" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="stage-dot success" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>Two-Tier Resilience Queue Design:</strong>
            <div style={{ marginTop: 6, lineHeight: 1.5 }}>
              • <strong>Tier-1 (Redis):</strong> Holds transient in-flight retry jobs with exponential backoff (2s → 4s → 8s). Cleared on success.
              <br />
              • <strong>Tier-2 (PostgreSQL `manual_review_queue`):</strong> Written permanently when retries exceed max attempts (<code>retry_count ≥ 3</code>). Requires manual officer resolution below.
            </div>
          </div>
        </div>
      </div>

      {/* Manual Review Queue */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">
          <span>🔔 Tier-2 Manual Review Queue (PostgreSQL Adjudication)</span>
          <span className="badge badge-warning" style={{ marginLeft: 8 }}>
            {reviewCount} PENDING ACTION
          </span>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => fetchReview()}
          >
            🔄 Refresh Queue
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Failed queries that exhausted automatic retry attempts are held here for administrative review and manual resolution.
        </p>

        {reviewItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-subtle)', borderRadius: 4, border: '1px dashed var(--border)' }}>
            ✓ Queue Clear: All departmental queries completed automatically without manual intervention.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Item ID</th>
                  <th>Target Registry</th>
                  <th>Original Request ID</th>
                  <th>Retries</th>
                  <th>Error Trace</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviewItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 700 }}><span className="mono">{item.id}</span></td>
                    <td>
                      <span className="badge badge-purple">{item.system_name}</span>
                    </td>
                    <td><span className="mono">{item.request_id}</span></td>
                    <td><span className="badge badge-error">{item.retry_count}× Failed</span></td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--error)' }}>
                      {item.error_trace || 'Service Unavailable'}
                    </td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      {new Date(item.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className={`badge ${item.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === 'RESOLVED' ? (
                        <span style={{ fontSize: 11, color: 'var(--success)' }}>Resolved by {item.resolved_by}</span>
                      ) : (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleOpenResolveModal(item)}
                        >
                          ✅ Resolve Item
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolve Modal Dialog */}
      {selectedReviewItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div className="card fade-in" style={{ maxWidth: 540, width: '100%', marginBottom: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div className="card-title">
              <span>✅ Resolve Manual Review Item #{selectedReviewItem.id}</span>
              <button
                onClick={() => setSelectedReviewItem(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
              <div><strong>System:</strong> {selectedReviewItem.system_name}</div>
              <div style={{ marginTop: 2 }}><strong>Request ID:</strong> <span className="mono">{selectedReviewItem.request_id}</span></div>
              <div style={{ marginTop: 2, color: 'var(--error)' }}><strong>Failure Reason:</strong> {selectedReviewItem.error_trace}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Officer Adjudication Notes <span style={{ color: 'var(--error)' }}>*</span></label>
              <textarea
                className="form-input"
                rows={3}
                value={officerNotes}
                onChange={e => setOfficerNotes(e.target.value)}
                placeholder="Enter justification notes for manual resolution..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setSelectedReviewItem(null)}>
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleConfirmResolve}
                disabled={resolving[selectedReviewItem.id]}
              >
                {resolving[selectedReviewItem.id] ? <><span className="spinner" /> Saving...</> : 'Confirm & Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
