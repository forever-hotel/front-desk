import { apiClient } from "./api-client";
describe("Cookie-based FDS API client", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the same-origin BFF and ignores the retired development JWT store", async () => {
    sessionStorage.setItem("fds:dev-test-jwt", "retired-token");
    const fetcher = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);
    await apiClient("/rooms/status");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/backend/rooms/status",
      expect.objectContaining({ credentials: "include" }),
    );
    const headers = fetcher.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
    sessionStorage.removeItem("fds:dev-test-jwt");
  });
});
