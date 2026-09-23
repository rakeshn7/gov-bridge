-- ═══════════════════════════════════════════════════════════════════════════
-- SIH26129 — Government Interoperability Framework
-- PostgreSQL Initialisation Script
-- Runs automatically on first docker-compose up via /docker-entrypoint-initdb.d/
-- ═══════════════════════════════════════════════════════════════════════════

-- MUST be first: enable pgcrypto for gen_random_uuid() used across all UUID PKs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Core Identity Tables ────────────────────────────────────────────────────

-- Canonical citizen master record (MDM layer)
CREATE TABLE IF NOT EXISTS canonical_citizens (
    canonical_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL,
    dob                 DATE,
    canonical_identifier TEXT       UNIQUE NOT NULL,  -- e.g. MAHA-2024-001
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-system identifier federation: maps canonical_id ↔ system-native IDs
-- e.g. Priya Sharma: MAHA-2024-001 ↔ EMP-7789 / SK-2031 / LP-3301
CREATE TABLE IF NOT EXISTS id_map (
    id                  SERIAL      PRIMARY KEY,
    canonical_id        UUID        NOT NULL REFERENCES canonical_citizens(canonical_id) ON DELETE CASCADE,
    system_name         TEXT        NOT NULL,   -- 'employment' | 'skill' | 'revenue'
    system_identifier   TEXT        NOT NULL,   -- native ID in that system
    UNIQUE(system_name, system_identifier)
);

-- ─── Consent Table ───────────────────────────────────────────────────────────

-- Citizen consent records (authorises adapter.fetch per data category)
CREATE TABLE IF NOT EXISTS consent (
    consent_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id      UUID        NOT NULL REFERENCES canonical_citizens(canonical_id) ON DELETE CASCADE,
    data_categories TEXT[]      NOT NULL,   -- e.g. {employment, skills, revenue}
    granted_until   TIMESTAMPTZ,            -- NULL = indefinite
    granted_by      TEXT        NOT NULL,   -- 'citizen-self' | officer ID
    revoked         BOOLEAN     DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit Log (Append-Only) ─────────────────────────────────────────────────

-- Immutable audit trail. Enforced append-only by application design.
-- No UPDATE/DELETE permissions should be granted to the app user in production.
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    actor           TEXT        NOT NULL,           -- citizen_id or officer_id
    action          TEXT        NOT NULL,           -- 'fetch' | 'submit' | 'consent_denied' | 'field_redacted' etc.
    target_system   TEXT,                           -- 'employment' | 'skill' | 'revenue' | 'gil'
    data_category   TEXT,
    payload_hash    TEXT,                           -- SHA-256 of request payload (no PII stored)
    consent_id      UUID,                           -- linked consent record
    result_status   TEXT,                           -- 'success' | 'failure' | 'denied' | 'redacted'
    request_id      UUID,                           -- orchestration request ID
    metadata        JSONB                           -- any extra context (retry count, stage, etc.)
);

-- Prevent accidental UPDATEs on audit_log (belt-and-suspenders)
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ─── Revenue Registry (Mock System 3) ───────────────────────────────────────

-- NOTE: citizen_canonical_id intentionally has NO FK constraint.
-- Real legacy revenue data pre-dates citizen reconciliation. The column is
-- populated by DbAdapter.reconcile(), which runs during identity-mapping
-- lookup and back-fills the canonical_id once a match is found in id_map.
CREATE TABLE IF NOT EXISTS revenue_registry (
    id                      SERIAL      PRIMARY KEY,
    revenue_id              TEXT        UNIQUE NOT NULL,         -- e.g. LP-3301 (native revenue system ID)
    citizen_canonical_id    UUID,                               -- nullable until reconciled (no FK by design)
    land_parcel_id          TEXT,
    tax_status              TEXT,                               -- 'paid' | 'overdue' | 'pending'
    outstanding_amount      NUMERIC(12,2),
    last_assessment_date    DATE,
    address                 TEXT,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GIL Operational Tables ──────────────────────────────────────────────────

-- Mapping configurations (YAML files are primary; DB store is admin override)
CREATE TABLE IF NOT EXISTS mapping_configs (
    id          SERIAL      PRIMARY KEY,
    system_name TEXT        UNIQUE NOT NULL,
    config      JSONB       NOT NULL,
    version     INT         DEFAULT 1,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Orchestration requests (status tracking per cross-system request)
CREATE TABLE IF NOT EXISTS orchestration_requests (
    request_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_canonical_id    UUID        REFERENCES canonical_citizens(canonical_id),
    canonical_identifier    TEXT        NOT NULL,
    data_categories         TEXT[]      NOT NULL,
    purpose                 TEXT,
    requested_by            TEXT,                   -- role of requester
    overall_status          TEXT        DEFAULT 'received',
    system_statuses         JSONB       DEFAULT '{}',
    result                  JSONB,
    rbac_redactions         TEXT[]      DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

-- Manual review queue (permanent records, created only on retry exhaustion)
-- Redis queue holds transient in-flight retries; this table persists exhausted items
CREATE TABLE IF NOT EXISTS manual_review_queue (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID        NOT NULL REFERENCES orchestration_requests(request_id),
    system_name     TEXT        NOT NULL,
    error_trace     TEXT,
    retry_count     INT         DEFAULT 0,
    request_payload JSONB,
    status          TEXT        DEFAULT 'pending',  -- 'pending' | 'resolved'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,
    notes           TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — Cross-System Identity Reconciliation
-- "Wow moment": same citizen, three completely different native IDs
-- ═══════════════════════════════════════════════════════════════════════════

-- Canonical citizen master records
INSERT INTO canonical_citizens (canonical_id, name, dob, canonical_identifier) VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', 'Priya Sharma',   '1995-07-14', 'MAHA-2024-001'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'Rahul Deshmukh', '1988-03-22', 'MAHA-2024-002')
ON CONFLICT (canonical_identifier) DO NOTHING;

-- Identity map: completely different native IDs per system per citizen
INSERT INTO id_map (canonical_id, system_name, system_identifier) VALUES
    -- Priya Sharma: EMP-7789 (employment) | SK-2031 (skill) | LP-3301 (revenue)
    ('a1b2c3d4-0001-0001-0001-000000000001', 'employment', 'EMP-7789'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'skill',      'SK-2031'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'revenue',    'LP-3301'),
    -- Rahul Deshmukh: EMP-4421 (employment) | SK-0897 (skill) | LP-1102 (revenue)
    ('a1b2c3d4-0002-0002-0002-000000000002', 'employment', 'EMP-4421'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'skill',      'SK-0897'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'revenue',    'LP-1102')
ON CONFLICT (system_name, system_identifier) DO NOTHING;

-- Revenue registry (citizen_canonical_id pre-filled to simulate post-reconciliation state)
INSERT INTO revenue_registry
    (revenue_id, citizen_canonical_id, land_parcel_id, tax_status, outstanding_amount, last_assessment_date, address)
VALUES
    ('LP-3301', 'a1b2c3d4-0001-0001-0001-000000000001', 'PARCEL-MH-4410', 'paid',    0.00,    '2024-01-15', 'Flat 3B, Shivaji Nagar, Pune 411005'),
    ('LP-1102', 'a1b2c3d4-0002-0002-0002-000000000002', 'PARCEL-MH-2287', 'overdue', 4850.00, '2023-10-01', '12, Gandhi Road, Nashik 422001')
ON CONFLICT (revenue_id) DO NOTHING;

-- Consent grants (covers all three data categories; valid for 30 days from seed)
INSERT INTO consent (citizen_id, data_categories, granted_until, granted_by) VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', '{employment,skills,revenue}', NOW() + INTERVAL '30 days', 'citizen-self'),
    ('a1b2c3d4-0002-0002-0002-000000000002', '{employment,skills,revenue}', NOW() + INTERVAL '30 days', 'citizen-self');

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes for common query patterns
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_id_map_canonical       ON id_map(canonical_id);
CREATE INDEX IF NOT EXISTS idx_id_map_system          ON id_map(system_name, system_identifier);
CREATE INDEX IF NOT EXISTS idx_consent_citizen        ON consent(citizen_id) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_request          ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor            ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_manual_review_status   ON manual_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_orch_canonical         ON orchestration_requests(canonical_identifier);
CREATE INDEX IF NOT EXISTS idx_revenue_canonical      ON revenue_registry(citizen_canonical_id);
