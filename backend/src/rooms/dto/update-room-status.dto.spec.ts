import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RoomStatus } from '../models/room-status';
import { UpdateRoomStatusDto } from './update-room-status.dto';

describe('UpdateRoomStatusDto', () => {
  const performedBy = '66666666-6666-4666-8666-666666666666';

  it.each([
    RoomStatus.VACANT,
    RoomStatus.OCCUPIED,
    RoomStatus.REQUIRES_CLEANING,
    RoomStatus.UNDER_MAINTENANCE,
  ])('should accept supported room status %s', async (status) => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: status,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.targetStatus).toBe(status);
  });

  it('should trim and normalize a lowercase room status', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: ' under_maintenance ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.targetStatus).toBe(RoomStatus.UNDER_MAINTENANCE);
  });

  it('should accept receptionist and maintenance notes', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      performedBy,
      notes: '  Air-conditioner repair  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.performedBy).toBe(performedBy);
    expect(dto.notes).toBe('Air-conditioner repair');
  });

  it('should reject an invalid performedBy UUID', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      performedBy: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an unsupported room status', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: 'CLEAN',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an empty room status', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: '',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should safely handle non-string status input', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: 123,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);

    expect(dto.targetStatus).toBe(123);
  });

  it('should safely handle non-string notes input', async () => {
    const dto = plainToInstance(UpdateRoomStatusDto, {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      notes: 123,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
