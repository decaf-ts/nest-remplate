/** @type {import('jest').Config} */
const config = {
  verbose: true,
  rootDir: __dirname,
  // ESM app: ts-jest emits ESM, jest runs it with --experimental-vm-modules (set by the npm scripts)
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json", useESM: true }],
  },
  testEnvironment: "node",
  testRegex: "/tests/.*\\.(test|spec|e2e)\\.ts$",
  testPathIgnorePatterns: ["/node_modules/", "/tests/trivy-fixture/"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  testTimeout: 60000,
  setupFiles: ["<rootDir>/tests/setup.ts"],
  collectCoverage: false,
  coverageDirectory: "./workdocs/reports/coverage",
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"],
  reporters: ["default"],
  watchman: false,
};

module.exports = config;
