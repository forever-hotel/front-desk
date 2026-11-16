import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type WalkInIdentityDocumentType = 'NIC' | 'PASSPORT';

export function validateWalkInName(value: string): boolean {
  const name = value.trim();
  return (
    name.length >= 2 &&
    name.length <= 255 &&
    /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u.test(name)
  );
}

export function validateSriLankanNic(value: string): boolean {
  const text = value.trim().toUpperCase();
  const old = /^(\d{2})(\d{3})\d{4}[VX]$/.exec(text);
  const modern = /^(\d{4})(\d{3})\d{5}$/.exec(text);
  if (!old && !modern) return false;
  const year = modern ? Number(modern[1]) : null;
  if (year !== null && (year < 1900 || year > new Date().getFullYear())) {
    return false;
  }
  const encodedDay = Number((modern ?? old)![2]);
  const day = encodedDay > 500 ? encodedDay - 500 : encodedDay;
  if (encodedDay > 366 && encodedDay < 501) return false;
  return day >= 1 && day <= 366;
}

export function validatePassportNumber(value: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(value.trim().toUpperCase());
}

export function validateWalkInDocument(
  value: string,
  type?: WalkInIdentityDocumentType,
): boolean {
  if (!value.trim()) return true;
  if (type === 'NIC') return validateSriLankanNic(value);
  if (type === 'PASSPORT') return validatePassportNumber(value);
  // Compatibility with existing clients that send nicOrPassport without a type.
  return validateSriLankanNic(value) || validatePassportNumber(value);
}

export function normalizeWalkInPhone(value: string): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length < 7 || text.length > 32 || !/^\+?[0-9() \-]+$/.test(text)) {
    return null;
  }
  const parsed = parsePhoneNumberFromString(text, {
    defaultCountry: 'LK',
    extract: false,
  });
  if (!parsed?.isValid() || parsed.ext) return null;
  const digits = parsed.number.replace(/\D/g, '');
  if (digits.length > 15) return null;
  return parsed.number;
}
