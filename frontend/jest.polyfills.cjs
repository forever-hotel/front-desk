/* eslint-disable @typescript-eslint/no-require-imports */

const { TextDecoder, TextEncoder } = require("node:util");

const {
  ReadableStream,
  TransformStream,
  WritableStream,
} = require("node:stream/web");

const { Blob, File } = require("node:buffer");

const { BroadcastChannel, MessagePort } = require("node:worker_threads");

/*
 * Lightweight MessageChannel implementation for Jest/JSDOM.
 *
 * Do not use Node's native MessageChannel here because React Scheduler
 * can keep the native MessagePort open and prevent Jest from exiting.
 *
 * Ant Design's rc-select uses MessageChannel internally, so a compatible
 * implementation still needs to exist in the test environment.
 */
class MessageChannelMock {
  constructor() {
    const port1 = {
      onmessage: null,
      postMessage: () => {},
      start: () => {},
      close: () => {},
    };

    const port2 = {
      onmessage: null,
      postMessage: () => {},
      start: () => {},
      close: () => {},
    };

    port1.postMessage = (data) => {
      queueMicrotask(() => {
        if (typeof port2.onmessage === "function") {
          port2.onmessage({
            data,
          });
        }
      });
    };

    port2.postMessage = (data) => {
      queueMicrotask(() => {
        if (typeof port1.onmessage === "function") {
          port1.onmessage({
            data,
          });
        }
      });
    };

    this.port1 = port1;
    this.port2 = port2;
  }
}

Object.defineProperties(globalThis, {
  TextDecoder: {
    value: TextDecoder,
    configurable: true,
  },

  TextEncoder: {
    value: TextEncoder,
    configurable: true,
  },

  ReadableStream: {
    value: ReadableStream,
    configurable: true,
  },

  TransformStream: {
    value: TransformStream,
    configurable: true,
  },

  WritableStream: {
    value: WritableStream,
    configurable: true,
  },

  Blob: {
    value: Blob,
    configurable: true,
  },

  File: {
    value: File,
    configurable: true,
  },

  BroadcastChannel: {
    value: BroadcastChannel,
    configurable: true,
  },

  MessagePort: {
    value: MessagePort,
    configurable: true,
  },

  MessageChannel: {
    value: MessageChannelMock,
    writable: true,
    configurable: true,
  },
});

const { fetch, FormData, Headers, Request, Response } = require("undici");

Object.defineProperties(globalThis, {
  fetch: {
    value: fetch,
    writable: true,
    configurable: true,
  },

  FormData: {
    value: FormData,
    configurable: true,
  },

  Headers: {
    value: Headers,
    configurable: true,
  },

  Request: {
    value: Request,
    configurable: true,
  },

  Response: {
    value: Response,
    configurable: true,
  },
});
