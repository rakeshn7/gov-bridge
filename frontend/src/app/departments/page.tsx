'use client'
import { useState } from 'react'
import Link from 'next/link'
import { DEPARTMENTS, MASTER_CITIZENS } from '@/lib/api'

export default function DepartmentsPage() {
  const [selectedDept, setSelectedDept] = useState('aadhaar')
  const [selectedCitizenId, setSelectedCitizenId] = useState('MAHA-2024-001')
  const [searchFilter, setSearchFilter] = useState('')

  const activeDept = DEPARTMENTS[selectedDept] || DEPARTMENTS.aadhaar
  const activeCitizen = MASTER_CITIZENS.find(c => c.id === selectedCitizenId) || MASTER_CITIZENS[0]
  const deptData = activeCitizen.data[selectedDept as keyof typeof activeCitizen.data] || {}

  const filteredCitizens = MASTER_CITIZENS.filter(c => 
    searchFilter === '' ||
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.district.toLowerCase().includes(searchFilter.toLowerCase())
  )

  return (
    <div className="fade-in">
      {/* data.gov.in Styled Catalog Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #0284c7 100%)',
        color: '#ffffff',
        padding: '28px 24px',
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.15)',
      }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, fontWeight: 700 }}>
          Open Government Data (OGD) Platform & Departmental Catalog
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 800, marginTop: 4 }}>
          🏢 Government Integrated Departmental Registries Explorer
        </h1>
        <p style={{ fontSize: 13, opacity: 0.9, marginTop: 6, maxWidth: 850, lineHeight: 1.5 }}>
          Directly inspect native records, dataset schemas, and legacy identifiers across all 8 integrated state and national departmental systems (Aadhaar, PAN, DigiLocker, Education, UDID Disability, Employment, Skills, and Land Revenue).
        </p>
      </div>

      {/* Department Tabs Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {Object.values(DEPARTMENTS).map(d => {
            const isSelected = selectedDept === d.id
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDept(d.id)}
                className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: 12.5, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <span>{d.icon}</span>
                <span>{d.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Department Overview Banner */}
      <div className="card" style={{ borderLeft: `6px solid ${activeDept.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gov-navy)' }}>
              <span>{activeDept.icon}</span> <span style={{ marginLeft: 6 }}>{activeDept.name}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              <strong>Administering Agency:</strong> {activeDept.agency}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              <strong>Dataset Standard:</strong> {activeDept.datasetSource}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="badge badge-info" style={{ fontSize: 11, padding: '6px 12px' }}>
              PROTOCOL: {activeDept.protocol}
            </span>
            <a
              href="https://data.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              🌐 View on data.gov.in
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: Citizen Search & Native Data Inspector */}
      <div className="grid-2" style={{ gap: 20 }}>
        {/* Left Column: Citizen Master Lookup */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">
            <span>👤 Select Citizen for Native Record Inspection</span>
          </div>

          <div className="form-group">
            <input
              className="form-input"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search by name, district, or citizen ID..."
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredCitizens.map(c => {
              const isSelected = selectedCitizenId === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCitizenId(c.id)}
                  className={`citizen-card ${isSelected ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--gov-navy)', fontSize: 13.5 }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 11 }}>{c.id}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    📍 {c.district}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Native ID ({activeDept.name}): <strong style={{ color: 'var(--gov-navy)' }}>{c.systems[selectedDept as keyof typeof c.systems] || 'N/A'}</strong>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Native Dataset Record Inspector */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">
            <span>📄 Native Registry Record: {activeCitizen.name}</span>
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 11 }}>
              ID: {activeCitizen.systems[selectedDept as keyof typeof activeCitizen.systems] || activeCitizen.id}
            </span>
          </div>

          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 4, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Schema Mapping & Endpoint Metadata
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              • <strong>Target Protocol:</strong> <code>{activeDept.protocol}</code>
              <br />
              • <strong>Federated Identity Resolution:</strong> Canonical <code>{activeCitizen.id}</code> → Native <code>{activeCitizen.systems[selectedDept as keyof typeof activeCitizen.systems]}</code>
            </div>
          </div>

          {/* Render Data Attributes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(deptData).map(([key, value]) => (
              <div key={key} style={{ background: '#ffffff', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gov-navy)', marginTop: 4, wordBreak: 'break-word' }}>
                  {Array.isArray(value) ? (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {value.map((item, idx) => (
                        <div key={idx} style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: 3, fontSize: 11.5 }}>
                          📄 <strong>{item.type || 'Document'}:</strong> {item.uri || item.status} ({item.status})
                        </div>
                      ))}
                    </div>
                  ) : (
                    String(value)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
