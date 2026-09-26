import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
 transform: {
  '^.+\\.(t|j)s$': [
    'ts-jest',
    {
      tsconfig: 'tsconfig.spec.json',
    },
  ],
},
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
 collectCoverageFrom: [
  'src/**/*.(t|j)s',
  'libs/**/*.(t|j)s',
  'apps/**/*.(t|j)s',

  // NestJS bootstrap and module wiring are validated through
  // integration/E2E testing rather than unit coverage.
  '!src/main.ts',
  '!src/**/*.module.ts',
],
  coverageDirectory: './coverage',
  coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
  testEnvironment: 'node',
};

export default config;
