# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Overview

Forest Admin Agent Node.js - SDK for building Forest Admin agents and datasources.

## Commands

```bash
# Core commands
yarn                    # Install dependencies
yarn build              # Build all packages
yarn lint               # Lint all packages
yarn lint:fix           # Fix lint issues
yarn test               # Run all tests
yarn test:coverage      # Run tests with coverage
```

## Architecture

### Monorepo Structure

**Core:**
- `agent` - Main Forest Admin agent package
- `agent-client` - RPC client for agent communication
- `forestadmin-client` - Forest Admin API client

**Datasources:**
- `datasource-toolkit` - Base toolkit for datasources
- `datasource-customizer` - Customization layer
- `datasource-sql` - SQL datasource
- `datasource-sequelize` - Sequelize datasource
- `datasource-mongo` - MongoDB datasource
- `datasource-mongoose` - Mongoose datasource

**Other:**
- `mcp-server` - MCP (Model Context Protocol) server for AI integration
- `ai-proxy` - AI/LLM integration proxy
- `forest-cloud` - Cloud deployment utilities
- `plugin-*` - Various plugins (aws-s3, export-advanced, flattener)

### Key Technologies

Node.js | TypeScript | Jest | Lerna | ESM

## Code Style

ESLint (Airbnb TypeScript) | Prettier | Conventional Commits | Semantic release

## Testing

Use Jest for all tests. Run package-specific tests with workspace commands:

```bash
yarn workspace @forestadmin/mcp-server test
yarn workspace @forestadmin/agent test
```

## Code Review Principles

### Core Principles

- **DRY** (Don't Repeat Yourself) - Extract common logic into reusable functions/services
- **KISS** (Keep It Simple, Stupid) - Prefer simple, readable solutions over clever ones
- **YAGNI** (You Aren't Gonna Need It) - Don't implement features "just in case"

### Function Design

- **Single Responsibility** - One function = one task
- **Size** - Keep functions short (20-30 lines max); split if longer
- **Naming** - Descriptive names that explain *what*, not *how* (`getUserPermissions` not `getData`)
- **Parameters** - Max 3-4 parameters; use an options object for more
- **Return early** - Guard clauses at the top, avoid deep nesting

### Code Quality

- **No magic numbers/strings** - Use named constants
- **Avoid side effects** - Pure functions when possible
- **Handle errors explicitly** - No silent failures
- **Comments** - Explain *why*, not *what* (code should be self-documenting)

### Review Checklist

1. Does this code do one thing well?
2. Can I understand it in 30 seconds?
3. Is there duplication that should be extracted?
4. Are there unused variables/imports?
5. Are edge cases handled?
6. Is the naming clear and consistent?
