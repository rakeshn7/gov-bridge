-- mock-revenue-system/seed.sql
-- Revenue registry seed data (also included in infra/postgres/init.sql)
-- This file is provided for standalone reference and direct psql seeding.

INSERT INTO revenue_registry
    (revenue_id, citizen_canonical_id, land_parcel_id, tax_status, outstanding_amount, last_assessment_date, address)
VALUES
    ('LP-3301', 'a1b2c3d4-0001-0001-0001-000000000001', 'PARCEL-MH-4410', 'paid',    0.00,    '2024-01-15', 'Flat 3B, Shivaji Nagar, Pune 411005'),
    ('LP-1102', 'a1b2c3d4-0002-0002-0002-000000000002', 'PARCEL-MH-2287', 'overdue', 4850.00, '2023-10-01', '12, Gandhi Road, Nashik 422001')
ON CONFLICT (revenue_id) DO NOTHING;
