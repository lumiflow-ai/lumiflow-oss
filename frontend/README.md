# Frontend

This directory contains code for running the Lumiflow frontend. It includes the
marketing site and the product application, built with Next.js and TypeScript.

## Dependencies

First make sure that the following are installed:

- [nvm](https://github.com/nvm-sh/nvm)
- npm

Then, from this directory, run the following command to install the correct
version of Node.js:

```zsh
nvm install
npm install
```

`npm install` also installs the frontend git hooks. In the full repository, this
installs the shared root pre-commit hook, which runs the frontend hook suite and
any other checked-out project hook suites. In a frontend-only checkout, it
installs only the frontend hook.

## Running the Frontend

From this directory, run:

```zsh
npm run dev
```

By default, the frontend listens on `http://localhost:3000`.

Useful local routes:

- [http://localhost:3000/](http://localhost:3000/) - Marketing site
- [http://localhost:3000/app](http://localhost:3000/app) - Lumiflow Product

## Configuration

Configuration is loaded from environment variables. For local development, the
frontend can run without a `.env` file.

To override local defaults, copy `.env.example` to `.env` and set the values you
need:

```zsh
cp .env.example .env
```

## Useful Commands

```zsh
npm run dev                  # start the development server
npm run dev:release          # build and start the production server locally
npm run build                # build the Next.js application
npm run start                # start the built Next.js application
npm run typecheck            # run TypeScript checks
npm run test                 # run all Vitest projects
npm run test:unit            # run unit tests
npm run test:snapshot        # run snapshot tests
npm run test:snapshot:update # update snapshot tests
npm run lint                 # run Biome checks
npm run format               # format with Biome
```

## Tests

To run browser snapshot tests locally, first install Playwright:

```zsh
npx playwright install
```

Unit tests can be run with:

```zsh
npm run test:unit
```

Snapshot tests are verified in CI and can be previewed locally with:

```zsh
npm run test:snapshot
```

To regenerate snapshot tests locally, run:

```zsh
npm run test:snapshot:update
```

Snapshot rendering can vary slightly between local machines and CI. If local
updates do not match CI, maintainers can run the `Frontend Update Snapshots`
workflow in GitHub Actions for a branch in this repository.
