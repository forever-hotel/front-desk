import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  testEnvironment: "jest-environment-jsdom",

  testEnvironmentOptions: {
    customExportConditions: [""],
  },

  setupFiles: ["<rootDir>/jest.polyfills.cjs"],

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],

  testTimeout: 15000,

  collectCoverageFrom: [
    "src/config/**/*.ts",
    "src/lib/api/**/*.ts",
    "src/lib/realtime/**/*.ts",
    "src/providers/**/*.tsx",
    "src/hooks/**/*.ts",
    "src/features/**/api/**/*.ts",
    "src/features/**/hooks/**/*.ts",
    "src/features/**/components/**/*.tsx",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/*.type.ts",
  ],

  coverageDirectory: "coverage",

  coverageReporters: ["text", "text-summary", "html", "lcov"],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  clearMocks: true,

  restoreMocks: true,
};

export default createJestConfig(config);
