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

For a pull request branch in this repository, run the workflow from the Actions
tab. Keep `Use workflow from` set to `Branch: main`, and set
`Branch to update snapshots on` to the PR branch name.

For a pull request from an external fork, first create a helper branch in this
repository from the contributor's branch, then run the workflow on that helper
branch:

```zsh
git fetch https://github.com/<contributor>/lumiflow-oss.git <branch>
git switch -c snapshot-updates/pr-<number> FETCH_HEAD
git push origin snapshot-updates/pr-<number>
```

In GitHub Actions, run `Frontend Update Snapshots`. Keep `Use workflow from` set
to `Branch: main`, and set `Branch to update snapshots on` to:

```text
snapshot-updates/pr-<number>
```

After the workflow commits updated screenshots to the helper branch, a
maintainer can open a pull request from that branch or cherry-pick the snapshot
commit onto the contributor's branch when appropriate.
