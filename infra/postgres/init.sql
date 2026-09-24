-- ═══════════════════════════════════════════════════════════════════════════
-- SIH26129 — Government Interoperability Layer (GIL)
-- PostgreSQL Initialisation Script & Multi-Department Seed Database
-- Runs automatically on docker-compose up via /docker-entrypoint-initdb.d/
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Core Identity Tables ────────────────────────────────────────────────────

-- Canonical citizen master record (MDM layer)
CREATE TABLE IF NOT EXISTS canonical_citizens (
    canonical_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    dob                  DATE,
    gender               TEXT,
    district             TEXT,
    canonical_identifier TEXT        UNIQUE NOT NULL,  -- e.g. MAHA-2024-001
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-system identifier federation: maps canonical_id ↔ system-native IDs
CREATE TABLE IF NOT EXISTS id_map (
    id                  SERIAL      PRIMARY KEY,
    canonical_id        UUID        NOT NULL REFERENCES canonical_citizens(canonical_id) ON DELETE CASCADE,
    system_name         TEXT        NOT NULL,   -- 'aadhaar'|'pan'|'digilocker'|'education'|'udid'|'employment'|'skill'|'revenue'
    system_identifier   TEXT        NOT NULL,   -- native ID in that system
    UNIQUE(system_name, system_identifier)
);

-- ─── Consent Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consent (
    consent_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id      UUID        NOT NULL REFERENCES canonical_citizens(canonical_id) ON DELETE CASCADE,
    data_categories TEXT[]      NOT NULL,
    granted_until   TIMESTAMPTZ,
    granted_by      TEXT        NOT NULL,
    revoked         BOOLEAN     DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit Log (Append-Only) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    actor           TEXT        NOT NULL,
    action          TEXT        NOT NULL,
    target_system   TEXT,
    data_category   TEXT,
    payload_hash    TEXT,
    consent_id      UUID,
    result_status   TEXT,
    request_id      UUID,
    metadata        JSONB
);

CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ─── Departmental Registries (8 Working Modules) ──────────────────────────

-- 1. Aadhaar Identity Registry (UIDAI)
CREATE TABLE IF NOT EXISTS aadhaar_registry (
    id                      SERIAL      PRIMARY KEY,
    aadhaar_number          TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    enrolment_id            TEXT,
    state                   TEXT        DEFAULT 'Maharashtra',
    district                TEXT,
    sub_district            TEXT,
    vtc                     TEXT,
    ekyc_verified           BOOLEAN     DEFAULT TRUE,
    verification_method     TEXT,
    last_auth_timestamp     TIMESTAMPTZ DEFAULT NOW(),
    linked_mobile           TEXT
);

-- 2. PAN Verification Registry (CBDT)
CREATE TABLE IF NOT EXISTS pan_registry (
    id                      SERIAL      PRIMARY KEY,
    pan_number              TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    name_on_card            TEXT,
    taxpayer_category       TEXT        DEFAULT 'Individual',
    aadhaar_seeding_status  TEXT        DEFAULT 'LINKED & VERIFIED',
    tax_filing_status       TEXT,
    income_tier             TEXT
);

-- 3. DigiLocker Credentials Registry (MeitY)
CREATE TABLE IF NOT EXISTS digilocker_registry (
    id                      SERIAL      PRIMARY KEY,
    account_id              TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    linked_documents_count  INT         DEFAULT 0,
    issued_documents        JSONB
);

-- 4. Education Registry (MahaDBT)
CREATE TABLE IF NOT EXISTS education_registry (
    id                      SERIAL      PRIMARY KEY,
    registration_no         TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    highest_qualification   TEXT,
    board_university        TEXT,
    passing_year            INT,
    cgpa                    TEXT,
    scholarship_availed     TEXT
);

-- 5. UDID Disability Registry (Swavlamban data.gov.in)
CREATE TABLE IF NOT EXISTS udid_registry (
    id                      SERIAL      PRIMARY KEY,
    udid_card_no            TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    disability_type         TEXT,
    disability_percentage   TEXT,
    validity                TEXT        DEFAULT 'PERMANENT',
    issuing_authority       TEXT,
    pension_eligibility     TEXT
);

-- 6. Employment Registry (MahaSwayam)
CREATE TABLE IF NOT EXISTS employment_registry (
    id                      SERIAL      PRIMARY KEY,
    employment_id           TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    status                  TEXT,
    employer_name           TEXT,
    designation             TEXT,
    nco_code                TEXT,
    monthly_income          TEXT,
    registration_date       DATE
);

-- 7. Skill Registry (MSSDS / NSDC)
CREATE TABLE IF NOT EXISTS skill_registry (
    id                      SERIAL      PRIMARY KEY,
    skill_id                TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    training_center         TEXT,
    course_name             TEXT,
    certification_level     TEXT,
    certification_date      DATE,
    grade                   TEXT
);

-- 8. Land Revenue Registry (Maha-Bhulekh)
CREATE TABLE IF NOT EXISTS revenue_registry (
    id                      SERIAL      PRIMARY KEY,
    revenue_id              TEXT        UNIQUE NOT NULL,
    citizen_canonical_id    UUID,
    land_parcel_id          TEXT,
    survey_number           TEXT,
    taluka                  TEXT,
    village                 TEXT,
    area_hectares           TEXT,
    tax_status              TEXT,
    outstanding_amount      NUMERIC(12,2),
    khata_number            TEXT,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── GIL Operational Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mapping_configs (
    id          SERIAL      PRIMARY KEY,
    system_name TEXT        UNIQUE NOT NULL,
    config      JSONB       NOT NULL,
    version     INT         DEFAULT 1,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orchestration_requests (
    request_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_canonical_id    UUID        REFERENCES canonical_citizens(canonical_id),
    canonical_identifier    TEXT        NOT NULL,
    data_categories         TEXT[]      NOT NULL,
    purpose                 TEXT,
    requested_by            TEXT,
    overall_status          TEXT        DEFAULT 'received',
    system_statuses         JSONB       DEFAULT '{}',
    result                  JSONB,
    rbac_redactions         TEXT[]      DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS manual_review_queue (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID        NOT NULL REFERENCES orchestration_requests(request_id),
    system_name     TEXT        NOT NULL,
    error_trace     TEXT,
    retry_count     INT         DEFAULT 0,
    request_payload JSONB,
    status          TEXT        DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,
    notes           TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — 8 Departmental Registries & Cross-System Reconciled Identities
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO canonical_citizens (canonical_id, name, dob, gender, district, canonical_identifier) VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', 'Priya Sharma',   '1995-08-14', 'Female', 'Pune District',   'MAHA-2024-001'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'Rahul Deshmukh', '1992-03-25', 'Male',   'Nagpur District', 'MAHA-2024-002')
ON CONFLICT (canonical_identifier) DO NOTHING;

-- Federated Identifier Map across all 8 systems
INSERT INTO id_map (canonical_id, system_name, system_identifier) VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', 'aadhaar',    'XXXX-XXXX-8821'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'pan',        'ABCPS1234F'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'digilocker', 'DL-MH-99201'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'education',  'EDU-MH-2016-88'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'udid',       'MH-PUN-2023-0091'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'employment', 'EMP-7789'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'skill',      'SK-2031'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'revenue',    'LP-3301'),

    ('a1b2c3d4-0002-0002-0002-000000000002', 'aadhaar',    'XXXX-XXXX-4490'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'pan',        'XYZRD5678G'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'digilocker', 'DL-MH-11409'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'education',  'EDU-MH-2012-33'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'udid',       'MH-NAG-2021-0442'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'employment', 'EMP-4421'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'skill',      'SK-0897'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'revenue',    'LP-1102')
ON CONFLICT (system_name, system_identifier) DO NOTHING;

-- Seed Aadhaar Registry
INSERT INTO aadhaar_registry (aadhaar_number, citizen_canonical_id, enrolment_id, state, district, sub_district, vtc, ekyc_verified, verification_method, linked_mobile) VALUES
    ('XXXX-XXXX-8821', 'a1b2c3d4-0001-0001-0001-000000000001', '1029/30291/00192', 'Maharashtra', 'Pune', 'Haveli', 'Pune City', TRUE, 'Biometric / Fingerprint & Iris', 'XXXXXX9912'),
    ('XXXX-XXXX-4490', 'a1b2c3d4-0002-0002-0002-000000000002', '2048/11902/09121', 'Maharashtra', 'Nagpur', 'Nagpur Urban', 'Nagpur City', TRUE, 'OTP Authentication', 'XXXXXX4410')
ON CONFLICT (aadhaar_number) DO NOTHING;

-- Seed PAN Registry
INSERT INTO pan_registry (pan_number, citizen_canonical_id, name_on_card, taxpayer_category, aadhaar_seeding_status, tax_filing_status, income_tier) VALUES
    ('ABCPS1234F', 'a1b2c3d4-0001-0001-0001-000000000001', 'Priya Sharma', 'Individual', 'LINKED & VERIFIED', 'REGULAR COMPLIANT (AY 2025-26)', '₹4.5L - ₹7.5L per annum'),
    ('XYZRD5678G', 'a1b2c3d4-0002-0002-0002-000000000002', 'Rahul Deshmukh', 'Individual', 'LINKED & VERIFIED', 'NON-FILER / BELOW TAXABLE LIMIT', 'Below ₹2.5L per annum')
ON CONFLICT (pan_number) DO NOTHING;

-- Seed DigiLocker Registry
INSERT INTO digilocker_registry (account_id, citizen_canonical_id, linked_documents_count, issued_documents) VALUES
    ('DL-MH-99201', 'a1b2c3d4-0001-0001-0001-000000000001', 5, '[{"type": "Caste Certificate", "uri": "in.gov.maharashtra.edistrict:CAST:2020-00192", "status": "VERIFIED"}, {"type": "Domicile Certificate", "uri": "in.gov.maharashtra.edistrict:DOM:2018-7718", "status": "VERIFIED"}]'::jsonb),
    ('DL-MH-11409', 'a1b2c3d4-0002-0002-0002-000000000002', 3, '[{"type": "Domicile Certificate", "uri": "in.gov.maharashtra.edistrict:DOM:2015-1102", "status": "VERIFIED"}, {"type": "Disability Certificate", "uri": "in.gov.swavlamban:UDID:2021-0442", "status": "VERIFIED"}]'::jsonb)
ON CONFLICT (account_id) DO NOTHING;

-- Seed Education Registry
INSERT INTO education_registry (registration_no, citizen_canonical_id, highest_qualification, board_university, passing_year, cgpa, scholarship_availed) VALUES
    ('EDU-MH-2016-88', 'a1b2c3d4-0001-0001-0001-000000000001', 'Bachelor of Technology (Computer Engineering)', 'Savitribai Phule Pune University (SPPU)', 2017, '8.75 / 10', 'Post-Matric Scholarship for OBC Students'),
    ('EDU-MH-2012-33', 'a1b2c3d4-0002-0002-0002-000000000002', 'Higher Secondary Certificate (HSC Commerce)', 'Maharashtra State Board of Secondary & Higher Secondary Education', 2010, '64.5%', 'State Government Unemployment Allowance')
ON CONFLICT (registration_no) DO NOTHING;

-- Seed UDID Disability Registry
INSERT INTO udid_registry (udid_card_no, citizen_canonical_id, disability_type, disability_percentage, validity, issuing_authority, pension_eligibility) VALUES
    ('MH-PUN-2023-0091', 'a1b2c3d4-0001-0001-0001-000000000001', 'Locomotor Disability (Mild)', '25%', 'PERMANENT', 'District Medical Board Sassoon Hospital Pune', 'ELIGIBLE FOR ASSISTIVE EQUIPMENT SUBSIDY'),
    ('MH-NAG-2021-0442', 'a1b2c3d4-0002-0002-0002-000000000002', 'Hearing Impairment (Profound)', '65%', 'PERMANENT', 'District Medical Board IGMC Hospital Nagpur', 'FULL MONTHLY DISABILITY PENSION')
ON CONFLICT (udid_card_no) DO NOTHING;

-- Seed Employment Registry
INSERT INTO employment_registry (employment_id, citizen_canonical_id, status, employer_name, designation, nco_code, monthly_income, registration_date) VALUES
    ('EMP-7789', 'a1b2c3d4-0001-0001-0001-000000000001', 'EMPLOYED', 'Maha Tech Solutions Pvt Ltd', 'Software QA Engineer', '2512.0100', '₹55,000', '2019-03-12'),
    ('EMP-4421', 'a1b2c3d4-0002-0002-0002-000000000002', 'UNEMPLOYED / SEEKING JOB', 'NONE', 'N/A', '9312.0100', '₹0', '2022-01-15')
ON CONFLICT (employment_id) DO NOTHING;

-- Seed Skill Registry
INSERT INTO skill_registry (skill_id, citizen_canonical_id, training_center, course_name, certification_level, certification_date, grade) VALUES
    ('SK-2031', 'a1b2c3d4-0001-0001-0001-000000000001', 'Government ITI Aundh Pune', 'Advanced Industrial Automation & AutoCAD', 'NSQF Level 5', '2021-11-20', 'GRADE A (EXCELLENT)'),
    ('SK-0897', 'a1b2c3d4-0002-0002-0002-000000000002', 'Nagpur Vocational Skill Center', 'Solar Panel Technician & Electrical Maintenance', 'NSQF Level 4', '2023-06-10', 'GRADE B (PASS)')
ON CONFLICT (skill_id) DO NOTHING;

-- Seed Revenue Registry
INSERT INTO revenue_registry (revenue_id, citizen_canonical_id, land_parcel_id, survey_number, taluka, village, area_hectares, tax_status, outstanding_amount, khata_number) VALUES
    ('LP-3301', 'a1b2c3d4-0001-0001-0001-000000000001', 'PARCEL-MH-4410', '142/A/2', 'Haveli', 'Kothrud', '0.45 Ha', 'paid', 0.00, 'KHT-9012'),
    ('LP-1102', 'a1b2c3d4-0002-0002-0002-000000000002', 'PARCEL-MH-2287', '78/3', 'Nagpur Rural', 'Hingna', '1.20 Ha', 'overdue', 4850.00, 'KHT-3310')
ON CONFLICT (revenue_id) DO NOTHING;

-- Seed Consent Mandates
INSERT INTO consent (citizen_id, data_categories, granted_until, granted_by) VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', '{aadhaar,pan,digilocker,education,udid,employment,skills,revenue}', NOW() + INTERVAL '365 days', 'citizen-self'),
    ('a1b2c3d4-0002-0002-0002-000000000002', '{aadhaar,pan,digilocker,education,udid,employment,skills,revenue}', NOW() + INTERVAL '365 days', 'citizen-self');

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_id_map_canonical       ON id_map(canonical_id);
CREATE INDEX IF NOT EXISTS idx_id_map_system          ON id_map(system_name, system_identifier);
CREATE INDEX IF NOT EXISTS idx_consent_citizen        ON consent(citizen_id) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_request          ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_aadhaar_num            ON aadhaar_registry(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_pan_num                ON pan_registry(pan_number);
CREATE INDEX IF NOT EXISTS idx_udid_card              ON udid_registry(udid_card_no);
