// SIH26129 GIL — Unified API Client & Resilient Multi-Department Mock Engine

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
  notes?: string
}

export interface DepartmentMeta {
  id: string
  name: string
  agency: string
  protocol: string
  datasetSource: string
  icon: string
  color: string
}

export const DEPARTMENTS: Record<string, DepartmentMeta> = {
  aadhaar: {
    id: 'aadhaar',
    name: 'Aadhaar Identity & e-KYC',
    agency: 'UIDAI / Ministry of Electronics & IT',
    protocol: 'REST / OAuth2 JWT',
    datasetSource: 'data.gov.in (Aadhaar Monthly Enrolment & Authentication)',
    icon: '🆔',
    color: '#0284c7',
  },
  pan: {
    id: 'pan',
    name: 'PAN Verification & Taxpayer Status',
    agency: 'Income Tax Department (CBDT)',
    protocol: 'REST / Encrypted API',
    datasetSource: 'Centralized Taxpayer Identification Network',
    icon: '💳',
    color: '#059669',
  },
  digilocker: {
    id: 'digilocker',
    name: 'DigiLocker Verifiable Credentials',
    agency: 'MeitY / Digital India Corporation',
    protocol: 'REST / OAuth2 PKCE',
    datasetSource: 'National Verifiable Document Repository',
    icon: '📂',
    color: '#7c3aed',
  },
  education: {
    id: 'education',
    name: 'Education & Academic Registry',
    agency: 'Dept. of Higher & Technical Education / MahaDBT',
    protocol: 'REST / Academic Bank of Credits',
    datasetSource: 'Maharashtra Board & University Consolidated Registry',
    icon: '🎓',
    color: '#d97706',
  },
  udid: {
    id: 'udid',
    name: 'UDID Disability Registry',
    agency: 'Dept. of Social Justice & Special Assistance',
    protocol: 'REST / Swavlamban Portal',
    datasetSource: 'data.gov.in (Unique Disability ID Card Maharashtra)',
    icon: '♿',
    color: '#dc2626',
  },
  employment: {
    id: 'employment',
    name: 'Employment Registry',
    agency: 'Dept. of Skills, Employment & Innovation',
    protocol: 'REST / OAuth2',
    datasetSource: 'MahaSwayam Employment Portal',
    icon: '💼',
    color: '#0f2e59',
  },
  skills: {
    id: 'skills',
    name: 'Skills & Vocational Certifications',
    agency: 'Maharashtra State Skill Development Society',
    protocol: 'SOAP / XML WS-Security',
    datasetSource: 'NSDC / MSSDS Skill Portal',
    icon: '📜',
    color: '#475569',
  },
  revenue: {
    id: 'revenue',
    name: 'Land Revenue & Property Dues',
    agency: 'Revenue and Forest Department',
    protocol: 'Direct PostgreSQL / pgcrypto',
    datasetSource: 'Maha-Bhulekh District Cadastral Registry',
    icon: '🌾',
    color: '#16a34a',
  },
}

// ─── Master Mock Citizens ───────────────────────────────────────────────────

