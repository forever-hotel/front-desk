import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
  RABBITMQ_TOPOLOGY,
} from '../messaging.constants';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { CheckoutCompletedPublisher } from './checkout-completed.publisher';

describe('CheckoutCompletedPublisher', () => {
  let publisher: CheckoutCompletedPublisher;
  let rabbitMqService: jest.Mocked<RabbitMqService>;

  const bookingReference = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    rabbitMqService = {
      isEnabled: jest.fn(),
      publishJson: jest.fn(),
    } as unknown as jest.Mocked<RabbitMqService>;

    publisher = new CheckoutCompletedPublisher(rabbitMqService);
  });

  it('skips publishing when RabbitMQ is disabled', async () => {
    rabbitMqService.isEnabled.mockReturnValue(false);

    const result = await publisher.publishCheckoutCompleted({
      bookingReference,
      roomNumber: 'T102',
    });

    expect(result).toEqual({
      status: 'SKIPPED_DISABLED',
      eventId: `checkout:${bookingReference}`,
    });
    expect(rabbitMqService.publishJson).not.toHaveBeenCalled();
  });

  it('publishes a validated checkout.completed event with the expected routing metadata', async () => {
    rabbitMqService.isEnabled.mockReturnValue(true);
    rabbitMqService.publishJson.mockResolvedValue(undefined);

    const result = await publisher.publishCheckoutCompleted({
      bookingReference,
      roomNumber: 'T102',
    });

    expect(result).toEqual({
      status: 'PUBLISHED',
      eventId: `checkout:${bookingReference}`,
    });

    expect(rabbitMqService.publishJson).toHaveBeenCalledTimes(1);

    const [routingKey, event, options] =
      rabbitMqService.publishJson.mock.calls[0];

    expect(routingKey).toBe(RABBITMQ_TOPOLOGY.routingKeys.checkoutCompleted);
    expect(event).toEqual({
      eventId: `checkout:${bookingReference}`,
      eventType: MESSAGE_EVENT_TYPES.checkoutCompleted,
      eventVersion: MESSAGE_EVENT_VERSIONS.checkoutCompleted,
      occurredAt: expect.any(String),
      source: MESSAGE_SOURCES.frontDesk,
      data: {
        bookingReference,
        roomNumber: 'T102',
        taskCategory: 'ROOM_CLEANING',
        priority: 'HIGH',
        sourceType: 'CHECKOUT_TRIGGER',
      },
    });
    expect(
      Number.isNaN(Date.parse((event as { occurredAt: string }).occurredAt)),
    ).toBe(false);
    expect(options).toEqual({
      messageId: `checkout:${bookingReference}`,
      type: MESSAGE_EVENT_TYPES.checkoutCompleted,
      headers: {
        eventVersion: MESSAGE_EVENT_VERSIONS.checkoutCompleted,
        source: MESSAGE_SOURCES.frontDesk,
      },
    });
  });

  it('returns FAILED instead of throwing when RabbitMQ publishing fails', async () => {
    rabbitMqService.isEnabled.mockReturnValue(true);
    rabbitMqService.publishJson.mockRejectedValue(
      new Error('broker unavailable'),
    );

    await expect(
      publisher.publishCheckoutCompleted({
        bookingReference,
        roomNumber: 'T102',
      }),
    ).resolves.toEqual({
      status: 'FAILED',
      eventId: `checkout:${bookingReference}`,
    });
  });

  it('also handles non-Error RabbitMQ failures', async () => {
    rabbitMqService.isEnabled.mockReturnValue(true);
    rabbitMqService.publishJson.mockRejectedValue('connection closed');

    await expect(
      publisher.publishCheckoutCompleted({
        bookingReference,
        roomNumber: 'T102',
      }),
    ).resolves.toEqual({
      status: 'FAILED',
      eventId: `checkout:${bookingReference}`,
    });
  });
});
