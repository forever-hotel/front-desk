import { jest } from '@jest/globals';
import type { ConsumeMessage } from 'amqplib';
import { RABBITMQ_TOPOLOGY } from '../messaging/messaging.constants';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';
import { RealtimePublisherService } from './realtime-publisher.service';
import { TaskEscalationConsumer } from './task-escalation.consumer';

type ConsumeHandler = (message: ConsumeMessage) => Promise<void> | void;

function createMessage(payload: unknown): ConsumeMessage {
  return {
    content: Buffer.from(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      'utf8',
    ),

    fields: {
      consumerTag: 'consumer-1',
      deliveryTag: 1,
      redelivered: false,
      exchange: 'forever.events',
      routingKey: RABBITMQ_TOPOLOGY.routingKeys.taskEscalated,
    },

    properties: {
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      headers: {},
      deliveryMode: undefined,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

function createValidEscalation() {
  return {
    eventId: 'event-1',
    eventType: 'task.escalated',
    eventVersion: 1,
    occurredAt: '2030-01-01T10:00:00.000Z',
    source: 'worker-management',
    data: {
      taskId: '11111111-1111-4111-8111-111111111111',
      taskCategory: 'ROOM_CLEANING',
      roomNumber: 'T102',
      priority: 'HIGH',
      escalatedAt: '2030-01-01T10:00:00.000Z',
    },
  };
}

describe('TaskEscalationConsumer', () => {
  let consumeHandler: ConsumeHandler | undefined;

  let isEnabledMock: jest.MockedFunction<RabbitMqService['isEnabled']>;

  let consumeMock: jest.MockedFunction<RabbitMqService['consume']>;

  let ackMock: jest.MockedFunction<RabbitMqService['ack']>;

  let nackMock: jest.MockedFunction<RabbitMqService['nack']>;

  let publishTaskEscalatedMock: jest.MockedFunction<
    RealtimePublisherService['publishTaskEscalated']
  >;

  let consumer: TaskEscalationConsumer;

  beforeEach(() => {
    consumeHandler = undefined;

    isEnabledMock = jest.fn<RabbitMqService['isEnabled']>();

    isEnabledMock.mockReturnValue(true);

    consumeMock = jest.fn<RabbitMqService['consume']>();

    consumeMock.mockImplementation(
      async (_queue: string, handler: ConsumeHandler): Promise<string> => {
        consumeHandler = handler;

        return 'consumer-1';
      },
    );

    ackMock = jest.fn<RabbitMqService['ack']>();

    nackMock = jest.fn<RabbitMqService['nack']>();

    publishTaskEscalatedMock =
      jest.fn<RealtimePublisherService['publishTaskEscalated']>();

    const rabbitMqService = {
      isEnabled: isEnabledMock,
      consume: consumeMock,
      ack: ackMock,
      nack: nackMock,
    } as unknown as RabbitMqService;

    const realtimePublisherService = {
      publishTaskEscalated: publishTaskEscalatedMock,
    } as unknown as RealtimePublisherService;

    consumer = new TaskEscalationConsumer(
      rabbitMqService,
      realtimePublisherService,
    );
  });

  function getRegisteredHandler(): ConsumeHandler {
    if (!consumeHandler) {
      throw new Error('RabbitMQ consume handler was not registered');
    }

    return consumeHandler;
  }

  it('should stay inactive when RabbitMQ is disabled', async () => {
    isEnabledMock.mockReturnValue(false);

    await consumer.onModuleInit();

    expect(consumeMock).not.toHaveBeenCalled();
  });

  it('should subscribe to the task escalation queue', async () => {
    await consumer.onModuleInit();

    expect(consumeMock).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.queues.taskEscalation,
      expect.any(Function),
    );
  });

  it('should validate, push and ack a valid escalation', async () => {
    await consumer.onModuleInit();

    const event = createValidEscalation();

    const message = createMessage(event);

    await getRegisteredHandler()(message);

    expect(publishTaskEscalatedMock).toHaveBeenCalledWith(event);

    expect(ackMock).toHaveBeenCalledWith(message);

    expect(nackMock).not.toHaveBeenCalled();
  });

  it('should reject malformed JSON without requeueing it', async () => {
    await consumer.onModuleInit();

    const message = createMessage('{not-json');

    await getRegisteredHandler()(message);

    expect(publishTaskEscalatedMock).not.toHaveBeenCalled();

    expect(ackMock).not.toHaveBeenCalled();

    expect(nackMock).toHaveBeenCalledWith(message, false);
  });

  it('should reject an invalid escalation contract', async () => {
    await consumer.onModuleInit();

    const message = createMessage({
      ...createValidEscalation(),
      data: {
        ...createValidEscalation().data,
        taskId: 'not-a-uuid',
      },
    });

    await getRegisteredHandler()(message);

    expect(publishTaskEscalatedMock).not.toHaveBeenCalled();

    expect(ackMock).not.toHaveBeenCalled();

    expect(nackMock).toHaveBeenCalledWith(message, false);
  });

  it('should nack the message when realtime publishing fails with an Error', async () => {
    await consumer.onModuleInit();

    publishTaskEscalatedMock.mockImplementation(() => {
      throw new Error('realtime publisher unavailable');
    });

    const message = createMessage(createValidEscalation());

    await getRegisteredHandler()(message);

    expect(publishTaskEscalatedMock).toHaveBeenCalledTimes(1);

    expect(ackMock).not.toHaveBeenCalled();

    expect(nackMock).toHaveBeenCalledWith(message, false);
  });

  it('should nack the message when realtime publishing fails with a non-Error value', async () => {
    await consumer.onModuleInit();

    publishTaskEscalatedMock.mockImplementation(() => {
      throw 'realtime unavailable';
    });

    const message = createMessage(createValidEscalation());

    await getRegisteredHandler()(message);

    expect(ackMock).not.toHaveBeenCalled();

    expect(nackMock).toHaveBeenCalledWith(message, false);
  });
});