export const MASTER_CITIZENS = [
  {
    id: 'MAHA-2024-001',
    name: 'Priya Sharma',
    district: 'Pune District',
    gender: 'Female',
    dob: '1995-08-14',
    systems: {
      aadhaar: 'XXXX-XXXX-8821',
      pan: 'ABCPS1234F',
      digilocker: 'DL-MH-99201',
      education: 'EDU-MH-2016-88',
      udid: 'MH-PUN-2023-0091',
      employment: 'EMP-7789',
      skills: 'SK-2031',
      revenue: 'LP-3301',
    },
    data: {
      aadhaar: {
        enrolment_id: '1029/30291/00192',
        state: 'Maharashtra',
        district: 'Pune',
        sub_district: 'Haveli',
        vtc: 'Pune City',
        ekyc_verified: true,
        verification_method: 'Biometric / Fingerprint & Iris',
        last_auth_timestamp: '2026-09-20 14:22:10',
        aadhaar_linked_mobile: 'XXXXXX9912',
      },
      pan: {
        pan_number: 'ABCPS1234F',
        name_on_card: 'Priya Sharma',
        taxpayer_category: 'Individual',
        aadhaar_seeding_status: 'LINKED & VERIFIED',
        tax_filing_status: 'REGULAR COMPLIANT (AY 2025-26)',
        income_tier: '₹4.5L - ₹7.5L per annum',
      },
      digilocker: {
        account_id: 'DL-MH-99201',
        linked_documents_count: 5,
        issued_documents: [
          { type: 'Caste Certificate', uri: 'in.gov.maharashtra.edistrict:CAST:2020-00192', status: 'VERIFIED' },
          { type: 'Domicile Certificate', uri: 'in.gov.maharashtra.edistrict:DOM:2018-7718', status: 'VERIFIED' },
          { type: 'Income Certificate', uri: 'in.gov.maharashtra.edistrict:INC:2025-4410', status: 'VERIFIED' },
          { type: 'Class XII Marksheet', uri: 'in.gov.cbse:MS:2013-909182', status: 'VERIFIED' },
          { type: 'B.Tech Degree', uri: 'in.edu.sppu:DEG:2017-00921', status: 'VERIFIED' },
        ],
      },
      education: {
        registration_no: 'EDU-MH-2016-88',
        highest_qualification: 'Bachelor of Technology (Computer Engineering)',
        board_university: 'Savitribai Phule Pune University (SPPU)',
        passing_year: 2017,
        cgpa: '8.75 / 10',
        scholarship_availed: 'Post-Matric Scholarship for OBC Students (MahaDBT)',
      },
      udid: {
        udid_card_no: 'MH-PUN-2023-0091',
        disability_type: 'Locomotor Disability (Mild)',
        disability_percentage: '25%',
        validity: 'PERMANENT',
        issuing_authority: 'District Medical Board, Sassoon Hospital Pune',
        pension_eligibility: 'ELIGIBLE FOR ASSISTIVE EQUIPMENT SUBSIDY',
      },
      employment: {
        employment_id: 'EMP-7789',
        status: 'EMPLOYED',
        employer_name: 'Maha Tech Solutions Pvt Ltd',
        designation: 'Software Quality Assurance Engineer',
        nco_code: '2512.0100',
        monthly_income: '₹55,000',
        registration_date: '2019-03-12',
      },
      skills: {
        skill_id: 'SK-2031',
        training_center: 'Government Industrial Training Institute (ITI) Aundh Pune',
        course_name: 'Advanced Industrial Automation & AutoCAD',
        certification_level: 'NSQF Level 5',
        certification_date: '2021-11-20',
        grade: 'GRADE A (EXCELLENT)',
      },
      revenue: {
        land_parcel_id: 'LP-3301',
        survey_number: '142/A/2',
        taluka: 'Haveli',
        village: 'Kothrud',
        area_hectares: '0.45 Ha',
        property_tax_dues: '₹0 (CLEARED)',
        khata_number: 'KHT-9012',
      },
    },
  },
  {
    id: 'MAHA-2024-002',
    name: 'Rahul Deshmukh',
    district: 'Nagpur District',
    gender: 'Male',
    dob: '1992-03-25',
    systems: {
      aadhaar: 'XXXX-XXXX-4490',
      pan: 'XYZRD5678G',
      digilocker: 'DL-MH-11409',
      education: 'EDU-MH-2012-33',
      udid: 'MH-NAG-2021-0442',
      employment: 'EMP-4421',
      skills: 'SK-0897',
      revenue: 'LP-1102',
    },
    data: {
      aadhaar: {
        enrolment_id: '2048/11902/09121',
        state: 'Maharashtra',
        district: 'Nagpur',
        sub_district: 'Nagpur Urban',
        vtc: 'Nagpur City',
        ekyc_verified: true,
        verification_method: 'OTP Authentication',
        last_auth_timestamp: '2026-09-18 10:11:05',
        aadhaar_linked_mobile: 'XXXXXX4410',
      },
      pan: {
        pan_number: 'XYZRD5678G',
        name_on_card: 'Rahul Deshmukh',
        taxpayer_category: 'Individual',
        aadhaar_seeding_status: 'LINKED & VERIFIED',
        tax_filing_status: 'NON-FILER / BELOW TAXABLE LIMIT',
        income_tier: 'Below ₹2.5L per annum',
      },
      digilocker: {
        account_id: 'DL-MH-11409',
        linked_documents_count: 3,
        issued_documents: [
          { type: 'Domicile Certificate', uri: 'in.gov.maharashtra.edistrict:DOM:2015-1102', status: 'VERIFIED' },
          { type: 'Class X Marksheet', uri: 'in.gov.maharashtraboard:MS:2008-55102', status: 'VERIFIED' },
          { type: 'Disability Certificate', uri: 'in.gov.swavlamban:UDID:2021-0442', status: 'VERIFIED' },
        ],
      },
      education: {
        registration_no: 'EDU-MH-2012-33',
        highest_qualification: 'Higher Secondary Certificate (HSC Commerce)',
        board_university: 'Maharashtra State Board of Secondary & Higher Secondary Education',
        passing_year: 2010,
        cgpa: '64.5%',
        scholarship_availed: 'State Government Unemployment Allowance Support',
      },
      udid: {
        udid_card_no: 'MH-NAG-2021-0442',
        disability_type: 'Hearing Impairment (Profound)',
        disability_percentage: '65%',
        validity: 'PERMANENT',
        issuing_authority: 'District Medical Board, Indira Gandhi Govt General Hospital Nagpur',
        pension_eligibility: 'FULL MONTHLY DISABILITY PENSION & SCHEME BENEFICIARY',
      },
      employment: {
        employment_id: 'EMP-4421',
        status: 'UNEMPLOYED / SEEKING JOB',
        employer_name: 'NONE',
        designation: 'N/A',
        nco_code: '9312.0100',
        monthly_income: '₹0',
        registration_date: '2022-01-15',
      },
      skills: {
        skill_id: 'SK-0897',
        training_center: 'Nagpur Vocational Skill Center',
        course_name: 'Solar Panel Technician & Electrical Maintenance',
        certification_level: 'NSQF Level 4',
        certification_date: '2023-06-10',
        grade: 'GRADE B (PASS)',
      },
      revenue: {
        land_parcel_id: 'LP-1102',
        survey_number: '78/3',
        taluka: 'Nagpur Rural',
        village: 'Hingna',
        area_hectares: '1.20 Ha',
        property_tax_dues: '₹4,850 (OVERDUE)',
        khata_number: 'KHT-3310',
      },
    },
  },
]

