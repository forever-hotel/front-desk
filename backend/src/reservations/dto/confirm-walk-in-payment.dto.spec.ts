import { validateSync } from 'class-validator';
import { ConfirmWalkInPaymentDto } from './confirm-walk-in-payment.dto';

describe('ConfirmWalkInPaymentDto', () => {
  it('rejects payment confirmation without explicit staff acknowledgement', () => {
    const dto = new ConfirmWalkInPaymentDto();
    expect(validateSync(dto).length).toBeGreaterThan(0);
    dto.confirmedReceived = false;
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('accepts explicit confirmation and a safe POS reference', () => {
    const dto = new ConfirmWalkInPaymentDto();
    dto.confirmedReceived = true;
    dto.receiptReference = 'POS-123456';
    expect(validateSync(dto)).toEqual([]);
  });

  it('rejects a malformed receipt reference', () => {
    const dto = new ConfirmWalkInPaymentDto();
    dto.confirmedReceived = true;
    dto.receiptReference = '<script>';
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
