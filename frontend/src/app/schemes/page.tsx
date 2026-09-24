'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSchemes, SchemeDefinition } from '@/lib/api'

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Record<string, SchemeDefinition>>({})

  useEffect(() => {
    getSchemes().then(setSchemes).catch(console.error)
  }, [])

  return (
    <div className="fade-in">
      {/* Hero Banner data.gov.in style */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2e59 0%, #0369a1 50%, #059669 100%)',
        color: '#ffffff',
        padding: '26px 24px',
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: '0 4px 12px rgba(15, 46, 89, 0.15)',
      }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 700 }}>
          Government Scheme Workflows
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
          📑 Government Schemes Directory & RTS Act SLA Benchmark
        </h1>
        <p style={{ fontSize: 13, opacity: 0.9, marginTop: 6, maxWidth: 850, lineHeight: 1.5 }}>
          GovBridge (Government Interoperability Layer - GIL) standardizes statutory verification rules for state and central government schemes, guaranteeing compliance with the <strong>Maharashtra Right to Public Services Act 2015</strong> through automated sub-second cross-departmental verification.
        </p>
      </div>

      {/* SLA Metric Overview Cards */}
      <div className="grid-3" style={{ gap: 16, marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--success)' }}>100%</div>
          <div className="metric-label">RTS Statutory SLA Compliance</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--gov-navy)' }}>1.42s</div>
          <div className="metric-label">Avg Scheme Processing SLA</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--gov-saffron)' }}>5</div>
          <div className="metric-label">Automated State Scheme Workflows</div>
        </div>
      </div>

      {/* Schemes Catalog List */}
      <div className="card">
        <div className="card-title">
          <span>📜 Active State Scheme Interoperability Templates</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.values(schemes).map(scheme => (
            <div
              key={scheme.id}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderLeft: '6px solid var(--gov-navy)',
                borderRadius: 6,
                padding: 18,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gov-navy)' }}>
                    {scheme.name}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
                    🏢 Administered by: {scheme.department}
                  </div>
                </div>
                <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 10px' }}>
                  ⏱️ RTS SLA: {scheme.sla_target_seconds}s
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                {scheme.description}
              </p>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    Required Registries:
                  </span>
                  {scheme.categories.map(cat => (
                    <span key={cat} className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                      {cat}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/?scheme=${scheme.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  🚀 Apply & Execute Workflow →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RTS Act Statutory Framework Banner */}
      <div className="card">
        <div className="card-title">
          <span>📜 Statutory Framework: Maharashtra Right to Services (RTS) Act 2015</span>
        </div>
        <div className="grid-2" style={{ gap: 16, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>1. Time-Bound Service Guarantee:</strong>
            <p style={{ marginTop: 4, lineHeight: 1.5 }}>
              The RTS Act mandates state departments to deliver citizen services within stipulated timeframes. GIL provides sub-second verification API endpoints that eliminate departmental back-and-forth delays.
            </p>
          </div>
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>2. Transparent Status Tracking:</strong>
            <p style={{ marginTop: 4, lineHeight: 1.5 }}>
              Every scheme application includes a unique tracking ID (`REQ-YYYYMMDD-XXXX`) and real-time SSE event stream, allowing citizens and officers to track pipeline stages transparently.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
