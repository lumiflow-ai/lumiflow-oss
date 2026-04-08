# Lumiflow

Lumiflow is an open-source workspace for evaluating AI product quality.

It helps teams turn prompts, responses, traces, generated reports, and review notes into structured signals that product teams and domain experts can inspect, compare, and improve. Lumiflow is built for the part of AI development where engineering, product judgment, and domain expertise meet.

## What Lumiflow Does

- **Codify product quality**: translate qualitative requirements, rubrics, and expert judgment into evaluation criteria.
- **Organize AI artifacts**: store and navigate generated outputs, snapshots, datasets, and their evaluation history.
- **Evaluate with humans in the loop**: use model-assisted evaluation while keeping expert review and calibration central.
- **Compare iterations**: inspect how prompts, models, metrics, and product changes affect behavior over time.
- **Create shared evidence**: make AI quality legible to engineers, product teams, executives, compliance reviewers, and domain experts.

Lumiflow is not trying to replace your application code, observability stack, or experimentation platform. It is a semantic instrumentation layer for understanding whether an AI product behaves the way its users and stakeholders need it to behave.

## Repository Layout

This repository is a monorepo with four main services:

| Path | Service | Purpose |
| --- | --- | --- |
| [`frontend`](./frontend) | Next.js app | Product UI for datasets, artifacts, metrics, evaluations, and review workflows. |
| [`backend`](./backend) | Node.js API | API server, auth, database access, migrations, and product data model. |
| [`job-service`](./job-service) | Node.js worker service | Queues and runs longer-running evaluation jobs. |
| [`inference`](./inference) | Python inference workspace | FastAPI evaluation service and model/provider integration packages. |

Each service has its own README with deeper setup and development notes. This root README focuses on the overall system and the quickest way to try it locally.

## Quick Start

The easiest way to run Lumiflow locally is with the VS Code dev container.

1. Open [`lumiflow-oss.code-workspace`](./lumiflow-oss.code-workspace) in VS Code.
2. Reopen it in the dev container when prompted, or run **Dev Containers: Reopen in Container** from the command palette.
3. Wait for the dev container setup to finish. It installs dependencies, starts PostgreSQL, and runs migrations.
4. Run the **All** debug target in VS Code.
5. Open [http://localhost:3000](http://localhost:3000).

In development, you can sign in with:

```text
Email: dev@lumiflow.ai
Password: lumiflow
```

These credentials are only active when `NODE_ENV=development`.

After signing in, create an organization and start exploring the app.

### Without the dev container

If you prefer to run the services directly, install Docker, [`nvm`](https://github.com/nvm-sh/nvm), npm, and [`uv`](https://docs.astral.sh/uv/). Then start each service:

| Service | Commands |
| --- | --- |
| [`backend`](./backend) | `nvm install && npm install && npm run dev:services && npm run db:migrate && npm run dev` |
| [`job-service`](./job-service) | `nvm install && npm install && npm run db:migrate && npm run dev` |
| [`inference`](./inference) | `uv sync --all-packages && DEV=1 uv run eval_service` |
| [`frontend`](./frontend) | `nvm install && npm install && npm run dev` |

The backend and job service share the local PostgreSQL database. The inference service defaults to a fake model, so local development does not require model provider credentials.

## Configuration

The services are designed to run locally without `.env` files. Development defaults cover database credentials, local service URLs, and demo auth.

Common customization points:

- Backend configuration: [`backend/README.md`](./backend/README.md)
- Frontend configuration: [`frontend/README.md`](./frontend/README.md)
- Job service configuration: [`job-service/README.md`](./job-service/README.md)
- Evaluation service and model providers: [`inference/readme.md`](./inference/readme.md) and [`inference/documentation/eval_service.md`](./inference/documentation/eval_service.md)

By default, the inference service exposes a fake model for local testing. To use real model providers, create an eval config and set `EVAL_CONFIG_PATH`; see [`inference/example_eval_config.json`](./inference/example_eval_config.json).

## Docker Compose

The root [`compose.yaml`](./compose.yaml) describes the production-style container stack:

Before deploying outside of localhost, replace the local database credentials in [`compose.yaml`](./compose.yaml),
including `POSTGRES_PASSWORD` and the matching `DB_CREDENTIALS` values.

```sh
docker compose up --build
```

For development, prefer the VS Code dev container.

## License

Lumiflow is released under the terms of the [MIT License](./LICENSE).
