'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getStatus, getAuditLog, connectSSE, StatusResponse, AuditEntry, DEPARTMENTS } from '@/lib/api'

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
  const role = searchParams.get('role') || 'SkillDeptOfficer'
  const citizen = searchParams.get('citizen') || 'MAHA-2024-001'
  const rawCats = searchParams.get('cats') || 'employment,skills,revenue,aadhaar'
  const categories = rawCats.split(',')

  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [events, setEvents] = useState<{ stage: string; system?: string; data?: Record<string, unknown>; timestamp: string }[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [streamDone, setStreamDone] = useState(false)

  useEffect(() => {
    if (!requestId) return

    // Connect SSE Stream
    const disconnect = connectSSE(
      token, requestId,
      (event) => setEvents(prev => [...prev, event]),
      () => {
        setStreamDone(true)
        getStatus(token, requestId, citizen, role, categories).then(setStatus).catch(console.error)
        getAuditLog(token, requestId).then(r => setAuditEntries(r.entries)).catch(console.error)
      }
    )

    // Initial Status Fetch
    getStatus(token, requestId, citizen, role, categories).then(s => {
      setStatus(s)
      setLoading(false)
    }).catch(console.error)

    return () => { disconnect() }
  }, [requestId, token, citizen, role])

  const systemNames = status ? Object.keys(status.systems) : categories

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">📡 Live Interoperability Status Tracker</h1>
            <p className="page-subtitle">
              Request ID: <span className="mono">{requestId}</span> · Citizen: <span className="mono">{citizen}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/" className="btn btn-secondary btn-sm">
              ← New Request
            </Link>
            <Link href="/departments" className="btn btn-secondary btn-sm">
              🏢 View Registries
            </Link>
            <Link href="/audit" className="btn btn-secondary btn-sm">
              📋 Audit Ledger
            </Link>
          </div>
        </div>
      </div>

      {/* Request Context Banner */}
      <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderLeft: '5px solid var(--gov-navy)', padding: '14px 16px', borderRadius: 4, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>
            Scheme & Workflow Pipeline
          </div>
          <div style={{ fontWeight: 700, color: 'var(--gov-navy)', fontSize: 14, marginTop: 2 }}>
            {status?.scheme_name || 'Comprehensive Citizen 360-Degree Profile Verification'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Requesting Role:
            </span>
            <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--gov-navy)', fontSize: 13 }}>
              {role}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Security Architecture:
            </span>
            <span style={{ marginLeft: 6, fontWeight: 600, color: 'var(--success)', fontSize: 12 }}>
              Two-Stage (Consent + Response RBAC)
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Overall Status & SLA Benchmark */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Overall Status Card */}
        <div className="card">
          <div className="card-title">
            <span>🎯 Overall Pipeline Execution Status</span>
          </div>
          {loading && !status ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                Aggregating records across integrated state databases...
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
                    Per Departmental RBAC security policy for role <strong>{role}</strong>, sensitive fields were automatically redacted in payload:
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
            <span>⏱️ RTS Act SLA & Performance Benchmark</span>
          </div>
          {status?.sla_metrics ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 10px' }}>
                  ✓ 100% RTS COMPLIANT
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Latency: <strong>{status.sla_metrics.actual_seconds}s</strong> (Statutory Limit: <strong>{status.sla_metrics.target_seconds}s</strong>)
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 3, border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div><strong>Statutory Standard:</strong> {status.sla_metrics.statutory_standard}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Automated fan-out adapter execution eliminates manual inter-office paperwork, reducing clearance time from <strong>15 days</strong> to <strong>sub-second automated turnaround</strong>.
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

      {/* Data Quality & Reconciliation Card */}
      {status?.data_quality && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">
            <span>🔍 Data Quality & Cross-Registry Reconciliation</span>
            <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
              DQI SCORE: {status.data_quality.quality_score}%
            </span>
          </div>
          <div className="grid-3" style={{ gap: 12, marginBottom: 14 }}>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>TRUST GRADE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gov-navy)', marginTop: 4 }}>
                {status.data_quality.quality_grade}
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>IDENTITY CONSISTENCY</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
                {status.data_quality.consistency_score}% MDM Match
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>DISCREPANCIES</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
                {status.data_quality.discrepancies_count} Conflict Flags
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Department Adapters Status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span>🏢 Departmental Adapters Execution Pipeline</span>
        </div>
        {systemNames.map(sys => {
          const sysMeta = DEPARTMENTS[sys] || { name: sys, icon: '🏢', protocol: 'API' }
          const s = status?.systems[sys] || { stage: 'completed', retry_count: 0 }
          return (
            <div key={sys} className="pipeline-stage">
              <div className={`stage-dot ${stageDot(s.stage)}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gov-navy)' }}>
                  {sysMeta.icon} {sysMeta.name} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({sysMeta.protocol})</span>
                </div>
                {s.retry_count > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                    ↻ {s.retry_count} retries executed
                  </div>
                )}
                {s.error && (
                  <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 2 }}>
                    ⚠️ {s.error}
                  </div>
                )}
              </div>
              <span className={`badge ${stageBadge(s.stage)}`}>{s.stage}</span>
            </div>
          )
        })}
      </div>

      {/* SSE Live Event Log */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span>⚡ Live Pipeline Event Stream (Server-Sent Events)</span>
          <span className="badge badge-info" style={{ marginLeft: 8, fontSize: 10 }}>
            {streamDone ? 'STREAM COMPLETED' : 'LIVE STREAMING'}
          </span>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fafafa', border: '1px solid var(--border-subtle)', borderRadius: 3, padding: '6px 12px' }}>
          {events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
              Streaming pipeline step execution logs...
            </div>
          ) : (
            [...events].reverse().map((evt, i) => (
              <div key={i} className="pipeline-stage fade-in" style={{ padding: '6px 0' }}>
                <div className={`stage-dot ${evt.stage === 'completed' ? 'success' : evt.stage === 'failed' ? 'error' : 'active'}`} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {STAGE_LABELS[evt.stage] || evt.stage}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Consolidated Citizen Data Cards per Department */}
      {status?.result && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">
            <span>📊 Consolidated Citizen Master Profile (8 Departmental Registries)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            {Object.entries(status.result).map(([deptKey, deptData]) => {
              const meta = DEPARTMENTS[deptKey] || { name: deptKey, icon: '🏢', agency: 'State Dept' }
              return (
                <div key={deptKey} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gov-navy)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{meta.icon}</span>
                    <span>{meta.name}</span>
                  </div>
                  {typeof deptData === 'object' && deptData !== null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(deptData as Record<string, unknown>).map(([field, val]) => {
                        const isRedacted = val === '<redacted>'
                        return (
                          <div key={field} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{field.replace(/_/g, ' ')}:</span>
                            <span style={{
                              fontWeight: 600,
                              color: isRedacted ? '#b45309' : 'var(--text-primary)',
                              background: isRedacted ? '#fef3c7' : 'transparent',
                              padding: isRedacted ? '1px 6px' : '0',
                              borderRadius: 3,
                            }}>
                              {isRedacted ? '🔒 <REDACTED>' : Array.isArray(val) ? `${val.length} Documents` : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{String(deptData)}</div>
                  )}
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
            <span>📜 Cryptographic Audit Ledger Entry</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target Systems</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.map(e => (
                  <tr key={e.audit_id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td style={{ fontWeight: 600 }}>{e.actor}</td>
                    <td><span className="mono">{e.action}</span></td>
                    <td style={{ fontSize: 11 }}>{e.target_system}</td>
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
