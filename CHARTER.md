# GitProxy Technical Charter

## Mission

GitProxy enables organisations — particularly regulated financial institutions and other enterprises — to enforce configurable policies on outgoing Git push operations, ensuring compliance with security, legal, and risk requirements while preserving the standard open source developer experience.

## Scope

The project develops and maintains:

- The Git HTTP and SSH proxy server
- The policy engine (processor chain and plugin system)
- The approval and review workflow
- The service API and web-based dashboard
- The command-line interface (CLI)
- Associated documentation and tooling

Out of scope:

- Organisation-specific policy content or plugin implementations
- Hosting, infrastructure, or operational support for production deployments

## Maintainer Structure

The project community consists of Contributors and Maintainers:

- **Contributor** — anyone who submits a contribution to the project (code, issues, comments, documentation, media, or any combination).
- **Maintainer** — a Contributor who, by virtue of their contribution history, has been given write access to project repositories and may merge approved contributions.
- **Lead Maintainer** — the project's interface with the FINOS team and Board. Responsible for approving quarterly project reports and communicating on behalf of the project. Elected by a vote of the Maintainers.

The Maintainers collectively serve as the project's technical steering body. The current roster is recorded in [`MAINTAINERS.md`](MAINTAINERS.md).

## Decision Making

Maintainers reach decisions by consensus where possible, and by vote when necessary. The voting process, contribution rules, cross-firm review requirements, and dispute resolution procedures are defined in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Intellectual Property

- The project is licensed under the [Apache License, Version 2.0](LICENSE).
- Contributions are governed by the [FINOS IP Policy](https://community.finos.org/assets/files/IP-Policy-fe5925025fc0a57b1cbed64f86b26a73.pdf).
- All contributors must have a Contributor License Agreement (CLA) on file with FINOS before contributions can be merged.

## Amendments

This charter may be amended by a vote of the Maintainers according to the voting process defined in [`CONTRIBUTING.md`](CONTRIBUTING.md), subject to FINOS Board approval.
