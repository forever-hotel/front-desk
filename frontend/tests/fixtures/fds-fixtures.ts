import type { BookingSearchItem } from "@/features/reservations";
import type { RoomStatusBoardItem } from "@/features/rooms";
import type { TaskEscalatedEvent } from "@/lib/realtime/realtime.type";

export const bookingFixtures: BookingSearchItem[] = [
  {
    bookingId: "booking-1",
    bookingReference: "11111111-1111-4111-8111-111111111111",
    guestName: "Kasun Perera",
    email: "kasun@example.com",
    phone: "0771234567",
    roomType: "Deluxe",
    checkInDate: "2026-10-07",
    checkOutDate: "2026-10-09",
    status: "CONFIRMED",
  },
  {
    bookingId: "booking-2",
    bookingReference: "22222222-2222-4222-8222-222222222222",
    guestName: "Nimali Silva",
    email: "nimali@example.com",
    phone: "0711111111",
    roomType: "Standard",
    checkInDate: "2026-10-06",
    checkOutDate: "2026-10-08",
    status: "CHECKED_IN",
  },
  {
    bookingId: "booking-3",
    bookingReference: "33333333-3333-4333-8333-333333333333",
    guestName: null,
    email: null,
    phone: null,
    roomType: "Suite",
    checkInDate: "2026-10-01",
    checkOutDate: "2026-10-03",
    status: "CHECKED_OUT",
  },
];

export const roomFixtures: RoomStatusBoardItem[] = [
  {
    roomNumber: "101",
    roomTypeId: "room-type-1",
    roomTypeName: "Standard",
    floor: 1,
    status: "VACANT",
    lastClearedAt: "2026-10-07T04:00:00.000Z",
    updatedAt: "2026-10-07T04:00:00.000Z",
  },
  {
    roomNumber: "102",
    roomTypeId: "room-type-2",
    roomTypeName: "Deluxe",
    floor: 1,
    status: "OCCUPIED",
    lastClearedAt: "2026-10-06T03:00:00.000Z",
    updatedAt: "2026-10-07T05:00:00.000Z",
  },
  {
    roomNumber: "201",
    roomTypeId: "room-type-1",
    roomTypeName: "Standard",
    floor: 2,
    status: "REQUIRES_CLEANING",
    lastClearedAt: null,
    updatedAt: "2026-10-07T06:00:00.000Z",
  },
  {
    roomNumber: "202",
    roomTypeId: "room-type-3",
    roomTypeName: "Suite",
    floor: 2,
    status: "UNDER_MAINTENANCE",
    lastClearedAt: null,
    updatedAt: "2026-10-07T07:00:00.000Z",
  },
];

export const escalationFixtures: TaskEscalatedEvent[] = [
  {
    eventId: "event-1",
    eventType: "task.escalated",
    eventVersion: 1,
    occurredAt: "2026-10-07T08:00:00.000Z",
    source: "worker-management",
    data: {
      taskId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      taskCategory: "ROOM_CLEANING",
      roomNumber: "201",
      priority: "HIGH",
      escalatedAt: "2026-10-07T08:00:00.000Z",
    },
  },
  {
    eventId: "event-2",
    eventType: "task.escalated",
    eventVersion: 1,
    occurredAt: "2026-10-07T08:05:00.000Z",
    source: "worker-management",
    data: {
      taskId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      taskCategory: "EXTRA_TOWELS",
      roomNumber: "102",
      priority: "NORMAL",
      escalatedAt: "2026-10-07T08:05:00.000Z",
    },
  },
];
