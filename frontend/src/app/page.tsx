'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, submitRequest, getSchemes, SchemeDefinition } from '@/lib/api'

const ROLES = [
  'SkillDeptOfficer',
  'EmploymentDeptOfficer',
  'RevenueDeptOfficer',
  'Citizen',
  'GILService'
]

const CATEGORIES = [
  { id: 'employment', label: 'Employment Registry', sys: 'REST / OAuth2' },
  { id: 'skills', label: 'Skills & Vocational Certifications', sys: 'SOAP / XML' },
  { id: 'revenue', label: 'Land Revenue & Property Dues', sys: 'Database / Direct SQL' },
]

const CITIZENS = [
  { id: 'MAHA-2024-001', name: 'Priya Sharma', systems: 'EMP-7789 · SK-2031 · LP-3301', district: 'Pune District' },
  { id: 'MAHA-2024-002', name: 'Rahul Deshmukh', systems: 'EMP-4421 · SK-0897 · LP-1102', district: 'Nagpur District' },
]

const DEFAULT_SCHEMES: Record<string, SchemeDefinition> = {
  citizen_360: {
    id: 'citizen_360',
    name: 'Comprehensive Citizen 360-Degree Profile Verification',
    department: 'General Administration & Citizen Services',
    description: 'Full cross-departmental master reconciliation across Employment, Vocational Skills, and Land Revenue registries.',
    categories: ['employment', 'skills', 'revenue'],
    default_purpose: 'comprehensive_citizen_verification',
    sla_target_seconds: 2.0,
    mandatory_systems: ['employment', 'skill', 'revenue'],
  },
  cmegp: {
    id: 'cmegp',
    name: 'Chief Minister Employment Generation Programme (CMEGP)',
    department: 'Industries, Energy and Labour Department',
    description: 'Verifies citizen employment status, prior business registration, and land assets for micro-enterprise credit subsidy.',
    categories: ['employment', 'revenue'],
    default_purpose: 'cmegp_credit_subsidy_verification',
    sla_target_seconds: 1.5,
    mandatory_systems: ['employment', 'revenue'],
  },
  pramod_mahajan: {
    id: 'pramod_mahajan',
    name: 'Pramod Mahajan Kaushalya Scheme (PMKSD)',
    department: 'Skills, Employment, Entrepreneurship & Innovation',
    description: 'Evaluates NSDC/MSSDS vocational training completion and employment placement status for stipend release.',
    categories: ['skills', 'employment'],
    default_purpose: 'vocational_placement_stipend_release',
    sla_target_seconds: 1.5,
    mandatory_systems: ['skill', 'employment'],
  },
  revenue_clearance: {
    id: 'revenue_clearance',
    name: 'Maha-Bhulekh Land Revenue & Dues Clearance',
    department: 'Revenue and Forest Department',
    description: 'Reconciles land parcel records and property tax dues directly against core district cadastral databases.',
    categories: ['revenue'],
    default_purpose: 'land_revenue_dues_clearance',
    sla_target_seconds: 1.0,
    mandatory_systems: ['revenue'],
  },
}

