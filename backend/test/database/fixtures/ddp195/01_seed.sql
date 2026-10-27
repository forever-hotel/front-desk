-- DDP-195 additive, deterministic October 2026 fixtures.
-- RUN ONLY in the selected Neon fds-test branch (database forever).
-- Requires preflight review and isolated branch; does not modify original CI fixtures.
-- Transactional; NO UPDATE/DELETE/TRUNCATE; rerunning does not reset mutated fixtures.
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'forever' THEN
    RAISE EXCEPTION 'DDP-195 seed expected database forever; got %', current_database();
  END IF;
  IF to_regclass('public.bookings') IS NULL OR to_regclass('public.rooms') IS NULL THEN
    RAISE EXCEPTION 'DDP-195 required FDS tables are absent';
  END IF;
  -- Collision check: refuse to reuse fixture IDs for unrelated records.
  IF EXISTS (SELECT 1 FROM public.rooms WHERE room_number IN
    ('R1951','R1952','R1953','R1954','R1955') AND notes <> 'DDP-195 isolated testing fixture') THEN
    RAISE EXCEPTION 'DDP-195 room identifier collision; stop, do not overwrite';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE booking_id IN (
    'dd019500-0000-4000-8000-000000000101',
    'dd019500-0000-4000-8000-000000000102',
    'dd019500-0000-4000-8000-000000000103',
    'dd019500-0000-4000-8000-000000000104',
    'dd019500-0000-4000-8000-000000000105',
    'dd019500-0000-4000-8000-000000000106')
    AND special_requests NOT LIKE 'DDP-195 %') THEN
    RAISE EXCEPTION 'DDP-195 booking identifier collision; stop, do not overwrite';
  END IF;
END $$;

INSERT INTO public.room_types
  (room_type_id, type_name, price_per_night, max_guests, description)
VALUES ('dd019500-0000-4000-8000-000000000001',
        'DDP195 Standard Room', 15000, 2, 'Synthetic test-only room type')
ON CONFLICT (room_type_id) DO NOTHING;

INSERT INTO public.rooms (room_number, room_type_id, floor, status, notes)
VALUES
  ('R1951','dd019500-0000-4000-8000-000000000001',1,'VACANT','DDP-195 isolated testing fixture'),
  ('R1952','dd019500-0000-4000-8000-000000000001',1,'OCCUPIED','DDP-195 isolated testing fixture'),
  ('R1953','dd019500-0000-4000-8000-000000000001',1,'REQUIRES_CLEANING','DDP-195 isolated testing fixture'),
  ('R1954','dd019500-0000-4000-8000-000000000001',1,'UNDER_MAINTENANCE','DDP-195 isolated testing fixture'),
  ('R1955','dd019500-0000-4000-8000-000000000001',1,'VACANT','DDP-195 isolated testing fixture')
ON CONFLICT (room_number) DO NOTHING;

INSERT INTO public.guests
  (guest_id, full_name, email, password_hash, nic_or_passport, phone)
VALUES ('dd019500-0000-4000-8000-000000000011',
        'DDP195 Test Guest', 'ddp195-guest@example.invalid',
        'TEST_ONLY_NOT_A_REAL_PASSWORD_HASH', 'TEST-DDP195', '+94000000195')
ON CONFLICT (guest_id) DO NOTHING;

INSERT INTO public.bookings
  (booking_id, guest_id, room_type_id, room_number,
   check_in_date, check_out_date, status, total_amount, source,
   special_requests, num_guests)
VALUES
  ('dd019500-0000-4000-8000-000000000101',
    'dd019500-0000-4000-8000-000000000011',
    'dd019500-0000-4000-8000-000000000001','R1951',
    DATE '2026-10-27',DATE '2026-10-29','CONFIRMED',30000,'WEBSITE',
    'DDP-195 confirmed arrival 2026-10-27',1),
  ('dd019500-0000-4000-8000-000000000102',
    'dd019500-0000-4000-8000-000000000011',
    'dd019500-0000-4000-8000-000000000001','R1952',
    DATE '2026-10-25',DATE '2026-10-27','CHECKED_IN',30000,'WEBSITE',
    'DDP-195 checked-in departure 2026-10-27',1),
  ('dd019500-0000-4000-8000-000000000103',
    'dd019500-0000-4000-8000-000000000011',
    'dd019500-0000-4000-8000-000000000001','R1953',
    DATE '2026-10-23',DATE '2026-10-25','CHECKED_OUT',30000,'WEBSITE',
    'DDP-195 completed checkout history',1),
  ('dd019500-0000-4000-8000-000000000104',
    'dd019500-0000-4000-8000-000000000011',
    'dd019500-0000-4000-8000-000000000001',NULL,
    DATE '2026-10-27',DATE '2026-10-28','CANCELLED',15000,'WEBSITE',
    'DDP-195 cancelled booking history',1),
  ('dd019500-0000-4000-8000-000000000105',
    'dd019500-0000-4000-8000-000000000011',
    'dd019500-0000-4000-8000-000000000001',NULL,
    DATE '2026-10-28',DATE '2026-10-30','PENDING',30000,'WEBSITE',
    'DDP-195 pending future booking',1),
  ('dd019500-0000-4000-8000-000000000106',
    'dd019500-0000-4000-8000-000000000011',
    'dd019500-0000-4000-8000-000000000001','R1955',
    DATE '2026-10-28',DATE '2026-10-30','CONFIRMED',30000,'WEBSITE',
    'DDP-195 upcoming confirmed booking',1)
ON CONFLICT (booking_id) DO NOTHING;

INSERT INTO public.payments
  (payment_id, booking_id, payment_method, amount, payment_status, paid_at)
VALUES
  ('dd019500-0000-4000-8000-000000000201',
   'dd019500-0000-4000-8000-000000000101','CASH',15000,'PENDING',NULL),
  ('dd019500-0000-4000-8000-000000000202',
   'dd019500-0000-4000-8000-000000000102','CARD_ON_SITE',15000,'COMPLETED',
   TIMESTAMPTZ '2026-10-25 10:00:00+00'),
  ('dd019500-0000-4000-8000-000000000203',
   'dd019500-0000-4000-8000-000000000103','CASH',30000,'COMPLETED',
   TIMESTAMPTZ '2026-10-25 10:00:00+00')
ON CONFLICT (payment_id) DO NOTHING;

-- Assert exact row counts (idempotent and collision-aware).
DO $$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n FROM public.rooms
    WHERE room_number IN ('R1951','R1952','R1953','R1954','R1955')
      AND notes = 'DDP-195 isolated testing fixture';
  IF n <> 5 THEN RAISE EXCEPTION 'Expected five DDP-195 rooms; found %', n; END IF;
  SELECT COUNT(*) INTO n FROM public.bookings
    WHERE special_requests LIKE 'DDP-195 %'
      AND booking_id IN (
        'dd019500-0000-4000-8000-000000000101',
        'dd019500-0000-4000-8000-000000000102',
        'dd019500-0000-4000-8000-000000000103',
        'dd019500-0000-4000-8000-000000000104',
        'dd019500-0000-4000-8000-000000000105',
        'dd019500-0000-4000-8000-000000000106');
  IF n <> 6 THEN RAISE EXCEPTION 'Expected six DDP-195 bookings; found %', n; END IF;
END $$;
COMMIT;
