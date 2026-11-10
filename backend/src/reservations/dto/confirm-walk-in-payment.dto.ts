import {
  Equals,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ConfirmWalkInPaymentDto {
  // A client cannot mark a payment completed by selecting a method alone.
  @Equals(true, {
    message: 'Explicit payment-received confirmation is required',
  })
  confirmedReceived!: boolean;

  // For manual card-on-site confirmation, record the POS receipt reference in
  // the existing append-only audit log. A real processor integration is separate.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/, {
    message: 'receiptReference contains unsupported characters',
  })
  receiptReference?: string;
}
