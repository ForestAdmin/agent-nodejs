## Definition of Done

### General

- [ ] Write an explicit title for the Pull Request, following [Conventional Commits specification](https://www.conventionalcommits.org)
- [ ] Test manually the implemented changes
- [ ] Validate the code quality (indentation, syntax, style, simplicity, readability)

### Security

- [ ] Every new endpoint, action or query checks permissions server-side, scoped to the right project, environment and user
- [ ] Any input coming from a user, a customer agent, a webhook or an LLM is validated before use
- [ ] No secret, token, PII or customer data in code, logs, error messages, test fixtures or prompts
- [ ] Any new dependency is legitimate, maintained and pinned in the lockfile
- [ ] AI-generated code has been read and understood, and I can defend it in review
- [ ] Tests cover the negative cases: access denied, wrong tenant, invalid input, expired token
- [ ] This repository is public: if this PR fixes a vulnerability, nothing in it (title, description, branch, commits, comments, tests, changelog) explains how to exploit it

Forest team: details for each point in the [secure development guide](https://forest.slite.com/app/docs/k_OVw3vjtNf2kE). To report a vulnerability, follow the [security policy](https://github.com/ForestAdmin/.github/blob/main/SECURITY.md), never a public issue or pull request.
