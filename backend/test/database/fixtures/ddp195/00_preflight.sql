-- DDP-195 read-only preflight.
-- In Neon Console select branch fds-test and database forever before execution.
-- current_database() does NOT identify a Neon branch; confirm the UI branch selector.
SELECT current_database() AS db_name, current_user AS db_role,
       NOW() AS checked_at;

SELECT required.table_name,
       CASE WHEN to_regclass('public.' || required.table_name) IS NULL
            THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM (VALUES ('room_types'),('rooms'),('guests'),('staff_users'),
             ('bookings'),('payments'),('audit_logs')) required(table_name)
ORDER BY required.table_name;

SELECT 'room_types' AS table_name, COUNT(*) AS records FROM public.room_types
UNION ALL SELECT 'rooms', COUNT(*) FROM public.rooms
UNION ALL SELECT 'guests', COUNT(*) FROM public.guests
UNION ALL SELECT 'bookings', COUNT(*) FROM public.bookings
UNION ALL SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL SELECT 'staff_users', COUNT(*) FROM public.staff_users
ORDER BY table_name;

-- All of these should be 0 before first-time seed, or their expected sizes
-- when repeating a previously applied seed. A nonzero unexpected subset is a conflict.
SELECT 'DDP195 rooms' AS fixture_group, COUNT(*) AS existing_count
FROM public.rooms WHERE room_number IN ('R1951','R1952','R1953','R1954','R1955')
UNION ALL
SELECT 'DDP195 bookings', COUNT(*) FROM public.bookings
WHERE booking_id IN (
'dd019500-0000-4000-8000-000000000101','dd019500-0000-4000-8000-000000000102',
'dd019500-0000-4000-8000-000000000103','dd019500-0000-4000-8000-000000000104',
'dd019500-0000-4000-8000-000000000105','dd019500-0000-4000-8000-000000000106');
