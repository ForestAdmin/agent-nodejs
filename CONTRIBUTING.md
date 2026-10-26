# Contributing to agent-nodejs

Thanks for helping improve the Forest Node.js agent. This guide covers how to report an issue, set up the repository, and get a pull request merged.

## Before you start

- **Found a bug?** Open an issue with the template: expected behavior, actual behavior, logs, and the package versions you use.
- **Found a security issue?** Do not open a public issue. Follow the [security policy](https://github.com/ForestAdmin/.github/blob/main/SECURITY.md).
- **Planning a large change?** Open an issue first to discuss it, so your work fits the agent's direction before you write it.

## Setup

This is a lerna monorepo using yarn workspaces. Use the Node.js version in [`.nvmrc`](./.nvmrc).

```bash
nvm use
yarn install
yarn build
```

## Tests and lint

```bash
yarn test            # all packages
yarn test:coverage   # with coverage
yarn lint            # eslint on every package
yarn lint:fix
```

Tests must pass and lint must be clean before you open a pull request.

## Commit messages

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, enforced by commitlint. Releases and changelogs are generated from them by semantic-release, so the type matters:

- `fix(datasource-sql): handle null dates` → patch release
- `feat(agent): add the X option` → minor release
- `docs: ...`, `test: ...`, `chore: ...` → no release

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, with tests.
3. Give the pull request a Conventional Commits title and fill in the template checklist.
4. The CI must be green. The Forest team reviews every pull request before merging.

## Code of conduct

Everyone taking part in this project is expected to follow the [code of conduct](https://github.com/ForestAdmin/.github/blob/main/CODE_OF_CONDUCT.md).
