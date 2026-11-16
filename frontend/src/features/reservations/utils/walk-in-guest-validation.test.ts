import {
  normalizeWalkInPhone,
  validateWalkInDocument,
  validateWalkInEmail,
  validateWalkInName,
  validateWalkInPhone,
} from "./walk-in-guest-validation";

describe("DDP-278 walk-in guest validation", () => {
  it("requires a realistic local or international phone number", () => {
    expect(validateWalkInPhone("")).toBe("Guest phone number is required.");
    expect(validateWalkInPhone("0771234567")).toBeNull();
    expect(normalizeWalkInPhone("0771234567")).toBe("+94771234567");
    expect(validateWalkInPhone("+14155552671")).toBeNull();
    expect(normalizeWalkInPhone("+14155552671")).toBe("+14155552671");
    expect(validateWalkInPhone("077123456789999")).not.toBeNull();
    expect(validateWalkInPhone("077ABC4567")).not.toBeNull();
  });
  it("distinguishes NIC and passport formats", () => {
    expect(validateWalkInDocument("901234567V", "NIC")).toBeNull();
    expect(validateWalkInDocument("200012345678", "NIC")).toBeNull();
    expect(validateWalkInDocument("200040045678", "NIC")).not.toBeNull();
    expect(validateWalkInDocument("AB1234567", "PASSPORT")).toBeNull();
    expect(validateWalkInDocument("TEST123456", "NIC")).not.toBeNull();
    expect(validateWalkInDocument("", "NIC")).toBeNull();
  });
  it("requires a plausible name and email", () => {
    expect(validateWalkInName("සනූ පෙරේරා")).toBeNull();
    expect(validateWalkInName("123456")).not.toBeNull();
    expect(validateWalkInEmail("guest@example.com")).toBeNull();
    expect(validateWalkInEmail("guest@")).not.toBeNull();
  });
});
