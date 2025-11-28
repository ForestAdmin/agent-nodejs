# MCP Server Tests

This directory contains the test suite for the Forest Admin MCP Server.

## Test Structure

```
test/
├── server.test.ts                                    # Unit tests for server configuration
├── integration/
│   └── http-server.integration.test.ts              # Integration tests for HTTP endpoints
└── README.md                                         # This file
```

## Test Categories

### Unit Tests ([server.test.ts](./server.test.ts))

These tests verify configuration and validation logic:

- **Environment Validation**:
  - FOREST_ENV_SECRET validation
  - FOREST_AUTH_SECRET validation

- **URL Configuration**:
  - FOREST_SERVER_URL configuration
  - Fallback to FOREST_URL
  - Default URL handling

- **Port Configuration**:
  - MCP_SERVER_PORT handling
  - Default port (3931)

- **Server Configuration**:
  - Server name and version validation

### Integration Tests ([integration/http-server.integration.test.ts](./integration/http-server.integration.test.ts))

Real HTTP integration tests using supertest that test actual Express middleware:

- **CORS Configuration**:
  - Cross-origin request handling
  - CORS headers verification

- **HTTP Method Restrictions**:
  - POST requests accepted
  - GET, PUT, DELETE requests rejected (405)

- **Request Body Parsing**:
  - JSON body parsing
  - URL-encoded body parsing
  - Empty body handling

- **JSON-RPC Error Responses**:
  - Proper error format
  - Error codes
  - Error messages

- **Content-Type Headers**:
  - JSON content type responses

- **Response Structure**:
  - Valid JSON-RPC response format
  - Request ID handling

## Running Tests

### Run all tests
```bash
yarn test
```

### Run tests in watch mode
```bash
yarn test --watch
```

### Run tests with coverage
```bash
yarn test --coverage
```

### Run specific test file
```bash
yarn test server.test.ts
yarn test http-server.integration.test.ts
```

### Run only integration tests
```bash
yarn test integration
```

## Test Configuration

The tests use Jest with the following configuration:

- **Preset**: `ts-jest` (for TypeScript support)
- **Test Environment**: Node.js
- **Test Match Pattern**: `**/*.test.ts`
- **Coverage Collection**: Collected from `src/**/*.ts`

See [jest.config.ts](../jest.config.ts) for full configuration.

## Writing New Tests

### Test File Naming

- Unit tests: `<module-name>.test.ts`
- Integration tests: `<feature-name>.integration.test.ts`

### Integration Test Example

```typescript
import express from 'express';
import request from 'supertest';

describe('Feature Integration', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    // Setup middleware and routes
  });

  it('should handle requests correctly', async () => {
    const response = await request(app)
      .post('/endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result');
  });
});
```

### Best Practices

1. **Real Testing**: Use supertest to make actual HTTP requests to Express apps
2. **Isolation**: Each test should be independent
3. **Setup/Teardown**: Use beforeEach/afterEach for clean test state
4. **Descriptive Names**: Clearly describe what is being tested
5. **Test Behavior**: Test actual behavior, not implementation details

## Dependencies

The test suite uses:

- `supertest`: For HTTP integration testing
- `@types/supertest`: TypeScript definitions
- `jest`: Testing framework (inherited from root)
- `ts-jest`: Jest transformer for TypeScript (inherited from root)

## Current Test Coverage

As of the latest run:

- **Test Suites**: 2 passed
- **Tests**: 23 passed
  - Unit tests: 7
  - Integration tests: 16

## Continuous Integration

These tests run automatically in the CI/CD pipeline:

1. On every pull request
2. Before merging to main branches
3. Before publishing new versions

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module 'supertest'"
- **Solution**: Run `yarn install` to install dependencies

**Issue**: TypeScript compilation errors
- **Solution**: Run `yarn build` to compile TypeScript files

**Issue**: Port already in use
- **Solution**: These tests use supertest which doesn't bind to real ports - they test the Express app directly

**Issue**: CORS test failures
- **Solution**: Ensure cors middleware is properly configured in the Express app

## Future Improvements

Areas for expansion:

- [ ] Add tests for MCP transport layer
- [ ] Add tests for tool execution
- [ ] Add tests for authentication flow
- [ ] Add E2E tests with real MCP clients
- [ ] Add load/performance tests
- [ ] Add snapshot tests for API responses
