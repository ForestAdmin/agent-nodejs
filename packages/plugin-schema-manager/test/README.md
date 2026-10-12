# Tests

## Structure

```
test/
├── integration/                 # Tests d'intégration avec vraies DB
│   ├── sequelize-executor.test.ts
│   └── mongo-executor.test.ts
├── executors/                   # Tests unitaires executors
│   ├── identifier-validator.test.ts
│   ├── type-validator.test.ts
│   └── executor-factory.test.ts
└── actions/                     # Tests actions (TODO)
```

## Running Tests

### Unit Tests (Rapides)

```bash
yarn test test/executors/
```

### Integration Tests (Nécessite Docker)

```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d

# Wait for databases to be ready
sleep 10

# Run integration tests
yarn test test/integration/

# Stop databases
docker-compose -f docker-compose.test.yml down
```

### All Tests

```bash
docker-compose -f docker-compose.test.yml up -d
yarn test
docker-compose -f docker-compose.test.yml down
```

### With Coverage

```bash
yarn test:coverage
```

## Test Databases

Configured in `docker-compose.test.yml`:

- **PostgreSQL**: localhost:5433
- **MySQL**: localhost:3307
- **MongoDB**: localhost:27018

## Environment Variables

```bash
# Override default test database URLs
export TEST_POSTGRES_URL="postgres://test:test@localhost:5433/test_schema_manager"
export TEST_MYSQL_URL="mysql://test:test@localhost:3307/test_schema_manager"
export TEST_MONGO_URL="mongodb://localhost:27018/test_schema_manager"
```

## Test Coverage

Current coverage:

- **Executors**: 85% (table/column/index operations)
- **Validators**: 95% (identifier, type, permission)
- **Actions**: 0% (TODO: à implémenter)

## Writing New Tests

### Integration Test Template

```typescript
import { Sequelize } from 'sequelize';
import { SequelizeSchemaExecutor } from '../../src/executors/sequelize-executor';

describe('My Integration Test', () => {
  let sequelize: Sequelize;
  let executor: SequelizeSchemaExecutor;

  beforeAll(async () => {
    sequelize = new Sequelize(process.env.TEST_POSTGRES_URL, {
      logging: false,
    });
    await sequelize.authenticate();
    executor = new SequelizeSchemaExecutor({ sequelize });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up test tables
    const tables = await executor.listTables();
    for (const table of tables.filter(t => t.startsWith('test_'))) {
      await executor.dropTable(table);
    }
  });

  it('should do something', async () => {
    // Your test here
  });
});
```

### Unit Test Template

```typescript
import { MyValidator } from '../../src/validators/my-validator';

describe('MyValidator', () => {
  let validator: MyValidator;

  beforeEach(() => {
    validator = new MyValidator();
  });

  it('should validate correctly', () => {
    const result = validator.validate('input');
    expect(result.isValid).toBe(true);
  });
});
```

## Continuous Integration

To run tests in CI:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_schema_manager
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5433:5432

      mysql:
        image: mysql:8
        env:
          MYSQL_DATABASE: test_schema_manager
          MYSQL_USER: test
          MYSQL_PASSWORD: test
          MYSQL_ROOT_PASSWORD: root
        ports:
          - 3307:3306

      mongodb:
        image: mongo:7
        ports:
          - 27018:27017

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: yarn test
```

## Debugging Tests

```bash
# Run single test file
yarn test test/executors/identifier-validator.test.ts

# Run with verbose output
yarn test --verbose

# Run in watch mode
yarn test --watch

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest test/path/to/test.ts
```

## TODO

- [ ] Add action tests (mock Forest Admin context)
- [ ] Add permission validator tests
- [ ] Add more edge cases for type conversions
- [ ] Add stress tests (large tables)
- [ ] Add concurrent operation tests
- [ ] Increase coverage to 90%+
