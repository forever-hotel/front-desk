import "@testing-library/jest-dom";
import "jest-axe/extend-expect";

import { server } from "./tests/mocks/server";

beforeAll(() => {
  server.listen({
    onUnhandledRequest: "error",
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,

  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,

    addListener: jest.fn(),

    removeListener: jest.fn(),

    addEventListener: jest.fn(),

    removeEventListener: jest.fn(),

    dispatchEvent: jest.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

const originalGetComputedStyle = window.getComputedStyle.bind(window);

Object.defineProperty(window, "getComputedStyle", {
  writable: true,
  configurable: true,

  value: (element: Element) => originalGetComputedStyle(element),
});
