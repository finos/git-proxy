import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';
import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  roots: ['<rootDir>/src'],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/src/test/globalSetup.ts',
  globalTeardown: '<rootDir>/src/test/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test/setupFile.ts'],
};

export default jestConfig;
