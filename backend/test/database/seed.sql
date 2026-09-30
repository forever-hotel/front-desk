-- Test-only deterministic seed data.
-- Never use real guest/staff data here.

INSERT INTO room_types (
  room_type_id,
  type_name,
  price_per_night,
  max_guests,
  description
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'CI Standard Room',
  15000,
  2,
  'Deterministic room type used only for automated tests'
)
ON CONFLICT (room_type_id) DO NOTHING;


INSERT INTO rooms (
  room_number,
  room_type_id,
  floor,
  status,
  notes
)
VALUES
(
  'T101',
  '11111111-1111-4111-8111-111111111111',
  1,
  'VACANT',
  'CI test room'
),
(
  'T102',
  '11111111-1111-4111-8111-111111111111',
  1,
  'VACANT',
  'CI test room'
)
ON CONFLICT (room_number) DO NOTHING;


INSERT INTO guests (
  guest_id,
  full_name,
  email,
  password_hash,
  nic_or_passport,
  phone
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'CI Test Guest',
  'ci-test-guest@example.invalid',
  'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',
  'TEST-NIC-001',
  '+94000000000'
)
ON CONFLICT (guest_id) DO NOTHING;


INSERT INTO bookings (
  booking_id,
  guest_id,
  room_type_id,
  room_number,
  check_in_date,
  check_out_date,
  status,
  total_amount,
  source,
  special_requests,
  num_guests
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'T101',
  DATE '2030-01-10',
  DATE '2030-01-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'CI deterministic booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;