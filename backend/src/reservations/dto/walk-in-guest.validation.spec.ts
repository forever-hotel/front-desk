import { validateSync } from 'class-validator';
import { WalkInGuestDto } from './walk-in-guest.dto';
import {
  normalizeWalkInPhone,
  validatePassportNumber,
  validateSriLankanNic,
  validateWalkInName,
} from './walk-in-guest.validation';

function errors(guest: Partial<WalkInGuestDto>) {
  const dto = Object.assign(new WalkInGuestDto(), {
    fullName: 'Test Guest',
    email: 'guest@example.com',
    phone: '0771234567',
    ...guest,
  });
  return validateSync(dto);
}

describe('DDP-278 new walk-in guest validation', () => {
  it('requires a valid phone and rejects too many digits', () => {
    for (const phone of [
      undefined,
      '',
      '077123456789999',
      '+947626913309999',
      '077ABC4567',
    ]) {
      expect(errors({ phone }).some((err) => err.property === 'phone')).toBe(
        true,
      );
    }
  });

  it('accepts normalized Sri Lankan and international numbers', () => {
    expect(normalizeWalkInPhone('0771234567')).toBe('+94771234567');
    expect(normalizeWalkInPhone('+94 77 123 4567')).toBe('+94771234567');
    expect(normalizeWalkInPhone('+1 415 555 2671')).toBe('+14155552671');
    expect(errors({ phone: '+14155552671' })).toHaveLength(0);
  });

  it('handles local NIC formats and rejects corrupt NIC day codes', () => {
    expect(validateSriLankanNic('901234567V')).toBe(true);
    expect(validateSriLankanNic('200012345678')).toBe(true);
    expect(validateSriLankanNic('200040045678')).toBe(false);
    expect(
      errors({
        identityDocumentType: 'NIC',
        nicOrPassport: '200040045678',
      }).some((err) => err.property === 'nicOrPassport'),
    ).toBe(true);
  });

  it('accepts foreign passport formats without rejecting optional ID', () => {
    expect(validatePassportNumber('AB1234567')).toBe(true);
    expect(
      errors({ identityDocumentType: 'PASSPORT', nicOrPassport: 'AB1234567' }),
    ).toHaveLength(0);
    expect(errors({ nicOrPassport: undefined })).toHaveLength(0);
  });

  it('validates Unicode names and malformed email', () => {
    expect(validateWalkInName('නදීකා පෙරේරා')).toBe(true);
    expect(validateWalkInName('123456789')).toBe(false);
    expect(
      errors({ fullName: '123456789' }).some(
        (err) => err.property === 'fullName',
      ),
    ).toBe(true);
    expect(
      errors({ email: 'no-at-sign' }).some((err) => err.property === 'email'),
    ).toBe(true);
  });
});
