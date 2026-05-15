<!--
  Thanks for contributing to GitProxy!
  Please read CONTRIBUTING.md before submitting your PR:
  https://github.com/finos/git-proxy/blob/main/CONTRIBUTING.md
-->

## Description

<!-- Provide a clear and concise description of the changes in this PR. -->

## Related Issue

<!-- Link the issue this PR addresses. Use a closing keyword to auto-close it on merge. -->
<!-- Example: Resolves #123 -->

Resolves #

## Checklist

<!-- Check items that apply by replacing [ ] with [x]. -->

### General

- [ ] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format
- [ ] I have a [FINOS CLA](https://finosfoundation.atlassian.net/wiki/spaces/FINOS/pages/75530375/Contribution+Compliance+Requirements) on file

### Documentation

<!--
  Documentation lives in two locations:
  - website/docs/ — User-facing docs published to https://git-proxy.finos.org (quickstart, configuration, deployment)
  - docs/ — Technical docs such as architecture, processors, and upgrade guides
-->

- [ ] Documentation has been added/updated for any new features

### Configuration

<!--
  If you modified config.schema.json, you must regenerate types and docs:
  - npm run generate-config-types (regenerates src/config/generated-config-types.ts)
  - npm run gen-schema-doc (regenerates website/docs/configuration/reference.md)
-->

- [ ] If configuration schema (`config.schema.json`) was modified:
  - [ ] TypeScript types regenerated (`npm run generate-config-types`)
  - [ ] Schema reference docs regenerated (`npm run gen-schema-doc`)

### Tests

<!--
  Tests are required for new functionality (80%+ patch coverage enforced by CodeCov).
  Add tests in the appropriate location:
  - test/          — Unit and integration tests (Vitest). Organised by module (processors/, db/, services/, plugin/, etc.)
  - tests/e2e/     — End-to-end tests (Vitest + Docker). Real git operations against a containerised environment.
  - cypress/e2e/   — UI tests (Cypress). Dashboard UI end-to-end tests.
-->

- [ ] Tests have been added/updated for new functionality
- [ ] Unit tests pass (`npm test`)
- [ ] Linting and formatting pass (`npm run lint` and `npm run format:check`)
- [ ] Type checks pass (`npm run check-types`)
