// Global test setup to prevent test pollution
afterEach(() => {
  // Clean up process.exitCode after each test to prevent state leaking between tests
  process.exitCode = undefined;
});
