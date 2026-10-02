import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomStatus } from './models/room-status';
import { RoomRepository } from './ports/room.repository';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  let service: RoomsService;
  let repository: jest.Mocked<RoomRepository>;

  beforeEach(async () => {
    const repositoryMock = {
      findAllStatuses: jest.fn(),
      transitionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: RoomRepository,
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get(RoomsService);
    repository = module.get(RoomRepository);
  });

  it('should return the room status board', async () => {
    const rooms = [
      {
        roomNumber: 'T101',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T08:00:00.000Z',
        updatedAt: '2032-01-10T08:00:00.000Z',
      },
      {
        roomNumber: 'T102',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeName: 'Standard',
        floor: 1,
        status: RoomStatus.OCCUPIED,
        lastClearedAt: '2032-01-09T08:00:00.000Z',
        updatedAt: '2032-01-10T10:00:00.000Z',
      },
    ];

    repository.findAllStatuses.mockResolvedValue(rooms);

    await expect(service.getStatusBoard()).resolves.toEqual(rooms);

    expect(repository.findAllStatuses).toHaveBeenCalledTimes(1);
  });

  it('should allow VACANT to UNDER_MAINTENANCE', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'updated',
      value: {
        roomNumber: 'T103',
        previousStatus: RoomStatus.VACANT,
        status: RoomStatus.UNDER_MAINTENANCE,
        lastClearedAt: '2032-01-10T08:00:00.000Z',
        updatedAt: '2032-01-10T11:00:00.000Z',
      },
    });

    const result = await service.updateStatus(' t103 ', {
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
    });

    expect(repository.transitionStatus).toHaveBeenCalledWith({
      roomNumber: 'T103',
      targetStatus: RoomStatus.UNDER_MAINTENANCE,
      allowedCurrentStatuses: [RoomStatus.VACANT],
    });

    expect(result).toEqual({
      roomNumber: 'T103',
      previousStatus: RoomStatus.VACANT,
      status: RoomStatus.UNDER_MAINTENANCE,
      lastClearedAt: '2032-01-10T08:00:00.000Z',
      updatedAt: '2032-01-10T11:00:00.000Z',
    });
  });

  it('should allow UNDER_MAINTENANCE to VACANT', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'updated',
      value: {
        roomNumber: 'T104',
        previousStatus: RoomStatus.UNDER_MAINTENANCE,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T12:00:00.000Z',
        updatedAt: '2032-01-10T12:00:00.000Z',
      },
    });

    await service.updateStatus('T104', {
      targetStatus: RoomStatus.VACANT,
    });

    expect(repository.transitionStatus).toHaveBeenCalledWith({
      roomNumber: 'T104',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
    });
  });

  it('should allow REQUIRES_CLEANING to VACANT', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'updated',
      value: {
        roomNumber: 'T105',
        previousStatus: RoomStatus.REQUIRES_CLEANING,
        status: RoomStatus.VACANT,
        lastClearedAt: '2032-01-10T13:00:00.000Z',
        updatedAt: '2032-01-10T13:00:00.000Z',
      },
    });

    await service.updateStatus('T105', {
      targetStatus: RoomStatus.VACANT,
    });

    expect(repository.transitionStatus).toHaveBeenCalledWith({
      roomNumber: 'T105',
      targetStatus: RoomStatus.VACANT,
      allowedCurrentStatuses: [
        RoomStatus.REQUIRES_CLEANING,
        RoomStatus.UNDER_MAINTENANCE,
      ],
    });
  });

  it('should not allow the generic endpoint to create OCCUPIED state', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'blocked',
      currentStatus: RoomStatus.VACANT,
    });

    await expect(
      service.updateStatus('T103', {
        targetStatus: RoomStatus.OCCUPIED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.transitionStatus).toHaveBeenCalledWith({
      roomNumber: 'T103',
      targetStatus: RoomStatus.OCCUPIED,
      allowedCurrentStatuses: [],
    });
  });

  it('should not allow the generic endpoint to create REQUIRES_CLEANING state', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'blocked',
      currentStatus: RoomStatus.OCCUPIED,
    });

    await expect(
      service.updateStatus('T103', {
        targetStatus: RoomStatus.REQUIRES_CLEANING,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.transitionStatus).toHaveBeenCalledWith({
      roomNumber: 'T103',
      targetStatus: RoomStatus.REQUIRES_CLEANING,
      allowedCurrentStatuses: [],
    });
  });

  it('should reject a same-state transition', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'same_state',
      currentStatus: RoomStatus.VACANT,
    });

    await expect(
      service.updateStatus('T101', {
        targetStatus: RoomStatus.VACANT,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should reject an unknown room', async () => {
    repository.transitionStatus.mockResolvedValue({
      kind: 'not_found',
    });

    await expect(
      service.updateStatus('T999', {
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should reject an empty room number before accessing the repository', async () => {
    await expect(
      service.updateStatus('   ', {
        targetStatus: RoomStatus.UNDER_MAINTENANCE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.transitionStatus).not.toHaveBeenCalled();
  });
});
