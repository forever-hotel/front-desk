import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoomChangeDto } from './create-room-change.dto';

describe('CreateRoomChangeDto', () => {
  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const performedBy = '66666666-6666-4666-8666-666666666666';

  it('should accept a valid room-change request', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy,
      reason: 'Guest requested a quieter room',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should normalize target room number and trim reason', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference,
      targetRoomNumber: ' t105 ',
      performedBy,
      reason: '  Guest requested a quieter room  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.targetRoomNumber).toBe('T105');
    expect(dto.reason).toBe('Guest requested a quieter room');
  });

  it('should allow reason to be omitted', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid booking UUID', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference: 'not-a-uuid',
      targetRoomNumber: 'T105',
      performedBy,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an invalid receptionist UUID', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference,
      targetRoomNumber: 'T105',
      performedBy: 'invalid-user',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an empty target room number', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference,
      targetRoomNumber: '   ',
      performedBy,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should safely handle non-string target room input', async () => {
    const dto = plainToInstance(CreateRoomChangeDto, {
      bookingReference,
      targetRoomNumber: 105,
      performedBy,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
