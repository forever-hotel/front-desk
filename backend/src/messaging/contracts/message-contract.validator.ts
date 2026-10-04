import * as Joi from 'joi';
import { CheckoutCompletedEvent } from './checkout-completed.event';
import {
  TaskEscalatedEvent,
  TaskEscalationCategory,
  TaskEscalationPriority,
} from './task-escalated.event';
import {
  MESSAGE_EVENT_TYPES,
  MESSAGE_EVENT_VERSIONS,
  MESSAGE_SOURCES,
} from '../messaging.constants';

const taskCategories: TaskEscalationCategory[] = [
  'ROOM_CLEANING',
  'EXTRA_TOWELS',
  'WATER_BOTTLES',
  'MAINTENANCE',
  'LAUNDRY',
  'FOOD_DELIVERY',
  'OTHER',
];

const taskPriorities: TaskEscalationPriority[] = ['HIGH', 'NORMAL'];

const checkoutCompletedEventSchema = Joi.object({
  eventId: Joi.string().trim().min(1).required(),

  eventType: Joi.string()
    .valid(MESSAGE_EVENT_TYPES.checkoutCompleted)
    .required(),

  eventVersion: Joi.number()
    .integer()
    .valid(MESSAGE_EVENT_VERSIONS.checkoutCompleted)
    .required(),

  occurredAt: Joi.string().isoDate().required(),

  source: Joi.string().valid(MESSAGE_SOURCES.frontDesk).required(),

  data: Joi.object({
    bookingReference: Joi.string().guid({ version: 'uuidv4' }).required(),
    roomNumber: Joi.string().trim().min(1).max(10).required(),
    taskCategory: Joi.string().valid('ROOM_CLEANING').required(),
    priority: Joi.string().valid('HIGH').required(),
    sourceType: Joi.string().valid('CHECKOUT_TRIGGER').required(),
  })
    .unknown(false)
    .required(),
}).unknown(false);

const taskEscalatedEventSchema = Joi.object({
  eventId: Joi.string().trim().min(1).required(),

  eventType: Joi.string().valid(MESSAGE_EVENT_TYPES.taskEscalated).required(),

  eventVersion: Joi.number()
    .integer()
    .valid(MESSAGE_EVENT_VERSIONS.taskEscalated)
    .required(),

  occurredAt: Joi.string().isoDate().required(),

  source: Joi.string().valid(MESSAGE_SOURCES.workerManagement).required(),

  data: Joi.object({
    taskId: Joi.string().guid({ version: 'uuidv4' }).required(),
    taskCategory: Joi.string()
      .valid(...taskCategories)
      .required(),
    roomNumber: Joi.string().trim().min(1).max(10).required(),
    priority: Joi.string()
      .valid(...taskPriorities)
      .required(),
    escalatedAt: Joi.string().isoDate().required(),
  })
    .unknown(false)
    .required(),
}).unknown(false);

export class MessageContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageContractValidationError';
  }
}

export function validateCheckoutCompletedEvent(
  value: unknown,
): CheckoutCompletedEvent {
  const { error, value: validatedValue } =
    checkoutCompletedEventSchema.validate(value, {
      abortEarly: false,
      allowUnknown: false,
      convert: false,
    });

  if (error) {
    throw new MessageContractValidationError(
      `Invalid checkout.completed event: ${formatValidationError(error)}`,
    );
  }

  return validatedValue as CheckoutCompletedEvent;
}

export function validateTaskEscalatedEvent(value: unknown): TaskEscalatedEvent {
  const { error, value: validatedValue } = taskEscalatedEventSchema.validate(
    value,
    {
      abortEarly: false,
      allowUnknown: false,
      convert: false,
    },
  );

  if (error) {
    throw new MessageContractValidationError(
      `Invalid task.escalated event: ${formatValidationError(error)}`,
    );
  }

  return validatedValue as TaskEscalatedEvent;
}

function formatValidationError(error: Joi.ValidationError): string {
  return error.details.map((detail) => detail.message).join('; ');
}
