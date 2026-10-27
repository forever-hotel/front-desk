-- DDP-195 optional CLEANUP only after testing is complete.
-- DANGEROUS: deletes only known DDP-195 fixture IDs; NEVER run in shared DB.
-- Do NOT run until you have confirmed selected branch fds-test.
-- If other operations have added references to these rows, RESTRICT will prevent cleanup.
-- This transaction does not touch original T101.. CI test fixtures or audit logs.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'forever' THEN
    RAISE EXCEPTION 'DDP-195 cleanup expected database forever';
  END IF;
  IF EXISTS (SELECT 1 FROM public.rooms WHERE room_number IN
    ('R1951','R1952','R1953','R1954','R1955') AND notes <> 'DDP-195 isolated testing fixture') THEN
    RAISE EXCEPTION 'Cleanup blocked: one or more room identities do not match fixture manifest';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE booking_id IN (
    'dd019500-0000-4000-8000-000000000101',
    'dd019500-0000-4000-8000-000000000102',
    'dd019500-0000-4000-8000-000000000103',
    'dd019500-0000-4000-8000-000000000104',
    'dd019500-0000-4000-8000-000000000105',
    'dd019500-0000-4000-8000-000000000106')
    AND special_requests NOT LIKE 'DDP-195 %') THEN
    RAISE EXCEPTION 'Cleanup blocked: booking identity mismatch';
  END IF;
END $$;

DELETE FROM public.payments WHERE payment_id IN (
 'dd019500-0000-4000-8000-000000000201',
 'dd019500-0000-4000-8000-000000000202',
 'dd019500-0000-4000-8000-000000000203');

DELETE FROM public.bookings WHERE booking_id IN (
 'dd019500-0000-4000-8000-000000000101',
 'dd019500-0000-4000-8000-000000000102',
 'dd019500-0000-4000-8000-000000000103',
 'dd019500-0000-4000-8000-000000000104',
 'dd019500-0000-4000-8000-000000000105',
 'dd019500-0000-4000-8000-000000000106')
 AND special_requests LIKE 'DDP-195 %';

DELETE FROM public.rooms WHERE room_number IN
 ('R1951','R1952','R1953','R1954','R1955')
 AND notes = 'DDP-195 isolated testing fixture';

DELETE FROM public.guests WHERE guest_id = 'dd019500-0000-4000-8000-000000000011'
 AND email = 'ddp195-guest@example.invalid';

DELETE FROM public.room_types
 WHERE room_type_id = 'dd019500-0000-4000-8000-000000000001'
 AND type_name = 'DDP195 Standard Room';
COMMIT;
