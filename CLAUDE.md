# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forest Admin Agent-nodejs is a monorepo that provides an off-the-shelf administration panel for Node.js applications. It's built on a layered architecture that separates data access, customization, and HTTP routing concerns.

## Monorepo Structure

This is a Yarn v1 workspace managed by Lerna. Packages are organized in `/packages/`:

### Core Packages (dependency order)
- `datasource-toolkit`: Core interfaces and base classes (Collection, DataSource, Filter, Projection, etc.)
- `datasource-customizer`: Decorator system for extending datasources with computed fields, relations, hooks, etc.
- `agent`: HTTP server implementation (Koa-based) that exposes collections as REST APIs

### Datasource Implementations
- `datasource-sql`: Generic SQL datasource (supports PostgreSQL, MySQL, MariaDB, SQLite, MSSQL via Sequelize)
- `datasource-sequelize`: Sequelize ORM integration
- `datasource-mongoose`: Mongoose ODM integration
- `datasource-mongo`: Direct MongoDB driver integration
- `datasource-replica`: Read replica support
- `datasource-dummy`: Testing/development datasource

### Additional Packages
- `forestadmin-client`: Client for Forest Admin API
- `forest-cloud`: Cloud-specific functionality
- `plugin-*`: Optional plugins (aws-s3, export-advanced, flattener)
- `_example`: Example application demonstrating all features

## Architecture

### Three-Layer Design

1. **DataSource Layer** (`datasource-toolkit`)
   - Defines core interfaces: `DataSource`, `Collection`, `Filter`, `Projection`, `Aggregation`
   - Collections expose CRUD operations: `list()`, `create()`, `update()`, `delete()`, `aggregate()`
   - Query system uses condition trees for complex filtering
   - Base implementations: `BaseDataSource`, `BaseCollection`

2. **Decorator Layer** (`datasource-customizer`)
   - Wraps datasources to add functionality without modifying underlying implementations
   - Each decorator extends `DataSourceDecorator` and wraps collections with `CollectionDecorator`
   - Key decorators in `/src/decorators/`:
     - `computed`: Add virtual fields computed from other fields
     - `relation`: Define relationships between collections
     - `search`: Implement full-text search
     - `segment`: Add filtered views of collections
     - `actions`: Define custom business actions
     - `hook`: Add before/after hooks on operations
     - `operators-emulate`: Emulate missing query operators
     - `write`: Customize create/update behavior
     - `validation`: Add field validation
   - Decorators are stacked in `decorators-stack.ts` to compose functionality

3. **HTTP Layer** (`agent`)
   - `Agent` class is the main entry point
   - Exposes REST routes via Koa router
   - Routes organized by concern in `/src/routes/`:
     - `access/`: Read operations (list, count, csv, charts)
     - `modification/`: Write operations (create, update, delete)
     - `security/`: Authentication and permissions
     - `system/`: Health checks and metadata
   - Supports mounting on Express, Koa, Fastify, and NestJS via `FrameworkMounter`

### Key Concepts

**Collections**: Tables, models, or document collections in your database. Each has a schema defining fields, relationships, and capabilities.

**Decorators**: Chain of responsibility pattern where each decorator adds functionality and delegates to the wrapped collection. Schema changes flow bottom-up, invalidating caches.

**Filters**: Query objects with condition trees, pagination, sorting, and projection. Passed through decorator chain where each can transform or execute.

**Customization**: Collections are customized via `agent.customizeCollection('name', callback)` which receives a `CollectionCustomizer` to add fields, relations, hooks, etc.

## Common Development Commands

### Setup
```bash
yarn install && yarn bootstrap
```

### Building
```bash
# Build all packages
yarn build

# Build in watch mode (for development)
yarn build:watch

# Build specific package
cd packages/agent && yarn build
```

### Testing
```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests for specific package
cd packages/datasource-sql && yarn test

# Run specific test file
yarn test packages/agent/test/agent.test.ts
```

Tests are located in each package's `/test/` directory and use Jest with ts-jest. Test files follow the pattern `*.test.ts`.

### Linting
```bash
# Lint all packages
yarn lint

# Auto-fix linting issues
yarn lint:fix

# Lint specific package
cd packages/datasource-toolkit && yarn lint
```

ESLint is configured with Airbnb TypeScript style guide. Key rules:
- Always add blank line before return statements and around blocks
- Sort imports: types first, then builtins/external, then internal
- Use `void` for intentionally unused variables

### Running Example App
```bash
cd packages/_example
yarn start           # Run with ts-node
yarn start:watch    # Run with auto-reload on changes
```

The example app demonstrates connecting multiple datasources (SQL, MongoDB, Sequelize) and customizing collections.

### Documentation
```bash
yarn docs  # Generate TypeDoc API reference
```

## Making Changes

### Adding Features to Datasources

When modifying datasource implementations:
1. Update interfaces in `datasource-toolkit/src/interfaces/`
2. Implement in `BaseDataSource` or `BaseCollection` if applicable to all datasources
3. Update specific datasource implementations (sql, mongoose, etc.)
4. Add tests in corresponding `/test/` directory

### Adding Decorators

To add new customization capabilities:
1. Create decorator in `datasource-customizer/src/decorators/your-feature/`
2. Extend `CollectionDecorator` for collection-level functionality
3. Override methods that need custom behavior (e.g., `list()`, `schema`)
4. Add to decorator stack in `decorators-stack.ts`
5. Expose via `CollectionCustomizer` for user-facing API

### Adding Routes

When adding HTTP endpoints:
1. Create route in `agent/src/routes/` following existing structure
2. Extend `BaseRoute` or `CollectionRoute`
3. Implement handler with proper caller context and permission checks
4. Register in `routes/index.ts`
5. Use `json-api-serializer` for response formatting

## Project-Specific Patterns

### Schema Invalidation

Collections cache their schema for performance. When schema changes:
- Call `markSchemaAsDirty()` on the collection
- Parent decorators automatically invalidate when children do
- Next schema access recomputes via `refineSchema()`

### Caller Context

All operations receive a `Caller` object with:
- `id`: User identifier
- `email`: User email
- `timezone`: User timezone
- `customData`: Additional user data

Pass this through all operations for authentication and context-aware behavior.

### Error Handling

Use error classes from `datasource-toolkit/src/errors.ts`:
- `ValidationError`: User input errors
- `ForbiddenError`: Permission errors
- `UnprocessableError`: Business logic errors

### Native Drivers

Datasources expose `nativeDriver` property for direct database access when needed. Use sparingly to avoid breaking abstraction.

## Release Process

Releases are automated via semantic-release:
- Commits follow conventional commits format
- `@qiwi/multi-semantic-release` handles monorepo versioning
- Each package has independent versions
- Main branch is `beta`, PRs target `beta`
