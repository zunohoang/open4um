/* eslint-disable prettier/prettier */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript'
          },
          target: 'es2022'
        },
        module: {
          type: 'commonjs'
        }
      }
    ]
  },
  clearMocks: true
}
