# Backend

This directory contains code for running the backend. It includes the API server, database migrations, and other backend services. The backend is built with Node.js and TypeScript, and uses PostgreSQL for the database.

## Dependencies

First make sure that the following are installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) to run development services like postgres.
- [nvm](https://github.com/nvm-sh/nvm)

Then, from this directory, run the following command to install the correct
version of Node.js:

```zsh
nvm install
npm install
```

`npm install` also installs the backend git hooks. In the full repository, this
installs the shared root pre-commit hook, which runs the backend hook suite and
any other checked-out project hook suites. In a backend-only checkout, it
installs only the backend hook.

### Running the backend

Make sure Docker Desktop is running. Then, from this directory, run the
following:

```zsh
npm run build
npm run dev:services
npm run db:migrate
npm run dev
```

## Configuration

Configuration is loaded from environment variables. For local development, the
backend provides defaults for the database, auth, and local service URLs, so a
`.env` file is optional.

To override local defaults, copy `.env.example` to `.env` and set the values you
need:

```zsh
cp .env.example .env
```

For local development without Google OAuth, use the default demo credentials:
`dev@lumiflow.ai` and `lumiflow`. These defaults are available only when
`NODE_ENV` is `development`. Override `AUTH_DEV_EMAIL` or `AUTH_DEV_PASSWORD`
if you want to use different local development credentials.

Metric creation previews call the eval service at `EVAL_HOST` (`http://localhost:8000` by default). Set `FAKE_EVAL_SERVICE=1` to use the backend's mock metric preview
response instead.

## Tests

To run the tests, use the following command:

```sh
npm test
```