// Local state tracking for mock operations
const mockConsentStore: Record<string, string[]> = {
  'MAHA-2024-001': ['aadhaar', 'pan', 'digilocker', 'education', 'udid', 'employment', 'skills', 'revenue'],
  'MAHA-2024-002': ['aadhaar', 'pan', 'digilocker', 'education', 'udid', 'employment', 'skills', 'revenue'],
}

const mockFailureModes: Record<string, boolean> = {
  aadhaar: false,
  pan: false,
  digilocker: false,
  education: false,
  udid: false,
  employment: false,
  skills: false,
  revenue: false,
}

const mockManualReviewItems: ManualReviewItem[] = [
  {
    id: 'REV-901',
    request_id: 'REQ-20260923-8812',
    system_name: 'employment',
    error_trace: 'HTTP 503 Service Unavailable (3 retries exhausted)',
    retry_count: 3,
    status: 'PENDING_REVIEW',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'REV-902',
    request_id: 'REQ-20260923-4410',
    system_name: 'skills',
    error_trace: 'SOAP Fault: Connection Timeout to MSSDS Server',
    retry_count: 3,
    status: 'PENDING_REVIEW',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

const mockAuditLogs: AuditEntry[] = [
  {
    audit_id: 'AUD-9901',
    timestamp: new Date().toISOString(),
    actor: 'SkillDeptOfficer',
    action: 'GIL_REQUEST_SUBMITTED',
    target_system: 'ALL_SYSTEMS',
    data_category: 'skills,employment,revenue',
    payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    consent_id: 'CONSENT-MH-2024-001',
    result_status: 'SUCCESS',
    request_id: 'REQ-20260923-0001',
  },
]

// ─── API Functions with Backend Calling & Fallback Mock ──────────────────────

export async function login(username: string, role: string): Promise<TokenResponse> {
  try {
    const resp = await fetch(`${GIL_API}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'demo', role }),
    })
    if (resp.ok) return resp.json()
  } catch {}
  
  // Fallback Mock Token
  return {
    access_token: `mock-token-${Date.now()}-${username}`,
    token_type: 'bearer',
    expires_in: 3600,
    role,
  }
}

export async function getSchemes(): Promise<Record<string, SchemeDefinition>> {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/workflows/schemes`)
    if (resp.ok) return resp.json()
  } catch {}

  return {
    citizen_360: {
      id: 'citizen_360',
      name: 'Comprehensive Citizen 360-Degree Master Verification',
      department: 'General Administration & Governance',
      description: 'Full cross-departmental reconciliation across Identity, Tax, DigiLocker, Education, UDID Disability, Employment, Skills, and Land Revenue.',
      categories: ['aadhaar', 'pan', 'digilocker', 'education', 'udid', 'employment', 'skills', 'revenue'],
      default_purpose: 'comprehensive_citizen_verification',
      sla_target_seconds: 2.0,
      mandatory_systems: ['aadhaar', 'employment', 'revenue'],
    },
    cmegp: {
      id: 'cmegp',
      name: 'Chief Minister Employment Generation Programme (CMEGP)',
      department: 'Industries, Energy and Labour Department',
      description: 'Verifies citizen identity (Aadhaar/PAN), employment status, and land assets for micro-enterprise credit subsidy.',
      categories: ['aadhaar', 'pan', 'employment', 'revenue'],
      default_purpose: 'cmegp_credit_subsidy_verification',
      sla_target_seconds: 1.5,
      mandatory_systems: ['aadhaar', 'employment', 'revenue'],
    },
    pramod_mahajan: {
      id: 'pramod_mahajan',
      name: 'Pramod Mahajan Kaushalya Scheme (PMKSD)',
      department: 'Skills, Employment, Entrepreneurship & Innovation',
      description: 'Evaluates NSDC/MSSDS vocational training completion, educational records, and job placement for stipend release.',
      categories: ['skills', 'education', 'employment', 'digilocker'],
      default_purpose: 'vocational_placement_stipend_release',
      sla_target_seconds: 1.5,
      mandatory_systems: ['skills', 'employment'],
    },
    udid_welfare: {
      id: 'udid_welfare',
      name: 'Maharashtra Swavlamban Disability Pension & Equipment Subsidy',
      department: 'Department of Social Justice & Special Assistance',
      description: 'Reconciles UDID card authenticity, percentage disability, and bank/Aadhaar seeding for direct benefit transfer (DBT).',
      categories: ['aadhaar', 'udid', 'digilocker', 'revenue'],
      default_purpose: 'disability_pension_dbt_disbursement',
      sla_target_seconds: 1.2,
      mandatory_systems: ['aadhaar', 'udid'],
    },
    revenue_clearance: {
      id: 'revenue_clearance',
      name: 'Maha-Bhulekh Land Revenue & Dues Clearance',
      department: 'Revenue and Forest Department',
      description: 'Reconciles cadastral land parcel records, PAN taxpayer status, and property tax dues directly against core district databases.',
      categories: ['revenue', 'pan'],
      default_purpose: 'land_revenue_dues_clearance',
      sla_target_seconds: 1.0,
      mandatory_systems: ['revenue'],
    },
  }
}

export async function submitRequest(
  token: string,
  citizenId: string,
  categories: string[],
  purpose: string,
  role: string,
  schemeId?: string
): Promise<OrchestrationResponse> {
  try {
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
    if (resp.ok) return resp.json()
  } catch {}

  const requestId = `REQ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`
  
  // Save mock audit entry
  mockAuditLogs.unshift({
    audit_id: `AUD-${Math.floor(1000 + Math.random()*9000)}`,
    timestamp: new Date().toISOString(),
    actor: role,
    action: 'GIL_REQUEST_SUBMITTED',
    target_system: categories.join(','),
    data_category: categories.join(','),
    payload_hash: `${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
    consent_id: `CONSENT-${citizenId}`,
    result_status: 'SUCCESS',
    request_id: requestId,
  })

  return {
    request_id: requestId,
    status: 'IN_PROGRESS',
    sse_url: `${GIL_API}/api/v1/requests/${requestId}/stream`,
  }
}

export async function getStatus(token: string, requestId: string, citizenId?: string, role: string = 'SkillDeptOfficer', categories: string[] = ['employment', 'skills', 'revenue', 'aadhaar']): Promise<StatusResponse> {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/requests/${requestId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) return resp.json()
  } catch {}

  // Fallback Mock Status generator based on citizen data
  const citizen = MASTER_CITIZENS.find(c => c.id === (citizenId || 'MAHA-2024-001')) || MASTER_CITIZENS[0]
  const citizenConsent = mockConsentStore[citizen.id] || []

  const systemsStatus: Record<string, SystemStatus> = {}
  const fetchedResult: Record<string, unknown> = {}
  const rbacRedactions: string[] = []

  categories.forEach(cat => {
    const isConsentGiven = citizenConsent.includes(cat)
    const isFailed = mockFailureModes[cat]

    if (!isConsentGiven) {
      systemsStatus[cat] = { stage: 'consent_denied', retry_count: 0, error: 'Consent revoked by citizen under DPDP Act' }
    } else if (isFailed) {
      systemsStatus[cat] = { stage: 'failed', retry_count: 3, error: 'Target System Timeout (Exhausted 3 retries → Sent to Manual Review Queue)' }
    } else {
      systemsStatus[cat] = { stage: 'completed', retry_count: 0 }
      
      // Perform RBAC Redaction based on Officer Role
      const catData = { ...(citizen.data[cat as keyof typeof citizen.data] || {}) } as Record<string, unknown>
      
      // Officer role redaction rules
      if (role === 'SkillDeptOfficer') {
        if (cat === 'employment') {
          delete catData.monthly_income
          rbacRedactions.push('employment.monthly_income')
        }
        if (cat === 'revenue') {
          delete catData.property_tax_dues
          delete catData.khata_number
          rbacRedactions.push('revenue.property_tax_dues', 'revenue.khata_number')
        }
        if (cat === 'pan') {
          delete catData.tax_filing_status
          rbacRedactions.push('pan.tax_filing_status')
        }
      } else if (role === 'RevenueDeptOfficer') {
        if (cat === 'skills') {
          delete catData.grade
          rbacRedactions.push('skills.grade')
        }
        if (cat === 'udid') {
          delete catData.pension_eligibility
          rbacRedactions.push('udid.pension_eligibility')
        }
      }

      fetchedResult[cat] = catData
    }
  })

  return {
    request_id: requestId,
    overall_status: Object.values(systemsStatus).some(s => s.stage === 'failed' || s.stage === 'consent_denied') ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
    requested_by_role: role,
    systems: systemsStatus,
    result: fetchedResult,
    rbac_redactions: Array.from(new Set(rbacRedactions)),
    created_at: new Date(Date.now() - 3000).toISOString(),
    completed_at: new Date().toISOString(),
    scheme_name: 'Comprehensive Citizen 360-Degree Verification',
    data_quality: {
      quality_score: 98.4,
      quality_grade: 'EXCELLENT (A+)',
      consistency_score: 99.1,
      discrepancies_count: 0,
      discrepancies: [],
      checks: [
        { check_name: 'MDM Identity Match', field: 'citizen_id', passed: true, weight: 30, message: 'Native IDs resolved across all registries' },
        { check_name: 'Name Alignment Check', field: 'name', passed: true, weight: 25, message: 'Match score 100% across Aadhaar, PAN, and DigiLocker' },
        { check_name: 'Consent Mandate Verification', field: 'consent', passed: true, weight: 25, message: 'Valid digital consent on record' },
        { check_name: 'RBAC Policy Enforcement', field: 'rbac', passed: true, weight: 20, message: 'Sensitive fields redacted per role' },
      ],
      evaluated_at: new Date().toISOString(),
    },
    sla_metrics: {
      target_seconds: 2.0,
      actual_seconds: 0.84,
      compliant: true,
      statutory_standard: 'Maharashtra Right to Services (RTS) Act 2015 Compliant',
    },
    notifications: [
      { channel: 'SMS', recipient: citizen.data.aadhaar.aadhaar_linked_mobile, status: 'DELIVERED', message: `GIL Alert: Cross-department inquiry initiated by ${role}. Ref: ${requestId}`, timestamp: new Date().toISOString() },
      { channel: 'Email', recipient: 'citizen@maharashtra.gov.in', status: 'DELIVERED', message: `Audit Notice: Citizen Data Fetch executed under Consent ID CONSENT-${citizen.id}`, timestamp: new Date().toISOString() },
    ],
  }
}

export function connectSSE(
  token: string,
  requestId: string,
  onEvent: (event: { stage: string; system?: string; data?: Record<string, unknown>; timestamp: string }) => void,
  onDone: () => void
): () => void {
  let closed = false

  async function simulateSSE() {
    const steps = [
      { stage: 'request_ingestion', timestamp: new Date().toISOString() },
      { stage: 'consent_validation', timestamp: new Date().toISOString() },
      { stage: 'federated_mdm_resolution', timestamp: new Date().toISOString() },
      { stage: 'multi_protocol_fanout', timestamp: new Date().toISOString() },
      { stage: 'data_quality_verification', timestamp: new Date().toISOString() },
      { stage: 'rbac_redaction_enforcement', timestamp: new Date().toISOString() },
      { stage: 'audit_ledger_commitment', timestamp: new Date().toISOString() },
      { stage: 'completed', timestamp: new Date().toISOString() },
    ]

    for (const step of steps) {
      if (closed) return
      onEvent(step)
      await new Promise(res => setTimeout(res, 350))
    }
    if (!closed) onDone()
  }

  // Try real backend stream first
  try {
    const eventSource = new EventSource(`${GIL_API}/api/v1/requests/${requestId}/stream`)
    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        onEvent(payload)
        if (['completed', 'failed'].includes(payload.stage)) {
          eventSource.close()
          onDone()
        }
      } catch {}
    }
    eventSource.onerror = () => {
      eventSource.close()
      if (!closed) simulateSSE()
    }
    return () => { closed = true; eventSource.close() }
  } catch {
    simulateSSE()
    return () => { closed = true }
  }
}

export async function getAuditLog(token: string, requestId?: string): Promise<{ entries: AuditEntry[] }> {
  try {
    const url = requestId ? `${GIL_API}/api/v1/audit/${requestId}` : `${GIL_API}/api/v1/audit`
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (resp.ok) return resp.json()
  } catch {}

  return { entries: mockAuditLogs }
}

export async function getManualReview(token: string): Promise<{ items: ManualReviewItem[]; count: number }> {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/manual-review`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) return resp.json()
  } catch {}

  return { items: mockManualReviewItems, count: mockManualReviewItems.length }
}

export async function resolveReview(token: string, id: string, resolvedBy: string, notes?: string) {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/manual-review/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resolved_by: resolvedBy, notes }),
    })
    if (resp.ok) return resp.json()
  } catch {}

  const item = mockManualReviewItems.find(i => i.id === id)
  if (item) {
    item.status = 'RESOLVED'
    item.resolved_at = new Date().toISOString()
    item.resolved_by = resolvedBy
    item.notes = notes || 'Manually verified by officer during demo'
  }
  return { status: 'success', message: `Review item ${id} resolved` }
}

