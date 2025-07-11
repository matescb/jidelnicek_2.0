// Mock vitest for Jest compatibility
export const vi = {
  fn: jest.fn,
  mock: jest.mock,
  spyOn: jest.spyOn,
  clearAllMocks: jest.clearAllMocks,
  resetAllMocks: jest.resetAllMocks,
  restoreAllMocks: jest.restoreAllMocks,
  mocked: (fn: any) => fn as jest.MockedFunction<any>,
};

export const describe = global.describe;
export const it = global.it;
export const test = global.test;
export const expect = global.expect;
export const beforeEach = global.beforeEach;
export const afterEach = global.afterEach;
export const beforeAll = global.beforeAll;
export const afterAll = global.afterAll;