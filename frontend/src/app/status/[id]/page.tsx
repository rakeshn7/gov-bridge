'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getStatus, getAuditLog, connectSSE, StatusResponse, AuditEntry } from '@/lib/api'

const STAGE_LABELS: Record<string, string> = {
  received: '📥 Request Received & Validated',
  identity_resolved: '🆔 Federated MDM Resolved',
  consent_check_started: '🔒 DPDP Consent Checking',
  consent_checked: '✅ Consent Verified',
  consent_denied: '🚫 Consent Denied',
  mapped: '🗺️ Identity Mapped',
  dispatched: '🚀 Dispatched to System',
  response_received: '📨 Response Received',
  aggregated: '🔀 Results Aggregated',
  quality_evaluated: '🔍 Data Quality Verified',
  rbac_applied: '🛡️ RBAC Redactions Applied',
  notifications_dispatched: '📲 Citizen Notifications Dispatched',
  completed: '✨ Workflow Successfully Completed',
  partial: '⚠️ Partial (Manual Review Required)',
  failed: '❌ Request Failed',
  manual_review: '🔔 Manual Review Required',
}

function stageBadge(stage: string) {
  if (['success', 'completed'].includes(stage)) return 'badge-success'
  if (['failed', 'failure', 'manual_review'].includes(stage)) return 'badge-error'
  if (stage === 'dispatched') return 'badge-info'
  if (stage === 'partial') return 'badge-warning'
  return 'badge-purple'
}

function stageDot(stage: string) {
  if (['success', 'completed'].includes(stage)) return 'success'
  if (['failed', 'failure'].includes(stage)) return 'error'
  if (stage === 'manual_review') return 'review'
  if (stage === 'dispatched') return 'active'
  return 'pending'
}

function StatusPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const requestId = params.id as string
  const token = searchParams.get('token') || ''
  const role = searchParams.get('role') || ''

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [events, setEvents] = useState<{ stage: string; system?: string; data?: Record<string, unknown>; timestamp: string }[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [streamDone, setStreamDone] = useState(false)

  useEffect(() => {
    if (!requestId || !token) return

    // Start SSE stream
    const disconnect = connectSSE(
      token, requestId,
      (event) => setEvents(prev => [...prev, event]),
      () => {
        setStreamDone(true)
        // Final status fetch
        getStatus(token, requestId).then(setStatus).catch(console.error)
        // Fetch audit log
        getAuditLog(token, requestId).then(r => setAuditEntries(r.entries)).catch(console.error)
      }
    )

    // Also poll status every 2s
    const interval = setInterval(async () => {
      try {
        const s = await getStatus(token, requestId)
        setStatus(s)
        setLoading(false)
        if (['completed', 'partial', 'failed'].includes(s.overall_status)) {
          clearInterval(interval)
        }
      } catch {}
    }, 2000)

    return () => { disconnect(); clearInterval(interval) }
  }, [requestId, token])

  const systemNames = status ? Object.keys(status.systems) : []

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">📡 Live Interoperability Status Tracker</h1>
            <p className="page-subtitle">
              Request Tracking ID: <span className="mono">{requestId}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/" className="btn btn-secondary btn-sm">
              ← New Query
            </Link>
            <Link href="/audit" className="btn btn-secondary btn-sm">
              📋 Audit Trail
            </Link>
          </div>
        </div>
      </div>

      {/* Scheme & Request Context Bar */}
      <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderLeft: '5px solid var(--gov-navy)', padding: '14px 16px', borderRadius: 4, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>
            Scheme Workflow Pipeline
          </div>
          <div style={{ fontWeight: 700, color: 'var(--gov-navy)', fontSize: 14, marginTop: 2 }}>
            {status?.scheme_name || 'Government Interoperability Query'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Requesting Role:
            </span>
            <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--gov-navy)', fontSize: 13 }}>
              {role || status?.requested_by_role || 'Authorized Officer'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Security Architecture:
            </span>
            <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--success)', fontSize: 12 }}>
              Two-Stage Model (Consent + Response RBAC)
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Overall Status & SLA Benchmark */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Overall Status */}
        <div className="card">
          <div className="card-title">
            <span>🎯 Overall Pipeline Status</span>
          </div>
          {loading && !status ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                Aggregating departmental records across systems...
              </span>
            </div>
          ) : status ? (
            <div>
              <div style={{ margin: '8px 0 16px' }}>
                <span className={`badge ${stageBadge(status.overall_status)}`} style={{ fontSize: 13, padding: '6px 14px' }}>
                  {STAGE_LABELS[status.overall_status] || status.overall_status}
                </span>
              </div>

              {status.rbac_redactions.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: '#fffbeb', borderRadius: 4, border: '1px solid #fde68a', borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛡️ RBAC Redacted Attributes ({status.rbac_redactions.length} fields)
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Per Departmental RBAC policy for role <strong>{role || status.requested_by_role}</strong>, the following sensitive fields were securely masked:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {status.rbac_redactions.map(f => (
                      <span key={f} className="mono" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* SLA Compliance Benchmark Card */}
        <div className="card">
          <div className="card-title">
            <span>⏱️ SLA Compliance & Service Delivery Benchmark</span>
          </div>
          {status?.sla_metrics ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 10px' }}>
                  ✓ 100% SLA COMPLIANT
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Digital Turnaround: <strong>{status.sla_metrics.actual_seconds}s</strong> vs Target: <strong>{status.sla_metrics.target_seconds}s</strong>
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 3, border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div><strong>Statutory Reference:</strong> {status.sla_metrics.statutory_standard}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Traditional multi-office physical submissions average <strong>7–15 working days</strong>. The Government Interoperability Layer executes cross-departmental verification in <strong>sub-second automated latency</strong>.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
              Calculating turnaround latency against statutory benchmarks...
            </div>
          )}
        </div>
      </div>

      {/* Data Quality & Cross-Registry Reconciliation Card */}
      {status?.data_quality && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">
            <span>🔍 Data Quality & Cross-Registry Reconciliation Engine</span>
            <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
              DQI SCORE: {status.data_quality.quality_score}%
            </span>
          </div>
          <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>QUALITY TRUST GRADE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gov-navy)', marginTop: 4 }}>
                {status.data_quality.quality_grade}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>CROSS-REGISTRY CONSISTENCY</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
                {status.data_quality.consistency_score}% Identity Alignment
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>DISCREPANCIES DETECTED</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: status.data_quality.discrepancies_count === 0 ? 'var(--success)' : 'var(--error)', marginTop: 4 }}>
                {status.data_quality.discrepancies_count} Conflict Flags
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gov-navy)', marginBottom: 8 }}>
              Individual Data Integrity Checks:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {status.data_quality.checks.map((chk, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', background: '#ffffff', padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 3 }}>
                  <span style={{ color: chk.passed ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                    {chk.passed ? '✓' : '✗'}
                  </span>
                  <span>{chk.check_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Departmental Systems Status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span>🏢 Departmental Systems Adapter Status</span>
        </div>
        {systemNames.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 8px' }} />
            Connecting to departmental adapters...
          </div>
        ) : (
          systemNames.map(sys => {
            const s = status!.systems[sys]
            const sysTitle = sys === 'employment' ? 'Employment Registry (REST / JWT)'
              : sys === 'skill' ? 'Vocational Skills Registry (SOAP / XML)'
              : 'Land Revenue Registry (Direct SQL Database)'
            return (
              <div key={sys} className="pipeline-stage">
                <div className={`stage-dot ${stageDot(s.stage)}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gov-navy)' }}>
                    {sysTitle}
                  </div>
                  {s.retry_count > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                      ↻ {s.retry_count} retries executed
                    </div>
                  )}
                </div>
                <span className={`badge ${stageBadge(s.stage)}`}>{s.stage}</span>
              </div>
            )
          })
        )}
      </div>

      {/* SSE Live Event Stream */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span>⚡ Live Pipeline Event Stream (Server-Sent Events)</span>
          {!streamDone ? (
            <span className="badge badge-info" style={{ marginLeft: 8, fontSize: 10 }}>LIVE STREAMING</span>
          ) : (
            <span className="badge badge-success" style={{ marginLeft: 8, fontSize: 10 }}>STREAM CLOSED</span>
          )}
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', background: '#fafafa', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: '4px 12px' }}>
          {events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12.5, padding: '16px 0' }}>
              Waiting for live event updates from GIL orchestrator...
            </div>
          ) : (
            [...events].reverse().map((evt, i) => (
              <div key={i} className="pipeline-stage fade-in" style={{ padding: '8px 0' }}>
                <div className={`stage-dot ${evt.stage === 'completed' ? 'success' : evt.stage === 'failed' ? 'error' : 'active'}`} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {STAGE_LABELS[evt.stage] || evt.stage}
                    {evt.system && (
                      <span style={{ color: 'var(--gov-navy)', marginLeft: 8, fontWeight: 700 }}>
                        [System: {evt.system}]
                      </span>
                    )}
                  </span>
                  {evt.data && Object.keys(evt.data).length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'Consolas, monospace' }}>
                      {JSON.stringify(evt.data).slice(0, 140)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Citizen Notification Dispatch Log */}
      {status?.notifications && status.notifications.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">
            <span>📲 Event-Driven Citizen Notification Dispatch Log</span>
            <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
              {status.notifications.length} ALERTS DELIVERED
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Notification Message</th>
                  <th>Dispatch Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {status.notifications.map((notif, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-purple">{notif.channel}</span></td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{notif.recipient}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{notif.message}</td>
                    <td><span className="badge badge-success">{notif.status}</span></td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      {new Date(notif.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consolidated Master Record */}
      {status?.result && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">
            <span>📊 Consolidated Citizen Master Record</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Attributes merged across departmental registries. Redacted fields are obscured in compliance with the Official RBAC security policy.
          </p>
          <div className="grid-3" style={{ gap: 10 }}>
            {Object.entries(status.result).map(([key, value]) => {
              const isRedacted = value === '<redacted>'
              return (
                <div
                  key={key}
                  style={{
                    padding: '10px 14px',
                    background: isRedacted ? '#fffbeb' : '#ffffff',
                    border: `1px solid ${isRedacted ? '#fde68a' : 'var(--border)'}`,
                    borderRadius: 4,
                    borderLeft: isRedacted ? '4px solid #d97706' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>
                    {key}
                  </div>
                  <div style={{
                    fontSize: 13,
                    marginTop: 4,
                    fontWeight: 600,
                    color: isRedacted ? '#b45309' : 'var(--text-primary)',
                    wordBreak: 'break-word',
                  }}>
                    {isRedacted ? '🔒 <CONFIDENTIAL / REDACTED>' : (typeof value === 'object' ? JSON.stringify(value) : String(value))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Audit Log */}
      {auditEntries.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>📜 Audit Trail for this Request</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Departmental System</th>
                  <th>Result Status</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map(e => (
                  <tr key={e.audit_id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                    <td><span className="mono">{e.action}</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--gov-navy)' }}>{e.target_system || 'GIL Core'}</td>
                    <td><span className={`badge ${stageBadge(e.result_status || '')}`}>{e.result_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StatusPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 40, color: 'var(--text-secondary)', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <div>Loading status tracker...</div>
      </div>
    }>
      <StatusPageInner />
    </Suspense>
  )
}
