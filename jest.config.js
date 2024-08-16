const config = {
  // Automatically clear mock calls, instances, contexts and results before every test
  // clearMocks: true,

  // The root directory that Jest should scan for tests and modules within
  rootDir: "build",

  // The test environment that will be used for testing
  testEnvironment: "node",

  // The glob patterns Jest uses to detect test files
  testMatch: ["test/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: ["/node_modules/"],

  transform: {},
};

export default config;