export default function HomePage() {
  const router = useRouter()
  const [citizenId, setCitizenId] = useState('MAHA-2024-001')
  const [role, setRole] = useState('SkillDeptOfficer')
  const [schemes, setSchemes] = useState<Record<string, SchemeDefinition>>(DEFAULT_SCHEMES)
  const [selectedScheme, setSelectedScheme] = useState('citizen_360')
  const [categories, setCategories] = useState<string[]>(['employment', 'skills', 'revenue'])
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

  const toggleCategory = (c: string) =>
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      router.push(`/status/${orchResp.request_id}?token=${tokenResp.access_token}&role=${role}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const activeSchemeDef = schemes[selectedScheme]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🏛️ Citizen Data Consolidation Portal</h1>
        <p className="page-subtitle">
          Government of Maharashtra · Government Interoperability Layer (GIL) · Brownfield Departmental Integration Portal
        </p>
      </div>

      {/* Demo Citizens */}
      <div className="card">
        <div className="card-title">
          <span>👥 Registered Demo Citizens</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Click to select citizen profile
          </span>
        </div>
        <div className="grid-2">
          {CITIZENS.map(c => (
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
                📍 {c.district}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, borderTop: '1px dashed var(--border-subtle)', paddingTop: 4 }}>
                <strong>Native Identifiers:</strong> {c.systems}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 3, border: '1px solid var(--border-subtle)' }}>
          ℹ️ <strong>Master Data Management (MDM):</strong> Each citizen holds disjoint legacy identifiers across Employment, Skill, and Revenue databases. GIL automatically executes federated identity resolution against canonical citizen records.
        </p>
      </div>

      {/* Request Form */}
      <div className="card">
        <div className="card-title">
          <span>📋 New Cross-Departmental Query & Workflow Orchestration</span>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Scheme Selector */}
          <div className="form-group" style={{ background: '#f8fafc', padding: 14, border: '1px solid var(--border)', borderRadius: 4, marginBottom: 18 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📑 Configurable Government Scheme Workflow</span>
              <span className="badge badge-info" style={{ fontSize: 10 }}>SCHEME TEMPLATES</span>
            </label>
            <select
              className="form-select"
              value={selectedScheme}
              onChange={e => handleSchemeChange(e.target.value)}
              style={{ fontWeight: 600, color: 'var(--gov-navy)' }}
            >
              <option value="citizen_360">Comprehensive Citizen 360-Degree Profile Verification (All Registries)</option>
              <option value="cmegp">Chief Minister Employment Generation Programme (CMEGP) [Employment + Revenue]</option>
              <option value="pramod_mahajan">Pramod Mahajan Kaushalya Scheme (PMKSD) [Skills + Employment]</option>
              <option value="revenue_clearance">Maha-Bhulekh Land Revenue & Dues Clearance [Revenue Only]</option>
              <option value="custom">Custom Ad-Hoc Department Selection</option>
            </select>

            {activeSchemeDef && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, padding: '8px 10px', background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: 3 }}>
                <div><strong>Administering Department:</strong> {activeSchemeDef.department}</div>
                <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>{activeSchemeDef.description}</div>
                <div style={{ marginTop: 4, display: 'flex', gap: 16 }}>
                  <span style={{ color: 'var(--gov-navy)', fontWeight: 600 }}>
                    ⏱️ Statutory RTS Act Target SLA: {activeSchemeDef.sla_target_seconds}s
                  </span>
                  <span>Required: {activeSchemeDef.categories.join(', ')}</span>
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unique statewide citizen master identifier.</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Requesting Official Role <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => (
                  <option key={r} value={r}>
                    {r} {r === 'SkillDeptOfficer' ? '(Skill Department Officer)' : r === 'RevenueDeptOfficer' ? '(Revenue Department Officer)' : r === 'EmploymentDeptOfficer' ? '(Employment Department Officer)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Governs RBAC response redaction policy.</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Data Categories to Fetch <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <div className="checkbox-group">
              {CATEGORIES.map(c => (
                <label
                  key={c.id}
                  className={`checkbox-pill ${categories.includes(c.id) ? 'checked' : ''}`}
                  onClick={() => toggleCategory(c.id)}
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(c.id)}
                    readOnly
                    style={{ cursor: 'pointer' }}
                  />
                  <span>
                    <strong>{c.label}</strong> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({c.sys})</span>
                  </span>
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
              placeholder="e.g. scheme_eligibility_check / Mahaswayam verification"
              required
            />
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderLeft: '4px solid var(--gov-navy)', borderRadius: 4, padding: 14, marginBottom: 20, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--gov-navy)' }}>Two-Stage Security Architecture:</strong>
            <div style={{ marginTop: 4 }}>
              1. <strong>Consent-Gated Fetch:</strong> GIL fetches departmental registries using citizen consent verification.
              <br />
              2. <strong>Role-Based Access Control (RBAC Redaction):</strong> At the response stage, your assigned role (<code>{role}</code>) automatically redacts unauthorized sensitive attributes (e.g. Aadhaar hash, tax dues, income details).
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || categories.length === 0}
            style={{ padding: '10px 24px' }}
          >
            {loading ? (
              <><span className="spinner" /> Executing Interoperability Workflow...</>
            ) : (
              '🚀 Submit Interoperability Request'
            )}
          </button>
        </form>
      </div>

      {/* GIL Pipeline Stages Card */}
      <div className="card">
        <div className="card-title">
          <span>⚙️ GIL Processing Pipeline</span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0' }}>
          {[
            { step: '1', icon: '📥', title: 'Request Ingestion', sub: 'Receive & validate' },
            { step: '2', icon: '🔒', title: 'Consent Validation', sub: 'DPDP consent check' },
            { step: '3', icon: '🆔', title: 'Federated MDM', sub: 'Native ID resolution' },
            { step: '4', icon: '🔀', title: 'Multi-Protocol Fan-out', sub: 'Parallel dispatch' },
            { step: '5', icon: '🔍', title: 'Data Quality Check', sub: 'Reconciliation & DQI' },
            { step: '6', icon: '🛡️', title: 'RBAC Redaction', sub: 'Role masking' },
            { step: '7', icon: '📲', title: 'Event Notifications', sub: 'SMS & Email alert' },
            { step: '8', icon: '📜', title: 'Cryptographic Audit', sub: 'Append-only ledger' },
          ].map((s, idx) => (
            <div
              key={idx}
              style={{
                flex: '1 1 0',
                minWidth: 130,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '10px 10px',
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
