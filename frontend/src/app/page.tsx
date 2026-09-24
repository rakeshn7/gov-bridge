'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login, submitRequest, getSchemes, SchemeDefinition, MASTER_CITIZENS, DEPARTMENTS } from '@/lib/api'

const ROLES = [
  'SkillDeptOfficer',
  'EmploymentDeptOfficer',
  'RevenueDeptOfficer',
  'SocialWelfareOfficer',
  'Citizen',
  'GILService'
]

export default function HomePage() {
  const router = useRouter()
  const [citizenId, setCitizenId] = useState('MAHA-2024-001')
  const [role, setRole] = useState('SkillDeptOfficer')
  const [schemes, setSchemes] = useState<Record<string, SchemeDefinition>>({})
  const [selectedScheme, setSelectedScheme] = useState('citizen_360')
  const [categories, setCategories] = useState<string[]>([
    'aadhaar', 'pan', 'digilocker', 'education', 'udid', 'employment', 'skills', 'revenue'
  ])
  const [purpose, setPurpose] = useState('comprehensive_citizen_verification')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSchemes().then(data => {
      if (data && Object.keys(data).length > 0) {
        setSchemes(data)
      }
    }).catch(() => {})
  }, [])

  const handleSchemeChange = (schemeId: string) => {
    setSelectedScheme(schemeId)
    if (schemeId !== 'custom' && schemes[schemeId]) {
      const def = schemes[schemeId]
      setCategories(def.categories)
      setPurpose(def.default_purpose)
    }
  }

  const toggleCategory = (catId: string) => {
    setCategories(prev => prev.includes(catId) ? prev.filter(x => x !== catId) : [...prev, catId])
  }

  const selectAllCategories = () => {
    setCategories(Object.keys(DEPARTMENTS))
  }

  const clearAllCategories = () => {
    setCategories([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (categories.length === 0) {
      setError('Please select at least one departmental data category.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const tokenResp = await login(citizenId, role)
      const orchResp = await submitRequest(
        tokenResp.access_token,
        citizenId,
        categories,
        purpose,
        role,
        selectedScheme !== 'custom' ? selectedScheme : undefined
      )
      const catsQuery = categories.join(',')
      router.push(`/status/${orchResp.request_id}?token=${tokenResp.access_token}&role=${role}&citizen=${citizenId}&cats=${catsQuery}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const activeSchemeDef = schemes[selectedScheme]
  const activeCitizen = MASTER_CITIZENS.find(c => c.id === citizenId) || MASTER_CITIZENS[0]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🏛️ Citizen Data Consolidation & Scheme Eligibility Portal</h1>
        <p className="page-subtitle">
          Government of Maharashtra · GovBridge — Government Interoperability Layer (GIL) · Unified Multi-Department Integration Engine
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <Link href="/departments" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ marginBottom: 0, padding: 14, background: '#f8fafc', borderLeft: '4px solid #0f2e59', cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f2e59' }}>🏢 Departmental Explorer</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Inspect data across all 8 integrated state registries.</div>
          </div>
        </Link>
        <Link href="/consent" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ marginBottom: 0, padding: 14, background: '#f8fafc', borderLeft: '4px solid #7c3aed', cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>🛡️ Consent Manager</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Grant or revoke DPDP Act access permissions.</div>
          </div>
        </Link>
        <Link href="/audit" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ marginBottom: 0, padding: 14, background: '#f8fafc', borderLeft: '4px solid #059669', cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>📋 Audit Register</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Verify SHA-256 cryptographic audit entries.</div>
          </div>
        </Link>
      </div>

      {/* Demo Citizens Master Selector */}
      <div className="card">
        <div className="card-title">
          <span>👥 Registered Demo Citizens (MDM Federated Identity)</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Select profile to auto-populate master IDs
          </span>
        </div>
        <div className="grid-2">
          {MASTER_CITIZENS.map(c => (
            <div
              key={c.id}
              onClick={() => setCitizenId(c.id)}
              className={`citizen-card ${citizenId === c.id ? 'selected' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--gov-navy)', fontSize: 14 }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 11 }}>{c.id}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                📍 {c.district} · {c.gender}, DOB: {c.dob}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, borderTop: '1px dashed var(--border-subtle)', paddingTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div>🆔 <strong>Aadhaar:</strong> {c.systems.aadhaar}</div>
                <div>💳 <strong>PAN:</strong> {c.systems.pan}</div>
                <div>♿ <strong>UDID:</strong> {c.systems.udid}</div>
                <div>💼 <strong>Employment:</strong> {c.systems.employment}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
          ℹ️ <strong>Master Data Management (MDM):</strong> GIL automatically resolves citizen identity across Aadhaar (UIDAI), PAN (CBDT), DigiLocker (MeitY), Education (MahaDBT), UDID (Swavlamban data.gov.in), Employment (MahaSwayam), Skills (MSSDS), and Land Revenue (Maha-Bhulekh).
        </div>
      </div>

      {/* New Interoperability Query Form */}
      <div className="card">
        <div className="card-title">
          <span>📋 New Multi-Department Interoperability Request</span>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Scheme Template Selector */}
          <div className="form-group" style={{ background: '#f8fafc', padding: 14, border: '1px solid var(--border)', borderRadius: 4, marginBottom: 18 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📑 Maharashtra Govt Scheme Template</span>
              <span className="badge badge-info" style={{ fontSize: 10 }}>AUTOMATIC WORKFLOW</span>
            </label>
            <select
              className="form-select"
              value={selectedScheme}
              onChange={e => handleSchemeChange(e.target.value)}
              style={{ fontWeight: 600, color: 'var(--gov-navy)' }}
            >
              {Object.values(schemes).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.department})
                </option>
              ))}
              <option value="custom">Custom Ad-Hoc Department Selection</option>
            </select>

            {activeSchemeDef && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, padding: '8px 10px', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 3 }}>
                <div><strong>Administering Agency:</strong> {activeSchemeDef.department}</div>
                <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>{activeSchemeDef.description}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ color: 'var(--gov-navy)', fontWeight: 600 }}>
                    ⏱️ Statutory RTS Act Target SLA: {activeSchemeDef.sla_target_seconds}s
                  </span>
                  <span>Required Registries: {activeSchemeDef.categories.join(', ')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                Canonical Citizen ID <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                className="form-input"
                value={citizenId}
                onChange={e => setCitizenId(e.target.value)}
                placeholder="e.g. MAHA-2024-001"
                required
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Statewide master citizen identifier (currently selected: {activeCitizen.name}).</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Requesting Official Role <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => (
                  <option key={r} value={r}>
                    {r} {r === 'SkillDeptOfficer' ? '(Skill Department Officer)' : r === 'RevenueDeptOfficer' ? '(Revenue Department Officer)' : r === 'SocialWelfareOfficer' ? '(Social Welfare Officer - UDID)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Determines RBAC response field redaction rules.</span>
            </div>
          </div>

          {/* Department Selection Checkboxes */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Target Departmental Registries ({categories.length} / {Object.keys(DEPARTMENTS).length} selected) <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllCategories}>Select All 8</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllCategories}>Clear</button>
              </div>
            </div>

            <div className="checkbox-group">
              {Object.values(DEPARTMENTS).map(dept => (
                <label
                  key={dept.id}
                  className={`checkbox-pill ${categories.includes(dept.id) ? 'checked' : ''}`}
                  onClick={() => toggleCategory(dept.id)}
                  style={{ flex: '1 1 calc(25% - 10px)', minWidth: 220 }}
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(dept.id)}
                    readOnly
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div><span>{dept.icon}</span> <strong>{dept.name}</strong></div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{dept.protocol}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Official Purpose & Justification <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <input
              className="form-input"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. scheme_eligibility_check / Mahaswayam DBT verification"
              required
            />
          </div>

          {/* Two Stage Security Architecture Box */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderLeft: '4px solid var(--gov-navy)', borderRadius: 4, padding: 14, marginBottom: 20, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>🔒 Two-Stage Security Architecture:</strong>
            <div style={{ marginTop: 4, lineHeight: 1.5 }}>
              1. <strong>Consent Check (DPDP Act):</strong> GIL checks citizen consent registry prior to triggering adapter fetch.
              <br />
              2. <strong>RBAC Redaction:</strong> Based on officer role <code>({role})</code>, unauthorized fields (e.g. income tier, property dues, pension details) will be redacted in the response payload.
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || categories.length === 0}
            style={{ padding: '10px 24px', fontSize: 14 }}
          >
            {loading ? (
              <><span className="spinner" /> Executing Interoperability Workflow...</>
            ) : (
              '🚀 Submit Interoperability Request'
            )}
          </button>
        </form>
      </div>

      {/* GIL 8-Step Processing Visualizer */}
      <div className="card">
        <div className="card-title">
          <span>⚙️ GIL Interoperability Pipeline Stages</span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0' }}>
          {[
            { step: '1', icon: '📥', title: 'Ingestion', sub: 'Validate request' },
            { step: '2', icon: '🔒', title: 'Consent Check', sub: 'DPDP verification' },
            { step: '3', icon: '🆔', title: 'Federated MDM', sub: 'Cross-system resolution' },
            { step: '4', icon: '🔀', title: 'Fan-out Adapter', sub: 'REST/SOAP dispatch' },
            { step: '5', icon: '🔍', title: 'Data Quality', sub: 'Reconciliation score' },
            { step: '6', icon: '🛡️', title: 'RBAC Redaction', sub: 'Role masking' },
            { step: '7', icon: '📲', title: 'Notifications', sub: 'SMS & Email alert' },
            { step: '8', icon: '📜', title: 'Audit Ledger', sub: 'SHA-256 commitment' },
          ].map((s, idx) => (
            <div
              key={idx}
              style={{
                flex: '1 1 0',
                minWidth: 120,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '10px 8px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gov-navy)', marginTop: 4 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
