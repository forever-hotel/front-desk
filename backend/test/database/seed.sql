-- Test-only deterministic seed data.
-- Never use real guest/staff data here.

INSERT INTO room_types (
  room_type_id,
  type_name,
  price_per_night,
  max_guests,
  description
)
VALUES
(
  '11111111-1111-4111-8111-111111111111',
  'CI Standard Room',
  15000,
  2,
  'Deterministic room type used only for automated tests'
),
(
  '99999999-9999-4999-8999-999999999999',
  'CI Suite Room',
  25000,
  4,
  'Second deterministic room type for check-in validation tests'
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
),
(
  'T103',
  '11111111-1111-4111-8111-111111111111',
  1,
  'VACANT',
  'Plan 07 unassigned booking room'
),
(
  'T104',
  '11111111-1111-4111-8111-111111111111',
  1,
  'OCCUPIED',
  'Plan 07 occupied-room validation fixture'
),
(
  'T105',
  '11111111-1111-4111-8111-111111111111',
  1,
  'VACANT',
  'Plan 07 pre-assigned booking room'
),
(
  'T106',
  '11111111-1111-4111-8111-111111111111',
  1,
  'VACANT',
  'Plan 07 conflicting-booking room'
),
(
  'T107',
  '11111111-1111-4111-8111-111111111111',
  1,
  'VACANT',
  'Plan 07 rollback-test room'
),
(
  'S201',
  '99999999-9999-4999-8999-999999999999',
  2,
  'VACANT',
  'Plan 07 room-type mismatch fixture'
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


INSERT INTO staff_users (
  worker_id,
  full_name,
  vocation,
  email,
  phone,
  age,
  nic,
  username,
  password_hash,
  role,
  is_active
)
VALUES
(
  '66666666-6666-4666-8666-666666666666',
  'CI Receptionist',
  'Front Desk',
  'ci-receptionist@example.invalid',
  '+94000000100',
  25,
  'CI-STAFF-NIC-001',
  'ci_receptionist',
  'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',
  'RECEPTIONIST',
  TRUE
),
(
  '67676767-6767-4676-8676-676767676767',
  'CI Worker',
  'Housekeeping',
  'ci-worker@example.invalid',
  '+94000000101',
  26,
  'CI-STAFF-NIC-002',
  'ci_worker',
  'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',
  'WORKER',
  TRUE
),
(
  '68686868-6868-4686-8686-686868686868',
  'Inactive Receptionist',
  'Front Desk',
  'inactive-receptionist@example.invalid',
  '+94000000102',
  27,
  'CI-STAFF-NIC-003',
  'inactive_receptionist',
  'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH',
  'RECEPTIONIST',
  FALSE
)
ON CONFLICT (worker_id) DO NOTHING;


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
VALUES
(
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
VALUES
(
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'T102',
  DATE '2030-01-08',
  DATE '2030-01-12',
  'CHECKED_IN',
  60000,
  'WEBSITE',
  'CI deterministic checked-in booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: confirmed booking with no room assignment.
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
  '55555555-5555-4555-8555-555555555551',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  NULL,
  DATE '2032-01-10',
  DATE '2032-01-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 physical verification booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: confirmed booking with a room pre-assigned.
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
  '55555555-5555-4555-8555-555555555552',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'T105',
  DATE '2032-02-10',
  DATE '2032-02-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 scanned verification booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: invalid booking state fixture.
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
  '55555555-5555-4555-8555-555555555553',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  NULL,
  DATE '2032-03-10',
  DATE '2032-03-12',
  'PENDING',
  30000,
  'WEBSITE',
  'Plan 07 invalid state booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: occupied-room rejection fixture.
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
  '55555555-5555-4555-8555-555555555554',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  NULL,
  DATE '2032-05-10',
  DATE '2032-05-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 occupied-room test booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: room-type mismatch fixture.
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
  '55555555-5555-4555-8555-555555555555',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  NULL,
  DATE '2032-06-10',
  DATE '2032-06-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 room-type mismatch booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: booking that will attempt to use T106.
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
  '55555555-5555-4555-8555-555555555556',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  NULL,
  DATE '2032-04-10',
  DATE '2032-04-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 room-conflict target booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Existing active booking that conflicts with T106.
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
  '55555555-5555-4555-8555-555555555557',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'T106',
  DATE '2032-04-11',
  DATE '2032-04-13',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 conflicting active booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;


-- Plan 07: used to prove transaction rollback.
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
  '55555555-5555-4555-8555-555555555558',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  NULL,
  DATE '2032-07-10',
  DATE '2032-07-12',
  'CONFIRMED',
  30000,
  'WEBSITE',
  'Plan 07 rollback booking',
  1
)
ON CONFLICT (booking_id) DO NOTHING;