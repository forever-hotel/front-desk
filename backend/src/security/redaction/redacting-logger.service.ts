import { ConsoleLogger, type LoggerService } from '@nestjs/common';
import { redactLogValue } from './log-redactor';

export class RedactingLoggerService implements LoggerService {
  constructor(private readonly delegate: LoggerService = new ConsoleLogger()) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.delegate.log(
      redactLogValue(message),
      ...this.redactParams(optionalParams),
    );
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.delegate.error(
      redactLogValue(message),
      ...this.redactParams(optionalParams),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.delegate.warn(
      redactLogValue(message),
      ...this.redactParams(optionalParams),
    );
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.delegate.debug?.(
      redactLogValue(message),
      ...this.redactParams(optionalParams),
    );
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.delegate.verbose?.(
      redactLogValue(message),
      ...this.redactParams(optionalParams),
    );
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.delegate.fatal?.(
      redactLogValue(message),
      ...this.redactParams(optionalParams),
    );
  }

  private redactParams(values: unknown[]): unknown[] {
    return values.map((value) => redactLogValue(value));
  }
}
