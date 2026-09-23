// SIH26129 GIL — API client and SSE utilities

const GIL_API = process.env.NEXT_PUBLIC_GIL_API_URL || 'http://localhost:8000'

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  role: string
}

export interface OrchestrationResponse {
  request_id: string
  status: string
  sse_url: string
}

export interface SystemStatus {
  stage: string
  retry_count: number
  error?: string
}

export interface DataQualityCheck {
  check_name: string
  field: string
  passed: boolean
  weight: number
  message: string
}

export interface DataQualityDiscrepancy {
  field: string
  issue: string
  details: Record<string, string>
  severity: string
}

export interface DataQualityReport {
  quality_score: number
  quality_grade: string
  consistency_score: number
  discrepancies_count: number
  discrepancies: DataQualityDiscrepancy[]
  checks: DataQualityCheck[]
  evaluated_at: string
}

export interface SlaMetrics {
  target_seconds: number
  actual_seconds: number
  compliant: boolean
  statutory_standard: string
}

export interface NotificationRecord {
  channel: string
  recipient: string
  status: string
  message: string
  timestamp: string
}

export interface StatusResponse {
  request_id: string
  overall_status: string
  requested_by_role: string
  systems: Record<string, SystemStatus>
  result?: Record<string, unknown>
  rbac_redactions: string[]
  created_at?: string
  completed_at?: string
  scheme_id?: string
  scheme_name?: string
  data_quality?: DataQualityReport
  sla_metrics?: SlaMetrics
  notifications?: NotificationRecord[]
}

export interface SchemeDefinition {
  id: string
  name: string
  department: string
  description: string
  categories: string[]
  default_purpose: string
  sla_target_seconds: number
  mandatory_systems: string[]
}

export interface AuditEntry {
  audit_id: string
  timestamp: string
  actor: string
  action: string
  target_system?: string
  data_category?: string
  payload_hash?: string
  consent_id?: string
  result_status?: string
  request_id?: string
  metadata?: Record<string, unknown>
}

export interface ManualReviewItem {
  id: string
  request_id: string
  system_name: string
  error_trace?: string
  retry_count: number
  status: string
  created_at: string
  resolved_at?: string
  resolved_by?: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username: string, role: string): Promise<TokenResponse> {
  const resp = await fetch(`${GIL_API}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'demo', role }),
  })
  if (!resp.ok) throw new Error(`Login failed: ${resp.statusText}`)
  return resp.json()
}

// ─── Schemes ──────────────────────────────────────────────────────────────────

export async function getSchemes(): Promise<Record<string, SchemeDefinition>> {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/workflows/schemes`)
    if (!resp.ok) return {}
    return resp.json()
  } catch {
    return {}
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export async function submitRequest(
  token: string,
  citizenId: string,
  categories: string[],
  purpose: string,
  role: string,
  schemeId?: string
): Promise<OrchestrationResponse> {
  const payload: Record<string, unknown> = {
    citizen_id: citizenId,
    data_categories: categories,
    purpose,
    requested_by: role,
  }
  if (schemeId && schemeId !== 'custom') {
    payload.scheme_id = schemeId
  }

  const resp = await fetch(`${GIL_API}/api/v1/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return resp.json()
}

export async function getStatus(token: string, requestId: string): Promise<StatusResponse> {
  const resp = await fetch(`${GIL_API}/api/v1/requests/${requestId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error(`Status fetch failed: ${resp.statusText}`)
  return resp.json()
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

export function connectSSE(
  token: string,
  requestId: string,
  onEvent: (event: { stage: string; system?: string; data?: Record<string, unknown>; timestamp: string }) => void,
  onDone: () => void
): () => void {
  let closed = false

  async function poll() {
    try {
      const resp = await fetch(`${GIL_API}/api/v1/requests/${requestId}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const reader = resp.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ''

      while (!closed) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const payload = JSON.parse(line.slice(5).trim())
              onEvent(payload)
              if (['completed', 'failed', 'partial'].includes(payload.stage)) {
                onDone()
                return
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('SSE stream error:', e)
    }
    if (!closed) onDone()
  }

  poll()
  return () => { closed = true }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function getAuditLog(token: string, requestId: string): Promise<{ entries: AuditEntry[] }> {
  const resp = await fetch(`${GIL_API}/api/v1/audit/${requestId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error('Audit fetch failed')
  return resp.json()
}

// ─── Manual Review ────────────────────────────────────────────────────────────

export async function getManualReview(token: string): Promise<{ items: ManualReviewItem[]; count: number }> {
  const resp = await fetch(`${GIL_API}/api/v1/manual-review`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error('Manual review fetch failed')
  return resp.json()
}

export async function resolveReview(token: string, id: string, resolvedBy: string, notes?: string) {
  const resp = await fetch(`${GIL_API}/api/v1/manual-review/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resolved_by: resolvedBy, notes }),
  })
  if (!resp.ok) throw new Error('Resolve failed')
  return resp.json()
}

// ─── Admin / Failure toggles ──────────────────────────────────────────────────

export async function toggleFailure(token: string, system: string): Promise<{ failure_mode: boolean; message: string }> {
  const resp = await fetch(`${GIL_API}/api/v1/admin/toggle-failure/${system}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) throw new Error('Toggle failed')
  return resp.json()
}

// ─── Consent ──────────────────────────────────────────────────────────────────

export async function updateConsent(
  token: string,
  citizenId: string,
  categories: string[],
  revoke: boolean
) {
  const resp = await fetch(`${GIL_API}/api/v1/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ citizen_id: citizenId, data_categories: categories, revoke }),
  })
  if (!resp.ok) throw new Error('Consent update failed')
  return resp.json()
}
