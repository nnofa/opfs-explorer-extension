module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  globals: {
    chrome: {
      runtime: {},
      tabs: {},
      storage: {},
      scripting: {},
    },
  },
  moduleDirectories: ["node_modules", "src"],
  roots: ["<rootDir>"],
  testEnvironmentOptions: {
    url: "http://localhost",
  },
};
