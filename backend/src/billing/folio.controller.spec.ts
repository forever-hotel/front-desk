import { FolioController } from './folio.controller';
import { FolioService } from './folio.service';
import { FolioCategory } from './models/folio-category';
import { RunningFolio } from './models/running-folio';

describe('FolioController', () => {
  let controller: FolioController;

  let service: {
    getRunningFolio: jest.Mock;
  };

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  const runningFolio: RunningFolio = {
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
  };

  beforeEach(() => {
    service = {
      getRunningFolio: jest.fn(),
    };

    controller = new FolioController(service as unknown as FolioService);
  });

  it('should delegate running-folio retrieval to the service', async () => {
    service.getRunningFolio.mockResolvedValue(runningFolio);

    await expect(controller.getRunningFolio(bookingReference)).resolves.toEqual(
      runningFolio,
    );

    expect(service.getRunningFolio).toHaveBeenCalledTimes(1);

    expect(service.getRunningFolio).toHaveBeenCalledWith(bookingReference);
  });
});
