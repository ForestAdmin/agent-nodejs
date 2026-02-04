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
- **Use AAA pattern** - Arrange (setup), Act (execute), Assert (verify) - keep these sections clear
- **Test edge cases** - Not just happy paths; test errors, null values, empty arrays, boundaries
- **Test behavior, not implementation** - Assert on observable outputs, not internal method calls
- **Coverage ≠ quality** - 100% coverage with weak assertions is worse than 80% with strong assertions

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

## Linear Tickets

When creating Linear tickets for bugs or features, ensure bidirectional linking with GitHub.

### MCP Setup

If the Linear MCP server is not installed, add it to your Claude Code configuration:

```bash
claude mcp add linear-server npx -- -y @anthropic/linear-mcp-server
```

### Creating a ticket

Use the Linear MCP tools to create issues:
- `mcp__linear-server__create_issue` - Create a new issue
- Team: `Product` for product-related issues
- **Labels** (optional): Use when appropriate, skip for small tasks
  - `bug` - Bug reports
  - `epic` - Large feature groupings
  - `sub epic` - Smaller parts of epics

Example:
```yaml
# mcp__linear-server__create_issue
title: "Bug title"
description: "## Description\n\n..."
team: "Product"
labels: ["bug"]
```

### Linking Linear ↔ GitHub

1. **Use the suggested branch name** from Linear (returned in `gitBranchName` field)
   - Example: `feature/prd-139-list-not-refreshing-when-navigating-back-via-breadcrumbs`
   - Linear automatically links PRs from branches containing the issue identifier

2. **Include Linear URL in PR description**
   - Add the Linear issue URL in the PR body so GitHub shows the link
   - Example: `Linear: https://linear.app/forestadmin/issue/PRD-139/...`

### Example workflow

1. Create Linear issue with labels → get `PRD-XXX` identifier and `gitBranchName`
2. Create branch using the suggested name: `git checkout -b feature/prd-xxx-description`
3. Make changes and commit
4. Create PR with Linear URL in description
