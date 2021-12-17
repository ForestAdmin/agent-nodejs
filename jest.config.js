module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
  ],
};
