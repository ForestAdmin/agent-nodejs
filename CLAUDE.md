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

### Writing Meaningful Tests

- **Assertions must verify behavior** - Don't just check that a function was called; verify it was called with the correct arguments
- **Test name = assertion** - If the test says "selects config X", the assertion must verify config X was selected
- **Avoid weak assertions**:
  - ❌ `expect(mock).toHaveBeenCalled()` - only checks the function was called
  - ✅ `expect(mock).toHaveBeenCalledWith({ host: 'localhost', port: 3000 })` - verifies exact arguments
  - ✅ `expect(mock).toHaveBeenCalledWith(expect.objectContaining({ host: 'localhost' }))` - partial match when some values are dynamic
- **One behavior per test** - Each test should verify one specific behavior
- **Test edge cases** - Not just happy paths; test errors, null values, empty arrays, boundaries
- **Test behavior, not implementation** - Assert on observable outputs, not internal method calls
- **Coverage ≠ quality** - 100% coverage with weak assertions is worse than 80% with strong assertions

## Code Review Principles

Mechanical conventions (function size, parameter count, filename case, async/await
over `.then`) are enforced by ESLint — see `.eslintrc.js`, not this file.

### Function Design

- **Return early** - Guard clauses at the top, avoid deep nesting

### Code Quality

- **No magic numbers/strings** - Use named constants
- **Handle errors explicitly** - No silent failures

### Review Checklist

1. Are edge cases handled?
2. Are there unused variables/imports?

## Linear Tickets

### MCP Setup

If the Linear MCP server is not installed, add it to your Claude Code configuration:

```bash
claude mcp add linear-server npx -- -y @anthropic/linear-mcp-server
```

### Linking a PR to an existing Linear ticket

When pushing a PR that relates to an existing Linear ticket:

1. **Include the issue identifier in the branch name**
   - Example: `fix/prd-139-list-not-refreshing`
   - Linear automatically detects PRs from branches containing `PRD-XXX`

2. **Add the Linear ticket ID prefixed with "fixes" in the PR body**
   - Example: `fixes PRD-139`
   - This creates the GitHub → Linear link

### Creating a Linear ticket from Claude

Use `mcp__linear-server__create_issue` to create tickets:

```yaml
title: "Bug title"
description: "## Description\n\n..."
team: "Product"
labels: ["bug"]  # optional
```

**Team**: `Product` for product-related issues

**Labels** (optional, skip for small tasks):
- `bug` - Bug reports
- `epic` - Large feature groupings
- `sub epic` - Smaller parts of epics

The response includes a `gitBranchName` field with a suggested branch name containing the issue identifier.
