import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: jest.Mocked<BookingsService>;

  beforeEach(async () => {
    const serviceMock = {
      search: jest.fn(),
      findRecent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get(BookingsService);
  });

  it('should search bookings using the provided query', async () => {
    const result = [
      {
        bookingReference: 'FH-1001',
        guestName: 'Kamal Perera',
      },
    ];

    service.search.mockResolvedValue(result as never);

    await expect(controller.search('kamal')).resolves.toEqual(result);
    expect(service.search).toHaveBeenCalledWith('kamal');
  });

  it('should use an empty query by default', async () => {
    service.search.mockResolvedValue([]);

    await controller.search();

    expect(service.search).toHaveBeenCalledWith('');
  });

  it('should return recent bookings using the provided limit', async () => {
    const bookings = [{ bookingReference: 'FH-1001' }];

    service.findRecent.mockResolvedValue(bookings as never);

    await expect(controller.findRecent('10')).resolves.toEqual({
      value: bookings,
      count: 1,
    });

    expect(service.findRecent).toHaveBeenCalledWith(10);
  });

  it('should use the default limit when limit is invalid', async () => {
    service.findRecent.mockResolvedValue([]);

    await controller.findRecent('invalid');

    expect(service.findRecent).toHaveBeenCalledWith(5);
  });
});
