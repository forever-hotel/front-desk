import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("*/bookings/recent", () => {
    return HttpResponse.json({
      value: [],
      count: 0,
    });
  }),

  http.get("*/bookings/search", () => {
    return HttpResponse.json([]);
  }),

  http.get("*/rooms/status", () => {
    return HttpResponse.json([]);
  }),

  http.get("*/realtime/escalations", () => {
    return HttpResponse.json([]);
  }),
];
