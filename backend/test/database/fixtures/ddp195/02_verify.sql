-- DDP-195 read-only post-seed verification.
SELECT 'room_types' AS fixture_table, COUNT(*) AS fixture_count
FROM public.room_types WHERE room_type_id = 'dd019500-0000-4000-8000-000000000001'
UNION ALL
SELECT 'rooms', COUNT(*) FROM public.rooms WHERE room_number IN
 ('R1951','R1952','R1953','R1954','R1955')
UNION ALL
SELECT 'guests', COUNT(*) FROM public.guests WHERE guest_id =
 'dd019500-0000-4000-8000-000000000011'
UNION ALL
SELECT 'bookings', COUNT(*) FROM public.bookings
 WHERE special_requests LIKE 'DDP-195 %'
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
 WHERE payment_id IN (
 'dd019500-0000-4000-8000-000000000201',
 'dd019500-0000-4000-8000-000000000202',
 'dd019500-0000-4000-8000-000000000203');

SELECT status::text AS booking_status, COUNT(*) AS count
FROM public.bookings
WHERE special_requests LIKE 'DDP-195 %'
GROUP BY status ORDER BY booking_status;

SELECT room_number, status::text AS room_status
FROM public.rooms
WHERE room_number IN ('R1951','R1952','R1953','R1954','R1955')
ORDER BY room_number;

SELECT 'arrivals_2026_10_27' AS scenario, COUNT(*) AS total
 FROM public.bookings WHERE check_in_date = DATE '2026-10-27'
   AND status = 'CONFIRMED'
UNION ALL
SELECT 'departures_2026_10_27', COUNT(*)
 FROM public.bookings WHERE check_out_date = DATE '2026-10-27'
   AND status = 'CHECKED_IN';