export async function toggleFailure(token: string, system: string): Promise<{ failure_mode: boolean; message: string }> {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/admin/toggle-failure/${system}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) return resp.json()
  } catch {}

  mockFailureModes[system] = !mockFailureModes[system]
  return {
    failure_mode: mockFailureModes[system],
    message: `System '${system}' failure simulation is now ${mockFailureModes[system] ? 'ENABLED' : 'DISABLED'}`,
  }
}

export async function getConsentState(citizenId: string): Promise<string[]> {
  return mockConsentStore[citizenId] || Object.keys(DEPARTMENTS)
}

export async function updateConsent(
  token: string,
  citizenId: string,
  categories: string[],
  revoke: boolean
) {
  try {
    const resp = await fetch(`${GIL_API}/api/v1/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ citizen_id: citizenId, data_categories: categories, revoke }),
    })
    if (resp.ok) return resp.json()
  } catch {}

  let current = mockConsentStore[citizenId] || Object.keys(DEPARTMENTS)
  if (revoke) {
    current = current.filter(c => !categories.includes(c))
  } else {
    current = Array.from(new Set([...current, ...categories]))
  }
  mockConsentStore[citizenId] = current

  // Add audit record
  mockAuditLogs.unshift({
    audit_id: `AUD-CONSENT-${Math.floor(1000 + Math.random()*9000)}`,
    timestamp: new Date().toISOString(),
    actor: 'CitizenSelf',
    action: revoke ? 'CONSENT_REVOKED' : 'CONSENT_GRANTED',
    target_system: categories.join(','),
    data_category: categories.join(','),
    payload_hash: 'd41d8cd98f00b204e9800998ecf8427e',
    consent_id: `CONSENT-${citizenId}`,
    result_status: 'SUCCESS',
  })

  return { status: 'success', active_categories: current }
}
