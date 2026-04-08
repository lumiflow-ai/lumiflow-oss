# Lumiflow Job Service

The job service accepts job requests over HTTP, stores them in Postgres, and runs a local queue processor that executes supported job kinds.

## Requirements

- Node.js matching `.nvmrc`
- npm
- Docker, if you want to use the included local Postgres container

## Local Setup

From this directory:

```bash
npm install
```

`npm install` also installs the job-service git hooks. In the full repository,
this installs the shared root pre-commit hook, which runs the job-service hook
suite and any other checked-out project hook suites. In a job-service-only
checkout, it installs only the job-service hook.

Start the local database:

```bash
npm run dev:docker
```

In a full monorepo checkout, this reuses the backend development database
container. In a job-service-only checkout, it starts the job service's own
Postgres container.

Run migrations:

```bash
npm run db:migrate
```

Start the service:

```bash
npm run dev
```

By default the HTTP server listens on `http://localhost:4004`.

## Configuration

In development and test mode, the service can run without a `.env` file. The defaults are:

```text
JOB_SERVICE_LISTEN_PORT=4004
JOB_SERVICE_HOST=http://localhost:4004
FRONTEND_PUBLIC_URL_AND_PORT=http://localhost:3000
EVAL_HOST=http://localhost:8000
DB_HOST=localhost
DB_DATABASE_NAME=lumiflowdb
DB_CREDENTIALS={"username":"ai","password":"human","port":5432}
MAX_JOB_ATTEMPTS=3
```

To override these values, create a `.env` file in this directory and set the variables you need. In production mode, all service-specific configuration must be provided by the environment.

## Useful Commands

```bash
npm run dev          # start with file watching
npm run start        # start without file watching
npm run build        # type-check/compile with TypeScript
npm run test         # run tests
npm run lint         # run Biome checks
npm run format       # format with Biome
npm run db:migrate   # apply database migrations
```

## Health Check

With the service running:

```bash
curl http://localhost:4004/healthcheck
```

Expected response:

```text
OK
```

## API Routes

- `GET /healthcheck`
- `POST /create`
- `POST /cancel-evaluation`

`POST /create` accepts a job request with:

```json
{
  "kind": "scheduleRecipeEvaluation",
  "orgID": "00000000-0000-0000-0000-000000000000",
  "callbackURL": null,
  "inputs": {}
}
```

The exact `inputs` shape depends on the job kind.
