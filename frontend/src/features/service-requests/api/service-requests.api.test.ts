import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";

import { createServiceRequest } from "./service-requests.api";

import type {
    CreateServiceRequest,
    ServiceRequestResult,
} from "../types/service-request.type";

const bookingReference = "11111111-1111-4111-8111-111111111111";
const receptionistId = "22222222-2222-4222-8222-222222222222";

const payload: CreateServiceRequest = {
    bookingReference,
    category: "EXTRA_TOWELS",
    description: "Guest requested two extra towels.",
    performedBy: receptionistId,
};

const successResponse: ServiceRequestResult = {
    status: "created",
    bookingReference,
    roomNumber: "102",
    task: {
        taskId: "33333333-3333-4333-8333-333333333333",
        roomNumber: "102",
        category: "EXTRA_TOWELS",
        status: "UNASSIGNED",
        priority: "NORMAL",
        createdAt: "2026-10-11T10:00:00.000Z",
    },
};

describe("service-requests.api", () => {
    it("creates a service request with the correct payload", async () => {
        let receivedBody: unknown = null;

        server.use(
            http.post("*/service-requests", async ({ request }) => {
                receivedBody = await request.json();

                return HttpResponse.json(successResponse, { status: 201 });
            }),
        );

        const result = await createServiceRequest(payload);

        expect(receivedBody).toEqual(payload);
        expect(result).toEqual(successResponse);
        expect(result.task.taskId).toBe(successResponse.task.taskId);
    });

    it("rejects requests for a booking that is not checked in", async () => {
        server.use(
            http.post("*/service-requests", () =>
                HttpResponse.json(
                    { message: "Booking must be checked in" },
                    { status: 409 },
                ),
            ),
        );

        await expect(createServiceRequest(payload)).rejects.toMatchObject({
            status: 409,
            message: "Booking must be checked in",
        });
    });

    it("reports WKMS unavailability without claiming success", async () => {
        server.use(
            http.post("*/service-requests", () =>
                HttpResponse.json(
                    { message: "WKMS is currently unavailable" },
                    { status: 503 },
                ),
            ),
        );

        await expect(createServiceRequest(payload)).rejects.toMatchObject({
            status: 503,
            message: "WKMS is currently unavailable",
        });
    });

    it("does not treat unauthorized receptionist requests as successful", async () => {
        server.use(
            http.post("*/service-requests", () =>
                HttpResponse.json(
                    { message: "Forbidden" },
                    { status: 403 },
                ),
            ),
        );

        await expect(createServiceRequest(payload)).rejects.toMatchObject({
            status: 403,
            message: "Forbidden",
        });
    });
});
