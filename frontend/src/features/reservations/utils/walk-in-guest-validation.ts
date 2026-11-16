import { parsePhoneNumberFromString } from "libphonenumber-js";

export type WalkInDocumentType = "NIC" | "PASSPORT";

export function validateWalkInName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Guest full name is required.";
  if (
    name.length < 2 ||
    name.length > 255 ||
    !/^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u.test(name)
  ) {
    return "Enter a valid guest name (2–255 characters; letters and name punctuation only).";
  }
  return null;
}

export function validateWalkInEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Guest email is required.";
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function normalizeWalkInPhone(value: string): string | null {
  const input = value.trim();
  if (
    input.length < 7 ||
    input.length > 32 ||
    !/^\+?[0-9() \-]+$/.test(input)
  ) {
    return null;
  }
  const phone = parsePhoneNumberFromString(input, {
    defaultCountry: "LK",
    extract: false,
  });
  if (
    !phone?.isValid() ||
    phone.ext ||
    phone.number.replace(/\D/g, "").length > 15
  ) {
    return null;
  }
  return phone.number;
}

export function validateWalkInPhone(value: string): string | null {
  if (!value.trim()) return "Guest phone number is required.";
  if (!normalizeWalkInPhone(value)) {
    return "Enter a valid Sri Lankan or international phone number.";
  }
  return null;
}

export function validateWalkInDocument(
  value: string,
  type: WalkInDocumentType,
): string | null {
  const id = value.trim().toUpperCase();
  if (!id) return null; // Verified later in the existing check-in workflow.
  if (type === "PASSPORT") {
    return /^[A-Z0-9]{5,20}$/.test(id)
      ? null
      : "Passport number must contain 5–20 letters or digits.";
  }
  const old = /^(\d{2})(\d{3})\d{4}[VX]$/.exec(id);
  const modern = /^(\d{4})(\d{3})\d{5}$/.exec(id);
  if (!old && !modern) {
    return "Sri Lankan NIC must contain 12 digits, or 9 digits followed by V/X.";
  }
  const year = modern ? Number(modern[1]) : null;
  const encodedDay = Number((modern ?? old)![2]);
  const day = encodedDay > 500 ? encodedDay - 500 : encodedDay;
  if (
    (year !== null && (year < 1900 || year > new Date().getFullYear())) ||
    (encodedDay > 366 && encodedDay < 501) ||
    day < 1 ||
    day > 366
  ) {
    return "Sri Lankan NIC contains an invalid year or birth-day code.";
  }
  return null;
}
