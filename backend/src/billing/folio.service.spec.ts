import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExternalFolioCharge } from './models/external-folio-charge';
import { FolioBookingContext } from './models/folio-booking-context';
import { FolioCategory } from './models/folio-category';
import { ExternalFolioChargeGateway } from './ports/external-folio-charge.gateway';
import { FolioRepository } from './ports/folio.repository';
import { FolioService } from './folio.service';

describe('FolioService', () => {
  let service: FolioService;
  let repository: jest.Mocked<FolioRepository>;
  let externalChargeGateway: jest.Mocked<ExternalFolioChargeGateway>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const bookingContext: FolioBookingContext = {
    bookingReference,
    roomNumber: 'T102',
    checkInDate: '2032-01-10',
    checkOutDate: '2032-01-12',
    bookingStatus: 'CHECKED_IN',
    roomCharge: 60000,
  };

  beforeEach(async () => {
    const repositoryMock = {
      findBookingContext: jest.fn(),
    };

    const externalChargeGatewayMock = {
      findCharges: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FolioService,
        {
          provide: FolioRepository,
          useValue: repositoryMock,
        },
        {
          provide: ExternalFolioChargeGateway,
          useValue: externalChargeGatewayMock,
        },
      ],
    }).compile();

    service = module.get(FolioService);
    repository = module.get(FolioRepository);
    externalChargeGateway = module.get(ExternalFolioChargeGateway);

    repository.findBookingContext.mockResolvedValue(bookingContext);

    externalChargeGateway.findCharges.mockResolvedValue([]);
  });

  it('should return a valid room-only running folio', async () => {
    const result = await service.getRunningFolio(bookingReference);

    expect(repository.findBookingContext).toHaveBeenCalledWith(
      bookingReference,
    );

    expect(externalChargeGateway.findCharges).toHaveBeenCalledWith(
      bookingReference,
    );

    expect(result).toEqual({
      bookingReference,
      roomNumber: 'T102',
      checkInDate: '2032-01-10',
      checkOutDate: '2032-01-12',
      bookingStatus: 'CHECKED_IN',
      currency: 'LKR',
      categories: [
        {
          category: FolioCategory.ROOM_CHARGES,
          items: [
            {
              reference: `ROOM-${bookingReference}`,
              description: 'Room accommodation',
              amount: 60000,
              occurredAt: '2032-01-10T00:00:00.000Z',
            },
          ],
          subtotal: 60000,
        },
        {
          category: FolioCategory.FOOD_AND_BEVERAGE,
          items: [],
          subtotal: 0,
        },
        {
          category: FolioCategory.SERVICES,
          items: [],
          subtotal: 0,
        },
      ],
      total: 60000,
    });
  });

  it('should include food and service charges and calculate all totals', async () => {
    const externalCharges: ExternalFolioCharge[] = [
      {
        reference: 'FOOD-001',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Dinner order',
        amount: 4500,
        occurredAt: '2032-01-10T18:30:00.000Z',
      },
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: 'Additional service',
        amount: 1500,
        occurredAt: '2032-01-11T10:00:00.000Z',
      },
      {
        reference: 'FOOD-002',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Breakfast order',
        amount: 2500,
        occurredAt: '2032-01-11T08:00:00.000Z',
      },
    ];

    externalChargeGateway.findCharges.mockResolvedValue(externalCharges);

    const result = await service.getRunningFolio(bookingReference);

    expect(result.categories).toHaveLength(3);

    expect(result.categories[0]).toEqual({
      category: FolioCategory.ROOM_CHARGES,
      items: [
        {
          reference: `ROOM-${bookingReference}`,
          description: 'Room accommodation',
          amount: 60000,
          occurredAt: '2032-01-10T00:00:00.000Z',
        },
      ],
      subtotal: 60000,
    });

    expect(result.categories[1]).toEqual({
      category: FolioCategory.FOOD_AND_BEVERAGE,
      items: [
        {
          reference: 'FOOD-001',
          description: 'Dinner order',
          amount: 4500,
          occurredAt: '2032-01-10T18:30:00.000Z',
        },
        {
          reference: 'FOOD-002',
          description: 'Breakfast order',
          amount: 2500,
          occurredAt: '2032-01-11T08:00:00.000Z',
        },
      ],
      subtotal: 7000,
    });

    expect(result.categories[2]).toEqual({
      category: FolioCategory.SERVICES,
      items: [
        {
          reference: 'SERVICE-001',
          description: 'Additional service',
          amount: 1500,
          occurredAt: '2032-01-11T10:00:00.000Z',
        },
      ],
      subtotal: 1500,
    });

    expect(result.total).toBe(68500);
    expect(result.currency).toBe('LKR');
  });

  it('should preserve deterministic category ordering', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: 'Service',
        amount: 1000,
        occurredAt: '2032-01-11T10:00:00.000Z',
      },
      {
        reference: 'FOOD-001',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Food',
        amount: 2000,
        occurredAt: '2032-01-10T18:00:00.000Z',
      },
    ]);

    const result = await service.getRunningFolio(bookingReference);

    expect(result.categories.map((category) => category.category)).toEqual([
      FolioCategory.ROOM_CHARGES,
      FolioCategory.FOOD_AND_BEVERAGE,
      FolioCategory.SERVICES,
    ]);
  });

  it('should sort external items by occurredAt and then reference', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'FOOD-C',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Third',
        amount: 1000,
        occurredAt: '2032-01-11T09:00:00.000Z',
      },
      {
        reference: 'FOOD-B',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Second',
        amount: 1000,
        occurredAt: '2032-01-10T09:00:00.000Z',
      },
      {
        reference: 'FOOD-A',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'First',
        amount: 1000,
        occurredAt: '2032-01-10T09:00:00.000Z',
      },
    ]);

    const result = await service.getRunningFolio(bookingReference);

    expect(result.categories[1].items.map((item) => item.reference)).toEqual([
      'FOOD-A',
      'FOOD-B',
      'FOOD-C',
    ]);
  });

  it('should normalize external text and timestamp values', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: ' FOOD-001 ',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: ' Dinner order ',
        amount: 2500,
        occurredAt: '2032-01-10T18:30:00+00:00',
      },
    ]);

    const result = await service.getRunningFolio(bookingReference);

    expect(result.categories[1].items).toEqual([
      {
        reference: 'FOOD-001',
        description: 'Dinner order',
        amount: 2500,
        occurredAt: '2032-01-10T18:30:00.000Z',
      },
    ]);
  });

  it('should support zero-value external charges', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-COMPLIMENTARY',
        category: FolioCategory.SERVICES,
        description: 'Complimentary service',
        amount: 0,
        occurredAt: '2032-01-10T15:00:00.000Z',
      },
    ]);

    const result = await service.getRunningFolio(bookingReference);

    expect(result.categories[2].subtotal).toBe(0);

    expect(result.total).toBe(60000);
  });

  it('should reject an unknown booking', async () => {
    repository.findBookingContext.mockResolvedValue(null);

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(externalChargeGateway.findCharges).not.toHaveBeenCalled();
  });

  it('should reject a booking that is not checked in', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      bookingStatus: 'CONFIRMED',
    });

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(externalChargeGateway.findCharges).not.toHaveBeenCalled();
  });

  it('should reject a checked-in booking without an assigned room', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomNumber: null,
    });

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'Checked-in booking does not have an assigned room',
    );

    expect(externalChargeGateway.findCharges).not.toHaveBeenCalled();
  });

  it('should reject a checked-in booking with a blank assigned room', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomNumber: '   ',
    });

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should reject a fractional persisted room charge', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomCharge: 60000.5,
    });

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(externalChargeGateway.findCharges).not.toHaveBeenCalled();
  });

  it('should reject a negative persisted room charge', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomCharge: -1,
    });

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should reject an unsafe persisted room charge', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomCharge: Number.MAX_SAFE_INTEGER + 1,
    });

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should return service unavailable when external charge retrieval fails', async () => {
    externalChargeGateway.findCharges.mockRejectedValue(
      new Error('External service unavailable'),
    );

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'Unable to retrieve external folio charges',
    );
  });

  it('should reject a non-array external charge response', async () => {
    externalChargeGateway.findCharges.mockResolvedValue(
      null as unknown as ExternalFolioCharge[],
    );

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'External folio charge data is invalid',
    );
  });

  it('should reject an unsupported external charge category', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'UNKNOWN-001',
        category: 'UNKNOWN' as FolioCategory.SERVICES,
        description: 'Unknown charge',
        amount: 1000,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'External folio charge category is invalid',
    );
  });

  it('should reject an empty external charge reference', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: '   ',
        category: FolioCategory.SERVICES,
        description: 'Service charge',
        amount: 1000,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'External folio charge reference is invalid',
    );
  });

  it('should reject an empty external charge description', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: '   ',
        amount: 1000,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'External folio charge description is invalid',
    );
  });

  it('should reject a fractional external charge amount', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: 'Service charge',
        amount: 1000.5,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'External folio charge amount must be a non-negative integer',
    );
  });

  it('should reject a negative external charge amount', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: 'Service charge',
        amount: -1,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('should reject an unsafe external charge amount', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: 'Service charge',
        amount: Number.MAX_SAFE_INTEGER + 1,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(
      service.getRunningFolio(bookingReference),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('should reject an invalid external charge timestamp', async () => {
    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'SERVICE-001',
        category: FolioCategory.SERVICES,
        description: 'Service charge',
        amount: 1000,
        occurredAt: 'not-a-date',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'External folio charge timestamp is invalid',
    );
  });

  it('should reject an unsafe category subtotal', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomCharge: 0,
    });

    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'FOOD-001',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Large charge one',
        amount: Number.MAX_SAFE_INTEGER,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
      {
        reference: 'FOOD-002',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Large charge two',
        amount: 1,
        occurredAt: '2032-01-10T11:00:00.000Z',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'Unable to calculate FOOD_AND_BEVERAGE subtotal',
    );
  });

  it('should reject an unsafe grand total', async () => {
    repository.findBookingContext.mockResolvedValue({
      ...bookingContext,
      roomCharge: 1,
    });

    externalChargeGateway.findCharges.mockResolvedValue([
      {
        reference: 'FOOD-001',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Maximum safe charge',
        amount: Number.MAX_SAFE_INTEGER,
        occurredAt: '2032-01-10T10:00:00.000Z',
      },
    ]);

    await expect(service.getRunningFolio(bookingReference)).rejects.toThrow(
      'Unable to calculate a valid folio total',
    );
  });

  it('should return the same deterministic folio for identical source data', async () => {
    const charges: ExternalFolioCharge[] = [
      {
        reference: 'FOOD-B',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Food B',
        amount: 2000,
        occurredAt: '2032-01-10T12:00:00.000Z',
      },
      {
        reference: 'FOOD-A',
        category: FolioCategory.FOOD_AND_BEVERAGE,
        description: 'Food A',
        amount: 1000,
        occurredAt: '2032-01-10T12:00:00.000Z',
      },
    ];

    externalChargeGateway.findCharges.mockResolvedValue(charges);

    const first = await service.getRunningFolio(bookingReference);

    const second = await service.getRunningFolio(bookingReference);

    expect(second).toEqual(first);
  });
});
