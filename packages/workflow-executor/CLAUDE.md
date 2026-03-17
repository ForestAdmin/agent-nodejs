# @forestadmin/workflow-executor

Bibliothèque TypeScript framework-agnostic qui exécute des steps de workflow côté client (infra du client, à côté de l'agent Forest Admin).

## Architecture

- **Pull-based** — L'executor poll `WorkflowPort`. `triggerPoll(runId)` pour accélérer un run spécifique
- **Atomic** — Chaque step exécutée en isolation. `RunStore` assure la continuité entre steps
- **Privacy** — Zéro donnée client dans l'orchestrateur. Données dans `RunStore`
- **Ports** — Toute IO passe par une interface injectée
- **AI intégré** — Utilise `@forestadmin/ai-proxy` (Router) pour créer les modèles et charger les remote tools

## Commands

```bash
yarn workspace @forestadmin/workflow-executor build      # Build
yarn workspace @forestadmin/workflow-executor test        # Run tests
yarn workspace @forestadmin/workflow-executor lint        # Lint
```

## Testing

- Prefer integration tests over unit tests
- Use AAA pattern (Arrange, Act, Assert)
- Test behavior, not implementation
- Strong assertions: verify exact arguments, not just that a function was called

## Changelog

> **IMPORTANT**: When a new feature, fix, or change is implemented, add an entry below summarizing what was done.

| Date       | Type    | Summary |
|------------|---------|---------|
| 2026-03-16 | setup   | Initial package scaffolding (package.json, tsconfig, jest, CI integration) |
