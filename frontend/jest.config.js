module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  automock: false,
  globals: {
    'import.meta': {
      env: {
        DEV: false,
        VITE_API_URL: '/api/v1',
      },
    },
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    // Mock auth module to avoid import.meta issues
    '^@/api/auth$': '<rootDir>/src/api/__mocks__/auth.ts',
    // Mock API client to avoid import.meta issues
    '^@/api/client$': '<rootDir>/src/api/__mocks__/client.ts',
    '^@/utils/apiClient$': '<rootDir>/src/api/__mocks__/client.ts',
    // Mock @mui/lab components
    '^@mui/lab$': '<rootDir>/src/__mocks__/@mui/lab.ts',
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@store$': '<rootDir>/src/store/index.ts',
    '^@stores/(.*)$': '<rootDir>/src/store/slices/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@context/(.*)$': '<rootDir>/src/context/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
        },
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/setupTests.ts',
    '!src/test-utils/**/*',
    '!src/types/**/*',
    '!src/vite-env.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testTimeout: 10000,
}