'use client'
import { useState } from 'react'
import { getAuditLog, login, AuditEntry } from '@/lib/api'

function stageBadge(status?: string) {
  if (status === 'success' || status === 'completed') return 'badge-success'
  if (status === 'failure' || status === 'denied' || status === 'error') return 'badge-error'
  if (status === 'redacted') return 'badge-warning'
  if (status === 'manual_review') return 'badge-purple'
  return 'badge-muted'
}

export default function AuditPage() {
  const [requestId, setRequestId] = useState('')
  const [citizenId, setCitizenId] = useState('MAHA-2024-001')
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const tokenResp = await login(citizenId, 'GILService')
      const result = await getAuditLog(tokenResp.access_token, requestId)
      setEntries(result.entries)
      setSearched(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Audit fetch failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">📋 Immutable Audit Trail Register</h1>
        <p className="page-subtitle">
          Government of Maharashtra · Cryptographic Verification & Statutory Compliance Log for All Cross-Departmental Transactions
        </p>
      </div>

      {/* Search form */}
      <div className="card">
        <div className="card-title">
          <span>🔍 Search Transaction by Request ID</span>
        </div>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        <form onSubmit={handleSearch}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                Request Tracking ID <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                className="form-input"
                value={requestId}
                onChange={e => setRequestId(e.target.value)}
                placeholder="e.g. 17f22223-f7b1-4b91-ad0d-6c2c40a1daa9"
                required
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter the UUID returned during request submission.</span>
            </div>
            <div className="form-group">
              <label className="form-label">
                Authorized Account <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select className="form-select" value={citizenId} onChange={e => setCitizenId(e.target.value)}>
                <option value="MAHA-2024-001">Priya Sharma (MAHA-2024-001) - Pune</option>
                <option value="MAHA-2024-002">Rahul Deshmukh (MAHA-2024-002) - Nagpur</option>
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Audit logs are cryptographically accessible to authorized officials & citizens.</span>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: '9px 22px' }}>
            {loading ? <><span className="spinner" /> Searching...</> : '🔍 Retrieve Audit Records'}
          </button>
        </form>
      </div>

      {/* Audit design info */}
      <div className="card">
        <div className="card-title">
          <span>🛡️ Statutory Security & Privacy Guarantees</span>
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          {[
            {
              icon: '🔐',
              title: 'Append-Only SQL Enforcement',
              desc: 'Database table rules strictly prohibit UPDATE or DELETE queries. Audit records cannot be altered or purged.'
            },
            {
              icon: '#️⃣',
              title: 'Zero-Payload SHA-256 Storage',
              desc: 'Personal citizen data is NEVER stored in the audit trail. Only one-way cryptographic SHA-256 hashes are recorded.'
            },
            {
              icon: '🔗',
              title: 'Consent Chain Linkage',
              desc: 'Every cross-departmental fetch references the exact consent_id granted by the citizen under DPDP Act compliance.'
            },
          ].map(item => (
            <div
              key={item.title}
              style={{
                padding: 14,
                background: '#f8fafc',
                borderRadius: 4,
                border: '1px solid var(--border)',
                borderLeft: '4px solid var(--gov-navy)'
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gov-navy)', marginBottom: 4 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="card fade-in">
          <div className="card-title">
            <span>📊 Official Audit Entries</span>
            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
              Total Records: {entries.length}
            </span>
          </div>

          {entries.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
              No audit records found for this Request ID.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>System</th>
                    <th>Category</th>
                    <th>Consent ID</th>
                    <th>Payload Hash</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.audit_id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11.5, fontFamily: 'monospace' }}>
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td><span className="mono">{e.actor}</span></td>
                      <td><span className="mono" style={{ fontWeight: 600 }}>{e.action}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--gov-navy)' }}>{e.target_system || '—'}</td>
                      <td>{e.data_category || '—'}</td>
                      <td>
                        {e.consent_id ? (
                          <span className="mono" title={e.consent_id}>{e.consent_id.slice(0, 8)}…</span>
                        ) : '—'}
                      </td>
                      <td>
                        {e.payload_hash ? (
                          <span className="mono" title={e.payload_hash} style={{ fontSize: 10 }}>
                            {e.payload_hash.slice(0, 10)}…
                          </span>
                        ) : '—'}
                      </td>
                      <td><span className={`badge ${stageBadge(e.result_status)}`}>{e.result_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
